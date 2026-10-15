QUALIFICATION_PROTOCOL_VERSION: 3
QUALIFICATION_PROFILE: PARSER_TOPOLOGY
QUALIFICATION_PROFILE_VERSION: 2
CHAIN_ID: SUPPORT-PRIMARY-1222
WORK_ITEM_KEY: github:reallaksh19/XML_Compare_Utilities#1222
QUESTION_SET_ID: QS-SUPPORT-PRIMARY-1222-0001
QUALIFICATION_SCOPE_ID: QSCOPE-SUPPORT-PRIMARY-1222-ASSEMBLY-SEAM
QUALIFICATION_BASIS_HEAD: 242fc1b1df7e398b64e15a1fd3e2f87d1ff5b581
QUESTION_SET_STATUS: CURRENT
OWNER_QUALIFICATION_BASELINE_DISCOVERY: COMPLETE
OWNER_QUALIFICATION_BASELINE_STATUS: NOT_APPLICABLE

# Q1 — Production Trace

Repository anchors:
- `tabs/ps-family-clash-audit/ps-family-psclash-xml-parser.js`
- `tabs/support-steel-relationship-builder/support-report-location-grouping.js`
- issue #1222 §§4-6

Production object/case:
- explicit member relationship `/PS-11167.2 <-> /PS-11167.11` from a Clash-within-Supports source;
- Support Report family `PS-11167`, expected final primary-support count 6.

Domain challenge:
Trace the member pair from `<clashresult>` / `<clashobject>` paths through `parseSupportChangeXml()` into the current SupportChain row. Identify exactly where a missing pipe/branch causes the row to be discarded and identify the first safe seam that can retain member connectivity without granting carrier/steel authority.

Exact repository data required:
- `edgeFromObjects()` and `lineContext()` behavior;
- current `supportA`, `supportB`, `psRoot`, `fullLineTag`, `branchNode` outputs;
- current Support Report grouping inputs.

Concrete payload:
`supportA=/PS-11167.2`, `supportB=/PS-11167.11`, same family `PS-11167`; pipe context may be unavailable.

Required derivation:
Produce the expected parser state before and after the current `if (!pipe) return null` boundary and state which fields remain authoritative when pipe is null.

First authority/ownership boundaries:
PS/SL token/path parser owns member identity; #1216 owns carrier/steel production relationships; this issue owns Support Report primary-support assembly projection.

Fail if:
The answer promotes legacy clash XML to Support/Steel carrier/steel authority or proposes duplicating PS/SL token parsing.

# Q2 — Current Unresolved Problem / Failure Isolation

Repository anchors:
- `tabs/support-steel-relationship-builder/support-report-location-grouping.js`
- `tabs/ps-family-clash-audit/ps-family-psclash-xml-parser.js`
- issue #1222 §§1,10,14

Calculation/reconstruction:
Reconstruct the connected-component result for explicit member edges and compare it with the current geometry-first path.

Exact repository data required:
Current grouping rule requires same traversal before bore-axis adjacency; current axis gate is `axial <= 4*Bore` and `lateral <= 0.5*Bore + 25`.

Concrete payload:
Members `{.2,.11,.4,.5}` with explicit edges `{.2-.11, .4-.5}` and no cross-edge. `DATUM` is symbolic and attaches to the `.4/.5` component but is not countable.

Required derivation:
Hand-compute the explicit graph components and countable assemblies. Expected components are `{.2,.11}` and `{.4,.5}`; DATUM does not create a third component. Identify why widening the normal lateral tolerance is not an equivalent authority model.

Predicted intermediate values:
Two countable connected components from the supplied edge set; zero component union caused by geometry alone.

First wrong boundary:
Treating spatial proximity as the primary definition when explicit connectivity exists.

Falsifier:
If the source XML does not contain the asserted member edge, explicit connectivity cannot be claimed for that pair.

Fail if:
The answer proposes a global tolerance increase as the primary fix or counts DATUM as a primary support.

# Q3 — Authority / Invariant

Repository anchors:
- issue #1216 source-authority invariants
- issue #1179 typicality source-authority invariants
- issue #1222 §§5,11,13

Domain challenge:
State the exact authority split between Support/Steel carrier/steel relationships, Support Report primary-support assembly connectivity, geometry fallback, and typicality derived evidence.

Exact repository data required:
#1216 explicitly keeps combined staged JSON as Support/Steel production source and prohibits historical clash XML becoming production carrier/steel authority.

Concrete payload:
Evidence classes: `EXPLICIT_SUPPORT_CLASH`, staged explicit/reference, staged analytical member chain, primary Support Report clash, bore-axis fallback, orphan recovery.

Required derivation:
Order these classes by authority for assembly membership and separately identify which classes may establish pipe/carrier/steel semantics.

Protected invariant:
An explicit support-member component can be retained without implying carrier/steel truth; orphan recovery cannot merge two distinct explicit assembly IDs.

First wrong boundary:
Any adapter that converts a member-pair clash into authoritative carrier/steel relationship evidence.

Falsifier:
A current #1216 contract explicitly authorizing that exact legacy XML as carrier/steel production input would invalidate this separation; absent that, preserve the boundary.

Invalid shortcut:
Reuse PS/SL legacy XML mode wholesale as the Support Report production relationship engine.

Fail if:
The answer collapses evidence classes into one untyped graph or lets UI/export decide relationship truth.

# Q4 — Independent Validation

Repository anchors:
- issue #1222 benchmark ledger
- `benchmarks/1835.zip`
- `benchmarks/11168.xml`
- `benchmarks/14168.xml`

Domain challenge:
Define an implementation-independent validation for the first assembly seam before count migration.

Independent oracle:
A hand-built edge/component oracle from frozen member pairs plus Owner-stated count expectations; production bundle output cannot generate its own expected component list.

Concrete payload:
- PS-11167 expected family count 6;
- PS-11236 expected count 4 with one assembly `.4 + .5 + DATUM`;
- PS-12877 expected count 4 and must not over-merge coincident/revisited pipe evidence;
- 11168 -> 14168 remains typical.

Required derivation:
For a synthetic graph with concrete nodes `.4,.5` plus symbolic `DATUM`, explicit edge `.4-.5`, prove one countable assembly and concrete member count two. For two explicit components at identical XYZ, prove the expected count remains two regardless of geometry.

Units/sign/tolerance:
Topology oracle is unit-independent; geometry tests must retain millimetres and the existing bore-axis thresholds when used.

Falsifier:
Any implementation that merges two explicit components solely because XYZ coincides fails the independent topology oracle.

Fail if:
Expected components/counts are derived by calling the production assembly builder under test.

# Q5 — Next Contribution / Minimal Patch

Repository anchors:
- `tabs/ps-family-clash-audit/ps-family-psclash-xml-parser.js`
- Support Report modules under `tabs/support-steel-relationship-builder/**`
- issue #1222 §17

Domain challenge:
Identify the smallest first material patch that establishes an auditable assembly seam without changing final count or Column 22 authority prematurely.

Exact repository data required:
Current legacy parser ownership, current support-report grouping owner, active PR #1219 changed-file set and #1216 protected producer boundary.

Concrete payload:
First slice is limited to: semantic remark rename; shared parser seam retaining member pair without mandatory pipe; pure deterministic assembly/component builder; focused topology tests.

Required derivation:
State the exact modified/new modules, expected before/after behavior for a no-pipe member edge, and how legacy parser callers remain compatible.

Safe patch boundary:
Parser evidence retention + pure assembly model seam only.

Expected before/after evidence:
Before: no-pipe SupportChain clash row can be dropped. After: member pair retained with pipe fields unresolved and explicit basis; existing pipe-bearing rows remain equivalent.

Protected unchanged domains:
Support/Steel carrier/steel producer, final Support Report count semantics, Column 22 decision authority, current bore-axis thresholds, PS/SL default graph-native production mode.

Validation required:
Focused parser tests, pure connected-component tests, startup syntax/import checks, existing legacy parser regression subset.

Negative test:
Two explicit components at coincident XYZ remain distinct in the assembly builder.

Rollback/falsifier boundary:
If retaining pipe-less edges changes existing PS/SL legacy audit row semantics unintentionally, extract a shared lower-level parser primitive and keep the legacy wrapper behavior unchanged.

No-patch condition:
Do not change production count/typicality decisions until the assembly bundle is auditable and its benchmark seam is qualified.

Fail if:
The proposed first patch modifies Support/Steel relationship tolerances/authority, globally widens geometry, or directly changes Column 22 acceptance.