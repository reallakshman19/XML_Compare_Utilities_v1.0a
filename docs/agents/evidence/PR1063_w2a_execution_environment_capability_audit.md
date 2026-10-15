# PR1063 — W2 A exact execution-environment capability audit

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
PR: #1063
MATERIAL_QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
OBSERVATION_CLASS: SOURCE_INSPECTION + LOCAL_EXECUTION_ENVIRONMENT_AUDIT
W2_A_RUNTIME_CLASSIFICATION: NOT_RUN
PRODUCTION_PATCH_AUTHORITY: NONE

## Purpose

After `EP-CII-W2-0008` closed the exact static W2 A source graph, test every admissible read-only route available in the current agent environment for obtaining an exact executable repository materialization without reconstructing a subset, modifying workflows, or widening Writer2 authority.

## Frozen execution target

```text
repository = reallaksh19/XML_Compare_Utilities
commit = a9018c131be736606e44fd0379545d233238f33e
root tree = 27eb6c81b8b69742e781720b2450714df7c7f74e
W2 A test = tests/cii-workspace-writer2-restraint-product-routing.test.js
W2 A test blob = 9922377ddeda86fc9167d65f33c97095346e79fa
command = node tests/cii-workspace-writer2-restraint-product-routing.test.js
```

The test is a native ES module test (`package.json` has `"type": "module"`) and its direct external runtime requirements are Node built-ins. The current execution host has Node `v22.16.0` and Git `2.47.3`; therefore the observed blocker is repository-byte transport, not absence of Node or Git.

## Route 1 — ordinary exact Git checkout

Prior EP8 probe:

```text
git ls-remote https://github.com/reallaksh19/XML_Compare_Utilities.git refs/heads/main
fatal: unable to access 'https://github.com/reallaksh19/XML_Compare_Utilities.git/': Could not resolve host: github.com
status 128
```

Classification:

```text
STATUS = NOT_RUN
OBSERVATION = LOCAL_EXECUTION
FAILURE_ORIGIN = DNS/NETWORK BEFORE REPOSITORY MATERIALIZATION
AUTHORED_W2A_CODE_REACHED = FALSE
```

## Route 2 — reusable GitHub Actions artifact at frozen commit

Read-only query of workflow runs associated with `a9018c131be736606e44fd0379545d233238f33e` returned:

```text
workflow_runs = []
```

Therefore there is no existing frozen-commit workflow artifact that can be downloaded and used as an exact checkout. No workflow was created, modified, dispatched, or rerun.

## Route 3 — GitHub repository archive through connector

Read-only request to the exact GitHub tarball endpoint for the frozen commit was attempted through the connected GitHub fetch capability:

```text
https://api.github.com/repos/reallaksh19/XML_Compare_Utilities/tarball/a9018c131be736606e44fd0379545d233238f33e
```

The connector rejected this endpoint as unsupported (`INVALID_ARGUMENT`) before any archive bytes were returned. This is a connector-capability stop, not a repository or Writer2 failure.

## Route 4 — committed/reusable exact sparse mirror or bundle

Repository search found no committed W2.13 exact-checkout/bundle artifact suitable for execution.

Historical `agents/PR1054_workreport.md` explicitly records that the previous exact sparse mirror existed only under `/mnt/data/w217`, admitted 54 JS files by Git blob identity, and is not retained in the current execution container. The report instructs a successor to reconstruct exact dependencies again or use an exact executable checkout.

Because EP8 now explicitly forbids a manually reconstructed subset from being used as W2 A public-runtime evidence, the historical sparse-mirror method is not restarted here.

## Route 5 — Git tree/source availability through connector

The frozen commit's root tree is readable through the GitHub connector at tree SHA:

```text
27eb6c81b8b69742e781720b2450714df7c7f74e
```

The recursive tree and individual exact source blobs are available for source inspection. This is sufficient to maintain static source custody but does not provide a filesystem checkout or archive to Node. Copying selected files from connector responses into a local directory would be a manually reconstructed subset and is not admitted as W2 A PASS evidence under EP8.

## Exhaustion result

Within the currently available capabilities, every admissible non-mutating exact-materialization route has been checked:

```text
ordinary Git checkout                  BLOCKED_ENVIRONMENT_DNS
existing frozen-commit workflow asset  NONE
connector exact tarball/archive        UNSUPPORTED_BY_CONNECTOR
committed exact checkout/bundle        NONE_FOUND
manual sparse/subset reconstruction    PROHIBITED_AS_PUBLIC_RUNTIME_EVIDENCE
```

The execution host itself is otherwise adequate for the unchanged command:

```text
node = v22.16.0
git  = 2.47.3
package module mode = ES module
```

## Gate classification

```text
STATIC_SOURCE_GRAPH = CLOSED
EXACT_EXECUTABLE_MATERIALIZATION = UNAVAILABLE_IN_CURRENT_ENVIRONMENT
W2_A = NOT_RUN
FIRST_AUTHORED_PRODUCT_FAILURE = NONE
PRODUCTION_PATCH_AUTHORITY = NONE
BM-W2-01..04_PUBLIC = NOT_RUN
W2_B = NOT_RUN
W2.35 = NOT_RUN
W2.35a = NOT_RUN
W2.40 = NOT_RUN
W2_H = NOT_READY
```

No runtime PASS/FAIL is inferred from source inspection or environment capability checks.

## Exact next admissible action

Use an execution environment that can obtain the exact private repository checkout at `a9018c131be736606e44fd0379545d233238f33e` without source reconstruction. Verify:

```text
HEAD = a9018c131be736606e44fd0379545d233238f33e
W2 A blob = 9922377ddeda86fc9167d65f33c97095346e79fa
```

Then run unchanged:

```text
node tests/cii-workspace-writer2-restraint-product-routing.test.js
```

Preserve stdout/stderr and exit code. Environment/module stop before authored execution remains `NOT_RUN`; first authored assertion/product exception becomes `FAIL`; clean authored completion is candidate `PASS` subject to qualification/verification rules.

## Protected boundaries

Do not use a stub, import rewrite, manually reconstructed subset, partial-core substitute, regenerated entrypoint, workflow mutation/bypass, benchmark/oracle change, tolerance weakening, converter substitution, SIF CREATE authority, Writer3/topology mutation, or release-state promotion to force execution or PASS.
