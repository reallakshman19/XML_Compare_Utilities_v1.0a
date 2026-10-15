/** Deterministic short-element MOVE_NODE proposals and effective policy overlay. */

import { topologyPolicyDecision } from './topology-checker-policy.js';
import { asArray, cleanText, deepFreeze, objectRecord, semanticHash } from './topology-validator-values.js';

const SHORT_CODES = new Set(['SHORT_ELEMENT', 'EXPECTED_SHORT_INLINE_COMPONENT']);
const INLINE_ROLE = /BEND|ELBOW|TEE|OLET|FLANGE|VALVE|REDUCER|GASK|COUPLING|CAP|BRANCH/;

/** Build effective suggestions for every current issue without mutating producer records. */
export function buildEffectiveTopologySuggestions(canonical, report, producerSuggestions, policy) {
  const byIssue = new Map(asArray(producerSuggestions).map((row) => [cleanText(row.issueId), row]));
  return deepFreeze(asArray(report?.issues).map((issue) => {
    const producer = byIssue.get(cleanText(issue.id)) ?? null;
    const decision = topologyPolicyDecision(issue, producer, policy);
    const base = SHORT_CODES.has(cleanText(issue.code)) && decision.fixMode === 'AUTO'
      ? buildShortElementMoveSuggestion(canonical, issue) : producerSuggestion(issue, producer);
    return applyDecision(issue, base, decision);
  }));
}

/** Evaluate both endpoints; unsafe local geometry yields an explicit unavailable Auto proposal. */
export function buildShortElementMoveSuggestion(canonical, issue) {
  const edgeId = cleanText(asArray(issue?.objectIds)[0]);
  const edge = asArray(canonical?.edges).find((row) => cleanText(row.id) === edgeId);
  const threshold = Number(objectRecord(issue?.details).thresholdMm), length = Number(objectRecord(issue?.details).lengthMm);
  if (!edge) return unavailable(issue, 'EDGE_NOT_FOUND', `Canonical edge ${edgeId} was not found.`);
  const nodes = new Map(asArray(canonical?.nodes).map((row) => [cleanText(row.id), row]));
  const from = nodes.get(cleanText(edge.fromNodeId)), to = nodes.get(cleanText(edge.toNodeId));
  if (!from || !to) return unavailable(issue, 'ENDPOINT_MISSING', `Edge ${edgeId} has a missing endpoint.`);
  if (!Number.isFinite(threshold) || !Number.isFinite(length) || length <= 0 || length >= threshold) {
    return unavailable(issue, 'INVALID_SHORT_LENGTH', `Short-element evidence is invalid for ${edgeId}.`);
  }
  const context = { canonical, edge, issue, nodes, threshold, tolerance: Number(canonical?.toleranceMm ?? 0.1) };
  const candidates = [endpointCandidate(context, 'FROM'), endpointCandidate(context, 'TO')].filter(Boolean).sort(compareCandidates);
  const chosen = candidates[0];
  if (!chosen) return unavailable(issue, 'NO_SAFE_STRETCH_ENDPOINT', 'Neither endpoint has a non-regressing PIPE/FLANGE/VALVE/GASK neighbour.');
  const operation = Object.freeze({ type: 'MOVE_NODE', payload: Object.freeze({ nodeId: chosen.nodeId,
    position: chosen.position, fromPosition: chosen.fromPosition }) });
  return suggestion(issue, {
    title: 'Stretch short element to threshold',
    rationale: `Moves ${chosen.nodeId} outward by ${chosen.deficit.toFixed(3)} mm; adjacent ${chosen.neighbourRole} absorbs the delta without a local length regression.`,
    operations: [operation], risk: 'LOW', preconditions: ['FINITE_AXIS', 'STRETCHABLE_NEIGHBOUR', 'NO_LOCAL_LENGTH_REGRESSION'],
    preview: { kind: 'MOVE_NODE', nodeId: chosen.nodeId, from: chosen.fromPosition, to: chosen.position },
    executionState: 'READY', failureReason: '',
  });
}

function endpointCandidate(context, endpoint) {
  const movingId = cleanText(endpoint === 'FROM' ? context.edge.fromNodeId : context.edge.toNodeId);
  const fixedId = cleanText(endpoint === 'FROM' ? context.edge.toNodeId : context.edge.fromNodeId);
  const moving = context.nodes.get(movingId), fixed = context.nodes.get(fixedId);
  const movingPoint = point(moving?.position), fixedPoint = point(fixed?.position), axis = unit(subtract(movingPoint, fixedPoint));
  if (!axis) return null;
  const neighbours = asArray(context.canonical.edges).filter((row) => cleanText(row.id) !== cleanText(context.edge.id)
    && [cleanText(row.fromNodeId), cleanText(row.toNodeId)].includes(movingId));
  const ranked = neighbours.map((row) => ({ row, priority: stretchPriority(edgeRole(row)) })).filter((row) => Number.isFinite(row.priority));
  if (!ranked.length) return null;
  const deficit = context.threshold - Number(objectRecord(context.issue.details).lengthMm);
  const numericMargin = Math.max(1e-6, context.tolerance * 1e-5);
  const next = add(fixedPoint, scale(axis, context.threshold + numericMargin));
  const regression = neighbours.some((row) => neighbourRegresses(row, movingId, next, context));
  if (regression || !next.every(Number.isFinite)) return null;
  ranked.sort((left, right) => left.priority - right.priority || cleanText(left.row.id).localeCompare(cleanText(right.row.id)));
  const residual = Math.min(...neighbours.map((row) => movedEdgeLength(row, movingId, next, context.nodes)));
  return Object.freeze({ nodeId: movingId, fromPosition: xyz(movingPoint), position: xyz(next), deficit,
    priority: ranked[0].priority, neighbourRole: edgeRole(ranked[0].row) || 'PIPE', residual });
}

function neighbourRegresses(edge, movingId, next, context) {
  const oldLength = movedEdgeLength(edge, '', null, context.nodes), newLength = movedEdgeLength(edge, movingId, next, context.nodes);
  if (!Number.isFinite(newLength) || newLength <= context.tolerance) return true;
  if (oldLength >= context.threshold && newLength < context.threshold) return true;
  return oldLength < context.threshold && newLength + context.tolerance < oldLength;
}

function movedEdgeLength(edge, movingId, next, nodes) {
  const from = cleanText(edge.fromNodeId) === movingId ? next : point(nodes.get(cleanText(edge.fromNodeId))?.position);
  const to = cleanText(edge.toNodeId) === movingId ? next : point(nodes.get(cleanText(edge.toNodeId))?.position);
  return distance(from, to);
}

function applyDecision(issue, base, decision) {
  const operations = decision.fixMode === 'AUTO_SUPPRESS' ? [] : asArray(base.operations);
  const available = operations.length > 0;
  const fixability = decision.fixMode === 'AUTO' ? 'AUTO_APPROVED'
    : decision.fixMode === 'CONFIRM' ? 'NEEDS_CONFIRMATION' : 'MANUAL_ENGINEERING';
  return deepFreeze({ ...base, issueId: issue.id, fixability, effectiveFixMode: decision.fixMode,
    policyRuleId: decision.ruleId, operation: decision.operation,
    approvedByDefault: decision.fixMode === 'AUTO' && available,
    executionState: decision.fixMode === 'AUTO_SUPPRESS' ? 'REVIEW_ONLY' : available ? cleanText(base.executionState) || 'READY' : 'UNAVAILABLE' });
}

function producerSuggestion(issue, producer) {
  if (producer) return { ...producer, executionState: asArray(producer.operations).length ? 'READY' : 'UNAVAILABLE' };
  return suggestion(issue, { title: 'Manual engineering review', rationale: 'No deterministic producer operation is available.',
    operations: [], risk: 'MEDIUM', preconditions: [], preview: {}, executionState: 'UNAVAILABLE', failureReason: 'NO_PRODUCER_SUGGESTION' });
}

function unavailable(issue, code, message) {
  return suggestion(issue, { title: 'Auto fix unavailable', rationale: message, operations: [], risk: 'MEDIUM',
    preconditions: [], preview: { kind: 'MOVE_NODE' }, executionState: 'UNAVAILABLE', failureReason: code });
}

function suggestion(issue, input) {
  const operations = Object.freeze(asArray(input.operations));
  return deepFreeze({ schema: 'TopologyFixSuggestion.v1', id: `TS-${semanticHash({ issueId: issue.id, operations, title: input.title }).split(':')[1]}`,
    issueId: issue.id, title: input.title, rationale: input.rationale, confidence: issue.confidence, risk: input.risk,
    fixability: operations.length ? 'AUTO_APPROVED' : 'MANUAL_ENGINEERING', approvedByDefault: operations.length > 0,
    operations, preconditions: input.preconditions, affectedObjectIds: asArray(issue.objectIds), preview: input.preview,
    executionState: input.executionState, failureReason: input.failureReason });
}

function edgeRole(edge) { return cleanText(edge?.segmentRole ?? edge?.topologyOperation ?? asArray(edge?.sourceTypes)[0]).toUpperCase(); }
function stretchPriority(role) { if (role === 'PIPE' || !INLINE_ROLE.test(role)) return 1; if (role === 'FLANGE') return 2; if (role === 'VALVE') return 3; if (role === 'GASK') return 4; return Infinity; }
function compareCandidates(left, right) { return left.priority - right.priority || right.residual - left.residual || left.nodeId.localeCompare(right.nodeId); }
function point(value) { const row = objectRecord(value); return [Number(row.x), Number(row.y), Number(row.z)]; }
function xyz(value) { return Object.freeze({ x: value[0], y: value[1], z: value[2] }); }
function subtract(left, right) { return left.map((value, index) => value - right[index]); }
function add(left, right) { return left.map((value, index) => value + right[index]); }
function scale(value, factor) { return value.map((part) => part * factor); }
function distance(left, right) { return Math.hypot(...subtract(left, right)); }
function unit(value) { const length = Math.hypot(...value); return Number.isFinite(length) && length > 0 ? scale(value, 1 / length) : null; }

export const _test = Object.freeze({ endpointCandidate, neighbourRegresses, movedEdgeLength, edgeRole, stretchPriority, compareCandidates });
