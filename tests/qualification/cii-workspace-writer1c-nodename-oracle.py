#!/usr/bin/env python3
"""Independent Writer 1C Phase-1 byte oracle.

This file intentionally imports no production Writer or JavaScript
implementation. It recomputes fixed-field pointer and NODENAME byte arithmetic
directly from canonical CAESAR neutral records.
"""
from dataclasses import dataclass

FIELD_WIDTHS = (15, 13, 13, 13, 13, 13)
ELEMENT_ROWS = 15
NODE_TO = (28, 53)
SIF_POINTER = (54, 67)
NODENAME_POINTER = (67, 80)


@dataclass(frozen=True)
class Line:
    number: int
    start: int
    body_end: int
    end: int
    body: bytes


def numeric_row(values):
    return b"".join(str(value).encode("ascii").rjust(FIELD_WIDTHS[i], b" ") for i, value in enumerate(values))


def element_block(from_node, to_node, node_name_pointer, sif_pointer=0):
    rows = [numeric_row((0, 0, 0, 0, 0, 0)) for _ in range(ELEMENT_ROWS)]
    rows[0] = numeric_row((from_node, to_node, 0, 0, 1000, 273))
    rows[13] = numeric_row((0, 0, 0, 0, sif_pointer, node_name_pointer))
    return rows


def name_row(from_name, to_name):
    return b"  " + from_name.encode("ascii").ljust(26) + to_name.encode("ascii").ljust(25)


def fixture():
    rows = [b"#$ ELEMENTS"]
    rows.extend(element_block(100, 200, 1))
    rows.extend(element_block(300, 400, 1))
    rows += [b"#$ NODENAME", name_row("FROM", "OLD"), b"#$ CONTROL", numeric_row((2, 0, 0, 1, 0, 0)), b"#$ SIF&TEES"]
    return b"\r\n".join(rows)


def scan_lines(data):
    out, start, number, index = [], 0, 1, 0
    while index < len(data):
        if data[index] not in (10, 13):
            index += 1
            continue
        body_end = index
        end = index + 2 if data[index] == 13 and index + 1 < len(data) and data[index + 1] == 10 else index + 1
        out.append(Line(number, start, body_end, end, data[start:body_end]))
        start, number, index = end, number + 1, end
    if start < len(data):
        out.append(Line(number, start, len(data), len(data), data[start:]))
    return out


def section_rows(data, section):
    lines = scan_lines(data)
    marker = ("#$ " + section).encode("ascii").upper()
    start = next(i for i, line in enumerate(lines) if line.body.strip().upper() == marker)
    rows = []
    for line in lines[start + 1:]:
        if line.body.lstrip().startswith(b"#$"):
            break
        if line.body.strip():
            rows.append(line)
    return rows


def fixed_int(body, span):
    return int(body[span[0]:span[1]].strip() or b"0")


def authorize_to_span(before):
    elements = section_rows(before, "ELEMENTS")
    names = section_rows(before, "NODENAME")
    assert len(elements) % ELEMENT_ROWS == 0
    pointers = []
    for offset in range(0, len(elements), ELEMENT_ROWS):
        pointer_row = elements[offset + 13]
        pointers.append(fixed_int(pointer_row.body, NODENAME_POINTER))
        assert fixed_int(pointer_row.body, SIF_POINTER) == 0
    assert pointers == [1, 1]
    row = names[pointers[0] - 1]
    assert len(row.body) >= NODE_TO[1]
    start, end = row.start + NODE_TO[0], row.start + NODE_TO[1]
    assert before[start:end] == b"OLD".ljust(25)
    return start, end


def patch(before, span, value):
    encoded = value.encode("ascii")
    width = span[1] - span[0]
    if len(encoded) > width:
        raise ValueError("FIELD_OVERFLOW")
    after = bytearray(before)
    after[span[0]:span[1]] = encoded.ljust(width)
    assert len(after) == len(before)
    return bytes(after)


def assert_negative_assurance(before, after, authorized):
    if len(before) != len(after):
        raise AssertionError("BYTE_LENGTH_CHANGED")
    allowed = set(range(*authorized))
    leaked = [i for i, (left, right) in enumerate(zip(before, after)) if left != right and i not in allowed]
    if leaked:
        raise AssertionError(f"UNAUTHORIZED_BYTE_CHANGE:{leaked[0]}")
    if before[authorized[0]:authorized[1]] == after[authorized[0]:authorized[1]]:
        raise AssertionError("AUTHORIZED_SPAN_DID_NOT_CHANGE")


def main():
    before = fixture()
    authorized = authorize_to_span(before)
    after = patch(before, authorized, "NEW")
    assert_negative_assurance(before, after, authorized)
    assert after[authorized[0]:authorized[1]] == b"NEW".ljust(25)

    tampered = bytearray(after)
    pointer_row = section_rows(before, "ELEMENTS")[13]
    tampered[pointer_row.start + SIF_POINTER[1] - 1] = ord("1")
    try:
        assert_negative_assurance(before, bytes(tampered), authorized)
    except AssertionError as exc:
        assert str(exc).startswith("UNAUTHORIZED_BYTE_CHANGE:")
    else:
        raise AssertionError("SIF_POINTER_FALSIFIER_WAS_NOT_CAUGHT")

    print("Writer 1C independent NODENAME byte oracle passed")
    print({"authorized_span": authorized,
           "changed_bytes": sum(left != right for left, right in zip(before, after)),
           "sif_pointer_falsifier": "PASS"})


if __name__ == "__main__":
    main()
