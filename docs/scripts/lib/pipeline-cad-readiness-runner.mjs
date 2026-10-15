import { readFile } from 'node:fs/promises';
import { installPipelineCadAuthoringPatches } from '../../tabs/pipeline-3d-model/pipeline-3d-model-cad-authoring.js';
import {
  PipelineCadController,
  applyPipelineCadDirtyHighlights,
} from '../../tabs/pipeline-3d-model/pipeline-3d-model-cad-controller.js';
import { Table2XCanvas } from '../../tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js';
import { Table3XCanvas } from '../../tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js';
import { interpolateAbsoluteHFromCumulative } from '../../tabs/pipeline-3d-model/pipeline-3d-model-cad-math.js';
import { isPipelineCadCanvasEnabled } from '../../tabs/pipeline-3d-model/pipeline-3d-model-cad-workspace.js';
import {
  assertPipelineCadReadiness,
  buildPipelineCadReadinessAudit,
} from '../../tabs/pipeline-3d-model/pipeline-3d-model-cad-readiness.js';

const RAW = Object.freeze({
  table2a: `H(coor)\tV(coor)\t[H vs V] Length\tStation Text\tElevation Text
659.791\t—\t—\t0+000.0\t231.32
668.540\t-715.825 → -650.258\t65.567\t0+006.7\t230.95
680.803\t-715.825 → -650.258\t65.567\t0+019.0\t230.82
732.683\t—\t—\t0+070.8\t233.00`,
  table3a: `From H(coor)\tTo H(coor)\tText Position X\tHLength Text
661.791\t682.337\t671.704\t20.5
682.337\t716.683\t700.435\t34.3
716.683\t732.683\t723.927\t16.0`,
  table3b: `From H(coor)\tTo H(coor)\tText Position X\tZ Text
—\t—\t665.621\tA/G
682.337\t732.683\t708.374\t1.5M`,
  table3c: `Text Position X\tMarker Text
688.135\tPM-001`,
});

class FakeClassList {
  constructor() { this.values = new Set(); }
  add(value) { this.values.add(value); }
  remove(value) { this.values.delete(value); }
  contains(value) { return this.values.has(value); }
}

class FakeCell {
  constructor(textContent) { this.textContent = textContent; }
}

class FakeRow {
  constructor(cells) {
    this.cells = cells.map((cell) => new FakeCell(cell));
    this.classList = new FakeClassList();
    this.attributes = new Map();
  }
  querySelectorAll(selector) { return selector === 'td' ? this.cells : []; }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  removeAttribute(name) { this.attributes.delete(name); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
}

class FakeOutputRoot {
  constructor(rows = []) { this.rows = rows; }
  querySelectorAll(selector) { return selector === 'tbody tr' ? this.rows : []; }
}

class FakeTextArea extends EventTarget {
  constructor(value, slotName) {
    super();
    this.value = value;
    this.slotName = slotName;
  }
  matches(selector) {
    return selector === '[data-p3d-split$="-raw"]' && this.slotName.endsWith('-raw');
  }
}

class FakeDialog {
  constructor(raw, outputs = {}) {
    this.listeners = new Map();
    this.elements = Object.fromEntries(Object.entries(raw).map(([name, value]) => [
      `[data-p3d-split="${name}-raw"]`,
      new FakeTextArea(value, `${name}-raw`),
    ]));
    this.elements['[data-p3d="table2x-output"]'] = outputs.table2x || null;
    this.elements['[data-p3d="table3x-output"]'] = outputs.table3x || null;
  }
  querySelector(selector) { return this.elements[selector] || null; }
  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }
  removeEventListener(type, listener) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter((candidate) => candidate !== listener));
  }
  emit(type, target) {
    for (const listener of this.listeners.get(type) || []) listener({ target });
  }
}

function getRawLine(text, token) {
  return String(text).split(/\r?\n/).find((line) => line.includes(token)) || '';
}

function near(actual, expected, tolerance = 1e-6) {
  return Number.isFinite(Number(actual)) && Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function createHarness(options = {}) {
  installPipelineCadAuthoringPatches();
  const dialog = new FakeDialog(RAW, options.outputs);
  const controller = new PipelineCadController(dialog);
  const table2x = new Table2XCanvas(null, { width: 1000, height: 400 });
  const table3x = new Table3XCanvas(null, { width: 1000, height: 400 });
  controller.attachGraphs({ table2x, table3x });
  table2x.setSize(1000, 400);
  table3x.setSize(1000, 400);
  return {
    dialog,
    controller,
    table2x,
    table3x,
    destroy() {
      controller.destroy();
      table2x.destroy();
      table3x.destroy();
    },
  };
}

async function runScenario(id, execute) {
  const started = performance.now();
  try {
    const evidence = await execute();
    return {
      id,
      passed: evidence?.passed === true,
      durationMs: Number((performance.now() - started).toFixed(3)),
      evidence: evidence?.evidence || {},
      diagnostics: evidence?.diagnostics || [],
    };
  } catch (error) {
    return {
      id,
      passed: false,
      durationMs: Number((performance.now() - started).toFixed(3)),
      evidence: {},
      diagnostics: [error instanceof Error ? error.stack || error.message : String(error)],
    };
  }
}

async function benchmarkTable2DelayedReload() {
  const harness = createHarness();
  try {
    harness.table2x.setSnapSettings({ gridEnabled: false, stationEnabled: false });
    const node = harness.table2x.currentNodes().find((candidate) => candidate.id === 'table2a-0003');
    const screen = harness.table2x.worldToScreen(node);
    const baselineProfile = harness.table2x.renderSnapshot.map((point) => ({ ...point }));
    const beforeRaw = getRawLine(harness.dialog.querySelector('[data-p3d-split="table2a-raw"]').value, '0+019.0').split('\t');

    harness.table2x.onPrimaryPointerDown({ button: 0 }, screen, node);
    harness.table2x.onPrimaryPointerMove({}, screen, { x: node.x, y: 235.037 });
    harness.table2x.onPrimaryPointerUp({}, screen, { x: node.x, y: 235.037 });

    const committedRaw = getRawLine(harness.dialog.querySelector('[data-p3d-split="table2a-raw"]').value, '0+019.0').split('\t');
    const snapshotStayedBaseline = harness.table2x.renderSnapshot.find((point) => point.id === node.id)?.y === baselineProfile.find((point) => point.id === node.id)?.y;
    const overrideBeforeReload = harness.table2x.visualOverrides.get(node.id);
    harness.controller.reloadGraphs();
    const reloadedY = harness.table2x.renderSnapshot.find((point) => point.id === node.id)?.y;

    const passed = beforeRaw[2] === committedRaw[2]
      && committedRaw[4] === '235.04'
      && snapshotStayedBaseline
      && near(overrideBeforeReload, 235.037)
      && near(reloadedY, 235.037)
      && harness.table2x.visualOverrides.size === 0;

    return {
      passed,
      evidence: {
        lengthColumnBefore: beforeRaw[2],
        lengthColumnAfter: committedRaw[2],
        elevationTextAfter: committedRaw[4],
        snapshotStayedBaseline,
        overrideBeforeReload,
        reloadedY,
        overridesAfterReload: harness.table2x.visualOverrides.size,
      },
      diagnostics: passed ? [] : ['Table 2 drag/reload contract did not remain stable.'],
    };
  } finally {
    harness.destroy();
  }
}

async function benchmarkDepthAndAboveGroundSnap() {
  const harness = createHarness();
  try {
    harness.table3x.setSnapSettings({
      gridEnabled: true,
      stationEnabled: false,
      depthStep: 0.1,
      aboveGroundTolerance: 0.15,
      aboveGroundZ: 0.75,
    });
    const node = harness.table3x.depthNodes().find((candidate) => candidate.id === 'table3b-0002');
    const screen = harness.table3x.worldToScreen(node);
    harness.table3x.onPrimaryPointerDown({ button: 0 }, screen, node);
    harness.table3x.onPrimaryPointerMove({}, screen, { x: node.x, y: -0.05 });
    harness.table3x.onPrimaryPointerUp({}, screen, { x: node.x, y: -0.05 });

    const row = harness.controller.model.findRow('table3b-0002');
    const rawLine = getRawLine(harness.dialog.querySelector('[data-p3d-split="table3b-raw"]').value, '708.374');
    const passed = row?.zMode === 'ABOVE_GROUND' && near(row?.z, 0.75) && rawLine.endsWith('\tA/G');
    return {
      passed,
      evidence: { zMode: row?.zMode, z: row?.z, rawLine },
      diagnostics: passed ? [] : ['Near-grade depth did not snap to canonical A/G state.'],
    };
  } finally {
    harness.destroy();
  }
}

async function benchmarkMarkerInverseMapping() {
  const harness = createHarness();
  try {
    harness.table3x.setSnapSettings({ gridEnabled: false, stationEnabled: false });
    const marker = harness.table3x.markerNodes()[0];
    const screen = harness.table3x.worldToScreen(marker);
    harness.table3x.onPrimaryPointerDown({ button: 0 }, screen, marker);
    harness.table3x.onPrimaryPointerMove({}, screen, { x: 40, y: marker.y });
    harness.table3x.onPrimaryPointerUp({}, screen, { x: 40, y: marker.y });

    const expectedAbsoluteH = interpolateAbsoluteHFromCumulative(40, harness.controller.model.coordinateMap);
    const row = harness.controller.model.findRow('table3c-0001');
    const rawLine = getRawLine(harness.dialog.querySelector('[data-p3d-split="table3c-raw"]').value, 'PM-001');
    const serializedAbsoluteH = Number(rawLine.split('\t')[0]);
    const passed = near(row?.absoluteH, expectedAbsoluteH)
      && near(serializedAbsoluteH, expectedAbsoluteH, 0.001)
      && harness.controller.model.table3MarkerRows.length === 1;
    return {
      passed,
      evidence: { cumulative: 40, expectedAbsoluteH, modelAbsoluteH: row?.absoluteH, serializedAbsoluteH },
      diagnostics: passed ? [] : ['Marker inverse mapping or independent marker identity failed.'],
    };
  } finally {
    harness.destroy();
  }
}

async function benchmarkRangeHighlightStability() {
  const rangeRow = new FakeRow(['682.337 → 732.683', '708.374', '1.2M']);
  const harness = createHarness({ outputs: { table3x: new FakeOutputRoot([rangeRow]) } });
  try {
    const node = harness.table3x.depthNodes().find((candidate) => candidate.id === 'table3b-0002');
    const screen = harness.table3x.worldToScreen(node);
    harness.table3x.onPrimaryPointerDown({ button: 0 }, screen, node);
    harness.table3x.onPrimaryPointerMove({}, screen, { x: node.x, y: -1.2 });
    harness.table3x.onPrimaryPointerUp({}, screen, { x: node.x, y: -1.2 });
    applyPipelineCadDirtyHighlights(harness.dialog, harness.controller.model);

    const modelRow = harness.controller.model.findRow('table3b-0002');
    const highlightedId = rangeRow.getAttribute('data-p3d-cad-dirty-row');
    const passed = modelRow?.fromH === 682.337
      && modelRow?.toH === 732.683
      && modelRow?.zText === '1.2M'
      && rangeRow.classList.contains('p3d-cad-dirty-row')
      && highlightedId === 'table3b-0002';
    return {
      passed,
      evidence: {
        fromH: modelRow?.fromH,
        toH: modelRow?.toH,
        zText: modelRow?.zText,
        highlightedId,
        rangeLabel: rangeRow.cells[0].textContent,
      },
      diagnostics: passed ? [] : ['Structured Table 3B range identity did not survive mutation/highlight matching.'],
    };
  } finally {
    harness.destroy();
  }
}

async function benchmarkManualRawOverride() {
  const harness = createHarness();
  try {
    const table2Identity = harness.table2x;
    const table3Identity = harness.table3x;
    harness.table2x.visualOverrides.set('table2a-0003', 999);
    harness.table3x.markerOverrides.set('table3c-0001', 999);
    harness.table2x.zoomAt({ x: 500, y: 200 }, 1.7);
    harness.table3x.panBy(24, -12);

    const rawTable2 = harness.dialog.querySelector('[data-p3d-split="table2a-raw"]');
    rawTable2.value = rawTable2.value.replace('230.82', '236.25');
    harness.dialog.emit('input', rawTable2);
    const rawTable3C = harness.dialog.querySelector('[data-p3d-split="table3c-raw"]');
    rawTable3C.value = rawTable3C.value.replace('688.135', '700.250');
    harness.dialog.emit('input', rawTable3C);

    const elevation = harness.controller.model.table2Rows.find((row) => row.stationValue === 19)?.elevationValue;
    const marker = harness.controller.model.table3MarkerRows.find((row) => row.markerText === 'PM-001');
    const passed = harness.table2x === table2Identity
      && harness.table3x === table3Identity
      && near(elevation, 236.25)
      && near(marker?.absoluteH, 700.25)
      && harness.table2x.visualOverrides.size === 0
      && harness.table3x.markerOverrides.size === 0;
    return {
      passed,
      evidence: {
        table2CanvasIdentityPreserved: harness.table2x === table2Identity,
        table3CanvasIdentityPreserved: harness.table3x === table3Identity,
        elevation,
        markerAbsoluteH: marker?.absoluteH,
        table2Overrides: harness.table2x.visualOverrides.size,
        table3MarkerOverrides: harness.table3x.markerOverrides.size,
      },
      diagnostics: passed ? [] : ['Manual raw input did not rebuild model state while preserving Canvas instances.'],
    };
  } finally {
    harness.destroy();
  }
}

async function collectRuntimeEvidence() {
  const [previewSource, table2Source, table3Source] = await Promise.all([
    readFile(new URL('../../tabs/pipeline-3d-model/pipeline-3d-model-preview.js', import.meta.url), 'utf8'),
    readFile(new URL('../../tabs/pipeline-3d-model/pipeline-3d-model-table2x-canvas.js', import.meta.url), 'utf8'),
    readFile(new URL('../../tabs/pipeline-3d-model/pipeline-3d-model-table3x-canvas.js', import.meta.url), 'utf8'),
  ]);
  return {
    featureFlagDefaultOff: !isPipelineCadCanvasEnabled({
      location: { search: '' },
      storage: { getItem: () => null },
    }),
    legacySvgFallbackPresent: previewSource.includes('createTable2XSVG') && previewSource.includes('createTable3XSVG'),
    canvasModulesPresent: table2Source.includes('class Table2XCanvas') && table3Source.includes('class Table3XCanvas'),
    productionDefaultSwitched: false,
  };
}

export async function runPipelineCadReadinessBenchmark(options = {}) {
  const consoleErrors = [];
  const originalConsoleError = console.error;
  console.error = (...args) => {
    consoleErrors.push(args.map((value) => value instanceof Error ? value.stack || value.message : String(value)).join(' '));
    if (options.echoConsoleErrors) originalConsoleError(...args);
  };
  try {
    const scenarios = [];
    scenarios.push(await runScenario('CAD-B01', benchmarkTable2DelayedReload));
    scenarios.push(await runScenario('CAD-B02', benchmarkDepthAndAboveGroundSnap));
    scenarios.push(await runScenario('CAD-B03', benchmarkMarkerInverseMapping));
    scenarios.push(await runScenario('CAD-B04', benchmarkRangeHighlightStability));
    scenarios.push(await runScenario('CAD-B05', benchmarkManualRawOverride));
    const audit = buildPipelineCadReadinessAudit({
      generatedAt: options.generatedAt,
      sourceRevision: options.sourceRevision || process.env.GITHUB_SHA || 'local',
      scenarios,
      runtime: await collectRuntimeEvidence(),
      consoleErrors,
    });
    if (options.assertReady !== false) assertPipelineCadReadiness(audit);
    return audit;
  } finally {
    console.error = originalConsoleError;
  }
}
