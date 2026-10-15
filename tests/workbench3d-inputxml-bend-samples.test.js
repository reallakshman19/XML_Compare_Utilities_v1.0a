// Repository-sample qualification for Workbench InputXML bend visual geometry.
import assert from 'assert';
import { readFileSync } from 'node:fs';
import { parseInputXmlRecords, XML_SCHEMA_KINDS } from '../workbench3d/adapters/inputxml-adapter.js';
import { buildCanonicalGraph } from '../workbench3d/adapters/canonical-graph-builder.js';
import { buildVisualModel } from '../workbench3d/adapters/visual-model-builder.js';
import {
  bendDiagnosticsPanelHtml, buildBendDiagnosticsModel,
} from '../workbench3d/ui/bend-diagnostics-panel.js';
import './workbench3d-bend-geometry-audit.test.js';

const SAMPLES = Object.freeze([
  Object.freeze({
    id: 'normal-metallic',
    fileName: '.preview-samples/source.xml',
    url: new URL('../.preview-samples/source.xml', import.meta.url),
    schema: XML_SCHEMA_KINDS.CATEGORIZED_XML,
  }),
  Object.freeze({
    id: 'asme-b31.4',
    fileName: 'docs/PLB314Inputxml.xml',
    url: new URL('../docs/PLB314Inputxml.xml', import.meta.url),
    schema: XML_SCHEMA_KINDS.INPUT_XML,
  }),
  Object.freeze({
    id: 'gre',
    fileName: 'docs/GREInputxml.xml',
    url: new URL('../docs/GREInputxml.xml', import.meta.url),
    schema: XML_SCHEMA_KINDS.INPUT_XML,
  }),
]);

function declaredCount(xmlText, attribute) {
  const match = new RegExp(`\\b${attribute}="(\\d+)"`, 'i').exec(xmlText);
  return match ? Number(match[1]) : null;
}

function packetCount(records, kind) {
  return records.reduce((total, record) => total
    + record.packets.filter((packet) => packet.kind === kind).length, 0);
}

function bendSegments(visual) {
  return visual.segments.filter((segment) => segment.attrs?.bendGeometry === 'EXPLICIT_RADIUS_ARC');
}

function finitePoint(point) {
  return Array.isArray(point) && point.length === 3 && point.every(Number.isFinite);
}

function qualifySample(sample) {
  const xmlText = readFileSync(sample.url, 'utf8');
  const parsed = parseInputXmlRecords(xmlText);
  assert.strictEqual(parsed.schema, sample.schema, `${sample.id}: schema`);
  assert.ok(parsed.records.length > 0, `${sample.id}: records parsed`);
  const declaredElements = declaredCount(xmlText, 'NUMELT');
  if (declaredElements !== null) {
    assert.strictEqual(parsed.records.length, declaredElements, `${sample.id}: NUMELT parity`);
  }
  const requestedBends = packetCount(parsed.records, 'BEND');
  const declaredBends = declaredCount(xmlText, 'NUMBEND');
  assert.ok(requestedBends > 0, `${sample.id}: repository sample contains bend evidence`);
  if (declaredBends !== null) {
    assert.strictEqual(requestedBends, declaredBends, `${sample.id}: NUMBEND parity`);
  }
  const graph = buildCanonicalGraph(sample.id, parsed.records, { shortElementToleranceMm: 6 });
  const visual = buildVisualModel(graph);
  const repeated = buildVisualModel(graph);
  assert.strictEqual(visual.bendSummary.requested, requestedBends, `${sample.id}: requested count`);
  assert.strictEqual(visual.bendSummary.resolved + visual.bendSummary.blocked,
    requestedBends, `${sample.id}: every bend receives a disposition`);
  assert.strictEqual(visual.geometryDiagnostics.length,
    visual.bendSummary.blocked, `${sample.id}: blocked count parity`);
  assert.deepStrictEqual(visual.bendSummary, repeated.bendSummary, `${sample.id}: deterministic summary`);
  assert.deepStrictEqual(visual.geometryDiagnostics, repeated.geometryDiagnostics,
    `${sample.id}: deterministic diagnostics`);
  assert.deepStrictEqual(bendSegments(visual), bendSegments(repeated),
    `${sample.id}: deterministic resolved geometry`);
  assert.deepStrictEqual(visual.bendAudit, repeated.bendAudit,
    `${sample.id}: deterministic bend audit`);
  assert.match(visual.bendAudit.signature, /^wb3d-bend-[0-9a-f]{8}$/,
    `${sample.id}: semantic signature`);
  assert.strictEqual(visual.bendAudit.payload.summaryConsistent, true,
    `${sample.id}: audit summary consistency`);
  assert.strictEqual(bendSegments(visual).length,
    visual.bendSummary.arcSegments, `${sample.id}: arc chord count`);
  for (const diagnostic of visual.geometryDiagnostics) {
    assert.ok(diagnostic.objectId, `${sample.id}: diagnostic object identity`);
    assert.strictEqual(diagnostic.severity, 'BLOCKED', `${sample.id}: diagnostic severity`);
    assert.ok(diagnostic.code && diagnostic.message, `${sample.id}: actionable diagnostic`);
  }
  for (const segment of visual.segments) {
    assert.ok(finitePoint(segment.start) && finitePoint(segment.end), `${sample.id}: finite segment`);
    assert.ok(Number.isFinite(segment.radiusMm) && segment.radiusMm > 0, `${sample.id}: positive visual radius`);
  }
  return { sample, parsed, graph, visual };
}

const qualified = SAMPLES.map(qualifySample);
const source = qualified[0];
const target = qualified[1];
const panelState = {
  sourceName: source.sample.fileName,
  targetName: target.sample.fileName,
  visuals: { A: source.visual, B: target.visual },
};
const panel = buildBendDiagnosticsModel(panelState);
assert.strictEqual(panel.totals.requested,
  source.visual.bendSummary.requested + target.visual.bendSummary.requested);
assert.strictEqual(panel.totals.resolved,
  source.visual.bendSummary.resolved + target.visual.bendSummary.resolved);
assert.ok(panel.source.signature && panel.target.signature, 'panel exposes both audit signatures');
assert.ok(['MATCH', 'DIFFERENT'].includes(panel.auditParity), 'panel reports audit parity');
const panelHtml = bendDiagnosticsPanelHtml(panelState);
assert.match(panelHtml, /InputXML bend geometry/);
assert.match(panelHtml, /Read-only visual derivation evidence/);
assert.match(panelHtml, /Export audit JSON/);
assert.match(panelHtml, /stable-json-fnv1a32/);

const blockedState = {
  sourceName: 'blocked.xml', targetName: 'ready.xml',
  visuals: {
    A: {
      bendSummary: { requested: 1, resolved: 0, blocked: 1, arcSegments: 0 },
      geometryDiagnostics: [{ objectId: 'source:E2', severity: 'BLOCKED', code: 'BEND_RADIUS_MISSING', message: 'Explicit positive bend radius is required.' }],
    },
    B: {
      bendSummary: { requested: 1, resolved: 1, blocked: 0, arcSegments: 12 },
      geometryDiagnostics: [],
    },
  },
};
const blockedModel = buildBendDiagnosticsModel(blockedState);
assert.strictEqual(blockedModel.source.disposition, 'REVIEW_REQUIRED');
assert.strictEqual(blockedModel.auditParity, 'NOT_AVAILABLE');
const blockedHtml = bendDiagnosticsPanelHtml(blockedState);
assert.match(blockedHtml, /BEND_RADIUS_MISSING/);
assert.match(blockedHtml, /data-action="select-object" data-object="source:E2"/);

for (const result of qualified) {
  const summary = result.visual.bendSummary;
  console.log(`  ${result.sample.id}: elements=${result.parsed.records.length} bends=${summary.requested} resolved=${summary.resolved} blocked=${summary.blocked} chords=${summary.arcSegments} signature=${result.visual.bendAudit.signature}`);
}
console.log('workbench3d-inputxml-bend-samples.test.js passed');
