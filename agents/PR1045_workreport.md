# PR1045 work report — Writer2 W2.12 RESTRAINT one-TARGET0 composite adoption

## CURRENT STATE — READ FIRST

```text
HANDOVER_READINESS: READY
TAKEOVER_EPOCH: 2026-08-24_W212_COMPLIANCE_RECOVERY
TAKEOVER_AUTHORITY: WRITE_ALLOWED
PR_RECOVERY_STATE: CONTINUE
REPOSITORY: reallaksh19/XML_Compare_Utilities
ISSUE: #1044
PR: #1045
BRANCH: agent/cii-writer2-restraint-composite-w212
BASE_MAIN: b2ba46cb8008c8d59a40fe8b3260ead122e063d0
CURRENT_MAIN_AT_TAKEOVER: b2ba46cb8008c8d59a40fe8b3260ead122e063d0
PRE_TAKEOVER_HEAD: f894154721d95a0351ba97165b56e6e323422216
REPORT_BASIS_HEAD: 4901df18936c75428d58e1666bd0b8244f679c04
MERGED_PREDECESSOR: PR #1043 / W2.11
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE
PR_STATE: DRAFT
PRODUCT_CORE_AUTHORITY: FALSE
GENERIC_RESTRAINT_CREATE: BLOCKED
```

## Handover in 60 seconds

W2.12 composes the already-qualified Writer2 NODE/SIF/HANGER transaction and merged W2.11 RESTRAINT block DELETE from one untouched TARGET0. All component claims are original-coordinate, exact-preimage checked, globally overlap-arbitrated, and applied in one final splice. The independent validator reconstructs the complete expected postimage without importing W2.12 Writer code.

Inherited W2.10/W2.11 CONTROL correction is binding:

```text
CONTROL row1 / field4 / I13 = NONAM       -> NODENAME authority; RESTRAINT must preserve
CONTROL row2 / field4 / I13 = RESTRAINTS  -> RESTRAINT block-count authority
```

Takeover found one introduced repository-policy defect: the two new W2.12 production JS files at `f8941547...` were approximately 314 and 353 lines, violating `AGENTS.md` `<300 lines/new JavaScript file`. The recovery patch is a behavior-preserving responsibility split into Writer-side support and independently separate validator-side support. Do not merge until the split is committed and focused R01-R22 execution is observed or explicitly waived by the owner.

## 1. Mission

Adopt merged W2.11 RESTRAINT block DELETE into the existing Writer2 one-original-preimage composite while preserving:

```text
WRITER_2_NODENAME
WRITER_2_SIF_DELETE
WRITER_2_HANGER_DELETE_ALL
WRITER_2_HANGER_PARTIAL_DELETE
WRITER_2_RESTRAINT_BLOCK_DELETE
```

W2.12 does not add product/core/UI routing. That remains W2.13.

## 2. Authority and invariants

Consumed RESTRAINT authority:

```text
planner  = CII_WRITER_2_RESTRAINT_BLOCK_DELETE_COMPACTION_PLAN
physical = CII_WRITER_2_RESTRAINT_BLOCK_DELETE_PHYSICAL_WRITE
CONTROL  = row2 / field4 / I13
ELEMENT restraint pointer = exact physical I13 custody
RESTRANT block = 24 physical rows
```

Allowed W2.11 child claims:

```text
CONTROL_RESTRAINT_BLOCK_COUNT
ELEMENT_RESTRAINT_POINTER
RESTRAINT_SECTION_PAYLOAD
```

Hard invariants:

```text
all child writers consume identical untouched TARGET0
no child consumes another child's postimage
all claims use TARGET0 original coordinates
TARGET0[byteStart:byteEnd] == beforeField for every claim
any cross-family physical overlap -> fail closed
one final splice only
complete expected postimage is independently reconstructed
writer testimony is secondary to complete-byte equality
CONTROL row1/NONAM is byte-negative-assurance for RESTRAINT-only mutation
RESTRAINT CREATE remains blocked
SIF CREATE remains blocked
HANGER CREATE remains blocked
Writer1B free-slot authority remains unchanged
product/core/UI remains unchanged
```

## 3. Current architecture

```text
PARENT BOUND SCOPE
      |
      +-----------------------------+
      |                             |
      v                             v
canonical NODE/SIF/HANGER       canonical RESTRAINT
child scope                     child scope
      |                             |
      v                             v
existing Writer2 composite      merged W2.11 component
      |                             |
      +-------------+---------------+
                    |
                    v
         TARGET0-relative claims only
                    |
                    v
       exact-preimage global arbitration
                    |
                    v
             splice TARGET0 once
                    |
                    v
                postimage
```

Authority:

```text
CII_WRITER_2_RESTRAINT_ONE_TARGET0_COMPOSITE
```

## 4. Takeover finding and minimal patch

### ISS-W212-001 — new production JS exceeds repository line limit

At `PRE_TAKEOVER_HEAD=f8941547...`:

```text
tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js             ~314 lines
tabs/cii-workspace/cii-workspace-writer2-composite-restraint-validation.js  ~353 lines
```

`AGENTS.md` requires every new JavaScript file to remain below 300 physical lines and functions below 40 lines where practical.

Disposition:

```text
CONTINUE
```

Minimal patch:

```text
writer orchestration
  -> cii-workspace-writer2-composite-restraint.js
writer pure custody/scope/claim helpers
  -> cii-workspace-writer2-composite-restraint-support.js

validator orchestration
  -> cii-workspace-writer2-composite-restraint-validation.js
independent validator-only custody/scope/claim helpers
  -> cii-workspace-writer2-composite-restraint-validation-support.js
```

Independence invariant:

```text
validation.js MUST NOT import writer.js or writer-support.js
validation-support.js MUST NOT import writer.js or writer-support.js
```

No blocker strings, authority tokens, claim kinds, operation semantics, byte arithmetic, or product routing are intentionally changed.

## 5. Qualification matrix

Positive:

```text
R01 RESTRAINT-only
R02 NODENAME + RESTRAINT
R03 SIF DELETE + RESTRAINT
R04 HANGER DELETE-ALL + RESTRAINT
R05 qualified H=3 partial HANGER + RESTRAINT
R06 NODE + SIF + HANGER + RESTRAINT
R07 multiple RESTRAINT deletes + downstream pointer relocation
R08 physical pointer 0 remains unchanged
R09 CONTROL row1/NONAM unchanged; row2/RESTRAINTS changes
```

Falsifiers:

```text
R10 RESTRAINT CREATE
R11 SIF CREATE
R12 HANGER CREATE
R13 stale TARGET0 SHA
R14 duplicate operation ID
R15 parent scope drift
R16 child candidate-set drift
R17 cross-family overlap
R18 forged RESTRAINT testimony
R19 forged existing-composite testimony
R20 unrelated final-byte drift
R21 forged postimage hash/representation
R22 unsupported process/topology APPLY
```

## 6. Validation truth

Pre-takeover execution truth:

```text
W2.11 focused component qualification       PASS_EXACT_BLOB_VERIFIED_SPARSE
W2.12 source architecture                    PASS_SOURCE_INSPECTION
W2.12 R01-R22                                AUTHORED
W2.12 focused native execution               NOT_RUN_ENVIRONMENT
repository npm test                          NOT_RUN_ENVIRONMENT
current-head workflow                        NONE_OBSERVED
browser/product                              NOT_APPLICABLE_W2_12
```

Takeover compliance evidence:

```text
candidate writer main syntax                 PASS_LOCAL_SYNTAX
candidate writer support syntax              PASS_LOCAL_SYNTAX
candidate validator main syntax              PASS_LOCAL_SYNTAX
candidate validator support syntax           PASS_LOCAL_SYNTAX
candidate line counts                        143 / 227 / 213 / 203
candidate focused test syntax                PASS_LOCAL_SYNTAX
published blob SHA match (4 prod + test)      PASS_EXACT_GIT_BLOB
validator no-import boundary                 PASS_EXACT_BLOB_SOURCE
runtime R01-R22 on branch                    NOT_RUN_ENVIRONMENT
```

Do not relabel syntax/source inspection as runtime qualification.

Published exact-blob evidence:

```text
writer.js                    c007c91e1ac73a3ba5003f59ccdfa027eb5156a0
writer-support.js            5b1494ba95dbfdf663bc377f8632a50d7cd2b65b
validation.js                919ac88c071db9d793c7793cbbd82cff7e193189
validation-support.js        a5b8f07b733161ddfec222d1a80371bcd27794e7
focused positive test        b46ddd256df56353e21c0137bb075462904e14b3
```

Each GitHub blob SHA matched local `git hash-object` before local `node --check`. Direct `git ls-remote` still fails with `Could not resolve host: github.com`, so focused runtime remains NOT_RUN_ENVIRONMENT.

## 7. Protected-path negative assurance

Must remain unchanged in W2.12:

```text
tabs/cii-workspace/cii-workspace-core.js
tabs/cii-workspace/cii-workspace-writer2-composite-routing.js
tabs/cii-workspace/cii-workspace-writer2-product-validation.js
Writer1B free-slot implementation
UI/browser route
workflow/package/parser/converter
Writer3 topology
```

Not authorized:

```text
RESTRAINT CREATE
SIF CREATE
HANGER CREATE
process fixed-field reassignment to Writer2
topology mutation
product/core adoption
```

## 8. Changed-file ledger

Pre-takeover PR paths: 9.

Actual W2.12 paths after compliance recovery: 11.

```text
coordination
  agents/PR1045_workreport.md
  agents/status/PR1045.yaml
  agents/claims/PR1045.yaml

production
  tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js
  tabs/cii-workspace/cii-workspace-writer2-composite-restraint-support.js             NEW
  tabs/cii-workspace/cii-workspace-writer2-composite-restraint-validation.js
  tabs/cii-workspace/cii-workspace-writer2-composite-restraint-validation-support.js  NEW

tests
  tests/cii-workspace-writer2-composite-restraint-fixture.js
  tests/cii-workspace-writer2-composite-restraint.test.js
  tests/cii-workspace-writer2-composite-restraint-partial-hanger.test.js
  tests/cii-workspace-writer2-composite-restraint-falsifiers.test.js
```

Unexplained paths allowed: 0.

## 9. Takeover Appendix A — implementation authorization

### A1 Production trace — 20/20

Trace verified from current PR source:

```text
parent BOUND scope
-> family child scopes
-> existing NODE/SIF/HANGER component + W2.11 RESTRAINT component
-> both consume same targetDocument/TARGET0
-> normalized original-coordinate claims
-> global overlap arbitration
-> one splice
-> canonical physical re-intake
```

Prediction/falsifier: if any component consumes a sibling postimage or a claim preimage does not equal TARGET0 at the declared span, the composite must block before final mutation.

### A2 Current failure isolation — 20/20

Current takeover defect is repository structural compliance, not engineering arithmetic: both new production files exceed `<300` lines. No evidence was found that #1042 CONTROL custody regressed. R02/R09 source still targets row1/NONAM as protected and row2/RESTRAINTS as mutable.

Prediction/falsifier: a responsibility split with unchanged authority/error strings should preserve logical claims and final bytes. Any changed R01-R22 expected behavior indicates the split is not behavior-preserving.

### A3 Authority/invariant — 20/20

Exact inherited correction:

```text
CONTROL row1 field4 = NONAM       preserve under RESTRAINT
CONTROL row2 field4 = RESTRAINTS  mutate under qualified block DELETE
```

One-TARGET0/original-coordinate and exact-preimage rules remain mandatory. RESTRAINT CREATE remains out of authority.

### A4 Independent validation — 20/20

Current validator does not import W2.12 Writer and reconstructs expected NODE/SIF/HANGER/RESTRAINT claims from qualified planner/validator authority. Primary oracle is exact complete-postimage byte equality before Writer testimony.

Recovery split preserves independence by creating a validator-specific support module that imports neither Writer module.

Falsifier: any import from `cii-workspace-writer2-composite-restraint.js` or `...-support.js` into either validator module fails static qualification.

### A5 Next-commit/minimal patch — 20/20

Only split responsibilities and add static policy guards. No product/core/routing changes; no authority widening; no CREATE enablement. New production files remain `<300` lines and named-export only.

```text
TAKEOVER_SCORE = 100/100
MINIMUM_EACH = 20/20
TAKEOVER_DECISION = CONTINUE
TAKEOVER_AUTHORITY = WRITE_ALLOWED
```

## 10. Exact next action

```text
1. Compliance split and static guards are committed.
2. Execute focused R01-R22 on an exact complete checkout or exact complete sparse mirror.
3. Run inherited Writer2 composite regressions when that runtime is available.
4. Keep PR DRAFT while focused runtime remains NOT_RUN_ENVIRONMENT.
5. Never merge without separate owner authorization.
6. W2.13 starts only after W2.12 merge.
```
