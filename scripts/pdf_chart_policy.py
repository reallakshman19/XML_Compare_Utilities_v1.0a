"""Resource and authority policy for governed PDF chart API endpoints."""

from document_evidence_surface import canonical_pdf_coordinate_system

PAGE_RENDER_SCHEMA = "PdfPageRenderApi.v1"
PAGE_RENDER_REVISION = "pdf-page-render-v1"
VECTOR_INSPECTION_SCHEMA = "PdfVectorInspectionApi.v1"
VECTOR_INSPECTION_REVISION = "pdf-vector-inspection-v1"

DEFAULT_RENDER_SCALE = 4.0
MAX_RENDER_SCALE = 6.0
DEFAULT_MAX_RENDER_PAGES = 8
DEFAULT_MAX_RENDER_PIXELS = 10_000_000
DEFAULT_MAX_RENDER_JOB_PIXELS = 32_000_000
DEFAULT_MAX_RENDER_MEMORY_BYTES = 96 * 1024 * 1024
RENDER_PEAK_BYTES_PER_PIXEL = 10.0

DEFAULT_MAX_VECTOR_PAGES = 8
DEFAULT_MAX_VECTOR_PRIMITIVES_PER_PAGE = 25_000
DEFAULT_MAX_VECTOR_PATH_COMMANDS_PER_PAGE = 100_000


def interpretation_boundary() -> dict:
    return {
        "status": "REVIEW_EVIDENCE_ONLY",
        "axisCalibration": "NOT_PERFORMED",
        "curveDigitization": "NOT_PERFORMED",
        "engineeringAuthority": "NONE",
        "screeningAuthority": "NOT_AUTHORIZED",
        "designAuthority": False,
    }


def coordinate_system() -> dict:
    return canonical_pdf_coordinate_system()
