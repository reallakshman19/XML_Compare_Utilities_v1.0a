#!/usr/bin/env python3
"""Qualification-only, edition-aware census/oracle for CII SIF&TEES.

The canonical repository target advertises VERSION 11.0000. The vendor-authored
CAESAR II 2019 (11.0) neutral-file appendix directly maps item3=ii and item4=io
for each of two 30-item tee slots written as five rows x six fields.

This oracle qualifies those four physical positions as future Phase2B
candidates only. It does not enable production mutation.
"""
from __future__ import annotations

from pathlib import Path
import argparse
import json
import re
import sys

WIDTHS = (15, 13, 13, 13, 13, 13)
STARTS = (0, 15, 28, 41, 54, 67)
SIF_BLOCK_ROWS = 10
TEE_SLOT_ROWS = 5
ITEMS_PER_TEE = 30
SECTION_RX = re.compile(r"^\s*#\$\s+([A-Z0-9_&]+)\s*$", re.I)
DEFAULT_FILES = (
    Path("Benchmark/CIICompare/BM_CII_SOURCE.CII"),
    Path("Benchmark/CIICompare/BM_CII_TARGET1.CII"),
    Path("Benchmark/CIICompare/BM_CII_TARGET2.CII"),
)

V11_ITEMS = {
    1: "Node", 2: "Type", 3: "In-Plane SIF (ii)", 4: "Out-Plane SIF (io)",
    5: "Weld d", 6: "Fillet", 7: "Pad Thk", 8: "Ftg Ro", 9: "Crotch R",
    10: "Weld ID", 11: "B1", 12: "B2", 13: "In-Plane Index (Ii)",
    14: "Out-Plane Index (Io)", 15: "Torsion SIF (it)", 16: "Axial SIF (ia)",
    17: "Pressure SIF (ip)", 18: "Pressure Index (Ip)",
    19: "Code-specific item 19", 20: "Code-specific item 20",
    21: "Code-specific item 21", 22: "Code-specific item 22",
    23: "Code-related Note option 23", 24: "Code-related Note option 24",
    25: "Axial Index (Ia)", 26: "Torsion Index (It)",
}
SELECTED_ITEMS = frozenset({3, 4})


def neutral_position(row_index: int, field_index: int) -> tuple[int, int]:
    if not (0 <= row_index < SIF_BLOCK_ROWS and 0 <= field_index < 6):
        raise AssertionError(f"SIF_POSITION_OUT_OF_RANGE:r{row_index}f{field_index}")
    tee_slot = 1 if row_index < TEE_SLOT_ROWS else 2
    item = (row_index % TEE_SLOT_ROWS) * 6 + field_index + 1
    return tee_slot, item


def byte_columns(field_index: int) -> tuple[int, int]:
    return STARTS[field_index], STARTS[field_index] + WIDTHS[field_index]


def authority_self_test() -> dict[str, object]:
    positions = [
        (*neutral_position(row, field), row, field)
        for row in range(SIF_BLOCK_ROWS)
        for field in range(6)
    ]
    assert len(positions) == 60 and len(set(positions)) == 60
    assert neutral_position(0, 2) == (1, 3)
    assert neutral_position(0, 3) == (1, 4)
    assert neutral_position(5, 2) == (2, 3)
    assert neutral_position(5, 3) == (2, 4)
    assert byte_columns(2) == (28, 41)
    assert byte_columns(3) == (41, 54)
    assert V11_ITEMS[3] == "In-Plane SIF (ii)"
    assert V11_ITEMS[4] == "Out-Plane SIF (io)"
    assert V11_ITEMS[15] == "Torsion SIF (it)"
    assert V11_ITEMS[16] == "Axial SIF (ia)"
    assert len(V11_ITEMS) * 2 == 52
    selected = [
        f"r{row}f{field}"
        for row in range(SIF_BLOCK_ROWS)
        for field in range(6)
        if neutral_position(row, field)[1] in SELECTED_ITEMS
    ]
    assert selected == ["r0f2", "r0f3", "r5f2", "r5f3"]
    return {
        "status": "PASS_V11_SELECTED_POSITION_ARITHMETIC",
        "authority": "CAESAR_II_2019_VERSION11_NEUTRAL_APPENDIX_PAGE_1187",
        "fixed_positions": 60,
        "directly_named_positions": 52,
        "unresolved_positions": 8,
        "selected_phase2b_positions": selected,
        "selected_phase2b_count": 4,
        "product_enabled_count": 0,
    }


def parse_sections(text: str) -> dict[str, list[str]]:
    sections: dict[str, list[str]] = {}
    current: str | None = None
    for line in text.splitlines():
        match = SECTION_RX.match(line)
        if match:
            current = match.group(1).upper()
            sections.setdefault(current, [])
        elif current is not None:
            sections[current].append(line)
    return sections


def fixed_fields(line: str) -> list[str]:
    out: list[str] = []
    offset = 0
    for width in WIDTHS:
        out.append(line[offset:offset + width])
        offset += width
    return out


def version_header(text: str) -> float | None:
    lines = text.splitlines()
    for index, line in enumerate(lines):
        if line.strip().upper() == "#$ VERSION":
            for candidate in lines[index + 1:]:
                if not candidate.strip():
                    continue
                values = candidate.split()
                if len(values) < 2:
                    return None
                try:
                    return float(values[1])
                except ValueError:
                    return None
    return None


def control_sif_count(sections: dict[str, list[str]]) -> int:
    rows = [row for row in sections.get("CONTROL", []) if row.strip()]
    if len(rows) < 3:
        raise AssertionError("CONTROL_REQUIRES_THREE_ROWS")
    fields = fixed_fields(rows[2])
    value = float(fields[4].strip())
    if value < 0 or int(value) != value:
        raise AssertionError(f"CONTROL_SIF_COUNT_INVALID:{value}")
    return int(value)


def census_file(path: Path) -> dict[str, object]:
    text = path.read_text(encoding="utf-8", errors="strict")
    sections = parse_sections(text)
    sif_rows = [row for row in sections.get("SIF&TEES", []) if row.strip()]
    count = control_sif_count(sections)
    expected = count * SIF_BLOCK_ROWS
    if len(sif_rows) != expected:
        raise AssertionError(
            f"SIF_ROW_COUNT_MISMATCH:{path.name}:control={count}:rows={len(sif_rows)}:expected={expected}"
        )
    return {
        "file": path.as_posix(),
        "version_header_second_field": version_header(text),
        "control_sif_blocks": count,
        "sif_rows": len(sif_rows),
        "observational_only": True,
    }


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("files", nargs="*", type=Path)
    parser.add_argument("--json", action="store_true")
    parser.add_argument("--authority-self-test", action="store_true")
    args = parser.parse_args()

    authority = authority_self_test()
    files = args.files or list(DEFAULT_FILES)
    if args.authority_self_test and not args.files:
        print(json.dumps({"schema": "CIIWriter1CSifEditionAuthority.v4", **authority}, indent=2, sort_keys=True))
        return 0

    missing = [path.as_posix() for path in files if not path.is_file()]
    if missing:
        print(json.dumps({
            "status": "NOT_RUN",
            "qualification_verdict": "READY_FOR_CANONICAL_V11_SELECTED_SIF_FIELDS",
            "authority_self_test": authority,
            "missing_files": missing,
            "production_writer": "NOT_IMPLEMENTED",
        }, indent=2, sort_keys=True))
        return 2

    results = [census_file(path) for path in files]
    target1 = next((item for item in results if item["file"].endswith("BM_CII_TARGET1.CII")), None)
    if target1 is not None:
        assert target1["version_header_second_field"] == 11.0, target1

    report = {
        "schema": "CIIWriter1CSifEditionAuthority.v4",
        "status": "PASS_CENSUS_QUALIFICATION_ONLY",
        "qualification_verdict": "READY_FOR_CANONICAL_V11_SELECTED_SIF_FIELDS",
        "authority_self_test": authority,
        "results": results,
        "production_writer": "NOT_IMPLEMENTED",
        "warning": "Only item3/item4 in each V11 tee slot are selected future Writer1C candidates; product mutation remains disabled until separate Phase2B gates pass.",
    }
    print(json.dumps(report, indent=2, sort_keys=True) if args.json else report["warning"])
    return 0


if __name__ == "__main__":
    sys.exit(main())
