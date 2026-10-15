# PR1008 — CII Writer 1C Phase-1 Hardening Work Report

## Recovery header

```text
HANDOVER_READINESS: READY
PR_RECOVERY_STATE: HEALTHY / IMPLEMENTED / DRAFT / EXECUTION GATE NOT_RUN_ENVIRONMENT
TAKEOVER_AUTHORITY: WRITE_ALLOWED
REPOSITORY: reallaksh19/XML_Compare_Utilities
PR: 1008
BRANCH: agent/cii-writer-1c-hardening
BASE: main@692be3fd536b7c62576c443f5f831984e4de66a2
MISSION: close endpoint-only physical-binding gap in merged Writer 1C NODENAME custody
MERGE_AUTHORITY: OWNER_ONLY
```

## 1. Finding closed

Merged PR1004 correctly preferred parsed-element index + physical block index + FROM/TO, but then permitted first-unused FROM/TO fallback. Endpoint equality alone cannot establish physical mutation ownership when parallel/duplicate ELEMENT endpoint pairs exist or when parser/physical indexing has drifted.

PR1008 changes the authority rule to:

```text
Writer1C writable ELEMENT->NODENAME binding =
    parsed ELEMENT index == physical 15-row block index
    AND parsed FROM == physical FROM
    AND parsed TO == physical TO
```

## 2. Read-only compatibility retained without mutation authority

A unique endpoint-only fallback remains available only to recover display/read-only NODENAME semantics and is labelled:

```text
ENDPOINT_FALLBACK_READ_ONLY
```

It always adds:

```text
NODENAME_ELEMENT_PHYSICAL_BINDING_EXACT_REQUIRED:<elementIndex>
```

so `physicalCustody.status` is BLOCKED and Writer1C readiness cannot pass.

Two or more endpoint-only candidates fail as:

```text
NODENAME_ELEMENT_BLOCK_AMBIGUOUS
```

and no physical NODENAME span is admitted from that ambiguous binding.

## 3. Canonical-layout hardening

Added/retained fail-closed guards:

```text
NODENAME_ELEMENT_BLOCK_ROW_COUNT_NOT_MULTIPLE_OF_15
NODENAME_ELEMENT_CANONICAL_HEADER_INVALID:<blockIndex>
NODENAME_ELEMENT_BLOCK_COUNT_MISMATCH
```

The descriptor loop requires a complete 15-row block and does not admit an incomplete trailing record.

## 4. Regression cases authored

`tests/cii-workspace-writer1c-element-custody-hardening.test.js` proves the intended contract:

1. exact parser-index + physical-block + endpoint binding remains QUALIFIED and Writer1C ready;
2. unique endpoint-only recovery retains read-only name evidence but Writer1C blocks;
3. duplicate/parallel FROM→TO candidates do not resolve by iteration order and create no writable spans;
4. 14-row/non-canonical ELEMENT shape blocks physical custody.

## 5. Existing Writer1C guarantees intentionally unchanged

PR1008 does not alter:

- original TARGET byte authority;
- fixed NODENAME FROM/TO spans;
- shared-span alias arbitration;
- equal-width ASCII patching;
- independent validator-derived `S_auth`;
- stale-target/preimage protection;
- byte-negative assurance;
- pointer/CONTROL/cardinality invariance;
- semantic postcondition / zero unexpected delta requirement.

## 6. Validation truth

```text
main grounding                            PASS_REMOTE_SOURCE_INSPECTION
branch ancestry / file boundary           PASS_GIT_COMPARE
source/diff review                        PASS_SOURCE_INSPECTION
focused PR1008 regression                 AUTHORED_NOT_RUN_ENVIRONMENT
inherited Writer1C focused regressions    NOT_RUN_ENVIRONMENT
full npm test                             NOT_RUN_ENVIRONMENT
browser                                   NOT_RUN_ENVIRONMENT
```

Execution reason: the container cannot resolve `github.com`; a complete exact branch checkout cannot be materialized for Node/npm execution. No workflow was changed or added to manufacture a PASS.

## 7. Changed-file ledger

Expected final PR files:

```text
agents/PR1008_workreport.md
agents/claims/PR1008.yaml
agents/status/PR1008.yaml
tabs/cii-workspace/cii-workspace-nodename.js
tests/cii-workspace-writer1c-element-custody-hardening.test.js
```

No SIF/TEE production writer, PR1006 qualification artifact, Writer1A/1B implementation, transfer policy, protected converter, workflow, UI, matching, or topology logic is in scope.

## 8. Appendix A — next-agent qualification

1. Explain why equal FROM/TO endpoints are insufficient physical-record identity.
2. State the exact three conditions required for writable ELEMENT->NODENAME custody.
3. Explain why `ENDPOINT_FALLBACK_READ_ONLY` can retain display evidence but must force Writer1C BLOCKED.
4. Explain the fail-closed behavior when two physical blocks share the same endpoint pair.
5. Explain why incomplete/non-15-row ELEMENT physical layout cannot be a Writer1C record source.
6. Identify which PR1004 anti-drift guarantees were deliberately left unchanged.
7. State which tests remain NOT_RUN and why source inspection cannot replace them.

## 9. Next action

Review PR1008 as an isolated Phase-1 hardening patch. Do not merge without owner authorization. After PR1008 disposition, handle the V11/V12 SIF authority issue separately from this branch.
