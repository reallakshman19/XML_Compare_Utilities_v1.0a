# Pipeline CAD production soak evidence

## Purpose

This gate collects bounded runtime evidence after CAD Canvas becomes the guarded default. It does not remove the legacy SVG renderer and it does not authorize legacy cleanup by itself.

The evidence answers four operational questions:

1. Did the CAD Canvas mount successfully in real browser sessions?
2. Did the runtime trigger an automatic SVG fallback?
3. Did a CAD-specific JavaScript error occur?
4. Can a support engineer export enough diagnostic evidence without exporting engineering source data?

## Contracts

### `PipelineCadSoakLedger.v1`

Stored locally under `pipeline3dCadSoakLedgerV1`.

The ledger retains at most:

- 20 browser sessions;
- 60 events per session.

A session stores only:

- renderer and build identifiers;
- timestamps;
- viewport and device-pixel-ratio metadata;
- table row counts;
- lifecycle and event counters;
- allowlisted, length-bounded diagnostic categories.

It does not store raw Table 2A, Table 3A, Table 3B or Table 3C text, XML content, model rows, node coordinates, station labels or marker text.

### `PipelineCadSoakAudit.v1`

Default production policy:

| Gate | Requirement |
| --- | --- |
| Clean Canvas sessions | At least 3 |
| Successful Canvas mounts | At least 3 |
| CAD runtime errors | 0 |
| Automatic SVG fallbacks | 0 |

Verdicts:

- `IN_PROGRESS` — no critical blocker exists, but the clean-session threshold has not been reached.
- `READY` — the clean-session and mount thresholds are satisfied with no runtime error or fallback.
- `BLOCKED` — at least one CAD runtime error or automatic fallback exists in the retained evidence window.

Profile validation errors and protected-command rejections are recorded for support analysis but do not block soak readiness. They are expected guardrail outcomes rather than runtime failures.

### `PipelineCadDiagnosticsBundle.v1`

The renderer control includes **Download CAD Diagnostics**. The generated JSON contains:

- runtime and evidence build identifiers;
- active renderer and sanitized fallback evidence;
- the current soak audit;
- bounded ledger sessions;
- Canvas lifecycle counters;
- model row counts only.

The bundle explicitly declares that raw tables, XML and model rows are excluded.

## Runtime evidence events

The runtime records:

- session start and page exit;
- workspace mount and destruction;
- automatic fallback;
- CAD-specific runtime errors;
- validation errors by code/count;
- command rejection;
- history reset counts;
- interaction cancellation;
- committed command count;
- diagnostics export count.

All event payloads pass through an allowlist. Existing stored data is sanitized again before it is displayed or downloaded.

## UI

The renderer control shows one of:

- `Soak: 1/3 clean sessions`
- `Soak: READY · 3/3 clean sessions`
- `Soak: BLOCKED · 1 blocker`

The badge is status evidence only. Renderer switching remains controlled by the existing **Use Legacy SVG** / **Use CAD Canvas** action.

## Acceptance coverage

Static tests verify:

- storage and event retention limits;
- raw-field exclusion;
- sanitation of pre-existing polluted storage;
- `IN_PROGRESS`, `READY` and `BLOCKED` semantics;
- validation errors remain non-blocking;
- diagnostics bundle privacy declarations.

Chromium scenarios verify:

- `CAD-S01` — automatic mount evidence and downloadable privacy-safe JSON;
- `CAD-S02` — three clean sessions produce `READY` and update the visible badge;
- `CAD-S03` — a retained CAD runtime error produces `BLOCKED` and updates the visible badge.

All existing CAD-B, CAD-R, CAD-H, CAD-Q and CAD-L browser scenarios remain mandatory.

## Legacy retirement boundary

Legacy SVG code must remain until production owners review real retained soak evidence and explicitly approve a separate cleanup proposal. A `READY` soak verdict is necessary evidence for that proposal, not an automatic deletion instruction.
