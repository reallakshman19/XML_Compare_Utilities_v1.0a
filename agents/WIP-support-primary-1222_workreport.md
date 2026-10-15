# WIP-support-primary-1222 workreport

WORK_ITEM: github:reallaksh19/XML_Compare_Utilities#1222  
RELATED_TYPICALITY_ISSUE: #1179  
CHAIN: SUPPORT-PRIMARY-1222  
BRANCH: feature/support-primary-assembly-graph  
PR: 1223  
BASE_MAIN: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581  
CURRENT_ENDPOINT: EP-SUPPORT-PRIMARY-1222-0027  
LATEST_MATERIAL_LEG: LEG-014  
LATEST_PRODUCT_MATERIAL_HEAD: efecd8f7cf90e4d5b2dd9d264064f37c3cf50140  
TECHNICAL_DISPOSITION: HOLD_DRAFT_PARTIAL_QUALIFICATION  
MERGE_AUTHORITY: OWNER_ONLY  
MERGE_AUTHORIZED: FALSE

## Mission

Move Support Report from flat tolerance-driven inference to an auditable hierarchy:

`zone -> PS/SL family -> Primary Support Assembly -> count/recovery -> structural + relationship + axis typicality -> TypicalityConsensusV1 -> governed publication`.

Optional Clash-within-Supports XML supplies PS/SL member connectivity only. It does not replace #1216 Support/Steel carrier/steel producer authority.

## Material history

### LEG-001 — explicit Primary Support Assembly topology
`SupportPrimaryRelationshipBundle.v1`, deterministic assembly IDs, numeric members countable, DATUM/reference symbolic/non-countable, support-member edges retained without mandatory pipe context, user wording `Multiple primary support`.

### LEG-002 — topology/location reconciliation
Explicit, geometry-only, partial, conflict and symbolic assignments. Unsupported relationship schemas have no authority.

### LEG-003 — family count projection
`TOTAL SUPPORT POINTS ON SECONDARY` consumes distinct countable assembly IDs. Explicit components may deduplicate geometry groups or add unobserved explicit assemblies. Ambiguity cannot reduce below legacy geometry evidence.

### LEG-004 — exact zone scope + current relationship XML
Searchable two-column Primary/piping-support and Secondary/support zone selectors using exact ancestor identity; optional current Clash-within-Supports input.

### LEG-005 — conservative orphan recovery
Second pass only. Defaults: enabled, 1.0× axial, 2.0× lateral, Same Family/PIPE/Bore ON, unique target mandatory. Explicit/partial/conflict/symbolic assignments immutable; missing enabled-gate evidence fails closed; provisional pairing requires reciprocal uniqueness.

### LEG-006 — release hardening
Production-named shared axis/bore exports, popup-scoped config, multi-popup build lease, count provenance, nested module-cache hardening.

### LEG-007 — `RELATIONSHIP_TOPOLOGY_V1`
Independent family matcher with `MATCH | NO_MATCH | REVIEW | UNAVAILABLE`. Missing explicit authority is `UNAVAILABLE`; partial authority is `REVIEW`; relationship-only evidence cannot promote structural rejection.

### LEG-008 — `AXIS_TYPICALITY_V1`
Independent intrinsic matcher using DN-normalized axial/lateral spacing, unsigned intra-model relative-axis angles, traversal count, locations-per-traversal and return multiplicity. Raw global axis vectors are not compared across XMLs. Partial evidence -> REVIEW; insufficient evidence -> UNAVAILABLE; axis-only evidence cannot promote structural rejection.

### LEG-009 — symmetric reference relationship input
Optional reference Clash-within-Supports input with scope independently derived from deepest exact reference ancestry. Current-area selections are never reused on the reference side; no exact reference zone => zero topology authority.

### LEG-010 — Column 22/23 publication governance
`SupportReportTypicalityPublication.v1` publishes Column 22 only for final `TYPICAL`; REVIEW/conflict/AMBIGUOUS/NO_MATCH/secondary-only candidates are withheld. `SupportReportTypicalityRowAudit.v1` independently preserves structural, relationship, axis, consensus/final and publication evidence. Trace/Debug advance to v4; Owner operational report columns stay unchanged.

### LEG-011 — traversal-safety authority fix
Release review found provisional geometry orphan recovery could cross known different traversals and undermine the PS-12877 return/revisit invariant. Final count authority now applies:

```text
ORPHAN_RECOVERED_GEOMETRY + DIFFERENT_TRAVERSAL
  -> ORPHAN_UNRESOLVED
     DIFFERENT_TRAVERSAL_GEOMETRY_RECOVERY_WITHHELD
```

Explicit assembly evidence remains the stronger permitted override. A >=3-point PS-12877-style regression was added.

### LEG-012 — qualification/cache attempt
No product mutation. Actions reruns still received no runner/steps. The large addon cache change was deferred rather than blindly reconstructed.

### LEG-013 — robust cache verification + blocker classification
The cache blocker was removed using a proof-gated temporary branch. GitHub compare proved the large-addon verification commit changed exactly one file with 1 addition / 1 deletion before promotion. Bootstrap -> addon -> engine -> counting now shares traversal-safety token `20260915-support-primary-traversal-safety-1`; a regression locks the route. No matcher/count/orphan/publication semantics changed.

### LEG-014 — independent executable qualification
No product mutation. A disposable Node 22 workspace was assembled from authenticated reads of the PR-head production modules. The final aggregate qualification executed **27 tests / 27 pass / 0 fail**.

Executed high-risk seams:
- Primary Support Assembly graph/reconciliation/count authority;
- PS-11167 explicit `.2/.11` synthetic 7 -> 6;
- PS-11236 synthetic unobserved `.4/.5 + DATUM` -> 4;
- ambiguity floor and unsupported-schema fail closed;
- actual orphan resolver default 1× axial / 2× lateral, same Family/PIPE/Bore gates, ambiguity and reciprocal uniqueness;
- >=3-point branch override, two-point rejection, and final cross-traversal geometry withholding;
- explicit assembly override across traversal;
- RELATIONSHIP_TOPOLOGY_V1 MATCH/NO_MATCH/REVIEW/UNAVAILABLE and unique-selection rules;
- AXIS_TYPICALITY_V1 intrinsic geometry, rotation/reflection invariance and unassessed-candidate safety;
- TypicalityConsensusV1 all-channel agreement, relationship/axis conflicts, and secondary-channel non-promotion;
- final-TYPICAL-only Column 22 publication and Column 23 conflict wording.

Qualification-only source mirror was tied to authenticated repository blob identities and was not committed to product source. One initial disposable reconciliation mirror had a transcription syntax error and was corrected against the repository before qualification; it was not a product failure.

## Protected benchmark/oracle ledger

| Family / control | Expected | Current evidence |
|---|---:|---|
| PS-11167 | 6 | executable synthetic explicit-topology control PASS; real relationship source absent |
| PS-11236 | 4 | executable synthetic explicit-unobserved + DATUM control PASS; real relationship source absent |
| PS-12060 | 1 | independent geometry-count preservation control PASS; governed real 1885 ZIP NOT_RUN |
| PS-12877 | 4 | independent geometry-count + actual traversal-safety controls PASS; governed real 1885 ZIP NOT_RUN |
| PS-12860 | 6 | governed real 1885 ZIP NOT_RUN |
| PS-12120 | 14 | existing XML/ZIP repository tests; governed real 1885 ZIP exact-head run NOT_RUN |
| PS-11168 -> PS-14168 | positive structural typicality | matcher/consensus decision channels executable PASS; governed full structural/browser path NOT_RUN |

## Authority / contract audit

PASS by source/material review and executable logic qualification:
- `main` unchanged; branch ahead-only/behind 0;
- #1216 Support/Steel producer authority untouched;
- first-pass bore-axis grouping constants/traversal decisions unchanged;
- DATUM/reference nodes non-countable;
- partial/conflicting explicit evidence cannot reduce below legacy geometry evidence;
- provisional geometry cannot override known traversal separation for final count;
- explicit topology remains the permitted stronger override;
- structural, relationship and axis matchers remain separately auditable;
- secondary channels cannot promote structural rejection/ambiguity;
- Column 22 publishes final `TYPICAL` only;
- Owner operational report column identity/order remains unchanged; Trace/Debug v4 is diagnostic versioning;
- current/reference relationship scopes remain independent;
- cache route reaches traversal-safe counting;
- no unresolved PR review threads at LEG-014 closeout.

## Validation truth

### Independent executable qualification

Final aggregate:

```text
27 tests
27 pass
0 fail
0 skipped
```

This is real execution evidence for the high-risk new logic seams. It is not represented as a substitute for the governed binary/browser gates listed below.

### GitHub Actions infrastructure

Exact product-head Actions still allocate no runner:
- qualification run `35043776094`
  - focused-node `104629105069`: `runner_id=0`, `steps=[]`;
  - browser `104629105169`: `runner_id=0`, `steps=[]`;
- ZIP run `35043776109`
  - benchmark `104629105083`: `runner_id=0`, `steps=[]`.

These remain infrastructure **NOT_RUN**, not product FAIL.

### Governed real `1885.zip`

Repository binary exists at Git blob `5f27f2d6736693eb21dc2e7981fecad22952819a`, size 585,880 bytes. The isolated container cannot receive this private binary through available network/connector boundaries; no substitute ZIP was used. Exact-head real ZIP qualification therefore remains **NOT_RUN**.

### Browser

No served executable PR checkout is available and Actions browser runner does not allocate. Browser qualification remains **NOT_RUN**.

### Real 1835 relationship input

Repository/history/issue searches found no authoritative 1835 Clash-within-Supports/support-to-support XML and no `/PS-11167.11` real fixture. Real PS-11167/PS-11236 relationship qualification remains **NOT_RUN** due missing Owner input.

## Reviews / merge state

PR COMMENT reviews:
- LEG-007 `5212200167`;
- LEG-008 `5212752129`;
- LEG-009 `5212927412`;
- LEG-010 `5213502126`;
- LEG-011 `5213748178`;
- LEG-012 `5217444302`;
- LEG-013 `5217561622`;
- LEG-014 `5218485242`.

No approval/request-changes review; no unresolved threads. Merge authority remains Owner-only and merge authorized FALSE.

## Current disposition

Known product/source blockers: **NONE**.  
Source/material architecture: **PASS**.  
Independent executable high-risk logic: **PASS 27/27**.  
Governed real ZIP/browser qualification: **NOT_RUN / environment blocked**.  
Real relationship benchmark: **NOT_RUN / missing Owner input**.  
PR disposition: **HOLD_DRAFT** pending remaining governed gates or fresh Owner direction.

## EXACT_NEXT_ACTION

Do not reopen algorithms without a concrete failing case. Obtain an executing trusted runner/checkout that can receive the governed `1885.zip` and serve browser tests, then run the remaining real ZIP/browser gates. Separately pin the real 1835 support-to-support XML when available and execute PS-11167=6 / PS-11236=4 on real evidence. Then repeat release-readiness. Mark-ready and merge remain separate fresh Owner-authorized transitions.