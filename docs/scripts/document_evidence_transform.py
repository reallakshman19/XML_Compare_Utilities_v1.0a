"""Affine SurfaceTransform helpers for DocumentEvidence.v1."""
from __future__ import annotations

import math

from document_evidence_surface import canonical_hash


class SurfaceTransformError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


def apply_matrix(matrix, point):
    x, y = (float(value) for value in point)
    a, b, c, d, e, f, g, h, i = matrix
    denominator = g * x + h * y + i
    if denominator == 0:
        raise SurfaceTransformError("TRANSFORM_POINT_AT_INFINITY", "point maps to infinity")
    return [
        (a * x + b * y + c) / denominator,
        (d * x + e * y + f) / denominator,
    ]


def invert_affine(matrix):
    _validate_affine(matrix)
    a, b, c, d, e, f, _, _, _ = (float(value) for value in matrix)
    determinant = a * e - b * d
    if abs(determinant) <= 1e-15:
        raise SurfaceTransformError("TRANSFORM_NONINVERTIBLE", "affine transform is singular")
    inverse = [
        e / determinant, -b / determinant, (b * f - e * c) / determinant,
        -d / determinant, a / determinant, (d * c - a * f) / determinant,
        0.0, 0.0, 1.0,
    ]
    return _rounded_matrix(inverse)


def compose_matrices(*matrices):
    result = [1.0, 0.0, 0.0, 0.0, 1.0, 0.0, 0.0, 0.0, 1.0]
    for matrix in matrices:
        result = _multiply(matrix, result)
    return _rounded_matrix(result)


def make_transform(
    source_surface: dict,
    target_surface: dict,
    operation: str,
    forward_matrix,
    *,
    parameters: dict | None = None,
    pixel_convention: str = "not-applicable",
    provider_quantization_error_px: float | None = None,
) -> dict:
    forward = _rounded_matrix(forward_matrix)
    inverse = invert_affine(forward)
    validation = _numeric_validation(
        source_surface, forward, inverse, provider_quantization_error_px,
    )
    identity = {
        "schema": "SurfaceTransform.v1",
        "sourceSurfaceId": source_surface["surfaceId"],
        "targetSurfaceId": target_surface["surfaceId"],
        "sourceSurfaceHash": source_surface["surfaceHash"],
        "targetSurfaceHash": target_surface["surfaceHash"],
        "operation": operation,
        "parameters": parameters or {},
        "forwardMatrix": forward,
        "inverseMatrix": inverse,
        "pixelConvention": pixel_convention,
        "numericValidation": validation,
    }
    transform_hash = canonical_hash(identity)
    return {
        **identity,
        "transformId": f"transform:{operation}:{transform_hash[7:31]}",
        "transformHash": transform_hash,
    }


def render_scale_transform(page_surface: dict, raster_surface: dict, scale: float) -> dict:
    scale = float(scale)
    matrix = [scale, 0.0, 0.0, 0.0, scale, 0.0, 0.0, 0.0, 1.0]
    parameters = {
        "scaleX": round(scale, 6),
        "scaleY": round(scale, 6),
        "rasterAllocation": "provider-integer-pixels",
    }
    return make_transform(
        page_surface, raster_surface, "render-scale", matrix,
        parameters=parameters, pixel_convention="continuous-pixel-edges",
    )


def map_geometry(matrix, geometry):
    kind = geometry.get("type")
    if kind == "Point":
        return {"type": kind, "coordinates": apply_matrix(matrix, geometry["coordinates"])}
    if kind in {"Quad", "Polygon"}:
        points = [apply_matrix(matrix, point) for point in geometry["coordinates"]]
        return {"type": kind, "coordinates": points}
    if kind == "Path":
        return {"type": "Path", "segments": [_map_segment(matrix, item) for item in geometry["segments"]]}
    raise SurfaceTransformError("TRANSFORM_GEOMETRY_UNSUPPORTED", f"unsupported geometry: {kind}")


def _map_segment(matrix, segment):
    operation = segment["op"]
    if operation in {"M", "L"}:
        return {"op": operation, "to": apply_matrix(matrix, segment["to"])}
    if operation == "C":
        return {
            "op": "C",
            "c1": apply_matrix(matrix, segment["c1"]),
            "c2": apply_matrix(matrix, segment["c2"]),
            "to": apply_matrix(matrix, segment["to"]),
        }
    if operation == "Z":
        return {"op": "Z"}
    raise SurfaceTransformError("TRANSFORM_PATH_COMMAND_UNSUPPORTED", f"unsupported path op: {operation}")


def _numeric_validation(source_surface, forward, inverse, provider_error):
    maximum = 0.0
    for point in _sample_points(source_surface["width"], source_surface["height"]):
        recovered = apply_matrix(inverse, apply_matrix(forward, point))
        maximum = max(maximum, abs(point[0] - recovered[0]), abs(point[1] - recovered[1]))
    result = {
        "invertible": True,
        "conditionNumber": round(_condition_number(forward), 12),
        "continuousRoundTripMaxError": round(maximum, 12),
        "continuousRoundTripUnit": source_surface["unit"],
    }
    if provider_error is not None:
        result.update(_quantized_bound(inverse, source_surface["unit"], provider_error, maximum))
    return result


def _quantized_bound(inverse, unit, provider_error, numeric_error):
    q = float(provider_error)
    a, b, _, d, e, _, _, _, _ = inverse
    mapped = q * max(abs(a) + abs(b), abs(d) + abs(e))
    return {
        "providerQuantizationErrorPx": q,
        "quantizedBackProjectionMaxError": round(numeric_error + mapped, 12),
        "quantizedBackProjectionUnit": unit,
    }


def _condition_number(matrix):
    a, b, _, d, e, _, _, _, _ = matrix
    trace = a * a + b * b + d * d + e * e
    determinant_squared = (a * e - b * d) ** 2
    discriminant = max(0.0, trace * trace - 4.0 * determinant_squared)
    root = math.sqrt(discriminant)
    largest = (trace + root) / 2.0
    smallest = (trace - root) / 2.0
    if smallest <= 0:
        raise SurfaceTransformError("TRANSFORM_NONINVERTIBLE", "transform has zero singular value")
    return math.sqrt(largest / smallest)


def _sample_points(width, height):
    width, height = float(width), float(height)
    return (
        (0.0, 0.0), (width, 0.0), (width, height), (0.0, height),
        (width / 2.0, height / 2.0), (width * 0.173, height * 0.619),
        (width * 0.811, height * 0.247), (width * 0.377, height * 0.883),
    )


def _validate_affine(matrix):
    if len(matrix) != 9 or not all(math.isfinite(float(value)) for value in matrix):
        raise SurfaceTransformError("TRANSFORM_MATRIX_INVALID", "matrix must contain nine finite numbers")
    if any(abs(float(value) - expected) > 1e-15 for value, expected in zip(matrix[6:], (0.0, 0.0, 1.0))):
        raise SurfaceTransformError("TRANSFORM_NONAFFINE_UNSUPPORTED", "only affine 3x3 transforms are supported")


def _multiply(left, right):
    output = []
    for row in range(3):
        for column in range(3):
            output.append(sum(left[row * 3 + index] * right[index * 3 + column] for index in range(3)))
    return output


def _rounded_matrix(matrix):
    return [round(float(value), 15) for value in matrix]
