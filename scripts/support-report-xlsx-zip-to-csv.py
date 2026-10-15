#!/usr/bin/env python3
"""Extract the Support Report table from a zipped XLSX as CSV.

Uses only the Python standard library so benchmark CI does not add a runtime
spreadsheet dependency. Formula cells are emitted as their formula text with a
leading '='; this preserves primary-support reference identities.
"""

from __future__ import annotations

import csv
import io
import re
import sys
import xml.etree.ElementTree as ET
import zipfile
from pathlib import PurePosixPath

MAIN = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
REL = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
PKGREL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS = {"m": MAIN, "r": REL, "p": PKGREL}


def _xlsx_bytes(zip_path: str) -> bytes:
    with zipfile.ZipFile(zip_path) as outer:
        names = [name for name in outer.namelist() if name.lower().endswith(".xlsx")]
        if len(names) != 1:
            raise RuntimeError(f"Expected exactly one XLSX in {zip_path}; found {names}")
        return outer.read(names[0])


def _shared_strings(book: zipfile.ZipFile) -> list[str]:
    if "xl/sharedStrings.xml" not in book.namelist():
        return []
    root = ET.fromstring(book.read("xl/sharedStrings.xml"))
    return ["".join(si.itertext()) for si in root.findall("m:si", NS)]


def _sheet_paths(book: zipfile.ZipFile) -> list[tuple[str, str]]:
    workbook = ET.fromstring(book.read("xl/workbook.xml"))
    rels = ET.fromstring(book.read("xl/_rels/workbook.xml.rels"))
    targets = {rel.attrib["Id"]: rel.attrib["Target"] for rel in rels.findall("p:Relationship", NS)}
    out = []
    for sheet in workbook.findall("m:sheets/m:sheet", NS):
        rel_id = sheet.attrib[f"{{{REL}}}id"]
        target = targets[rel_id].lstrip("/")
        path = target if target.startswith("xl/") else str(PurePosixPath("xl") / target)
        out.append((sheet.attrib.get("name", "Sheet"), path))
    return out


def _column_index(cell_ref: str) -> int:
    letters = re.match(r"[A-Z]+", cell_ref.upper())
    if not letters:
        return 0
    value = 0
    for char in letters.group(0):
        value = value * 26 + ord(char) - 64
    return value - 1


def _cell_value(cell: ET.Element, shared: list[str]) -> str:
    formula = cell.find("m:f", NS)
    if formula is not None:
        return "=" + (formula.text or "")
    cell_type = cell.attrib.get("t", "")
    if cell_type == "inlineStr":
        inline = cell.find("m:is", NS)
        return "".join(inline.itertext()) if inline is not None else ""
    value = cell.find("m:v", NS)
    raw = value.text if value is not None and value.text is not None else ""
    if cell_type == "s" and raw:
        return shared[int(raw)]
    if cell_type == "b":
        return "TRUE" if raw == "1" else "FALSE"
    return raw


def _sheet_rows(book: zipfile.ZipFile, path: str, shared: list[str]) -> list[list[str]]:
    root = ET.fromstring(book.read(path))
    sparse: list[dict[int, str]] = []
    for row in root.findall("m:sheetData/m:row", NS):
        cells = {}
        for cell in row.findall("m:c", NS):
            cells[_column_index(cell.attrib.get("r", "A1"))] = _cell_value(cell, shared)
        sparse.append(cells)
    width = max((max(row.keys(), default=-1) for row in sparse), default=-1) + 1
    return [[row.get(index, "") for index in range(width)] for row in sparse]


def _find_support_table(book: zipfile.ZipFile) -> tuple[str, list[list[str]]]:
    shared = _shared_strings(book)
    candidates = []
    for sheet_name, path in _sheet_paths(book):
        rows = _sheet_rows(book, path, shared)
        for index, row in enumerate(rows[:40]):
            normalized = [str(value).strip().upper() for value in row]
            has_pipe = "PIPE" in normalized
            has_civil = any("CIVIL SECONDARY SUPPORT" in value for value in normalized)
            if has_pipe and has_civil:
                header_width = max((i for i, value in enumerate(row) if str(value).strip()), default=-1) + 1
                table = [current[:header_width] for current in rows[index:]]
                while table and not any(str(value).strip() for value in table[-1]):
                    table.pop()
                candidates.append((len(table), sheet_name, table))
                break
    if not candidates:
        raise RuntimeError("No Support Report header row found in workbook")
    _, sheet_name, table = max(candidates, key=lambda item: item[0])
    return sheet_name, table


def convert(zip_path: str, csv_path: str) -> None:
    with zipfile.ZipFile(io.BytesIO(_xlsx_bytes(zip_path))) as book:
        sheet_name, rows = _find_support_table(book)
    with open(csv_path, "w", encoding="utf-8", newline="") as handle:
        csv.writer(handle).writerows(rows)
    print(f"{zip_path}: sheet={sheet_name!r} rows={max(len(rows)-1, 0)} columns={len(rows[0]) if rows else 0} -> {csv_path}")


def main() -> int:
    if len(sys.argv) != 3:
        print("usage: support-report-xlsx-zip-to-csv.py INPUT.zip OUTPUT.csv", file=sys.stderr)
        return 2
    convert(sys.argv[1], sys.argv[2])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
