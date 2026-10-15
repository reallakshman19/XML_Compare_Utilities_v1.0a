"""Safe, deterministic OOXML package graph and Word style/numbering resolvers."""

from __future__ import annotations

from dataclasses import dataclass, field
from io import BytesIO
import posixpath
import re
import zipfile
from xml.etree import ElementTree as ET

WORD_NS = "http://schemas.openxmlformats.org/wordprocessingml/2006/main"
REL_NS = "http://schemas.openxmlformats.org/package/2006/relationships"
OFFICE_REL_NS = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
CONTENT_TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types"
W = f"{{{WORD_NS}}}"
PR = f"{{{REL_NS}}}"
R = f"{{{OFFICE_REL_NS}}}"
CT = f"{{{CONTENT_TYPES_NS}}}"

DOC_PART = "word/document.xml"
STYLES_PART = "word/styles.xml"
NUMBERING_PART = "word/numbering.xml"
MAX_PACKAGE_ENTRIES = 10_000
MAX_ENTRY_BYTES = 128 * 1024 * 1024
MAX_PACKAGE_UNCOMPRESSED_BYTES = 512 * 1024 * 1024
MAX_COMPRESSION_RATIO = 250


@dataclass(frozen=True)
class Relationship:
    relationship_id: str
    relationship_type: str
    target: str
    target_mode: str
    source_part: str | None
    resolved_part: str | None = None

    @property
    def is_external(self) -> bool:
        return self.target_mode.lower() == "external"


@dataclass(frozen=True)
class OoxmlPackage:
    parts: dict[str, bytes]
    crc32: dict[str, int]
    relationships_by_part: dict[str | None, dict[str, Relationship]]
    content_types: dict[str, str]

    @classmethod
    def from_bytes(cls, data: bytes) -> "OoxmlPackage":
        parts, crc32 = _read_safe_zip(data)
        if DOC_PART not in parts:
            raise ValueError(f"DOCX does not contain {DOC_PART}")
        relationships = {
            source: _parse_relationships(parts[rels_part], source)
            for source, rels_part in _relationship_parts(parts)
        }
        content_types = _parse_content_types(parts.get("[Content_Types].xml"))
        return cls(parts, crc32, relationships, content_types)

    def part_bytes(self, part: str) -> bytes | None:
        return self.parts.get(part)

    def require_part(self, part: str) -> bytes:
        value = self.part_bytes(part)
        if value is None:
            raise ValueError(f"DOCX does not contain {part}")
        return value

    def xml(self, part: str) -> ET.Element | None:
        value = self.part_bytes(part)
        if value is None:
            return None
        try:
            return ET.fromstring(value)
        except ET.ParseError as exc:
            raise ValueError(f"{part} is not valid XML: {exc}") from exc

    def relationships(self, source_part: str | None) -> dict[str, Relationship]:
        return self.relationships_by_part.get(source_part, {})

    def relationship(self, source_part: str, relationship_id: str) -> Relationship | None:
        return self.relationships(source_part).get(relationship_id)

    def content_type(self, part: str) -> str | None:
        override = self.content_types.get(f"/{part}")
        if override is not None:
            return override
        extension = posixpath.splitext(part)[1].lstrip(".").lower()
        return self.content_types.get(f"*.{extension}") if extension else None


@dataclass(frozen=True)
class StyleDefinition:
    style_id: str
    style_type: str
    name: str | None
    based_on: str | None
    outline_level: int | None
    num_id: int | None
    list_level: int | None


@dataclass(frozen=True)
class EffectiveStyle:
    style_id: str
    name: str | None
    chain: tuple[str, ...]
    outline_level: int | None = None
    num_id: int | None = None
    list_level: int | None = None


class StyleResolver:
    def __init__(self, root: ET.Element | None):
        self.styles = _parse_styles(root)
        self._cache: dict[str, EffectiveStyle | None] = {}

    def resolve(self, style_id: str | None) -> EffectiveStyle | None:
        if not style_id:
            return None
        if style_id in self._cache:
            return self._cache[style_id]
        resolved = self._resolve(style_id, ())
        self._cache[style_id] = resolved
        return resolved

    def _resolve(self, style_id: str, stack: tuple[str, ...]) -> EffectiveStyle | None:
        style = self.styles.get(style_id)
        if style is None or style_id in stack:
            return None
        base = self._resolve(style.based_on, (*stack, style_id)) if style.based_on else None
        return EffectiveStyle(
            style_id=style_id,
            name=style.name or (base.name if base else None),
            chain=(*(base.chain if base else ()), style_id),
            outline_level=_first(style.outline_level, base.outline_level if base else None),
            num_id=_first(style.num_id, base.num_id if base else None),
            list_level=_first(style.list_level, base.list_level if base else None),
        )


@dataclass(frozen=True)
class NumberingLevel:
    level: int
    number_format: str
    level_text: str
    start: int


@dataclass(frozen=True)
class NumberingInstance:
    num_id: int
    abstract_num_id: int
    start_overrides: dict[int, int] = field(default_factory=dict)
    level_overrides: dict[int, NumberingLevel] = field(default_factory=dict)


class NumberingResolver:
    def __init__(self, root: ET.Element | None):
        self.abstract_levels, self.instances = _parse_numbering(root)

    def resolve(self, num_id: int | None, level: int | None) -> NumberingLevel | None:
        if num_id is None or level is None:
            return None
        instance = self.instances.get(num_id)
        if instance is None:
            return None
        if level in instance.level_overrides:
            return instance.level_overrides[level]
        abstract = self.abstract_levels.get(instance.abstract_num_id, {})
        base = abstract.get(level)
        if base is None:
            return None
        start = instance.start_overrides.get(level, base.start)
        return NumberingLevel(base.level, base.number_format, base.level_text, start)


def paragraph_properties(paragraph: ET.Element) -> tuple[str | None, int | None, int | None, int | None]:
    properties = paragraph.find(W + "pPr")
    if properties is None:
        return None, None, None, None
    style = properties.find(W + "pStyle")
    outline = properties.find(W + "outlineLvl")
    num_pr = properties.find(W + "numPr")
    return (
        _word_value(style),
        _word_int(outline),
        _word_int(num_pr.find(W + "numId")) if num_pr is not None else None,
        _word_int(num_pr.find(W + "ilvl")) if num_pr is not None else None,
    )


def semantic_heading_level(style_id: str | None, effective: EffectiveStyle | None, direct_outline: int | None) -> int | None:
    if direct_outline is not None and 0 <= direct_outline <= 5:
        return direct_outline + 1
    if effective and effective.outline_level is not None and 0 <= effective.outline_level <= 5:
        return effective.outline_level + 1
    for candidate in (effective.name if effective else None, style_id):
        match = re.fullmatch(r"heading\s*([1-6])", _normalized_style_name(candidate))
        if match:
            return int(match.group(1))
    return None


def relationship_target(package: OoxmlPackage, source_part: str, relationship_id: str) -> tuple[str | None, Relationship | None]:
    relationship = package.relationship(source_part, relationship_id)
    if relationship is None:
        return None, None
    if relationship.is_external:
        return relationship.target, relationship
    return relationship.resolved_part, relationship


def _read_safe_zip(data: bytes) -> tuple[dict[str, bytes], dict[str, int]]:
    try:
        with zipfile.ZipFile(BytesIO(data)) as package:
            infos = package.infolist()
            _validate_zip_infos(infos)
            parts = {info.filename: package.read(info) for info in infos if not info.is_dir()}
            return parts, {info.filename: info.CRC for info in infos if not info.is_dir()}
    except zipfile.BadZipFile as exc:
        raise ValueError("Input is not a valid DOCX/ZIP package") from exc


def _validate_zip_infos(infos: list[zipfile.ZipInfo]) -> None:
    if len(infos) > MAX_PACKAGE_ENTRIES:
        raise ValueError("DOCX package has too many ZIP entries")
    total = 0
    for info in infos:
        _validate_part_name(info.filename)
        if info.file_size > MAX_ENTRY_BYTES:
            raise ValueError(f"DOCX part exceeds size limit: {info.filename}")
        total += info.file_size
        compressed = max(1, info.compress_size)
        if info.file_size / compressed > MAX_COMPRESSION_RATIO:
            raise ValueError(f"DOCX part exceeds compression-ratio limit: {info.filename}")
    if total > MAX_PACKAGE_UNCOMPRESSED_BYTES:
        raise ValueError("DOCX package exceeds uncompressed size limit")


def _validate_part_name(name: str) -> None:
    if not name or name.startswith(("/", "\\")) or "\\" in name:
        raise ValueError(f"Unsafe DOCX part path: {name}")
    normalized = posixpath.normpath(name)
    if normalized == ".." or normalized.startswith("../") or normalized != name.rstrip("/"):
        raise ValueError(f"Unsafe DOCX part path: {name}")


def _relationship_parts(parts: dict[str, bytes]):
    for name in sorted(parts):
        if name == "_rels/.rels":
            yield None, name
        elif "/_rels/" in name and name.endswith(".rels"):
            prefix, rel_name = name.rsplit("/_rels/", 1)
            yield f"{prefix}/{rel_name[:-5]}", name


def _parse_content_types(data: bytes | None) -> dict[str, str]:
    if data is None:
        return {}
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise ValueError(f"[Content_Types].xml is not valid XML: {exc}") from exc
    values: dict[str, str] = {}
    for node in root.findall(CT + "Default"):
        extension = node.get("Extension")
        content_type = node.get("ContentType")
        if extension and content_type:
            values[f"*.{extension.lower()}"] = content_type
    for node in root.findall(CT + "Override"):
        part_name = node.get("PartName")
        content_type = node.get("ContentType")
        if part_name and content_type:
            values[part_name] = content_type
    return values


def _parse_relationships(data: bytes, source_part: str | None) -> dict[str, Relationship]:
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        label = source_part or "package"
        raise ValueError(f"Relationships for {label} are not valid XML: {exc}") from exc
    relationships: dict[str, Relationship] = {}
    for node in root.findall(PR + "Relationship"):
        relationship_id = node.get("Id")
        target = node.get("Target")
        if not relationship_id or target is None:
            continue
        mode = node.get("TargetMode", "Internal")
        resolved = None if mode.lower() == "external" else _resolve_part_target(source_part, target)
        relationships[relationship_id] = Relationship(
            relationship_id, node.get("Type", ""), target, mode, source_part, resolved
        )
    return relationships


def _resolve_part_target(source_part: str | None, target: str) -> str:
    if target.startswith("/"):
        candidate = target.lstrip("/")
    else:
        base = posixpath.dirname(source_part) if source_part else ""
        candidate = posixpath.normpath(posixpath.join(base, target))
    if candidate == ".." or candidate.startswith("../"):
        raise ValueError(f"OOXML relationship target escapes package: {target}")
    return candidate


def _parse_styles(root: ET.Element | None) -> dict[str, StyleDefinition]:
    if root is None:
        return {}
    styles: dict[str, StyleDefinition] = {}
    for node in root.findall(W + "style"):
        style_id = node.get(W + "styleId")
        if not style_id:
            continue
        p_pr = node.find(W + "pPr")
        styles[style_id] = StyleDefinition(
            style_id=style_id,
            style_type=node.get(W + "type", ""),
            name=_word_value(node.find(W + "name")),
            based_on=_word_value(node.find(W + "basedOn")),
            outline_level=_word_int(p_pr.find(W + "outlineLvl")) if p_pr is not None else None,
            num_id=_num_property(p_pr, "numId"),
            list_level=_num_property(p_pr, "ilvl"),
        )
    return styles


def _parse_numbering(root: ET.Element | None):
    if root is None:
        return {}, {}
    abstracts: dict[int, dict[int, NumberingLevel]] = {}
    for abstract in root.findall(W + "abstractNum"):
        abstract_id = _attr_int(abstract, "abstractNumId")
        if abstract_id is None:
            continue
        abstracts[abstract_id] = {
            level.level: level
            for level in (_parse_level(node) for node in abstract.findall(W + "lvl"))
            if level is not None
        }
    instances: dict[int, NumberingInstance] = {}
    for num in root.findall(W + "num"):
        num_id = _attr_int(num, "numId")
        abstract_id = _word_int(num.find(W + "abstractNumId"))
        if num_id is None or abstract_id is None:
            continue
        starts: dict[int, int] = {}
        levels: dict[int, NumberingLevel] = {}
        for override in num.findall(W + "lvlOverride"):
            level = _attr_int(override, "ilvl")
            if level is None:
                continue
            start = _word_int(override.find(W + "startOverride"))
            if start is not None:
                starts[level] = start
            level_override = _parse_level(override.find(W + "lvl"))
            if level_override is not None:
                levels[level] = level_override
        instances[num_id] = NumberingInstance(num_id, abstract_id, starts, levels)
    return abstracts, instances


def _parse_level(node: ET.Element | None) -> NumberingLevel | None:
    if node is None:
        return None
    level = _attr_int(node, "ilvl")
    if level is None:
        return None
    return NumberingLevel(
        level=level,
        number_format=_word_value(node.find(W + "numFmt")) or "decimal",
        level_text=_word_value(node.find(W + "lvlText")) or f"%{level + 1}.",
        start=_word_int(node.find(W + "start")) or 1,
    )


def _num_property(p_pr: ET.Element | None, name: str) -> int | None:
    if p_pr is None:
        return None
    num_pr = p_pr.find(W + "numPr")
    return _word_int(num_pr.find(W + name)) if num_pr is not None else None


def _word_value(node: ET.Element | None) -> str | None:
    return None if node is None else node.get(W + "val")


def _word_int(node: ET.Element | None) -> int | None:
    value = _word_value(node)
    try:
        return int(value) if value is not None else None
    except ValueError:
        return None


def _attr_int(node: ET.Element, name: str) -> int | None:
    value = node.get(W + name)
    try:
        return int(value) if value is not None else None
    except ValueError:
        return None


def _first(primary, fallback):
    return primary if primary is not None else fallback


def _normalized_style_name(value: str | None) -> str:
    return re.sub(r"[\s_-]+", " ", (value or "").strip().lower())
