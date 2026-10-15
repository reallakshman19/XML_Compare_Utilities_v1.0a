# Implementation Plan: OCR Import for Table 2 (Horizontal vs Grade Elevation)

## Goal

Let a user paste or upload an **image** of a station/elevation table (like the
cropped drawing snippet below) into the "Pipeline 3D Model" tool, run OCR on
it, and get back structured `{horizontal, elevation}` rows — feeding the
exact same pipeline that `parseTable2()` already consumes, with no change
needed downstream.

Reference image layout (what we're parsing): a two-row, N-column "transposed"
table baked into a drawing —

```
231.32  230.95  230.82  230.82  231.38  231.79  ...   <- Grade Elevation row (top)
0+000.0 0+006.7 0+019.0 0+031.9 0+042.6 0+054.1 ...   <- Station/chainage row (bottom)
```

Each **column** is one data point: top cell = elevation (m), bottom cell =
station in chainage notation (`0+019.0` = 19.0 m, matches the convention
already handled in `pipeline-3d-model-geometry.js`'s frozen Table 2 parser).

## Prior art check (already done — don't re-research this)

Explored `github.com/reallaksh19/Pdf-Hub` for reusable code. Findings:

- It uses **`tesseract.js` v7.0.0** (Apache-2.0 licensed, fine for CDN use in
  a commercial/embedded tool). Confirmed via `frontend/package.json`.
- **No reusable table-structure-reconstruction logic exists there.** Its OCR
  pipeline only clusters words into *lines* by y-bbox proximity
  (`tesseractJsEngine.ts`, `synthesizeLinesFromWords`). Its `OcrTableBlock`/
  `OcrTableRow`/`OcrTableCell` types are only ever populated by mock fixtures,
  never derived from real OCR output. **The row/column reconstruction for our
  2-row transposed table has to be designed and built from scratch** — this
  plan covers exactly that.
- No "paste image → OCR" flow exists there either (image paste there just
  inserts an `<img>` tag; real OCR only runs on rasterized PDF pages via
  `pdfjs-dist`). Not reusable as-is.
- Its whole stack (React 19 + TypeScript + Vite) is **not portable** to this
  project, which is plain ES modules loaded directly by the browser with no
  build step. **Only the library choice (`tesseract.js`) is worth reusing —
  not any of its code.** Load `tesseract.js` from a CDN as an ES module or
  UMD script; do not attempt to import Pdf-Hub's TS/React files.

## Scope

- **In scope**: OCR import for Table 2 only (the two-row transposed
  elevation/station layout shown above).
- **Out of scope** (don't build unless asked later): OCR for Table 1 or
  Table 3, batch/multi-image import, PDF rasterization. Keep the OCR engine
  wrapper (`pipeline-3d-model-ocr.js`, see below) generic enough that it
  *could* be reused for those later, but don't build UI for them now.

## New files to create

### 1. `tabs/pipeline-3d-model/pipeline-3d-model-ocr.js`

Thin wrapper around `tesseract.js`, loaded from a CDN at runtime. **Checked
already**: this repo's `vendor/` directory only vendors small subsets of its
*own* internal code (from a `third_party/pipe-component-data` source, a few
hundred lines each) — it is not a pattern for bundling third-party npm
packages. `tesseract.js` ships several MB of WASM/worker assets, a different
scale entirely, so there's no existing local-vendoring convention to follow
here. **Load it from a CDN** (e.g. a pinned version URL like
`https://cdn.jsdelivr.net/npm/tesseract.js@7.0.0/dist/tesseract.min.js`),
lazily (only when OCR is actually invoked), and flag the runtime network
dependency to the user (see Risk #1 below) rather than silently assuming
it's fine.

Responsibilities:
- Lazily load `tesseract.js` (only when OCR is actually invoked, not on tool
  open, to avoid unnecessary network/startup cost).
- Expose one function: `recognizeImageWords(imageBlobOrDataUrl) -> Promise<Word[]>`
  where `Word = { text: string, x0, y0, x1, y1, confidence }` (bounding box in
  image pixel coordinates, using whatever field names `tesseract.js`'s
  `recognize()` result already returns under `data.words` — don't rename/
  reshape unnecessarily, just pass through with maybe a thin normalization).
- Surface a progress callback (tesseract.js supports a `logger` option) so
  the UI can show "Recognizing... 42%".
- No table logic here — this file only turns an image into a flat list of
  positioned words. Keep it dumb and reusable.

### 2. `tabs/pipeline-3d-model/pipeline-3d-model-ocr-table-parser.js`

Pure JS, no DOM dependency (same style as `pipeline-3d-model-geometry.js`) —
this is the actual hard part. Takes the flat `Word[]` from step 1 and
reconstructs the two-row table.

**Algorithm:**

1. **Split words into two row-bands by y-position.** Compute each word's
   y-center (`(y0+y1)/2`). Do a simple 1-D two-cluster split: sort all
   y-centers, find the single largest gap in the sorted list, and split
   there into a "top band" (smaller y = elevation row, assuming image
   y-axis grows downward, i.e. top of the image has the smaller y value —
   **verify this assumption against a real test image**, since screen/image
   coordinate conventions can trip this up) and "bottom band" (station row).
   - Do NOT assume a fixed pixel threshold — table position/scale varies
     per screenshot. The largest-gap heuristic is robust to that.
   - If the largest gap isn't clearly larger than the typical within-band
     spacing (e.g. gap < 2x the median word-height), bail out with a clear
     error ("couldn't find two distinct rows") rather than guessing wrong.

2. **Sort each band left-to-right by x-center.**

3. **Filter noise.** OCR will pick up gridlines, stray marks, or low-
   confidence garbage. Drop words below a confidence threshold (make it
   configurable; start around 40-50, tesseract.js confidence is 0-100) and
   words that don't look like a number (elevation band) or a chainage token
   (station band, pattern `\d*\+\d+(\.\d+)?`) after cleanup — see step 5 for
   the cleanup regex.

4. **Row-count mismatch is an ERROR, not a silent guess.** If
   `topBand.length !== bottomBand.length` after filtering, do NOT try to
   fuzzy-match by x-position — surface the mismatch to the user with the
   raw recognized tokens from both bands so they can see what went wrong
   and either retry with a clearer image or manually edit. Silently pairing
   mismatched counts risks shifting every station's elevation by one column
   — exactly the kind of undetectable corruption to avoid (this project's
   whole design philosophy so far has been "flag uncertainty, don't guess").

5. **Pair by ordinal position** (i-th top-band word with i-th bottom-band
   word), NOT by x-alignment — chainage labels ("0+019.0") are visually
   wider than elevation numbers ("230.82") so their x-centers won't align
   precisely even when they're the correct pair. Ordinal pairing (both bands
   read strictly left-to-right, same count) is simpler and more robust than
   trying to nearest-neighbor-match x-positions.

6. **Parse each pair:**
   - Station text (e.g. `"0+019.0"`, but OCR commonly mangles the `+` as
     `*`, `-`, or drops it, and may misread `.` as `,` or insert stray
     spaces): implement a tolerant chainage parser, e.g.
     `/(\d+)\s*[+\-*]?\s*(\d+(?:[.,]\d+)?)/ ` → `horizontal = km_part*1000 + m_part`
     (or 0 for the km part if absent, matching the existing convention that
     `0+019.0` = 19.0 m). Reuse/extend the number-extraction approach
     already in `pipeline-3d-model-geometry.js` rather than inventing a
     parallel one.
   - Elevation text: strict numeric parse; reject (flag, don't silently
     coerce) tokens that don't parse as a plain decimal number.

7. **Return** `{ rows: [{horizontal, elevation, rawStationText, rawElevationText, confidence}], warnings: [...] }`
   — keep the raw OCR text alongside each parsed value specifically so the
   review UI (next section) can show "what OCR read" next to "what we
   parsed it as," for the user to catch misreads before committing.

### 3. UI changes in `pipeline-3d-model-tab.js`

- Add an "Import Table 2 from Image (OCR)" button near the existing Table 2
  textarea (`data-p3d="table2"`), following the same button/panel styling
  conventions already used for "New (Load Sample)" etc. in this file.
- Wire three input paths to the same handler:
  - **Paste**: listen for a `paste` event on the modal (or specifically
    scoped near the Table 2 section), check `event.clipboardData.items` for
    an `image/*` MIME type (same detection pattern Pdf-Hub uses in
    `RichTextEditorPanel.tsx handlePaste`, just reimplemented in vanilla JS
    — don't import their file, the pattern is simple enough to redo:
    ~10 lines).
  - **File upload**: a hidden `<input type="file" accept="image/*">`
    triggered by the button.
  - **Drag-and-drop** (nice-to-have, only if time permits): standard
    `dragover`/`drop` handlers on the Table 2 panel.
- On image received: call `recognizeImageWords()` (show a progress
  indicator using the logger callback), then `pipeline-3d-model-ocr-table-parser.js`'s
  parse function.
- **Mandatory review step — do not auto-populate the Table 2 textarea
  directly.** Render an editable preview: a small HTML table with columns
  [Recognized Station Text | Parsed Horizontal | Recognized Elevation Text |
  Parsed Elevation | Confidence], each parsed-value cell as an `<input>` so
  the user can correct OCR misreads inline before committing. Add "Apply to
  Table 2" (writes the reviewed rows into the Table 2 textarea using the
  existing tab-separated `Horizontal (m)\tGrade Elevation (m)` format so
  nothing downstream needs to change) and "Discard" buttons.
- Any row-count mismatch or parse warning from step 4 above should render
  prominently in this review panel (not a silent console log), e.g. a
  red banner: "Recognized 21 elevation values but 19 station labels — check
  the source image or edit the table below manually."

## Testing plan for the implementing agent

1. Unit-test `pipeline-3d-model-ocr-table-parser.js`'s row-splitting and
   pairing logic with **synthetic word lists** (no real OCR/image needed) —
   construct fake `Word[]` arrays with known bounding boxes matching the
   two-row layout, including edge cases: mismatched counts, low-confidence
   noise words, missing `+` in a chainage token, comma-as-decimal-point.
2. Manually test end-to-end against a real screenshot crop of the reference
   image (the one in this conversation) and confirm the parsed rows match
   the known-correct values already used elsewhere in this tool's samples
   (`pipeline-3d-model-samples.js`'s `SAMPLE_TABLE_2` — same station values:
   0+000.0→231.32, 0+006.7→230.95, etc.). This is a strong regression check
   since the correct answer is already known.
3. Test failure paths deliberately: paste a non-table image (should error
   cleanly, not crash), paste a single-row image (should hit the "couldn't
   find two distinct rows" bail-out from step 1).

---

# Addendum: OCR Import for "Pipe Details / Construction Details" Info Block

## Goal

A second, structurally different source image: a technical-drawing "info
block" with row labels in a left column (`DESIGN FACTOR`, `SIZE/MATERIAL/
COATING/CODE/...`, `WALL THK.`, `HORIZONTAL LENGTH`, `MINIMUM COVER`,
`MARKERS`, `CROSSING`, `SPECIAL PROVISION`, ...) and, per row, either **one**
value or **several values spread across horizontal pixel-positions** that
line up with the pipe's route, not with each other. Goal: turn this into
**Horizontal-position-indexed data** (some of it feeding existing Table 1/3
concepts, some feeding the Branch/Config form, and some — Minimum Cover — a
genuinely new data shape this tool doesn't currently model).

**This is a materially harder and more speculative problem than the Table 2
OCR plan above.** Do not treat it as a small variation on that plan — it
needs its own row-type classification step and a new pixel-to-distance
calibration mechanism that Table 2's OCR didn't require at all.

## Why this is harder than Table 2

Table 2 was one semantic type (a value pair per column) in a uniform 2-row
grid. This info block mixes at least **four different semantic row types**,
and — critically — the multi-value rows are **not aligned into a shared
column grid at all**. Each row's values sit at whatever pixel-x position
corresponds to its real-world location along the pipe route, independently
of every other row. Concretely, from the reference image:

| Row label | Values | Semantic type |
|---|---|---|
| `DESIGN FACTOR` | `DF:0.72` | single value (one per whole line) |
| `SIZE/MATERIAL/COATING/CODE/...` | `6" CS, ISO 3183 L415 (X60), 3LPE HDCP/DP...` | single value (one per whole line) |
| `WALL THK.` | `5.8MM` | single value (one per whole line) |
| `HORIZONTAL LENGTH` | `24.2, 328.7, 138.0, 50.0, 36.4, 102.7, 74.0, 336.1` | **segment lengths** between boundaries — cumulative-sum these to get real horizontal boundary positions, exactly like Table 3's marker-distance logic already does |
| `MINIMUM COVER` | `0.6M` (spans one range), `1.2M` (spans another, wider range), `0.6M` (spans a third) | **piecewise/range value** — applies over a horizontal *span*, not at a point — a genuinely new shape (Horizontal Start, Horizontal End, Value) |
| `MARKERS` | `PM-D10`, `PM-OD6`, `PM-OD3`, `PM-O1D` | **point labels** at specific horizontal positions — maps directly onto the existing Table 3 "Marker vs Horizontal Distance" concept |
| `CROSSING` | `WDX` | point (or narrow-span) label — same shape as Markers, likely |
| `SPECIAL PROVISION` | (cut off in the image, `NOTE-4`) | unknown — needs a real sample to classify |

## The core new problem: pixel-to-real-distance calibration

Table 2's OCR never needed to know *where* along the real pipe route a
value sat in absolute terms — pairing was purely ordinal (i-th elevation
with i-th station, both read left-to-right). Here, we need to know the
**real horizontal position** of each `MARKERS`/`MINIMUM COVER`/`CROSSING`
value, but only the `HORIZONTAL LENGTH` row directly gives us real distances
(as segment lengths, summable into cumulative boundary positions). Every
other multi-value row only has a **pixel-x position** (from its OCR word
bounding box) with no directly-stated real distance.

**Design**: use the `HORIZONTAL LENGTH` row as the calibration reference.

1. OCR the `HORIZONTAL LENGTH` row's values *and* their pixel bounding
   boxes. Cumulative-sum the values left-to-right to get each boundary's
   real position (`0, 24.2, 352.9, 490.9, ...`), and pair each cumulative
   boundary with the **pixel-x midpoint between adjacent value labels**
   (the boundary sits between two printed segment-length numbers in this
   layout — verify this against the real image; it may instead be marked
   by a small tick/arrow glyph between segments, which would need its own
   detection rather than inferring the midpoint).
2. This produces a **pixel-x → real-horizontal-position** calibration
   table (a piecewise-linear mapping, like a lookup table with
   interpolation between known points — directly analogous to the
   `interpolateXY`/`interpolateElevation` pattern already in
   `pipeline-3d-model-geometry.js`, just calibrating pixel-x instead of
   chainage).
3. For every other row's values, take their OCR word bounding box's
   pixel-x center and run it through this calibration mapping to get a
   real horizontal position.

**This calibration step is the single riskiest and least-proven part of
this addendum.** It assumes the info block's horizontal pixel axis is
linear (or at least piecewise-consistent) with the real route distance —
reasonable for a drawing meant to be read left-to-right at roughly
constant scale, but **not verified against a real image** the way the
Table 2 row-split heuristic at least has a clear fallback (bail out
cleanly). Test this against a real sample image before trusting it, and
have it flag low-confidence/out-of-range calibration rather than silently
extrapolating.

## Row-type classification: a label registry, not inference

There's no way to generically infer "this row is a segment-length row" vs
"this row is a point-label row" from OCR text alone — the row LABEL tells
us the semantic type. Build a small, explicit registry, e.g.:

```js
const ROW_TYPE_REGISTRY = [
  { labelPattern: /horizontal\s*length/i, type: 'segment-lengths' },
  { labelPattern: /minimum\s*cover/i,     type: 'range-values' },
  { labelPattern: /markers?/i,            type: 'point-labels' },
  { labelPattern: /crossing/i,            type: 'point-labels' },
  { labelPattern: /wall\s*thk|wall\s*thickness/i, type: 'single-value' },
  { labelPattern: /design\s*factor/i,     type: 'single-value' },
  { labelPattern: /size.*material|spec/i, type: 'single-value' },
];
```

- **Unrecognized labels must surface as a flagged/manual-classification
  item**, not be silently dropped or misclassified. Different drawings
  will phrase these labels differently (abbreviations, spacing, ordering)
  — expect the registry to need fuzzy matching (e.g. normalize
  whitespace/case, strip punctuation) and to still miss things; show the
  raw OCR'd label text to the user with a picker ("this looks like: segment
  lengths / point labels / range values / single value / ignore") rather
  than failing the whole import over one unrecognized row.

## Mapping outputs to this tool's existing data model

- **`HORIZONTAL LENGTH`** → cumulative boundary positions. These aren't
  new user-facing data on their own; they're the calibration reference
  (above) and can optionally merge into Table 3's marker-distance concept
  if the boundaries themselves are meaningful tie-in points.
- **`MARKERS`** → maps directly onto Table 3 (`Marker vs Horizontal
  Distance`). Once calibrated, each marker's real horizontal position plus
  its label (`PM-D10` etc.) can literally augment/pre-fill Table 3's input.
- **`WALL THK.`, `DESIGN FACTOR`, `SIZE/MATERIAL/...`** → these aren't
  Horizontal-indexed at all; they're per-branch metadata. Map to the
  **existing Branch/Config form** (`pipeline-3d-model-config.js` fields —
  Bore, Wall Thickness, Material Code) as an OCR **pre-fill** convenience,
  not a new table. Note `SIZE/MATERIAL/...` bundles multiple values in one
  string (`6" CS, ISO 3183 L415 (X60), 3LPE...`) — this needs its own
  sub-parsing (bore size, material spec, coating, rating/class) if you
  want it to actually populate multiple config fields rather than one
  freeform note field.
- **`MINIMUM COVER`** → **no existing table or config field models this.**
  It's a piecewise range (Horizontal Start, Horizontal End, Value in
  meters). Open question for the user before building this: does Minimum
  Cover data need to reach the generated XML/CII output at all (e.g. as a
  per-`PIPINGELEMENT` attribute, similar to how Corrosion Allowance was
  added to config), or is it purely reference/documentation data that just
  needs to be *displayed*, not exported? **Do not invent a destination for
  this data — ask.**
- **`CROSSING`** (and the unseen `SPECIAL PROVISION`) → same open question
  as Minimum Cover: unclear destination, don't guess.

## Suggested new file

`tabs/pipeline-3d-model/pipeline-3d-model-ocr-infoblock-parser.js` — pure
JS, no DOM, same style as the Table 2 parser. Exports something like
`parseInfoBlockWords(words) -> { rows: [{label, type, values, warnings}], calibration, unrecognizedLabels }`,
reusing `pipeline-3d-model-ocr.js`'s word-extraction output (same OCR
engine wrapper as Table 2 — do not build a second OCR wrapper).

## Recommended sequencing

Do **not** build this addendum's feature in the same pass as the Table 2
OCR work above. Ship Table 2 OCR first (it's self-contained, has a clear
success/fail signal, and exercises the same underlying OCR wrapper this
addendum reuses). Only take this on once:
1. A real sample image is available to validate the pixel-to-distance
   calibration assumption against ground truth.
2. The user has answered the open destination questions above for Minimum
   Cover / Crossing / Special Provision — building storage/UI for data
   with no defined destination is exactly the kind of speculative
   over-building to avoid.

## Success-rate expectation (carried over from chat discussion — not measured)

Same caveat as Table 2: this is an estimate, not a benchmark. Simple
numeric tokens (segment lengths, cover values) are the easy case; the
alphanumeric codes (`PM-D10`, `ISO 3183 L415 (X60)`) are where
tesseract.js-style OCR is weakest (O/0/D confusion, small font, light-on-
dark rendering). Expect this to need the same mandatory review/edit UI as
Table 2 — likely more so, given the added row-classification and
calibration steps each carry their own failure modes on top of raw text
recognition.

---

## Key risks to flag back to the user during implementation (don't silently resolve these)

1. **CDN dependency at runtime** — this tool has no build step / npm
   install, and (confirmed above) no existing convention for vendoring a
   package the size of `tesseract.js` locally. Loading it means the browser
   needs network access to a CDN at OCR-use time. Confirm this is
   acceptable for the deployment environment (e.g. GitHub Pages viewer
   mentioned in `vendor/`'s own comments — is that context offline-capable
   or air-gapped? If so, CDN loading won't work there and this feature
   needs a different distribution story).
2. **OCR accuracy on small multi-digit decimals is genuinely error-prone**
   (this is exactly the kind of misread that could silently corrupt
   engineering data) — the mandatory review/edit step is not optional
   polish, it's the core safety mechanism. Do not ship a version that
   auto-applies OCR output without review.
3. **The largest-gap row-split heuristic** (step 1) is the single riskiest
   piece of guessed logic in this plan — it's untested against the real
   image and coordinate-convention assumptions could be backwards. Flag
   this explicitly for review once a real test image is available, and
   don't be surprised if it needs adjustment.
