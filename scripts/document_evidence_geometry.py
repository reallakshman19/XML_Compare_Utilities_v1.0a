"""Provider-neutral geometry normalization for DocumentEvidence.v1."""
from __future__ import annotations

import hashlib
import json
import math


def normalize_pdfplumber_primitive(source_sha, page, index, kind, item, *, surface=None):
    legacy_path = _legacy_path(item.get("path") or ())
    body = {
        "page": page,
        "kind": kind,
        "bbox": _bbox(item),
        "path": legacy_path,
        "lineWidth": _optional_number(item.get("linewidth")),
        "stroke": bool(item.get("stroke", False)),
        "fill": bool(item.get("fill", False)),
        "evenOdd": bool(item.get("evenodd", False)),
        "strokingColor": _json_value(item.get("stroking_color")),
        "nonStrokingColor": _json_value(item.get("non_stroking_color")),
        "dash": _json_value(item.get("dash")),
    }
    identity = {"sourceSha256": source_sha, "sourceIndex": index, **body}
    digest = hashlib.sha256(_canonical_json(identity)).hexdigest()[:24]
    result = {
        "id": f"pdf-vector:p{page}:{index}:{digest}",
        "sourceIndex": index,
        **body,
        "geometry": _geometry(kind, item, legacy_path),
        "provider": {"name": "pdfplumber", "sourceIndex": index},
    }
    if surface is not None:
        result.update({"surfaceId": surface["surfaceId"], "surfaceHash": surface["surfaceHash"]})
    return result


def _geometry(kind, item, legacy_path):
    if kind == "line":
        points = _line_points(item)
        if points:
            return {"type": "Path", "segments": [{"op": "M", "to": points[0]}, {"op": "L", "to": points[1]}]}
    if kind == "rect":
        bbox = _bbox(item)
        if bbox:
            x0, top, x1, bottom = bbox
            return {"type": "Quad", "coordinates": [[x0, top], [x1, top], [x1, bottom], [x0, bottom]]}
    segments = _evidence_segments(legacy_path)
    if segments:
        return {"type": "Path", "segments": segments}
    bbox = _bbox(item)
    if bbox:
        x0, top, x1, bottom = bbox
        return {"type": "Quad", "coordinates": [[x0, top], [x1, top], [x1, bottom], [x0, bottom]]}
    return {"type": "Path", "segments": []}


def _evidence_segments(path):
    segments = []
    for command in path:
        operation = command["op"].lower()
        points = command["points"]
        if operation == "m" and points:
            segments.append({"op": "M", "to": points[-1]})
        elif operation == "l" and points:
            segments.append({"op": "L", "to": points[-1]})
        elif operation == "c" and len(points) >= 3:
            segments.append({"op": "C", "c1": points[-3], "c2": points[-2], "to": points[-1]})
        elif operation in {"h", "z"}:
            segments.append({"op": "Z"})
    return segments


def _line_points(item):
    values = (item.get("x0"), item.get("top"), item.get("x1"), item.get("bottom"))
    if not all(_finite(value) for value in values):
        return None
    return [[_round(values[0]), _round(values[1])], [_round(values[2]), _round(values[3])]]


def _legacy_path(path):
    result = []
    for command in path:
        if not isinstance(command, (tuple, list)) or not command:
            continue
        points = []
        for value in command[1:]:
            if isinstance(value, (tuple, list)) and len(value) >= 2:
                x, y = value[0], value[1]
                if _finite(x) and _finite(y):
                    points.append([_round(x), _round(y)])
        result.append({"op": str(command[0]), "points": points})
    return result


def _bbox(item):
    keys = ("x0", "top", "x1", "bottom")
    if not all(key in item and _finite(item[key]) for key in keys):
        return None
    x0, top, x1, bottom = (float(item[key]) for key in keys)
    return [_round(min(x0, x1)), _round(min(top, bottom)), _round(max(x0, x1)), _round(max(top, bottom))]


def _canonical_json(value):
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")


def _json_value(value):
    if value is None or isinstance(value, (str, int, bool)):
        return value
    if isinstance(value, float):
        return _round(value) if math.isfinite(value) else None
    if isinstance(value, (tuple, list)):
        return [_json_value(item) for item in value]
    return str(value)


def _optional_number(value):
    return _round(value) if _finite(value) else None


def _finite(value):
    try:
        return math.isfinite(float(value))
    except (TypeError, ValueError):
        return False


def _round(value):
    return round(float(value), 6)
