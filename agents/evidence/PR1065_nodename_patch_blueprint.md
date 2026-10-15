# PR1065 Node Name Find & Replace — pre-authorized patch blueprint

CHAIN_ID: CII-FIND-REPLACE-V14
MATERIAL_BASIS_HEAD: e28e33aa9e7927d2d8e7f5532660108eb1fe4b7b
STATUS: READ_ONLY_BLUEPRINT
PRODUCTION_MUTATION_AUTHORIZED: FALSE

This file is an implementation blueprint only. It does not modify production/test code and does not grant write authority.

## Product intent

First priority: safe CAESAR II v14 Node Name rename on an exact owned NODENAME fixed field.

Input contract remains the existing Block schema:

```csv
From,To,Find Text,Replace Text,Block
20020,20030,PS-12146,NODE-20030,NODENAME
```

The same contract applies to manual table entry.

## Production patch blueprint

### 1. Intake — `cii-workspace-find-replace-csv.js`

Current block allowlist:

```text
FORCE
DISPLACEMENT
```

Authorized future change after verifier PASS:

```text
NODENAME
DISPLACEMENT
FORCE (recognized but still BLOCKED)
```

Rules:

- normalize `NODE NAME`, `NODE_NAME`, and `NODENAME` only if a normalization function is added deliberately; otherwise UI/CSV canonical value stays `NODENAME`;
- no generic global-node-name special case in DOCUMENT scope;
- no changes to ELEMENT or DISPLACEMENT semantics;
- FORCE blocker remains exactly active.

### 2. Scope resolver — `cii-workspace-find-replace-scope-resolver.js`

Add constants:

```text
ELEMENT_NODENAME_POINTER_ROW   = 13
ELEMENT_NODENAME_POINTER_FIELD = 5
NODENAME_FROM_START            = 2
NODENAME_FROM_END              = 28
NODENAME_TO_START              = 28
NODENAME_TO_END                = 53
NODENAME_ROW_WIDTH             = 53
CONTROL_NODENAME_ROW           = 0
CONTROL_NODENAME_FIELD         = 3
```

Required read-only derivation sequence:

```text
TARGET0 physical lines
  -> exact 15-row ELEMENT blocks
  -> exact selected From/To block
  -> row13 field6 integer pointer
  -> CONTROL NONAM count
  -> NODENAME physical nonblank rows
  -> count correlation
  -> pointer range
  -> exact NODENAME row
  -> exact FROM / TO fields
  -> global field owner map
  -> unique node identity per physical field
```

The resolver must build owner sets from all exact ELEMENT blocks, not only the selected element.

For each positive pointer:

- pointer maps to one NODENAME row (`pointer - 1`);
- FROM field owner node is the element `from` node;
- TO field owner node is the element `to` node;
- ownership key is the physical byte span of that fixed field;
- multiple owners are acceptable only when every owner has the same node ID;
- multiple distinct node IDs on one field => BLOCK.

Selected operation behavior:

- pointer zero => BLOCK;
- pointer unreadable => BLOCK;
- pointer > NODENAME row count => BLOCK;
- CONTROL NONAM != NODENAME row count => BLOCK;
- selected element identity not exact/unique => existing BLOCK;
- row shorter than 53 columns => BLOCK;
- field contains non-byte/non-ASCII content => BLOCK;
- no FROM/TO semantic field exactly equals `Find Text` after trim => validator gets zero matches / BLOCK;
- both FROM and TO fields matching the same Find Text may each be emitted as separately owned spans only if both owner maps are individually unambiguous.

Proposed authority label:

```text
CII_V14_ELEMENT_NODENAME_POINTER_FIXED_FIELD
```

Evidence should include:

```text
from
to
elementIndex
pointer
rowIndex
controlCount
rowCount
field spans + endpoint + nodeId + owner count
```

### 3. Validator — `cii-workspace-find-replace-validator.js`

Do not weaken the generic fixed-width rule.

Branch only for:

```text
scope === BLOCK && block === NODENAME
```

NODENAME matching semantics for this first authority slice:

- match the entire semantic name: `exactField.trim() === findText`;
- no substring, regex, case folding, wildcard, or trim of user Find Text beyond existing intake behavior;
- replacement must be ASCII / byte-safe;
- replacement logical length must be <= selected field width;
- create `before` from the exact TARGET0 physical full field;
- create `after = replaceText.padEnd(fieldWidth, ' ')`;
- claim start/end cover the complete 26-byte FROM or 25-byte TO field;
- `expectedMatches` applies to semantic owned-field matches;
- claims remain original-coordinate and overlap arbitration remains unchanged.

This means unequal logical lengths are safe without changing executor semantics because physical before/after widths remain equal.

Suggested NODENAME blockers:

```text
NODENAME_CONTROL_COUNT_MISMATCH
NODENAME_POINTER_REQUIRED
NODENAME_POINTER_OUT_OF_RANGE
NODENAME_ROW_TOO_SHORT
NODENAME_FIELD_NON_ASCII
NODENAME_FIELD_OWNER_AMBIGUOUS
NODENAME_REPLACEMENT_NON_ASCII
NODENAME_REPLACEMENT_WIDTH_EXCEEDED
NO_MATCHES_IN_SCOPE
```

Exact names can be adapted to current error style, but fail-closed distinctions should remain visible.

### 4. UI — `cii-workspace-find-replace.js`

Block selector order:

```text
NODE NAME       value=NODENAME       enabled
DISPLACEMENT    value=DISPLACEMENT   enabled
FORCE           value=FORCE          disabled / qualification pending
```

No change to Direct Apply state.

## Tests blueprint

### Scope resolver focused tests

Add a minimal synthetic fixture with:

- CONTROL NONAM = 1;
- one exact 15-row ELEMENT block;
- row13 field6 pointer = 1;
- one 53-column NODENAME row;
- selected TO field name.

Positive assertions:

- status PASS;
- pointer = 1;
- field endpoint TO;
- width = 25;
- nodeId equals element TO node;
- span is physical whole field.

Falsifiers:

- pointer zero;
- pointer out of range;
- CONTROL count mismatch;
- row < 53 columns;
- duplicate exact element identity;
- one physical field owned by different node IDs;
- FORCE remains BLOCKED.

### Validator focused tests

Positive:

```text
find    PS-12146
replace NODE-20030
```

Expected:

- logical lengths differ;
- preimage PASS;
- one claim;
- physical before length = 25;
- physical after length = 25;
- after is right-padded;
- executor can consume unchanged.

Falsifiers:

- 26+ characters in TO field replacement;
- >26 characters in FROM field replacement;
- non-ASCII replacement;
- substring Find Text that is not the entire trimmed semantic field;
- unexpected byte outside the fixed field causes postimage validation FAIL.

### Session test

Manual operation:

```text
mode    BLOCK
block   NODENAME
from    20020
to      20030
find    PS-12146
replace NODE-20030
```

After approval and qualification on a valid v14 fixture:

- status `QUALIFIED_PREVIEW`;
- `canApply` remains false;
- output remains safe new-file download only.

### UI source contract

Require:

- enabled option value `NODENAME` with visible `NODE NAME`;
- enabled DISPLACEMENT remains;
- FORCE remains disabled;
- Direct Apply remains disabled.

### Retained-real SOURCE3 test

Use `Benchmark/CIICompare/SOURCE 3.CII` only for retained-real V11 structural ownership evidence:

- exact element `20020 -> 20030`;
- row13 sixth field pointer `1`;
- row1 TO semantic name `PS-12146`;
- adjacent element with zero pointer cannot own the same rename;
- physical 25-byte claim model is independently reconstructed.

Do not label this native-v14 runtime PASS.

## Native-v14 gate after implementation

A native-v14 fixture remains required before promotion beyond source-qualified preview behavior.

Minimum native-v14 execution evidence:

1. version detector returns 14;
2. exact NODENAME pointer/field resolver reproduces expected owner;
3. approved rename produces equal-width whole-field claim;
4. postimage passes independent byte validator;
5. total file length unchanged;
6. CONTROL count and all ELEMENT pointers unchanged;
7. output re-intake remains structurally valid;
8. no external CAESAR acceptance is inferred unless actually executed.

## Explicit non-scope

No changes authorized by this blueprint to:

```text
cii-workspace-find-replace-executor.js
cii-workspace-find-replace-output.js
cii-workspace-find-replace-session.js (unless an actual test falsifies the assumption)
cii-workspace-nodename.js
Writer1 / Writer2
3D_Converters
FORCE
benchmarks/oracles/tolerances
workflows
topology
direct source overwrite
```

## Stop conditions

Stop and preserve evidence if any of these occur:

- verifier does not grant `PASS_WRITE_ALLOWED`;
- material basis changes in production/test/source authority;
- native-v14 source authority contradicts NODENAME fixed-field shape;
- resolver cannot establish unique physical field ownership;
- postimage changes bytes outside owned fields;
- implementing NODENAME requires CONTROL/pointer/cardinality edits for a rename;
- a proposed shortcut needs Writer2 execution or global document mutation.
