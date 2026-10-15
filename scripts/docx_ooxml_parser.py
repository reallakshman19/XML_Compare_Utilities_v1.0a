"""DOCX OOXML traversal into the shared semantic document model."""

from __future__ import annotations

from dataclasses import dataclass, field
from xml.etree import ElementTree as ET

from document_model import (
    DocumentModel,
    InlineBreak,
    InlineHyperlink,
    InlineSymbol,
    InlineTab,
    InlineText,
    InlineUnsupported,
    ListInfo,
    PageBreakBlock,
    ParagraphBlock,
    SourceRef,
    TableBlock,
    TableCell,
    TableRow,
    UnsupportedBlock,
)
from table_grid import RawTable, RawTableCell, RawTableRow, normalize_table_grid
from ooxml_package import (
    DOC_PART,
    NUMBERING_PART,
    STYLES_PART,
    OoxmlPackage,
    NumberingResolver,
    StyleResolver,
    paragraph_properties,
    semantic_heading_level,
)

WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
W = f"{{{WORD_NS}}}"
R = f"{{{OFFICE_REL_NS}}}"


@dataclass
class ParseContext:
    package: OoxmlPackage | None
    styles: StyleResolver
    numbering: NumberingResolver
    source_part: str = DOC_PART
    diagnostics: list[dict] = field(default_factory=list)
    paragraph_count: int = 0
    table_count: int = 0


@dataclass
class FieldState:
    modes: list[str] = field(default_factory=list)

    @property
    def visible(self) -> bool:
        return not self.modes or self.modes[-1] == "result"


@dataclass(frozen=True)
class _PageBreakParagraphPair:
    page_break: PageBreakBlock
    paragraph: ParagraphBlock


def read_document_xml(docx_bytes: bytes) -> tuple[bytes, int]:
    package = OoxmlPackage.from_bytes(docx_bytes)
    return package.require_part(DOC_PART), package.crc32[DOC_PART]


def local_name(node: ET.Element) -> str:
    return node.tag.rsplit("}", 1)[-1]


def paragraph_style(paragraph: ET.Element) -> str | None:
    return paragraph_properties(paragraph)[0]


def paragraph_text(paragraph: ET.Element) -> tuple[str, bool]:
    inlines = _parse_paragraph_inlines(paragraph, _empty_context())
    return _plain_inline_text(inlines), _has_page_break(inlines)


def table_colspan(cell: ET.Element) -> str | None:
    properties = cell.find(W + "tcPr")
    if properties is None:
        return None
    grid_span = properties.find(W + "gridSpan")
    return None if grid_span is None else grid_span.get(W + "val")


def cell_colspan(cell: ET.Element) -> int:
    raw = table_colspan(cell)
    try:
        return max(1, int(raw)) if raw is not None else 1
    except ValueError:
        return 1


def cell_vmerge(cell: ET.Element) -> str | None:
    properties = cell.find(W + "tcPr")
    merge = properties.find(W + "vMerge") if properties is not None else None
    if merge is None:
        return None
    return merge.get(W + "val", "continue")


def row_grid_offset(row: ET.Element, name: str) -> int:
    properties = row.find(W + "trPr")
    node = properties.find(W + name) if properties is not None else None
    if node is None:
        return 0
    try:
        return max(0, int(node.get(W + "val", "0")))
    except ValueError:
        return 0


def table_grid_width(table: ET.Element) -> int:
    grid = table.find(W + "tblGrid")
    return len(grid.findall(W + "gridCol")) if grid is not None else 0


def heading_level(style: str | None) -> int | None:
    return semantic_heading_level(style, None, None)


def parse_cell_blocks(
    cell: ET.Element,
    table_index: int,
    row_index: int,
    cell_index: int,
    context: ParseContext | None = None,
) -> tuple:
    context = context or _empty_context()
    provenance = SourceRef(
        "docx", context.source_part, table_index=table_index,
        row_index=row_index, cell_index=cell_index,
    )
    blocks = []
    for child_index, child in enumerate(_iter_block_nodes(cell)):
        blocks.extend(_parse_cell_child(child, child_index, table_index, provenance, context))
    return tuple(blocks)


def _parse_cell_child(
    child: ET.Element,
    child_index: int,
    table_index: int,
    provenance: SourceRef,
    context: ParseContext,
) -> list:
    name = local_name(child)
    block_id = (
        f"docx:t{table_index}:r{provenance.row_index}:"
        f"c{provenance.cell_index}:b{child_index}"
    )
    if name == "p":
        return _expand_pair(_parse_paragraph_block(child, provenance, block_id, context))
    if name == "tbl":
        return [parse_table(child, table_index, block_id, context)]
    if name == "altChunk":
        return [UnsupportedBlock(
            block_id, provenance, "DOCX_ALTCHUNK_UNSUPPORTED",
            "altChunk content is not expanded",
        )]
    return []


def parse_table(
    table: ET.Element,
    table_index: int,
    block_id: str | None = None,
    context: ParseContext | None = None,
) -> TableBlock:
    context = context or _empty_context()
    provenance = SourceRef("docx", context.source_part, table_index=table_index)
    raw_rows = tuple(
        _parse_raw_table_row(row, table_index, row_index, context)
        for row_index, row in enumerate(table.findall(W + "tr"))
    )
    raw = RawTable(raw_rows, table_grid_width(table))
    rows, source_rows, position_rows, grid_width, diagnostics = normalize_table_grid(
        raw, provenance
    )
    context.diagnostics.extend(diagnostics)
    return TableBlock(
        block_id or f"docx:t{table_index}", rows, provenance,
        source_rows, position_rows, grid_width,
    )


def _parse_raw_table_row(
    row: ET.Element,
    table_index: int,
    row_index: int,
    context: ParseContext,
) -> RawTableRow:
    cells = tuple(
        _parse_raw_table_cell(cell, table_index, row_index, cell_index, context)
        for cell_index, cell in enumerate(row.findall(W + "tc"))
    )
    return RawTableRow(
        cells, row_grid_offset(row, "gridBefore"), row_grid_offset(row, "gridAfter")
    )


def _parse_raw_table_cell(
    cell: ET.Element,
    table_index: int,
    row_index: int,
    cell_index: int,
    context: ParseContext,
) -> RawTableCell:
    provenance = SourceRef(
        "docx", context.source_part, table_index=table_index,
        row_index=row_index, cell_index=cell_index,
    )
    blocks = parse_cell_blocks(cell, table_index, row_index, cell_index, context)
    return RawTableCell(blocks, provenance, cell_colspan(cell), cell_vmerge(cell))


def count_nonempty_text_nodes(body: ET.Element) -> int:
    return sum(1 for node in body.iter(W + "t") if node.text not in (None, ""))


def parse_document_xml(document_xml: bytes) -> tuple[DocumentModel, dict]:
    root = _parse_xml(document_xml, DOC_PART)
    return _parse_document_root(root, _empty_context())


def parse_docx_package(package: OoxmlPackage) -> tuple[DocumentModel, dict]:
    root = package.xml(DOC_PART)
    if root is None:
        raise ValueError(f"DOCX does not contain {DOC_PART}")
    context = ParseContext(
        package=package,
        styles=StyleResolver(package.xml(STYLES_PART)),
        numbering=NumberingResolver(package.xml(NUMBERING_PART)),
    )
    document, stats = _parse_document_root(root, context)
    metadata = _package_metadata(document.metadata, package, context)
    return DocumentModel("docx", document.blocks, metadata, document.diagnostics), stats


def _package_metadata(metadata: dict, package: OoxmlPackage, context: ParseContext) -> dict:
    return {
        **metadata,
        "packageParts": sorted(package.parts),
        "relationshipCount": sum(len(value) for value in package.relationships_by_part.values()),
        "styleCount": len(context.styles.styles),
        "numberingInstanceCount": len(context.numbering.instances),
        "contentTypeCount": len(package.content_types),
    }


def _parse_document_root(root: ET.Element, context: ParseContext) -> tuple[DocumentModel, dict]:
    body = root.find(W + "body")
    if body is None:
        raise ValueError(f"{DOC_PART} does not contain w:body")
    blocks = []
    for child in _iter_block_nodes(body):
        blocks.extend(_expand_pair(_parse_body_block(child, context)))
    document = DocumentModel(
        "docx", tuple(blocks), metadata={"part": context.source_part},
        diagnostics=tuple(context.diagnostics),
    )
    stats = {
        "paragraphs": context.paragraph_count,
        "tables": context.table_count,
        "nonempty_text_nodes": count_nonempty_text_nodes(body),
    }
    return document, stats


def _parse_body_block(child: ET.Element, context: ParseContext):
    name = local_name(child)
    if name == "p":
        index = context.paragraph_count
        context.paragraph_count += 1
        provenance = SourceRef("docx", context.source_part, paragraph_index=index)
        return _parse_paragraph_block(child, provenance, f"docx:p{index}", context)
    if name == "tbl":
        index = context.table_count
        context.table_count += 1
        return parse_table(child, index, context=context)
    if name == "altChunk":
        return _unsupported_body_block(context)
    return None


def _unsupported_body_block(context: ParseContext) -> UnsupportedBlock:
    provenance = SourceRef("docx", context.source_part)
    code = "DOCX_ALTCHUNK_UNSUPPORTED"
    _diagnose(context, code, "WARNING", "altChunk content is not expanded", provenance)
    return UnsupportedBlock(
        f"docx:unsupported:{len(context.diagnostics)}",
        provenance, code, "altChunk content is not expanded",
    )


def _parse_paragraph_block(
    paragraph: ET.Element,
    provenance: SourceRef,
    block_id: str,
    context: ParseContext,
):
    style_id, direct_outline, direct_num_id, direct_level = paragraph_properties(paragraph)
    effective = context.styles.resolve(style_id)
    _diagnose_unresolved_style(context, style_id, effective, provenance)
    num_id, level = _effective_numbering(direct_num_id, direct_level, effective)
    list_info = _resolve_list_info(context, num_id, level, provenance)
    inlines = _parse_paragraph_inlines(paragraph, context, provenance)
    text = _plain_inline_text(inlines)
    has_page_break = _has_page_break(inlines)
    if has_page_break:
        text = text.lstrip("\n")
        inlines = _strip_leading_breaks(inlines)
    if not text and not any(isinstance(value, InlineUnsupported) for value in inlines):
        return PageBreakBlock(f"{block_id}:page-break", provenance) if has_page_break else None
    outline = direct_outline if direct_outline is not None else (effective.outline_level if effective else None)
    block = ParagraphBlock(
        block_id, text, provenance,
        semantic_heading_level(style_id, effective, direct_outline),
        style_id, effective.chain if effective else (), outline,
        list_info, inlines,
    )
    return _PageBreakParagraphPair(PageBreakBlock(f"{block_id}:page-break", provenance), block) if has_page_break else block


def _effective_numbering(direct_num_id: int | None, direct_level: int | None, effective):
    num_id = direct_num_id if direct_num_id is not None else (effective.num_id if effective else None)
    level = direct_level if direct_level is not None else (effective.list_level if effective else None)
    return num_id, level


def _parse_paragraph_inlines(
    paragraph: ET.Element,
    context: ParseContext,
    provenance: SourceRef | None = None,
) -> tuple:
    state = FieldState()
    values = []
    for child in list(paragraph):
        if local_name(child) != "pPr":
            values.extend(_parse_inline_node(child, context, state, provenance))
    return tuple(values)


def _parse_inline_node(
    node: ET.Element,
    context: ParseContext,
    state: FieldState,
    provenance: SourceRef | None,
):
    name = local_name(node)
    if name == "r":
        return _parse_run(node, context, state, provenance)
    if name == "hyperlink":
        return _parse_hyperlink(node, context, state, provenance)
    if name in {"fldSimple", "ins", "moveTo", "smartTag", "customXml", "dir", "bdo"}:
        return _parse_inline_children(node, context, state, provenance)
    if name == "sdt":
        content = node.find(W + "sdtContent")
        return [] if content is None else _parse_inline_children(content, context, state, provenance)
    return []


def _parse_inline_children(
    node: ET.Element,
    context: ParseContext,
    state: FieldState,
    provenance: SourceRef | None,
):
    values = []
    for child in list(node):
        values.extend(_parse_inline_node(child, context, state, provenance))
    return values


def _parse_run(
    run: ET.Element,
    context: ParseContext,
    state: FieldState,
    provenance: SourceRef | None,
):
    values = []
    for child in list(run):
        value = _parse_run_child(child, context, state, provenance)
        if value is not None:
            values.append(value)
    return values


def _parse_run_child(
    child: ET.Element,
    context: ParseContext,
    state: FieldState,
    provenance: SourceRef | None,
):
    name = local_name(child)
    if name == "fldChar":
        _update_field_state(state, child.get(W + "fldCharType"))
        return None
    if name == "instrText" or not state.visible:
        return None
    if name == "t":
        return InlineText(child.text or "")
    if name == "tab":
        return InlineTab()
    if name in {"br", "cr"}:
        return InlineBreak(child.get(W + "type", "line") if name == "br" else "line")
    if name == "noBreakHyphen":
        return InlineText("\u2011")
    if name == "softHyphen":
        return InlineText("\u00ad")
    if name == "sym":
        return _parse_symbol(child, context, provenance)
    if name == "drawing":
        return _drawing_placeholder(context, provenance)
    return None


def _drawing_placeholder(context: ParseContext, provenance: SourceRef | None) -> InlineUnsupported:
    code = "DOCX_DRAWING_DEFERRED"
    _diagnose(
        context, code, "WARNING",
        "Drawing/image extraction is deferred to a later issue #960 slice", provenance,
    )
    return InlineUnsupported("⟦DRAWING⟧", code)


def _parse_hyperlink(
    node: ET.Element,
    context: ParseContext,
    state: FieldState,
    provenance: SourceRef | None,
):
    label = _plain_inline_text(_parse_inline_children(node, context, state, provenance))
    relationship_id = node.get(R + "id")
    anchor = node.get(W + "anchor")
    target = f"#{anchor}" if anchor else None
    if relationship_id:
        target = _relationship_href(context, relationship_id, target, provenance)
    return [InlineHyperlink(label, target, relationship_id, anchor)]


def _relationship_href(
    context: ParseContext,
    relationship_id: str,
    fallback: str | None,
    provenance: SourceRef | None,
) -> str | None:
    relationship = context.package.relationship(context.source_part, relationship_id) if context.package else None
    if relationship is None:
        _diagnose(
            context, "DOCX_RELATIONSHIP_MISSING", "WARNING",
            f"Hyperlink relationship {relationship_id} is missing", provenance,
        )
        return fallback
    return relationship.target if relationship.is_external else relationship.resolved_part


def _parse_symbol(
    node: ET.Element,
    context: ParseContext,
    provenance: SourceRef | None,
) -> InlineSymbol:
    code = node.get(W + "char")
    font = node.get(W + "font")
    text = _symbol_character(code)
    _diagnose(
        context, "DOCX_SYMBOL_PRESERVED", "INFO",
        f"Preserved Word symbol font={font or ''} char={code or ''}", provenance,
    )
    return InlineSymbol(text, font, code)


def _symbol_character(code: str | None) -> str:
    try:
        value = int(code, 16) if code is not None else -1
        if 0 <= value <= 0x10FFFF and not 0xD800 <= value <= 0xDFFF:
            return chr(value)
    except ValueError:
        pass
    return "�"


def _update_field_state(state: FieldState, field_type: str | None) -> None:
    if field_type == "begin":
        state.modes.append("instruction")
    elif field_type == "separate" and state.modes:
        state.modes[-1] = "result"
    elif field_type == "end" and state.modes:
        state.modes.pop()


def _resolve_list_info(
    context: ParseContext,
    num_id: int | None,
    level: int | None,
    provenance: SourceRef,
) -> ListInfo | None:
    if num_id is None:
        return None
    resolved_level = 0 if level is None else level
    definition = context.numbering.resolve(num_id, resolved_level)
    if definition is None:
        _diagnose(
            context, "DOCX_NUMBERING_UNRESOLVED", "WARNING",
            f"Could not resolve numId={num_id} ilvl={resolved_level}", provenance,
        )
        return None
    return ListInfo(
        num_id, resolved_level, definition.number_format,
        definition.level_text, definition.start,
    )


def _diagnose_unresolved_style(
    context: ParseContext,
    style_id: str | None,
    effective,
    provenance: SourceRef,
) -> None:
    if style_id and effective is None and context.styles.styles:
        _diagnose(
            context, "DOCX_STYLE_UNRESOLVED", "WARNING",
            f"Paragraph style {style_id} is not defined in styles.xml", provenance,
        )


def _diagnose(
    context: ParseContext,
    code: str,
    severity: str,
    message: str,
    provenance: SourceRef | None,
) -> None:
    item = {"code": code, "severity": severity, "message": message}
    if provenance is not None:
        item["provenance"] = provenance.to_dict()
    context.diagnostics.append(item)


def _iter_block_nodes(container: ET.Element):
    for child in list(container):
        name = local_name(child)
        if name in {"p", "tbl", "altChunk"}:
            yield child
        elif name == "sdt":
            content = child.find(W + "sdtContent")
            if content is not None:
                yield from _iter_block_nodes(content)
        elif name in {"customXml", "smartTag"}:
            yield from _iter_block_nodes(child)


def _plain_inline_text(inlines) -> str:
    parts = []
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
    return "".join(parts)


def _strip_leading_breaks(inlines: tuple) -> tuple:
    index = 0
    while index < len(inlines) and isinstance(inlines[index], InlineBreak):
        index += 1
    return inlines[index:]


def _has_page_break(inlines) -> bool:
    return any(
        isinstance(value, InlineBreak) and value.break_type == "page"
        for value in inlines
    )


def _expand_pair(value) -> list:
    if isinstance(value, _PageBreakParagraphPair):
        return [value.page_break, value.paragraph]
    return [] if value is None else [value]


def _empty_context() -> ParseContext:
    return ParseContext(None, StyleResolver(None), NumberingResolver(None))


def _parse_xml(data: bytes, part: str) -> ET.Element:
    try:
        return ET.fromstring(data)
    except ET.ParseError as exc:
        raise ValueError(f"{part} is not valid XML: {exc}") from exc
