# PR1065 — Node Name Find & Replace read-only authority trace

MATERIAL_BASIS_HEAD: e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b
MAIN_HEAD_OBSERVED: d35f6aa419244585afec2c47c8fbd0584011931a
MODE: READ_ONLY_QUALIFICATION
PRODUCTION_MUTATION_AUTHORITY: FALSE

## Owner priority

First implementation priority is Find & Replace of CAESAR II Node Name values.

The intended first safe product route is **Block = NODENAME / NODE NAME** with the existing block-basis schema:

```text
From
To
Find Text
Replace Text
Block
```

This is not a generic document substring replacement. It must resolve physical NODENAME ownership from the selected exact element.

## Current Find & Replace trace

Current PR flow:

```text
CSV/manual row
  -> cii-workspace-find-replace-csv.js
  -> preview / approval
  -> cii-workspace-find-replace-validator.js
  -> cii-workspace-find-replace-scope-resolver.js
  -> immutable TARGET0 claims
  -> cii-workspace-find-replace-executor.js
  -> exact-length TARGET1
  -> independent postimage validation
```

Current blockers:

1. `cii-workspace-find-replace-csv.js` admits only `DISPLACEMENT` and `FORCE` for BLOCK scope. NODENAME is currently `BLOCK_UNSUPPORTED`.
2. `cii-workspace-find-replace-scope-resolver.js` has no NODENAME resolver, so direct intake bypass also fails closed.
3. The generic validator requires `findText.length === replaceText.length`; normal Node Name renames may differ in length even though the physical fixed-width NODENAME field can remain the same width.

## Qualified NODENAME physical model

Repository authority at current main:

- `tabs/cii-workspace/cii-workspace-nodename.js`
  - ELEMENT block = 15 rows.
  - ELEMENT NODENAME pointer = zero-based row 13, numeric field 5 (sixth item).
  - pointer is non-negative integer and positive values are 1-based NODENAME row indexes.
  - NODENAME FROM field = `[2,28)` = 26 bytes.
  - NODENAME TO field = `[28,53)` = 25 bytes.
  - custody records exact byte spans and owners; ambiguous endpoint fallback is blocked for physical write custody.

- `tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js`
  - same FROM/TO fixed-width fields.
  - ASCII-only names.
  - replacement/rebuild preserves physical field width by space padding.
  - CONTROL NONAM must equal NODENAME row count.

- `tabs/cii-workspace/cii-workspace-v14-writer2-fixed-field-authority.js`
  - V14 `NODENAME` cardinality unit = 1 row.
  - CONTROL `0:3` = `CONTROL_NODENAME_NONAM_COUNT`.
  - ELEMENT `13:5` = `ELEMENT_NODENAME_POINTER`.
  - ELEMENT block cardinality = 15 rows.

- Pinned upstream `reallaksh19/3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4/converters/scripts/cii_v11_v14.py`
  - explicitly classifies `NODENAME strings` among record shapes unchanged between qualified V11/V14 profiles.
  - version-specific serialization changes header/EOL; NODENAME payload shape is not version-relocated.

Existing Writer2 V14 bridge authority is intentionally **not** mutation authority for this leg: `docs/cii-writer2-v11-v14-lossless-bridge.md` says equal-cardinality NODENAME payload mutation is blocked in the bridge and V14 Writer1 fixed-field mutation is not qualified there.

## Retained-real independent source case

`Benchmark/CIICompare/SOURCE 3.CII` provides a retained real V11 structural oracle:

```text
ELEMENT 20020 -> 20030
  row13 item6 NODENAME pointer = 1

#$ NODENAME
row 1:
  FROM field = blank
  TO field   = PS-12146
```

Therefore a qualified Node Name resolver for operation:

```text
From=20020
To=20030
Block=NODENAME
Find Text=PS-12146
```

must resolve the exact **TO** fixed-width field of NODENAME row 1 and no other document bytes.

This retained V11 case is an independent structural oracle for pointer/field ownership. It is not by itself native-V14 runtime proof.

## Minimal safe mutation model

For first Node Name support:

1. Resolve exact element `From -> To`; duplicates are ambiguous and block.
2. Read ELEMENT row13 item6 NODENAME pointer.
3. Require pointer > 0 and within physical NODENAME row count.
4. Require CONTROL NONAM equals NODENAME physical row count.
5. Derive both fixed-width field spans for the pointed row.
6. Independently derive all element owners of that pointer/field; if one physical field maps to more than one distinct node identity, block.
7. Match Node Name against the **trimmed field value**, not an arbitrary document substring.
8. Build a whole-field claim:
   - `before` = exact 26/25-byte TARGET0 field;
   - `after` = replacement name space-padded to the same field width;
   - ASCII only;
   - replacement length must not exceed field width.
9. Do not change NODENAME row count, CONTROL NONAM, ELEMENT pointer, section order, line ending, or any unrelated byte.
10. Existing executor/postimage validation can remain unchanged because `before.length === after.length` at the physical claim level.

## Invalid shortcuts

Do not:

- globally replace the Node Name text in DOCUMENT scope and call it NODENAME ownership;
- search the entire NODENAME row without distinguishing FROM vs TO fixed fields;
- use Writer2 or Writer1 as the Find & Replace execution path;
- change CONTROL NONAM or ELEMENT pointers for a same-cardinality rename;
- allow a name to overflow its 26/25-byte field;
- permit non-ASCII bytes without new source qualification;
- accept an ambiguous physical field shared by different node identities;
- treat retained V11 source inspection as native-V14 runtime PASS.

## Expected minimal production patch after qualification

```text
tabs/cii-workspace/cii-workspace-find-replace-csv.js
  admit/canonicalize BLOCK=NODENAME (and UI label NODE NAME)

tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js
  add exact NODENAME pointer/row/field owner resolution and CONTROL count correlation

tabs/cii-workspace/cii-workspace-find-replace-validator.js
  add fixed-width NODENAME field claim construction; generic scopes retain equal-text-length rule

tabs/cii-workspace/cii-workspace-find-replace.js
  add enabled NODE NAME block option
```

Expected focused tests:

```text
tests/cii-workspace-find-replace-scope-resolver.test.js
tests/cii-workspace-find-replace-validator.test.js
tests/cii-workspace-find-replace-session.test.js
tests/cii-workspace-find-replace-ui-registration.test.js
tests/cii-workspace-find-replace-retained-real.test.js
```

No executor change should be required if NODENAME claims are emitted as equal-width whole-field claims.

## Validation state

| Check | Status | Observation | Oracle |
|---|---|---|---|
| current PR/main grounding | PASS | REMOTE_EXECUTION | GitHub |
| current NODENAME intake unsupported | PASS | SOURCE_INSPECTION | implementation |
| current NODENAME resolver absent | PASS | SOURCE_INSPECTION | implementation |
| 15-row ELEMENT / row13 item6 pointer | PASS | SOURCE_INSPECTION | repository + pinned V14 authority |
| NODENAME 1 row/unit / CONTROL 0:3 | PASS | SOURCE_INSPECTION | V14 authority |
| FROM `[2,28)`, TO `[28,53)` fields | PASS | SOURCE_INSPECTION | qualified NODENAME custody |
| V11/V14 NODENAME record shape unchanged | PASS | SOURCE_INSPECTION | pinned upstream converter |
| retained SOURCE3 `20020->20030 -> pointer 1 -> PS-12146` | PASS | SOURCE_INSPECTION | retained-real source |
| native-V14 Node Name mutation execution | NOT_RUN | NOT_OBSERVED | NONE |
| proposed Find & Replace NODENAME tests | NOT_RUN | NOT_OBSERVED | NONE |

No production file is modified by this evidence artifact.