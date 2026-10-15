# Qualification — CII Writer2 NodeName byte-preserving revision

QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE_VERSION: 2
QUALIFICATION_PROFILE: FIXED_FORMAT_WRITER / TOPOLOGY_CORRESPONDENCE
QUALIFICATION_SCOPE_ID: QSCOPE-CII-W2-NB-R1-FIXED-FORMAT-SUBGRAPH
QUESTION_SET_ID: CII-W2-NB-R1-QS-0001
QUESTION_SET_STATUS: REFRESHED_PENDING_ADMISSION
QUESTION_SET_ADMISSION_STATUS: PENDING_OWNER_OR_INDEPENDENT_ADMISSION
QUALIFICATION_BASIS_HEAD: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1224
PROGRAM_BASIS_REVISION: PB-0003
CANDIDATE_ID: chatgpt:e37d9cd9-b51b-4b1e-94f1-c75a4a55f52b
ADMISSION_AUTHORITY_ID: NONE
QUALIFICATION_STATE: READ_ONLY_PENDING_ADMISSION
TAKEOVER_QUALIFICATION_READY: FALSE
OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: Owner 2026-09-16 task + predecessor #1111 Appendix A/PB-0002
OWNER_QUALIFICATION_BASELINE_STATUS: SATISFIED_AS_FLOOR

## Admission note

The predecessor WP-006 pack is stale for this revision because its authority intentionally blocked nonblank→different-nonblank NODENAME replacement and did not make source-subgraph matching or SIF/TEE byte-preservation the primary implementation boundary. This refreshed pack preserves and strengthens the predecessor fixed-format/raw-identity/oracle requirements.

The current candidate drafted this pack from Owner requirements and repository evidence. Under Common `question-set-admission.md`, the candidate cannot be the sole authority that marks its own replacement exam `VALID`. Production mutation remains READ_ONLY until Owner or an independent admission/verifier authority adopts this set and qualification receives an independent verdict.

## Q1 — Production trace and correspondence boundary

Repository anchors:
- `tabs/cii-workspace/cii-workspace-propagation.js`
- `tabs/cii-workspace/cii-workspace-multi-base-correspondence.js`
- current multisource preview/authority modules
- current transfer-plan/scope routing

Concrete payload:
- one source frontier with two required source edges;
- corresponding target node with those two compatible edges plus one unrelated target-only branch;
- negative control where one required source edge has no compatible target edge.

Required derivation:
Trace one real/representative Sx→T pair from reviewed anchor through frontier assignment to transfer candidate. Reconstruct the exact current condition producing `FRONTIER_CARDINALITY_MISMATCH` and any whole-target-component claim blocker. Derive the injective subset condition needed to accept the positive extra-branch case while still rejecting the missing-required-edge case.

Falsifier:
A proposed repair that accepts a source edge without a unique compatible target edge, or allows two source edges to claim the same target edge, fails qualification.

## Q2 — Fixed-format NodeName physical reconstruction

Repository anchors:
- `tabs/cii-workspace/cii-workspace-nodename.js`
- `tabs/cii-workspace/cii-workspace-physical-file.js`
- `parser/fixed-field.js`
- current Writer1C/Writer2 NodeName physical writers

Concrete payload:
- ELEMENT 15-row block;
- NODENAME pointer field on element row 13 with exact 13-byte I13 custody;
- NODENAME FROM `[2,28)` width 26 and TO `[28,53)` width 25;
- one same-cardinality REPLACE and one zero-pointer CREATE.

Required derivation:
For REPLACE, enumerate the exact target byte span(s) allowed to change and prove file length, CONTROL.NONAM and ELEMENT pointer are invariant. For CREATE, derive the physical NODENAME row/pointer/count consequences and required I13 lexical postconditions. Explain why whitespace tokenization and generic Python/JS `G` formatting cannot be write authority for compact FORTRAN fixed fields.

Falsifier:
Any answer that allows untouched numeric rows or line endings to be reformatted, or emits REAL/exponent text into I13 pointer/count custody, fails.

## Q3 — Authority/invariant for REPLACE vs CREATE/DELETE

Repository anchors:
- `tabs/cii-workspace/cii-workspace-transfer-policy.js`
- `tabs/cii-workspace/cii-workspace-writer1c-nodename.js`
- `tabs/cii-workspace/cii-workspace-writer2-composite-routing.js`
- `tabs/cii-workspace/cii-workspace-writer2-nodename-relocation.js`
- `tabs/cii-workspace/cii-workspace-v14-change-projection.js`

Concrete payload:
- target existing nonblank raw name A;
- reviewed exact source raw name B, same field width after padding;
- shared-record/alias negative case;
- stale target preimage negative case;
- cardinality CREATE occurring in the same overall user transaction.

Required derivation:
Identify the smallest safe composition that makes the valid pair visible and applies B without broadening canonical-family authority. Show how same-length REPLACE and cardinality relocation can be sequenced or jointly planned without stale absolute spans. State the shared-field, overlapping-claim and stale-preimage blockers and the NO-PATCH condition for any layer already correct.

Falsifier:
Allowing family equality alone to choose B, or applying absolute-span REPLACE claims after a prior cardinality shift without re-intake/remap, fails.

## Q4 — Independent byte/section oracle

Repository anchors:
- physical section parser/row custody
- Writer2 product validation
- V14 fixed-field authority/projector evidence
- retained `Benchmark/T.CII` and `TEXPECTED-PARTIALLLYDONE.CII`

Concrete payload:
- pure REPLACE case;
- mixed NodeName cardinality case;
- retained TEXPECTED census `1265→1266`, CREATE=1, DELETE=0, REPLACE=35;
- explicit SIF&TEES/RIGID/RESTRANT/MISC/FLANGES/FORCMNT/ALLOWBLS negative sections.

Required derivation:
Define an independent TARGET0→OUTPUT checker that does not import the production splice/projector implementation. It must prove authorized mutation closure, `CONTROL.NONAM == physical NODENAME rows`, legal positive pointer range, I13 lexical form, fixed-width/line-ending preservation and exact byte identity of unrelated sections. Explain how TEXPECTED is a lower-bound known-positive oracle without becoming an upper bound on additional reviewed source-derived REPLACE.

Falsifier:
If a one-byte SIF&TEES mutation can pass because a broad section-level whitelist or canonical rewrite hides it, the oracle is insufficient.

## Q5 — Minimal coherent patch and rollback

Repository anchors:
- first wrong functions established by Q1–Q4
- focused tests for propagation, transfer policy/routing, Writer1C/Writer2 NodeName and retained TEXPECTED benchmark

Concrete payload:
- pre-patch extra-target-branch false rejection;
- pre-patch nonblank NodeName replacement omitted/blocked in multisource flow;
- pure-REPLACE byte invariant;
- mixed CREATE/REPLACE transaction;
- SIF drift negative control.

Required derivation:
Name the first production function(s) that actually require change and the smallest adjacent integration/tests. State exact expected before/after evidence, protected modules, rollback boundary and NO-PATCH cases: correspondence remains untouched if already subgraph-correct; transfer remains untouched if it already exposes REPLACE; physical writer remains untouched if exact raw payload reaches a proven fixed-span writer; structural relocation remains untouched if count/pointer behavior is already correct.

Falsifier:
A broad refactor, benchmark-specific branch, frozen-converter change, or SIF/HANGER/RESTRAINT authority expansion fails qualification.