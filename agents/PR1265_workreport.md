# PR1265 work report — authoritative coherent bounded preselection

## Mission

Implement #1263 / parent #1257 / programme #1256 using the final hosted #1262 SELECTED_RULE, superseding the quarantined PR #1260 stale-rule material without rewriting its active branch.

## Protocol / authority

- PROTOCOL_REF: `reallaksh19/Common@b47f16746a2f9029e7dcd7f523536046a847dc67:skills/engineering-pr-delivery-v3.2`
- authoritative design: #1262 issuecomment-6020813942
- design supersession: #1262 issuecomment-6020844009
- #1263 superseding plan: issuecomment-6020844684
- frontier reconciliation: #1263 issuecomment-6020878711
- merge authority: OWNER_ONLY / NOT AUTHORIZED

## Exact material basis

- PR: #1265 (OPEN / DRAFT / stacked on PR #1234)
- branch: `fix/cii-s1-coherent-preselection-1263-r2`
- exact base: PR #1234 head `b7fb3513eabbac786a7d095c1be96fcfbbcac8e6`
- old PR #1260: QUARANTINED / SUPERSEDED FOR R2.3
- old PR #1260 live material at recovery: `20b2fa0787f2cd9312ee0599257cbc73454705b5`

## Selected rule

```text
relativeError <= 0.001
AND sourceOdNormalizedDelta <= 0.1
AND SOURCE OD required

compatibility graph
→ deterministic bridge removal
→ connected components
→ complete components only
→ size >= 3
→ unique strongest component required
→ equal strongest => PRESELECTION_AMBIGUOUS / fail closed
→ READY component: choose up to K from that component only
→ no cross-component/isolated fill
→ NONE: preserve #1234 legacy bounded global spread
```

Candidate generation only. Method A remains geometry/qualification authority.

## Current implementation state

Authoritative R2.3 implementation is now complete at the product/test level.

Material frontier before this report refresh:
`53f1143cb7ef91203621f5bef6872df7b16f27f6`

Current blobs:
- selector: `ce3326a86f9e8fd88f26e583e27bf8147d0b39dd`
- canonical focused test: `0dd1b002b15e8b49e077f5091bf0ec3b29890b79`

Serial micro-child status:
- #1270 custody/authority lock: PASS
- #1271 strict pairwise metric: PASS
- #1272 bridge-pruned complete-component graph: PASS
- #1273 unique-region pool / ambiguity / legacy fallback: PASS
- #1274 full generic adversarial hosted execution: PASS
- #1275 exact-head qualification: NEXT / NOT_RUN

Implemented production behavior:

```text
relativeError <= 0.001
AND sourceOdNormalizedDelta <= 0.1
AND SOURCE OD required

compatibility graph
→ bridge removal
→ complete components only, size >= 3
→ unique strongest required
→ tie => PRESELECTION_AMBIGUOUS / empty physical pool
→ READY => choose <= K from winning component only
→ no outside fill
→ NONE => exact #1234 bounded global-spread fallback
→ unchanged discoverCiiMethodABases()
```

Candidate-generation only. No confidence or identity authority is assigned by the preselector.

## Changed-file ledger

| File | Planned role | Status |
|---|---|---|
| `tabs/cii-workspace/cii-workspace-anchor-physical-candidates.js` | strict metric + bridge-pruned complete components + pool state machine | completed |
| `tests/cii-workspace-anchor-search-budget.test.js` | canonical focused metric/graph/pool contracts | completed |
| `agents/PR1265_workreport.md` | recovery/current-state surface | active |

A temporary accidental duplicate test path was created during #1273:
`tests/cii-workspace/cii-workspace-anchor-search-budget.test.js`.

#1274 guard detected it. The duplicate was deleted and its intended content moved to the canonical test path. Current PR changed-file set is back to the three expected responsibility paths.

## Local recovery tooling

Normal repository checkout is unavailable in this execution host. Repository-local `node utils/backup.cjs` and local `.agent-worklogs` could not be executed here.

Compensation:
- exact base/preimage blob SHAs were recorded before remote replacements;
- GitHub writes used expected blob SHA leases;
- superseded PR #1260 was not rewritten;
- no reset/checkout/revert/history rewrite was used;
- exact hosted validation branches retain immutable evidence for each attempted head.

Preimages from #1234:
- selector: `18e04998fdf48368f56ff5bf975671075d90cd84`
- focused test: `2bbee4654d1d9ee08e7986d9a5cc5bd6b8f6ad1c`

Undo boundary:
restore only these two files to the recorded #1234 preimages after first verifying current blob hashes and confirming no later change overlaps.

## Validation truth

| Check | Status | Basis |
|---|---|---|
| final rule design | PASS | #1262 hosted run 37496176167 |
| material/authority custody | PASS | #1270 |
| pairwise metric contracts | PASS | #1271 actual-blob execution |
| graph contracts | PASS | #1272 actual-blob execution |
| pool state machine | PASS | #1273 actual-blob execution |
| canonical Node regression | PASS | #1274 run 37506063470 |
| full generic adversarial matrix | PASS | #1274 run 37506063470 |
| test-path custody repair | PASS | canonical path restored; duplicate removed |
| exact-head qualification | NOT_RUN | #1275 |
| retained S1 C4 | NOT_RUN | #1258 after #1275 |
| merge | NOT AUTHORIZED | Owner-only |

#1274 authoritative hosted run:
- validation head `cd3edccff6f8eab05f188829e5b2d0464bf2c330`
- run `37506063470`
- job `112414901779`
- conclusion SUCCESS

## Protected invariants

Unchanged:
- `cii-workspace-geometry.js`;
- Method-A qualification/confidence;
- Method B;
- automatic MEDIUM/HIGH selection threshold;
- default physical budget 10 / range 3..24;
- Writer/scope;
- V11/V14 bridge;
- benchmark bytes / TEXPECTED authority;
- product workflow files.

## Highest risk

Retained S1 correctness is still unproven for this exact product. Generic coherence success must not be confused with downstream retained correspondence acceptance.

## EXACT_NEXT_ACTION

#1275: qualify the exact final PR #1265 head after this report commit. Guard the selector/test blobs above, verify only the three expected PR paths differ from #1234, run the canonical focused test, audit protected/forbidden surfaces, and publish FIT_FOR_C4 or a precise failure. Do not run retained C4 until #1275 passes.
