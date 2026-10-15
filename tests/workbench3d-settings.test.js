// Settings roundtrip/normalization + panel view-models + filters.
import assert from 'assert';
import {
  WB3D_SETTINGS_KEY, DEFAULT_WB3D_SETTINGS, normalizeSettings, loadSettings, saveSettings,
  discoverPacketKinds, effectiveStatusStyles, packetKindVisible, PANEL_COLUMNS,
} from '../workbench3d/core/wb3d-settings.js';
import {
  stripModelPrefix, objectDiffPanelRows, conflictPanelRows, approvalPanelRows,
  applyPanelFilters, distinctValues, objectHoverTooltipLines,
} from '../workbench3d/ui/panel-view-models.js';
import { STATUS_STYLES } from '../workbench3d/viewer/workbench-viewer.js';

// ── settings normalize / load / save roundtrip ───────────────────────────
class FakeStorage {
  constructor() { this.map = new Map(); }
  getItem(key) { return this.map.has(key) ? this.map.get(key) : null; }
  setItem(key, value) { this.map.set(key, String(value)); }
}

const storage = new FakeStorage();
const defaults = loadSettings(storage);
assert.strictEqual(defaults.markerPlacement, 'mid');
assert.strictEqual(defaults.tooltipPacketKinds, null, 'null = all kinds');
assert.deepStrictEqual(defaults.panels.objectDiff.columns, PANEL_COLUMNS.objectDiff.map(([k]) => k));

defaults.markerPlacement = 'text';
defaults.statusStyles.MATCHED_UNCHANGED = { color: '#FF00AA', alpha: 3.7 }; // alpha out of range
defaults.statusStyles.BOGUS = { color: 'not-a-color' };                       // dropped
defaults.panels.objectDiff.x = -50;                                            // clamped
defaults.tooltipPacketKinds = ['RIGID'];
assert.ok(saveSettings(storage, defaults));
assert.ok(storage.getItem(WB3D_SETTINGS_KEY), 'persisted under wb3d key');

const reloaded = loadSettings(storage);
assert.strictEqual(reloaded.markerPlacement, 'text');
assert.strictEqual(reloaded.statusStyles.MATCHED_UNCHANGED.color, '#ff00aa', 'color lowercased');
assert.strictEqual(reloaded.statusStyles.MATCHED_UNCHANGED.alpha, 1, 'alpha clamped');
assert.strictEqual(reloaded.statusStyles.BOGUS, undefined, 'invalid color entry dropped');
assert.strictEqual(reloaded.panels.objectDiff.x, 0, 'panel x clamped to 0');
assert.deepStrictEqual(reloaded.tooltipPacketKinds, ['RIGID']);

// corrupted storage falls back to defaults
storage.setItem(WB3D_SETTINGS_KEY, '{not json');
assert.strictEqual(loadSettings(storage).markerPlacement, 'mid');

// ── effectiveStatusStyles over all 12 statuses ────────────────────────────
const styles = effectiveStatusStyles(reloaded, STATUS_STYLES);
assert.strictEqual(Object.keys(styles).length, Object.keys(STATUS_STYLES).length, 'every status present');
assert.strictEqual(styles.MATCHED_UNCHANGED.colorHex, '#ff00aa', 'override wins');
assert.strictEqual(styles.MATCHED_UNCHANGED.colorInt, 0xff00aa);
assert.strictEqual(styles.PROPERTY_CHANGED.colorInt, STATUS_STYLES.PROPERTY_CHANGED.color, 'default kept');
assert.strictEqual(styles.GHOST.alpha, 1);

// ── discoverPacketKinds + packetKindVisible ───────────────────────────────
const fakeGraph = (kinds) => ({ objects: kinds.map((k) => ({ packets: [{ kind: k }] })) });
assert.deepStrictEqual(discoverPacketKinds(fakeGraph(['SIF', 'RIGID']), fakeGraph(['RESTRAINT', 'RIGID'])), ['RESTRAINT', 'RIGID', 'SIF']);
assert.strictEqual(packetKindVisible(reloaded, 'RIGID'), true);
assert.strictEqual(packetKindVisible(reloaded, 'SIF'), false, 'allowlist filters');
assert.strictEqual(packetKindVisible(normalizeSettings(null), 'SIF'), true, 'null allows all');

// ── panel view-models ─────────────────────────────────────────────────────
assert.strictEqual(stripModelPrefix('source:E32'), 'E32');
assert.strictEqual(stripModelPrefix('target:N4'), 'N4');
assert.strictEqual(stripModelPrefix('E7'), 'E7');

const audit = {
  objectDiff: { rows: [
    { diffId: 'D1', status: 'PROPERTY_CHANGED', sourceObjectId: 'source:E1', targetObjectId: 'target:E2', confidence: 'HIGH', reasons: ['length: ok'], conflicts: [] },
    { diffId: 'D2', status: 'MISSING_IN_TARGET', sourceObjectId: 'source:E3', targetObjectId: null, confidence: 'NONE', reasons: [], conflicts: [] },
  ] },
  conflictLedger: { rows: [
    { conflictId: 'C1', diffId: 'D1', kind: 'EVIDENCE_CONFLICT', sourceObjectId: 'source:E1', targetObjectId: 'target:E2', detail: 'source:E1 vs target:E2 diameter differs' },
  ] },
};
const diffRows = objectDiffPanelRows(audit);
assert.strictEqual(diffRows[0].source, 'E1');
assert.strictEqual(diffRows[0].target, 'E2');
assert.strictEqual(diffRows[1].target, '', 'null target renders empty');
const confRows = conflictPanelRows(audit);
assert.strictEqual(confRows[0].status, 'PROPERTY_CHANGED', 'status joined via diffId');
assert.ok(!confRows[0].detail.includes('source:'), 'prefixes stripped from detail');

const plan = { rows: [
  { rowId: 'T1', sourceObjectId: 'source:E1', targetObjectId: 'target:E2', property: 'TEMP', oldValue: '', newValue: '350', confidence: 'HIGH', approval: 'PENDING', blockedReason: null },
] };
const appRows = approvalPanelRows(plan);
assert.strictEqual(appRows[0].element, 'E1→E2');

assert.deepStrictEqual(applyPanelFilters(diffRows, { statusFilter: ['MISSING_IN_TARGET'] }).map((r) => r.diffId), ['D2']);
assert.deepStrictEqual(applyPanelFilters(diffRows, { confidenceFilter: ['HIGH'] }).map((r) => r.diffId), ['D1']);
assert.deepStrictEqual(applyPanelFilters(confRows, { kindFilter: ['EVIDENCE_CONFLICT'] }).length, 1);
assert.deepStrictEqual(distinctValues(diffRows, 'status'), ['MISSING_IN_TARGET', 'PROPERTY_CHANGED']);

// hover tooltip lines respect the packet allowlist
const graphs = { A: { objects: [{ objectId: 'source:E1', kind: 'PIPE', canonicalFromTo: '10->20', packets: [{ kind: 'RIGID', attrs: { WEIGHT: '5' } }, { kind: 'SIF', attrs: {} }], properties: {} }] } };
const lines = objectHoverTooltipLines(audit, graphs, 'source:E1', { tooltipPacketKinds: ['RIGID'] });
assert.ok(lines.some((l) => l.startsWith('RIGID')), 'allowed packet shown');
assert.ok(!lines.some((l) => l.startsWith('SIF')), 'filtered packet hidden');

console.log('workbench3d-settings.test.js passed');
