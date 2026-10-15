# PR1063 — W2 A exact static closure complete / runtime transport blocked

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
PR: #1063
MATERIAL_QUALIFICATION_BASIS_HEAD: a9018c131be736606e44fd0379545d233238f33e
OBSERVATION_CLASS: SOURCE_INSPECTION + LOCAL_EXECUTION_TRANSPORT_PROBE
RUNTIME_CLASSIFICATION: NOT_RUN
PRODUCTION_PATCH_AUTHORITY: NONE

## Result

The exact repository-source dependency graph needed to load the unchanged W2 A public test is now statically closed at the frozen merged basis. No unresolved repository import remains in the observed graph.

This is not W2 A runtime evidence. An unchanged private-repository materialization probe failed before checkout with DNS/network resolution failure, so no Node module, Writer2 route, or authored assertion executed.

```text
W2_A = NOT_RUN
FIRST_AUTHORED_FAILURE = NONE_OBSERVED
PRODUCTION_PATCH_JUSTIFIED = FALSE
```

## Live-state reconciliation

```text
main observed = a9018c131be736606e44fd0379545d233238f33e
PR #1063 base = a9018c131be736606e44fd0379545d233238f33e
pre-evidence PR head observed = b7e415906c64f97c7b8a2ad4a31dd09cf42cfc0b
reviews = none
review threads = none
status contexts = none
```

The two commits after EP-CII-W2-0007's checkpoint were relay metadata only. No production/test/material-basis drift was found.

## Unchanged entrypoint

`tests/cii-workspace-writer2-restraint-product-routing.test.js`

Git blob: `9922377ddeda86fc9167d65f33c97095346e79fa`

The authored test requires the public route to produce PASS, exact equality with the direct composite result, product validator class `RESTRAINT_DELETE_COMPOSITE`, and zero unexpected semantic deltas. It also contains negative cases for CREATE authority, forged policy, missing RESTRAINT component testimony, forged result schema, stale target hash, and a non-RESTRAINT public product path.

## Core direct-import closure

The 33 direct imports of `tabs/cii-workspace/cii-workspace-core.js` are now source-closed. Existing PR1063 ledger evidence already closed imports #1-#4 and canonical intake/parser fan-out. This leg closed #5 onward.

### #5-#9 matching / topology branch

- `cii-workspace-multi-base-anchor.js` — `c782f2c64338845960a7f2d52d8ce25510d849ec`
  - new leaf `cii-workspace-pipe-runs.js` — `ac2f5eb9422e723b8637e41faf01e555d15becc6`; contracts only.
- `cii-workspace-multi-base-correspondence.js` — `fdedb84add2faac6b38bff9300fe79224c8808e5`
  - `cii-workspace-propagation.js` — `ed269310d83ef8a37b57c64541aa32ba7e0528a7`
  - `cii-workspace-correspondence-arbitration.js` — `ff26a1921dc527a7d7cef2e9a94c56b92651484f`
  - `cii-workspace-candidates.js` — `8d57ef688eb44c274bc5e9a4aac2547f4ee81748`
  - `cii-workspace-evidence.js` — `8c7e392d42308eb1cb6671314e55e99be8b72a57`
  - `cii-workspace-match-methods.js` — `20c129291d85d16558185b711dc1cd334769d21e`
- `cii-workspace-landmarks.js` — `cc8d8e0861987357386e105ca164ceac23162594`; contracts only.
- `cii-workspace-anchor-suggestions.js` — `6aebbf63afa65a2001413365671827aa3a27299e`
  - `cii-workspace-anchor-method-a.js` — `25408f2f21fd50c3e3e3daa547a41fbd130760a0`; contracts + already-closed geometry.
- `cii-workspace-topology.js` — `9ce89073a104d7a7313d3c8a95ea927f65daaca9`
  - `tabs/model-converters/xml-cii-inputxml-path-aligner.js` — `6a9e17e0f4373d8d0e57111e2b135ea645b7e080`; self-contained.
  - `cii-workspace-alignment.js` — `d4e297006bd6470592c5bf252fff1a66eeebfede`
  - `cii-workspace-path-gates.js` — `320d7451d0922d6b65d4238c859707c3d77473db`; contracts only.

### #10-#17 custody / engineering-delta branch

- `cii-workspace-path-candidates.js` — `618d3a36a5ead65bf48a0905828bed6a72f96887`; reuses aligner/evidence.
- `cii-workspace-node-custody.js` — `8fbbf0f4040920172ef2b9ebdf9d62a4aa8bf029`; contracts only.
- `cii-workspace-components.js` — `aff1590bccfdfa6a33cb9ae6533ee0cf519dadc5`; contracts only.
- `cii-workspace-identity.js` — `b30f5bade8e61ce7bf4d403cd6124cfa226287d9`; contracts only.
- `cii-workspace-engineering-delta.js` — `790900cccc7da1486c57d52719dde6abfa500909`; contracts + geometry.
- `cii-workspace-writer1b-deltas.js` — `43435146a3cb4741882ccfa73f0315e5c92bcaaa`
  - `cii-workspace-writer1b-od.js` — `1ed7597f14339a554fe8a3555584241e416eb6ab`; self-contained.
- `cii-workspace-restraint-transfer.js` — `410843c343ed1915a925dee84129b174f514d803`
  - `cii-workspace-restraint-pairing.js` — `18e01014aa716f0b3f15220b3c9454056bf0fc9d`; contracts only.
- `cii-workspace-restraint-slot-transfer.js` — `907708a038eab1b56886bb5398e759d95e69af7c`; fixed-field + already-closed modules.

### #18-#25 review / transfer / lower-writer branch

- `cii-workspace-writer1c-sif-deltas.js` — `f2f98a5abc089273bd2d0ec5707715ad8546c0ef`.
- `cii-workspace-compare-review.js` — `e3e8ae949dd57906743edfbdd030389d2b8e85d0`.
- `cii-workspace-transfer-plan.js` — `fb74004eb43a4f2807f45e5cf839da6686a36fad`.
- `cii-workspace-review.js` — `6454074f8247b61a052d34071a87d03d04efa8c2`; contracts only.
- `cii-workspace-transfer-policy.js` — `5bb37b810e6b46fbb617d9e6fcf4d72fce1f307f`
  - `cii-workspace-writer1c-sif.js` — `980e5c6df1d16a66ddd32ee83da9f2eae583108a`.
- `cii-workspace-placeholders.js` — `0bec565ac73ec7c06a78327725b6c6152fd81848`; contracts only.
- `cii-workspace-target-writer.js` — `ee08c208213edd2333b5d9e4ffc2dd057ff0ac8d`; fixed-field only.
- `cii-workspace-target-writer-1b.js` — `415aa234d25a02a337745c4e86756eeb3f588242`; fixed-field + target-writer.
- `cii-workspace-target-writer-composite.js` — `86e363c1fbac1d5aebed92b8054a8bf38cf0a804`
  - `cii-workspace-target-writer-1c.js` — `4b127d364d9e32519d82c25ea1f99672ed21552e`
  - `cii-workspace-writer1c-nodename.js` — `4eda5077279393b2256612fefd5581f09cd95f2e`; self-contained.

### #26-#33 Writer2/public-validation branch

- `cii-workspace-writer2-composite-routing.js` — `2e7a21bd17aa9af405f1a2f93201d4a45bb09e4b`
  - `cii-workspace-writer2-routing.js` — `0748657f49956acaf01f5d0c9c0a205474f9a7bd`
  - `cii-workspace-writer2-nodename-relocation.js` — `326954e4d6342ba25915c107c7118b4f51c23610`
  - `cii-workspace-writer2-sif-delete.js` — `7213a92de3223c4ce9b82e80fa872a55fd992ee3`
  - `cii-workspace-writer2-hanger-delete.js` — `d104fe291c0bda1b41c29604a98671dae8a23a9a`
  - `cii-workspace-writer2-hanger-record-binding.js` — `7d860be728f1eddfb374391bae9b3ae49cac808c`
  - `cii-workspace-writer2-hanger-tail-order.js` — `eda94b208239f324b45c9c70f57537c31a501e56`
  - `cii-workspace-writer2-restraint-delete-compaction-plan.js` — `aedfb3ac78eed2294a88a64af261386f0db65085`
  - `cii-workspace-byte-sha256.js` — `6435e0eaadc382a18aac6a0bd46318ab6c27c714`; self-contained.
  - `cii-workspace-writer2-restraint-delete-custody.js` — `7053230546eaba4588b98a35ae5fc3819da83c14`
  - `cii-workspace-writer2-composite-restraint-support.js` — `5b1494ba95dbfdf663bc377f8632a50d7cd2b65b`.
- `cii-workspace-writer2-composite-hanger.js` — `4f18e4fc15d01d7c3fc8938dbd591c319e814aae`
  - `cii-workspace-writer2-nodename-write.js` — `eb6bff1cdd4dc1f50e101a4f2f2dc717c74bdd5c`
  - `cii-workspace-writer2-sif-delete-write.js` — `550e37e64ab0550adde1b372d50a4b35da96d5b2`
  - `cii-workspace-writer2-hanger-delete-all-write.js` — `5993c4e534438629a683b018f15dd013c37a20b2`
  - `cii-workspace-writer2-hanger-partial-write.js` — `755057e9a276b0f4398989b44e86639a2bedfa05`.
- `cii-workspace-writer2-composite-restraint.js` — `c007c91e1ac73a3ba5003f59ccdfa027eb5156a0`
  - `cii-workspace-writer2-restraint-delete-write.js` — `e8a92417e45c75269a859469e6f51bd577b412cb`.
- `cii-workspace-writer-validation.js` — `6c84459745008629bf508a6d9623c6350acef3ec`; contracts only.
- `cii-workspace-writer1c-validation.js` — `7d389a7e52e0c0b6b7592f282fa639535915ced9`; contracts + physical-file.
- `cii-workspace-writer-composite-validation.js` — `dc264ea610cacadc4debc1ef87cd913633954c1e`; contracts only.
- `cii-workspace-writer2-product-validation.js` — `05fcb594a3be5e360ce804c77872319730a16b53`
  - `cii-workspace-writer2-composite-hanger-validation.js` — `b437ff627925b98679e579c8a5ef11bfadcddac3`
  - `cii-workspace-writer2-composite-hanger-partial-validation.js` — `6c8fddb6298026a4572e65af0042630a2960881f`
  - `cii-workspace-writer2-hanger-partial-validation.js` — `309770a62e5c2a9caa317383ae70c89c5ff02679`
  - `cii-workspace-writer2-composite-restraint-validation.js` — `919ac88c071db9d793c7793cbbd82cff7e193189`
  - `cii-workspace-writer2-composite-restraint-validation-support.js` — `a5b8f07b733161ddfec222d1a80371bcd27794e7`
  - `cii-workspace-writer2-restraint-delete-validation.js` — `1833d9fecc37061eaf2f51f1676e6386e1f9ac3`.
- `cii-workspace-export.js` — `18a1b77a01c5db36cfdcda84c0c3cf135ea3ab05`; contracts only.

Shared previously closed leaves remain:

- `cii-workspace-contracts.js` — `6ab30d8dd088225fd89bb729bf9ffdebefe652f6`.
- `parser/fixed-field.js` — `485daa43553681ca54f488499e57f36d2239be58`.
- `cii-workspace-physical-file.js` — `0c4c445f45c1ee4171567b15b4dbfc5fb2887ffa`.
- `cii-workspace-hanger.js` — `71e5bca8cb3429878785244b5508e104add2fc57`.

## W2 A RESTRAINT independent reconstruction

The frozen synthetic fixture uses element restraint pointers `[1,2,3,0]`, CONTROL restraint count `3`, six slots per block, four rows per slot, hence 24 rows per block and 72 RESTRANT rows.

W2 A deletes pointer 2. Required postcondition is:

```text
pointer mapping 1,2,3,0 -> 1,0,2,0
CONTROL restraint count 3 -> 2
RESTRANT rows 72 -> 48
retained old blocks 1 and 3 preserve their internal bytes
ELEMENT count/endpoints/topology unchanged
pointer encoding = lexical 13-character I13 integer
unrelated sections/bytes unchanged outside authorized replacement spans
```

This arithmetic is independently reconstructable from the frozen fixture and physical format. The production/validator implementations remain implementation testimony. BM-W2-04 provides a separate retained-real `INDEPENDENT_STRUCTURAL_POSTIMAGE` oracle for the same 24-row/I13 compaction class but does not substitute for W2 A public runtime.

## Runtime materialization probe

Command attempted in the execution environment:

```text
git ls-remote https://github.com/reallaksh19/XML_Compare_Utilities.git refs/heads/main
```

Observed:

```text
fatal: unable to access 'https://github.com/reallaksh19/XML_Compare_Utilities.git/': Could not resolve host: github.com
status 128
```

Classification:

```text
STATUS = NOT_RUN
OBSERVATION = LOCAL_EXECUTION
ORACLE = NONE
FAILURE_ORIGIN = ENVIRONMENT_TRANSPORT_BEFORE_REPOSITORY_MATERIALIZATION
AUTHORED_W2A_ASSERTION_REACHED = FALSE
```

No reconstructed/stubbed/partial-core execution is accepted as a substitute.

## Public/benchmark gates after this closure

```text
W2 A                 NOT_RUN
BM-W2-01 public      NOT_RUN
BM-W2-02 public      NOT_RUN
BM-W2-03 public      NOT_RUN
BM-W2-04 public      NOT_RUN
W2 B                 NOT_RUN
W2.35                NOT_RUN
W2.35a               NOT_RUN
W2.40                NOT_RUN
W2 H                 NOT_READY
```

Focused exact-blob family qualification merged in PR #1062 remains valid only at its narrower evidence class.

## Protected invariants

Do not change production merely to make source closure executable. Do not add stubs, rewrite imports, synthesize a partial core, weaken an oracle/tolerance, alter frozen benchmark expected values, promote raw SIF field-2 semantics, authorize SIF CREATE, widen Writer1C/Writer3/topology authority, or use workflow changes as a runtime substitute.

## Next exact action

Obtain an execution environment with an exact private checkout/materialization of `reallaksh19/XML_Compare_Utilities@a9018c131be736606e44fd0379545d233238f33e` and run unchanged:

```text
node tests/cii-workspace-writer2-restraint-product-routing.test.js
```

If module loading or environment fails before an authored assertion, preserve `NOT_RUN` with the exact failure. If the first authored assertion/product exception is reached, record `FAIL`, preserve the raw first failure, identify the first wrong production boundary, and only then consider a surgical production patch. After W2 A PASS, execute BM-W2-01..04 public unchanged before any higher gate promotion.