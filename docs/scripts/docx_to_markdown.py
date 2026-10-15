#!/usr/bin/env python3
"""Compatibility entry point for deterministic DOCX -> Markdown conversion."""

from __future__ import annotations

from docx_conversion import (
    _canonical_options, build_parser, conversion_evidence, convert_document_xml,
    convert_docx_bytes, default_output_path, git_blob_sha, run_cli, sha256_hex,
    verify_expected,
)
from docx_ooxml_parser import (
    DOC_PART, cell_colspan, count_nonempty_text_nodes, heading_level, local_name,
    paragraph_style, paragraph_text, parse_cell_blocks, parse_document_xml,
    parse_docx_package, parse_table, read_document_xml, table_colspan,
)
from docx_rendering import (
    flatten_block_text, flatten_cell_text, flatten_table_text, heading_prefix,
    html_paragraph_text, render_cell_html, render_document, render_paragraph,
    render_table_html, render_table_tsv, table_to_html, table_to_tsv,
)


if __name__ == "__main__":
    try:
        raise SystemExit(run_cli())
    except (OSError, ValueError) as exc:
        print(f"docx_to_markdown: {exc}", file=__import__("sys").stderr)
        raise SystemExit(2)
