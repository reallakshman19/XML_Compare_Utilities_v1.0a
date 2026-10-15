<!-- ENG-PR-V2:ENDPOINT
CHAIN_ID=CII-W2-NODENAME-BYTE-R1-1224
ENDPOINT_ID=EP-CII-W2-NB-R1-0008
-->
# Endpoint checkpoint — EP-CII-W2-NB-R1-0008

```text
Agent instance: chatgpt:e37d9cd9-b51b-4b1e-94f1-c75a4a55f52b
Endpoint: EP-CII-W2-NB-R1-0008
Predecessor endpoint: EP-CII-W2-NB-R1-0007
Work item: github:reallaksh19/XML_Compare_Utilities#1224
Programme: PGM-XMLCU-CII-W2-MS-NODENAME
Parent basis: PB-0003
Branch: revision/cii-writer2-nodename-byte-r1-1224
Main observed: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
PR: NONE
Engineering: READY_READ_ONLY
Qualification: ANSWER_COMPLETE_VERDICT_DEFERRED_FOR_RETAINED_BENCHMARK
Write authority: READ_ONLY
Merge authority: OWNER_ONLY
Merge authorized: FALSE
```

## Owner progression context
Owner message `ok, proceed with next` authorized continuation of the current read-only next action. It is not recorded as one of the exact Common canonical progression commands, so no qualification/question-display authority transition is inferred.

## Material evidence added
`agents/chains/CII-W2-NODENAME-BYTE-R1-1224/evidence/BM-CII-W2-NB-R1-LOCAL-0002.md`

Focused local Node falsifiers against exact extracted current-branch function bodies prove:
- Writer2 cardinality selection accepts CREATE/DELETE only and drops Writer1C COPY/REPLACE;
- current multisource preview target conflict arbitration ignores same-target REPLACE claims while detecting conflicting CREATE claims;
- current transfer policy already permits a nonblank→different-nonblank NodeName COPY as `PREVIEW_READY` with `CII_WRITER_1C_NODENAME_EXISTING_ROW_FIELD` when `allowNodeNameOverwrite=true`, while remaining blocked by default;
- therefore the first REPLACE defect is orchestration/selectability/conflict routing, not the protected Writer1C fixed-span primitive.

## Protected conclusions
- keep Writer1C existing-row exact-span writer NO-PATCH until separately falsified;
- keep Writer2 CREATE/DELETE relocation/write authority separate;
- do not turn `ciiCanonicalWriter2MutationSelection()` into a generic all-writer selector merely to carry REPLACE;
- future authorized integration should maintain a separate Writer1C REPLACE claim set, conflict-arbitrate exact target+payload, apply REPLACE before structural mutation, re-intake, then rebind Writer2 structural work.

## Truth boundary
- production source mutation: NONE
- frozen benchmark/oracle mutation: NONE
- workflow/CI reliance: NONE
- retained structural baseline: NOT_RUN_ENVIRONMENT
- full PB-0003 S1/S2/S3/T/TEXPECTED benchmark: NOT_RUN_ENVIRONMENT
- independent verdict: DEFERRED_UNTIL_EXECUTABLE_RETAINED_BENCHMARK_EVIDENCE

## Exact next action
Provide/mount a byte-faithful local checkout containing exact retained inputs, then run:
```text
node tests/cii-workspace-multisource-retained-auto-anchor-benchmark.test.js
node tests/cii-workspace-multisource-pb0003-benchmark.test.js
```
Capture stdout/stderr and custody hashes. Only then obtain the independent Q1-Q5 verdict and perform post-basis/current-main/overlap reconciliation before any production mutation.
