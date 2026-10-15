# Pipeline 3D CAD Browser Acceptance

## Purpose

This gate complements `PipelineCadReadinessAudit.v1` with real Chromium execution. It validates browser event routing, Canvas sizing, toolbar behavior and screenshot evidence without changing the production renderer default.

## Command

Install the pinned runner and Chromium once:

```text
npm install --no-save --no-package-lock @playwright/test@1.54.1
npx playwright install chromium
```

Run the acceptance suite:

```text
npm run test:pipeline-cad-browser
```

## Runtime under test

The fixture mounts the production classes and modules:

```text
PipelineProfileModel
→ PipelineCadController
→ Table2XCanvas / Table3XCanvas
→ Pipeline CAD workspace
→ authoring patches
→ raw TSV synchronization
```

No mock Canvas implementation is used. Browser input is delivered through Playwright mouse, wheel, keyboard, context-menu and form-input APIs.

## Scenarios

| ID | Acceptance evidence |
|---|---|
| CAD-B01 | Table 2 V-node pointer drag updates Elevation Text, preserves length, retains the old line snapshot until Reload Graph, then adopts the committed profile. |
| CAD-B02 | Table 3 Z-node pointer drag near grade snaps to canonical A/G and serializes to Table 3B. |
| CAD-B03 | Marker pointer drag snaps cumulative X and inverse-maps it to absolute H without changing marker identity. |
| CAD-B04 | Structured Table 3B range identity highlights the intended derived row rather than a same-label decoy. |
| CAD-B05 | Manual TSV replacement rebuilds canonical state, retains Canvas object identity and clears stale visual overrides. |
| CAD-B06 | Wheel zoom, middle-button pan, keyboard tools, context-menu edit and device-pixel-ratio sizing work in Chromium. |

## Evidence

The workflow uploads for 30 days:

- JSON Playwright result report
- HTML report
- screenshots for all successful scenarios
- trace, video and failure screenshots when a retry or failure occurs

## Release rule

A green browser gate is required before proposing Canvas as the default runtime. It does not itself authorize removal of the SVG fallback or rollback preference.
