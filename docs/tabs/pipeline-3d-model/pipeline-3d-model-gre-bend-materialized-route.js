import {
  createPipelineGreBendComponent,
  createPipelineGreBendMaterializedElement,
  createPipelineGreBendMaterializedNode,
} from './pipeline-3d-model-gre-bend-materialization-contracts.js';

export const PIPELINE_GRE_BEND_MATERIALIZATION_EPSILON_MM = 1e-6;
const POINT_DECIMALS = 12;
const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const normalize = (value) => { const result = Number(value.toFixed(POINT_DECIMALS)); return Object.is(result, -0) ? 0 : result; };
export const pipelineGreMaterializationDistance = (a, b) => Math.hypot(
  Number(b.x) - Number(a.x), Number(b.y) - Number(a.y), Number(b.z) - Number(a.z));
export const isFinitePipelineGrePoint = (value) => Boolean(value && typeof value === 'object'
  && finite(value.x) && finite(value.y) && finite(value.z));
export function findPipelineGreSectionOwner(sections, elementIndex) {
  let owner = null;
  [...(sections || [])].sort((a, b) => a.startElementIndex - b.startElementIndex).forEach((section) => {
    if (Number.isInteger(section.startElementIndex) && section.startElementIndex <= elementIndex) owner = section;
  });
  return owner;
}
function normalizedPoint(value) {
  return { x: normalize(Number(value.x)), y: normalize(Number(value.y)), z: normalize(Number(value.z)) };
}
export function buildPipelineGreOriginalMaterializedNodes({ rows, sections, contexts, addError }) {
  const corners = new Map(contexts.map((context) => [context.candidate.cornerNode, context]));
  return rows.map((row, rowIndex) => {
    if (!isFinitePipelineGrePoint(row) || !Number.isSafeInteger(row.nodeNumber)) addError(
      'PIPELINE_GRE_BEND_MATERIALIZATION_INPUT_INVALID',
      'Canonical geometry rows require finite coordinates and node numbers.', { rowIndex });
    const context = corners.get(row.nodeNumber), sourceIndexes = [rowIndex - 1, rowIndex]
      .filter((index) => index >= 0 && index < rows.length - 1);
    const owner = context?.owner || findPipelineGreSectionOwner(sections, Math.min(rowIndex, rows.length - 2));
    return createPipelineGreBendMaterializedNode({ materializedNodeId: `route-node:${row.nodeNumber}`,
      nodeNumber: row.nodeNumber, nodeRole: context ? 'INACTIVE_CORNER_REFERENCE' : 'ORIGINAL_ROUTE_NODE',
      coordinates: { x: row.x, y: row.y, z: row.z }, analysisSectionId: owner?.analysisSectionId || '',
      candidateId: context?.candidate.candidateId || '', sourceNodeNumber: row.nodeNumber,
      sourceElementIndexes: Object.freeze(sourceIndexes), sourceRow: row,
      sourceAuthority: 'PIPELINE_BEND_RESOLUTION_GEOMETRY_ROWS', sourceReference: `geometryRows[${rowIndex}]`,
      inserted: false, active: !context });
  });
}
export function buildPipelineGreInsertedMaterializedNodes(contexts) {
  const fields = { GRE_INCOMING_BREAK: 'incomingBreakPoint', GRE_INCOMING_TANGENCY: 'incomingTangencyPoint',
    GRE_OUTGOING_TANGENCY: 'outgoingTangencyPoint', GRE_OUTGOING_BREAK: 'outgoingBreakPoint' };
  return contexts.flatMap((context) => Object.entries(fields).map(([role, field]) => {
    const allocation = context.allocations[role], incoming = role.startsWith('GRE_INCOMING');
    return createPipelineGreBendMaterializedNode({ materializedNodeId: allocation.materializedNodeId,
      nodeNumber: allocation.nodeNumber, nodeRole: role, coordinates: normalizedPoint(context.candidate[field]),
      analysisSectionId: context.candidate.analysisSectionId, candidateId: context.candidate.candidateId,
      sourceNodeNumber: null, sourceElementIndexes: Object.freeze([incoming
        ? context.candidate.incomingElementIndex : context.candidate.outgoingElementIndex]),
      sourceAuthority: context.candidate.sourceAuthority, sourceReference: context.candidate.sourceReference,
      inserted: true, active: true });
  }));
}
function cutsBySegment(contexts) {
  const result = Object.create(null), add = (index, item) => { (result[index] ||= []).push(item); };
  for (const context of contexts) {
    const c = context.candidate, a = context.allocations;
    add(c.incomingElementIndex, { nodeId: a.GRE_INCOMING_BREAK.materializedNodeId,
      position: context.incomingLength - c.incomingBreakDistanceFromCornerMm,
      role: 'GRE_INCOMING_BREAK', candidateId: c.candidateId, context });
    add(c.incomingElementIndex, { nodeId: a.GRE_INCOMING_TANGENCY.materializedNodeId,
      position: context.incomingLength - c.tangentLengthMm,
      role: 'GRE_INCOMING_TANGENCY', candidateId: c.candidateId, context });
    add(c.outgoingElementIndex, { nodeId: a.GRE_OUTGOING_TANGENCY.materializedNodeId,
      position: c.tangentLengthMm, role: 'GRE_OUTGOING_TANGENCY', candidateId: c.candidateId, context });
    add(c.outgoingElementIndex, { nodeId: a.GRE_OUTGOING_BREAK.materializedNodeId,
      position: c.outgoingBreakDistanceFromCornerMm,
      role: 'GRE_OUTGOING_BREAK', candidateId: c.candidateId, context });
  }
  return result;
}
const roleRank = { ORIGINAL_ROUTE_NODE: 0, GRE_OUTGOING_TANGENCY: 10, GRE_OUTGOING_BREAK: 20,
  GRE_INCOMING_BREAK: 30, GRE_INCOMING_TANGENCY: 40 };
function intervalKind(left, right, length) {
  if (left.candidateId && right.candidateId && left.candidateId !== right.candidateId
    && left.role === 'GRE_OUTGOING_BREAK' && right.role === 'GRE_INCOMING_BREAK'
    && length <= PIPELINE_GRE_BEND_MATERIALIZATION_EPSILON_MM) return {
    kind: 'SPLIT_STRAIGHT', disposition: 'COINCIDENT_ENVELOPE_CONTACT' };
  if (left.candidateId && left.candidateId === right.candidateId
    && left.role === 'GRE_INCOMING_BREAK' && right.role === 'GRE_INCOMING_TANGENCY') return {
    kind: 'GRE_INCOMING_TRANSITION', disposition: length <= PIPELINE_GRE_BEND_MATERIALIZATION_EPSILON_MM
      ? 'COINCIDENT_ZERO_LENGTH_AUTHORIZED' : 'SPLIT_BY_INCOMING_TANGENCY' };
  if (left.candidateId && left.candidateId === right.candidateId
    && left.role === 'GRE_OUTGOING_TANGENCY' && right.role === 'GRE_OUTGOING_BREAK') return {
    kind: 'GRE_OUTGOING_TRANSITION', disposition: length <= PIPELINE_GRE_BEND_MATERIALIZATION_EPSILON_MM
      ? 'COINCIDENT_ZERO_LENGTH_AUTHORIZED' : 'SPLIT_BY_OUTGOING_TANGENCY' };
  const affected = left.role !== 'ORIGINAL_ROUTE_NODE' || right.role !== 'ORIGINAL_ROUTE_NODE';
  const disposition = right.role === 'GRE_INCOMING_BREAK' ? 'SPLIT_BY_INCOMING_BREAK'
    : left.role === 'GRE_OUTGOING_BREAK' ? 'SPLIT_BY_OUTGOING_BREAK'
      : affected ? 'SPLIT_BY_INCOMING_TANGENCY' : 'UNCHANGED';
  return { kind: affected ? 'SPLIT_STRAIGHT' : 'UNCHANGED_STRAIGHT', disposition };
}
function segmentElements(rows, sections, contexts, nodeIndex) {
  const cuts = cutsBySegment(contexts), result = [];
  for (let index = 0; index < rows.length - 1; index += 1) {
    const length = pipelineGreMaterializationDistance(rows[index], rows[index + 1]), points = [];
    const start = nodeIndex[`route-node:${rows[index].nodeNumber}`];
    const end = nodeIndex[`route-node:${rows[index + 1].nodeNumber}`];
    if (start?.active) points.push({ nodeId: start.materializedNodeId, position: 0,
      role: 'ORIGINAL_ROUTE_NODE', candidateId: '' });
    points.push(...(cuts[index] || []));
    if (end?.active) points.push({ nodeId: end.materializedNodeId, position: length,
      role: 'ORIGINAL_ROUTE_NODE', candidateId: '' });
    points.sort((a, b) => a.position - b.position || (roleRank[a.role] || 99) - (roleRank[b.role] || 99)
      || compare(a.candidateId, b.candidateId));
    for (let part = 0; part < points.length - 1; part += 1) {
      const left = points[part], right = points[part + 1], span = Math.max(0, right.position - left.position);
      const resolved = intervalKind(left, right, span);
      const candidateId = left.candidateId === right.candidateId ? left.candidateId
        : (!left.candidateId ? right.candidateId : !right.candidateId ? left.candidateId : '');
      const context = candidateId ? (left.context || right.context) : null;
      const local = resolved.kind.includes('TRANSITION') ? context?.candidate.bendLocalThicknessMm ?? null : null;
      result.push(createPipelineGreBendMaterializedElement({
        materializedElementId: `gre-element:E${index + 1}:${part + 1}`, elementKind: resolved.kind,
        fromMaterializedNodeId: left.nodeId, toMaterializedNodeId: right.nodeId,
        analysisSectionId: findPipelineGreSectionOwner(sections, index)?.analysisSectionId || '', candidateId,
        sourceElementIndexes: Object.freeze([index]), lineageDisposition: resolved.disposition,
        outsideDiameterMm: null, wallThicknessMm: null, localThicknessMm: local,
        vendorId: local !== null ? context?.candidate.vendorId || '' : '',
        seriesId: local !== null ? context?.candidate.seriesId || '' : '',
        requirementReference: local !== null ? context?.candidate.requirementReference || '' : '',
        sourceAuthority: context?.candidate.sourceAuthority || 'PIPELINE_BEND_RESOLUTION_GEOMETRY_ROWS',
        sourceReference: context?.candidate.sourceReference || `E${index + 1}`,
        lengthMm: normalize(span), orderIndex: 0 }));
    }
  }
  return result;
}
function bendEvidence(context) {
  const c = context.candidate, incoming = context.allocations.GRE_INCOMING_TANGENCY.materializedNodeId;
  const outgoing = context.allocations.GRE_OUTGOING_TANGENCY.materializedNodeId;
  const inactive = `route-node:${c.cornerNode}`, componentId = `gre-bend-component:${c.candidateId}`;
  const element = createPipelineGreBendMaterializedElement({ materializedElementId: `gre-bend:${c.candidateId}`,
    elementKind: 'GRE_BEND', fromMaterializedNodeId: incoming, toMaterializedNodeId: outgoing,
    analysisSectionId: c.analysisSectionId, candidateId: c.candidateId,
    sourceElementIndexes: Object.freeze([c.incomingElementIndex, c.outgoingElementIndex]),
    lineageDisposition: 'REPLACED_BY_GRE_BEND', outsideDiameterMm: null, wallThicknessMm: null,
    localThicknessMm: c.bendLocalThicknessMm, vendorId: c.vendorId, seriesId: c.seriesId,
    requirementReference: c.requirementReference, sourceAuthority: c.sourceAuthority,
    sourceReference: c.sourceReference,
    lengthMm: normalize(c.bendRadiusMm * c.turnAngleDeg * Math.PI / 180), orderIndex: 0 });
  const component = createPipelineGreBendComponent({ componentId, candidateId: c.candidateId,
    analysisSectionId: c.analysisSectionId, incomingTangencyNodeId: incoming,
    outgoingTangencyNodeId: outgoing, inactiveCornerReferenceId: inactive,
    bendRadiusMm: c.bendRadiusMm, turnAngleDeg: c.turnAngleDeg,
    bendBreakLengthApplication: c.bendBreakLengthApplication, localThicknessMm: c.bendLocalThicknessMm,
    vendorId: c.vendorId, seriesId: c.seriesId, qualificationEvidenceId: c.qualificationEvidenceId,
    requirementReference: c.requirementReference,
    sourceElementIndexes: Object.freeze([c.incomingElementIndex, c.outgoingElementIndex]),
    sourceAuthority: c.sourceAuthority, sourceReference: c.sourceReference,
    semanticArcOnly: true, sampledNodeIds: Object.freeze([]) });
  return { context, element, component, inactive, componentId };
}
function orderedElements(straights, bends) {
  const byIncoming = Object.fromEntries(bends.map((item) => [item.context.candidate.incomingElementIndex, item]));
  const grouped = Object.create(null), result = [];
  straights.forEach((item) => { const index = item.sourceElementIndexes[0]; (grouped[index] ||= []).push(item); });
  const sourceCount = Math.max(-1, ...straights.map((item) => item.sourceElementIndexes[0])) + 1;
  for (let index = 0; index < sourceCount; index += 1) {
    result.push(...(grouped[index] || []));
    if (byIncoming[index]) result.push(byIncoming[index].element);
  }
  return result.map((item, orderIndex) => createPipelineGreBendMaterializedElement({ ...item, orderIndex }));
}
export function buildPipelineGreBendMaterializedRoute({ rows, sections, contexts, addError }) {
  const original = buildPipelineGreOriginalMaterializedNodes({ rows, sections, contexts, addError });
  const inserted = buildPipelineGreInsertedMaterializedNodes(contexts), nodes = [...original, ...inserted];
  const nodeIndex = Object.fromEntries(nodes.map((item) => [item.materializedNodeId, item]));
  const straights = segmentElements(rows, sections, contexts, nodeIndex);
  const bends = contexts.map(bendEvidence), elements = orderedElements(straights, bends);
  return { original, inserted, nodes, elements, bends, components: bends.map((item) => item.component),
    serializationNormalization: `ROUND_INSERTED_POINTS_${POINT_DECIMALS}_DECIMALS` };
}
