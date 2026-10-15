export const SUPPORT_REVISION_PAIR_VALIDATION_SCHEMA = 'support-revision-pair-validation/v1';

const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase();

/** Validate revision-pair compatibility from generated categorized graphs, not row matching. */
export function validateSupportRevisionPair(rev1, rev2, options = {}) {
  const source = graphIdentitySummary(rev1?.graph);
  const target = graphIdentitySummary(rev2?.graph);
  const diagnostics = [orderingDiagnostic(rev1, rev2, options)];
  diagnostics.push(...compatibilityDiagnostics('area', source.areas, target.areas));
  diagnostics.push(...compatibilityDiagnostics('scope', source.scopes, target.scopes));
  return Object.freeze({
    schema: SUPPORT_REVISION_PAIR_VALIDATION_SCHEMA,
    ok: !diagnostics.some((item) => item.severity === 'BLOCKER' && item.status !== 'PASS'),
    orderingBasis: 'explicit-input-role',
    source,
    target,
    diagnostics: Object.freeze(diagnostics),
  });
}

export function graphIdentitySummary(graph = {}) {
  const pipeNodes = (graph.nodes || []).filter((node) => node.levelId === 'pipe');
  const locationNodes = (graph.nodes || []).filter((node) => node.levelId === 'supportLocation');
  return Object.freeze({
    areas: unique(pipeNodes.map((node) => node.fields?.area)),
    scopes: unique(locationNodes.map((node) => node.fields?.scope || '').concat(pipeNodes.map((node) => node.fields?.pipeScope || ''))),
  });
}

function orderingDiagnostic(rev1, rev2, options) {
  if (options?.revisionOrderExplicit === false) {
    const inferred = inferOrdering(rev1?.inferredRevision, rev2?.inferredRevision);
    if (!inferred.ok) return diagnostic('BLOCKER', 'support_revision_order_unproven', inferred.message, inferred.details);
    return diagnostic('INFO', 'support_revision_order_inferred', inferred.message, inferred.details, 'PASS');
  }
  return diagnostic('INFO', 'support_revision_order_explicit', 'Revision 1 is explicitly the earlier/source input and Revision 2 is explicitly the later/target input.', {
    sourceRevision: clean(rev1?.revision || '1'),
    targetRevision: clean(rev2?.revision || '2'),
  }, 'PASS');
}

function inferOrdering(sourceRevision, targetRevision) {
  const source = clean(sourceRevision?.value);
  const target = clean(targetRevision?.value);
  if (!sourceRevision?.deterministic || !targetRevision?.deterministic || !source || !target) {
    return { ok: false, message: 'Revision ordering is not explicit and cannot be deterministically inferred from REVISION values.', details: { sourceValues: sourceRevision?.values || [], targetValues: targetRevision?.values || [] } };
  }
  const sourceNumber = Number(source), targetNumber = Number(target);
  if (Number.isFinite(sourceNumber) && Number.isFinite(targetNumber) && sourceNumber >= targetNumber) {
    return { ok: false, message: `Expected earlier revision before later revision; received ${source} then ${target}.`, details: { sourceRevision: source, targetRevision: target } };
  }
  if (!Number.isFinite(sourceNumber) && !Number.isFinite(targetNumber) && source === target) {
    return { ok: false, message: `Source and target REVISION values are identical (${source}); ordering is not proven.`, details: { sourceRevision: source, targetRevision: target } };
  }
  return { ok: true, message: `Revision ordering inferred from REVISION values ${source} -> ${target}.`, details: { sourceRevision: source, targetRevision: target } };
}

function compatibilityDiagnostics(kind, sourceValues, targetValues) {
  if (!sourceValues.length || !targetValues.length) {
    return [diagnostic('WARNING', `support_revision_${kind}_compatibility_unproven`, `Could not prove ${kind} compatibility from both categorized graphs.`, { sourceValues, targetValues })];
  }
  const overlap = sourceValues.filter((value) => targetValues.includes(value));
  if (!overlap.length) {
    return [diagnostic('BLOCKER', `support_revision_${kind}_incompatible`, `Revision inputs have disjoint ${kind} identities and are not a credible same-area pair.`, { sourceValues, targetValues, overlap })];
  }
  return [diagnostic('INFO', `support_revision_${kind}_compatible`, `Revision inputs share categorized ${kind} identity.`, { sourceValues, targetValues, overlap }, 'PASS')];
}

function unique(values) {
  return Object.freeze([...new Set(values.map(upper).filter(Boolean))].sort());
}

function diagnostic(severity, code, message, details, status = severity === 'BLOCKER' ? 'FAIL' : 'INFO') {
  return Object.freeze({ gate: 'support_revision_pair_compatibility', severity, status, code, message, details: Object.freeze({ ...details }) });
}

export const _test = Object.freeze({ inferOrdering, compatibilityDiagnostics, unique });
