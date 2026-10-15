"""Geometry-preserving preprocessing transforms for OCR/document evidence."""
from __future__ import annotations

import math

from document_evidence_surface import make_surface
from document_evidence_transform import apply_matrix, compose_matrices, invert_affine, make_transform


class PreprocessingError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def crop_surface(source_surface: dict, x: float, y: float, width: float, height: float) -> tuple[dict, dict]:
    x, y, width, height = map(float, (x, y, width, height))
    if width <= 0 or height <= 0 or x < 0 or y < 0 or x + width > source_surface["width"] or y + height > source_surface["height"]:
        raise PreprocessingError("OCR_REGION_INVALID", "crop region must lie within the source surface")
    target = make_surface(source_surface["sourceHash"], "document-region", width, height, source_surface["unit"], "top-left", "right", "down", page_number=source_surface.get("pageNumber"), parent_surface_id=source_surface["surfaceId"], metadata={"crop": [x, y, width, height]})
    transform = make_transform(source_surface, target, "crop", [1, 0, -x, 0, 1, -y, 0, 0, 1], parameters={"x": x, "y": y, "width": width, "height": height})
    return target, transform


def deskew_surface(source_surface: dict, skew_degrees: float, *, pad: bool = True) -> tuple[dict, dict]:
    if source_surface["unit"] != "px":
        raise PreprocessingError("OCR_DESKEW_PIXEL_SURFACE_REQUIRED", "deskew requires a pixel surface")
    angle = -math.radians(float(skew_degrees))
    width, height = float(source_surface["width"]), float(source_surface["height"])
    matrix = _rotation_about_center(width, height, angle)
    target_width, target_height = width, height
    padding = [0.0, 0.0]
    if pad:
        corners = [apply_matrix(matrix, point) for point in ((0, 0), (width, 0), (width, height), (0, height))]
        xs, ys = zip(*corners)
        min_x, min_y, max_x, max_y = min(xs), min(ys), max(xs), max(ys)
        padding = [-min_x, -min_y]
        matrix = compose_matrices(matrix, [1, 0, padding[0], 0, 1, padding[1], 0, 0, 1])
        target_width, target_height = max_x - min_x, max_y - min_y
    target = make_surface(source_surface["sourceHash"], "ocr-preprocessed-raster", target_width, target_height, "px", "top-left", "right", "down", page_number=source_surface.get("pageNumber"), parent_surface_id=source_surface["surfaceId"], metadata={"deskewMeasuredDegrees": float(skew_degrees), "appliedDegrees": -float(skew_degrees), "paddingTranslation": padding})
    transform = make_transform(source_surface, target, "deskew", matrix, parameters={"measuredSkewDegrees": float(skew_degrees), "appliedDegrees": -float(skew_degrees), "pad": bool(pad), "paddingTranslation": padding}, pixel_convention="continuous-pixel-edges")
    return target, transform


def resample_surface(source_surface: dict, scale_x: float, scale_y: float | None = None) -> tuple[dict, dict]:
    sx = float(scale_x)
    sy = sx if scale_y is None else float(scale_y)
    if sx <= 0 or sy <= 0:
        raise PreprocessingError("OCR_RESAMPLE_SCALE_INVALID", "resample scales must be positive")
    target = make_surface(source_surface["sourceHash"], "ocr-preprocessed-raster", source_surface["width"] * sx, source_surface["height"] * sy, source_surface["unit"], "top-left", "right", "down", page_number=source_surface.get("pageNumber"), parent_surface_id=source_surface["surfaceId"], metadata={"scaleX": sx, "scaleY": sy})
    transform = make_transform(source_surface, target, "resample", [sx, 0, 0, 0, sy, 0, 0, 0, 1], parameters={"scaleX": sx, "scaleY": sy}, pixel_convention="continuous-pixel-edges")
    return target, transform


def compose_pipeline(transforms) -> dict:
    transforms = tuple(transforms)
    if not transforms:
        raise PreprocessingError("PREPROCESSING_PIPELINE_EMPTY", "at least one transform is required")
    for left, right in zip(transforms, transforms[1:]):
        if left["targetSurfaceId"] != right["sourceSurfaceId"]:
            raise PreprocessingError("PREPROCESSING_SURFACE_DISCONTINUITY", "preprocessing transforms do not form a continuous surface chain")
    forward = compose_matrices(*(item["forwardMatrix"] for item in transforms))
    return {"sourceSurfaceId": transforms[0]["sourceSurfaceId"], "targetSurfaceId": transforms[-1]["targetSurfaceId"], "forwardMatrix": forward, "inverseMatrix": invert_affine(forward), "transformHashes": [item["transformHash"] for item in transforms]}


def roundtrip_error(pipeline: dict, points) -> float:
    maximum = 0.0
    for point in points:
        recovered = apply_matrix(pipeline["inverseMatrix"], apply_matrix(pipeline["forwardMatrix"], point))
        maximum = max(maximum, abs(float(point[0]) - recovered[0]), abs(float(point[1]) - recovered[1]))
    return maximum


def _rotation_about_center(width, height, angle):
    c, s = math.cos(angle), math.sin(angle)
    cx, cy = width / 2.0, height / 2.0
    tx = cx - c * cx + s * cy
    ty = cy - s * cx - c * cy
    return [c, -s, tx, s, c, ty, 0, 0, 1]
