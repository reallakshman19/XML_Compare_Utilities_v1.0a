"""Prepare DOCX OOXML revisions/references and enrich the semantic model."""

from __future__ import annotations

from dataclasses import replace
import re
from xml.etree import ElementTree as ET

from document_model import (
    DocumentModel,
    InlineBreak,
    InlineCommentReference,
    InlineHyperlink,
    InlineNoteReference,
    InlineRevision,
    InlineSymbol,
    InlineTab,
    InlineText,
    InlineUnsupported,
    ParagraphBlock,
    TableBlock,
    TableCell,
    TableRow,
)
from docx_ancillary import (
    REVISION_MODES,
    parse_comments,
    parse_notes,
    parse_running_content,
    revision_visible,
)

WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{WORD_NS}}}"
DOC_PART = "word/document.xml"
TOKEN_START = "\ue000"
TOKEN_END = "\ue001"
_TOKEN_RE = re.compile(r"\ue000([^\ue001]+)\ue001")
_REVISION_TYPES = {"ins", "del", "moveFrom", "moveTo"}


def prepare_package_for_revisions(package, revision_mode: str):
    """Return a package copy whose main XML exposes the selected revision semantics."""
    if revision_mode not in REVISION_MODES:
        raise ValueError(f"Unsupported revision mode: {revision_mode}")
    root = package.xml(DOC_PART)
    if root is None:
        raise ValueError(f"DOCX does not contain {DOC_PART}")
    revision_events: list[dict] = []
    _rewrite_container(root, revision_mode, revision_events)
    _replace_reference_nodes(root)
    parts = dict(package.parts)
    parts[DOC_PART] = ET.tostring(root, encoding="utf-8", xml_declaration=True)
    prepared = package.__class__(
        parts, package.crc32, package.relationships_by_part, package.content_types,
    )
    fields = extract_field_evidence(package.xml(DOC_PART))
    return prepared, tuple(revision_events), fields


def enrich_document_model(
    document: DocumentModel,
    original_package,
    revision_mode: str,
    revision_events: tuple[dict, ...],
    fields: tuple[dict, ...],
    header_mode: str = "metadata",
    footer_mode: str = "metadata",
) -> DocumentModel:
    """Replace transport tokens with semantic references/revisions and attach ancillary parts."""
    notes_foot, foot_diagnostics = parse_notes(original_package, "footnote", revision_mode)
    notes_end, end_diagnostics = parse_notes(original_package, "endnote", revision_mode)
    comments = parse_comments(original_package, revision_mode)
    headers, header_diagnostics = parse_running_content(
        original_package, "header", revision_mode,
    )
    footers, footer_diagnostics = parse_running_content(
        original_package, "footer", revision_mode,
    )
    event_map = {str(item["revisionIndex"]): item for item in revision_events}
    blocks = tuple(_enrich_block(block, event_map) for block in document.blocks)
    metadata = {
        **document.metadata,
        "revisionMode": revision_mode,
        "revisionEvents": list(revision_events),
        "fields": list(fields),
        "footnoteCount": len(notes_foot),
        "endnoteCount": len(notes_end),
        "commentCount": len(comments),
        "headerCount": len(headers),
        "footerCount": len(footers),
        "headerMode": header_mode,
        "footerMode": footer_mode,
    }
    if header_mode != "drop":
        metadata["runningHeaders"] = list(headers)
    if footer_mode != "drop":
        metadata["runningFooters"] = list(footers)
    diagnostics = (
        *document.diagnostics,
        *foot_diagnostics,
        *end_diagnostics,
        *header_diagnostics,
        *footer_diagnostics,
        *_drop_diagnostics(headers, "header", header_mode),
        *_drop_diagnostics(footers, "footer", footer_mode),
        *_block_markup_diagnostics(revision_events, revision_mode),
    )
    return replace(
        document,
        blocks=blocks,
        metadata=metadata,
        diagnostics=tuple(diagnostics),
        notes=(*notes_foot, *notes_end),
        comments=comments,
    )


def extract_field_evidence(root: ET.Element | None) -> tuple[dict, ...]:
    if root is None:
        return ()
    evidence: list[dict] = []
    field_index = 0
    for paragraph_ordinal, paragraph in enumerate(root.iter(W + "p")):
        stack: list[dict] = []
        for node in paragraph.iter():
            name = _local_name(node)
            if name == "fldSimple":
                instruction = node.get(W + "instr", "").strip()
                result = _visible_descendant_text(node)
                evidence.append(_field_item(
                    field_index, paragraph_ordinal, instruction, result, "simple",
                ))
                field_index += 1
                continue
            if name == "fldChar":
                field_type = node.get(W + "fldCharType")
                if field_type == "begin":
                    stack.append({"instruction": [], "result": [], "phase": "instruction"})
                elif field_type == "separate" and stack:
                    stack[-1]["phase"] = "result"
                elif field_type == "end" and stack:
                    item = stack.pop()
                    evidence.append(_field_item(
                        field_index,
                        paragraph_ordinal,
                        "".join(item["instruction"]).strip(),
                        "".join(item["result"]),
                        "complex",
                    ))
                    field_index += 1
                continue
            if not stack:
                continue
            if name == "instrText" and stack[-1]["phase"] == "instruction":
                stack[-1]["instruction"].append(node.text or "")
            elif name in {"t", "delText"} and stack[-1]["phase"] == "result":
                stack[-1]["result"].append(node.text or "")
        for item in stack:
            evidence.append(_field_item(
                field_index,
                paragraph_ordinal,
                "".join(item["instruction"]).strip(),
                "".join(item["result"]),
                "unterminated",
            ))
            field_index += 1
    return tuple(evidence)


def _rewrite_container(
    parent: ET.Element,
    revision_mode: str,
    revision_events: list[dict],
) -> None:
    index = 0
    while index < len(parent):
        child = parent[index]
        name = _local_name(child)
        if name in _REVISION_TYPES:
            revision_index = len(revision_events)
            event = {
                "revisionIndex": revision_index,
                "revisionType": name,
                "revisionId": child.get(W + "id"),
                "author": child.get(W + "author"),
                "date": child.get(W + "date"),
                "part": DOC_PART,
                "scope": _revision_scope(child),
            }
            revision_events.append(event)
            _rewrite_container(child, revision_mode, revision_events)
            _convert_deleted_text(child)
            children = list(child)
            replacements: list[ET.Element] = []
            if revision_mode == "markup":
                replacements.append(_token_run(f"REV_START:{revision_index}"))
                replacements.extend(children)
                replacements.append(_token_run(f"REV_END:{revision_index}"))
            elif revision_visible(name, revision_mode):
                replacements.extend(children)
            parent.remove(child)
            for offset, replacement in enumerate(replacements):
                parent.insert(index + offset, replacement)
            index += len(replacements)
            continue
        _rewrite_container(child, revision_mode, revision_events)
        index += 1


def _replace_reference_nodes(root: ET.Element) -> None:
    for run in root.iter(W + "r"):
        index = 0
        while index < len(run):
            child = run[index]
            name = _local_name(child)
            if name == "footnoteReference":
                run[index] = _token_text(f"NOTE:footnote:{child.get(W + 'id', '')}")
            elif name == "endnoteReference":
                run[index] = _token_text(f"NOTE:endnote:{child.get(W + 'id', '')}")
            elif name == "commentReference":
                run[index] = _token_text(f"COMMENT:{child.get(W + 'id', '')}")
            index += 1


def _convert_deleted_text(container: ET.Element) -> None:
    for node in container.iter(W + "delText"):
        node.tag = W + "t"


def _token_run(payload: str) -> ET.Element:
    run = ET.Element(W + "r")
    run.append(_token_text(payload))
    return run


def _token_text(payload: str) -> ET.Element:
    text = ET.Element(W + "t")
    text.text = f"{TOKEN_START}{payload}{TOKEN_END}"
    return text


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


def _enrich_rows(
    rows: tuple[TableRow, ...], event_map: dict[str, dict],
) -> tuple[TableRow, ...]:
    return tuple(
        replace(row, cells=tuple(_enrich_cell(cell, event_map) for cell in row.cells))
        for row in rows
    )


def _enrich_cell(cell: TableCell, event_map: dict[str, dict]) -> TableCell:
    return replace(
        cell,
        blocks=tuple(_enrich_block(block, event_map) for block in cell.blocks),
    )


def _enrich_inlines(inlines: tuple, event_map: dict[str, dict]) -> tuple:
    tokens: list = []
    for inline in inlines:
        if isinstance(inline, InlineText):
            tokens.extend(_split_inline_text(inline.text))
        else:
            tokens.append(inline)
    root: list = []
    stack: list[tuple[str, list]] = []
    for item in tokens:
        if isinstance(item, _Control) and item.kind == "REV_START":
            stack.append((item.value, []))
            continue
        if isinstance(item, _Control) and item.kind == "REV_END":
            if not stack or stack[-1][0] != item.value:
                _append_inline(root, stack, InlineUnsupported(
                    "⟦REVISION_TOKEN_MISMATCH⟧", "DOCX_REVISION_TOKEN_MISMATCH",
                ))
                continue
            revision_id, children = stack.pop()
            event = event_map.get(revision_id, {})
            revision = InlineRevision(
                event.get("revisionType", "unknown"),
                tuple(children),
                event.get("author"),
                event.get("date"),
            )
            _append_inline(root, stack, revision)
            continue
        converted = _control_to_inline(item) if isinstance(item, _Control) else item
        _append_inline(root, stack, converted)
    while stack:
        _, children = stack.pop()
        target = stack[-1][1] if stack else root
        target.extend(children)
        target.append(InlineUnsupported(
            "⟦REVISION_TOKEN_UNCLOSED⟧", "DOCX_REVISION_TOKEN_UNCLOSED",
        ))
    return tuple(root)


class _Control:
    __slots__ = ("kind", "value")

    def __init__(self, kind: str, value: str):
        self.kind = kind
        self.value = value


def _split_inline_text(text: str) -> list:
    parts: list = []
    position = 0
    for match in _TOKEN_RE.finditer(text):
        if match.start() > position:
            parts.append(InlineText(text[position:match.start()]))
        payload = match.group(1)
        fields = payload.split(":", 2)
        if fields[0] in {"REV_START", "REV_END"} and len(fields) >= 2:
            parts.append(_Control(fields[0], fields[1]))
        elif fields[0] == "NOTE" and len(fields) == 3:
            parts.append(_Control("NOTE", f"{fields[1]}:{fields[2]}"))
        elif fields[0] == "COMMENT" and len(fields) >= 2:
            parts.append(_Control("COMMENT", fields[1]))
        else:
            parts.append(InlineText(match.group(0)))
        position = match.end()
    if position < len(text):
        parts.append(InlineText(text[position:]))
    return parts


def _control_to_inline(control: _Control):
    if control.kind == "NOTE":
        note_type, note_id = control.value.split(":", 1)
        return InlineNoteReference(note_type, note_id)
    if control.kind == "COMMENT":
        return InlineCommentReference(control.value)
    return InlineText(f"{TOKEN_START}{control.kind}:{control.value}{TOKEN_END}")


def _append_inline(root: list, stack: list[tuple[str, list]], inline) -> None:
    (stack[-1][1] if stack else root).append(inline)


def _plain_text(inlines: tuple) -> str:
    parts: list[str] = []
    for inline in inlines:
        if isinstance(inline, InlineText):
            parts.append(inline.text)
        elif isinstance(inline, InlineTab):
            parts.append("\t")
        elif isinstance(inline, InlineBreak):
            parts.append("\n")
        elif isinstance(inline, InlineHyperlink):
            parts.append(inline.text)
        elif isinstance(inline, InlineSymbol):
            parts.append(inline.text)
        elif isinstance(inline, InlineUnsupported):
            parts.append(inline.marker)
        elif isinstance(inline, InlineNoteReference):
            prefix = "fn" if inline.note_type == "footnote" else "en"
            parts.append(f"[^{prefix}{inline.note_id}]")
        elif isinstance(inline, InlineCommentReference):
            continue
        elif isinstance(inline, InlineRevision):
            parts.append(_plain_text(inline.inlines))
    return "".join(parts)


def _revision_scope(node: ET.Element) -> str:
    return "block" if any(
        _local_name(child) in {"p", "tbl"} for child in node
    ) else "inline"


def _block_markup_diagnostics(
    events: tuple[dict, ...], revision_mode: str,
) -> tuple[dict, ...]:
    if revision_mode != "markup":
        return ()
    return tuple({
        "code": "DOCX_BLOCK_REVISION_MARKUP_LIMITED",
        "severity": "WARNING",
        "message": (
            f"Block-level {item['revisionType']} revision {item['revisionIndex']} is retained "
            "but readable markup markers are not injected across block boundaries"
        ),
        "provenance": {"source_type": "docx", "part": DOC_PART},
    } for item in events if item.get("scope") == "block")


def _drop_diagnostics(
    items: tuple[dict, ...], kind: str, mode: str,
) -> tuple[dict, ...]:
    if mode != "drop":
        return ()
    return tuple({
        "code": f"DOCX_{kind.upper()}_DROPPED",
        "severity": "INFO",
        "message": f"{item['part']} intentionally omitted by {kind} policy",
        "provenance": {"source_type": "docx", "part": item["part"]},
    } for item in items)


def _field_item(
    index: int, paragraph: int, instruction: str, result: str, kind: str,
) -> dict:
    return {
        "fieldIndex": index,
        "part": DOC_PART,
        "paragraphOrdinal": paragraph,
        "kind": kind,
        "instruction": instruction,
        "result": result,
    }


def _visible_descendant_text(node: ET.Element) -> str:
    return "".join(
        child.text or "" for child in node.iter()
        if _local_name(child) in {"t", "delText"}
    )


def _local_name(node: ET.Element) -> str:
    return node.tag.rsplit("}", 1)[-1]
