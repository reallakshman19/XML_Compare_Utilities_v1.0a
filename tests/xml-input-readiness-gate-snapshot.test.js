import assert from 'node:assert/strict';

import {
  buildInputReadinessGateSnapshot,
  serializeInputReadinessGateSnapshotJson,
  summarizeReadinessGateSide,
} from '../xml-compare/input/build-input-readiness-gate-snapshot.js';

function side(overrides = {}) {
  return {
    sourceId: 'A',
    side: 'Source A',
    fileName: 'source.xml',
    profile: 'categorized-inputxml',
    parseOk: true,
    recordCount: 2,
    readyForConnector: true,
    blockerCount: 0,
    warningCount: 0,
    diagnostics: [],
    identitySummary: { recordCount: 2, stableCount: 2, lowConfidenceCount: 0, syntheticFallbackCount: 0, unknownCount: 0 },
    coordinateFrameSummary: { recordCount: 2, absoluteCount: 2, relativeCount: 0, sideloadGlobalCount: 0, syntheticLayoutCount: 0, unknownCount: 0, comparableForDeltaCount: 2, notComparableForDeltaCount: 0 },
    ...overrides,
  };
}

function audit(sourceA = side(), targetB = side({ sourceId: 'B', side: 'Target B', fileName: 'target.xml' })) {
  return { schema: 'xml-input-readiness-audit/v1', generatedAt: '2026-07-03T09:00:00.000Z', sourceA, targetB };
}

let snapshot = buildInputReadinessGateSnapshot(audit());
assert.equal(snapshot.schema, 'xml-input-readiness-gate-snapshot/v1');
assert.equal(snapshot.gate.status, 'PASS');
assert.equal(snapshot.gate.readyForConnector, true);
assert.equal(snapshot.sourceA.status, 'PASS');

snapshot = buildInputReadinessGateSnapshot(audit(side({ parseOk: false, readyForConnector: false, blockerCount: 1, diagnostics: [{ severity: 'BLOCKER', code: 'xml_parse_failed', message: 'Bad XML', ref: { side: 'a' } }] })));
assert.equal(snapshot.sourceA.status, 'FAIL');
assert.equal(snapshot.sourceA.profileStatus.status, 'FAIL');
assert.equal(snapshot.gate.status, 'FAIL');
assert.equal(snapshot.sourceA.blockers[0].code, 'xml_parse_failed');

snapshot = buildInputReadinessGateSnapshot(audit(side({ recordCount: 0, readyForConnector: false })));
assert.equal(snapshot.sourceA.recordStatus.status, 'FAIL');
assert.equal(snapshot.gate.status, 'FAIL');

snapshot = buildInputReadinessGateSnapshot(audit(side({ readyForConnector: false, identitySummary: { recordCount: 2, stableCount: 0, lowConfidenceCount: 2, syntheticFallbackCount: 2, unknownCount: 0 } })));
assert.equal(snapshot.sourceA.identityStatus.status, 'FAIL');
assert.equal(snapshot.gate.status, 'FAIL');

snapshot = buildInputReadinessGateSnapshot(audit(side({ identitySummary: { recordCount: 2, stableCount: 1, lowConfidenceCount: 1, syntheticFallbackCount: 1, unknownCount: 0 } })));
assert.equal(snapshot.sourceA.identityStatus.status, 'WARN');
assert.equal(snapshot.sourceA.status, 'PASS');

snapshot = buildInputReadinessGateSnapshot(audit(side({ readyForConnector: false, coordinateFrameSummary: { recordCount: 2, absoluteCount: 0, relativeCount: 0, sideloadGlobalCount: 0, syntheticLayoutCount: 1, unknownCount: 1, comparableForDeltaCount: 0, notComparableForDeltaCount: 2 } })));
assert.equal(snapshot.sourceA.coordinateFrameStatus.status, 'FAIL');
assert.equal(snapshot.gate.status, 'FAIL');

snapshot = buildInputReadinessGateSnapshot(audit(side({ coordinateFrameSummary: { recordCount: 2, absoluteCount: 1, relativeCount: 0, sideloadGlobalCount: 0, syntheticLayoutCount: 1, unknownCount: 0, comparableForDeltaCount: 1, notComparableForDeltaCount: 1 } })));
assert.equal(snapshot.sourceA.coordinateFrameStatus.status, 'WARN');
assert.equal(snapshot.sourceA.status, 'PASS');

snapshot = buildInputReadinessGateSnapshot(audit(side({ readyForConnector: false, blockerCount: 1, diagnostics: [{ severity: 'BLOCKER', code: 'blank_input', message: 'Blank', ref: '' }] })));
assert.equal(snapshot.sourceA.diagnosticStatus.status, 'FAIL');
assert.equal(snapshot.gate.status, 'FAIL');

snapshot = buildInputReadinessGateSnapshot(audit(side({ warningCount: 1, diagnostics: [{ severity: 'WARNING', code: 'profile_low_confidence', message: 'Low confidence', ref: '' }] })));
assert.equal(snapshot.sourceA.diagnosticStatus.status, 'WARN');
assert.equal(snapshot.sourceA.profileStatus.status, 'WARN');

const duplicate = { severity: 'WARNING', code: 'profile_low_confidence', message: 'Low confidence', ref: { side: 'a' } };
snapshot = buildInputReadinessGateSnapshot(audit(side({ warningCount: 2, diagnostics: [duplicate, { ...duplicate }] })));
assert.equal(snapshot.sourceA.warnings.length, 1);
assert.deepEqual(Object.keys(snapshot.sourceA.warnings[0]).sort(), ['code', 'message', 'ref', 'severity']);

const original = audit();
const before = JSON.stringify(original);
snapshot = buildInputReadinessGateSnapshot(original);
const json = serializeInputReadinessGateSnapshotJson(snapshot);
assert.equal(json.endsWith('\n'), true);
assert.equal(JSON.parse(json).schema, 'xml-input-readiness-gate-snapshot/v1');
assert.equal(JSON.stringify(original), before);
assert.equal(summarizeReadinessGateSide(original.sourceA).status, 'PASS');

console.log('XML input readiness gate snapshot tests passed');
