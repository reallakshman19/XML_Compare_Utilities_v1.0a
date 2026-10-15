"""Canonical semantic-content hashing for DOCX packages."""
from __future__ import annotations

from io import BytesIO
import hashlib
from zipfile import BadZipFile, ZipFile
import xml.etree.ElementTree as ET

from document_evidence_surface import canonical_hash


class DocxSemanticError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


_VOLATILE_CORE_LOCAL_NAMES = {"created", "modified", "lastModifiedBy", "revision"}
_VOLATILE_APP_LOCAL_NAMES = {"TotalTime", "Pages", "Words", "Characters", "CharactersWithSpaces", "Lines", "Paragraphs", "DocSecurity", "AppVersion"}
_VOLATILE_ATTR_LOCAL_PREFIXES = ("rsid",)
_VOLATILE_ATTR_LOCAL_NAMES = {"paraId", "textId"}


def semantic_docx_content(docx_bytes: bytes) -> dict:
    try:
        with ZipFile(BytesIO(docx_bytes)) as archive:
            names = sorted(name for name in archive.namelist() if _semantic_part(name))
            if "word/document.xml" not in names:
                raise DocxSemanticError("DOCX_DOCUMENT_PART_MISSING", "DOCX package lacks word/document.xml")
            parts = [_part_record(name, archive.read(name)) for name in names]
    except DocxSemanticError:
        raise
    except (BadZipFile, KeyError, OSError) as exc:
        raise DocxSemanticError("DOCX_PACKAGE_INVALID", f"invalid DOCX package: {type(exc).__name__}") from exc
    identity = {"schema": "DocxSemanticContent.v1", "normalizationProfile": "docx-semantic-v1", "parts": parts}
    return {**identity, "semanticContentHash": canonical_hash(identity)}


def _semantic_part(name: str) -> bool:
    if name.endswith("/") or name.startswith("docProps/thumbnail"):
        return False
    return True


def _part_record(name: str, data: bytes) -> dict:
    canonical = _canonical_part(name, data)
    return {"path": name, "sha256": f"sha256:{hashlib.sha256(canonical).hexdigest()}", "sizeBytes": len(canonical)}


def _canonical_part(name: str, data: bytes) -> bytes:
    if not name.lower().endswith((".xml", ".rels")):
        return data
    try:
        root = ET.fromstring(data)
    except ET.ParseError as exc:
        raise DocxSemanticError("DOCX_XML_INVALID", f"invalid XML part: {name}") from exc
    _remove_volatile_content(name, root)
    return ET.canonicalize(ET.tostring(root, encoding="unicode"), strip_text=False).encode("utf-8")


def _remove_volatile_content(name: str, root) -> None:
    for element in root.iter():
        for attribute in list(element.attrib):
            local = _local(attribute)
            if local in _VOLATILE_ATTR_LOCAL_NAMES or any(local.startswith(prefix) for prefix in _VOLATILE_ATTR_LOCAL_PREFIXES):
                del element.attrib[attribute]
    if name == "docProps/core.xml":
        _remove_children_by_local(root, _VOLATILE_CORE_LOCAL_NAMES)
    elif name == "docProps/app.xml":
        _remove_children_by_local(root, _VOLATILE_APP_LOCAL_NAMES)


def _remove_children_by_local(root, names) -> None:
    for parent in root.iter():
        for child in list(parent):
            if _local(child.tag) in names:
                parent.remove(child)


def _local(value: str) -> str:
    return value.rsplit("}", 1)[-1] if "}" in value else value.split(":")[-1]
