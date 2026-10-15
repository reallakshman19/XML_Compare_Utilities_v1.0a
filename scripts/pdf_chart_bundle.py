"""Deterministic ZIP bundle for governed rendered PDF chart pages."""
from __future__ import annotations

from io import BytesIO
import hashlib
import json
from zipfile import ZIP_STORED, ZipFile, ZipInfo

from pdf_chart_policy import coordinate_system, interpretation_boundary


class ChartBinaryResponse:
    def __init__(self, body: bytes, content_type: str, filename: str, headers=None):
        self.body = body
        self.content_type = content_type
        self.filename = filename
        self.headers = dict(headers or {})


def build_render_bundle(rendered, source, request_hash, revision):
    pages = [_page_manifest(item, source) for item in rendered]
    manifest = {
        "schema": "PdfPageRenderApi.v1",
        "revision": revision,
        "requestHash": request_hash,
        "source": source,
        "coordinateSystem": coordinate_system(),
        "pages": pages,
        "interpretation": interpretation_boundary(),
    }
    stream = BytesIO()
    with ZipFile(stream, "w", compression=ZIP_STORED) as archive:
        _write_entry(archive, "manifest.json", _json_bytes(manifest))
        for item in rendered:
            _write_entry(archive, f"page-{item.page:06d}.png", item.png_bytes)
    body = stream.getvalue()
    return ChartBinaryResponse(
        body, "application/zip", "pdf-chart-pages.zip",
        headers={
            "X-Document-Request-Hash": request_hash,
            "X-Bundle-Sha256": f"sha256:{hashlib.sha256(body).hexdigest()}",
        },
    )


def _page_manifest(value, source):
    image_sha = hashlib.sha256(value.png_bytes).hexdigest()
    return {
        "page": value.page,
        "sourcePage": value.page,
        "sourceSha256": source["sha256"],
        "sourceGitBlobSha": source["gitBlobSha"],
        "file": f"page-{value.page:06d}.png",
        "contentType": "image/png",
        "imageSha256": f"sha256:{image_sha}",
        "pageWidth": round(value.page_width, 6),
        "pageHeight": round(value.page_height, 6),
        "rasterWidth": value.raster_width,
        "rasterHeight": value.raster_height,
        "scale": value.scale,
        "pixels": value.pixels,
        "estimatedPeakBytes": value.estimated_bytes,
        "renderer": "pypdfium2",
        "rendererVersion": value.renderer_version,
        "pillowVersion": value.pillow_version,
    }


def _write_entry(archive, name, data):
    info = ZipInfo(name, date_time=(1980, 1, 1, 0, 0, 0))
    info.compress_type = ZIP_STORED
    info.external_attr = 0o600 << 16
    archive.writestr(info, data)


def _json_bytes(value):
    return (json.dumps(
        value, sort_keys=True, separators=(",", ":"), ensure_ascii=False,
    ) + "\n").encode("utf-8")
