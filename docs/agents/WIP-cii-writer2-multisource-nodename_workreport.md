# WIP — CII Writer2 multi-source NODENAME transfer

WIP_ID: WIP-cii-writer2-multisource-nodename
WORK_ITEM_SOURCE: OWNER_DIRECT
WORK_ITEM_KEY: owner-direct:reallaksh19/XML_Compare_Utilities:CII-WRITER2-MULTISOURCE-NODENAME-20260903
WORK_ITEM_MODE: EXCLUSIVE
AGENT_INSTANCE_ID: chatgpt:f5648fdf-fcfb-47f2-a243-4eea1a836442
BRANCH: agent/cii-writer2-multisource-nodename-transfer
BASE_MAIN: f3b7429a40b8477397ce3efc5748326da24536d4
COMMON_PROTOCOL: engineering-pr-delivery-v2
COMMON_PROTOCOL_BASIS: e3ace4802a022f565f95b4af7f01a203df82dbcd
COMMON_PROTOCOL_STATUS: CURRENT
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

## Mission

Extend the existing **CII Writer 2 — V11 / V14** utility so three Owner-supplied source CII files (S1/S2/S3) can contribute independent base-anchor/correspondence evidence to one untouched target T, while Writer2 receives only explicitly approved NODENAME cardinality mutations. Every unrelated transfer candidate must remain excluded.

Do not physically merge T. Do not broaden Writer2 to same-cardinality NODENAME overwrite. Preserve the frozen V11↔V14 bridge, original V14 target byte custody, CONTROL/ELEMENT pointer correlation, topology/connectivity protection and Owner-only merge authority.

## Owner inputs

| Input | Bytes | SHA-256 | Observed V14 signature | CONTROL summary |
|---|---:|---|---|---|
| S1.CII | 108330 | `9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b` | 5 / 14 / 1256 | ELEMENTS 56; NODENAME 49; BEND 14; RIGID 1; RESTRANT 39; SIF&TEES 2 |
| S2.CII | 90961 | `7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd` | 5 / 14 / 1256 | ELEMENTS 46; NODENAME 42; BEND 10; RIGID 1; RESTRANT 34; SIF&TEES 1 |
| S3.CII | 90942 | `c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa` | 5 / 14 / 1256 | ELEMENTS 45; NODENAME 40; BEND 9; RIGID 1; RESTRANT 33; SIF&TEES 3 |
| T.CII | 2866002 | `abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060` | 5 / 14 / 1256 | ELEMENTS 1614; NODENAME 1265; BEND 317; RIGID 124; RESTRANT 1028; FORCMNT 6; ALLOWBLS 8; SIF&TEES 51; FLANGES 16 |

Source element-node spaces are disjoint: S2 `40..669`, S3 `1350..1930`, S1 `3790..5229`. The combined virtual source inventory is 147 elements, 131 NODENAME rows, 33 BEND, 3 RIGID, 106 RESTRANT and 6 SIF&TEES records.

The Owner supplied an expected **329-row NODE NAME CHANGES** acceptance list. Normalized `source_names<TAB>target_name` representation has SHA-256 `0d941b97833ad55e9ef634c8a1935b233d57cf8ab6c07ba3fb7e7bef410e037e`. This is an Owner acceptance oracle, not production-generated truth.

## Governing roadmap / source authority

- `ciibenchmarkroadmap.md@7d061341a8c038316752007a3d4ed02b7ea66b58` — applicable Writer2 benchmark program; read-only for this task.
- Existing frozen Writer2 V11↔V14 bridge and pinned `3D_Converters` converter custody remain authoritative for dialect/record mapping.
- Current `3D_Converters` V14 multi-merge is reference/profile evidence only. T has non-zero FORCMNT/ALLOWBLS/FLANGES, which are outside that merger's qualified-v1 boundary; T must not be physically merged.

## Coordination

Open draft PR #1064 owns public Writer2 runtime qualification but changes only legacy relay/evidence/qualification paths. This work must not modify #1064, its legacy `agents/agentchain/**` custody, frozen public-runtime runners, benchmark source/oracles/tolerances or workflow state.

COORDINATION_STATE: SAFE_WITH_READONLY_WRITER2_RUNTIME_OVERLAP

## Planned bounded phases

1. **P1 Source-set custody** — production-consumed virtual source-set contract; deterministic member/source-set custody; no physical merge. Benchmark exact S1/S2/S3 identities and source-set ordering/collision rules.
2. **P2 Base anchors** — run existing Method A/B suggestion/correspondence independently per source against one T; preserve source member identity; target conflict veto. Benchmark selected correspondence against the Owner-known NODE NAME outcome.
3. **P3 Transfer construction** — form one original-target transfer plan from reviewed multi-source correspondence; every operation records source member custody. Add exact allowlist projection for Owner-approved NODENAME cardinality changes; default every other mutable candidate to EXCLUDE.
4. **P4 Writer2 scope/apply** — bind aggregate source-set custody + untouched target SHA; reuse existing Writer2 NODENAME CREATE/DELETE relocation and frozen V11↔V14 projection. No equal-cardinality overwrite broadening.
5. **P5 Retained-real benchmark** — run S1/S2/S3→T end-to-end; expected review list 329 rows; assert no unapproved mutation, pointer/count consistency, target topology/connectivity preserved and original unrelated V14 bytes protected. External CAESAR acceptance remains NOT_RUN unless actually executed.

## Current blocker

The pinned Common protocol recognizes only the exact Owner progression commands `proceed next`, `proceed next, no Qs`, and `proceed next, hand over ready`. The current Owner instruction says “Start coding” but does not contain one of those progression commands. Product/test/benchmark material mutation therefore remains blocked until an exact progression command is received. Relay/pre-work custody may be authored now.

## Exact next action

Finish canonical v3 pre-work endpoint + ACTIVE custody on this branch. After the Owner supplies exact `proceed next`, execute P1 as the first material leg and benchmark it before advancing to P2.
