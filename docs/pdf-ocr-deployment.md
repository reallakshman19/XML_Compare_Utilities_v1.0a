# PDF OCR deployment boundary

## Runtime decision

The controlled OCR layer is optional and page-scoped. Python PDF/OCR dependencies are pinned in `requirements-pdf.txt`; Tesseract remains an explicit system/container dependency.

Qualified local runtime used for the real smoke fixture:

```text
pypdfium2 5.8.0
Pillow 12.3.0
tesseract 5.5.0
```

Package metadata in the qualification environment reports pypdfium2 as BSD-3-Clause / Apache-2.0 plus bundled dependency licenses, Pillow as MIT-CMU, and the Debian Tesseract package as Apache-2.0. Deployment images should pin the exact Tesseract package/build and traineddata set they ship.

## Why a system Tesseract boundary

The implementation invokes `tesseract` directly without a shell and consumes TSV output. This keeps command construction small, permits a hard subprocess timeout, avoids an additional Python wrapper dependency, and makes the actual engine version observable. Trained language data remains a deployment concern; `--ocr-language` is recorded in canonical options.

## Resource model

Before rasterization, scale is clamped by both a per-page pixel budget and a peak working-set estimate of 10 bytes per pixel. The estimate intentionally exceeds the final 4-byte RGBA buffer to account for concurrent render/image/encoding allocations. Post-render dimensions are checked again. Job-level limits cap OCR page count and cumulative pixels.

Defaults:

```text
requested scale        2.0
max pixels/page        16,000,000
peak memory/page       64 MiB
max OCR pages/job      100
max OCR pixels/job     250,000,000
Tesseract timeout      60 s/page
confidence minimum     0.70
warning confidence     0.85
```

## Determinism boundary

When OCR is invoked, Tesseract and pypdfium2 versions are included in evidence and the canonical options hash. Changing the OCR engine, rasterizer, language, confidence threshold, scale/budgets, or timeout changes conversion identity. When `auto` decides OCR is not needed, engine/rasterizer versions are recorded as `not-invoked`, so machines with different optional OCR installations still produce the same native-only identity.
