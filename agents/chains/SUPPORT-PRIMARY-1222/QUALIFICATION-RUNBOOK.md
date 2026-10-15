# #1222 / PR #1223 — external qualification runbook

STATUS: READY_FOR_EXTERNAL_EXECUTION  
CHAIN_ID: SUPPORT-PRIMARY-1222  
BRANCH: `feature/support-primary-assembly-graph`  
PREPARATION_BASIS_HEAD: `2f73b560d1bc3befadb137d9de9b10f35f78714b`  
PRODUCT_MATERIAL_HEAD: `afcbc421006a50fbcf55b69a5292c0e1b49cf27d`  
QUALIFICATION_WORKFLOW_HEAD: `4e2b845f5fa44f14bb7efaebeb145194c80afc53`

This packet is the operator-facing handoff for the remaining governed qualification gates. It does not change product semantics or replace the workflow definitions. Run against the **exact live PR #1223 head at execution time** and record that SHA. If any production JS, benchmark, test, Playwright config, package lock, or qualification workflow has changed after the preparation basis, re-review that delta before treating results as qualification evidence.

## Result classification

- **PASS**: the governed command actually executed against the pinned checkout/input and every required assertion passed.
- **FAIL**: the governed command actually executed and a repository/product assertion failed. Preserve the failing output/artifacts; do not alter product algorithms until the failure is diagnosed.
- **NOT_RUN**: checkout/runner/dependency/input was unavailable or execution never reached the governed command. Infrastructure/input failures are not product failures.
- Do not use manually reconstructed, truncated, synthetic, or substituted ZIP/XML input for a real-input gate.

## 0. Pin the execution basis

From a clean trusted checkout:

```bash
git fetch origin feature/support-primary-assembly-graph
git checkout --detach origin/feature/support-primary-assembly-graph
git rev-parse HEAD
git status --short
node --version
git hash-object benchmarks/1884.zip
git hash-object benchmarks/1885.zip
```

Required benchmark blob identities:

- `benchmarks/1884.zip` -> `63acc3c0b413f6ee727189ec36d4b76fba44d73a`
- `benchmarks/1885.zip` -> `5f27f2d6736693eb21dc2e7981fecad22952819a`

Node must be 22.x. `git status --short` must be empty before qualification begins. Record the exact checkout SHA in the qualification receipt.

## 1. Hardened focused Node qualification

Execute the same focused surface as `.github/workflows/support-report-typicality-qualification.yml`:

```bash
node --test \
  tests/support-primary-*.test.mjs \
  tests/support-report-location-benchmarks.test.mjs \
  tests/support-report-location-attribution.test.mjs \
  tests/support-report-prev-name-semantics.test.mjs \
  tests/support-report-datum-metadata.test.mjs \
  tests/support-report-json-trace.test.mjs \
  tests/support-report-json-trace-ui.test.mjs \
  tests/support-report-pos-trace-remediation.test.mjs \
  tests/support-report-trace-export.test.mjs \
  tests/support-report-field-projection.test.mjs \
  tests/support-report-field-projection-rca.test.mjs \
  tests/support-report-typicality.test.mjs \
  tests/support-report-typicality-location.test.mjs \
  tests/support-report-typicality-sequence.test.mjs \
  tests/support-report-typicality-calibration.test.mjs \
  tests/support-report-typicality-projection.test.mjs \
  tests/support-report-typicality-export.test.mjs \
  tests/support-report-typicality-ui.test.mjs \
  tests/support-report-typicality-safety.test.mjs \
  tests/support-report-typicality-negative.test.mjs \
  tests/support-report-axis-consensus.test.mjs \
  tests/support-report-axis-typicality.test.mjs \
  tests/support-report-reference-relationship-integration.test.mjs \
  tests/support-report-relationship-typicality.test.mjs \
  tests/support-report-typicality-publication.test.mjs \
  tests/support-report-zone-scope.test.mjs
```

Acceptance: process exit 0 with no failed Node tests. Preserve stdout/stderr and the exact Node version.

Protected executable controls include, at minimum, PS-11167 `7 -> 6`, PS-11236 `-> 4`, PS-12060=1, PS-12877=4, orphan/traversal safety, independent relationship/axis channels, three-channel consensus, and final-`TYPICAL`-only Column 22 publication. These synthetic/unit controls supplement, not replace, the real benchmark/input gates below.

## 2. Real 1884 -> 1885 ZIP benchmark

Do not unzip/repack or otherwise recreate the repository ZIPs before the blob identity check above.

```bash
set -euo pipefail
rm -rf /tmp/typicality-1884 /tmp/typicality-1885
mkdir -p /tmp/typicality-1884 /tmp/typicality-1885
unzip -q benchmarks/1884.zip -d /tmp/typicality-1884
unzip -q benchmarks/1885.zip -d /tmp/typicality-1885
find /tmp/typicality-1884 -type f -iname '*.xml' -print | sort
find /tmp/typicality-1885 -type f -iname '*.xml' -print | sort

node tests/support-report-typicality-zip-benchmark.mjs \
  /tmp/typicality-1884 \
  /tmp/typicality-1885 \
  /tmp/typicality-1884-vs-1885.json

node tests/support-report-typicality-ambiguity-diagnostic.mjs \
  /tmp/typicality-1884 \
  /tmp/typicality-1885 \
  /tmp/typicality-1884-vs-1885.json

node tests/support-report-typicality-zip-relaxed-diagnostic.mjs \
  /tmp/typicality-1884 \
  /tmp/typicality-1885

node tests/support-report-typicality-selected-families.mjs \
  /tmp/typicality-1884 \
  /tmp/typicality-1885
```

Also execute the `Validate RCA regression controls` assertion block from `.github/workflows/support-report-typicality-zip-benchmark.yml` against `/tmp/typicality-1884-vs-1885.json`; that workflow file remains the canonical assertion definition for PS-10076, PS-10092, PS-10669, PS-10146, accepted structural comparisons, and the 351 final-family decision control.

For #1222 release evidence, capture the resulting Support Report/debug count evidence for the protected 1885 Owner oracles:

- PS-12060 = 1
- PS-12877 = 4
- PS-12860 = 6
- PS-12120 = 14

If the benchmark harness does not expose one of those four family counts, classify that oracle as **NOT_OBSERVED** rather than inferring PASS from unrelated tests. Do not synthesize missing evidence.

Acceptance: all ZIP workflow assertions and scripts exit 0, repository ZIP identities match, and the protected real 1885 counts are directly evidenced. Preserve `/tmp/typicality-1884-vs-1885.json` plus console output as artifacts.

## 3. Playwright browser qualification

From the same exact checkout:

```bash
npm ci
npx playwright install --with-deps chromium
npx playwright test --config=playwright.support-steel.config.mjs
```

Acceptance: Playwright exits 0. Preserve:

- `artifacts/support-steel-browser-results.json`
- `playwright-report/support-steel`
- `test-results/support-steel`

Required #1222 browser behaviors include:

- independent current/reference Primary Support relationship XML scoping;
- current and reference exact ancestry scope, with reference basis `REFERENCE_SUPPORT_REPORT_EXACT_ANCESTRY`;
- excluded-by-zone accounting on both sides;
- optional relationship inputs without stale-state leakage;
- multi-popup orphan configuration isolation;
- rebuild/cache invalidation safety;
- Column 22/23 publication behavior and Debug/audit export.

A browser opened against `main`, or against a different feature SHA, is not qualification of PR #1223.

## 4. Real 1835 Clash-within-Supports relationship qualification

This gate requires the **separate authoritative Owner relationship XML**. `benchmarks/1835.zip` contains only `1835.xml` and is not a substitute.

Before execution, record for the supplied relationship file:

```bash
sha256sum /absolute/path/to/OWNER-1835-RELATIONSHIPS.xml
wc -c /absolute/path/to/OWNER-1835-RELATIONSHIPS.xml
```

Run the Support Report using repository `benchmarks/1835.xml`/the governed 1835 Support Report input together with that exact relationship XML through the real current-side relationship path. Preserve Debug JSON/audit output.

Required real-input checks:

- PS-11167 final `TOTAL SUPPORT POINTS ON SECONDARY` = 6;
- PS-11236 final `TOTAL SUPPORT POINTS ON SECONDARY` = 4;
- explicit PS-11167 `.2 + .11` relationship resolves to one deterministic assembly where present in the Owner XML;
- PS-11236 DATUM/structural-reference evidence remains non-countable;
- relationship parser/scoping diagnostics show the supplied file was actually parsed and scoped rather than silently ignored.

If the Owner file does not contain the expected documented relationship evidence, preserve the parsed/scoped diagnostics and classify the oracle as a real-input **FAIL/REVIEW** based on observed data; do not modify the XML or fall back to synthetic evidence.

## 5. Evidence receipt

For each gate record:

- exact PR head SHA;
- UTC execution timestamp;
- environment/runner identity;
- Node version and browser/Playwright version where applicable;
- command/run ID;
- input blob/SHA-256 identities;
- exit status;
- PASS / FAIL / NOT_RUN classification;
- artifact/log location;
- protected-oracle observations.

A complete readiness review requires all four gates above to be resolved with real execution/input evidence. Until then PR #1223 remains `HOLD_DRAFT`. Mark-ready and merge are separate Owner-only transitions and require fresh explicit Owner authorization.