# PR1010 — CII Writer 1A + 1B + 1C Composite Work Report

## Recovery header

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: 1010
BRANCH: agent/cii-writer-composite-1a-1b-1c
BASE: main@d63e8c59a13013c9367a3c99f3e1293e1ca76203
MISSION: compose already-qualified Writer 1A, Writer 1B and Writer 1C mutations from one untouched TARGET preimage
CURRENT_STAGE: IMPLEMENTED_DRAFT_AWAITING_LATEST_RUNTIME_QUALIFICATION
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Architectural reason

Standalone Writer 1B currently implements its superset behavior by running Writer 1A first and then applying Writer-1B-only fields to the resulting text. That sequencing remains valid for standalone Writer 1B, but it cannot define authority for a general 1A + 1B + 1C transaction because the mutation preimage would become writer-order dependent.

PR1010 therefore adds a separate composite path. Standalone Writer1A and Writer1B implementation files are not changed.

## 2. Composite transaction

```text
untouched original TARGET
   |-- Writer1A/Writer1B lower dry-run from original text
   |      -> physical mutation testimony
   |      -> line/column converted to original absolute-byte span
   |      -> beforeField must equal untouched original bytes
   |
   |-- Writer1C dry-run from original byte-custodied TARGET
          -> qualified NODENAME / V11 SIF mutation testimony

component evidence
 -> preserve Writer1A / Writer1B / Writer1C policy identity
 -> cross-family same-span veto
 -> partial-overlap veto
 -> same-family identical-claim canonicalization only
 -> patch ONE original TARGET byte vector
 -> re-intake final result
 -> independently validate lower and Writer1C dry-runs
 -> independently reconstruct S_auth from component evidence
 -> require Writer composite ledger == independently reconstructed union
 -> require D_actual subset S_auth
```

No writer output becomes another writer family's mutation preimage.

## 3. Lower authority and exact original preimage

Every lower operation must retain transfer-policy authority:

```text
CII_WRITER_1A_* -> WRITER_1A
CII_WRITER_1B_* -> WRITER_1B
anything else   -> BLOCK
```

Physical conversion:

```text
byteStart = physicalLine.byteStart + (startColumn - 1)
byteEnd   = physicalLine.byteStart + endColumn
width     = byteEnd - byteStart
```

Required:

```text
width == beforeField.length == afterField.length
originalBytes[byteStart:byteEnd] == beforeField
```

This is the anti-sequential falsifier: if a lower mutation's preimage exists only because an earlier writer already changed that field, it cannot match the untouched TARGET.

## 4. Cross-family arbitration

```text
same writer family + same span + identical pre/post -> may canonicalize
same writer family + same span + divergent bytes    -> BLOCK
Writer1A vs Writer1B vs Writer1C same span           -> BLOCK, even identical postimage
any partial overlap                                  -> BLOCK
```

Blockers include:

```text
CII_WRITER_COMPOSITE_CROSS_FAMILY_SAME_SPAN
CII_WRITER_COMPOSITE_SAME_SPAN_CONFLICT
CII_WRITER_COMPOSITE_CROSS_FAMILY_SPAN_OVERLAP
```

There is no last-writer-wins path.

## 5. Component validators remain independent

Lower dry-run is reparsed and checked with the existing lower writer validator:

```text
validateCiiWriterRoundTrip(..., 'WRITER_1B_COMPONENT')
```

Writer1C dry-run is reparsed and checked with:

```text
validateCiiWriter1CRoundTrip(...)
```

The final composite validator requires the applicable component validation results to PASS.

## 6. Final authorization — QF-006 correction

The first composite-validator implementation incorrectly used `writerResult.mutations` as the final authorized span set. That made the composite Writer's testimony the source of `S_auth`, contradicting the Writer1C authority rule established by prior work.

**QF-006 is fixed.** The current validator independently reconstructs the final authorized union from:

```text
untouched TARGET physical custody
+ validated lower component mutation evidence
+ lower transfer-plan Writer1A/Writer1B policy identity
+ validated Writer1C component mutation evidence
```

It independently converts lower line/column custody to absolute spans, reconstructs Writer1C absolute spans, canonicalizes only same-family identical claims, and independently rejects cross-family same-span/partial overlap.

The composite writer ledger is then checked as testimony:

```text
reported_union == independently_reconstructed_union
```

A writer that omits, adds, relabels, or changes an authorized span fails:

```text
COMPOSITE_WRITER_REPORTED_UNION_MISMATCH
```

The actual final byte diff is checked against the independently reconstructed union, not against Writer testimony:

```text
D_actual subset S_auth_independent
```

## 7. Final structural / byte checks

Current final validator requires:

- exact independent component union;
- exact writer-report equality to that union;
- actual byte diff subset of independent union;
- exact preimage and postimage for every authorized span;
- byte length unchanged;
- physical line count unchanged;
- line-ending sequence unchanged;
- section order unchanged;
- final reparsed original-byte string exactly equal to Writer result bytes.

## 8. Production routing

Writer1A and Writer1B application routes remain unchanged.

Writer1C preview and scoped readiness use `ciiWriterCompositeReadiness`, and Writer1C apply routes through the composite. The product default remains Writer1B.

## 9. Qualification findings closed

```text
QF-001 existing Writer1B sequential internal chaining
       -> separate one-preimage composite orchestrator

QF-002 composite readiness omitted mutationCount compatibility
       -> mutationCount restored

QF-003 cross-family identical same-span initially canonicalized
       -> cross-family same-span now always BLOCK

QF-004 lower ledger initially lumped Writer1A/Writer1B
       -> explicit CII_WRITER_1A_* / CII_WRITER_1B_* identity required

QF-005 mixed regression initially covered only Writer1B + Writer1C
       -> three-family P1 + P3 + V11 ii test added

QF-006 final validator initially treated writerResult.mutations as S_auth
       -> independently reconstruct component union; Writer ledger must match
```

## 10. Regression coverage authored

```text
tests/cii-workspace-writer-composite-plan.test.js
tests/cii-workspace-writer-composite-mixed.test.js
tests/cii-workspace-writer-composite-three-family.test.js
tests/cii-workspace-writer-composite-validation.test.js
tests/cii-workspace-writer1c-routing.test.js
```

Coverage includes:

- plan splitting;
- Writer1A vs Writer1B policy custody;
- unqualified lower operation rejection;
- exact lower original-preimage falsifier;
- same-family canonicalization;
- cross-family same-span veto even for identical bytes;
- partial overlap veto;
- Writer1B + Writer1C transaction;
- Writer1A P1 + Writer1B P3 + Writer1C V11 ii transaction;
- unauthorized final-byte falsifier;
- missing component-validation falsifier;
- independent union reconstruction;
- composite Writer ledger omission falsifier;
- lower-policy reconstruction falsifier;
- Writer1C routing/default guard.

## 11. Validation truth

Exact checkout remains unavailable:

```text
git clone ...
fatal: unable to access ... Could not resolve host: github.com
```

Current evidence:

```text
main/base grounding                              PASS_GIT_COMPARE
branch scope                                     PASS_GIT_COMPARE
source architecture audit                        PASS_SOURCE_INSPECTION
pre-QF006 isolated composite harness              PASS_SUPERSEDED
latest plan regression                            AUTHORED_NOT_RUN_ENVIRONMENT
latest mixed Writer1B+1C regression               AUTHORED_NOT_RUN_ENVIRONMENT
latest three-family Writer1A+1B+1C regression     AUTHORED_NOT_RUN_ENVIRONMENT
latest independent-union validator regression     AUTHORED_NOT_RUN_ENVIRONMENT
inherited Writer1A/1B/1C regressions              NOT_RUN_ENVIRONMENT
full npm test                                     NOT_RUN_ENVIRONMENT
browser product flow                              NOT_RUN_ENVIRONMENT
```

No superseded harness result is used as evidence for the latest head.

## 12. Changed-file ledger

Production:

```text
tabs/cii-workspace/cii-workspace-core.js
tabs/cii-workspace/cii-workspace-target-writer-composite.js
tabs/cii-workspace/cii-workspace-transfer-scope.js
tabs/cii-workspace/cii-workspace-writer-composite-validation.js
```

Tests:

```text
tests/cii-workspace-writer-composite-mixed.test.js
tests/cii-workspace-writer-composite-plan.test.js
tests/cii-workspace-writer-composite-three-family.test.js
tests/cii-workspace-writer-composite-validation.test.js
tests/cii-workspace-writer1c-routing.test.js
```

Recovery:

```text
agents/MASTER_INDEX.md
agents/PR1010_workreport.md
agents/status/PR1010.yaml
agents/claims/PR1010.yaml
```

No converter core, fixed-field parser, benchmark CII, workflow, Writer1A implementation, or Writer1B implementation is changed.

## 13. Explicit exclusions

- no new engineering-field semantics;
- no Writer2 record/pointer/reindex authority;
- no SIF block create/delete/cardinality/CONTROL mutation;
- no new neutral editions/fields;
- no cross-family same-span canonicalization;
- no sequential Writer1B-output -> Writer1C authority;
- no weakening of component validators.

## 14. Appendix A — takeover qualification

1. Why can standalone Writer1B sequencing not define mixed Writer1A+1B+1C authority?
2. Derive lower absolute byte custody from line number and fixed-field columns.
3. How does exact original `beforeField` detect hidden sequential dependencies?
4. How is Writer1A vs Writer1B policy identity determined?
5. Why is writer implementation recognition insufficient authority?
6. What happens when Writer1A and Writer1C claim the same span with identical postimage?
7. Which same-span condition may canonicalize?
8. Explain QF-006: why may `writerResult.mutations` not define `S_auth`?
9. From what evidence does the current validator independently reconstruct the union?
10. What must happen if the Writer ledger omits one independently authorized component claim?
11. State `D_actual subset S_auth_independent`.
12. Explain component validation versus final union validation.
13. Identify the three fields in the three-family regression.
14. Prove standalone Writer1A/Writer1B files are unchanged.
15. List all latest-head NOT_RUN gates.

## 15. Current disposition

PR1010 remains **draft** and unmerged. Source qualification is substantially hardened, including independent final authorization, but exact latest-head repository and browser execution are still required before release-quality PASS or merge recommendation.
