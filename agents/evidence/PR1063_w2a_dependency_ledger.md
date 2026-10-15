# PR1063 — W2 A exact public-runtime dependency ledger

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
PR: #1063
MATERIAL_QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
OBSERVATION_CLASS: SOURCE_INSPECTION_ONLY
RUNTIME_CLASSIFICATION: NOT_RUN
PRODUCTION_PATCH_AUTHORITY: NONE_UNTIL_FIRST_AUTHORED_PUBLIC_FAILURE

## Purpose

Replace the lost historical sparse mirror with a durable, Git-blob-pinned static dependency ledger for the unchanged W2 A public runtime gate. This file records source closure only. It is not runtime evidence and must not be used to promote W2 A or any retained-real/V14/native gate.

## Unchanged W2 A entrypoint

`tests/cii-workspace-writer2-restraint-product-routing.test.js`

Git blob:
`9922377ddeda86fc9167d65f33c97095346e79fa`

Direct repository imports:

1. `tabs/cii-workspace/cii-workspace-core.js`
2. `tabs/cii-workspace/cii-workspace-writer2-composite-routing.js`
3. `tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js`
4. `tabs/cii-workspace/cii-workspace-writer2-product-validation.js`
5. `tabs/cii-workspace/cii-workspace-writer2-restraint-delete-compaction-plan.js`
6. `tests/cii-workspace-writer2-composite-restraint-fixture.js`

Node built-ins: `node:assert/strict`, `node:crypto`.

Fixture blob:
`e208484567d08b25b2b1f036bed16efc3141f31d`

## Public Writer2 route

`tabs/cii-workspace/cii-workspace-core.js`
blob `cee2858a63992648edf5e61b8f63b3837a937f9e`.

Observed public sequence:

1. `applyCiiWorkspaceTargetWriter2()` delegates to the shared Writer apply path for Writer2.
2. `currentTargetFor()` canonical-re-intakes the caller bytes with `intakeCiiWorkspaceDocument()` and verifies current SHA; stale input is rejected with `CII_WRITER_2_STALE_TARGET_HASH`.
3. RESTRAINT APPLY dispatches to `applyCiiWriter2CompositeWithRestraintDelete()`.
4. The composite RESTRAINT transaction independently checks original-byte SHA/length and bound scope, applies disjoint original-byte claims, and re-intakes its postimage.
5. Core canonical-re-intakes `writerResult.bytes` again.
6. `validateCiiWriter2ProductRoundTrip()` validates the public Writer2 product.
7. Only clean authored completion may qualify W2 A PASS.

A module-load/materialization stop before authored execution remains NOT_RUN.

## Direct Writer2 route modules pinned

| Path | Git blob | Static dependency note |
|---|---|---|
| `tabs/cii-workspace/cii-workspace-writer2-composite-routing.js` | `2e7a21bd17aa9af405f1a2f93201d4a45bb09e4b` | contracts; Writer2 routing; NODENAME relocation; SIF delete; HANGER delete; RESTRAINT compaction plan; composite RESTRAINT support |
| `tabs/cii-workspace/cii-workspace-writer2-composite-restraint.js` | `c007c91e1ac73a3ba5003f59ccdfa027eb5156a0` | contracts; physical-file; byte-sha256; composite HANGER; RESTRAINT delete write; SIF delete; HANGER delete; RESTRAINT compaction plan; composite RESTRAINT support |
| `tabs/cii-workspace/cii-workspace-writer2-product-validation.js` | `05fcb594a3be5e360ce804c77872319730a16b53` | contracts; composite HANGER validation; partial HANGER validation; composite RESTRAINT validation |
| `tabs/cii-workspace/cii-workspace-writer2-restraint-delete-compaction-plan.js` | `aedfb3ac78eed2294a88a64af261386f0db65085` | fixed-field; contracts; byte-sha256; RESTRAINT delete custody |

These are source pins, not execution evidence.

## Core monolithic import fan-out

`cii-workspace-core.js` statically imports 33 repository modules before W2 A can reach its route:

1. `cii-workspace-contracts.js`
2. `cii-workspace-intake.js`
3. `cii-workspace-topology-adapter.js`
4. `cii-workspace-geometry.js`
5. `cii-workspace-multi-base-anchor.js`
6. `cii-workspace-multi-base-correspondence.js`
7. `cii-workspace-landmarks.js`
8. `cii-workspace-anchor-suggestions.js`
9. `cii-workspace-topology.js`
10. `cii-workspace-path-candidates.js`
11. `cii-workspace-node-custody.js`
12. `cii-workspace-components.js`
13. `cii-workspace-identity.js`
14. `cii-workspace-engineering-delta.js`
15. `cii-workspace-writer1b-deltas.js`
16. `cii-workspace-restraint-transfer.js`
17. `cii-workspace-restraint-slot-transfer.js`
18. `cii-workspace-writer1c-sif-deltas.js`
19. `cii-workspace-compare-review.js`
20. `cii-workspace-transfer-plan.js`
21. `cii-workspace-review.js`
22. `cii-workspace-placeholders.js`
23. `cii-workspace-target-writer.js`
24. `cii-workspace-target-writer-1b.js`
25. `cii-workspace-target-writer-composite.js`
26. `cii-workspace-writer2-composite-routing.js`
27. `cii-workspace-writer2-composite-hanger.js`
28. `cii-workspace-writer2-composite-restraint.js`
29. `cii-workspace-writer-validation.js`
30. `cii-workspace-writer1c-validation.js`
31. `cii-workspace-writer-composite-validation.js`
32. `cii-workspace-writer2-product-validation.js`
33. `cii-workspace-export.js`

This monolithic module-load fan-out is the dominant exact-reconstruction cost. It must not be confused with the much smaller route-essential RESTRAINT transaction.

### Core imports closed in order so far

| Core import | Path | Git blob | Closure |
|---:|---|---|---|
| 1 | `tabs/cii-workspace/cii-workspace-contracts.js` | `6ab30d8dd088225fd89bb729bf9ffdebefe652f6` | self-contained |
| 2 | `tabs/cii-workspace/cii-workspace-intake.js` | `3939ff6866191bca0ccf6d27264ecd1f2549ddd5` | direct fan-out completely source-pinned below |
| 3 | `tabs/cii-workspace/cii-workspace-topology-adapter.js` | `57b8d2d6e8335887b962e09085cc93ece2e36d68` | contracts only |
| 4 | `tabs/cii-workspace/cii-workspace-geometry.js` | `d2b7094db91c1e5eba330c550c0b633fc3d9b7ca` | contracts only |

FIRST_UNCLOSED_CORE_FRONTIER:
`tabs/cii-workspace/cii-workspace-multi-base-anchor.js` (core import #5).

## Canonical intake closure

`tabs/cii-workspace/cii-workspace-intake.js`
blob `3939ff6866191bca0ccf6d27264ecd1f2549ddd5`.

Direct imports:

| Path | Git blob | Closure |
|---|---|---|
| `parser/caesar-parser.js` | `46b921c656fff242354c27b6d1a83dd40791f7ec` | complete direct parser fan-out pinned below |
| `tabs/cii-workspace/cii-workspace-auxiliary.js` | `7459677eccb2ca460b1971ac6d75c22f2f5ae870` | fixed-field + contracts only |
| `tabs/cii-workspace/cii-workspace-hanger.js` | `71e5bca8cb3429878785244b5508e104add2fc57` | fixed-field + contracts only |
| `tabs/cii-workspace/cii-workspace-capabilities.js` | `db7b67ed25ccad6f8bb46c03561747ea7b2094c1` | contracts only |
| `tabs/cii-workspace/cii-workspace-contracts.js` | `6ab30d8dd088225fd89bb729bf9ffdebefe652f6` | self-contained |
| `tabs/cii-workspace/cii-workspace-nodename.js` | `050df81250d62cc454856e403d6e4ffc85fd9321` | fixed-field + physical-file |
| `tabs/cii-workspace/cii-workspace-physical-file.js` | `0c4c445f45c1ee4171567b15b4dbfc5fb2887ffa` | self-contained |
| `tabs/cii-workspace/cii-workspace-writer1c-sif-custody.js` | `915ceb0a2c5b7b7a8790676cc4b27ee71218a028` | fixed-field + physical-file |

Shared leaves:

- `parser/fixed-field.js` blob `485daa43553681ca54f488499e57f36d2239be58`, self-contained.
- `cii-workspace-contracts.js` blob `6ab30d8dd088225fd89bb729bf9ffdebefe652f6`, self-contained.

### Historical sparse-mirror frontier closure

Historical W2.13 recovery stopped while reconstructing `cii-workspace-auxiliary.js` after 54 exact JS files. On merged main that module is exact at blob `7459677e...` and has only two static dependencies, both now exact and closed:

- `parser/fixed-field.js` -> `485daa43...`
- `cii-workspace-contracts.js` -> `6ab30d8d...`

Therefore the historical auxiliary stop is a transport/materialization frontier, not an authored product failure and not evidence of a large dependency fan-out at that module.

## CAESAR parser direct fan-out closure

`parser/caesar-parser.js` statically loads neutral, XML and PDF support even when W2 A uses neutral-like synthetic bytes. All direct fan-out is source-pinned:

| Path | Git blob | Transitive closure |
|---|---|---|
| `parser/sections/elements.js` | `e0f6fbb30a4849d2659608eb10965a53b823286d` | `utils/formatter.js` + fixed-field |
| `parser/sections/bends.js` | `4673fc54253f8d94e7c52d416b22e15f1e12a94d` | self-contained |
| `parser/sections/restraints.js` | `687f167678a2804c01de36e4a03561d8fa298f5d` | self-contained |
| `parser/sections/forces.js` | `d1d709fd4fe367c5e56ea29ec8cb1e3bf451bf7c` | self-contained |
| `parser/sections/units.js` | `9aaca6ff54ee22af120ccb00307a1befacf82f45` | self-contained |
| `parser/sections/xml-elements.js` | `0e967fa4044570f7af734fef21683a5ac9b5e53d` | formatter + support-debug |
| `parser/pdf-parser.js` | `e7f2711daa0c31fba8e2f9023380e6774b2d8f8a` | formatter; static import contains query suffix but same source module |
| `parser/validator.js` | `90cef22039bcedbe0699ed9137855ea84c1d3f34` | self-contained |
| `utils/formatter.js` | `e37c1bfed10d03be957e9f3f27e39e7f3bca7883` | self-contained |
| `debug/support-debug.js` | `edabff13f6563bbd0e6a9fa38b437ccd3cc42224` | self-contained |

## Evidence classification

What this ledger proves:

- the source files and static-import relationships listed above exist at the exact merged material basis;
- the historical auxiliary frontier is no longer an unknown source dependency;
- canonical intake and the direct CAESAR parser fan-out are source-closed;
- core imports #1 through #4 are source-closed;
- the next deterministic frontier is core import #5, `cii-workspace-multi-base-anchor.js`.

What this ledger does NOT prove:

- that Node loaded the complete graph;
- that `applyCiiWorkspaceTargetWriter2()` executed;
- that any W2 A assertion ran;
- that BM-W2-01..04 public passed;
- any V14/native/release qualification.

Therefore:

`W2_A = NOT_RUN`

and all dependent public/V14/native/release gates remain unchanged.

## Next exact action

Fetch `tabs/cii-workspace/cii-workspace-multi-base-anchor.js` from material basis `a9018c131be736606e44fd0379545d233238f33e`, verify its Git blob against the recursive tree, enumerate its static imports, close that transitive branch exactly, then continue core import order. If a complete exact graph becomes executable, run the unchanged W2 A test. A missing module/environment stop remains NOT_RUN; the first authored assertion/product exception is the first permissible FAIL evidence and sole trigger for a production patch.
