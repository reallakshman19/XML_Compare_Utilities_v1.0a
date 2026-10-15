"""Deterministic native/OCR PDF search indexing for API callers."""
from __future__ import annotations

from collections import OrderedDict
from dataclasses import dataclass
import difflib
import hashlib
import json
import os
from pathlib import Path
import re
import threading
from typing import Callable

PDF_SEARCH_SCHEMA = "PdfSearchApi.v2"
PDF_SEARCH_INDEX_REVISION = "pdf-search-index-v2"
DEFAULT_MAX_INDEX_CHARS = 20_000_000
DEFAULT_MAX_SEARCH_RESULTS = 5_000
DEFAULT_MAX_CACHE_DOCUMENTS = 8
DEFAULT_MAX_PERSISTED_DOCUMENTS = 32
DEFAULT_SNIPPET_CHARS = 220
MAX_QUERY_CHARS = 512
SEARCH_OCR_MODES = ("auto", "always", "never")


class PdfSearchError(ValueError):
    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class PdfSearchIndexItem:
    page: int
    item_id: str
    text: str
    bbox: tuple[float, float, float, float]
    extraction: str
    confidence: float | None = None


@dataclass(frozen=True)
class PdfSearchIndex:
    source_sha256: str
    index_id: str
    options_hash: str
    total_pages: int
    items: tuple[PdfSearchIndexItem, ...]
    indexed_chars: int
    pages_without_native_text: tuple[int, ...]
    pages_ocr_indexed: tuple[int, ...]
    pages_without_searchable_text: tuple[int, ...]
    backend_versions: dict[str, str]
    ocr_engine_version: str = "not-invoked"
    ocr_rasterizer_version: str = "not-invoked"


class PdfSearchIndexStore:
    """Atomic JSON index store; filenames are derived only from stable hashes."""

    def __init__(self, directory: Path, max_documents: int = DEFAULT_MAX_PERSISTED_DOCUMENTS):
        if max_documents <= 0:
            raise PdfSearchError("PDF_SEARCH_STORE_POLICY_INVALID", "max persisted documents must be positive")
        self.directory = Path(directory).expanduser().resolve()
        self.max_documents = max_documents
        self.directory.mkdir(parents=True, exist_ok=True)

    def load(self, cache_key: str) -> PdfSearchIndex | None:
        path = self._path(cache_key)
        if not path.exists():
            return None
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
            return _index_from_payload(payload, expected_cache_key=cache_key)
        except (OSError, ValueError, TypeError, KeyError, json.JSONDecodeError):
            return None

    def save(self, cache_key: str, index: PdfSearchIndex) -> Path:
        path = self._path(cache_key)
        payload = {
            "schema": "PdfSearchIndexStore.v1",
            "cacheKey": cache_key,
            "index": _index_payload(index),
        }
        data = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False) + "\n"
        temp = path.with_suffix(".tmp")
        temp.write_text(data, encoding="utf-8")
        try:
            os.chmod(temp, 0o600)
        except OSError:
            pass
        os.replace(temp, path)
        self._prune()
        return path

    def _path(self, cache_key: str) -> Path:
        digest = hashlib.sha256(cache_key.encode("utf-8")).hexdigest()
        return self.directory / f"{digest}.json"

    def _prune(self) -> None:
        files = [path for path in self.directory.glob("*.json") if path.is_file()]
        if len(files) <= self.max_documents:
            return
        ordered = sorted(files, key=lambda path: (path.stat().st_mtime_ns, path.name))
        for path in ordered[: len(files) - self.max_documents]:
            try:
                path.unlink()
            except FileNotFoundError:
                pass


class PdfSearchIndexCache:
    """Process-local LRU backed by an optional persistent JSON store."""

    def __init__(
        self,
        max_documents: int = DEFAULT_MAX_CACHE_DOCUMENTS,
        *,
        store: PdfSearchIndexStore | None = None,
    ):
        if max_documents <= 0:
            raise PdfSearchError("PDF_SEARCH_CACHE_POLICY_INVALID", "max cache documents must be positive")
        self.max_documents = max_documents
        self.store = store
        self._values: OrderedDict[str, PdfSearchIndex] = OrderedDict()
        self._lock = threading.Lock()

    def get_or_build(
        self,
        key: str,
        builder: Callable[[], PdfSearchIndex],
    ) -> tuple[PdfSearchIndex, str]:
        with self._lock:
            cached = self._values.get(key)
            if cached is not None:
                self._values.move_to_end(key)
                return cached, "memory"
            persisted = self.store.load(key) if self.store else None
            if persisted is not None:
                self._remember(key, persisted)
                return persisted, "disk"
            built = builder()
            if self.store:
                self.store.save(key, built)
            self._remember(key, built)
            return built, "built"

    def _remember(self, key: str, index: PdfSearchIndex) -> None:
        self._values[key] = index
        self._values.move_to_end(key)
        while len(self._values) > self.max_documents:
            self._values.popitem(last=False)


def search_cache_key(
    source_sha256: str,
    *,
    password_fingerprint: str,
    ocr_mode: str,
    ocr_language: str,
    ocr_confidence_min: float,
) -> str:
    identity = {
        "revision": PDF_SEARCH_INDEX_REVISION,
        "sourceSha256": source_sha256,
        "passwordFingerprint": password_fingerprint,
        "ocrMode": ocr_mode,
        "ocrLanguage": ocr_language,
        "ocrConfidenceMin": round(float(ocr_confidence_min), 6),
    }
    return hashlib.sha256(_canonical_json(identity)).hexdigest()


def build_pdf_search_index(
    pdf_bytes: bytes,
    *,
    backend=None,
    password: str | None = None,
    max_pages: int = 2000,
    max_index_chars: int = DEFAULT_MAX_INDEX_CHARS,
    ocr_mode: str = "auto",
    ocr_language: str = "eng",
    ocr_confidence_min: float = 0.70,
    ocr_max_pages: int = 100,
    ocr_max_job_pixels: int = 250_000_000,
    ocr_timeout_seconds: float = 60.0,
    rasterizer=None,
    ocr_engine=None,
) -> PdfSearchIndex:
    _validate_index_policy(
        max_pages,
        max_index_chars,
        ocr_mode,
        ocr_confidence_min,
        ocr_max_pages,
        ocr_max_job_pixels,
        ocr_timeout_seconds,
    )
    from pdf_native import PdfPlumberBackend, cluster_chars_into_lines, native_text_quality

    native_backend = backend or PdfPlumberBackend()
    try:
        result = native_backend.extract(pdf_bytes, password=password, max_pages=max_pages)
    except ValueError as exc:
        raise PdfSearchError(str(getattr(exc, "code", "PDF_SEARCH_INDEX_FAILED")), str(exc)) from exc

    items, native_by_page, pages_without_native, pages_needing_ocr = _native_items(
        result,
        cluster_chars_into_lines=cluster_chars_into_lines,
        quality_fn=native_text_quality,
        ocr_mode=ocr_mode,
    )
    indexed_chars = _sum_checked_chars(items, max_index_chars)
    pages_ocr_indexed: tuple[int, ...] = ()
    ocr_engine_version = "not-invoked"
    ocr_rasterizer_version = "not-invoked"

    if ocr_mode != "never" and pages_needing_ocr:
        ocr_items, ocr_meta = _ocr_items(
            pdf_bytes,
            pages_needing_ocr,
            native_by_page=native_by_page,
            password=password,
            language=ocr_language,
            confidence_min=ocr_confidence_min,
            max_pages=ocr_max_pages,
            max_job_pixels=ocr_max_job_pixels,
            timeout_seconds=ocr_timeout_seconds,
            rasterizer=rasterizer,
            engine=ocr_engine,
        )
        indexed_chars = _sum_checked_chars((*items, *ocr_items), max_index_chars)
        items.extend(ocr_items)
        pages_ocr_indexed = tuple(ocr_meta["pages"])
        ocr_engine_version = ocr_meta["engineVersion"]
        ocr_rasterizer_version = ocr_meta["rasterizerVersion"]

    total_pages = len(result.pages)
    searchable_pages = {item.page for item in items if item.text.strip()}
    pages_without_searchable = tuple(
        page for page in range(1, total_pages + 1) if page not in searchable_pages
    )
    backend_versions = dict(sorted((result.backend_versions or {}).items()))
    options = {
        "ocrMode": ocr_mode,
        "ocrLanguage": ocr_language,
        "ocrConfidenceMin": round(float(ocr_confidence_min), 6),
    }
    options_hash = hashlib.sha256(_canonical_json(options)).hexdigest()
    source_sha = hashlib.sha256(pdf_bytes).hexdigest()
    identity = {
        "revision": PDF_SEARCH_INDEX_REVISION,
        "sourceSha256": source_sha,
        "backendVersions": backend_versions,
        "optionsHash": options_hash,
        "ocrEngineVersion": ocr_engine_version,
        "ocrRasterizerVersion": ocr_rasterizer_version,
    }
    index_id = hashlib.sha256(_canonical_json(identity)).hexdigest()
    return PdfSearchIndex(
        source_sha,
        f"sha256:{index_id}",
        f"sha256:{options_hash}",
        total_pages,
        tuple(sorted(items, key=_item_sort_key)),
        indexed_chars,
        tuple(sorted(set(pages_without_native))),
        tuple(sorted(set(pages_ocr_indexed))),
        pages_without_searchable,
        backend_versions,
        ocr_engine_version,
        ocr_rasterizer_version,
    )


def search_pdf_index(
    index: PdfSearchIndex,
    query: str,
    *,
    case_sensitive: bool = False,
    whole_word: bool = False,
    max_results: int = DEFAULT_MAX_SEARCH_RESULTS,
    snippet_chars: int = DEFAULT_SNIPPET_CHARS,
) -> dict:
    _validate_query(query, max_results, snippet_chars)
    pattern = _literal_pattern(query, case_sensitive=case_sensitive, whole_word=whole_word)
    matches = []
    page_counts: dict[int, int] = {}
    for item in index.items:
        for found in pattern.finditer(item.text):
            if len(matches) >= max_results:
                raise PdfSearchError(
                    "PDF_SEARCH_RESULT_LIMIT_EXCEEDED",
                    f"search exceeds the configured limit of {max_results} matches; narrow the query",
                )
            matches.append(_match_record(index, item, found, snippet_chars))
            page_counts[item.page] = page_counts.get(item.page, 0) + 1

    options = {"caseSensitive": case_sensitive, "wholeWord": whole_word, "useRegex": False}
    search_identity = {
        "indexId": index.index_id,
        "query": query,
        "options": options,
        "revision": PDF_SEARCH_INDEX_REVISION,
    }
    search_hash = hashlib.sha256(_canonical_json(search_identity)).hexdigest()
    return {
        "schema": PDF_SEARCH_SCHEMA,
        "indexRevision": PDF_SEARCH_INDEX_REVISION,
        "indexId": index.index_id,
        "searchHash": f"sha256:{search_hash}",
        "query": query,
        "options": options,
        "matches": matches,
        "summary": {
            "totalMatches": len(matches),
            "pagesWithMatches": [
                {"page": page, "matches": page_counts[page]} for page in sorted(page_counts)
            ],
        },
    }


def index_metadata(index: PdfSearchIndex, *, cache_source: str) -> dict:
    return {
        "indexId": index.index_id,
        "revision": PDF_SEARCH_INDEX_REVISION,
        "cacheSource": cache_source,
        "totalPages": index.total_pages,
        "indexedItems": len(index.items),
        "indexedChars": index.indexed_chars,
        "nativeTextPages": index.total_pages - len(index.pages_without_native_text),
        "pagesWithoutNativeText": list(index.pages_without_native_text),
        "ocrIndexedPages": list(index.pages_ocr_indexed),
        "pagesWithoutSearchableText": list(index.pages_without_searchable_text),
        "backendVersions": index.backend_versions,
        "ocrEngineVersion": index.ocr_engine_version,
        "ocrRasterizerVersion": index.ocr_rasterizer_version,
        "optionsHash": index.options_hash,
        "nativeTextOnly": not bool(index.pages_ocr_indexed),
    }


def _validate_index_policy(
    max_pages: int,
    max_index_chars: int,
    ocr_mode: str,
    ocr_confidence_min: float,
    ocr_max_pages: int,
    ocr_max_job_pixels: int,
    ocr_timeout_seconds: float,
) -> None:
    if min(max_pages, max_index_chars, ocr_max_pages, ocr_max_job_pixels) <= 0:
        raise PdfSearchError("PDF_SEARCH_INDEX_POLICY_INVALID", "search index limits must be positive")
    if ocr_timeout_seconds <= 0:
        raise PdfSearchError("PDF_SEARCH_OCR_TIMEOUT_INVALID", "search OCR timeout must be positive")
    if ocr_mode not in SEARCH_OCR_MODES:
        raise PdfSearchError("PDF_SEARCH_OCR_MODE_INVALID", f"unsupported search OCR mode: {ocr_mode}")
    if not 0.0 <= ocr_confidence_min <= 1.0:
        raise PdfSearchError(
            "PDF_SEARCH_OCR_CONFIDENCE_INVALID",
            "search OCR confidence must be between 0 and 1",
        )


def _native_items(result, *, cluster_chars_into_lines, quality_fn, ocr_mode: str):
    items: list[PdfSearchIndexItem] = []
    by_page: dict[int, tuple[PdfSearchIndexItem, ...]] = {}
    pages_without_native: list[int] = []
    pages_needing_ocr: list[int] = []
    for page in result.pages:
        page_number = int(page.signals.page)
        quality = quality_fn(page.chars, page.signals.duplicate_ratio)
        lines = cluster_chars_into_lines(page.chars, page_number)
        page_items = tuple(
            PdfSearchIndexItem(
                page_number,
                str(line.line_id),
                line.text,
                tuple(float(value) for value in line.bbox),
                "embedded-text",
            )
            for line in lines
            if line.text.strip()
        )
        by_page[page_number] = page_items
        items.extend(page_items)
        if not page_items:
            pages_without_native.append(page_number)
        if ocr_mode == "always" or (ocr_mode == "auto" and not quality.adequate):
            pages_needing_ocr.append(page_number)
    return items, by_page, pages_without_native, pages_needing_ocr


def _ocr_items(
    pdf_bytes: bytes,
    pages: list[int],
    *,
    native_by_page: dict[int, tuple[PdfSearchIndexItem, ...]],
    password: str | None,
    language: str,
    confidence_min: float,
    max_pages: int,
    max_job_pixels: int,
    timeout_seconds: float,
    rasterizer,
    engine,
) -> tuple[list[PdfSearchIndexItem], dict]:
    if len(pages) > max_pages:
        raise PdfSearchError(
            "PDF_SEARCH_OCR_PAGE_LIMIT_EXCEEDED",
            f"search OCR requires {len(pages)} pages; limit is {max_pages}",
        )
    from pdf_ocr import PdfiumRasterizer, TesseractCliEngine, validate_ocr_language

    try:
        validate_ocr_language(language)
    except ValueError as exc:
        raise PdfSearchError(str(getattr(exc, "code", "PDF_SEARCH_OCR_LANGUAGE_INVALID")), str(exc)) from exc
    rasterizer = rasterizer or PdfiumRasterizer()
    engine = engine or TesseractCliEngine()
    items: list[PdfSearchIndexItem] = []
    job_pixels = 0
    rasterizer_version = "unknown"
    engine_version = "unknown"
    indexed_pages: list[int] = []
    for page in pages:
        raster, result = _recognize_search_page(
            pdf_bytes,
            page,
            password=password,
            language=language,
            timeout_seconds=timeout_seconds,
            rasterizer=rasterizer,
            engine=engine,
        )
        if job_pixels + raster.pixels > max_job_pixels:
            raise PdfSearchError(
                "PDF_SEARCH_OCR_JOB_PIXEL_LIMIT_EXCEEDED",
                f"search OCR job would exceed {max_job_pixels} pixels at page {page}",
            )
        job_pixels += raster.pixels
        rasterizer_version = str(getattr(result, "rasterizer_version", rasterizer_version))
        engine_version = str(getattr(result, "engine_version", engine_version))
        page_items = _accepted_ocr_lines(
            page,
            result.lines,
            confidence_min=confidence_min,
            native_items=native_by_page.get(page, ()),
        )
        items.extend(page_items)
        if page_items:
            indexed_pages.append(page)
    return items, {
        "pages": tuple(indexed_pages),
        "engineVersion": engine_version,
        "rasterizerVersion": rasterizer_version,
        "jobPixels": job_pixels,
    }


def _recognize_search_page(
    pdf_bytes: bytes,
    page: int,
    *,
    password: str | None,
    language: str,
    timeout_seconds: float,
    rasterizer,
    engine,
):
    try:
        raster = rasterizer.render_page(pdf_bytes, page, password=password)
        result = engine.recognize(raster, language=language, timeout_seconds=timeout_seconds)
        return raster, result
    except ValueError as exc:
        raise PdfSearchError(str(getattr(exc, "code", "PDF_SEARCH_OCR_FAILED")), str(exc)) from exc


def _accepted_ocr_lines(
    page: int,
    lines,
    *,
    confidence_min: float,
    native_items: tuple[PdfSearchIndexItem, ...],
) -> list[PdfSearchIndexItem]:
    accepted = []
    for index, line in enumerate(lines):
        text = str(line.text).strip()
        confidence = float(line.confidence)
        if not text or confidence < confidence_min:
            continue
        candidate = PdfSearchIndexItem(
            page,
            f"ocr:p{page}:l{index}",
            text,
            tuple(float(value) for value in line.bbox),
            "ocr",
            round(confidence, 6),
        )
        if not _duplicates_native(candidate, native_items):
            accepted.append(candidate)
    return accepted


def _duplicates_native(
    candidate: PdfSearchIndexItem,
    native_items: tuple[PdfSearchIndexItem, ...],
) -> bool:
    normalized = _normalize_text(candidate.text)
    if not normalized:
        return True
    for native in native_items:
        if _bbox_iou(candidate.bbox, native.bbox) < 0.35:
            continue
        ratio = difflib.SequenceMatcher(None, normalized, _normalize_text(native.text)).ratio()
        if ratio >= 0.90:
            return True
    return False


def _sum_checked_chars(items, limit: int) -> int:
    total = sum(len(item.text) for item in items)
    if total > limit:
        raise PdfSearchError(
            "PDF_SEARCH_INDEX_CHAR_LIMIT_EXCEEDED",
            f"PDF search index exceeds {limit} characters",
        )
    return total


def _item_sort_key(item: PdfSearchIndexItem) -> tuple:
    return (
        item.page,
        round(item.bbox[1], 3),
        round(item.bbox[0], 3),
        0 if item.extraction == "embedded-text" else 1,
        item.item_id,
    )


def _validate_query(query: str, max_results: int, snippet_chars: int) -> None:
    if not isinstance(query, str) or not query.strip():
        raise PdfSearchError("PDF_SEARCH_QUERY_REQUIRED", "query must be a non-empty string")
    if len(query) > MAX_QUERY_CHARS:
        raise PdfSearchError(
            "PDF_SEARCH_QUERY_LIMIT_EXCEEDED",
            f"query length {len(query)} exceeds limit {MAX_QUERY_CHARS}",
        )
    if max_results <= 0 or snippet_chars <= 0:
        raise PdfSearchError("PDF_SEARCH_POLICY_INVALID", "search result/snippet limits must be positive")


def _literal_pattern(query: str, *, case_sensitive: bool, whole_word: bool) -> re.Pattern:
    escaped = re.escape(query)
    pattern = f"(?<!\\w){escaped}(?!\\w)" if whole_word else escaped
    return re.compile(pattern, 0 if case_sensitive else re.IGNORECASE)


def _match_record(index, item, found, snippet_chars: int) -> dict:
    start, end = found.span()
    snippet, snippet_start = _snippet(item.text, start, end, snippet_chars)
    hit_identity = (
        f"{index.source_sha256}\0{item.page}\0{item.item_id}\0{start}\0{end}\0"
        f"{item.extraction}\0{found.group(0)}"
    ).encode("utf-8")
    hit_id = hashlib.sha256(hit_identity).hexdigest()[:24]
    value = {
        "id": f"pdf-search:{hit_id}",
        "page": item.page,
        "itemId": item.item_id,
        "matchText": found.group(0),
        "lineText": item.text,
        "charRange": {"start": start, "end": end},
        "snippet": snippet,
        "snippetMatchRange": {"start": start - snippet_start, "end": end - snippet_start},
        "bbox": [round(value, 3) for value in item.bbox],
        "bboxPrecision": "line",
        "extraction": item.extraction,
    }
    if item.confidence is not None:
        value["confidence"] = item.confidence
    return value


def _snippet(text: str, start: int, end: int, limit: int) -> tuple[str, int]:
    if len(text) <= limit:
        return text, 0
    match_length = max(1, end - start)
    room = max(0, limit - match_length)
    left = min(start, room // 2)
    snippet_start = start - left
    snippet_end = min(len(text), snippet_start + limit)
    snippet_start = max(0, snippet_end - limit)
    prefix = "…" if snippet_start > 0 else ""
    suffix = "…" if snippet_end < len(text) else ""
    return f"{prefix}{text[snippet_start:snippet_end]}{suffix}", snippet_start - len(prefix)


def _index_payload(index: PdfSearchIndex) -> dict:
    return {
        "sourceSha256": index.source_sha256,
        "indexId": index.index_id,
        "optionsHash": index.options_hash,
        "totalPages": index.total_pages,
        "items": [
            {
                "page": item.page,
                "itemId": item.item_id,
                "text": item.text,
                "bbox": list(item.bbox),
                "extraction": item.extraction,
                "confidence": item.confidence,
            }
            for item in index.items
        ],
        "indexedChars": index.indexed_chars,
        "pagesWithoutNativeText": list(index.pages_without_native_text),
        "pagesOcrIndexed": list(index.pages_ocr_indexed),
        "pagesWithoutSearchableText": list(index.pages_without_searchable_text),
        "backendVersions": index.backend_versions,
        "ocrEngineVersion": index.ocr_engine_version,
        "ocrRasterizerVersion": index.ocr_rasterizer_version,
    }


def _index_from_payload(payload: dict, *, expected_cache_key: str) -> PdfSearchIndex:
    if payload.get("schema") != "PdfSearchIndexStore.v1" or payload.get("cacheKey") != expected_cache_key:
        raise ValueError("persistent search index identity mismatch")
    value = payload["index"]
    items = tuple(
        PdfSearchIndexItem(
            int(item["page"]),
            str(item["itemId"]),
            str(item["text"]),
            tuple(float(part) for part in item["bbox"]),
            str(item["extraction"]),
            None if item.get("confidence") is None else float(item["confidence"]),
        )
        for item in value["items"]
    )
    if any(len(item.bbox) != 4 for item in items):
        raise ValueError("invalid persistent search bbox")
    return PdfSearchIndex(
        str(value["sourceSha256"]),
        str(value["indexId"]),
        str(value["optionsHash"]),
        int(value["totalPages"]),
        items,
        int(value["indexedChars"]),
        tuple(int(page) for page in value["pagesWithoutNativeText"]),
        tuple(int(page) for page in value["pagesOcrIndexed"]),
        tuple(int(page) for page in value["pagesWithoutSearchableText"]),
        {str(key): str(version) for key, version in dict(value["backendVersions"]).items()},
        str(value.get("ocrEngineVersion", "not-invoked")),
        str(value.get("ocrRasterizerVersion", "not-invoked")),
    )


def _normalize_text(text: str) -> str:
    return " ".join(text.casefold().split())


def _bbox_iou(left, right) -> float:
    x0 = max(left[0], right[0])
    y0 = max(left[1], right[1])
    x1 = min(left[2], right[2])
    y1 = min(left[3], right[3])
    intersection = max(0.0, x1 - x0) * max(0.0, y1 - y0)
    left_area = max(0.0, left[2] - left[0]) * max(0.0, left[3] - left[1])
    right_area = max(0.0, right[2] - right[0]) * max(0.0, right[3] - right[1])
    union = left_area + right_area - intersection
    return intersection / union if union > 0 else 0.0


def _canonical_json(value) -> bytes:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
