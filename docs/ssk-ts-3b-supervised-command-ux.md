# SSK-TS-3B — Supervised non-geometric Draft Edit 3D command UX

## Authority

Authoritative Work Pack: issue #674.

```text
Dependency: SSK-TS-3A merged in PR #666
Dependency merge SHA: 93cc5a6c7a41866c3fa4fd0b92d95f9e582e0cd9
Implementation baseline: fc364e4ee0105b21985b0b5352f64ffe33ad14ca
```

## Mission boundary

SSK-TS-3B adds the first visible command controls to the Draft Edit 3D surface. It does not add geometry editing, candidate-target resolution or a new command authority.

The production route remains:

```text
Draft Edit 3D supervised panel
→ merged SSK-TS-3A gateway.prepare()
→ immutable prepared-command evidence
→ explicit operator review
→ merged SSK-TS-3A gateway.accept()
→ acceptance-time recomputation
→ workspace restorePackage() publication boundary
```

The visible panel never calls `gateway.execute()`.

## Qualified command set

The panel exposes exactly the existing deterministic preparation allowlist:

- `ADVANCE_ONE`;
- `RUN_UNTIL_BLOCKED`;
- `DEFER_DECISION`;
- `RESUME_DECISION`;
- `UNDO_LAST_TRANSACTION`;
- `REDO_LAST_TRANSACTION`.

The following command families remain unavailable:

- candidate connection or rejection;
- manual connection;
- terminal or external-boundary decisions;
- component reversal;
- coordinate, drag, move, rotate, stretch, break or topology editing.

## Supervision flow

### 1. Readiness

The panel is hidden and inert whenever Draft Edit 3D is not active. When active, it reads the merged gateway state and displays:

- readiness;
- exact active branch;
- rejection reason when authority is unavailable;
- whether a prepared command is pending.

Controls fail closed when the gateway is unavailable or the selected command is not meaningful for the current native session state.

### 2. Operator evidence

Every preparation requires a non-empty actor ID.

Additional evidence requirements are:

| Command | Reason | Evidence note |
|---|---:|---:|
| `ADVANCE_ONE` | No | No |
| `RUN_UNTIL_BLOCKED` | No | No |
| `DEFER_DECISION` | Yes | Yes |
| `RESUME_DECISION` | Yes | No |
| `UNDO_LAST_TRANSACTION` | Yes | Yes |
| `REDO_LAST_TRANSACTION` | Yes | Yes |

An exact round-tripping ISO `issuedAt` is created once, only when the operator explicitly prepares the command.

### 3. Preparation

A command-selection button calls `gateway.prepare()` only. Preparation cannot publish workspace authority.

The review panel displays:

- command type;
- branch ID;
- issued time;
- predicted native outcome;
- prepared ID;
- expected authority ID;
- native transaction mapping or journal-only result.

While evidence is pending, command-selection buttons are disabled.

### 4. Explicit acceptance or cancellation

`Accept prepared command` calls `gateway.accept()` with the immutable prepared command. The existing acceptance service revalidates authority, recomputes the complete result and publishes only through the existing workspace command boundary.

`Cancel prepared command` discards the prepared evidence without calling acceptance and without mutating workspace authority.

Rejected or stale acceptance is shown using the returned rejection code and message and is never represented as committed.

## Lifecycle containment

Pending preparation is invalidated when:

- owner authority publishes a refresh;
- Draft Edit 3D closes;
- another renderer is selected;
- Draft Edit 3D becomes unavailable;
- a viewer or navigation failure falls back to Construction SVG;
- the controller is destroyed.

The 3D controller validates the command boundary, production shadow, workspace and required view elements before creating the gateway. If panel installation or owner subscription then fails, it removes any subscription, destroys the panel and destroys the gateway before rethrowing.

Both existing browser fixtures mount the production tile and therefore inherit the production markup. No fixture modification is required.

## Presentation containment

The panel is a sibling overlay above the 3D host, not a child of the viewer canvas. Viewer remounting therefore cannot erase operator fields or prepared evidence. The panel installs bounded overlay and control presentation without changing the shared stylesheet.

## Proof

`tests/sequential-draft-edit-command-panel.test.mjs` proves:

- hidden and inert inactive state;
- overlay presentation installation;
- readiness and native-state command enablement;
- exact six-command allowlist;
- actor and command-specific evidence validation;
- exact ISO issued-time validation;
- preparation without publication;
- prepared-evidence rendering;
- cancellation without authority mutation;
- explicit acceptance;
- stale rejection presentation;
- owner-refresh invalidation;
- surface-close invalidation;
- unavailable-authority containment;
- destroy cleanup.

`tests/sequential-scoped-edit-3d-static.test.mjs` proves:

- production modules remain below 300 lines;
- named exports only;
- hidden/inert panel markup;
- exactly six command-selection buttons;
- no direct `gateway.execute()` panel path;
- no decision-target or geometry command controls;
- owner-refresh and surface lifecycle invalidation wiring;
- continued SSK-TS-3A gateway and workspace-boundary containment;
- unchanged workspace remains within its approved 486-line exception.

## Validation limitation

The repository execution environment cannot resolve `github.com`, so the exact branch cannot be materialized into the local filesystem. Focused tests and the wider repository suite are not represented as executed or green until an exact-head runner performs them.

## Deferred

SSK-TS-3C, decision-command target resolution, geometry manipulation and SVG retirement remain blocked pending review and merge of this Work Pack.
