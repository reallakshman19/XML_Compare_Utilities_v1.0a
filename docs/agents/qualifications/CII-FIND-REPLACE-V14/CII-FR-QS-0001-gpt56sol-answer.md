# CII-FR-QS-0001 — candidate answer

CHAIN_ID: CII-FIND-REPLACE-V14
ENDPOINT_ID: EP-CII-FR-0001
QUESTION_SET_ID: CII-FR-QS-0001
QUALIFICATION_BASIS_HEAD: e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b
CANDIDATE_ID: GPT-5.6-SOL-2026-09-02-A
LIVE_PR_HEAD_OBSERVED: 9b0c55619cbcc60709fc80414ead93f505366055
LIVE_MAIN_HEAD_OBSERVED: d35f6aa419244585afec2c47c8fbd0584011931a
RECONCILIATION: METADATA_DRIFT
TAKEOVER_AUTHORITY: READ_ONLY
CANDIDATE_AUTHORIZATION_CLAIM: NONE

Material production/test/source authority is unchanged from `e28e33aa...`; later commits before this answer are relay/evidence metadata only.

## Q1 — Production Trace

Current approved-operation path:

```text
createFindReplaceOperation()/parseFindReplaceCsv()
  tabs/cii-workspace/cii-workspace-find-replace-csv.js
        ↓
buildFindReplacePreview() / decision state
  cii-workspace-find-replace-preview.js
        ↓
qualifyFindReplaceSession()
  cii-workspace-find-replace-session.js
        ↓
validateFindReplacePreimage()
  cii-workspace-find-replace-validator.js
        ↓
resolveFindReplaceScope()
  cii-workspace-find-replace-scope-resolver.js
        ↓
TARGET0-relative claims
        ↓
buildValidatedFindReplacePostimage()
  cii-workspace-find-replace-executor.js
        ↓
validateFindReplacePostimage()
        ↓
QUALIFIED_PREVIEW / safe new-file output
```

The first two current production boundaries preventing `Block=NODENAME` are independent:

1. **Intake boundary** — `rowBlockers()` in `cii-workspace-find-replace-csv.js` accepts only `FORCE` and `DISPLACEMENT`; `NODENAME` becomes `BLOCK_UNSUPPORTED:NODENAME`.
2. **Resolver boundary** — even if intake is bypassed, `resolveFindReplaceScope()` only dispatches BLOCK to DISPLACEMENT or FORCE and otherwise returns `BLOCK_SCOPE_UNSUPPORTED`.

A third usability boundary is the validator's generic equal logical-text length rule: `FIXED_WIDTH_LENGTH_MISMATCH` is raised when `findText.length !== replaceText.length`. This is correct for arbitrary generic byte spans but unnecessarily rejects a safe fixed-width NODENAME field rebuild.

Existing exact NODENAME physical custody is in `tabs/cii-workspace/cii-workspace-nodename.js`:

```text
ELEMENT block rows            = 15
NODENAME pointer row          = zero-based 13
NODENAME pointer item         = zero-based field 5 / sixth numeric item
positive pointer              = 1-based NODENAME row index
NODENAME FROM field columns   = [2,28)  width 26
NODENAME TO field columns     = [28,53) width 25
```

`extractCiiNodeNameEvidence()` further requires exact parsed-index + endpoint binding for qualified physical custody and records owners by byte span; ambiguous endpoint fallback is read-only and makes physical custody BLOCKED.

The first boundary where a Node Name could be wrong after adding NODENAME support is therefore the new **scope resolver ownership map**, not the executor. If the resolver authorizes the wrong fixed field, all later byte-level machinery would faithfully apply the wrong claim.

## Q2 — Current Unresolved Problem / Failure Isolation

Minimum retained-real isolating case uses `Benchmark/CIICompare/SOURCE 3.CII`.

Observed source facts:

```text
ELEMENT 20020 -> 20030
15-row ELEMENT block
row13 item6 = 1

#$ NODENAME
row 1 = "                            PS-12146                 "
```

With the established fixed layout, row 1 resolves as:

```text
FROM [2,28)  = blank
TO   [28,53) = "PS-12146" + trailing spaces
```

Minimum operation:

```text
scope   = BLOCK
block   = NODENAME
from    = 20020
to      = 20030
find    = PS-12146
replace = NODE-20030
```

Prediction:

- exact element match count = 1;
- element NODENAME pointer = 1;
- physical NODENAME row = row 1;
- exact matching endpoint field = TO, width 25;
- logical match count = 1;
- physical claim count = 1;
- physical claim `before` length = 25;
- physical claim `after` length = 25;
- `after` = `NODE-20030` padded on the right with spaces to 25 bytes;
- no CONTROL, ELEMENT pointer, line ending, FROM field, other NODENAME row, or unrelated byte changes.

Adjacent/negative cases:

1. an exact element whose row13 item6 pointer is `0` -> `NODENAME_POINTER_REQUIRED` / BLOCK;
2. pointer > physical NODENAME row count -> BLOCK;
3. CONTROL NONAM != physical NODENAME row count -> BLOCK;
4. duplicate exact `From->To` element identity -> existing element ambiguity blocker;
5. same physical FROM or TO field mapped through the pointer graph to more than one distinct node identity -> `NODENAME_FIELD_OWNER_AMBIGUOUS` / BLOCK;
6. field logical value not equal to `Find Text` -> zero matches / BLOCK;
7. replacement exceeds field width or contains non-ASCII -> BLOCK.

First wrong boundary if the retained ownership prediction is not reproduced: `resolveNodeName()` / its element-pointer-to-field ownership derivation. Do not patch executor or postimage validation first.

## Q3 — Authority / Invariant

Authoritative sources and their boundaries:

1. `tabs/cii-workspace/cii-workspace-nodename.js@d35f6aa...`
   - authority: exact physical NODENAME pointer and field custody in the current repository;
   - establishes 15-row element model, row13 item6 pointer, `[2,28)` / `[28,53)` fields, ASCII byte spans and alias-owner tracking.

2. `tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js@d35f6aa...`
   - authority: native V14 fixed-field/cardinality identities;
   - `NODENAME = 1 row/unit`, CONTROL `0:3 = NONAM`, ELEMENT `13:5 = NODENAME pointer`;
   - does **not** authorize equal-cardinality NODENAME payload mutation by itself.

3. `tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js@d35f6aa...`
   - authority used here only for qualified NODENAME string field widths, ASCII rule and fixed-width padding/rebuild behavior;
   - it is not the Find & Replace execution path.

4. pinned upstream `reallaksh19/3D_Converters@ca8d391a.../converters/scripts/cii_v11_v14.py`
   - authority: qualified V11/V14 dialect relationship;
   - explicitly states `NODENAME strings` are among record shapes unchanged between the qualified profiles.

5. `docs/cii-writer2-v11-v14-lossless-bridge.md@d35f6aa...`
   - negative authority boundary: existing V14 Writer2 bridge blocks equal-cardinality NODENAME payload mutation and does not qualify V14 Writer1 fixed-field mutation.

Therefore this leg must establish its own Find & Replace claim authority rather than borrowing Writer2 apply authority.

Allowed change for a same-cardinality rename:

```text
one or more exact owned NODENAME FROM/TO fixed fields only
```

Must remain unchanged:

```text
file length
section order
NODENAME row count
CONTROL NONAM
all ELEMENT NODENAME pointers
all non-selected NODENAME fields
all line endings
all unrelated bytes
Writer1/Writer2 state
FORCE fail-closed state
direct overwrite prohibition
```

Plausible but invalid shortcut: use DOCUMENT scope to globally replace `PS-12146`. That could mutate unrelated text, another node-name field with different ownership, comments/metadata, or an aliased field without proving semantic node ownership.

## Q4 — Independent Validation

Independent retained ownership reconstruction:

1. SOURCE3 ELEMENT data is grouped in exact 15-row blocks.
2. The block beginning `20020.0 20030.0 ...` ends with pointer rows:

```text
row12: 0 0 0 4 0 0
row13: 0 0 0 0 0 1
row14: 0 0 0
```

The sixth row13 item is therefore NODENAME pointer `1` under repository + V14 pointer authority.

3. The first physical `#$ NODENAME` payload row is:

```text
                            PS-12146
```

Using the independently established field boundaries:

```text
bytes [2,28)  -> blank FROM name
bytes [28,53) -> PS-12146 TO name
```

Thus selected element `20020 -> 20030` owns the row-1 TO field representing node `20030` unless global pointer-owner reconstruction discovers a contradictory distinct-node alias. The implementation must perform that reconstruction rather than assuming uniqueness from this one element.

For logical rename:

```text
PS-12146 -> NODE-20030
```

physical claim model is:

```text
claim.start = absolute byte start of row1 TO field
claim.end   = start + 25
claim.before = exact TARGET0 25-byte TO field
claim.after  = "NODE-20030" + right-padding spaces to exactly 25 bytes
```

Match rule for first priority: compare `trim(claim.before)` to `Find Text` exactly. Do not do arbitrary substring matching inside the semantic name field in this first qualification.

Owner ambiguity rule: build owner sets for each NODENAME field from every exact 15-row ELEMENT block and its positive row13 item6 pointer. A physical FROM/TO field is writable only when its owner set resolves to one distinct node identity. Multiple element aliases for the **same node** are acceptable; multiple distinct node IDs sharing one physical field are a blocker.

Postimage invariant:

```text
TARGET1.length == TARGET0.length
all bytes outside authorized whole-field claim(s) exactly equal TARGET0
claim field equals padded replacement exactly
TARGET0 hash remains the preimage authority
postimage hash/audit is newly computed
```

Evidence classification:

- retained SOURCE3 element/pointer/row contents: **retained-real V11 SOURCE_INSPECTION / independent structural reference**;
- V14 pointer/cardinality identities: **authoritative repository SOURCE_INSPECTION**;
- V11/V14 NODENAME record-shape compatibility: **pinned upstream authoritative SOURCE_INSPECTION**;
- native-v14 Find & Replace Node Name runtime execution: **NOT_RUN**;
- external CAESAR acceptance: **NOT_RUN**.

No NOT_RUN item is claimed as PASS.

## Q5 — Next Contribution / Minimal Patch

Smallest legitimate production patch after independent `PASS_WRITE_ALLOWED`:

### Production

1. `tabs/cii-workspace/cii-workspace-find-replace-csv.js`
   - `rowBlockers()` / block normalization only;
   - admit canonical `NODENAME` (UI may display `NODE NAME`);
   - retain FORCE blocker unchanged.

2. `tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js`
   - add constants for NODENAME pointer row/item and field columns;
   - add CONTROL NONAM correlation;
   - derive all NODENAME pointer owners from exact element blocks;
   - resolve selected exact element to positive pointer + physical row;
   - expose only exact FROM/TO fixed-field spans with node-owner metadata;
   - block pointer zero/out-of-range/count mismatch/field-short/non-ASCII/owner ambiguity.

3. `tabs/cii-workspace/cii-workspace-find-replace-validator.js`
   - add specialized NODENAME whole-field claim builder;
   - exact trimmed semantic-name matching for first priority;
   - replacement ASCII and width checks;
   - construct equal-width full-field `before/after` claims;
   - keep generic equal-Find/Replace-length rule unchanged for DOCUMENT/ELEMENT/DISPLACEMENT.

4. `tabs/cii-workspace/cii-workspace-find-replace.js`
   - add enabled `NODE NAME` / value `NODENAME` option before DISPLACEMENT;
   - leave FORCE disabled/pending.

### Tests

- `tests/cii-workspace-find-replace-scope-resolver.test.js`
  - exact pointer/field resolution;
  - pointer zero/out-of-range;
  - CONTROL count mismatch;
  - distinct-node alias ambiguity.

- `tests/cii-workspace-find-replace-validator.test.js`
  - unequal logical name lengths produce equal 25/26-byte claims;
  - overflow/non-ASCII blocked;
  - exact semantic field match only;
  - unexpected postimage byte still fails.

- `tests/cii-workspace-find-replace-session.test.js`
  - approved manual NODENAME row reaches qualified preview only through valid ownership.

- `tests/cii-workspace-find-replace-ui-registration.test.js`
  - NODE NAME enabled; FORCE remains disabled.

- `tests/cii-workspace-find-replace-retained-real.test.js`
  - retained `SOURCE 3.CII` case `20020 -> 20030`, pointer `1`, TO=`PS-12146`;
  - rename to different logical length while preserving exact total file length;
  - adjacent pointer-zero/non-owner falsifier.

### Unchanged domains

No change expected or authorized in:

```text
cii-workspace-find-replace-executor.js
cii-workspace-find-replace-output.js
Writer1 / Writer2 modules
cii-workspace-nodename.js
V11/V14 converter sources
benchmarks/oracles
FORCE qualification gate
topology
workflows
direct file overwrite controls
```

Executor should remain unchanged because the validator emits physical claims whose before/after widths are already equal.

Stop/rollback boundary:

- if the first focused retained-real case cannot independently reproduce exact pointer/field ownership, stop before mutation promotion;
- if any test shows bytes outside the field changed, revert the Node Name production patch and preserve the failing evidence;
- if V14 source authority contradicts the assumed NODENAME field shape, mark the question set stale and requalify;
- if independent verifier is absent, remain READ_ONLY and do not implement production changes.

## Candidate conclusion

The next contribution is technically well-isolated and has a concrete retained-real falsifier, but this candidate does **not** grant itself engineering-critical write authority. Independent verification remains required by `engineering-pr-delivery-v2`.