# PR1114 workreport — Writer2 W2A absent-family readiness repair

## Mission

Repair issue #1113, the first authored W2 A public-route product failure reached while continuing PR #1064, without widening Writer2 CREATE or topology authority.

## Grounding

```text
repository        reallaksh19/XML_Compare_Utilities
base main         976a549c5463c8839396588bec99abbed66338fa
branch            fix/cii-writer2-w2a-absent-family-readiness
source issue      #1113
predecessor       PR #1064 / EP-CII-W2-0015
frozen W2A basis  a9018c131be736606e44fd0379545d233238f33e
W2A runner blob   9922377ddeda86fc9167d65f33c97095346e79fa
```

PR #1064 received independent `PASS_WRITE_ALLOWED` qualification before product mutation. Its runtime batch remained `NOT_RUN_ENVIRONMENT` under native Git because `github.com` DNS is unavailable in the execution container.

A mounted repository Pages artifact plus connected GitHub exact-blob access later allowed the unchanged W2 A runner to reach authored assertions. This changed the evidence state from environment-only blocking to an observed product failure.

## First authored failure

RESTRAINT-only W2 A readiness failed with:

```text
WRITER_2_SIF_CREATE_AUTHORITY_UNEXPECTEDLY_READY
WRITER_2_HANGER_CREATE_AUTHORITY_UNEXPECTEDLY_READY
```

Current-main/frozen routing source used:

```js
if (sifPlan?.createAuthority?.ready !== false) ...
if (hangerPlan?.createAuthority?.ready !== false) ...
if (restraintPlan?.createAuthority?.ready !== false) ...
```

For an absent family `plan === null`, optional chaining returns `undefined`; `undefined !== false` evaluates true. The gate therefore interpreted absence of a sibling family as unexpectedly enabled CREATE authority.

## Production repair

Only a present family plan is required to testify that CREATE remains blocked:

```js
if (sifPlan && sifPlan.createAuthority?.ready !== false) ...
if (hangerPlan && hangerPlan.createAuthority?.ready !== false) ...
if (restraintPlan && restraintPlan.createAuthority?.ready !== false) ...
```

This does not alter the actual CREATE blockers or allow any new operation family.

Published routing blob:

```text
before  2e7a21bd17aa9af405f1a2f93201d4a45bb09e4b
after   131fcb0b74657ff22319abe9bdd258555afba8ea
```

## Secondary fixture custody correction

After the readiness repair, unchanged W2 A advanced to its NODENAME-only case. The shared synthetic `nodeCreate()` operation omitted the exact evidence authority already required by production routing.

Correct test-only repair:

```js
evidenceAuthority: 'CII_NODENAME_FIXED_LAYOUT'
```

Production NODENAME authority was not relaxed.

Fixture blobs:

```text
before  b725d56be579e7a2d7c40995ca2e13af7e702cbc
after   67f0cc6903996cd7b83f2e937fadd92f00a83b9b
```

## Current-main I13 reconciliation

The frozen historical graph subsequently exposed its older G13.6 NODENAME pointer expectation. This is not a new PR1114 defect: merged PR #1112 already corrected current main so `ELEMENT_NODENAME_POINTER` uses lexical I13 via `integerField(change.newPointer)`.

PR1114 does not modify the validator.

## Focused regression

New test:

```text
tests/cii-workspace-writer2-absent-family-readiness.test.js
blob 9b63a362e116ff72a093d7301c5b7bdab499534b
```

It proves a qualified RESTRAINT-only transaction:

- is `PREVIEW_READY` / readiness `READY`;
- has no SIF or HANGER component plans;
- retains a ready RESTRAINT delete component;
- is not falsely blocked by absent-family CREATE-authority assertions.

It also executes present-family SIF DELETE, HANGER DELETE, and RESTRAINT DELETE readiness and requires each present component to keep `createAuthority.ready === false`. The regression therefore proves the fix removes only absent-family false blockers and does not weaken CREATE protection.

Observed local execution:

```text
Writer2 absent sibling-family readiness guards passed.
```

Classification: `PASS_EXECUTED_LOCAL_EXACT_PATCH_FILES`.

## W2 A rerun

The unchanged authored W2 A runner was rerun with:

- exact W2 A runner and shared fixture provenance;
- the PR1114 routing/fixture patch bytes;
- current-main lexical-I13 NODENAME validator behavior already merged by #1112;
- unchanged Writer2 product/composite logic otherwise.

Observed:

```text
Writer2 W2.13 synthetic RESTRAINT product routing qualification passed.
exit = 0
```

Classification: `PASS_CURRENT_MAIN_EQUIVALENT_EXECUTABLE_GRAPH`.

This is deliberately **not** represented as `PASS_EXACT_CURRENT_MAIN_GIT_CHECKOUT`, because native GitHub DNS remains unavailable and the mounted artifact is not itself a complete `.git` checkout.

## Validation ledger

| Gate | Result |
|---|---|
| Syntax checks: routing / fixture / focused regression | PASS |
| Focused absent-family + present-family CREATE-block regression | PASS_EXECUTED_LOCAL_EXACT_PATCH_FILES |
| W2 A current-main-equivalent executable graph | PASS |
| W2 A authored completion marker | OBSERVED |
| Exact current-main Git checkout W2 A | NOT_RUN_ENVIRONMENT — GitHub DNS unavailable |
| PR-triggered CI | NOT_RUN / no execution claimed |
| Repository-wide `npm test` | NOT_RUN_ENVIRONMENT |

No source-inspection or executable-graph result is promoted into a stronger evidence class.

## Changed paths

Engineering patch:

```text
tabs/cii-workspace/cii-workspace-writer2-composite-routing.js
tests/cii-workspace-writer2-composite-restraint-fixture.js
tests/cii-workspace-writer2-absent-family-readiness.test.js
```

Custody metadata:

```text
agents/PR1114_workreport.md
```

No `.github/workflows/**`, benchmark, oracle, tolerance, converter, Writer1C, Writer3/topology, or unrelated UI path is changed.

## Local backup / patch ledger

Local worklog:

```text
.agent-worklogs/20260907_0905_w2a-absent-family-readiness/
```

Backups were made before local material edits using repository backup tooling. The patch ledger records pre/post SHA-256 and local Git object identities for the production and fixture files.

## Authority boundaries

Still blocked / unchanged:

```text
SIF CREATE
HANGER CREATE
RESTRAINT CREATE
Writer1C custody widening
Writer3/topology mutation
benchmark/oracle/tolerance mutation
converter semantic changes
workflow changes
```

## Merge state

```text
PR state          DRAFT
merge authorized  FALSE for PR #1114
```

Do not merge without fresh explicit Owner authorization.
