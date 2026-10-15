"""Deterministic OCR-word assignment to already-proven table cells."""
from __future__ import annotations


_EPSILON = 1e-9


def assign_ocr_words_to_cells(table_pass, words) -> dict:
    cells = table_pass["cells"]
    assignments = {cell["cellId"]: [] for cell in cells}
    diagnostics = []
    for index, word in enumerate(words):
        center = _bbox_center(word.bbox)
        matches = [cell for cell in cells if _contains(cell["geometry"], center)]
        if len(matches) == 1:
            assignments[matches[0]["cellId"]].append((index, word))
        elif len(matches) > 1:
            diagnostics.append({
                "code": "OCR_TABLE_WORD_AMBIGUOUS",
                "wordIndex": index,
                "matchingCellIds": sorted(cell["cellId"] for cell in matches),
            })
    reconstructed = []
    for cell in cells:
        members = sorted(
            assignments[cell["cellId"]],
            key=lambda item: (_bbox_top(item[1].bbox), _bbox_left(item[1].bbox), item[0]),
        )
        if not members:
            continue
        reconstructed.append({
            "rowIndex": cell["rowIndex"],
            "columnIndex": cell["columnIndex"],
            "geometry": cell["geometry"],
            "wordIndexes": [index for index, _ in members],
        })
    return {"cells": reconstructed, "diagnostics": diagnostics}


def _contains(geometry, point):
    if geometry.get("type") not in {"Quad", "Polygon"}:
        return False
    polygon = [(float(x), float(y)) for x, y in geometry.get("coordinates", ())]
    if len(polygon) < 3:
        return False
    if not _inside_bounds(polygon, point):
        return False
    return _point_in_polygon(polygon, point)


def _point_in_polygon(polygon, point):
    x, y = point
    inside = False
    previous = polygon[-1]
    for current in polygon:
        if _point_on_segment(previous, current, point):
            return True
        x1, y1 = previous
        x2, y2 = current
        if (y1 > y) != (y2 > y):
            crossing = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < crossing:
                inside = not inside
        previous = current
    return inside


def _point_on_segment(start, end, point):
    x1, y1 = start
    x2, y2 = end
    x, y = point
    cross = (x - x1) * (y2 - y1) - (y - y1) * (x2 - x1)
    if abs(cross) > _EPSILON:
        return False
    return min(x1, x2) - _EPSILON <= x <= max(x1, x2) + _EPSILON and min(y1, y2) - _EPSILON <= y <= max(y1, y2) + _EPSILON


def _inside_bounds(polygon, point):
    xs = [item[0] for item in polygon]
    ys = [item[1] for item in polygon]
    x, y = point
    return min(xs) - _EPSILON <= x <= max(xs) + _EPSILON and min(ys) - _EPSILON <= y <= max(ys) + _EPSILON


def _bbox_center(bbox):
    x0, top, x1, bottom = (float(value) for value in bbox)
    return ((x0 + x1) / 2.0, (top + bottom) / 2.0)


def _bbox_top(bbox):
    return min(float(bbox[1]), float(bbox[3]))


def _bbox_left(bbox):
    return min(float(bbox[0]), float(bbox[2]))
