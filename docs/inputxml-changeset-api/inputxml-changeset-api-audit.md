# InputXmlChangeSet.v1 Reconciliation API Audit

Date: 2026-07-14
Base: `main` at `97e7181b772c1079d1e3f1eaf372ff25dd7ddd84`

## Scope

This Work Pack adds a service-only API that derives explicit changes from XML Compare `CategorizedInputXML`, validates approvals and preconditions, applies approved changes to embedded `OriginalElement` source evidence, and produces reconciled InputXML.

It does not add UI, HTTP, workers, storage, CII conversion, runtime switching, or broad changes to the existing XML Compare workflow.

## Existing authority boundary

`CategorizedInputXmlService.v1` already distinguishes:

1. normalized categorized blocks used for review and transfer;
2. embedded `OriginalElement` InputXML evidence.

The existing reverse converter reconstructs InputXML primarily from `OriginalElement`. Normalized edits therefore do not become authoritative InputXML unless an explicit reconciliation step applies them.

## v1 reconciliation fields

The first change-set version is intentionally limited to `PIPINGELEMENT` attributes already represented by generated v3 blocks:

```text
LINE_ID
FROM_NAME
TO_NAME
NAME
DELTA_X
DELTA_Y
DELTA_Z
DIAMETER
WALL_THICK
INSUL_THICK
```

`FROM_NODE` and `TO_NODE` are identity and graph-reference fields. Their divergence is reported as a blocking conflict and is not automatically applied in v1.

Derived-only fields such as `BoreMm`, `ElementLengthMm`, synthetic global coordinates, arbitrary extension blocks, and node child blocks are outside this Work Pack.

## Change contract

Every proposed change must contain:

```text
changeId
lineId
elementKey
field
operation
beforeValue
afterValue
sourceElementFingerprint
risk
approvalRequired
status
```

The change identifier must be deterministic for the same document state.

## Preconditions

Application must reject or skip a change when:

- the requested change is not explicitly approved;
- its field is unsupported;
- the target line/element cannot be resolved uniquely;
- `OriginalElement` is absent, duplicated, or invalid;
- the source-element fingerprint differs from derivation time;
- the expected source attribute no longer matches;
- node identity differs between hierarchy and source evidence;
- duplicate line or element identities make selection ambiguous.

## Output artifacts

A successful apply operation produces:

1. reconciled categorized XML with synchronized `OriginalElement` evidence;
2. reconciled InputXML reconstructed from that evidence;
3. an application receipt containing applied, skipped, blocked and conflicted changes;
4. validation evidence proving `PIPINGELEMENT` count and applied values.

The original categorized input remains immutable.

## Explicit exclusions

- no automatic approval;
- no mutation of normalized categorized blocks;
- no change to the existing XML Compare UI or transfer engine;
- no node renumbering or reference propagation;
- no restraint/SIF/displacement/force reconciliation;
- no CII conversion;
- no HTTP or worker transport;
- no default exports, shims, hidden mocks or generated snapshot churn.

## Acceptance

The Work Pack is complete when tests prove:

- deterministic change-set derivation;
- add/replace proposals for supported fields;
- identity conflicts block unsafe application;
- explicit approvals are required;
- stale fingerprints and stale expected values are rejected;
- partial approval applies only selected changes;
- reconciled categorized XML and InputXML retain unmodified source evidence;
- output validation confirms counts and applied values;
- all new JavaScript modules remain under 300 lines, use named exports and keep functions below 40 lines where practical;
- the full repository test suite remains green.
