import assert from 'node:assert/strict';
import { buildBendReviewPackageManifest, serializeBendReviewPackageManifest } from '../workbench3d/ui/bend-review-package.js';
import { bendDiagnosticsPanelHtml } from '../workbench3d/ui/bend-diagnostics-panel.js';
import './workbench3d-bend-review-package-verifier.test.js';

const bendAudit = (modelId, signature) => ({
  contract: 'BendGeometryAudit.v1', modelId, signatureAlgorithm: 'stable-json-fnv1a32', signature,
  payload: { summaryConsistent: true, declaredSummary: { requested: 1, resolved: 1, blocked: 0, arcSegments: 12 } },
});
const visual = (modelId, signature) => ({
  bendSummary: { requested: 1, resolved: 1, blocked: 0, arcSegments: 12 }, geometryDiagnostics: [],
  bendAudit: bendAudit(modelId, signature),
});
const base = {
  sourceName: 'source.xml', targetName: 'target.xml', sourceXml: '<A>α</A>', targetXml: '<B/>',
  graphs: { sourceSchema: 'INPUT_XML', targetSchema: 'INPUT_XML' },
  config: { lengthToleranceMm: 6, canonicalNormalization: true }, ignoredProps: ['B', 'A'],
  manualOverrides: [{ type: 'LINK', sourceObjectId: 'source:E1', targetObjectId: 'target:E1' }],
  audit: {
    contract: 'CompareAudit.v1', compareKind: 'topology-edge', sourceObjectIds: ['source:E1'], targetObjectIds: ['target:E1'],
    objectDiff: { rows: [{ diffId: 'D1', status: 'MATCHED_UNCHANGED' }] }, conflictLedger: { rows: [] }, summary: { matchedElements: 1 },
  },
  visuals: { A: visual('source', 'wb3d-bend-aabbccdd'), B: visual('target', 'wb3d-bend-aabbccdd') },
};

const first = buildBendReviewPackageManifest(base);
const repeated = buildBendReviewPackageManifest({ ...base, ignoredProps: ['A', 'B'] });
assert.strictEqual(first.disposition, 'COMPLETE');
assert.match(first.packageSignature, /^wb3d-review-[0-9a-f]{8}$/);
assert.match(first.payload.comparison.runSignature, /^wb3d-run-[0-9a-f]{8}$/);
assert.strictEqual(first.packageSignature, repeated.packageSignature, 'normalized settings are order-stable');
assert.strictEqual(serializeBendReviewPackageManifest(first), serializeBendReviewPackageManifest(first));
assert.strictEqual(first.payload.inputs.source.bytes, 9);
assert.strictEqual(first.payload.bends.parity, 'MATCH');

const renamed = buildBendReviewPackageManifest({ ...base, sourceName: 'renamed.xml' });
assert.strictEqual(renamed.payload.inputs.source.contentSignature, first.payload.inputs.source.contentSignature);
assert.notStrictEqual(renamed.packageSignature, first.packageSignature);
assert.notStrictEqual(buildBendReviewPackageManifest({ ...base, sourceXml: '<A>β</A>' }).payload.comparison.runSignature,
  first.payload.comparison.runSignature);
const changed = buildBendReviewPackageManifest({ ...base, visuals: { ...base.visuals, B: visual('target', 'wb3d-bend-11223344') } });
assert.strictEqual(changed.payload.bends.parity, 'DIFFERENT');
assert.notStrictEqual(changed.packageSignature, first.packageSignature);

const html = bendDiagnosticsPanelHtml(base);
assert.match(html, /Review package/);
assert.match(html, /Export review package/);
assert.match(html, /wb3d-bend-review-verifier/);
assert.match(html, new RegExp(first.packageSignature));
assert.strictEqual(buildBendReviewPackageManifest({ ...base, audit: null }).disposition, 'INCOMPLETE');
console.log('workbench3d-bend-review-package.test.js passed');
