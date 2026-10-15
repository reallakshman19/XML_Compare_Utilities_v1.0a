ISSUE_BASIS_ID: IB-CII-W2-MS-0001
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1084
ISSUE_SOURCE: https://github.com/reallaksh19/XML_Compare_Utilities/issues/1084
ISSUE_SOURCE_SNAPSHOT_AT: 2026-09-03T06:06:55Z
PREVIOUS_ISSUE_BASIS: NONE
CHANGE_AUTHORITY: INITIAL_CAPTURE + OWNER_DIRECT:2026-09-03T06:06:55Z "proceed coding"
ISSUE_BASIS_STATUS: CURRENT

PROGRAM_ID: PGM-XMLCU-CII-W2-MS-NODENAME
PROGRAM_WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1083
ISSUE_ROLE: WORK_PACKAGE
WORK_PACKAGE_ID: WP-001
PARTITION_KEY: PGM-XMLCU-CII-W2-MS-NODENAME/WP-001
PREDECESSOR_WORK_ITEM_KEY: NONE
REVISION_SEQUENCE: 0
INHERITED_PROGRAM_BASIS_REVISION: PB-0001
INHERITED_INPUT_SET_ID: PGM-XMLCU-CII-W2-MS-NODENAME-INPUTS-v1
INHERITED_BENCHMARK_SET_ID: PGM-XMLCU-CII-W2-MS-NODENAME-BENCH-v1
INHERITED_VALIDATION_SET_ID: PGM-XMLCU-CII-W2-MS-NODENAME-VALID-v1
INHERITED_ROADMAP_SET_ID: PGM-XMLCU-CII-W2-MS-NODENAME-ROADMAP-v1

# Mission

Implement WP-001 only: production-consumed virtual source-set custody for exact S1/S2/S3 against one T. Preserve source member identity, original SHA-256, neutral-version/normalization evidence, deterministic ordered source-set identity and one untouched target. Do not implement WP-002 correspondence, WP-003 transfer scope, WP-004 Writer2 mutation or WP-005 acceptance in this material leg.

# Original task / acceptance ledger

- TASK-001 | Treat S1/S2/S3 as SOURCE and T as TARGET in Utilities → CII Writer 2 V11/V14. | OPEN | parent #1083
- TASK-002 | Handle three sources without losing individual source identity/provenance; virtual source union preferred over physical merge. | OPEN | parent #1083
- TASK-006 | Reuse the existing frozen V11↔V14 bridge; no competing V14 writer. | OPEN | parent #1083
- TASK-007 | Benchmark source-set custody independently before later phases. | OPEN | parent #1083
- TASK-009 | Expose a usable three-source/one-target Utilities intake/read surface. | OPEN_FOR_WP001_READ_ONLY_INTAKE | parent #1083

# Input ledger

- INPUT-001 | Benchmark/S1.CII | AVAILABLE | SHA256 9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b | parent #1083
- INPUT-002 | Benchmark/S2.CII | AVAILABLE | SHA256 7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd | parent #1083
- INPUT-003 | Benchmark/S3.CII | AVAILABLE | SHA256 c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa | parent #1083
- INPUT-004 | Benchmark/T.CII | AVAILABLE | SHA256 abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060 | parent #1083
- INPUT-005 | ordered source-set identity | READY | SHA256 5390166aab9504880bd4514af865c914ba8a41ce2922e7d473311d62b10723a3 for S1/S2/S3 | parent #1083
- INPUT-007 | frozen V11↔V14 source graph | AVAILABLE | reallaksh19/3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4 | parent #1083

# Benchmark / oracle ledger

- BM-003 | FIXED_INPUT_CUSTODY | READY | exact member hashes + exact ordered aggregate source-set hash | parent #1083

# Validation ledger

- VAL-001 | retained-real source-set intake/custody | NOT_RUN | exact 3 members + one target + aggregate hash | parent #1083
- VAL-006 | stale member/order/hash falsifiers allocated to WP-001 | NOT_RUN | parent #1083

# Roadmap ledger

- RM-001 | ciibenchmarkroadmap.md@7d061341a8c038316752007a3d4ed02b7ea66b58 | OWNER_ROADMAP | PRIMARY | ALIGNED | OWNER_ONLY
- RM-002 | docs/cii-writer2-v11-v14-lossless-bridge.md@main af73cada60031984182155f3fa362261b97379ec | GOVERNING_DESIGN | ALIGNED | READ_ONLY semantics
- RM-003 | 3D_Converters@ca8d391ac5f829f53bebb3c37adf0547c34a67b4 | FORMAT_DIALECT_AUTHORITY | CURRENT | NO_MUTATION
- RM-004 | Common engineering-pr-delivery-v2@e3ace4802a022f565f95b4af7f01a203df82dbcd | PROCESS_CUSTODY | CURRENT

# Owner qualification baseline

Source: GitHub issue #1084 Appendix A, exactly five implementation questions. Existing chain qualification scope `QSCOPE-CII-W2-MS-MULTISOURCE-NODENAME-CARDINALITY` remains current for the same custodian; takeover readiness was already TRUE before Issue adoption. Candidate self-verification is not introduced by this basis.

# Protected boundaries

- No physical merge/concatenation of S1/S2/S3 as engineering authority.
- T remains one untouched target; no target writer/apply in WP-001.
- No base-anchor/correspondence aggregation in WP-001.
- No transfer-plan/scope changes in WP-001 except read-only contract plumbing if unavoidable.
- No Writer2 NODENAME relocation/write change.
- No frozen converter, benchmark expected value, tolerance, workflow or Writer1/Writer3 mutation.
- Existing single-source route must remain behavior-compatible.
