# Issue Basis — CII Writer2 NodeName byte-preserving revision

ISSUE_BASIS_ID: IB-CII-W2-NB-R1-0001
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1224
ISSUE_SOURCE: https://github.com/reallaksh19/XML_Compare_Utilities/issues/1224
ISSUE_SOURCE_SNAPSHOT_AT: 2026-09-16T04:26:04Z
PREVIOUS_ISSUE_BASIS: NONE
CHANGE_AUTHORITY: INITIAL_CAPTURE_FROM_OWNER_DIRECT_REVISION
ISSUE_BASIS_STATUS: CURRENT
CHAIN_STATE_VERSION: 3
PROGRAM_ID: PGM-XMLCU-CII-W2-MS-NODENAME
PROGRAM_WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1083
ISSUE_ROLE: REVISION
WORK_PACKAGE_ID: WP-006
PARTITION_KEY: PGM-XMLCU-CII-W2-MS-NODENAME/WP-006
PREDECESSOR_WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1111
REVISION_SEQUENCE: 1
INHERITED_PROGRAM_BASIS_REVISION: PB-0003
INHERITED_INPUT_SET_ID: PGM-XMLCU-CII-W2-MS-NODENAME-INPUTS-v2
INHERITED_BENCHMARK_SET_ID: PGM-XMLCU-CII-W2-MS-NODENAME-BENCH-v2
INHERITED_VALIDATION_SET_ID: PGM-XMLCU-CII-W2-MS-NODENAME-VALID-v2
INHERITED_ROADMAP_SET_ID: PGM-XMLCU-CII-W2-MS-NODENAME-ROADMAP-v1
PARENT_BASIS_FILE: agents/programs/PGM-XMLCU-CII-W2-MS-NODENAME/basis/PB-0003.md

## Original task / acceptance ledger

TASK-R1-001 | Treat S1/S2/S3 as independent SOURCE members and T as untouched TARGET. | OPEN | Owner 2026-09-16
TASK-R1-002 | Transfer selected exact Node Names including same-cardinality REPLACE and structural CREATE/DELETE. | OPEN | Owner 2026-09-16
TASK-R1-003 | Valid source subgraph→target correspondence must remain visible when T contains extra unrelated branches/components. | OPEN | Owner + read-only audit
TASK-R1-004 | Exact raw source NODENAME is writable identity; canonical/family name is review evidence only. | OPEN | Owner + predecessor invariant
TASK-R1-005 | TEXPECTED is partial known-positive benchmark, not complete output oracle or upper bound. | OPEN | Owner 2026-09-16
TASK-R1-006 | Pure REPLACE uses exact equal-width preimage-checked original-target byte spans. | OPEN | Owner 2026-09-16
TASK-R1-007 | CREATE/DELETE maintain physical NODENAME cardinality, ELEMENT pointers and CONTROL.NONAM consistency. | OPEN | Owner + CII format authority
TASK-R1-008 | NodeName-only output must preserve SIF&TEES and every unrelated target section/byte. | OPEN | Owner reported SIF/TEE format defect
TASK-R1-009 | FORTRAN fixed-field records remain fixed-width; adjacent numeric fields are not whitespace-tokenized for write authority. | OPEN | Owner + parser authority
TASK-R1-010 | MISC/control dynamic counts/layouts are derived from qualified physical postimage and ambiguous layouts fail closed. | OPEN | Owner 2026-09-16
TASK-R1-011 | No benchmark IDs/hashes/counts/aliases hard-coded into production selection. | OPEN | anti-gaming
TASK-R1-012 | Merge remains Owner-only. | OPEN | Common/repository policy

## Input ledger

INPUT-001 | Benchmark/S1.CII SHA256 9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b | AVAILABLE | PB-0003
INPUT-002 | Benchmark/S2.CII SHA256 7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd | AVAILABLE | PB-0003
INPUT-003 | Benchmark/S3.CII SHA256 c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa | AVAILABLE | PB-0003
INPUT-004 | Benchmark/T.CII SHA256 abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060 | AVAILABLE | PB-0003
INPUT-005 | canonical sourceSet SHA256 5390166aab9504880bd4514af865c914ba8a41ce2922e7d473311d62b10723a3 | READY | PB-0003
INPUT-006 | frozen parent BM-001 329-row mapping/digest | READY | #1083
INPUT-007 | frozen V11↔V14 converter source graph | AVAILABLE | predecessor bridge authority
INPUT-008 | Benchmark/TEXPECTED-PARTIALLLYDONE.CII | AVAILABLE / PARTIAL_OWNER_BENCHMARK | PB-0003

## Benchmark / oracle ledger

BM-001 | Frozen Owner mapping | READY | independent of new implementation where exact authority applies
BM-002 | Existing focused NodeName CREATE physical oracle | READY | independent expected postimage + product regression
BM-003 | Source-set custody | READY | exact hashes
BM-004 | Original-T byte negative assurance | NOT_RUN | independent checker required
BM-005 | Transfer-scope regression | NOT_RUN_FOR_REVISION | product regression
BM-006 | Structural V11↔V14 bridge | NOT_RUN_FOR_REVISION | mixed/frozen format authority
BM-007 | Partial TEXPECTED lower-bound census: 1265→1266, CREATE=1, DELETE=0, REPLACE=35 | NOT_RUN | independent reproduction required
BM-008 | Injective source-subgraph correspondence positive/negative controls | NOT_RUN | independent topology fixture
BM-009 | Unrelated-section/SIF fixed-format byte invariance | NOT_RUN | independent byte/section checker

## Roadmap ledger

RM-001 | ciibenchmarkroadmap.md@current-main | OWNER_ROADMAP | PRIMARY | READ_ONLY/OWNER_CONTROLLED
RM-002 | docs/cii-writer2-v11-v14-lossless-bridge.md@current-main | PROJECT/GOVERNING DESIGN | ALIGNED_WITH_PB0003_EXCEPTION | no broad rewrite authority
RM-003 | 3D_Converters frozen converter source | FORMAT/DIALECT SOURCE | CURRENT | NO_MUTATION
RM-004 | Common engineering-pr-delivery-v2@fed57820909f4984a97d67437340df952b73a5ab | PROCESS/CUSTODY | CURRENT | Common-controlled

## Owner qualification baseline

OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_SOURCE: Owner 2026-09-16 task + predecessor #1111 Appendix A / PB-0002 invariants
OWNER_QUALIFICATION_BASELINE_STATUS: SATISFIED_AS_FLOOR

The predecessor question set is stale for this expanded scope. A new profile-v2/v3-compatible fixed-format/topology pack is proposed in issue #1224 and the chain qualification artifact. It is not self-admitted by the candidate.

## Protected authority

- All Benchmark CII files are read-only.
- Original T bytes are preservation authority outside explicit mutation closure.
- Pure NodeName REPLACE may not change file length, line endings, CONTROL count, ELEMENT pointer or unrelated sections.
- Structural NodeName CREATE/DELETE may touch only qualified NODENAME units, CONTROL.NONAM and affected ELEMENT NODENAME pointer fields.
- SIF/HANGER/RESTRANT/MISC mutation is not authorized by this revision.
- Frozen converter source and workflow files are protected.
- Merge authority is OWNER_ONLY.