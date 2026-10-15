# PR1063 — W2 A materialization route exhaustion update

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
PR: #1063
MATERIAL_QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
ROOT_TREE: 27eb6c81b8b69742e781720b2450714df7c7f74e
W2_A_TEST_BLOB: 9922377ddeda86fc9167d65f33c97095346e79fa
OBSERVATION_CLASS: ENVIRONMENT / ARTIFACT AVAILABILITY
RUNTIME_CLASSIFICATION: NOT_RUN

## Purpose

Record the additional exact-materialization routes tested after EP-CII-W2-0010. This file does not promote W2 A and does not authorize any Writer2 production change.

## Additional routes checked

### 1. Container commit-archive download

Attempted the exact commit archive URL for `a9018c131be736606e44fd0379545d233238f33e` through the container download primitive.

Result: the download primitive rejected the URL because its safety gate requires a previously viewable URL. A direct web open of the commit archive returned a cache miss and therefore did not satisfy that gate. No archive bytes were delivered to the execution container.

Classification:

```text
EXACT_COMMIT_ARCHIVE_IN_CONTAINER = NOT_RUN_TOOL_TRANSPORT_POLICY
REPOSITORY_BYTES_RECEIVED         = FALSE
```

This is not a Writer2 failure.

### 2. Persistent ChatGPT Library search

Searched the persistent Library for:

- a full `XML_Compare_Utilities` checkout/archive/bundle at `a9018c13...`;
- retained W2.13 / `w217` / `w218` executable mirrors;
- a full checkout containing `cii-workspace-writer2-restraint-product-routing.test.js`.

Results surfaced historical prompts/reports only. No repository archive, full checkout, exact executable bundle, or retained W2 sparse mirror was found.

Classification:

```text
RETAINED_LIBRARY_EXACT_CHECKOUT = NOT_APPLICABLE_NONE_FOUND
```

## Consolidated exact-materialization state

```text
ordinary git checkout/network         unavailable (DNS)
GitHub connector archive endpoint     unsupported/rejected
GitHub Actions run/artifact at SHA    none
committed repo checkout/bundle        none found
persistent Library exact snapshot     none found
container exact archive download      blocked by tool transport policy
manual sparse/subset reconstruction   prohibited as W2 A public evidence
```

The remaining admissible next event is execution in a substrate that can materialize the exact repository checkout at the frozen SHA without source reconstruction.

## Gate classification

```text
STATIC_SOURCE_GRAPH             = CLOSED
EXACT_EXECUTABLE_CHECKOUT       = UNAVAILABLE_IN_CURRENT_ENVIRONMENT
W2_A                            = NOT_RUN
FIRST_AUTHORED_PRODUCT_FAILURE  = NONE
PRODUCTION_PATCH_AUTHORITY      = NONE
ENGINEERING_CRITICAL_WRITE      = FALSE
```

Retained gates remain unchanged: BM-W2-01..04 public, W2 B, W2.35, W2.35a and W2.40 are NOT_RUN; W2 H is NOT_READY.

## Protected boundary

Do not convert this infrastructure result into product PASS/FAIL. Do not create stubs, rewrite imports, rebuild a partial repository, mutate benchmarks/oracles/tolerances/workflows, or patch Writer2 before an authored failure is reached under an exact checkout.
