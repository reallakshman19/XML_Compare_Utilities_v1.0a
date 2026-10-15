import assert from 'node:assert/strict';
import {
  PIPELINE_CAD_ANNOTATION_MAX_LENGTH,
  createPipelineCadAnnotation,
  createPipelineCadDimension,
  createPipelineCadMarkupDocument,
  parsePipelineCadMarkupDocument,
  serializePipelineCadMarkupDocument,
  validatePipelineCadMarkupDocument,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-cad-markup-contracts.js';

const entity = (graph, entityId, entityType) => ({ kind: 'ENTITY', graph, entityId, entityType, pointRole: 'CENTER' });
const point = (graph, x, y) => ({ kind: 'GRAPH_POINT', graph, x, y });
const dimension = createPipelineCadDimension({
  dimensionId: 'pcad-dim-000002', graph: 'table2x', dimensionType: 'LINEAR_HORIZONTAL',
  firstAnchor: entity('table2x', 'table2a-0001', 'elevation-node'),
  secondAnchor: entity('table2x', 'table2a-0002', 'elevation-node'),
  offset: 1, labelMode: 'MEASURED', measurementAuthority: 'ENGINEERING_PROFILE',
  status: 'ACTIVE', createdSequence: 2, revision: 1,
});
const annotation = createPipelineCadAnnotation({
  annotationId: 'pcad-note-000001', graph: 'table3x',
  anchor: point('table3x', 10, 0.75), text: 'Review marker location',
  alignment: 'LEFT', leader: { enabled: true, dx: 2, dy: 1 },
  status: 'ACTIVE', createdSequence: 1, revision: 1,
});
const document = createPipelineCadMarkupDocument({
  sourceFingerprint: 'pcad-src-a1', nextSequence: 3,
  dimensions: [dimension], annotations: [annotation],
});
assert.equal(document.schema, 'PipelineCadMarkupDocument.v1');
assert.ok(Object.isFrozen(document) && Object.isFrozen(document.dimensions));
assert.ok(Object.isFrozen(document.dimensions[0].firstAnchor));
assert.equal(document.dimensions[0].measurementAuthority, 'ENGINEERING_PROFILE');
assert.equal(createPipelineCadDimension({
  ...dimension, dimensionId: 'pcad-dim-000003', createdSequence: 3,
  firstAnchor: point('table2x', 0, 0), measurementAuthority: 'PRESENTATION_ONLY',
}).measurementAuthority, 'PRESENTATION_ONLY');
assert.equal(createPipelineCadDimension({
  ...dimension, dimensionId: 'pcad-dim-000004', createdSequence: 4, graph: 'table3x',
  firstAnchor: entity('table3x', 'table3c-0001', 'marker'),
  secondAnchor: entity('table3x', 'table3c-0002', 'marker'),
  measurementAuthority: 'REVIEW_EVIDENCE',
}).measurementAuthority, 'REVIEW_EVIDENCE');

const serialized = serializePipelineCadMarkupDocument(document);
assert.equal(serializePipelineCadMarkupDocument(parsePipelineCadMarkupDocument(serialized)), serialized);
const shuffled = createPipelineCadMarkupDocument({
  ...document, dimensions: [...document.dimensions].reverse(), annotations: [...document.annotations].reverse(),
});
assert.equal(serializePipelineCadMarkupDocument(shuffled), serialized);
assert.throws(() => validatePipelineCadMarkupDocument({
  ...document, dimensions: [dimension, dimension],
}), /Duplicate markup ID/);
assert.throws(() => validatePipelineCadMarkupDocument({ ...document, nextSequence: 2 }), /nextSequence/);
assert.throws(() => createPipelineCadDimension({
  ...dimension, secondAnchor: entity('table3x', 'table3c-0001', 'marker'),
}), /anchors must match graph/);
assert.throws(() => createPipelineCadDimension({
  ...dimension, offset: Number.POSITIVE_INFINITY,
}), /finite/);
assert.throws(() => createPipelineCadDimension({ ...dimension, measuredValue: 10 }), /not authorized/);
assert.throws(() => createPipelineCadAnnotation({
  ...annotation, text: '   ',
}), /required/);
assert.throws(() => createPipelineCadAnnotation({
  ...annotation, text: '<script>alert(1)</script>',
}), /scriptable/);
assert.throws(() => createPipelineCadAnnotation({
  ...annotation, text: 'x'.repeat(PIPELINE_CAD_ANNOTATION_MAX_LENGTH + 1),
}), /exceeds/);
assert.throws(() => createPipelineCadMarkupDocument({
  sourceFingerprint: 'x', nextSequence: 2, dimensions: [dimension], annotations: [],
}), /createdSequence|nextSequence/);
console.log('Pipeline CAD markup contracts: ok');
