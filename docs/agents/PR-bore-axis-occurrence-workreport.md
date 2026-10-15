# Support Report bore-axis occurrence grouping

## Goal

Correct `TOTAL SUPPORT POINTS ON SECONDARY` so multi-member contacts can collapse into one physical support occurrence without collapsing genuine pipe revisits.

## Qualification targets

| Secondary support | Expected count |
|---|---:|
| PS-12060 | 1 |
| PS-12877 | 4 |
| PS-12860 | 6 |
| PS-12120 | 14 |

## Algorithm

- Preserve the existing 50 mm close-contact rule as the first spatial merge gate.
- Treat differing pipe `branchNode` identities as different traversals; they do not merge solely because their XYZ coordinates coincide.
- For contacts on the same traversal, derive nominal DN from the line-tag NPS using the existing Support Report NPS-to-DN mapping and apply:
  - axial tolerance = `4 * DN`;
  - lateral tolerance = `0.5 * DN + 25 mm`.
- Determine the branch-local pipe axis from all available clash points on the same line/branch:
  - two unique points use the direct two-point axis;
  - three or more points use a PCA principal axis;
  - PCA is trusted only when principal/residual variance ratio is at least 8;
  - otherwise the algorithm falls back to the existing 50 mm rule rather than forcing a bore-axis merge.
- Keep line-tag DN explicitly classified as derived (`LINE_TAG_DERIVED_DN`), not authoritative native `BORE` evidence.

## Audit fields

Location groups expose the grouping model, derived nominal DN, axial/lateral tolerances, axis basis and axis-confidence ratio in addition to the existing grouping basis.

## Human-readable Column 23 remarks

Typicality reason codes and audit records remain unchanged, but user-facing `PIPING SUPPORT ARRANGEMENT MATCH` wording is now generated separately:

- `MATCHED — Support arrangement matches PS-xxxxx.`
- `NOT MATCHED — Closest candidate PS-xxxxx was rejected: ... .`
- `AMBIGUOUS — N candidates remain: ... .`
- `LIMITED CHECK — Support type unavailable; topology-only comparison used.`
- `PARTIAL MATCH — Differences: ... .`
- `REVIEW — ... .`

The display layer no longer exposes internal labels such as `NO_MATCH: best ...` or `AMBIGUOUS MATERIAL`, while machine-readable status/reason codes remain available in the audit object.

## Column 22 axis-aware follow-on

GitHub issue #1179 now contains the implementation plan for reusing the refined branch-local pipe axis in `TYPICAL STRUCTURE (PS NO.)` identification. The planned signals are rigid-transform invariant: pipe-axis angle relationships, axis-relative axial/lateral spacing, and traversal topology. Raw global axis direction will not be compared across XMLs.

## Regression coverage

- Synthetic PS-12060 coordinates assert `.1/.2/.6` collapse to one occurrence with DN 250, axial tolerance 1000 mm and lateral tolerance 150 mm.
- Coincident contacts on different pipe traversals assert they remain separate.
- The real `benchmarks/1885.zip` archive is decompressed in the Node benchmark test with built-in `zlib`; the four owner counts are asserted directly from the production parser/grouping path.
- Existing PS-12154 and PS-12120 location controls remain in the focused qualification suite.
- Typicality projection tests lock the new human-readable Column 23 wording while leaving reason codes machine-readable.

## Qualification environment

The first GitHub Actions runs for this PR terminated before checkout with no runner steps (`steps=[]`, `runner_id=0`). This is treated as CI infrastructure unavailability, not a code/test result. The PR remains draft until the real ZIP-backed regression executes successfully.