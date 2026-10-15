# CII Compare Workspace — Concept Note and Implementation Roadmap

**Document:** `docs/CIIcompareconceptnote.md`  
**Repository:** `reallaksh19/XML_Compare_Utilities`  
**Authority direction:** `SOURCE CII -> TARGET CII`  
**Live-state rule:** GitHub `main`, PR state and repository work reports are authoritative for merge/execution state.  
**Engineering baseline:** PRs #982–#1001 establish fixed-field parsing, Method A/B identity, independent multi-base correspondence, engineering deltas, Writer 1A/1B, full-screen review, and explicit APPLY/EXCLUDE mutation-scope custody. PR #1001 merged at `5a5fa0ae5068a7c15eecc1a57557e71336b9754c`.  
**Primary objective:** compare revised CAESAR II neutral CII models, prove local identity without relying on node-number offsets, expose engineering deltas separately from identity, and mutate TARGET only through explicitly scoped, source-qualified writer authority with byte-level negative assurance.

---

# 1. Product purpose

CII Workspace must handle revisions containing:

- node renumbering;
- several independent local geometry changes;
- inserted/deleted/rerouted piping regions;
- OD or wall changes;
- process/load-case field changes;
- restraint/support changes;
- SIF/tee changes;
- rigid weight changes;
- hanger changes;
- node-name changes;
- future pointer/cardinality changes.

The product answers four independent engineering questions:

1. **Input qualification** — what is parsed, qualified, partial, unsupported, or blocked?
2. **Identity / correspondence** — what SOURCE object corresponds to what TARGET object and what independent local evidence supports that claim?
3. **Engineering difference / approval** — after identity is established, what changed and what has the engineer accepted/rejected/locked?
4. **Qualified mutation** — which approved deltas are explicitly APPLY versus EXCLUDE, and which APPLY operations are actually supported by the selected Writer authority?

These questions must never be collapsed into one score or one generic “matched” state.

---

# 2. Non-negotiable engineering principles

## 2.1 Fixed-field CII custody

CII is fixed-format engineering data. Whitespace tokenisation is not authoritative.

For the qualified ELEMENT header row the canonical six-field widths are:

```text
[15, 13, 13, 13, 13, 13]
```

with engineering order:

```text
FROM, TO, DX, DY, DZ, DIAMETER
```

Adjacent legal fields such as:

```text
0.000000-0.488281E-03
```

must remain parseable.

A missing/unparsed diameter must not silently become `0`.

The protected external converter/writer remains format authority and is not modified merely to make CII Workspace pass:

```text
converters/scripts/inputxml_to_cii2019.py
```

For Writer 1C, **the original TARGET byte stream is the physical authority**. Intake may expose decoded text for parsing and UI, but mutation SHA custody is over original bytes. Writer 1C must patch qualified, equal-width pre-existing byte spans in that byte stream; it must not reconstruct or reserialize the complete CII from parsed text/objects merely to edit an auxiliary field.

## 2.2 Identity, delta, mutation scope, and Writer authority are separate

Authoritative pipeline:

```text
PARSE
  -> QUALIFY INPUT
  -> DISCOVER / ACCEPT LOCAL BASES
  -> ESTABLISH CORRESPONDENCE
  -> ARBITRATE CROSS-BASE CLAIMS
  -> REVIEW IDENTITY
  -> CALCULATE ENGINEERING DELTAS
  -> CLASSIFY TRANSFER OPERATIONS
  -> BIND EXPLICIT APPLY / EXCLUDE SCOPE
  -> WRITER READINESS ON APPLY SET ONLY
  -> QUALIFIED WRITER
  -> REPARSE / NEGATIVE ASSURANCE
  -> SCOPED AUDIT / EXPORT
```

Never route a raw candidate, an approved identity, or an unbound proposal directly into Writer 1A/1B/1C.

## 2.3 Node numbering is not identity authority

Never implement:

```text
targetNode = sourceNode + constantOffset
```

The real `SOURCE 3.CII -> TARGET 3-1.CII` benchmark contains multiple valid local numbering relationships in one model pair. A single global node offset is therefore mathematically invalid as correspondence authority.

Node numbers remain labels/identities inside their own file only.

## 2.4 OD is tolerance scale only

The common physical tolerance is:

```text
T = x * SOURCE_OD
```

with current default:

```text
x = 2.0
```

SOURCE OD authority at a node is the minimum positive incident SOURCE OD. TARGET OD does not change identity tolerance.

Required invariance:

```text
same SOURCE geometry + same SOURCE OD
TARGET OD changed by revision
=> identity tolerance unchanged
```

If a method requires OD-scaled tolerance and no qualified positive SOURCE OD exists:

```text
SOURCE_OD_TOLERANCE_UNAVAILABLE
=> REVIEW / UNAVAILABLE
```

No hidden fixed-mm fallback is permitted.

## 2.5 Local geometry changes require independent local bases

Complex piping revisions may contain:

```text
stable region A
    |
changed / inserted / rerouted region
    |
stable region B
    |
other changed region
    |
stable region C
```

The architecture is therefore:

```text
BASE A OR BASE B OR BASE C ...
```

Separate Method-A bases may own different local rigid transforms. Do not force them to agree globally and do not average incompatible transforms.

## 2.6 Method A and Method B are independent OR evidence

At each local region:

```text
METHOD A — Spatial
        OR
METHOD B — Network
```

If both independently qualify and identify the same pair, they corroborate.

If both independently qualify but identify different targets:

```text
AMBIGUOUS
```

Canonical combination:

```text
OR_WITH_CONFLICT_VETO
```

No majority vote. No first-success winner. No score summation that overrides a contradiction.

## 2.7 One-to-one identity custody

Fail closed on READY claims of:

```text
same SOURCE -> different TARGETS
```

or:

```text
different SOURCES -> same TARGET
```

Those are custody conflicts, not confidence-ranking problems.

## 2.8 Explicit transfer scope is mutation custody

Every mutable candidate operation must have exactly one explicit decision:

```text
APPLY
EXCLUDE
```

A bound transfer scope includes:

```text
SOURCE content SHA-256
TARGET content SHA-256
exact mutable operation-ID set
one decision per mutable operation
```

The scope is invalid if SOURCE/TARGET hashes change, an expected operation disappears, a new operation appears, a decision is duplicated, or a decision is invalid.

`EXCLUDE` means:

```text
retain operation in audit custody
remove operation from Writer operations[]
keep effective TARGET equal to current TARGET
```

It does not mean “pretend unsupported mutation is KEEP.”

A selected unsupported APPLY remains a Writer blocker.

All EXCLUDE means no mutation authority:

```text
TRANSFER_SCOPE_NO_APPLY_OPERATIONS
```

---

# 3. Method A — local spatial registration

## 3.1 Minimum geometry

```text
1 anchor  -> UNDERDETERMINED / translation only
2 anchors -> UNDERDETERMINED / rotation about common axis unresolved
>=3 non-collinear pairs -> candidate rigid 3D basis
```

## 3.2 Local-basis hypothesis policy

For one local Method-A base:

1. enumerate non-collinear 3-anchor combinations;
2. derive rigid transform;
3. test transform against all local anchors;
4. normalize every residual by its own SOURCE-OD tolerance;
5. reject any hypothesis with normalized residual > 1;
6. compare all remaining transforms for material disagreement;
7. return `METHOD_A_AMBIGUOUS_BASES` when materially different admissible transforms remain;
8. otherwise select the deterministic best admissible transform.

No coordinate averaging and no Kabsch-style compromise across incompatible local bases.

## 3.3 Residual qualification

For anchor `i`:

```text
T_i = x * SOURCE_OD_i

e_i = residual_i / T_i

max(e_i) <= 1
```

Basis-agreement displacement tolerance is based on:

```text
x * minimum qualified SOURCE OD in the local base
```

## 3.4 Method-A weight

Current 100-point decomposition:

```text
Residual quality              35
Geometric conditioning        25
Spatial extent                20
Anchor redundancy             10
Basis consensus               10
                             ---
                             100
```

Current confidence policy:

```text
HIGH    >= 85
MEDIUM  >= 70
REVIEW  otherwise
```

Automatic discovery additionally caps a 3-anchor base at REVIEW until a fourth pair validates the transform.

---

# 4. Method B — local pipe-run/network basis

## 4.1 Hard two-axis gate

Method B cannot be qualified unless SOURCE and TARGET each contain at least two independent, non-truncated, cross-compatible PIPE runs around the candidate node.

Current independent-run angle threshold:

```text
15 degrees
```

One long straight run is still one axis regardless of element count.

## 4.2 Run extraction

Starting from the candidate node, follow incident PIPE rays and merge collinear segments until terminal, branch, component transition, direction change, invalid data, or traversal limit.

Opposite collinear rays form one undirected run. X/Y/Z labels are presentation only.

## 4.3 OD-scaled run compatibility

Run length:

```text
|L_SOURCE - L_TARGET| <= x * SOURCE_OD
```

Angular mismatch becomes equivalent displacement:

```text
d_angle = 2 * L_characteristic * sin(delta_theta / 2)

d_angle <= x * SOURCE_OD
```

## 4.4 Compatible geometry complexity

Only cross-revision-compatible runs earn geometry complexity credit:

```text
<2 compatible independent runs             0 / 40
2 compatible independent runs             24 / 40
3+ compatible coplanar runs               32 / 40
3+ compatible non-coplanar runs           32 + 8*V
```

where:

```text
V = |u1 dot (u2 cross u3)|
```

Orthogonal compatible XYZ gives `40/40`.

## 4.5 Method-B weight

Current 100-point decomposition:

```text
Compatible geometry complexity          40
Run geometry compatibility              20
Terminator/topology fingerprint         15
Neighbourhood structural agreement      15
Mutual-best + winner-gap quality        10
                                        ---
                                        100
```

Hard gates remain separate from score.

Current confidence policy:

```text
HIGH:
  run basis READY
  mutual-best
  winner gap >= max(required, 12)
  total >= 80

MEDIUM:
  run basis READY
  mutual-best
  winner gap >= required
  total >= 65

otherwise REVIEW
```

Node-number offset, OD equality, wall equality, and process equality earn no Method-B identity weight.

---

# 5. Product information architecture

Permanent workflow tabs:

```text
1. Inputs & Match Basis
2. Compare Review
3. Transfer Preview
```

The UI is a presentation and selection layer. It must not become a second matching engine, a second transfer classifier, or a second Writer policy engine.

## 5.1 Inputs & Match Basis

Show SOURCE/TARGET filename, hash, CII version when available, parse/capability status, element/node counts, branches, terminals, bends, rigids, auxiliary-family state, and unresolved limitations.

States must remain distinct:

```text
PARSED
EMPTY
NOT_PARSED
UNSUPPORTED
PARSE_ERROR
```

Engineer selection of method-qualified cards projects to explicit independent `baseLoops[]`.

A Method-A card contributes the whole validated local base. A Method-B card contributes one network loop. `METHOD_A_AND_B` contributes two independent loops, not one fused pseudo-method.

Conflicting selections are preserved to core arbitration; the UI must not deduplicate away a true conflict.

## 5.2 Compare Review

Primary grid shows identity decision, confidence, SOURCE, TARGET, M1/M2 evidence, OD/WT evidence, winner gap, change families, and structured evidence.

REVIEW and UNRESOLVED rows are never bulk accepted.

## 5.3 Engineering Delta Grid

Identity must be bound before engineering deltas are authoritative.

Primary columns:

```text
Approval
Identity
Category / property
SOURCE candidate
Current TARGET
Effective TARGET after apply
Engineering change
Evidence / authority
```

Identity ACCEPT/LOCK is not mutation APPLY.

## 5.4 Transfer Preview

Before transfer scope binding:

```text
Effective TARGET after apply = Current TARGET
```

After scope binding:

```text
APPLY + Writer READY -> Effective TARGET = selected proposal
EXCLUDE               -> Effective TARGET = Current TARGET
BLOCKED / PROTECTED   -> Effective TARGET = Current TARGET
```

After scope binding, export controls must emit the scoped audit so the mutation-authority artifact cannot disagree with the UI.

---

# 6. Writer authority model

Writer phases are defined by **ownership, pointer stability, row-count stability, and topology impact**, not by UI family name.

A higher Writer version may eventually compose lower Writer versions, but composition is itself transaction authority and must be separately qualified. **Phase-1 Writer 1C does not automatically inherit mixed Writer 1A/1B mutation authority.**

Long-term composition principle:

```text
Writer 1C
  delegates Writer-1A operations to Writer 1A
  delegates Writer-1B operations to Writer 1B
  applies only qualified Writer-1C operations itself
```

Current Phase-1 authority:

```text
NODENAME Writer-1C APPLY operations only
+ all other mutable operations explicitly EXCLUDE
```

A transaction containing Writer-1A/1B APPLY together with Writer-1C APPLY remains blocked until the complete mixed transaction has equivalent original-byte negative-assurance qualification.

Every Writer must enforce:

- exact TARGET hash / stale-target protection;
- exact target preimage value before patch;
- field/column width limits;
- deterministic mutation reporting;
- no silent row insertion/deletion unless its Writer phase explicitly owns cardinality;
- reparse after mutation;
- expected semantic delta confirmation;
- unexpected semantic delta count = 0;
- negative assurance against an **independently derived authorized physical span set**, not merely against Writer-reported claims.

For Writer 1C, define:

```text
S_auth = validator-derived authorized physical byte spans
B      = Writer-reported mutation spans (audit testimony)
D      = actual byte-difference indices
```

PASS requires at minimum:

```text
D ⊆ S_auth
B == expected reported authorization set
exact preimage/postimage at every S_auth span
all structural invariants preserved
expected semantic deltas only
unexpected semantic delta count = 0
```

`B` never defines `S_auth`.

## 6.1 Writer 1A — existing cardinality-preserving numeric fields

Qualified examples:

- WT;
- P1/T1/T2;
- existing RIGID weight;
- deterministic existing restraint numeric pairing.

Geometry, node numbering, connectivity, pointers, and section cardinality remain protected.

## 6.2 Writer 1B — extended existing/fixed-capacity fields

Qualified examples:

- additional ELEMENT process fields;
- conditional OD on topology-closed plain-pipe/no-reducer paths;
- qualified use of an existing free restraint slot inside an already-owned fixed six-slot restraint block;
- qualified clearing of an existing restraint slot;
- existing numeric restraint mutations inherited from 1A.

Writer 1B does not acquire authority merely because an operation is selected APPLY. Transfer scope selects operations; Writer policy still decides whether they are writable.

## 6.3 Writer 1C — pointer-stable existing auxiliary-record writer

### Definition

Writer 1C is **not** “all remaining Writer 1B blockers.”

Writer 1C owns only mutations satisfying all of these structural gates:

```text
TARGET auxiliary row/block already exists
AND pointer value remains unchanged
AND pointer index remains unchanged
AND section row count remains unchanged
AND CONTROL counts remain unchanged
AND no record is inserted/deleted/reordered
AND no element/node/connectivity is created/deleted/renumbered
AND exact record ownership is proven
AND exact field semantics or byte-slice custody is source-qualified
AND mutation is explicitly APPLY in the bound transfer scope
AND original TARGET byte authority is retained
AND apply-time physical custody still matches preview custody
```

If any gate fails, the operation remains Writer 2/3 territory.

Governing Phase-1 statement:

> Writer 1C does not rewrite a CII file. Writer 1C patches a finite set of independently authorized, pre-existing physical byte spans in an otherwise immutable CII byte stream.

### 6.3.1 Writer 1C first mandatory slice — existing NODENAME row fields

Current source custody is in:

```text
tabs/cii-workspace/cii-workspace-nodename.js
```

Qualified fixed-layout evidence:

```text
ELEMENT block rows                  15
NODENAME pointer ELEMENT row index  13 (zero-based within block)
NODENAME pointer numeric field      fixed numeric field [67,80) zero-based on that row
NODENAME row FROM slice             [2, 28) zero-based
NODENAME row TO slice               [28, 53) zero-based
```

Physical custody must retain, for every writable field:

```text
TARGET ELEMENT identity / parsed element index
pointer value
referenced NODENAME row index
FROM or TO field identity
absolute byte start/end
exact preimage bytes
all physical owners / aliases of that span
```

Custody is persisted at intake and re-derived at apply. Pointer/row/span ownership drift blocks mutation.

Initial Writer-1C NODENAME authority supports only:

```text
existing TARGET pointer > 0
existing TARGET NODENAME row present
existing referenced row ownership qualified
SOURCE/TARGET node identity bound
SOURCE name fits qualified field width and encoding
patch field in place in original bytes
preserve pointer and row count
```

Required conservative policy:

- no creation of a new NODENAME row when target pointer is zero;
- no pointer update;
- no section-row insertion/deletion;
- no automatic nonblank TARGET overwrite unless existing overwrite policy explicitly allows it;
- no removal of the whole record when both fields become blank unless a separate cardinality policy proves it safe;
- if one physical NODENAME span is owned by multiple elements/nodes, derive one canonical desired post-state;
- same physical span + different desired bytes => block;
- same physical span + identical desired bytes => canonicalize only when the complete owner set is compatible;
- an unselected alias that would be changed => block.

Writer 1C blockers include:

```text
WRITER_1C_NODENAME_POINTER_REQUIRED
WRITER_1C_NODENAME_ROW_OUT_OF_RANGE
WRITER_1C_NODENAME_LAYOUT_DRIFT
WRITER_1C_NODENAME_FIELD_OVERFLOW
WRITER_1C_NODENAME_PREIMAGE_MISMATCH
WRITER_1C_NODENAME_SHARED_RECORD_CONFLICT
WRITER_1C_NODENAME_UNAPPROVED_ALIAS_EFFECT
WRITER_1C_NODENAME_CREATE_REQUIRES_WRITER_2
WRITER_1C_NODENAME_RECORD_DELETE_REQUIRES_WRITER_2
```

### 6.3.2 Writer 1C second slice — existing SIF/TEE 10-row block fields

Current pointer/block custody is source-qualified by:

```text
tabs/cii-workspace/cii-workspace-auxiliary.js
```

Current structural evidence:

```text
SIF/TEE block size        10 rows
ELEMENT pointer authority 1-based block index
existing block ownership  pointer-bound
```

But current semantic authority is intentionally partial:

```text
FIELD_2_SEMANTICS_UNQUALIFIED
normalized raw payload only
```

Therefore Writer 1C must **not** simply copy the raw 10-row SOURCE payload into TARGET.

Before any SIF/TEE field becomes writable, the new agent must establish a source-qualified field map from authoritative converter/format code and canonical fixtures. Each writable field requires:

```text
section
block row
field/column span
numeric/text format
engineering meaning
unit basis if applicable
zero/blank semantics
allowed domain
pointer ownership
preimage expectation
```

Only same-block, same-pointer, same-row-count field replacement may enter Writer 1C.

Explicitly excluded from 1C:

```text
SIF/TEE record presence CREATE
SIF/TEE record presence DELETE
new SIF/TEE block allocation
pointer renumbering
section compaction
CONTROL count changes
```

Those remain Writer 2.

Required blockers include:

```text
WRITER_1C_SIF_FIELD_MAP_UNQUALIFIED
WRITER_1C_SIF_POINTER_REQUIRED
WRITER_1C_SIF_BLOCK_OUT_OF_RANGE
WRITER_1C_SIF_LAYOUT_DRIFT
WRITER_1C_SIF_SHARED_BLOCK_CONFLICT
WRITER_1C_SIF_PREIMAGE_MISMATCH
WRITER_1C_SIF_CARDINALITY_CHANGE_REQUIRES_WRITER_2
```

### 6.3.3 Optional later 1C slice — existing auxiliary text fields

Existing restraint TAG/GUID or other text rows may be considered only after engineering deltas and exact string-layout custody are added. They are not implicitly authorized by existing numeric restraint-slot authority.

### 6.3.4 Hangers are not Writer 1C scope

Current hanger qualification proves:

```text
CONTROL.NOHGRS
MISCEL_1.IHGRNODE membership
node presence/count
```

but intentionally does not normalize:

```text
HGRDAT
TAG
GUID
other hanger attributes
```

Current code also supports more than one physical MISCEL_1 layout and resolves them only for node-presence evidence.

Therefore Writer 1C must not mutate hanger presence/count or HGRDAT. Hanger creation/deletion shifts packed arrays and/or CONTROL/cardinality and belongs to Writer 2 unless a separate qualification programme proves an in-place fixed-capacity representation.

## 6.4 Writer 2 — pointer/cardinality-aware auxiliary mutation

Writer 2 owns mutations that change auxiliary-record allocation or indices while preserving the piping topology itself.

Examples:

- create/delete NODENAME rows and update ELEMENT pointers;
- create/delete SIF/TEE 10-row blocks;
- reindex affected SIF/NODENAME pointers;
- create/delete hanger records and update `CONTROL.NOHGRS` and `MISCEL_1` packed arrays;
- create/delete auxiliary sections;
- compact or expand auxiliary arrays;
- any operation requiring deterministic pointer re-numbering or count maintenance.

Writer 2 requires a transaction-level relocation plan, not individual line patches. Every changed pointer/count must be derived from the post-mutation section layout.

## 6.5 Writer 3 — structural model mutation

Writer 3 owns model-defining topology changes:

- create/delete nodes;
- create/delete elements;
- connectivity changes;
- element split/merge;
- structural section rebuild;
- topology-sensitive pointer cascades caused by element insertion/deletion.

Writer 3 requires a separate qualification programme and must not be implemented by “editing more fields” inside Writer 1C/2.

---

# 7. Anti-drift qualification programme

Writer development is disqualified if the implementation only proves “the intended field changed.” It must also prove that **everything else did not drift**.

## 7.1 Structural invariant tests

For every Writer 1C mutation:

```text
file byte length                 unchanged for Phase-1 fixed-width NODENAME replacement
physical line count              unchanged
line-ending sequence             unchanged
section ordering                 unchanged
ELEMENT block count              unchanged
ELEMENT block row count          unchanged
all ELEMENT pointers             unchanged
CONTROL values                   unchanged
NODENAME section row count       unchanged
SIF/TEE section row count        unchanged
RESTRANT section row count       unchanged
RIGID section row count          unchanged
MISCEL_1 row count               unchanged
node count                       unchanged
element count                    unchanged
connectivity                     unchanged
```

For Writer 1C, any pointer or row-count change is a hard failure, even when the resulting CII still parses.

## 7.2 Independent byte-span negative assurance

Each Writer mutation may report an exact claim:

```text
lineNumber
startColumn
endColumn
absoluteByteStart
absoluteByteEnd
beforeField
afterField
operationIds
section
record identity
field identity
physical owner bindings
```

But Writer claims are **audit testimony only**. They do not define mutation authority.

The independent validator must derive `S_auth` without importing or trusting Writer/planner span output. Derivation uses:

```text
bound APPLY operation(s)
persisted original-byte TARGET custody
apply-time re-derived TARGET custody
source-qualified fixed-field layout
exact target node/element/pointer/row/field ownership
```

Let:

```text
S_auth = independently authorized byte-span union
B      = Writer-reported span union
D      = actual byte-difference indices
```

Required assertions:

```text
D ⊆ S_auth
B matches the expected report for S_auth
preimage bytes at every S_auth span are exact
postimage bytes at every S_auth span are exact
EVERY byte outside S_auth is identical before vs after
```

This assertion includes whitespace, pointer digits, padding, comments, line endings, and untouched auxiliary records.

Overlapping authorization is resolved before mutation. Two operations converging on one physical field may collapse only if the canonical desired bytes are identical and the complete alias-owner set is compatible. Different desired values, or an unselected alias that would be changed, block the transaction.

A falsifier that changes an unrelated pointer/space/padding byte must fail even when the requested NODENAME edit succeeds and the modified CII reparses.

## 7.3 Preimage drift tests

Before patching a field, Writer 1C must re-read the exact TARGET field and compare it against `operation.before`.

Mismatch:

```text
WRITER_1C_TARGET_VALUE_MISMATCH
```

or a more specific family preimage blocker.

No “best effort” field search, no nearest record fallback, and no patching by node label alone.

## 7.4 Pointer/index anti-drift tests

NODENAME and SIF/TEE operations must bind:

```text
correspondenceId
TARGET element identity
TARGET parsed element index
TARGET pointer value
TARGET section record/block index
absolute physical field span
physical owner set
```

Reordering or changing any one after preview invalidates the operation.

Tests must deliberately modify:

- target pointer value;
- target element order;
- target auxiliary row order;
- target section row count;
- shared pointer ownership;
- exact referenced-row preimage;

and assert fail-closed behavior.

## 7.5 Format-boundary tests

NODENAME tests must include:

- empty field;
- one-character field;
- exact maximum-width field;
- one-character overflow;
- leading/trailing spaces policy;
- internal spaces;
- punctuation supported by the source format;
- non-ASCII rejection unless separately qualified;
- two names sharing one NODENAME row;
- two elements sharing one pointer;
- redundant FROM/TO ownership;
- conflict and non-conflict shared-record cases;
- unselected-alias side effect.

SIF/TEE tests must include, only after semantic field-map qualification:

- positive/negative/zero Fortran numeric values;
- exponent forms;
- exact fixed-field width;
- overflow rejection;
- pointer 1 and last valid pointer;
- pointer zero;
- out-of-range pointer;
- shared-block aliasing;
- malformed 10-row block;
- section row count not divisible by 10;
- semantic field map absent => blocked.

## 7.6 Round-trip semantic assurance

Required flow:

```text
TARGET original bytes
 -> qualified intake + persisted physical custody
 -> Writer 1C equal-width byte patch
 -> re-intake modified bytes through production parser
 -> independently validate structural/byte invariants
 -> recompute relevant engineering evidence
```

Acceptance requires:

```text
expected semantic delta count = intended semantic mutations
unexpected semantic delta count = 0
```

The reparse must use production parser paths, not a Writer-specific parser.

## 7.7 Independent oracle requirement

At least one qualification test per Writer-1C family must be independent of the Writer implementation.

Examples:

- a small Python oracle computing exact NODENAME slice offsets and expected byte replacement from a fixture;
- independent SIF/TEE block-index arithmetic and field-span computation from canonical raw rows after semantic authority exists.

Do not use production Writer functions to compute expected output for the same test.

## 7.8 Converter-drift sentinel

Canonical fixtures emitted by the protected CII converter/format authority must be retained as golden inputs.

If converter layout changes, anti-drift tests must fail with an explicit layout-drift result rather than silently learning a new offset.

Writer authority changes only after a separate requalification decision.

---

# 8. Real benchmark authority

Primary current multi-base benchmark:

```text
Benchmark/CIICompare/SOURCE 3.CII
Benchmark/CIICompare/TARGET 3-1.CII
```

Observed model-level fact:

```text
SOURCE ELEMENT records = 219
TARGET ELEMENT records = 223
```

The pair contains several locally corresponding regions with different numbering relationships and therefore proves one global node-number offset invalid.

A real Method-A/Method-B local region is:

```text
SOURCE 60920 / 60930 / 60940
TARGET  7290 /  7300 /  7310
```

At SOURCE node `60930`:

```text
incoming run  ΔZ = -450 mm
outgoing run  ΔX = -152 mm
SOURCE OD     = 114.3 mm
x             = 2
T             = 228.6 mm
```

Writer 1C also requires dedicated auxiliary-record fixtures; the `SOURCE 3/TARGET 3-1` identity benchmark alone is insufficient to qualify NODENAME or SIF/TEE mutation.

---

# 9. Validation truth model

Every engineering-critical result records:

```text
STATUS:
  PASS | FAIL | NOT_RUN | NOT_APPLICABLE

OBSERVATION:
  LOCAL_EXECUTION | REMOTE_EXECUTION | SOURCE_INSPECTION |
  ARTIFACT_INSPECTION | USER_SUPPLIED | INFERRED | NOT_OBSERVED

ORACLE:
  NONE | IMPLEMENTATION_COUPLED | INDEPENDENT_REPRODUCTION |
  ANALYTICAL | AUTHORITATIVE_REFERENCE | CROSS_SOLVER | EXPERIMENTAL
```

An authored test is not PASS until it executes.

Tolerance, Writer policy, field widths, pointer rules, or transfer classifications must never be loosened simply to make one benchmark pass.

---

# 10. Current implementation baseline

Merged foundation through PR #1001:

```text
PR982   fixed-field parser foundation
PR983   capability/oracle states
PR984   M1/M2 evidence
PR985   anchor-seeded propagation
PR986   Compare Review / engineering deltas
PR987   auxiliary custody qualification
PR988   transfer preview qualification
PR989   explicit Base Anchor / approval flow
PR991   Writer 1A
PR992   Writer 1B qualified slice
PR994   independent Method A/B core + x*SOURCE_OD
PR995   independent multi-base correspondence orchestration
PR996   automatic Method-A discovery + A/B fusion
PR997   full-viewport Method A/B evidence UI
PR998   multi-base UI -> explicit baseLoops[]
PR999   human-readable delta / effective TARGET presentation
PR1001  explicit APPLY / EXCLUDE mutation scope + scoped audit custody
```

PR #1004 is the stacked implementation PR for Writer-1C Phase 1. Its engineering-path evidence is downstream implementation evidence; this documentation PR remains production-code-free and owner-merge-controlled.

---

# 11. Future upgrade roadmap

## Phase 0 — close retained qualification debt

Before expanding mutation authority, execute and retain evidence for:

- focused scope tests in a complete checkout;
- full CII Workspace shell lifecycle;
- Chromium workflow;
- `SOURCE 3 -> TARGET 3-1` end-to-end correspondence/review/scope path;
- existing Writer 1A/1B round-trip suites;
- no-regression fixed-field parser suite.

Do not make Writer 1C compensate for an unqualified lower layer.

## Phase 1 — Writer 1C NODENAME

Deliver in this order:

1. original-byte physical-file custody;
2. source-qualified NODENAME physical-layout contract;
3. target pointer/row/FROM/TO absolute-byte-span custody and alias reverse index;
4. narrow transfer classification authority token for qualified existing-row mutation;
5. NODENAME-only Writer-1C readiness with other mutable operations EXCLUDE;
6. equal-width original-byte patcher;
7. independent validator deriving `S_auth` without trusting Writer claims;
8. independent NODENAME oracle and byte falsifiers;
9. production-parser benchmark round trip;
10. explicit Writer-1C core/scope/product routing while preserving Writer 1B as product default;
11. browser/product proof that original bytes and binary download remain intact.

Recommended production scope is **existing-row NODENAME COPY only**. Creation/deletion remains Writer 2. Mixed Writer-1A/1B + Writer-1C APPLY is not Phase-1 authority and requires separate transaction qualification.

## Phase 2 — Writer 1C existing SIF/TEE fields

Prerequisite: authoritative field-semantic map.

`FIELD_2_SEMANTICS_UNQUALIFIED` is a hard blocker, not a placeholder to bypass. Qualify one field family at a time; do not expose blanket raw-payload copy.

Each field family requires independent fixtures, an explicit Writer capability token, exact original-byte custody, and an independent `S_auth` derivation path.

## Phase 3 — optional existing auxiliary text fields

Consider restraint TAG/GUID or similar pointer-stable text fields only after they have:

- normalized engineering deltas;
- exact layout custody;
- width/encoding policy;
- independent anti-drift fixtures.

## Phase 4 — Writer 2 pointer/cardinality transaction engine

Implement a deterministic post-mutation section allocator for:

- NODENAME create/delete;
- SIF/TEE block create/delete;
- hanger record create/delete;
- pointer reindexing;
- CONTROL count maintenance;
- section insertion/deletion.

Writer 2 should operate on a complete relocation plan and then emit line patches. It must prove all old-to-new pointer mappings.

## Phase 5 — Writer 3 topology transaction engine

Only after Writer 2 is qualified:

- node/element create/delete;
- connectivity changes;
- split/merge;
- topology-aware auxiliary migration;
- structural section rebuild.

This phase requires independent graph/topology qualification and stronger round-trip oracles.

## Phase 6 — mutation manifest, rollback, and batch automation

After Writer 1C/2/3 boundaries are stable, add:

```text
CIIWorkspaceMutationManifest.v1
```

containing:

- source/target hashes;
- correspondence semantic hash;
- transfer-scope ID;
- Writer version;
- independently authorized span set / authority evidence;
- Writer-reported mutation claims;
- before/after field values;
- before/after file hash;
- validation result;
- excluded operations;
- deterministic rollback information where representable.

Batch automation must consume the same manifest; no separate “fast path” Writer is permitted.

---

# 12. Prohibited shortcuts

Do not:

- use a global node-number offset as identity authority;
- force independent Method-A transforms to one global transform;
- average incompatible bases;
- sum A/B scores to override conflict;
- use TARGET OD for tolerance scaling;
- use OD/WT equality as identity evidence;
- treat one-axis geometry as two-axis Method B;
- grant 3D credit for an incompatible third run;
- deduplicate conflicting UI selections before core arbitration;
- mix manual anchors and method-qualified base loops silently;
- treat identity ACCEPT as mutation APPLY;
- default new operations to APPLY under an old scope;
- implement EXCLUDE as fake KEEP;
- weaken a Writer whitelist because scope selected an unsupported operation;
- let Writer 1C insert/delete rows or renumber pointers;
- let Writer 1C mutate hanger arrays from node-presence evidence alone;
- copy raw SIF/TEE payloads while semantics remain unqualified;
- search for a “similar” target row after preimage/pointer mismatch;
- silently truncate a fixed-width string/numeric field;
- reconstruct/serialize the whole CII file from parsed text to perform a Phase-1 Writer-1C field edit;
- use Writer-reported mutation spans as the source of validator authorization;
- automatically combine Writer-1A/1B APPLY with Writer-1C APPLY before mixed-transaction qualification;
- accept a parseable output when byte-level negative assurance fails;
- represent NOT_RUN validation as PASS.

---

# 13. Governing architecture

```text
structural candidate discovery
        ↓
local METHOD A spatial bases
        OR
local METHOD B network bases
        ↓
engineer selects independent bases
        ↓
baseLoops[]
        ↓
OR_WITH_CONFLICT_VETO
        ↓
canonical correspondence
        ↓
engineering deltas
        ↓
identity approval
        ↓
classified transfer candidates
        ↓
explicit APPLY / EXCLUDE scope
        ↓
Writer readiness on APPLY set only
        ↓
Writer 1A / 1B / 1C / 2 / 3 according to custody impact
        ↓
original-byte mutation under independently derived physical authorization
        ↓
reparse + semantic verification + byte-level negative assurance
        ↓
scoped audit / mutation manifest / export
```

For complex CII revisions, **local identity independence, explicit mutation custody, original-byte authority, independently derived physical authorization, and Writer authority boundaries are requirements, not fallbacks**.
