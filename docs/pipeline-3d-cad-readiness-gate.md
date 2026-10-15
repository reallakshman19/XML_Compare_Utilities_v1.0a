# Pipeline 3D CAD Canvas readiness gate

## Purpose

This gate decides whether the feature-gated Table 2X / Table 3X Canvas workspace is mature enough for a **separate guarded runtime-switch proposal**.

It does not switch the production default and does not authorize removal of the legacy SVG path.

## Audit contract

The generated artifact uses:

```text
PipelineCadReadinessAudit.v1
```

Possible statuses:

- `READY_FOR_GUARDED_SWITCH_PROPOSAL`
- `NOT_READY`

A ready result means only that a later PR may propose making Canvas the guarded default. That later PR must preserve a rollback flag and the SVG fallback.

## Required benchmark scenarios

| ID | Scenario | Required evidence |
|---|---|---|
| CAD-B01 | Table 2 vertical drag and delayed graph reload | Elevation column changes, length column does not change, retained line snapshot stays unchanged until Reload Graph, reload adopts committed elevation |
| CAD-B02 | Table 3 depth and A/G snapping | Near-grade Z becomes canonical `A/G` and serializes to Table 3B |
| CAD-B03 | Table 3 marker inverse coordinate mapping | Canvas cumulative X inverse-maps to absolute H and Table 3C keeps independent marker identity |
| CAD-B04 | Range-row identity and dirty highlight stability | Table 3B `From H` / `To H` identity survives Z mutation and the correct derived range row is highlighted |
| CAD-B05 | Manual raw typing override | Canonical model rebuilds from edited TSV while mounted Canvas object identities remain unchanged and stale drag overrides are cleared |

## Global gates

1. Every required benchmark scenario passes.
2. No console error is emitted during the benchmark.
3. Both Canvas runtime modules are present.
4. The legacy `createTable2XSVG` and `createTable3XSVG` fallback remains present.
5. Canvas remains feature-gated and off by default during this proof phase.

## Commands

Run the focused test:

```bash
npm run test:pipeline-cad-readiness
```

Generate the machine-readable audit:

```bash
npm run audit:pipeline-cad-readiness
```

Default artifact path:

```text
artifacts/pipeline-cad-readiness.json
```

Override it with:

```bash
PIPELINE_CAD_READINESS_OUTPUT=/path/to/audit.json npm run audit:pipeline-cad-readiness
```

## CI evidence

`.github/workflows/pipeline-cad-readiness.yml` runs on relevant Pipeline 3D Model changes and uploads the audit JSON for 30 days.

The workflow fails when any required scenario or global gate fails.

## Runtime-switch policy

A later runtime-switch PR must still satisfy all of the following:

- retain a user-accessible rollback/feature flag;
- retain the SVG fallback for at least one stabilization cycle;
- rerun this readiness workflow on the switch commit;
- include browser visual evidence for Table 2X and Table 3X;
- avoid changes to Coordinate Tab and XML generation unless independently reviewed;
- document the rollback procedure in the PR body.
