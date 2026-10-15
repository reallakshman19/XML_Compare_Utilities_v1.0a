"""Shared Markdown/HTML rendering for the semantic document model."""

from __future__ import annotations

import html
from xml.etree import ElementTree as ET

from document_model import (
    DocumentModel, InlineBreak, InlineCommentReference, InlineHyperlink, InlineImage,
    InlineNoteReference, InlineRevision, InlineSymbol, InlineTab, InlineText,
    InlineUnsupported, PageBreakBlock, ParagraphBlock, TableBlock, TableCell,
    UnsupportedBlock,
)
from docx_ooxml_parser import heading_level, paragraph_text, parse_table
from table_rendering import TableRenderDecision, render_table_by_policy


def render_paragraph(block: ParagraphBlock, image_mode: str = "extract") -> str:
    content = _render_inlines(block.inlines, image_mode) if _needs_inline_rendering(block.inlines) else block.text
    if block.heading_level is not None:
        return f"{'#' * block.heading_level} {content.strip()}"
    if block.list_info is not None:
        marker = "-" if block.list_info.number_format == "bullet" else "1."
        return f"{'  ' * block.list_info.level}{marker} {content}"
    return content


def _needs_inline_rendering(inlines) -> bool:
    return any(
        isinstance(value, (InlineHyperlink, InlineSymbol, InlineUnsupported, InlineNoteReference, InlineCommentReference, InlineRevision, InlineImage))
        for value in inlines
    )


def _render_inlines(inlines, image_mode: str = "extract") -> str:
    parts = []
    for inline in inlines:
        if isinstance(inline, InlineText):
            parts.append(inline.text)
        elif isinstance(inline, InlineTab):
            parts.append("\t")
        elif isinstance(inline, InlineBreak):
            parts.append("\n")
        elif isinstance(inline, InlineHyperlink):
            parts.append(_render_hyperlink(inline))
        elif isinstance(inline, InlineSymbol):
            parts.append(inline.text)
        elif isinstance(inline, InlineUnsupported):
            parts.append(inline.marker)
        elif isinstance(inline, InlineImage):
            parts.append(_render_image(inline, image_mode))
        elif isinstance(inline, InlineNoteReference):
            prefix = "fn" if inline.note_type == "footnote" else "en"
            parts.append(f"[^{prefix}{inline.note_id}]")
        elif isinstance(inline, InlineCommentReference):
            continue
        elif isinstance(inline, InlineRevision):
            content = _render_inlines(inline.inlines, image_mode)
            tag = "ins" if inline.revision_type in {"ins", "moveTo"} else "del"
            attribute = f' data-revision="{inline.revision_type}"' if inline.revision_type.startswith("move") else ""
            parts.append(f"<{tag}{attribute}>{content}</{tag}>")
    return "".join(parts)


def _render_image(inline: InlineImage, image_mode: str) -> str:
    if image_mode == "skip":
        return f"⟦IMAGE_SKIPPED:{inline.asset_id}⟧"
    if not inline.render_supported or not inline.filename:
        return f"⟦IMAGE_UNSUPPORTED:{inline.asset_id}⟧"
    alt = inline.alt_text.replace("[", "\\[").replace("]", "\\]")
    return f"![{alt}](assets/{inline.filename})"


def _render_image_html(inline: InlineImage, image_mode: str) -> str:
    if image_mode == "skip":
        return html.escape(f"⟦IMAGE_SKIPPED:{inline.asset_id}⟧", quote=False)
    if not inline.render_supported or not inline.filename:
        return html.escape(f"⟦IMAGE_UNSUPPORTED:{inline.asset_id}⟧", quote=False)
    return (
        f'<img src="assets/{html.escape(inline.filename, quote=True)}" '
        f'alt="{html.escape(inline.alt_text, quote=True)}">'
    )


def _render_inlines_html(inlines, image_mode: str) -> str:
    parts = []
    for inline in inlines:
        if isinstance(inline, InlineText):
            parts.append(html.escape(inline.text, quote=False))
        elif isinstance(inline, InlineTab):
            parts.append("&#9;")
        elif isinstance(inline, InlineBreak):
            parts.append("<br>")
        elif isinstance(inline, InlineHyperlink):
            label = html.escape(inline.text, quote=False)
            if inline.target:
                parts.append(f'<a href="{html.escape(inline.target, quote=True)}">{label}</a>')
            else:
                parts.append(label)
        elif isinstance(inline, InlineImage):
            parts.append(_render_image_html(inline, image_mode))
        elif isinstance(inline, InlineSymbol):
            parts.append(html.escape(inline.text, quote=False))
        elif isinstance(inline, InlineUnsupported):
            parts.append(html.escape(inline.marker, quote=False))
        elif isinstance(inline, InlineNoteReference):
            prefix = "fn" if inline.note_type == "footnote" else "en"
            parts.append(f"[^{prefix}{html.escape(inline.note_id, quote=False)}]")
        elif isinstance(inline, InlineCommentReference):
            continue
        elif isinstance(inline, InlineRevision):
            content = _render_inlines_html(inline.inlines, image_mode)
            tag = "ins" if inline.revision_type in {"ins", "moveTo"} else "del"
            attr = f' data-revision="{inline.revision_type}"' if inline.revision_type.startswith("move") else ""
            parts.append(f"<{tag}{attr}>{content}</{tag}>")
    return "".join(parts)


def _render_hyperlink(inline: InlineHyperlink) -> str:
    if not inline.target:
        return inline.text
    label = inline.text.replace("[", "\\[").replace("]", "\\]")
    target = inline.target.replace(" ", "%20").replace(")", "%29")
    return f"[{label}]({target})"


def render_cell_html(cell: TableCell, image_mode: str = "extract") -> str:
    pieces = []
    for block in cell.blocks:
        if isinstance(block, ParagraphBlock):
            if _needs_inline_rendering(block.inlines):
                rendered = _render_inlines_html(block.inlines, image_mode)
                if block.list_info is not None and block.heading_level is None:
                    marker = "-" if block.list_info.number_format == "bullet" else "1."
                    rendered = html.escape(f"{'  ' * block.list_info.level}{marker} ", quote=False) + rendered
                pieces.append(rendered)
            else:
                rendered = html.escape(render_paragraph(block, image_mode), quote=False)
                pieces.append(rendered.replace("\t", "&#9;").replace("\n", "<br>"))
        elif isinstance(block, TableBlock):
            pieces.append(render_table_html(block, image_mode=image_mode))
        elif isinstance(block, UnsupportedBlock):
            pieces.append(html.escape(f"⟦{block.code}⟧", quote=False))
    return "<br>".join(pieces)


def render_table_html(table: TableBlock, indent: int = 0, image_mode: str = "extract") -> str:
    prefix = " " * indent
    lines = [prefix + "<table>"]
    for row in table.rows:
        lines.append(prefix + "  <tr>")
        for cell in row.cells:
            attributes = []
            if cell.column_span != 1:
                attributes.append(f'colspan="{cell.column_span}"')
            if cell.row_span != 1:
                attributes.append(f'rowspan="{cell.row_span}"')
            attr = f" {' '.join(attributes)}" if attributes else ""
            lines.append(prefix + f"    <td{attr}>{render_cell_html(cell, image_mode)}</td>")
        lines.append(prefix + "  </tr>")
    lines.append(prefix + "</table>")
    return "\n".join(lines)


def flatten_block_text(block, image_mode: str = "extract") -> str:
    if isinstance(block, ParagraphBlock):
        value = _render_inlines(block.inlines, image_mode) if any(isinstance(x, InlineImage) for x in block.inlines) else block.text
        return value.replace("\t", " ").replace("\n", " ")
    if isinstance(block, TableBlock):
        rows = block.position_rows or block.source_rows or block.rows
        return " / ".join(
            " | ".join(flatten_cell_text(cell, image_mode) for cell in row.cells)
            for row in rows
        )
    if isinstance(block, UnsupportedBlock):
        return f"⟦{block.code}⟧"
    return ""


def flatten_cell_text(cell: TableCell, image_mode: str = "extract") -> str:
    return " ".join(
        text for text in (flatten_block_text(block, image_mode) for block in cell.blocks) if text
    )


def render_table_tsv(table: TableBlock, image_mode: str = "extract") -> str:
    rows = table.position_rows or table.source_rows or table.rows
    return "\n".join(
        "\t".join(flatten_cell_text(cell, image_mode) for cell in row.cells)
        for row in rows
    )


def html_paragraph_text(paragraph: ET.Element) -> str:
    text, _ = paragraph_text(paragraph)
    return html.escape(text, quote=False).replace("\t", "&#9;").replace("\n", "<br>")


def heading_prefix(style: str | None) -> str | None:
    level = heading_level(style)
    return None if level is None else "#" * level


def table_to_html(table: ET.Element, indent: int = 0) -> str:
    return render_table_html(parse_table(table, 0, "compat-table"), indent)


def flatten_table_text(table: ET.Element) -> str:
    semantic = parse_table(table, 0, "compat-table")
    return " / ".join(
        " | ".join(flatten_cell_text(cell) for cell in row.cells)
        for row in semantic.rows
    )


def table_to_tsv(table: ET.Element) -> str:
    return render_table_tsv(parse_table(table, 0, "compat-table"))


def render_document(
    document: DocumentModel,
    table_format: str = "html",
    *,
    table_mode: str | None = None,
    table_decisions: list[tuple[str, TableRenderDecision]] | None = None,
    header_mode: str = "metadata",
    footer_mode: str = "metadata",
    image_mode: str = "extract",
) -> str:
    rendered: list[tuple[str, bool]] = []
    for block in document.blocks:
        item = _render_block(block, table_format, table_mode, table_decisions, image_mode)
        if item is not None:
            rendered.append(item)
    body = _join_rendered_blocks(rendered)
    body = _render_running_content(body, document, header_mode, footer_mode)
    return _append_note_definitions(body, document)


def _render_running_content(
    body: str, document: DocumentModel, header_mode: str, footer_mode: str,
) -> str:
    headers = document.metadata.get("runningHeaders", []) if header_mode == "keep" else []
    footers = document.metadata.get("runningFooters", []) if footer_mode == "keep" else []
    prefix = _running_content_blocks(headers, "HEADER")
    suffix = _running_content_blocks(footers, "FOOTER")
    parts = []
    if prefix:
        parts.append(prefix)
    if body.strip():
        parts.append(body.rstrip())
    if suffix:
        parts.append(suffix)
    return "\n\n".join(parts).rstrip() + "\n" if parts else "\n"


def _running_content_blocks(items: list[dict], label: str) -> str:
    blocks = []
    for item in items:
        text = item.get("text", "")
        blocks.append(f"<!-- DOCX {label} PART {item['part']} -->\n{text}")
    return "\n\n".join(blocks)


def _append_note_definitions(body: str, document: DocumentModel) -> str:
    if not document.notes:
        return body
    definitions = []
    for note in document.notes:
        prefix = "fn" if note.note_type == "footnote" else "en"
        text = note.text.replace("\n", "\n    ")
        definitions.append(f"[^{prefix}{note.note_id}]: {text}")
    return body.rstrip() + "\n\n" + "\n".join(definitions) + "\n"


def _render_block(
    block,
    table_format: str,
    table_mode: str | None,
    table_decisions: list[tuple[str, TableRenderDecision]] | None,
    image_mode: str,
) -> tuple[str, bool] | None:
    if isinstance(block, PageBreakBlock):
        return "---", False
    if isinstance(block, ParagraphBlock):
        return render_paragraph(block, image_mode), block.list_info is not None and block.heading_level is None
    if isinstance(block, TableBlock):
        if table_mode is None:
            text = render_table_html(block, image_mode=image_mode) if table_format == "html" else render_table_tsv(block, image_mode)
            return text, False
        text, decision = render_table_by_policy(
            block, table_mode,
            cell_text=lambda cell: flatten_cell_text(cell, image_mode),
            html_renderer=lambda value: render_table_html(value, image_mode=image_mode),
        )
        if table_decisions is not None:
            table_decisions.append((block.block_id, decision))
        return text, False
    if isinstance(block, UnsupportedBlock):
        return f"<!-- {block.code}: {block.description} -->", False
    return None


def _join_rendered_blocks(rendered: list[tuple[str, bool]]) -> str:
    if not rendered:
        return "\n"
    output = rendered[0][0]
    for index in range(1, len(rendered)):
        text, is_list = rendered[index]
        previous_list = rendered[index - 1][1]
        output += ("\n" if is_list and previous_list else "\n\n") + text
    return output.rstrip() + "\n"
