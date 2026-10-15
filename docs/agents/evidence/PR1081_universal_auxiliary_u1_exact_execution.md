# PR1081 — universal auxiliary U1 exact-source execution

CHAIN_ID: CII-FIND-REPLACE-V14
PR: 1081
BRANCH: feature/cii-find-replace-finish-v14
BASE_MAIN: bfe3abbb67060c1212001f2e9d967c229a057640
PREWORK_ENDPOINT: EP-CII-FR-0020
PRODUCT_MATERIAL_HEAD: 4f9e79fc899fd5e89c33267480208e25f8d627da
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: 293a3db7993a6945c01adc592a7ff14a339c504a

## Owner authority

The prior U1 qualification gate was explicitly skipped by current Owner instruction:

```text
skip, proceed next
```

`EP-CII-FR-0020` records that instruction as:

```text
QUALIFICATION_STATE: NOT_REQUIRED
WRITE_AUTHORITY: WRITE_ALLOWED
```

for this bounded U1 leg only. This evidence does **not** represent or fabricate an independent qualification PASS.

Merge authority remains Owner-only and was not granted.

## Material files

U1 production/test material is exactly:

```text
tabs/cii-workspace/cii-workspace-find-replace-v14-aux-authority.js   NEW
tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js     MODIFY
tests/cii-workspace-find-replace-scope-resolver.test.js              MODIFY
tests/cii-workspace-find-replace-v14-aux-authority.test.js           NEW
```

Product commits:

```text
a09e92d10b333ab16a3a51da774f2a1c7060802d  add v14 auxiliary ownership authority
161cd57441b1b4c3ae838d1b84bcaef44d30fdfb  integrate authority with scope resolver
d1d2195baba057a10fd2a466dadf20876f28e829  make existing Displacement fixture CONTROL-valid
4f9e79fc899fd5e89c33267480208e25f8d627da  add focused U1 authority tests
```

Remote Git blob closure after promotion:

```text
cii-workspace-find-replace-v14-aux-authority.js       079b55252af7594ea04f959620f2d8d00e348b6f
cii-workspace-find-replace-scope-resolver.js          0d153f4fa513373c426b05443a50c6a7657a0a06
cii-workspace-find-replace-scope-resolver.test.js     3b6c4356879fe08fb6427cdee43f805702adf4c2
cii-workspace-find-replace-v14-aux-authority.test.js  e8ef51c37997abb606cb2c1c465378e13365d141
```

Unchanged imported dependencies in the exact-source local reconstruction were hash-matched to the branch before final execution:

```text
parser/fixed-field.js                                 485daa43553681ca54f488499e57f36d2239be58
cii-workspace-find-replace-nodename-scope.js          8e8b917f0c937f7c3891aa74d2c9385bc68c11e7
cii-workspace-find-replace-validator.js                61a8ae1f1487d646d751e8e2ff462bd4772958d5
cii-workspace-byte-sha256.js                           6435e0eaadc382a18aac6a0bd46318ab6c27c714
```

## Implemented U1 boundary

The new v14 read-authority helper establishes:

```text
exact From/To element
-> requested IEL pointer
-> matching CONTROL count
-> exact physical section rows
-> require section rows == CONTROL count * v14 rows/record
-> require pointer within 1..CONTROL count
-> reconstruct reverse pointer owners
-> require one owning element
-> select exact pointer-owned record
```

The immutable v14 registry pins all 15 IEL positions, CONTROL count coordinates and v14 record cardinalities. In particular it uses v14 `ALLOWBLS=28`, `SIF&TEES=14` and `REDUCERS=2`, not legacy 26/10/1 values.

Physical section extraction preserves blank payload rows. Embedded `*` comment rows inside pointer-addressed fixed-record sections fail closed rather than being silently removed from record arithmetic.

Shared positive auxiliary pointers fail closed with `AUX_POINTER_SHARED` rather than cloning or repointing records.

## Protected behavior

U1 deliberately does **not** expose generic auxiliary payload spans for mutation. Recognized generic block ownership returns read-only evidence and then blocks with:

```text
BLOCK_MUTATION_NOT_QUALIFIED:<BLOCK>
```

Therefore this material leg is infrastructure, not universal payload mutation.

Protected behavior verified in the focused suite:

```text
NODENAME     existing specialized fixed-field resolver remains the dispatch path
DISPLMNT     existing endpoint identity semantics are retained after common ownership plumbing
FORCMNT      remains explicitly de-scoped and mutation-blocked
TARGET0      no overwrite authority added
Writer1/2    no invocation added
validator    unchanged
executor     unchanged
output       unchanged
```

## Exact-source commands executed

```text
node --check tabs/cii-workspace/cii-workspace-find-replace-v14-aux-authority.js
node --check tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js
node --check tests/cii-workspace-find-replace-scope-resolver.test.js
node --check tests/cii-workspace-find-replace-v14-aux-authority.test.js

node --test \
  tests/cii-workspace-find-replace-scope-resolver.test.js \
  tests/cii-workspace-find-replace-v14-aux-authority.test.js
```

Observed focused result:

```text
tests   17
pass    17
fail     0
skipped  0
```

The 17 tests comprise the six pre-existing resolver tests plus eleven U1-specific tests.

## U1 properties executed

The focused runtime explicitly exercised:

- complete 15-pointer / CONTROL / v14 row-cardinality registry;
- BEND pointer 2 -> exact second 3-row record;
- RIGID, EXPJT, RESTRANT, UNIFORM, WIND, OFFSETS, ALLOWBLS, SIF&TEES, REDUCERS and EQUIPMNT record sizes;
- rejection of legacy ALLOWBLS 26, SIF&TEES 10 and REDUCERS 1 row counts;
- FLANGES blank physical payload-row preservation;
- pointer zero, out-of-range, malformed and shared-pointer failures;
- CONTROL/section cardinality mismatch;
- embedded comment ambiguity failure;
- generic ownership resolution with generic mutation still blocked;
- Displacement CONTROL correlation, endpoint mismatch, zero-pointer compatibility, cardinality mismatch and shared-pointer blocking;
- existing specialized Node Name routing;
- FORCE/FORCMNT rejection.

## Validation truth

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

Synthetic exact-source U1 execution is not represented as retained-real or external CAESAR acceptance. No `NOT_RUN` gate is promoted to PASS.

## Local recovery evidence

Local ignored recovery ledger:

`.agent-worklogs/20260902_2228_universal-aux-u1/`

It contains the task manifest, module logs, history-independent no-index patches, exact validation output, final SHA-256 hashes and checksum-gated undo instructions. Existing edited files were backed up with the repository backup utility before editing.
