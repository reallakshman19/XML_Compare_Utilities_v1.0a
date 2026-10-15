# Agent Prompt: Native SVG 3D Implementation for Trace Tab

**Task:** Refactor the Trace tab's `3D` mode to use native 2D SVG isometric math instead of the heavy WebGL renderer, and enhance the UI with new isolation toggles and navigation controls.

## 1. Context & Analysis
The user has reported that clicking `3D` in the Trace tab currently loads "another invention of 3D" (the WebGL `workbench-viewer.js` canvas). This is evident from the floating `Fit/Top/Front/Side/Iso` buttons and the WebGL 3D compass. The goal is to completely remove WebGL from the Trace tab and render 3D using pure SVG isometric projection (`ISO`), keeping it lightweight and consistent with the 2D tracing experience. 

## 2. Technical Requirements

### A. Rip Out WebGL from Trace Tab
- Target: `tabs/topology-trace-validator/topology-validator-controller.js`
- Action: Locate the `render()` function. Remove the `if (viewState.projection === '3D')` branch that invokes `render3dViewer(...)`. 
- Requirement: Force the controller to use `renderTopologySvg(...)` and `wireTopologySvgNavigation(...)` for **all** projections, including `3D`. 
- Cleanup: Remove calls to `select3dObject(...)` in the Trace tab controller.

### B. Map '3D' to Isometric (ISO) SVG Math
- Target: `tabs/topology-trace-validator/topology-svg-projections.js`
- Action: In `projectTopologyPoint(...)`, route `plane === '3D'` to use the existing `ISO` math block rather than `XY`.
- Math Reminder: 
  `x_proj = (x - y) * Math.cos(Math.PI / 6)`
  `y_proj = z + (x + y) * Math.sin(Math.PI / 6)`

### C. UI Toggles for Isolation & Overlays
- Target: `tabs/topology-trace-validator/topology-workspace-markup.js`
- Action: Add new toggle checkboxes or buttons to the Trace tab's header ribbon.
- Requirement 1: Add a toggle to **Isolate Supports** (e.g., `<label><input type="checkbox" data-ttv-isolate="supports"> Isolate Supports</label>`).
- Requirement 2: Add a toggle for **Symbol Overlays** to turn component markers on/off.
- Wiring: In `topology-workspace-wiring.js`, attach listeners to these inputs to update `viewState` and trigger a `render()`.
- Logic: Ensure `topology-svg-view-model.js` filters the rendered SVG output based on these new `viewState` properties.

### D. On-Canvas Navigation & 3-Axis Compass
- Target: `tabs/topology-trace-validator/topology-workspace-markup.js` & `topology-workspace-wiring.js`
- Action: Do NOT hide or disable the native SVG compass/navigation when `projection === '3D'`.
- Requirement 1: Update the SVG compass (`[data-ttv-axis-compass]`) to display a 3-axis isometric tripod (Red X, Green Y, Blue Z) when `projection === '3D'` or `ISO`.
- Requirement 2: Inject on-canvas HTML/SVG buttons for basic orientation (e.g., `Fit`, `XY`, `XZ`, `ISO`) that overlay the canvas cleanly. Ensure they update the `projection` state in the controller.

## 3. Engineering Constraints (Follow `AGENTS.md`)
- **No `cat` or destructive overrides**: Use AST or precision string replacements to modify existing files.
- **Backups**: Before modifying any JS/HTML file, run `node utils/backup.cjs save <path> "<Reason>"`.
- **Patch Ledger**: Since this is an ad-hoc task, you MUST create a local ledger at `.agent-worklogs/<YYYYMMDD_HHmm>_<slug>/`.
- **Diff Generation**: After making changes, use `git diff --no-index --binary` against the `.backups` to generate a `.patch` file for your ledger.
- Do not create unrequested default exports or classes. Keep functions pure where possible.
