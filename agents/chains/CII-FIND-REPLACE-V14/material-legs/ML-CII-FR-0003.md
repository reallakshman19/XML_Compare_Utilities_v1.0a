# ML-CII-FR-0003 — v14 universal auxiliary U1 ownership foundation

CHAIN_ID: CII-FIND-REPLACE-V14
MATERIAL_LEG_ID: ML-CII-FR-0003
PREWORK_ENDPOINT: EP-CII-FR-0020
PREWORK_ENDPOINT_FILE: agents/chains/CII-FIND-REPLACE-V14/endpoints/EP-CII-FR-0020.md
PR: 1081
BRANCH: feature/cii-find-replace-finish-v14
BASE_MAIN: bfe3abbb67060c1212001f2e9d967c229a057640
PREVIOUS_PRODUCT_MATERIAL_HEAD: 43761321967387130988590bc61877a79b632c37
PRODUCT_MATERIAL_HEAD: 4f9e79fc899fd5e89c33267480208e25f8d627da
EVIDENCE_COMMIT: d35c8db7a0bd41130898cba313bbec6bab842622
EVIDENCE_FILE: agents/evidence/PR1081_universal_auxiliary_u1_exact_execution.md
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: 293a3db7993a6945c01adc592a7ff14a339c504a
OWNER_QUALIFICATION_OVERRIDE: SKIP
QUALIFICATION_STATE_FOR_LEG: NOT_REQUIRED
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

## Material purpose

Establish the CAESAR II v14 universal auxiliary **ownership/cardinality foundation** required before field-aware Find & Replace can be generalized beyond Node Name and Displacement.

This leg does not authorize or expose generic auxiliary payload mutation.

## Material commits

```text
a09e92d10b333ab16a3a51da774f2a1c7060802d
  NEW tabs/cii-workspace/cii-workspace-find-replace-v14-aux-authority.js
  Complete immutable v14 IEL/CONTROL/cardinality authority and exact owned-record resolver.

161cd57441b1b4c3ae838d1b84bcaef44d30fdfb
  MODIFY tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js
  Displacement consumes common ownership/cardinality resolution; generic families expose ownership evidence but remain mutation-blocked.

d1d2195baba057a10fd2a466dadf20876f28e829
  MODIFY tests/cii-workspace-find-replace-scope-resolver.test.js
  Existing synthetic Displacement fixture gains the required four-row CONTROL structure.

4f9e79fc899fd5e89c33267480208e25f8d627da
  NEW tests/cii-workspace-find-replace-v14-aux-authority.test.js
  Focused positive/negative U1 coverage.
```

## U1 authority delivered

For a recognized v14 auxiliary family the read-authority path is:

```text
From/To
-> unique 15-row ELEMENTS record
-> canonical IEL pointer
-> matching CONTROL count
-> exact physical target section
-> exact v14 `count * rowsPerRecord` cardinality
-> reverse pointer owner set
-> unique selected-element ownership
-> exact pointer-owned physical record
```

The registry covers all 15 v14 IEL positions. FORCE/FORCMNT is represented only as a blocked family. NODENAME remains a specialized route outside the generic resolver.

## Fail-closed boundaries

U1 blocks:

```text
zero pointer
non-integral/unreadable pointer
pointer outside CONTROL count
CONTROL row/cardinality failure
section absence/duplication
section physical row mismatch
embedded comment ambiguity in pointer-addressed record data
shared auxiliary pointer ownership
owner mismatch
FORCE/FORCMNT
generic auxiliary mutation after successful ownership resolution
```

Generic ownership success is intentionally followed by `BLOCK_MUTATION_NOT_QUALIFIED:<BLOCK>` in the public Find & Replace scope resolver. U2 must establish field-level mutation authority before those families can produce writable spans.

## Preserved invariants

```text
NODENAME resolver/validator       unchanged
DISPLACEMENT endpoint semantics   preserved
FORCE/FORCMNT                     de-scoped
CONTROL mutation                  none
ELEMENT IEL pointer mutation      none
TARGET0 overwrite                 disabled
Direct Apply-to-source            disabled
Writer1/Writer2 invocation        none
validator/executor/output custody unchanged
merge                             Owner-only / unauthorized
```

## Exact-source validation

Executed on locally reconstructed final branch blobs and hash-matched unchanged imports:

```text
node --check tabs/cii-workspace/cii-workspace-find-replace-v14-aux-authority.js
node --check tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js
node --check tests/cii-workspace-find-replace-scope-resolver.test.js
node --check tests/cii-workspace-find-replace-v14-aux-authority.test.js

node --test \
  tests/cii-workspace-find-replace-scope-resolver.test.js \
  tests/cii-workspace-find-replace-v14-aux-authority.test.js
```

Observed:

```text
PASS 17
FAIL 0
SKIP 0
```

Evidence: `agents/evidence/PR1081_universal_auxiliary_u1_exact_execution.md`.

## Validation ledger

```text
U1 exact-source focused resolver runtime             PASS 17/17
PR1081 prior exact-source UI/static closure           PASS 10/10
Merged non-benchmark Find & Replace                   PASS 33/33
Merged focused Node Name                              PASS 4/4
SOURCE 3 retained-real authored runtime               NOT_RUN
Full repository suite                                 NOT_RUN
Native-v14 archived fixture runtime                   NOT_RUN
External CAESAR acceptance                            NOT_RUN
```

## Successor boundary

This leg completes U1 only. The next technical phase is U2 field-aware claim design/implementation for universal Element and auxiliary Block mutation. U2 is a new mutation-authority boundary and must not silently inherit U1 write authorization.
