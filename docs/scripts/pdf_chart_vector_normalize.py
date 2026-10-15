"""Compatibility wrapper for provider-neutral PDF vector normalization."""
from __future__ import annotations

from document_evidence_geometry import normalize_pdfplumber_primitive


def normalize_primitive(source_sha, page, index, kind, item):
    return normalize_pdfplumber_primitive(source_sha, page, index, kind, item)
