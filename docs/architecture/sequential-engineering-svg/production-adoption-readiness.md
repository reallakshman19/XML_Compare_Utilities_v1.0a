# SSK-ESVG-003A — Sequential production Engineering SVG adoption readiness

## Decision

| Field | Value |
|---|---|
| Schema | `SequentialEngineeringSvgProductionAdoptionDecision.v1` |
| Evaluated main | `afa8388a4cead865fcafae856b8c629d88ab0162` |
| Status | `REVIEW_REQUIRED` |
| Recommended architecture | **Option A — existing interactive SVG default plus optional read-only preview** |
| Production UI authorized | No |
| SSK-ESVG-003B authorized | No; `proposedNextMission` is `null` |

The merged Shared Engineering SVG adapter and shadow composition remain suitable read-only consumers after the Shared property-history merge. The shipped Sequential workspace still does not publish the immutable, reasoned owner snapshot/subscription needed for production mounting. Candidate, scene, review-queue and inspector selections also lack an approved backend-switch reconciliation contract.

A fourth blocker is now explicit: `indexSequentialEvidence()` freezes only the containing object while exposing mutable `Map` values. A future production bridge must not publish those live Maps as deeply immutable owner state.

## Architecture options

### Option A — recommended, not implementation-ready

```text
existing interactive Sequential SVG
  -> default renderer
  -> construction and decision authority

Shared Engineering SVG
  -> optional read-only preview
  -> properties and parity only

visibility
  -> exactly one visible and focusable visual surface

existing inspector
  -> remains reachable
  -> owns explicit construction decisions
```

This preserves the current authority split. Shared Engineering SVG has no command gateway, exposes read-only properties and derives domain revision from existing session and downstream fingerprints.

### Option B — not approved

Two visible renderers would duplicate selection, focus, accessibility announcements, fit state, subscription ownership and teardown. The current renderer includes candidates in fit; Shared Engineering SVG intentionally excludes candidates and the active port.

### Option C — forbidden

The existing inspector exposes Preview, Connect, Manual connect, Reverse, Reject and other supervised actions that dispatch through `applyConstructionDecision()`. The Shared adapter is read-only and has no command gateway.

## Authority summary

| Concern | Owner | Required adoption behavior |
|---|---|---|
| Source evidence | `buildSequentialEvidenceModel()` | publish existing frozen evidence; do not rebuild it |
| Source indexes | `indexSequentialEvidence()` | keep Maps private or publish an authorized immutable projection |
| Construction session | construction runtime and workspace | publish only accepted runtime results |
| Confirmed construction | acceptance boundary | require current-session match and accepted fingerprint |
| Candidates | open decision request | preserve owner candidate IDs and ordering |
| Candidate selection | Sequential workspace | preview only until explicit decision |
| Construction decisions | existing workspace and inspector | keep every mutation outside Shared SVG |
| Active exit port | current session | Shared selection cannot change it |
| Continuity repair | resolver/runtime | Shared SVG may display evidence only |
| Rejected candidates | rejection ledger and decision evidence | retain recoverable evidence |
| Support projection | confirmed-support projector | require confirmed-construction fingerprint match |
| Projection | active renderer presentation state | do not change construction revision |
| Fit | active renderer | retain independent fit state |
| Review queue | review controller | selection may open a branch, not confirm a candidate |
| Lifecycle | tab/workspace/shadow owners | exactly one active renderer and deterministic disposal |

## Mutation boundary

The authoritative construction mutation entry points remain:

```text
advanceConstruction()
runConstructionUntilBlocked()
applyConstructionDecision()
```

Shared Engineering SVG imports none of them. `resolveNextConnection()` and the construction runtime retain continuity-repair authority.

## Selection separation

| Selection | Identity | Owner | Consequence |
|---|---|---|---|
| Construction candidate | raw `candidateId` | Sequential workspace | preview only |
| Engineering scene | exact scene entity ID | Shared read-only shell | property display only |
| Review queue | `reviewId` | review queue controller | may open branch |
| Inspector | raw `candidateId` | existing inspector/workspace | preview plus separately invoked decisions |

Candidate scene mapping must use:

```text
entity.domainRef.candidateId
```

Coordinates, array position, projected location, display text and ordering are prohibited identity sources.

A Shared click must never confirm, reject, advance, repair, open a branch or change the active port.

## Required future owner state

A future bridge must expose validated current state equivalent to:

```js
{
  session,
  evidenceModel,
  confirmedConstruction,
  supportProjection,
  visibleProjection,
  constructionCandidateSelection,
  engineeringSceneSelection,
  reviewQueueSelection,
  inspectorSelection
}
```

Indexes require a separate boundary decision and must not be published as live mutable Maps.

The bridge must provide:

```text
getState() -> immutable validated current snapshot
subscribeState(listener) -> deterministic unsubscribe function
```

Reasoned events are required after source inspection/reload, branch open/switch, construction advance, run-until-blocked, decision application, undo/redo, route completion, support refresh, restoration, projection change and viewer switch.

The bridge must not rebuild evidence, rerun construction, regenerate candidates, rerun repair, infer from DOM/geometry, invent revisions or fall back to stale accepted/support evidence.

## Index immutability boundary

Current source returns a frozen wrapper containing mutable Maps:

```js
Object.freeze({
  branches: new Map(...),
  components: new Map(...),
  ports: new Map(...),
  componentReferences,
})
```

`Object.freeze()` does not prevent `Map.prototype.set`, `delete` or `clear`. Therefore:

```text
PRODUCTION_INDEX_IMMUTABILITY_UNDEFINED
```

is a production-adoption blocker.

A later Work Pack must authorize exactly one approach:

1. keep Maps private and expose owner-controlled read-only lookup operations; or
2. publish a deterministic immutable index projection and update the authority classifier accordingly.

Required implementation proof must demonstrate that Shared consumers cannot mutate owner indexes or alter subsequent scene results through `set`, `delete` or `clear`.

## Projection and fit

- `ISO`, `XY`, `XZ` and `YZ` are presentation modes.
- Projection must not alter construction fingerprints.
- Viewer switching must not rerun construction, repair, acceptance or support projection.
- Existing fit includes confirmed geometry, candidates and supports.
- Shared fit includes confirmed geometry, repairs and supports.
- Shared candidates, active port and rejected candidates remain excluded from fit.
- Each renderer may retain independent fit state.

## Lifecycle

| Event | Active renderers | Required behavior |
|---|---:|---|
| Workspace open | 1 | existing renderer owns initial surface |
| Source inspection/reload | 1 | publish new evidence state and clear stale selections |
| Branch open/switch | 1 | restore exact branch candidate identity; do not run construction |
| Construction transition | 1 | publish one reasoned immutable event |
| Decision applied | 1 | retain recorded provenance and clear stale selections |
| Route complete/support refresh | 1 | require matched fingerprints |
| Viewer switch | exactly 1 | destroy inactive surface before activation |
| Shared mount/subscription failure | 1 existing fallback | dispose partial Shared resources and retain domain state |
| Workspace close | 0 | remove every listener and subscription |

The continuity controller can replace the same host with constructed-network SVG. A future viewer-switch Work Pack must explicitly bound that presentation state.

## Failure contract

| Failure | Required response |
|---|---|
| Invalid owner snapshot | fail closed; retain existing renderer |
| Stale confirmed construction | reject Shared publication |
| Stale support fingerprint | reject Shared publication |
| Mutable index exposure | reject the proposed bridge design |
| Selection mapping failure | clear only Shared scene selection |
| Subscription failure | dispose Shared preview and restore existing renderer |
| Shared parity failure | do not switch production view |

## Readiness blockers

1. **`PRODUCTION_OWNER_SUBSCRIPTION_MISSING`** — no immutable, reasoned production state subscription exists.
2. **`BACKEND_SELECTION_MAPPING_NOT_IMPLEMENTED`** — candidate, scene, review and inspector selections are not reconciled across renderer switching.
3. **`CONTINUITY_CANVAS_LIFECYCLE_UNBOUNDED`** — constructed-network rendering shares the canvas without a viewer-switch contract.
4. **`PRODUCTION_INDEX_IMMUTABILITY_UNDEFINED`** — the frozen index wrapper exposes mutable Maps.

## Review items

- `package.json` has no `test:sequential-sketcher` script; package changes remain outside this audit.
- Existing and Shared fit policies intentionally differ.
- A future Work Pack must authorize the exact bridge, viewer and markup files.
- Destroying the inactive renderer is preferred for one-subscription certainty.

## SSK-ESVG-003B boundary

Because status remains `REVIEW_REQUIRED`:

```json
{
  "allowedProductionFiles": [],
  "proposedNextMission": null
}
```

No production adoption file is authorized. A separate owner-approved Work Pack is required before implementation.

## Required future implementation tests

1. existing renderer remains default;
2. preview activation is explicit;
3. exactly one visual surface is visible and focusable;
4. every domain transition emits one immutable reasoned event;
5. consumers cannot mutate owner indexes;
6. Shared candidate selection cannot execute a write;
7. candidate mapping uses `domainRef.candidateId`;
8. the existing inspector remains reachable;
9. source/branch transitions invalidate stale selections;
10. stale support evidence fails closed and recovers;
11. projection and independent fit state survive switching;
12. constructed-network presentation is bounded;
13. mount failure restores the existing renderer;
14. all listeners and subscriptions are disposed;
15. Chromium pointer, keyboard, accessibility and lifecycle cases pass;
16. full repository regressions pass.

## Audit scope

Only these additive files belong to SSK-ESVG-003A:

```text
.github/workflows/sequential-engineering-svg-production-readiness.yml
docs/architecture/sequential-engineering-svg/production-adoption-readiness.md
tabs/sequential-sketcher/sequential-engineering-svg-production-readiness.js
tests/sequential-engineering-svg-production-readiness.test.js
tests/sequential-engineering-svg-production-readiness-static.test.js
```

No shipped Sequential product, existing adapter/shadow, shared core, Workbench3D, navigation, package or dependency file is changed.
