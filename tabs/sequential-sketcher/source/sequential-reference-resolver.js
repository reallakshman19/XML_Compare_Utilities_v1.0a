import { normalizeSequentialReference } from './sequential-reference-normalization.js';

function text(value) { return String(value ?? '').trim(); }

const NORMALIZED_INDEX_CACHE = new WeakMap();

export const REFERENCE_TARGET_KINDS = Object.freeze({
  BRANCH: 'BRANCH',
  JUNCTION_COMPONENT: 'JUNCTION_COMPONENT',
  INLINE_COMPONENT: 'INLINE_COMPONENT',
  AMBIGUOUS: 'AMBIGUOUS',
  MISSING: 'MISSING',
});

function componentKind(component) {
  return component.canonicalType === 'TEE' || component.canonicalType === 'OLET'
    ? REFERENCE_TARGET_KINDS.JUNCTION_COMPONENT
    : REFERENCE_TARGET_KINDS.INLINE_COMPONENT;
}

function componentRow(component, rawReference) {
  return {
    id: `COMPONENT:${component.componentId}`,
    rawReference,
    kind: componentKind(component),
    branch: null,
    component,
  };
}

function branchRow(branch, rawReference) {
  return {
    id: `BRANCH:${branch.branchId}`,
    rawReference,
    kind: REFERENCE_TARGET_KINDS.BRANCH,
    branch,
    component: null,
  };
}

function componentTarget(component, reference, normalized, resolutionBasis = 'EXACT_COMPONENT_ALIAS') {
  const junction = componentKind(component) === REFERENCE_TARGET_KINDS.JUNCTION_COMPONENT;
  return Object.freeze({
    status: 'RESOLVED',
    reference,
    rawReference: normalized.rawReference,
    normalizedReference: normalized.normalizedReference,
    normalizationOperations: normalized.operations,
    resolutionBasis,
    kind: junction ? REFERENCE_TARGET_KINDS.JUNCTION_COMPONENT : REFERENCE_TARGET_KINDS.INLINE_COMPONENT,
    targetBranchId: component.branchId,
    targetComponentId: component.componentId,
    targetSourceComponentId: component.sourceComponentId,
    targetPortRoles: Object.freeze(junction ? ['BRANCH_OUT'] : component.ports.map((port) => port.role)),
  });
}

function addMulti(map, normalizedReference, value) {
  if (!normalizedReference) return;
  const rows = map.get(normalizedReference) || [];
  if (!rows.some((row) => row.id === value.id)) rows.push(value);
  map.set(normalizedReference, rows);
}

function normalizedIndexes(indexes) {
  const cached = NORMALIZED_INDEX_CACHE.get(indexes);
  if (cached) return cached;
  const targets = new Map();
  for (const [rawReference, branch] of indexes.branches) {
    const normalized = normalizeSequentialReference(rawReference);
    addMulti(targets, normalized.normalizedReference, branchRow(branch, rawReference));
  }
  for (const [rawReference, components] of indexes.componentReferences || []) {
    const normalized = normalizeSequentialReference(rawReference);
    for (const component of components) {
      addMulti(targets, normalized.normalizedReference, componentRow(component, rawReference));
    }
  }
  const audit = Object.freeze([...targets.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([normalizedReference, rows]) => Object.freeze({
      normalizedReference,
      targetCount: rows.length,
      rawReferences: Object.freeze([...new Set(rows.map((row) => row.rawReference))].sort()),
      targetIds: Object.freeze(rows.map((row) => row.id).sort()),
    })));
  const result = Object.freeze({ targets, collisions: audit });
  NORMALIZED_INDEX_CACHE.set(indexes, result);
  return result;
}

function branchTarget(branch, reference, normalized, resolutionBasis = 'EXACT_BRANCH_ID') {
  return Object.freeze({
    status: 'RESOLVED',
    reference,
    rawReference: normalized.rawReference,
    normalizedReference: normalized.normalizedReference,
    normalizationOperations: normalized.operations,
    resolutionBasis,
    kind: REFERENCE_TARGET_KINDS.BRANCH,
    targetBranchId: branch.branchId,
    targetComponentId: null,
    targetSourceComponentId: null,
    targetPortRoles: Object.freeze([]),
  });
}

function ambiguous(reference, normalized, rows, resolutionBasis) {
  return Object.freeze({
    status: 'AMBIGUOUS',
    kind: REFERENCE_TARGET_KINDS.AMBIGUOUS,
    reference,
    rawReference: normalized.rawReference,
    normalizedReference: normalized.normalizedReference,
    normalizationOperations: normalized.operations,
    resolutionBasis,
    matches: Object.freeze(rows.map((row) => Object.freeze({
      targetBranchId: row.branch?.branchId || row.component?.branchId || null,
      targetComponentId: row.component?.componentId || null,
      targetSourceComponentId: row.component?.sourceComponentId || null,
      canonicalType: row.component?.canonicalType || null,
      kind: row.kind,
      matchedRawReference: row.rawReference,
    }))),
  });
}

export function referenceNormalizationAudit(indexes) {
  return normalizedIndexes(indexes).collisions;
}

export function resolveSequentialReference(referenceValue, indexes) {
  const reference = text(referenceValue);
  const normalized = normalizeSequentialReference(reference);
  if (!reference) return Object.freeze({
    status: 'MISSING',
    kind: REFERENCE_TARGET_KINDS.MISSING,
    reference,
    rawReference: normalized.rawReference,
    normalizedReference: normalized.normalizedReference,
    normalizationOperations: normalized.operations,
    resolutionBasis: 'EMPTY_REFERENCE',
  });

  const branch = indexes.branches.get(reference);
  const components = indexes.componentReferences?.get(reference) || [];
  if (branch && components.length) {
    return ambiguous(reference, normalized, [
      branchRow(branch, reference),
      ...components.map((component) => componentRow(component, reference)),
    ], 'EXACT_BRANCH_COMPONENT_COLLISION');
  }
  if (branch) return branchTarget(branch, reference, normalized);
  if (components.length === 1) return componentTarget(components[0], reference, normalized);
  if (components.length > 1) {
    return ambiguous(
      reference,
      normalized,
      components.map((component) => componentRow(component, reference)),
      'EXACT_ALIAS_COLLISION',
    );
  }

  const normalizedRows = normalizedIndexes(indexes).targets.get(normalized.normalizedReference) || [];
  if (normalizedRows.length === 1) {
    const target = normalizedRows[0];
    return target.branch
      ? branchTarget(target.branch, reference, normalized, 'UNIQUE_NORMALIZED_BRANCH_ID')
      : componentTarget(target.component, reference, normalized, 'UNIQUE_NORMALIZED_COMPONENT_ALIAS');
  }
  if (normalizedRows.length > 1) {
    return ambiguous(reference, normalized, normalizedRows, 'NORMALIZATION_COLLISION');
  }

  return Object.freeze({
    status: 'MISSING',
    kind: REFERENCE_TARGET_KINDS.MISSING,
    reference,
    rawReference: normalized.rawReference,
    normalizedReference: normalized.normalizedReference,
    normalizationOperations: normalized.operations,
    resolutionBasis: 'NO_EXACT_OR_NORMALIZED_TARGET',
  });
}
