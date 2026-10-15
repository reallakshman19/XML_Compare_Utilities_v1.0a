#!/usr/bin/env python3
"""Unified DOCX/PDF -> Markdown dispatcher preserving source-specific options."""

from __future__ import annotations

from pathlib import Path
import sys


def _input_kind(argv: list[str]) -> str:
    for token in argv:
        if token.startswith("-"):
            continue
        suffix = Path(token).suffix.lower()
        if suffix in {".docx", ".pdf"}:
            return suffix[1:]
    raise ValueError("Provide an input .docx or .pdf path")


def run_cli(argv: list[str] | None = None) -> int:
    args = list(sys.argv[1:] if argv is None else argv)
    kind = _input_kind(args)
    if kind == "docx":
        from docx_conversion import run_cli as run_docx
        return run_docx(args)
    from pdf_engineering_conversion import run_cli as run_pdf
    return run_pdf(args)


if __name__ == "__main__":
    try:
        raise SystemExit(run_cli())
    except (OSError, ValueError) as exc:
        print(f"document_to_markdown: {exc}", file=sys.stderr)
        raise SystemExit(2)
