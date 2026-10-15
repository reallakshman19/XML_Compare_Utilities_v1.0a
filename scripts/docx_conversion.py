"""DOCX conversion orchestration, evidence, CLI options, and asset materialization."""

from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from document_model import (
    CANONICALIZATION_VERSION, SEMANTIC_SCHEMA_VERSION, DocumentModel,
    build_evidence, canonical_json_bytes, options_hash,
)
from docx_ancillary import REVISION_MODES
from docx_assets import enrich_document_assets, materialize_assets, prepare_package_for_assets
from docx_ooxml_parser import DOC_PART, parse_document_xml, parse_docx_package
from docx_revision_semantics import enrich_document_model, prepare_package_for_revisions
from docx_rendering import render_document
from ooxml_package import OoxmlPackage
from table_rendering import TABLE_MODES, TableRenderDecision


def git_blob_sha(data: bytes) -> str:
    header = f"blob {len(data)}\0".encode("ascii")
    return hashlib.sha1(header + data).hexdigest()


def sha256_hex(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def convert_document_xml(document_xml: bytes, table_format: str) -> tuple[str, dict]:
    document, stats = parse_document_xml(document_xml)
    return render_document(document, table_format), stats


def convert_docx_bytes(
    docx_bytes: bytes, table_format: str = "html", *,
    table_mode: str | None = None, revision_mode: str = "accepted",
    header_mode: str = "metadata", footer_mode: str = "metadata",
    image_mode: str = "extract",
) -> tuple[bytes, dict]:
    package = OoxmlPackage.from_bytes(docx_bytes)
    revision_package, revision_events, fields = prepare_package_for_revisions(package, revision_mode)
    prepared, drawings, assets, _payloads, asset_diagnostics = prepare_package_for_assets(revision_package)
    document, stats = parse_docx_package(prepared)
    document = enrich_document_model(
        document, package, revision_mode, revision_events, fields,
        header_mode=header_mode, footer_mode=footer_mode,
    )
    document = enrich_document_assets(document, drawings, assets, asset_diagnostics)
    table_decisions: list[tuple[str, TableRenderDecision]] = []
    output = render_document(
        document, table_format, table_mode=table_mode, table_decisions=table_decisions,
        header_mode=header_mode, footer_mode=footer_mode, image_mode=image_mode,
    ).encode("utf-8")
    option_values = _canonical_options(
        table_format, table_mode, revision_mode, header_mode, footer_mode, image_mode,
    )
    document_xml = package.require_part(DOC_PART)
    return output, _conversion_stats(
        docx_bytes, document_xml, package, document, stats, output, option_values,
        table_format, table_mode, revision_mode, header_mode, footer_mode, image_mode, table_decisions,
    )


def _conversion_stats(
    docx_bytes: bytes,
    document_xml: bytes,
    package: OoxmlPackage,
    document: DocumentModel,
    stats: dict,
    output: bytes,
    option_values: dict,
    table_format: str,
    table_mode: str | None,
    revision_mode: str,
    header_mode: str,
    footer_mode: str,
    image_mode: str,
    table_decisions: list[tuple[str, TableRenderDecision]],
) -> dict:
    return {
        **stats,
        "docx_bytes": len(docx_bytes),
        "document_xml_bytes": len(document_xml),
        "document_xml_crc32": f"0x{package.crc32[DOC_PART]:08x}",
        "source_git_blob_sha": git_blob_sha(docx_bytes),
        "source_sha256": sha256_hex(docx_bytes),
        "output_sha256": sha256_hex(output),
        "output_bytes": len(output),
        "table_format": table_format,
        "table_mode": table_mode,
        "revision_mode": revision_mode,
        "header_mode": header_mode,
        "footer_mode": footer_mode,
        "image_mode": image_mode,
        "assets": len(document.assets),
        "headers": document.metadata.get("headerCount", 0),
        "footers": document.metadata.get("footerCount", 0),
        "notes": len(document.notes),
        "comments": len(document.comments),
        "fields": len(document.metadata.get("fields", [])),
        "table_renderers": [decision.renderer for _, decision in table_decisions],
        "table_render_fallbacks": sum(
            decision.diagnostic is not None for _, decision in table_decisions
        ),
        "semantic_schema_version": SEMANTIC_SCHEMA_VERSION,
        "canonicalization_version": CANONICALIZATION_VERSION,
        "options_hash": options_hash(option_values),
        "package_parts": len(package.parts),
        "relationships": document.metadata.get("relationshipCount", 0),
        "styles": document.metadata.get("styleCount", 0),
        "numbering_instances": document.metadata.get("numberingInstanceCount", 0),
        "content_types": document.metadata.get("contentTypeCount", 0),
    }


def conversion_evidence(
    docx_bytes: bytes, table_format: str = "html", *,
    table_mode: str | None = None, revision_mode: str = "accepted",
    header_mode: str = "metadata", footer_mode: str = "metadata",
    image_mode: str = "extract",
) -> dict:
    package = OoxmlPackage.from_bytes(docx_bytes)
    revision_package, revision_events, fields = prepare_package_for_revisions(package, revision_mode)
    prepared, drawings, assets, _payloads, asset_diagnostics = prepare_package_for_assets(revision_package)
    document, _ = parse_docx_package(prepared)
    document = enrich_document_model(
        document, package, revision_mode, revision_events, fields,
        header_mode=header_mode, footer_mode=footer_mode,
    )
    document = enrich_document_assets(document, drawings, assets, asset_diagnostics)
    decisions: list[tuple[str, TableRenderDecision]] = []
    render_document(
        document, table_format, table_mode=table_mode, table_decisions=decisions,
        header_mode=header_mode, footer_mode=footer_mode, image_mode=image_mode,
    )
    options = _canonical_options(
        table_format, table_mode, revision_mode, header_mode, footer_mode, image_mode,
    )
    evidence = build_evidence(
        document,
        source_sha256=sha256_hex(docx_bytes),
        source_git_blob_sha=git_blob_sha(docx_bytes),
        profile="readable",
        options=options,
    )
    if image_mode == "skip":
        evidence["diagnostics"].extend(
            {
                "code": "DOCX_IMAGE_SKIPPED_BY_POLICY",
                "severity": "INFO",
                "message": f"Asset {asset.asset_id} intentionally omitted from inline rendering",
                "provenance": {"source_type": "docx", "part": asset.media_part},
            }
            for asset in document.assets
        )
    if table_mode is not None:
        evidence["tableRendering"] = [
            _table_render_decision_evidence(block_id, decision)
            for block_id, decision in decisions
        ]
        evidence["diagnostics"].extend(
            _table_render_diagnostic(block_id, decision)
            for block_id, decision in decisions
            if decision.diagnostic is not None
        )
    return evidence


def _table_render_decision_evidence(
    block_id: str, decision: TableRenderDecision,
) -> dict:
    value = {
        "blockId": block_id,
        "requestedMode": decision.requested_mode,
        "renderer": decision.renderer,
        "classification": decision.classification,
        "reasons": list(decision.reasons),
    }
    if decision.diagnostic is not None:
        value["diagnostic"] = decision.diagnostic
    return value


def _table_render_diagnostic(
    block_id: str, decision: TableRenderDecision,
) -> dict:
    assert decision.diagnostic is not None
    return {**decision.diagnostic, "blockId": block_id}


def _canonical_options(
    table_format: str, table_mode: str | None = None, revision_mode: str = "accepted",
    header_mode: str = "metadata", footer_mode: str = "metadata",
    image_mode: str = "extract",
) -> dict:
    value = {
        "profile": "readable", "revisions": revision_mode,
        "headers": header_mode, "footers": footer_mode, "images": image_mode,
    }
    value["tableMode" if table_mode is not None else "tableFormat"] = (
        table_mode if table_mode is not None else table_format
    )
    return value


def default_output_path(input_path: Path) -> Path:
    return input_path.with_suffix(".md")


def verify_expected(label: str, actual: str, expected: str | None) -> None:
    if expected and actual.lower() != expected.lower():
        raise ValueError(f"{label} mismatch: {actual} != {expected}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("input", type=Path, help="Input DOCX path")
    parser.add_argument("-o", "--output", type=Path, help="Output Markdown path")
    parser.add_argument(
        "--table-format", choices=("html", "tsv"), default=None,
        help="Legacy table rendering compatibility: HTML or compact TSV",
    )
    parser.add_argument(
        "--table-mode", choices=TABLE_MODES, default=None,
        help="Semantic table rendering policy: auto, markdown, html, or records",
    )
    parser.add_argument(
        "--revisions", choices=REVISION_MODES, default="accepted",
        help="Word revision policy: accepted, rejected, or markup",
    )
    parser.add_argument(
        "--headers", choices=("keep", "metadata", "drop"), default="metadata",
        help="Running header policy: keep in Markdown, metadata only, or drop",
    )
    parser.add_argument(
        "--footers", choices=("keep", "metadata", "drop"), default="metadata",
        help="Running footer policy: keep in Markdown, metadata only, or drop",
    )
    parser.add_argument(
        "--images", choices=("extract", "skip"), default="extract",
        help="Embedded image policy: render/extract assets or emit explicit skip markers",
    )
    parser.add_argument(
        "--assets", type=Path, help="Physical directory for deterministic extracted assets",
    )
    parser.add_argument("--evidence", type=Path, help="Optional deterministic evidence JSON path")
    parser.add_argument("--expected-git-blob-sha", help="Expected source Git blob SHA-1")
    parser.add_argument("--expected-output-sha256", help="Expected Markdown SHA-256")
    parser.add_argument("--stats-json", action="store_true", help="Print deterministic conversion statistics as JSON")
    return parser


def run_cli(argv: list[str] | None = None) -> int:
    args = build_parser().parse_args(argv)
    if not args.input.is_file():
        raise ValueError(f"Input file does not exist: {args.input}")
    if args.table_format is not None and args.table_mode is not None:
        raise ValueError("Use either --table-format or --table-mode, not both")
    table_format = args.table_format or "html"
    source = args.input.read_bytes()
    output, stats = convert_docx_bytes(
        source, table_format, table_mode=args.table_mode, revision_mode=args.revisions,
        header_mode=args.headers, footer_mode=args.footers, image_mode=args.images,
    )
    verify_expected("source Git blob SHA", stats["source_git_blob_sha"], args.expected_git_blob_sha)
    verify_expected("output SHA-256", stats["output_sha256"], args.expected_output_sha256)
    output_path = args.output or default_output_path(args.input)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_bytes(output)
    if args.images == "extract":
        package = OoxmlPackage.from_bytes(source)
        revision_package, _, _ = prepare_package_for_revisions(package, args.revisions)
        _, _, assets, payloads, _ = prepare_package_for_assets(revision_package)
        assets_dir = args.assets or (output_path.parent / "assets")
        stats["assets_written"] = len(materialize_assets(assets, payloads, assets_dir))
    else:
        stats["assets_written"] = 0
    if args.evidence:
        args.evidence.parent.mkdir(parents=True, exist_ok=True)
        args.evidence.write_bytes(canonical_json_bytes(
            conversion_evidence(
                source, table_format, table_mode=args.table_mode, revision_mode=args.revisions,
                header_mode=args.headers, footer_mode=args.footers, image_mode=args.images,
            )
        ))
    if args.stats_json:
        print(json.dumps({**stats, "output_path": str(output_path)}, sort_keys=True))
    else:
        print(f"wrote {output_path} ({stats['output_bytes']} bytes)")
    return 0
