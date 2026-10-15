"""Parse DOCX note, comment, and running-content parts deterministically."""

from __future__ import annotations

from xml.etree import ElementTree as ET

from document_model import CommentDefinition, NoteDefinition, SourceRef

WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
W = f"{{{WORD_NS}}}"
FOOTNOTES_PART = "word/footnotes.xml"
ENDNOTES_PART = "word/endnotes.xml"
COMMENTS_PART = "word/comments.xml"
REVISION_MODES = ("accepted", "rejected", "markup")


def parse_notes(package, note_type: str, revision_mode: str = "accepted") -> tuple[tuple[NoteDefinition, ...], tuple[dict, ...]]:
    part = FOOTNOTES_PART if note_type == "footnote" else ENDNOTES_PART
    root = package.xml(part)
    if root is None:
        return (), ()
    tag = W + note_type
    notes: list[NoteDefinition] = []
    diagnostics: list[dict] = []
    for node in root.findall(tag):
        note_id = node.get(W + "id")
        if note_id is None or _is_separator_note(node, note_id):
            continue
        text, has_table = _container_text(node, revision_mode)
        provenance = SourceRef("docx", part, note_type=note_type, note_id=note_id)
        notes.append(NoteDefinition(note_type, note_id, text, provenance))
        if has_table:
            diagnostics.append({
                "code": "DOCX_NOTE_TABLE_FLATTENED",
                "severity": "WARNING",
                "message": f"{note_type} {note_id} contains a table; note evidence retains ordered text only",
                "provenance": provenance.to_dict(),
            })
    return tuple(notes), tuple(diagnostics)


def parse_comments(package, revision_mode: str = "accepted") -> tuple[CommentDefinition, ...]:
    root = package.xml(COMMENTS_PART)
    if root is None:
        return ()
    comments: list[CommentDefinition] = []
    for node in root.findall(W + "comment"):
        comment_id = node.get(W + "id")
        if comment_id is None:
            continue
        text, _ = _container_text(node, revision_mode)
        provenance = SourceRef("docx", COMMENTS_PART, comment_id=comment_id)
        comments.append(CommentDefinition(
            comment_id, text, provenance, node.get(W + "author"), node.get(W + "date"),
        ))
    return tuple(comments)


def parse_running_content(
    package, kind: str, revision_mode: str = "accepted",
) -> tuple[tuple[dict, ...], tuple[dict, ...]]:
    if kind not in {"header", "footer"}:
        raise ValueError(f"Unsupported running content kind: {kind}")
    items: list[dict] = []
    diagnostics: list[dict] = []
    prefix = f"word/{kind}"
    for part in sorted(
        name for name in package.parts
        if name.startswith(prefix) and name.endswith(".xml")
    ):
        root = package.xml(part)
        if root is None:
            continue
        text, has_table = _container_text(root, revision_mode)
        items.append({"kind": kind, "part": part, "text": text})
        if has_table:
            diagnostics.append({
                "code": "DOCX_RUNNING_CONTENT_TABLE_FLATTENED",
                "severity": "WARNING",
                "message": f"{part} contains a table; running-content metadata retains ordered text only",
                "provenance": {"source_type": "docx", "part": part},
            })
    return tuple(items), tuple(diagnostics)


def revision_visible(revision_type: str, revision_mode: str) -> bool:
    if revision_mode == "markup":
        return True
    if revision_mode == "accepted":
        return revision_type in {"ins", "moveTo"}
    if revision_mode == "rejected":
        return revision_type in {"del", "moveFrom"}
    raise ValueError(f"Unsupported revision mode: {revision_mode}")


def _container_text(container: ET.Element, revision_mode: str) -> tuple[str, bool]:
    paragraphs: list[str] = []
    has_table = False
    for child in list(container):
        name = _local_name(child)
        if name == "p":
            paragraphs.append(_node_text(child, revision_mode))
        elif name == "tbl":
            has_table = True
            paragraphs.append(_node_text(child, revision_mode))
        elif name in {"ins", "del", "moveFrom", "moveTo", "sdt", "customXml", "smartTag"}:
            if name in {"ins", "del", "moveFrom", "moveTo"} and not revision_visible(name, revision_mode):
                continue
            nested, nested_table = _container_text(child, revision_mode)
            if nested:
                paragraphs.append(_revision_markup(name, nested, revision_mode))
            has_table = has_table or nested_table
    return "\n".join(value for value in paragraphs if value), has_table


def _node_text(node: ET.Element, revision_mode: str) -> str:
    parts: list[str] = []
    for child in list(node):
        name = _local_name(child)
        if name in {"t", "delText"}:
            parts.append(child.text or "")
        elif name == "tab":
            parts.append("\t")
        elif name in {"br", "cr"}:
            parts.append("\n")
        elif name == "noBreakHyphen":
            parts.append("\u2011")
        elif name == "softHyphen":
            parts.append("\u00ad")
        elif name == "instrText":
            continue
        elif name in {"ins", "del", "moveFrom", "moveTo"}:
            if revision_visible(name, revision_mode):
                parts.append(_revision_markup(name, _node_text(child, revision_mode), revision_mode))
        else:
            parts.append(_node_text(child, revision_mode))
    return "".join(parts)


def _revision_markup(revision_type: str, text: str, revision_mode: str) -> str:
    if revision_mode != "markup" or revision_type not in {"ins", "del", "moveFrom", "moveTo"}:
        return text
    tag = "ins" if revision_type in {"ins", "moveTo"} else "del"
    attribute = f' data-revision="{revision_type}"' if revision_type.startswith("move") else ""
    return f"<{tag}{attribute}>{text}</{tag}>"


def _is_separator_note(node: ET.Element, note_id: str) -> bool:
    note_type = node.get(W + "type")
    if note_type in {"separator", "continuationSeparator"}:
        return True
    try:
        return int(note_id) < 0
    except ValueError:
        return False


def _local_name(node: ET.Element) -> str:
    return node.tag.rsplit("}", 1)[-1]
