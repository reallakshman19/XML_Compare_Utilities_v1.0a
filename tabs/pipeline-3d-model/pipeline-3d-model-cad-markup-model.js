import {
  createPipelineCadAnnotation,
  createPipelineCadDimension,
  createPipelineCadMarkupDocument,
  validatePipelineCadMarkupDocument,
} from './pipeline-3d-model-cad-markup-contracts.js';

function idFor(kind, sequence) {
  return `${kind === 'dimension' ? 'pcad-dim' : 'pcad-note'}-${String(sequence).padStart(6, '0')}`;
}
function nextDocument(document, patch) {
  return createPipelineCadMarkupDocument({ ...document, revision: document.revision + 1, ...patch });
}
function withoutIdentity(patch = {}) {
  const { dimensionId, annotationId, createdSequence, revision, schema, graph, status, measurementAuthority, ...safe } = patch;
  return safe;
}

export class PipelineCadMarkupModel extends EventTarget {
  constructor(document) { super(); this.document = validatePipelineCadMarkupDocument(document); }
  getDocument() { return this.document; }
  snapshot() { return this.document; }
  restore(snapshot, reason = 'restore') { this.#set(validatePipelineCadMarkupDocument(snapshot), reason); }
  replaceDocument(document, reason = 'replace-document') {
    this.#set(validatePipelineCadMarkupDocument(document), reason); return this.document;
  }

  createDimension(payload) {
    const sequence = this.document.nextSequence;
    const dimension = createPipelineCadDimension({
      ...payload, dimensionId: idFor('dimension', sequence),
      createdSequence: sequence, revision: 1, status: payload.status || 'ACTIVE',
    });
    this.#set(nextDocument(this.document, {
      nextSequence: sequence + 1, dimensions: [...this.document.dimensions, dimension],
    }), 'create-dimension');
    return dimension;
  }
  updateDimension(id, patch) {
    const current = this.document.dimensions.find((record) => record.dimensionId === id);
    if (!current) throw new Error(`Unknown dimension: ${id}`);
    const updated = createPipelineCadDimension({
      ...current, ...withoutIdentity(patch), dimensionId: id, graph: current.graph,
      createdSequence: current.createdSequence, revision: current.revision + 1,
    });
    this.#set(nextDocument(this.document, {
      dimensions: this.document.dimensions.map((record) => record.dimensionId === id ? updated : record),
    }), 'update-dimension');
    return updated;
  }
  deleteDimension(id) {
    if (!this.document.dimensions.some((record) => record.dimensionId === id)) {
      throw new Error(`Unknown dimension: ${id}`);
    }
    this.#set(nextDocument(this.document, {
      dimensions: this.document.dimensions.filter((record) => record.dimensionId !== id),
    }), 'delete-dimension');
    return true;
  }
  createAnnotation(payload) {
    const sequence = this.document.nextSequence;
    const annotation = createPipelineCadAnnotation({
      ...payload, annotationId: idFor('annotation', sequence),
      createdSequence: sequence, revision: 1, status: payload.status || 'ACTIVE',
    });
    this.#set(nextDocument(this.document, {
      nextSequence: sequence + 1, annotations: [...this.document.annotations, annotation],
    }), 'create-annotation');
    return annotation;
  }
  updateAnnotation(id, patch) {
    const current = this.document.annotations.find((record) => record.annotationId === id);
    if (!current) throw new Error(`Unknown annotation: ${id}`);
    const updated = createPipelineCadAnnotation({
      ...current, ...withoutIdentity(patch), annotationId: id, graph: current.graph,
      createdSequence: current.createdSequence, revision: current.revision + 1,
    });
    this.#set(nextDocument(this.document, {
      annotations: this.document.annotations.map((record) => record.annotationId === id ? updated : record),
    }), 'update-annotation');
    return updated;
  }
  deleteAnnotation(id) {
    if (!this.document.annotations.some((record) => record.annotationId === id)) {
      throw new Error(`Unknown annotation: ${id}`);
    }
    this.#set(nextDocument(this.document, {
      annotations: this.document.annotations.filter((record) => record.annotationId !== id),
    }), 'delete-annotation');
    return true;
  }
  #set(document, reason) {
    this.document = validatePipelineCadMarkupDocument(document);
    this.dispatchEvent(new CustomEvent('documentChanged', {
      detail: { reason, revision: this.document.revision },
    }));
  }
}

export function createPipelineCadMarkupModel(document) { return new PipelineCadMarkupModel(document); }
export const _markupModelTest = Object.freeze({ idFor, withoutIdentity });
