# PR1081 Workreport — CII v14 Find & Replace

## Delivery container

- PR: `#1081`
- Branch: `feature/cii-find-replace-finish-v14`
- Base: `main@bfe3abbb67060c1212001f2e9d967c229a057640`
- Product material head: `700e08a5be64a35bcc157554e809e97ba41bcace`
- Latest material leg: `ML-CII-FR-0005`
- Active successor endpoint: `EP-CII-FR-0026`
- Merge authority: Owner-only; `MERGE_AUTHORIZED=FALSE`.

## Current Owner direction

```text
skip FORCE
universal block-wise Find & Replace
universal element-wise Find & Replace
do not change Node Name logic if no errors
skip qualification, proceed next
proceed phase-wise
```

Disposition:

- FORCE/FORCMNT remains de-scoped and is not a release dependency.
- Node Name remains on its existing specialized fixed-field resolver/validator path and was not changed.
- Displacement semantics and endpoint identity checks remain preserved.
- U1 qualification was explicitly skipped by the Owner and recorded as `NOT_REQUIRED`, not fabricated PASS.
- Merge remains Owner-only and unauthorized.

## Existing supported application surface

The currently advertised user-facing mutable workflow remains:

```text
Target CII v14
-> Document / Element / Block scope
-> Block: Node Name or Displacement
-> CSV or editable manual grid
-> Preview + approve/reject
-> Validate TARGET1
-> Apply to New Copy
-> Download Modified CII / Audit JSON
```

Backend U1/U2 plus the compact-v14 correction supports ownership and field-aware validation for generic auxiliary records. UI/CSV generic block choices remain deliberately deferred until U4 remaining-family evidence is complete.

Protected custody remains:

```text
TARGET0 never overwritten
Direct Apply-to-source disabled
Writer1/Writer2 not invoked
Download requires released qualified TARGET1
manual-grid dirty state invalidates stale qualification/release
CONTROL / IEL mutation not authorized
record clone/repoint not authorized
```

## Phase 1 — CSV/manual synchronization

Phase 1 corrected `onCsvChange()` so already-synchronized clean manual rows remain in Preview/Validate custody when CSV is loaded or reloaded. Dirty manual rows are never auto-admitted and still require `Update Preview`.

Material receipt: `ML-CII-FR-0002`.
Exact-source UI/static validation: **PASS 10/10**.

## U1 — universal v14 auxiliary ownership/cardinality foundation

U1 completed at product material head `4f9e79fc899fd5e89c33267480208e25f8d627da`.

Ownership proof is:

```text
exact From/To ELEMENTS block
+ requested IEL pointer
+ matching CONTROL count
+ exact physical auxiliary section
+ v14 count * rows-per-record cardinality
+ reverse pointer owner set
=> exact uniquely owned auxiliary record
```

The registry pins all 15 IEL pointers and v14 cardinalities, including `ALLOWBLS=28`, `SIF&TEES=14`, `REDUCERS=2`. Shared pointers, pointer/count/cardinality mismatch and embedded comment ambiguity fail closed. Displacement consumes the common ownership gate before its existing endpoint check. Node Name remained specialized. FORCE remained blocked.

Material receipt: `ML-CII-FR-0003`.
Exact-source focused validation: **PASS 17/17**.

## U2 — field-aware universal Element / auxiliary claims

U2 completed at product material head `09c7c1aab70fab5d918065d11b557050205b97f0`.

Field-aware Element mutation permits only mutable numeric/text payloads while protecting FROM, TO, all 15 IEL pointers, text length/control columns and line endings. Generic auxiliary mutation first requires U1 ownership, then restricts claims to individual fields. Numeric postimages must remain finite/parseable; cross-field matches cannot create claims.

Node Name continues through the existing specialized whole-field plan. FORCE/FORCMNT remains blocked. Executor/output custody is unchanged.

Material receipt: `ML-CII-FR-0004`.
Synthetic/focused exact-source validation: **PASS 19/19**.

## U3 — retained native-v14 execution

U3 reconstructed the retained benchmark exactly:

```text
repository    reallaksh19/3D_Converters
commit        ca8d391ac5f829f53bebb3c37adf0547c34a67b4
archive       Benchmarks/v11-v14.zip
archive blob  8409e1c429665e34a83c2a464665ebf5d5f1b0a1
member        SYS-0001-v14.CII
bytes         168574
line ending   CRLF
SHA-256       d2d4316309d9b1aa34b55ad72f89193fd0e437930db203fecd9ede00e69b2faf
```

U1 ownership was retained-real clean across every represented generic pointer:

```text
BEND         9/9
RIGID       43/43
RESTRANT    40/40
SIF&TEES     2/2
REDUCERS     1/1
TOTAL       95/95
shared       0
```

Node Name resolver and claim validation passed **55/55** and reproduced no defect.

U3 also found a real U2 defect: native v14 legitimately emits compact fixed-width numeric rows, while the original U2 field parser required all numeric rows to be 80 bytes. Before correction:

```text
ELEMENT      0/112
BEND          0/9
RIGID         0/43
RESTRANT      0/40
SIF&TEES      2/2 PASS
REDUCERS      0/1
```

Failure evidence: `agents/evidence/PR1081_u3_native_v14_retained_real_execution.md`.
Failure checkpoint: `EP-CII-FR-0024`.

## Compact-v14 corrective leg

The Owner's next progression authorized only the compact-row corrective field-authority leg. Product material head is now `700e08a5be64a35bcc157554e809e97ba41bcace`.

Changed material paths:

```text
MODIFY tabs/cii-workspace/cii-workspace-find-replace-v14-field-authority.js
MODIFY tests/cii-workspace/cii-workspace-find-replace-v14-field-authority.test.js
```

Exact blobs:

```text
field-authority.js       1607a63ac29068eb74960eb755d047af21746840
field-authority.test.js  a32a4134154267e8022c456274087261eca41785
```

The parser now recognizes only canonical `(2X,n*13)` numeric widths:

```text
15, 28, 41, 54, 67, 80
```

Represented retained-real row-position schemas are pinned for Element, BEND, RIGID, RESTRANT, SIF&TEES and REDUCERS. Existing full-width synthetic rows are compatible only when fields beyond the row's v14 schema are zero/blank padding; those padding fields are not mutable. Malformed near-width records fail closed.

Promoted exact-source focused execution:

```text
20 PASS
0 FAIL
0 SKIP
```

Promoted exact retained-native execution:

```text
Element field authority        PASS 112/112
BEND ownership + fields        PASS 9/9
RIGID ownership + fields       PASS 43/43
RESTRANT ownership + fields    PASS 40/40
SIF&TEES ownership + fields    PASS 2/2
REDUCERS ownership + fields    PASS 1/1
Generic represented ownership  PASS 95/95
NODENAME resolver/claims       PASS 55/55
FORCE/FORCMNT                  BLOCKED as required
```

Evidence: `agents/evidence/PR1081_compact_v14_corrective_exact_execution.md`.
Material receipt: `ML-CII-FR-0005`.
Successor endpoint: `EP-CII-FR-0026`.

The dedicated U1 synthetic ownership suite was not rerun in this corrective reconstruction because that unchanged test file was absent locally; prior exact-source U1 **PASS 17/17** remains retained evidence and is not relabeled as a new run. The native audit independently reran U1 ownership behavior for all 95 represented pointers and passed 95/95.

## Validation truth

```text
Compact-v14 promoted focused runtime                  PASS 20/20
Native-v14 represented Element/aux runtime            PASS
Native-v14 represented generic ownership              PASS 95/95
NODENAME retained-real regression                     PASS 55/55
Prior U1 exact-source focused runtime                 PASS 17/17 / retained
PR1081 prior exact-source UI/static closure            PASS 10/10 / retained
Merged non-benchmark Find & Replace                    PASS 33/33 / retained
Merged focused Node Name                               PASS 4/4 / retained
SOURCE 3 retained-real authored runtime                NOT_RUN
Full repository suite                                  NOT_RUN
External CAESAR acceptance                             NOT_RUN
```

No `NOT_RUN` state is promoted to PASS.

## Current completion state

```text
APP_EXISTING_SUPPORTED_SURFACE     COMPLETE
CSV_MANUAL_SYNC                   COMPLETE
U1_V14_AUX_REGISTRY               COMPLETE
U1_CONTROL_CORRELATION            COMPLETE
U1_SHARED_POINTER_GATE            COMPLETE
U2_ELEMENT_FIELD_AUTHORITY        COMPLETE
U2_GENERIC_AUX_FIELD_AUTHORITY    COMPLETE
COMPACT_V14_RETAINED_REAL_FIX     COMPLETE
NATIVE_REPRESENTED_FAMILIES       PASS
NODE_NAME_LOGIC                   PRESERVED
FORCE/FORCMNT                     DE_SCOPED_BY_OWNER
UI_CSV_GENERIC_AUX_EXPANSION      NOT_STARTED
U4_REMAINING_V14_FAMILIES         NOT_STARTED
DIRECT_TARGET0_OVERWRITE          DISABLED
```

## Exact next action

On the next Owner progression, execute bounded **U4 remaining-v14-family qualification/evidence** before UI/CSV expansion. Pin row-position field schemas and focused/spec-backed tests for EXPJT, UNIFORM, WIND, OFFSETS, ALLOWBLS, FLANGES and EQUIPMNT; search for retained-real v14 specimens for those families and DISPLMNT and execute them when available. Do not fabricate retained-real coverage. Preserve U1 ownership/cardinality/shared-owner gates, the compact-row correction, Node Name specialization, Displacement endpoint semantics, FORCE exclusion and all custody invariants. Do not expand generic UI/CSV choices or merge PR #1081 without separate Owner authorization.
