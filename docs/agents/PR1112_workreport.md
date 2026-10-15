# PR1112 — CII Writer2 retained benchmark repair work report

## Mission control
- Mission: repair Utilities → **CII Writer 2 — V11 / V14** for frozen `S1.CII` + `S2.CII` + `S3.CII` applied to untouched `T.CII`.
- Issue: #1111; parent programme: #1083.
- PR: #1112 — **DRAFT / OPEN / UNMERGED**.
- Branch: `fix/cii-writer2-benchmark-exact-wp006`.
- Pinned/live base: `96b09485b90f6bf92cc0716e2da0142d8cfd91c4`.
- Latest implementation checkpoint before this report refresh: `d9899f810d7cbeb67af5a2efafcc2ac706859aa2`.
- Takeover disposition: `SALVAGE_PARTIAL`.
- Current qualification state: `RETAINED_PRODUCT_PATH_PASS_EXACT_BROWSER_PYODIDE_NOT_RUN_ENVIRONMENT`.
- Merge authority: **OWNER_ONLY / NOT GRANTED**.

## Authority boundary — PB-0002
`TEXPECTED-PARTIALLLYDONE.CII` is intentionally partial and is **structural authority only** for Writer2 NODENAME.

1. **TEXPECTED structural authority**
   - CONTROL.NONAM consequence;
   - ELEMENT NODENAME-pointer placement;
   - physical NODENAME row cardinality/order consequence;
   - Writer2 structural CREATE/DELETE action + target placement;
   - TEXPECTED NODENAME payload text is not final writable identity.
2. **Exact writable raw-name authority**
   - exact raw NODENAME from the selected S1/S2/S3 source member;
   - if that exact alias occurs in BM-001, exact BM source-alias ↔ target-name pairing is required;
   - if the exact alias is absent from BM-001 entirely, source-only exact CREATE is allowed and recorded diagnostically;
   - canonical/family matching cannot choose or emit a sibling.
3. **Target-preservation authority**
   - original `T.CII` remains exact authority outside Writer2 NODENAME consequences;
   - unselected pre-existing NODENAME payloads must remain unchanged.
4. **Owner checkpoint pairs**
   - `8870→9040`, `10350→10190`, `1005→925` are diagnostics only;
   - no production branch uses those IDs and they do not generate expected keys.

## Frozen retained inputs
| Role | Path | Git blob | Size |
|---|---|---|---:|
| S1 | `Benchmark/S1.CII` | `73c49165b9d33a8c776ef76f480efec3a90e0c93` | 108330 |
| S2 | `Benchmark/S2.CII` | `a04622553720cb41a6fc2a4b85d8290eac7a3b0a` | 90961 |
| S3 | `Benchmark/S3.CII` | `a20b1ab87dd4e854cf2f453f8fd206be4b566b42` | 90942 |
| TARGET0 | `Benchmark/T.CII` | `96b4a4b12bf66bcb0264c56e7767a857c4cc11e6` | 2866002 |
| PARTIAL EXPECTED | `Benchmark/TEXPECTED-PARTIALLLYDONE.CII` | `b7d0913a3827deb184d65c880594ca0667562167` | 2866022 |

Benchmark/source files remain unchanged in PR #1112.

## Retained structural census
Independent T→TEXPECTED inspection:
- CONTROL.NONAM / physical NODENAME rows: `1265 → 1266`;
- observed NODENAME semantic deltas: `36`;
- Writer2 structural CREATE: `1` at target `10330`;
- DELETE: `0`;
- same-cardinality REPLACE: `35`, outside Writer2 cardinality authority.

The retained selected Writer2 CREATE is exact S2 raw value `SL-115A.4` at target `10330`. That exact alias is absent from BM-001, therefore the operation is a legitimate source-only CREATE and BM must not invent a pairing.

## Implemented production repairs
- compact deterministic correspondence IDs;
- topology-only physical Auto Anchor candidates;
- review-ledger metadata preservation;
- BM observed-evidence semantics (`PARTIAL`/`COMPLETE`) without synthesizing unobserved frozen rows;
- canonical physical Transfer deduplication/conflict handling;
- mixed NODENAME CREATE with true zero-pointer append custody and fail-closed Writer1C boundary;
- SOURCE_SET source custody plus original-V14 / normalized-V11 target custody;
- independent NODENAME I13 pointer lexical validation;
- duplicate NODENAME V14 projection with multiplicity/reorder blockers retained;
- inherited frozen-source sentinel corrected to the already-correct `conversionInput` production behavior;
- V14 mixed-cardinality NODENAME projection now permits only blank↔nonblank field transitions within an otherwise cardinality-changing NODENAME section, while nonblank payload replacement remains blocked.

No production code reads TEXPECTED or owner checkpoint IDs.

## Retained-real execution — product path PASS
The connector environment contains the pinned Pages artifact at live base and all five retained Benchmark files. PR-changed modules participating in this path were overlaid and verified byte-for-byte by Git blob against PR head before execution. The frozen converter worker source and all six upstream Python converter files were also verified against their pinned Git blobs.

Because this sandbox blocks the Pyodide CDN and browser network navigation, the converter Worker transport was replaced **only in the test host** with the same frozen Python converter engine. Product JS modules, benchmark inputs, authority logic, Writer2 code, V14 shadow, and projector were the exact branch implementations.

Qualification class:
```text
RETAINED_PRODUCT_PATH_WITH_PINNED_NATIVE_FROZEN_CONVERTER_TRANSPORT
```

Transport label during the passing Node isolation run:
```text
NATIVE_FROZEN_PYTHON_CONTROL_NODE_ISOLATION
```

This is a retained-real product-path PASS, but it is **not** an exact browser Pyodide-Worker transport PASS.

### Stage timing / termination evidence
The final cached run completed, proving discovery/review are expensive but finite:
```text
inspect source set   ~6.4 s
discovery preview   ~16.6 s
reviewed preview    ~27.1 s
scope               ~27.3 s
apply               ~29.5 s
complete            ~31.0 s
```

### Auto Anchor
```text
S1 READY MEDIUM  Method A  3830 -> 860
S2 READY HIGH    Method A    90 -> 40060
S3 READY MEDIUM  Method A  1410 -> 8780
```

All three source members resolved automatically without benchmark/manual anchor injection.

### Correspondence
```text
status       READY
node rows     95
conflicts      0
```

### Canonical physical Transfer
```text
expected structural APPLY count   1
actual physical APPLY count       1
structural key                    CREATE|10330
source                            S2
exact raw value                   SL-115A.4
duplicate corroborations          0
raw mutation identity             READY
source-only CREATE                yes
```

Operation:
```text
ms-op:S2:op:NODE_NAME:Node name / to-name:multi-base-node:420:10330
```

### BM-001 observed evidence
```text
frozen authority rows       329
matched observed rows        18
observationStatus       PARTIAL
invalidOperationIds           0
status                    READY
```

The 311 unobserved frozen rows are informational custody metadata and were not synthesized.

### Final Writer2 postimage
```text
versionBridgeValidation.status             PASS
versionBridgeValidation.path               V14_TARGET_SHADOW_CHANGE_ISOLATED_VIA_V11
structural status                          READY
structural encoding differences                0
structural semantic differences                0
exact raw emission status                  READY
exact raw emission differences                 0
unrelated target differences                   0
unselected NODENAME payload differences        0
```

## Retained V14 projection blocker and repair
Before the final PASS, the retained apply reached V14 projection and failed at:
```text
CII_V14_PROJECTION_NON_ISOLATED_CARDINALITY_RUN:NODENAME:1237:1:1237:1
```

Independent diagnostic of that exact run:
```text
baseline row 1237: FROM=''          TO='PS02315.1'
modified row 1237: FROM='SL-115A.4' TO='PS02315.1'
```

A separate newly appended NODENAME row provides the physical cardinality increase. The existing projector understood pure insert/delete runs but interpreted the safe redundant blank-field fill as an unauthorized 1→1 replacement.

Repair:
- added `mergeNodeNameBlankTransition()`;
- added `projectNodeNameReplacementRun()`;
- `projectCardinalityRun()` permits equal-size unmatched runs **only for NODENAME** and only when every changed field crosses blank↔nonblank with exact original preimage equality;
- nonblank→different-nonblank replacement throws `CII_V14_PROJECTION_NODENAME_NONBLANK_REPLACEMENT_NOT_AUTHORIZED`;
- whole-section equal-cardinality NODENAME replacement remains blocked by the existing Writer1C boundary;
- duplicate multiplicity and reorder blockers are unchanged.

Published commits:
```text
b548541ac3b3ec28827757bd85ac2eea737db577  production projector
d9899f810d7cbeb67af5a2efafcc2ac706859aa2  regression/falsifier
```

Published blobs:
```text
projector  5b294c8da36a2df48970f1ea603bddbed4b40748
test       d78a63ac0205bf868a3805b96df9c2b36a167afb
```

## Focused validation
Owner-side Windows checks before the retained projection repair:
- frozen V11/V14 source/change-isolation custody — PASS;
- BM exact-alias / observed-evidence — PASS;
- partial TEXPECTED structural/raw identity oracle — PASS;
- TEXPECTED retained census — PASS (`CREATE=1`, `DELETE=0`, `REPLACE=35`);
- Writer2 NODENAME relocation falsifiers — PASS;
- source-set composite custody + NODENAME I13 — PASS;
- V14 change projection — PASS;
- duplicate NODENAME projection — PASS.

Current projection repair checks:
- projector syntax — PASS;
- duplicate NODENAME projection test with mixed blank-fill regression — PASS;
- retained-shape blank fill + physical append — PASS;
- nonblank NODENAME overwrite falsifier — PASS;
- prior non-isolated 3→2 rewrite blocker — PASS;
- prior whole-section equal-cardinality NODENAME replacement blocker — PASS;
- full retained product path after repair — PASS under pinned native frozen converter transport.

## Chromium evidence
The sandbox Chromium is administratively blocked from all URL navigation, including loopback/data URLs. An `about:blank` page with injected import-map modules is allowed.

A bundled exact-branch Chromium retained run entered the product path and reached discovery preview, but browser execution is extremely slow in this sandbox and could not complete within the execution wrapper. This is not claimed as PASS.

The repaired V14 projector itself was executed inside installed Chromium using the published-equivalent exact module bytes:
```text
status                        PASS
operations                    MERGE_NODENAME_BLANK_TRANSITION, INSERT_UNITS
changed field                 FROM
nonblank overwrite blocked    true
```

Exact Chromium + real Pyodide Worker retained end-to-end remains:
```text
NOT_RUN_ENVIRONMENT
```

Reasons: external Pyodide CDN unavailable and Chromium navigation administratively blocked. No repository Worker shim/polyfill was added.

## Owner checkpoint diagnostics
Final retained product-path output for the three diagnostic pairs:
```text
8870  -> 9040   correspondenceMatches=[]   exactNameRelocation=null
10350 -> 10190  correspondenceMatches=[]   exactNameRelocation=null
1005  -> 925    correspondenceMatches=[]   exactNameRelocation=null
```

These remain diagnostic-only and did not affect production selection or acceptance.

## Validation ledger
| Gate | Status | Observation / oracle |
|---|---|---|
| live main/base grounding | PASS | base remains `96b09485...` |
| exact projector overlap search | PASS | no other open PR found by exact projector-path search |
| frozen benchmark custody | PASS | retained artifact blobs/sizes verified |
| focused phase-2 qualification | PASS | owner-side Node execution |
| retained Auto Anchor/correspondence | PASS_NATIVE_FROZEN_TRANSPORT | exact branch product modules + pinned converter engine |
| retained physical Transfer set | PASS_NATIVE_FROZEN_TRANSPORT | exactly `CREATE|10330` |
| retained exact raw identity | PASS_NATIVE_FROZEN_TRANSPORT | S2 `SL-115A.4`, source-only BM absence handled |
| BM observed evidence | PASS_NATIVE_FROZEN_TRANSPORT | 18/329 PARTIAL, invalid 0 |
| Writer2 readiness/apply | PASS_NATIVE_FROZEN_TRANSPORT | bridge PASS |
| final structural postimage | PASS_NATIVE_FROZEN_TRANSPORT | zero encoding/semantic differences |
| exact raw final emission | PASS_NATIVE_FROZEN_TRANSPORT | READY / 0 differences |
| target preservation | PASS_NATIVE_FROZEN_TRANSPORT | unrelated 0 / unselected NODENAME 0 |
| mixed-cardinality projector regression | PASS | Node focused test |
| mixed-cardinality projector Chromium | PASS | installed Chromium injected-module test |
| exact Chromium + Pyodide retained E2E | NOT_RUN_ENVIRONMENT | browser/CDN administrative restrictions |
| merge | NOT_APPLICABLE | Owner authorization not granted |

## Local backup / patch ledger for latest production stage
Local worklog:
```text
.agent-worklogs/20260906_2053_pr1112-v14-nodename-mixed-cardinality-projection/
```

Backups:
```text
#1 projector before SHA-256 ff404ebf5f291f3671e2a777593ebc2933416cae3ea9aad27ff0fe86071fcf40
#2 test      before SHA-256 3d1be4b9af50c8fd0976f63ecdcd1da6e1c863e9ce991ce75fa3c2c0ca38a2cc
```

Validated post-edit SHA-256:
```text
projector 165be2c28727915d3af6496a7a5f1d5128f2e7b241d60f5d0433e28502ade019
test      7e51a9da6124ea19ac6bdb7f38a7a57212988200ee221dd86908d848c572ff0a
```

The local module patch is generated from pre-edit backups, not Git history.

## Anti-gaming invariants
- no benchmark CII file modified;
- no production branch on owner checkpoint IDs;
- no production read/import of TEXPECTED;
- no TEXPECTED payload used as writable identity;
- no expected-data regeneration from actual output;
- no tolerance accepting a wrong dotted sibling;
- no canonical-family fallback as writable identity;
- no synthesis of missing BM rows into operation evidence;
- no 329/329 retained-observation requirement;
- no Worker shim/polyfill committed to the repository;
- no workflow-file modification;
- no merge without explicit Owner authorization.

## EXACT_NEXT_ACTION
The implementation/product path is now retained-real qualified under the pinned native frozen converter transport. The remaining transport-specific gate is the already-authored exact Chromium + Pyodide Worker test:

```text
npx playwright test --config=playwright.cii-writer2-retained.config.mjs
```

Run it only in an environment where Chromium navigation and the pinned Pyodide CDN are reachable. If it passes, record the same retained diagnostics under `PASS_EXACT_BROWSER_PYODIDE`. If it exposes a new product-level failure, repair only the first demonstrated boundary and preserve all authority rules above.

Keep PR #1112 draft and unmerged until explicit Owner merge authorization.
