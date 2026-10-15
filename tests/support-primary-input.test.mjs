import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildReferenceSupportPrimaryRelationshipInput,
  buildSupportPrimaryRelationshipInput,
  SUPPORT_PRIMARY_REFERENCE_SCOPE_BASIS,
} from '../tabs/support-steel-relationship-builder/support-primary-input.js';

function object(path, item) {
  return `<clashobject><pathlink>${path.map((node) => `<node>${node}</node>`).join('')}</pathlink><smarttag><name>Item Name</name><value>${item}</value></smarttag></clashobject>`;
}
function clash(name, zone, a, b) {
  const pathA = ['/ASIM-1835-CU-PI', zone, a];
  const pathB = ['/ASIM-1835-CU-PI', zone, b];
  return `<clashresult name="${name}" distance="0.001"><pos3f x="1" y="2" z="3"/>${object(pathA, a)}${object(pathB, b)}</clashresult>`;
}

const keepZone = '/ASIM-1835-CU-PI-P';
const otherZone = '/ASIM-1835-CU-PI-D';
const xml = `<exchange><clashtests>${clash('Clash1', keepZone, '/PS-11167.2', '/PS-11167.11')}${clash('Clash2', otherZone, '/PS-11167.3', '/PS-11167.4')}</clashtests></exchange>`;

test('builds primary relationship bundle only from relationship rows inside selected exact zones', () => {
  const built = buildSupportPrimaryRelationshipInput(xml, {
    zoneScope: { primaryZoneIds: [keepZone] },
  });
  assert.equal(built.parsedRowCount, 2);
  assert.equal(built.scopedRowCount, 1);
  assert.equal(built.excludedByZoneCount, 1);
  assert.equal(built.bundle.summary.explicitEdgeCount, 1);
  assert.equal(built.bundle.families[0].assemblies[0].assemblyId, 'PSA::PS-11167::M-2+11');
});

test('empty zone scope keeps all valid relationship rows for the current-side explicit input', () => {
  const built = buildSupportPrimaryRelationshipInput(xml);
  assert.equal(built.parsedRowCount, 2);
  assert.equal(built.scopedRowCount, 2);
  assert.equal(built.bundle.summary.explicitEdgeCount, 2);
});

test('reference relationship scope is derived from exact reference Support Report ancestry', () => {
  const referenceEvidence = Object.freeze({
    rows: Object.freeze([Object.freeze({
      primaryPath: Object.freeze(['/ASIM-1835-CU-PI', keepZone, '/B1', '/PS-11167.2']),
      secondaryPath: Object.freeze(['/ASIM-1835-CU-SU', '/ASIM-1835-CU-SU-A', '/PS-11167']),
    })]),
  });
  const built = buildReferenceSupportPrimaryRelationshipInput(xml, referenceEvidence);
  assert.equal(built.scopeBasis, SUPPORT_PRIMARY_REFERENCE_SCOPE_BASIS);
  assert.equal(built.scopeAvailable, true);
  assert.ok(built.zoneScope.primaryZoneIds.includes(keepZone));
  assert.equal(built.parsedRowCount, 2);
  assert.equal(built.scopedRowCount, 1);
  assert.equal(built.excludedByZoneCount, 1);
  assert.equal(built.bundle.summary.explicitEdgeCount, 1);
});

test('reference relationship input fails closed when reference evidence has no discoverable zone ancestry', () => {
  const referenceEvidence = Object.freeze({
    rows: Object.freeze([Object.freeze({
      primaryPath: Object.freeze(['/PS-11167.2']),
      secondaryPath: Object.freeze(['/PS-11167']),
    })]),
  });
  const built = buildReferenceSupportPrimaryRelationshipInput(xml, referenceEvidence);
  assert.equal(built.scopeBasis, SUPPORT_PRIMARY_REFERENCE_SCOPE_BASIS);
  assert.equal(built.scopeAvailable, false);
  assert.equal(built.parsedRowCount, 2);
  assert.equal(built.scopedRowCount, 0);
  assert.equal(built.excludedByZoneCount, 2);
  assert.equal(built.bundle.summary.explicitEdgeCount, 0);
});
