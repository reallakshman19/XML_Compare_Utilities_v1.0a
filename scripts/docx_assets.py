"""Deterministic DOCX drawing/image discovery, tokenization, and asset materialization."""

from __future__ import annotations

from dataclasses import replace
import hashlib
import posixpath
import re
from pathlib import Path
from xml.etree import ElementTree as ET

from document_model import (
    AssetDefinition,
    DocumentModel,
    InlineImage,
    InlineText,
    InlineUnsupported,
    ParagraphBlock,
    TableBlock,
    TableCell,
    TableRow,
)

WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
DRAWING_NS = "http://schemas.openxmlformats.org/drawingml/2006/main"
WP_NS = "http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
W = f"{{{WORD_NS}}}"
A = f"{{{DRAWING_NS}}}"
WP = f"{{{WP_NS}}}"
R = f"{{{OFFICE_REL_NS}}}"
DOC_PART = "word/document.xml"
TOKEN_START = "\ue000"
TOKEN_END = "\ue001"
_TOKEN_RE = re.compile(r"\ue000IMAGE:(\d+)\ue001")
SUPPORTED_IMAGE_EXTENSIONS = {"png", "jpg", "jpeg", "gif", "webp", "svg"}


def prepare_package_for_assets(package):
    root = package.xml(DOC_PART)
    if root is None:
        raise ValueError(f"DOCX does not contain {DOC_PART}")
    paragraph_captions = _caption_candidates(root)
    assets_by_part: dict[str, AssetDefinition] = {}
    payloads: dict[str, bytes] = {}
    drawings: list[dict] = []
    diagnostics: list[dict] = []
    paragraphs = list(root.iter(W + "p"))
    paragraph_ordinals = {id(node): index for index, node in enumerate(paragraphs)}
    for paragraph in paragraphs:
        paragraph_ordinal = paragraph_ordinals[id(paragraph)]
        caption = paragraph_captions.get(paragraph_ordinal)
        for drawing in list(paragraph.iter(W + "drawing")):
            event = _drawing_event(
                package, drawing, len(drawings), paragraph_ordinal, caption,
                assets_by_part, payloads, diagnostics,
            )
            drawings.append(event)
            if not _replace_drawing(paragraph, drawing, event["drawingIndex"]):
                diagnostics.append(_diagnostic(
                    "DOCX_DRAWING_TOKENIZATION_FAILED", "WARNING",
                    f"Drawing {event['drawingIndex']} could not be replaced by a semantic token",
                    DOC_PART,
                ))
    parts = dict(package.parts)
    parts[DOC_PART] = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    prepared = package.__class__(
        parts, package.crc32, package.relationships_by_part, package.content_types,
    )
    assets = tuple(sorted(assets_by_part.values(), key=lambda value: value.asset_id))
    return prepared, tuple(drawings), assets, payloads, tuple(diagnostics)


def enrich_document_assets(
    document: DocumentModel,
    drawings: tuple[dict, ...],
    assets: tuple[AssetDefinition, ...],
    diagnostics: tuple[dict, ...],
) -> DocumentModel:
    event_map = {str(item["drawingIndex"]): item for item in drawings}
    event_map["__assets__"] = assets
    blocks = tuple(_enrich_block(block, event_map) for block in document.blocks)
    metadata = {
        **document.metadata,
        "drawingCount": len(drawings),
        "assetCount": len(assets),
    }
    return replace(
        document,
        blocks=blocks,
        metadata=metadata,
        diagnostics=(*document.diagnostics, *diagnostics),
        assets=assets,
    )


def materialize_assets(
    assets: tuple[AssetDefinition, ...],
    payloads: dict[str, bytes],
    directory: Path,
) -> list[Path]:
    directory.mkdir(parents=True, exist_ok=True)
    written: list[Path] = []
    for asset in assets:
        payload = payloads.get(asset.asset_id)
        if payload is None:
            continue
        target = directory / asset.filename
        if target.name != asset.filename:
            raise ValueError(f"Unsafe asset filename: {asset.filename}")
        if target.exists():
            if target.read_bytes() == payload:
                written.append(target)
                continue
            raise ValueError(f"Asset filename collision with different bytes: {target.name}")
        target.write_bytes(payload)
        written.append(target)
    return written


def _drawing_event(
    package,
    drawing: ET.Element,
    drawing_index: int,
    paragraph_ordinal: int,
    caption: str | None,
    assets_by_part: dict[str, AssetDefinition],
    payloads: dict[str, bytes],
    diagnostics: list[dict],
) -> dict:
    blips = drawing.findall(".//" + A + "blip")
    relationship_id = blips[0].get(R + "embed") if blips else None
    external_id = blips[0].get(R + "link") if blips else None
    alt_text = _drawing_alt_text(drawing)
    base = {
        "drawingIndex": drawing_index,
        "paragraphOrdinal": paragraph_ordinal,
        "relationshipId": relationship_id or external_id,
        "altText": alt_text,
        "caption": caption,
        "sourcePart": DOC_PART,
    }
    if len(blips) != 1:
        return _unresolved_event(base, "DOCX_DRAWING_BLIP_AMBIGUOUS", diagnostics)
    if external_id and not relationship_id:
        return _unresolved_event(base, "DOCX_EXTERNAL_IMAGE_NOT_FETCHED", diagnostics)
    if not relationship_id:
        return _unresolved_event(base, "DOCX_DRAWING_RELATIONSHIP_MISSING", diagnostics)
    relationship = package.relationship(DOC_PART, relationship_id)
    if relationship is None or relationship.is_external or not relationship.resolved_part:
        code = "DOCX_EXTERNAL_IMAGE_NOT_FETCHED" if relationship and relationship.is_external else "DOCX_DRAWING_RELATIONSHIP_MISSING"
        return _unresolved_event(base, code, diagnostics)
    media_part = relationship.resolved_part
    payload = package.part_bytes(media_part)
    if payload is None:
        return _unresolved_event(base, "DOCX_IMAGE_PART_MISSING", diagnostics)
    asset = assets_by_part.get(media_part)
    if asset is None:
        asset = _asset_definition(package, media_part, relationship_id, payload)
        assets_by_part[media_part] = asset
        payloads[asset.asset_id] = payload
        if not asset.render_supported:
            diagnostics.append(_diagnostic(
                "DOCX_IMAGE_FORMAT_UNSUPPORTED", "WARNING",
                f"Embedded image {media_part} is preserved as an asset but not rendered inline",
                media_part,
            ))
    return {**base, "assetId": asset.asset_id, "status": "ok"}


def _asset_definition(package, media_part: str, relationship_id: str, payload: bytes) -> AssetDefinition:
    digest = hashlib.sha256(payload).hexdigest()
    extension = posixpath.splitext(media_part)[1].lstrip(".").lower() or "bin"
    filename = f"asset-{digest[:24]}.{extension}"
    return AssetDefinition(
        asset_id=f"sha256-{digest[:24]}",
        source_part=DOC_PART,
        relationship_id=relationship_id,
        media_part=media_part,
        source_filename=posixpath.basename(media_part),
        content_type=package.content_type(media_part),
        sha256=digest,
        byte_length=len(payload),
        filename=filename,
        render_supported=extension in SUPPORTED_IMAGE_EXTENSIONS,
    )


def _unresolved_event(base: dict, code: str, diagnostics: list[dict]) -> dict:
    diagnostics.append(_diagnostic(
        code, "WARNING", f"Drawing {base['drawingIndex']} could not resolve a safe embedded image", DOC_PART,
    ))
    return {**base, "assetId": None, "status": code}


def _diagnostic(code: str, severity: str, message: str, part: str) -> dict:
    return {
        "code": code,
        "severity": severity,
        "message": message,
        "provenance": {"source_type": "docx", "part": part},
    }


def _drawing_alt_text(drawing: ET.Element) -> str:
    doc_pr = drawing.find(".//" + WP + "docPr")
    if doc_pr is None:
        return ""
    return doc_pr.get("descr") or doc_pr.get("title") or doc_pr.get("name") or ""


def _caption_candidates(root: ET.Element) -> dict[int, str]:
    paragraphs = list(root.iter(W + "p"))
    ordinals = {id(paragraph): index for index, paragraph in enumerate(paragraphs)}
    parents = {id(child): parent for parent in root.iter() for child in list(parent)}
    captions: dict[int, str] = {}
    for paragraph in paragraphs:
        if paragraph.find(".//" + W + "drawing") is None:
            continue
        parent = parents.get(id(paragraph))
        if parent is None:
            continue
        siblings = list(parent)
        try:
            index = next(i for i, node in enumerate(siblings) if node is paragraph)
        except StopIteration:
            continue
        if index + 1 >= len(siblings):
            continue
        candidate = siblings[index + 1]
        if candidate.tag == W + "p" and _is_explicit_caption(candidate):
            captions[ordinals[id(paragraph)]] = _paragraph_text(candidate)
    return captions


def _is_explicit_caption(paragraph: ET.Element) -> bool:
    style = paragraph.find("./" + W + "pPr/" + W + "pStyle")
    style_value = style.get(W + "val", "") if style is not None else ""
    if style_value.lower() == "caption":
        return True
    instruction = " ".join(
        node.text or "" for node in paragraph.iter(W + "instrText")
    ).upper()
    return "SEQ FIGURE" in instruction or "SEQ TABLE" in instruction


def _paragraph_text(paragraph: ET.Element) -> str:
    return "".join(
        node.text or "" for node in paragraph.iter()
        if _local_name(node) in {"t", "delText"}
    ).strip()


def _replace_drawing(paragraph: ET.Element, drawing: ET.Element, drawing_index: int) -> bool:
    for run in paragraph.iter(W + "r"):
        for index, child in enumerate(list(run)):
            if child is drawing:
                text = ET.Element(W + "t")
                text.text = f"{TOKEN_START}IMAGE:{drawing_index}{TOKEN_END}"
                run[index] = text
                return True
    return False


def _enrich_block(block, event_map: dict[str, dict]):
    if isinstance(block, ParagraphBlock):
        inlines = _enrich_inlines(block.inlines, event_map)
        return replace(block, inlines=inlines, text=_plain_text(inlines))
    if isinstance(block, TableBlock):
        return replace(
            block,
            rows=_enrich_rows(block.rows, event_map),
            source_rows=_enrich_rows(block.source_rows, event_map),
            position_rows=_enrich_rows(block.position_rows, event_map),
        )
    return block


def _enrich_rows(rows: tuple[TableRow, ...], event_map: dict[str, dict]) -> tuple[TableRow, ...]:
    return tuple(
        replace(row, cells=tuple(_enrich_cell(cell, event_map) for cell in row.cells))
        for row in rows
    )


def _enrich_cell(cell: TableCell, event_map: dict[str, dict]) -> TableCell:
    return replace(cell, blocks=tuple(_enrich_block(block, event_map) for block in cell.blocks))


def _enrich_inlines(inlines: tuple, event_map: dict[str, dict]) -> tuple:
    values: list = []
    for inline in inlines:
        if not isinstance(inline, InlineText):
            values.append(inline)
            continue
        position = 0
        for match in _TOKEN_RE.finditer(inline.text):
            if match.start() > position:
                values.append(InlineText(inline.text[position:match.start()]))
            event = event_map.get(match.group(1), {})
            if event.get("assetId"):
                asset = next((value for value in event_map.get("__assets__", ()) if value.asset_id == event["assetId"]), None)
                values.append(InlineImage(
                    event["assetId"], event.get("altText", ""),
                    event.get("relationshipId"), event.get("caption"),
                    asset.filename if asset else None,
                    asset.render_supported if asset else False,
                ))
            else:
                code = event.get("status", "DOCX_DRAWING_UNRESOLVED")
                values.append(InlineUnsupported(f"⟦{code}⟧", code))
            position = match.end()
        if position < len(inline.text):
            values.append(InlineText(inline.text[position:]))
    return tuple(values)


def _plain_text(inlines: tuple) -> str:
    parts: list[str] = []
    for inline in inlines:
        if isinstance(inline, InlineText):
            parts.append(inline.text)
        elif isinstance(inline, InlineImage):
            parts.append(f"[image:{inline.alt_text or inline.asset_id}]")
        elif isinstance(inline, InlineUnsupported):
            parts.append(inline.marker)
        elif hasattr(inline, "text"):
            parts.append(getattr(inline, "text"))
    return "".join(parts)


def _local_name(node: ET.Element) -> str:
    return node.tag.rsplit("}", 1)[-1]
