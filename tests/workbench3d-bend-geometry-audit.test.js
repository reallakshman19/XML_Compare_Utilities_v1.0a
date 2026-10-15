import assert from 'assert';
import {
  BEND_GEOMETRY_AUDIT_CONTRACT, BEND_GEOMETRY_SIGNATURE_ALGORITHM,
  buildBendGeometryAudit, serializeBendGeometryAudit,
} from '../workbench3d/adapters/bend-geometry-audit.js';
import { bendDiagnosticsPanelHtml, buildBendDiagnosticsModel } from '../workbench3d/ui/bend-diagnostics-panel.js';
import './workbench3d-bend-review-package.test.js';

function plan(prefix, reverse = false, radiusMm = 200) {
  const arc = (id, incoming, outgoing, corner, radius) => ({
    objectId: `${prefix}:${id}`, incomingObjectId: `${prefix}:${incoming}`,
    outgoingObjectId: `${prefix}:${outgoing}`, cornerNode: corner, radiusMm: radius,
    angleDeg: 90, tangentMm: radius, center: [800, 200, 0],
    points: [[800, 0, 0], [941.421356, 58.578644, 0], [1000, 200, 0]],
    directionEvidence: 'SOURCE_ORIENTATION_V1', packetSource: 'HOST_ELEMENT',
  });
  const arcs = [arc('E2', 'E1', 'E3', '20', radiusMm), arc('E6', 'E5', 'E7', '60', 300)];
  if (reverse) arcs.reverse();
  return {
    summary: { requested: 3, resolved: 2, blocked: 1, arcSegments: 4 }, arcs,
    diagnostics: [{
      objectId: `${prefix}:E9`, packetIndex: 0, severity: 'BLOCKED',
      code: 'BEND_CONSUMED_LEGS_AMBIGUOUS',
      message: 'Consumed bend requires one incoming and one outgoing source leg.',
      ...(reverse
        ? { outgoingCount: 1, incomingCount: 2, cornerNode: '40' }
        : { cornerNode: '40', incomingCount: 2, outgoingCount: 1 }),
    }],
  };
}

const audit = (modelId, planValue) => buildBendGeometryAudit(
  { contract: 'CanonicalObjectGraph.v1', modelId }, planValue,
);
const source = audit('source', plan('source'));
const target = audit('target', plan('target', true));
assert.strictEqual(source.contract, BEND_GEOMETRY_AUDIT_CONTRACT);
assert.strictEqual(source.signatureAlgorithm, BEND_GEOMETRY_SIGNATURE_ALGORITHM);
assert.match(source.signature, /^wb3d-bend-[0-9a-f]{8}$/);
assert.strictEqual(source.signature, target.signature, 'prefix and row order are semantic-neutral');
assert.deepStrictEqual(source.payload, target.payload);
assert.strictEqual(source.payload.summaryConsistent, true);
const serialized = serializeBendGeometryAudit(source);
assert.strictEqual(serialized, serializeBendGeometryAudit(source));
assert.strictEqual(JSON.parse(serialized).signature, source.signature);
const changed = audit('source', plan('source', false, 201));
assert.notStrictEqual(changed.signature, source.signature, 'radius changes the signature');

const visual = (bendAudit) => ({
  bendSummary: bendAudit.payload.declaredSummary,
  geometryDiagnostics: bendAudit.payload.diagnostics, bendAudit,
});
const state = { sourceName: 'source.xml', targetName: 'target.xml', visuals: { A: visual(source), B: visual(target) } };
assert.strictEqual(buildBendDiagnosticsModel(state).auditParity, 'MATCH');
const html = bendDiagnosticsPanelHtml(state);
assert.match(html, /audit MATCH/);
assert.match(html, /Export audit JSON/);
assert.match(html, /data:application\/json;charset=utf-8/);
assert.strictEqual(buildBendDiagnosticsModel({
  ...state, visuals: { A: visual(source), B: visual(changed) },
}).auditParity, 'DIFFERENT');
console.log('workbench3d-bend-geometry-audit.test.js passed');
