# PR1015 — Writer 2 V11 SIF DELETE Phase-4B

## Current recovery state

```text
HANDOVER_READINESS: READY
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: #1015
BRANCH: agent/cii-writer2-sif-delete-physical
BASE_MAIN: 9a2984cb3b9a60ceccd375104e4cca5248b25122
CURRENT_STAGE: IMPLEMENTED_DRAFT_AWAITING_REPOSITORY_RUNTIME_QUALIFICATION
CRITICALITY: ENGINEERING_CRITICAL
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Mission

Implement the physical transaction for the V11 SIF/TEE existing-block DELETE authority merged in PR1014.

This PR does not add new SIF semantics. CREATE remains fail-closed.

## 2. Authority inherited from PR1014

For V11:

```text
2 tee slots / block
30 numeric values / slot
5 rows / slot
10 rows / block
ELEMENT row13 field5 = 1-based SIF block pointer
CONTROL payload row3 field5 = SIF block count
```

PR1014 already qualifies DELETE planning only and requires shared-pointer all-owner selection.

Mandatory CREATE blocker remains:

```text
WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30
```

Items 27..30 remain unresolved in each V11 tee slot; raw whole-block COPY/default synthesis is not authorized.

## 3. Physical writer implemented

New file:

`tabs/cii-workspace/cii-workspace-writer2-sif-delete-write.js`

Only three original-preimage replacement classes are permitted:

```text
1. CONTROL_SIF_TEE_COUNT
2. ELEMENT_SIF_TEE_POINTER
3. SIF_TEE_SECTION_PAYLOAD
```

### CONTROL

- CONTROL payload row 3, field 5.
- 13-byte fixed span after the 15 + 13 + 13 + 13 column prefix.
- Preimage must equal canonical right-aligned integer text.
- Postimage is the independently planned after-count.

Canonical benchmark `BM_CII_TARGET1.CII` shows the V11 SIF count as integer `9` in this exact field.

### ELEMENT pointers

- Uses exact pointer spans carried by the merged PR1014 custody plan.
- Every changed pointer preimage is checked against untouched TARGET bytes.
- Postimage uses the existing six-significant-digit fixed-field Writer formatter.

### SIF payload

- Finds `#$ SIF&TEES` or legacy `#$ SIF` section.
- Raw payload row count must equal `10 * blockCountBefore`.
- Every retained block is copied from original byte spans, row by row, including its original line ending.
- No internal SIF field is parsed, normalized, defaulted, or reserialized during DELETE.
- Selected complete 10-row blocks disappear; retained blocks compact in original order.
- Deleting all blocks leaves the section marker and next marker intact with an empty payload.

## 4. Independent validator implemented

New file:

`tabs/cii-workspace/cii-workspace-writer2-sif-delete-validation.js`

Trust model:

```text
untouched TARGET + targetGraph + bound transfer plan
 -> independently rebuild PR1014 relocation plan
 -> independently derive CONTROL / pointer / SIF payload replacements
 -> independently construct complete variable-length expected postimage

PASS only if actual post bytes == independent expected post bytes
```

Writer testimony does not define authorization.

Additional checks:

- post-write V11 SIF physical custody remains QUALIFIED;
- CONTROL after-count matches;
- SIF row count = `10 * blockCountAfter`;
- complete ELEMENT SIF pointer snapshot matches;
- connectivity unchanged;
- section order unchanged;
- Writer mutation testimony matches independent replacement testimony;
- Writer relocation testimony matches independent plan;
- CREATE authority remains blocked.

Validator pointer formatting is independent from the production Writer formatter.

## 5. Regression authored

New file:

`tests/cii-workspace-writer2-sif-delete-physical.test.js`

Cases:

### Middle-block deletion

```text
before pointers: 1,2,3
delete block:       2
after pointers:  1,0,2
CONTROL:          3 -> 2
SIF rows:        30 -> 20
```

Asserts retained payload is exactly original block 1 + original block 3.

### Delete all

```text
CONTROL: 3 -> 0
ELEMENT pointers: 1,2,3 -> 0,0,0
SIF payload rows: 30 -> 0
```

### Negative assurance

- unrelated VERSION-row byte mutation -> exact-postimage failure;
- forged Writer mutation ledger -> testimony mismatch failure.

## 6. Validation truth

```text
PR1014 merge / branch grounding                       PASS
canonical V11 CONTROL SIF-count representation        PASS_SOURCE_INSPECTION
new Writer source audit                               PASS_SOURCE_INSPECTION
new validator source audit                            PASS_SOURCE_INSPECTION
focused physical regression source                    AUTHORED_NOT_RUN_ENVIRONMENT
exact repository checkout                             BLOCKED_ENVIRONMENT_DNS
full repository tests                                 NOT_RUN_ENVIRONMENT
inherited Writer1 / Writer2 NODENAME regressions      NOT_RUN_ENVIRONMENT
browser/product flow                                  NOT_RUN_ENVIRONMENT
real CII SIF DELETE export/re-intake                   NOT_RUN_ENVIRONMENT
```

Exact checkout attempt:

```text
fatal: unable to access 'https://github.com/reallaksh19/XML_Compare_Utilities.git/':
Could not resolve host: github.com
```

No unexecuted test is represented as PASS.

## 7. Changed-file ledger

Production/test files:

```text
tabs/cii-workspace/cii-workspace-writer2-sif-delete-write.js
tabs/cii-workspace/cii-workspace-writer2-sif-delete-validation.js
tests/cii-workspace-writer2-sif-delete-physical.test.js
```

Recovery files:

```text
agents/PR1015_workreport.md
agents/status/PR1015.yaml
agents/claims/PR1015.yaml
agents/MASTER_INDEX.md
```

No protected converter, fixed-field parser, benchmark, workflow, Writer1 implementation, or PR1014 planner is modified.

## 8. Critical next architecture gate

Do **not** product-route SIF DELETE by applying it after or before the existing Writer-2 NODENAME writer.

Both families can change byte length. Sequential execution would make second-pass byte offsets depend on first-pass output and would violate the one-original-preimage authority model.

The successor should create a Writer-2 composite transaction:

```text
one untouched TARGET
 |-- NODENAME Phase-4A relocation plan -> original-coordinate replacements
 |-- SIF DELETE PR1014 relocation plan -> original-coordinate replacements

all Writer2 replacements
 -> cross-family same-span/overlap arbitration
 -> one original-preimage patch
 -> re-intake
 -> independent reconstruction of both family postimages
 -> exact complete expected final byte stream
```

The two current families should normally be disjoint:

```text
CONTROL.NONAM                vs CONTROL SIF count
ELEMENT NODENAME pointer     vs ELEMENT SIF pointer
NODENAME payload             vs SIF&TEES payload
```

But disjointness must be proven from physical spans, never assumed.

Only after that composite is qualified should `writerVersion=2` product routing support NODENAME + SIF DELETE together.

## 9. Still out of scope

- SIF CREATE;
- unresolved V11 items 27..30;
- SIF raw source-block copy;
- hanger create/delete;
- HGRDAT/MISCEL packed-array relocation;
- generic auxiliary insertion/deletion;
- Writer3 node/element/connectivity topology mutation.

# Appendix A — takeover qualification

1. Why can SIF DELETE preserve an opaque retained block while SIF CREATE cannot synthesize one?
2. Which exact CONTROL row/field stores the V11 SIF block count?
3. Why does deleting block 2 from 1,2,3 require rewriting the pointer that previously referenced block 3?
4. Why must retained 10-row blocks be copied from original bytes rather than formatted from parsed numeric values?
5. How does the validator reconstruct the expected complete postimage independently of Writer testimony?
6. Why is `D_actual subset S_auth` insufficient as the primary proof after block deletion?
7. What prevents partial deletion of a block shared by multiple ELEMENT owners?
8. Why must the next NODENAME+SIF Writer2 integration be one-preimage composition rather than sequential writers?
9. What three pairs of physical authorities are expected to be disjoint in that composite?
10. What exact source blocker keeps SIF CREATE closed?
