# InputXmlChangeSet.v1 Work Pack Evidence

Date: 2026-07-14
Synchronized base: `9b76a080a4e72c53e31945b3bfaa2ce841e1dce7`
Validated candidate: `69dab6cdbe2d67422812607f95f97fa62a336c91`
Pull request: #279

## Delivered capability

```text
CategorizedInputXML normalized blocks
→ deterministic InputXmlChangeSet.v1
→ explicit change approvals
→ current-source precondition verification
→ synchronized OriginalElement evidence
→ reconciled categorized XML
→ validated reconciled InputXML
→ application receipt
```

Public operations:

```text
getCapabilities
derive
validateChangeSet
apply
```

Supported v1 fields:

```text
LINE_ID
FROM_NAME
TO_NAME
NAME replacement
DELTA_X
DELTA_Y
DELTA_Z
DIAMETER
WALL_THICK
INSUL_THICK
```

Node identity changes are explicitly unsupported and block application.

## Safety evidence

- deterministic change-set, change and conflict identifiers;
- explicit approvals only;
- source-element fingerprint and complete change-definition checks;
- stale source and altered approval definitions rejected;
- duplicate line/element targets and invalid source evidence blocked;
- normalized categorized blocks remain unchanged;
- only approved OriginalElement attributes are synchronized;
- bends, restraints and unapproved source attributes are retained;
- failed application or output validation emits no artifacts;
- resulting InputXML root, model, element count, target identity and values are verified.

## Artifacts

```text
reconciled-categorized-xml
reconciled-inputxml
application-receipt
```

## Structural compliance

- all production JavaScript modules are 20–207 lines;
- every production module is below 300 lines;
- named exports only;
- no identified named function exceeds 40 lines;
- no UI-tab imports;
- no DOM, storage, worker or network runtime calls;
- no existing XML Compare runtime file was modified;
- final diff is additive and limited to the Work Pack paths.

## Automated verification

Synchronized run `29304797129` — InputXML ChangeSet Reconciliation API:

- Work Pack diff scope: passed;
- JavaScript syntax: passed;
- structure and isolation: passed;
- deterministic derivation and partial/full approval: passed;
- stale source and change-definition tamper rejection: passed;
- node identity conflict blocking: passed;
- LINE_ID reconciliation: passed;
- output validation and artifact production: passed;
- full repository `npm test`: passed.

Repository run `29304797219` passed static, XML, table and full test suites.

Pages semantic validation run `29304797174` passed.

The branch was synchronized through PR #280 and was behind `main` by zero commits when this evidence was recorded.

## Exclusions retained

No UI, HTTP, worker, storage, CII conversion, node renumbering, restraint/SIF/displacement/force reconciliation, automatic approval or runtime switch was introduced.
