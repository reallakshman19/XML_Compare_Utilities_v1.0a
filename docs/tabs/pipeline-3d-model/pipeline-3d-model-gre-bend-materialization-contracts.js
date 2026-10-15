export const PIPELINE_GRE_BEND_MATERIALIZATION_PLAN_SCHEMA = 'PipelineGreBendMaterializationPlan.v1';
export const PIPELINE_GRE_BEND_MATERIALIZED_MODEL_SCHEMA = 'PipelineGreBendMaterializedModel.v1';
export const PIPELINE_GRE_BEND_MATERIALIZED_NODE_SCHEMA = 'PipelineGreBendMaterializedNode.v1';
export const PIPELINE_GRE_BEND_MATERIALIZED_ELEMENT_SCHEMA = 'PipelineGreBendMaterializedElement.v1';
export const PIPELINE_GRE_BEND_COMPONENT_SCHEMA = 'PipelineGreBendComponent.v1';
export const PIPELINE_GRE_BEND_ELEMENT_LINEAGE_SCHEMA = 'PipelineGreBendElementLineage.v1';
export const PIPELINE_GRE_BEND_CANDIDATE_LINEAGE_SCHEMA = 'PipelineGreBendCandidateLineage.v1';
export const PIPELINE_GRE_BEND_NODE_ALLOCATION_POLICY_SCHEMA = 'PipelineGreBendNodeAllocationPolicy.v1';
export const PIPELINE_GRE_BEND_NODE_ALLOCATION_PLAN_SCHEMA = 'PipelineGreBendNodeAllocationPlan.v1';
export const PIPELINE_GRE_BEND_NODE_ALLOCATION_SCHEMA = 'PipelineGreBendNodeAllocation.v1';

export const PIPELINE_GRE_BEND_NODE_ROLES = Object.freeze([
  'ORIGINAL_ROUTE_NODE', 'GRE_INCOMING_BREAK', 'GRE_INCOMING_TANGENCY',
  'GRE_OUTGOING_TANGENCY', 'GRE_OUTGOING_BREAK', 'INACTIVE_CORNER_REFERENCE',
]);
export const PIPELINE_GRE_BEND_INSERTED_NODE_ORDER = Object.freeze([
  'GRE_INCOMING_BREAK', 'GRE_INCOMING_TANGENCY',
  'GRE_OUTGOING_TANGENCY', 'GRE_OUTGOING_BREAK',
]);
export const PIPELINE_GRE_BEND_ELEMENT_KINDS = Object.freeze([
  'UNCHANGED_STRAIGHT', 'SPLIT_STRAIGHT', 'GRE_INCOMING_TRANSITION',
  'GRE_BEND', 'GRE_OUTGOING_TRANSITION',
]);
export const PIPELINE_GRE_BEND_LINEAGE_DISPOSITIONS = Object.freeze([
  'UNCHANGED', 'SPLIT_BY_INCOMING_BREAK', 'SPLIT_BY_INCOMING_TANGENCY',
  'REPLACED_BY_GRE_BEND', 'SPLIT_BY_OUTGOING_TANGENCY', 'SPLIT_BY_OUTGOING_BREAK',
  'COINCIDENT_ZERO_LENGTH_AUTHORIZED', 'COINCIDENT_ENVELOPE_CONTACT',
]);
export const PIPELINE_GRE_BEND_MATERIALIZATION_BLOCKER_ORDER = Object.freeze([
  'PIPELINE_GRE_BEND_MATERIALIZATION_INPUT_INVALID',
  'PIPELINE_GRE_BEND_MATERIALIZATION_GEOMETRY_PLAN_INVALID',
  'PIPELINE_GRE_BEND_MATERIALIZATION_CANDIDATE_INVALID',
  'PIPELINE_GRE_BEND_MATERIALIZATION_OWNERSHIP_INVALID',
  'PIPELINE_GRE_BEND_MATERIALIZATION_VENDOR_IDENTITY_CONFLICT',
  'PIPELINE_GRE_BEND_MATERIALIZATION_BREAK_APPLICATION_INVALID',
  'PIPELINE_GRE_BEND_MATERIALIZATION_NODE_POLICY_INVALID',
  'PIPELINE_GRE_BEND_NODE_ALLOCATION_POLICY_UNRESOLVED',
  'PIPELINE_GRE_BEND_MATERIALIZATION_NODE_ALLOCATION_CONFLICT',
  'PIPELINE_GRE_BEND_MATERIALIZATION_POINT_ORDER_INVALID',
  'PIPELINE_GRE_BEND_MATERIALIZATION_ZERO_LENGTH_INVALID',
  'PIPELINE_GRE_BEND_MATERIALIZATION_SECTION_BOUNDARY_CONFLICT',
  'PIPELINE_GRE_BEND_MATERIALIZATION_SHARED_SEGMENT_CONFLICT',
  'PIPELINE_GRE_BEND_MATERIALIZATION_LINEAGE_INVALID',
  'PIPELINE_GRE_BEND_MATERIALIZATION_TOPOLOGY_INVALID',
  'PIPELINE_GRE_BEND_MATERIALIZATION_COVERAGE_INVALID',
  'PIPELINE_GRE_BEND_MATERIALIZATION_TRANSACTION_ABORTED',
]);

const compare = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value)
  && [Object.prototype, null].includes(Object.getPrototypeOf(value)));
const integer = (value) => Number.isSafeInteger(value) ? value : null;
const finite = (value) => typeof value === 'number' && Number.isFinite(value) ? value : null;

export function clonePipelineGreMaterializationValue(value) {
  if (value === undefined) return null;
  if (value === null || ['string', 'boolean'].includes(typeof value)) return value;
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) throw new TypeError('Materialization evidence numbers must be finite.');
    return value;
  }
  if (Array.isArray(value)) return value.map(clonePipelineGreMaterializationValue);
  if (!plain(value)) throw new TypeError('Materialization evidence must be JSON-safe plain data.');
  return Object.fromEntries(Object.keys(value).sort(compare)
    .map((key) => [key, clonePipelineGreMaterializationValue(value[key])]));
}
export function freezePipelineGreMaterializationValue(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freezePipelineGreMaterializationValue);
  return Object.freeze(value);
}
export function createPipelineGreBendMaterializationDiagnostic(code, message = code, details = {}) {
  return freezePipelineGreMaterializationValue({ severity: 'BLOCKING', code: text(code),
    message: text(message) || text(code), details: clonePipelineGreMaterializationValue(details) });
}
function rank(code) {
  const index = PIPELINE_GRE_BEND_MATERIALIZATION_BLOCKER_ORDER.indexOf(code);
  return index < 0 ? PIPELINE_GRE_BEND_MATERIALIZATION_BLOCKER_ORDER.length : index;
}
export function finalizePipelineGreBendMaterializationState(values = []) {
  const keyed = Object.create(null);
  values.filter(plain).filter((item) => text(item.code)).forEach((item) => {
    const normalized = createPipelineGreBendMaterializationDiagnostic(
      item.code, item.message, plain(item.details) ? item.details : {});
    keyed[`${normalized.code}:${JSON.stringify(normalized.details)}`] = normalized;
  });
  const diagnostics = Object.freeze(Object.values(keyed).sort((a, b) => rank(a.code) - rank(b.code)
    || compare(a.code, b.code) || compare(JSON.stringify(a.details), JSON.stringify(b.details))));
  const blockerCodes = Object.freeze([...new Set(diagnostics.map((item) => item.code))]
    .sort((a, b) => rank(a) - rank(b) || compare(a, b)));
  return freezePipelineGreMaterializationValue({ diagnostics, blockerCodes, ready: blockerCodes.length === 0 });
}
export function safePipelineGreMaterializationInput(input) {
  try {
    const source = clonePipelineGreMaterializationValue(input);
    if (plain(source)) return { source, diagnostics: [] };
  } catch { /* fail closed */ }
  return { source: {}, diagnostics: [createPipelineGreBendMaterializationDiagnostic(
    'PIPELINE_GRE_BEND_MATERIALIZATION_INPUT_INVALID', 'Input must be JSON-safe plain data.')] };
}
function uniqueIntegers(values) {
  if (!Array.isArray(values)) return null;
  const result = values.map(integer);
  if (result.some((value) => value === null) || new Set(result).size !== result.length) return null;
  return result.sort((a, b) => a - b);
}
function exactOrder(values) {
  return Array.isArray(values) && values.length === PIPELINE_GRE_BEND_INSERTED_NODE_ORDER.length
    && values.every((value, index) => value === PIPELINE_GRE_BEND_INSERTED_NODE_ORDER[index]);
}
export function createPipelineGreBendNodeAllocationPolicy(input = {}) {
  const safe = safePipelineGreMaterializationInput(input), source = safe.source, errors = [...safe.diagnostics];
  const originals = uniqueIntegers(source.originalNodeNumbers), reserved = uniqueIntegers(source.reservedNodeNumbers);
  if (source.schema !== PIPELINE_GRE_BEND_NODE_ALLOCATION_POLICY_SCHEMA || !text(source.policyId)
    || !(integer(source.nodeStep) > 0) || !(integer(source.allocationStart) > 0)
    || !originals || !reserved || !exactOrder(source.allocationOrder)
    || source.sourceAuthority !== 'PIPELINE_GRE_BEND_NODE_ALLOCATION_POLICY' || !text(source.sourceReference)) errors.push(
    createPipelineGreBendMaterializationDiagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_NODE_POLICY_INVALID',
      'A closed deterministic GRE inserted-node allocation policy is required.'));
  const state = finalizePipelineGreBendMaterializationState(errors);
  return freezePipelineGreMaterializationValue({ schema: PIPELINE_GRE_BEND_NODE_ALLOCATION_POLICY_SCHEMA,
    policyId: text(source.policyId), nodeStep: integer(source.nodeStep), allocationStart: integer(source.allocationStart),
    reservedNodeNumbers: Object.freeze(reserved || []), originalNodeNumbers: Object.freeze(originals || []),
    allocationOrder: Object.freeze(exactOrder(source.allocationOrder) ? [...source.allocationOrder] : []),
    sourceAuthority: text(source.sourceAuthority), sourceReference: text(source.sourceReference),
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
}

function indexes(value, allowEmpty = false) {
  return Array.isArray(value) && (allowEmpty || value.length > 0)
    && value.every((item) => Number.isSafeInteger(item) && item >= 0)
    && new Set(value).size === value.length;
}
function texts(value, allowEmpty = false) {
  return Array.isArray(value) && (allowEmpty || value.length > 0)
    && value.every((item) => Boolean(text(item))) && new Set(value).size === value.length;
}
function point3(value) {
  return plain(value) && ['x', 'y', 'z'].every((axis) => finite(value[axis]) !== null);
}
function contractError(code, message) {
  return createPipelineGreBendMaterializationDiagnostic(code, message);
}
function nodeErrors(source) {
  const errors = [], insertedRole = PIPELINE_GRE_BEND_INSERTED_NODE_ORDER.includes(source.nodeRole);
  if (!text(source.materializedNodeId) || !Number.isSafeInteger(source.nodeNumber)
    || !PIPELINE_GRE_BEND_NODE_ROLES.includes(source.nodeRole) || !point3(source.coordinates)
    || !text(source.analysisSectionId) || !indexes(source.sourceElementIndexes, true)
    || !text(source.sourceAuthority) || !text(source.sourceReference)
    || typeof source.inserted !== 'boolean' || typeof source.active !== 'boolean') errors.push(contractError(
    'PIPELINE_GRE_BEND_MATERIALIZATION_TOPOLOGY_INVALID', 'Materialized node contract fields are invalid.'));
  if (source.inserted !== insertedRole || (source.inserted && source.sourceNodeNumber !== null)
    || (!source.inserted && source.sourceNodeNumber !== source.nodeNumber)
    || (source.nodeRole === 'INACTIVE_CORNER_REFERENCE' && source.active !== false)) errors.push(contractError(
    'PIPELINE_GRE_BEND_MATERIALIZATION_TOPOLOGY_INVALID', 'Materialized node role and source identity conflict.'));
  return errors;
}
function elementErrors(source) {
  const errors = [], gre = ['GRE_INCOMING_TRANSITION', 'GRE_BEND', 'GRE_OUTGOING_TRANSITION'].includes(source.elementKind);
  if (!text(source.materializedElementId) || !text(source.fromMaterializedNodeId) || !text(source.toMaterializedNodeId)
    || source.fromMaterializedNodeId === source.toMaterializedNodeId || !text(source.analysisSectionId)
    || !PIPELINE_GRE_BEND_ELEMENT_KINDS.includes(source.elementKind) || !indexes(source.sourceElementIndexes)
    || !PIPELINE_GRE_BEND_LINEAGE_DISPOSITIONS.includes(source.lineageDisposition)
    || finite(source.lengthMm) === null || source.lengthMm < 0 || !Number.isSafeInteger(source.orderIndex)
    || !text(source.sourceAuthority) || !text(source.sourceReference)) errors.push(contractError(
    'PIPELINE_GRE_BEND_MATERIALIZATION_TOPOLOGY_INVALID', 'Materialized element contract fields are invalid.'));
  if (gre && (!text(source.candidateId) || !(finite(source.localThicknessMm) > 0)
    || !text(source.vendorId) || !text(source.seriesId) || !text(source.requirementReference))) errors.push(contractError(
    'PIPELINE_GRE_BEND_MATERIALIZATION_VENDOR_IDENTITY_CONFLICT', 'GRE element requires exact candidate and vendor evidence.'));
  return errors;
}
function componentErrors(source) {
  const required = ['componentId', 'candidateId', 'analysisSectionId', 'incomingTangencyNodeId',
    'outgoingTangencyNodeId', 'inactiveCornerReferenceId', 'vendorId', 'seriesId',
    'qualificationEvidenceId', 'requirementReference', 'sourceAuthority', 'sourceReference'];
  if (required.some((field) => !text(source[field])) || !(finite(source.bendRadiusMm) > 0)
    || !(finite(source.turnAngleDeg) > 0) || source.turnAngleDeg >= 180
    || !['EACH_LEG_FROM_CORNER', 'EACH_LEG_FROM_TANGENCY'].includes(source.bendBreakLengthApplication)
    || !(finite(source.localThicknessMm) > 0) || !indexes(source.sourceElementIndexes)
    || source.semanticArcOnly !== true || !Array.isArray(source.sampledNodeIds) || source.sampledNodeIds.length) return [contractError(
    'PIPELINE_GRE_BEND_MATERIALIZATION_CANDIDATE_INVALID', 'Semantic GRE bend component contract fields are invalid.')];
  return [];
}
function allocationErrors(source) {
  if (!text(source.candidateId) || !PIPELINE_GRE_BEND_INSERTED_NODE_ORDER.includes(source.nodeRole)
    || !text(source.materializedNodeId) || !Number.isSafeInteger(source.nodeNumber) || source.nodeNumber <= 0
    || !text(source.policyId) || !text(source.sourceAuthority) || !text(source.sourceReference)) return [contractError(
    'PIPELINE_GRE_BEND_MATERIALIZATION_NODE_ALLOCATION_CONFLICT', 'Inserted-node allocation contract fields are invalid.')];
  return [];
}
function lineageErrors(schema, source) {
  if (schema === PIPELINE_GRE_BEND_ELEMENT_LINEAGE_SCHEMA && (!Number.isSafeInteger(source.sourceElementIndex)
    || !text(source.sourceElementId) || !texts(source.successorElementIds) || !texts(source.dispositions)
    || !texts(source.candidateIds, true) || !text(source.sourceAuthority) || !text(source.sourceReference))) return [contractError(
    'PIPELINE_GRE_BEND_MATERIALIZATION_LINEAGE_INVALID', 'Element lineage contract fields are invalid.')];
  if (schema === PIPELINE_GRE_BEND_CANDIDATE_LINEAGE_SCHEMA && (!text(source.candidateId)
    || !text(source.analysisSectionId) || source.profileId !== 'gre' || !texts(source.insertedNodeIds)
    || source.insertedNodeIds.length !== 4 || !text(source.bendElementId) || !text(source.bendComponentId)
    || !text(source.inactiveCornerReferenceId) || !texts(source.successorElementIds)
    || !text(source.vendorId) || !text(source.seriesId) || !text(source.qualificationEvidenceId)
    || !text(source.sourceAuthority) || !text(source.sourceReference))) return [contractError(
    'PIPELINE_GRE_BEND_MATERIALIZATION_LINEAGE_INVALID', 'Candidate lineage contract fields are invalid.')];
  return [];
}
function contractErrors(schema, source) {
  if (schema === PIPELINE_GRE_BEND_MATERIALIZED_NODE_SCHEMA) return nodeErrors(source);
  if (schema === PIPELINE_GRE_BEND_MATERIALIZED_ELEMENT_SCHEMA) return elementErrors(source);
  if (schema === PIPELINE_GRE_BEND_COMPONENT_SCHEMA) return componentErrors(source);
  if (schema === PIPELINE_GRE_BEND_NODE_ALLOCATION_SCHEMA) return allocationErrors(source);
  if ([PIPELINE_GRE_BEND_ELEMENT_LINEAGE_SCHEMA, PIPELINE_GRE_BEND_CANDIDATE_LINEAGE_SCHEMA].includes(schema)) return lineageErrors(schema, source);
  if (schema === PIPELINE_GRE_BEND_NODE_ALLOCATION_PLAN_SCHEMA && (!Array.isArray(source.allocations)
    || !indexes(source.originalNodeNumbers, true) || !indexes(source.reservedNodeNumbers, true)
    || source.allocationCount !== source.allocations.length || source.allocationCount !== source.candidateCount * 4
    || (source.candidateCount > 0 && source.policy?.ready !== true))) return [contractError(
    'PIPELINE_GRE_BEND_MATERIALIZATION_NODE_ALLOCATION_CONFLICT', 'Node-allocation plan coverage is invalid.')];
  if (schema === PIPELINE_GRE_BEND_MATERIALIZED_MODEL_SCHEMA && (!Array.isArray(source.sourceRows)
    || !Array.isArray(source.nodes) || !Array.isArray(source.elements) || !Array.isArray(source.bendComponents)
    || !Array.isArray(source.inactiveCornerReferences) || !text(source.sourceAuthority) || !text(source.sourceReference)
    || source.nodes.some((item) => item?.ready !== true) || source.elements.some((item) => item?.ready !== true)
    || source.bendComponents.some((item) => item?.ready !== true))) return [contractError(
    'PIPELINE_GRE_BEND_MATERIALIZATION_TOPOLOGY_INVALID', 'Materialized model contains invalid nested contracts.')];
  return [];
}

function record(schema, source, state) {
  const resolved = finalizePipelineGreBendMaterializationState([...state.diagnostics, ...contractErrors(schema, source)]);
  return freezePipelineGreMaterializationValue({ schema, ...clonePipelineGreMaterializationValue(source),
    diagnostics: resolved.diagnostics, blockerCodes: resolved.blockerCodes, ready: resolved.ready });
}
export function createPipelineGreBendNodeAllocation(input = {}, diagnostics = []) {
  return record(PIPELINE_GRE_BEND_NODE_ALLOCATION_SCHEMA, input,
    finalizePipelineGreBendMaterializationState(diagnostics));
}
export function createPipelineGreBendNodeAllocationPlan(input = {}, diagnostics = []) {
  return record(PIPELINE_GRE_BEND_NODE_ALLOCATION_PLAN_SCHEMA, input,
    finalizePipelineGreBendMaterializationState(diagnostics));
}
export function createPipelineGreBendMaterializedNode(input = {}, diagnostics = []) {
  return record(PIPELINE_GRE_BEND_MATERIALIZED_NODE_SCHEMA, input,
    finalizePipelineGreBendMaterializationState(diagnostics));
}
export function createPipelineGreBendMaterializedElement(input = {}, diagnostics = []) {
  return record(PIPELINE_GRE_BEND_MATERIALIZED_ELEMENT_SCHEMA, input,
    finalizePipelineGreBendMaterializationState(diagnostics));
}
export function createPipelineGreBendComponent(input = {}, diagnostics = []) {
  return record(PIPELINE_GRE_BEND_COMPONENT_SCHEMA, input,
    finalizePipelineGreBendMaterializationState(diagnostics));
}
export function createPipelineGreBendElementLineage(input = {}, diagnostics = []) {
  return record(PIPELINE_GRE_BEND_ELEMENT_LINEAGE_SCHEMA, input,
    finalizePipelineGreBendMaterializationState(diagnostics));
}
export function createPipelineGreBendCandidateLineage(input = {}, diagnostics = []) {
  return record(PIPELINE_GRE_BEND_CANDIDATE_LINEAGE_SCHEMA, input,
    finalizePipelineGreBendMaterializationState(diagnostics));
}
export function createPipelineGreBendMaterializedModel(input = {}, diagnostics = []) {
  return record(PIPELINE_GRE_BEND_MATERIALIZED_MODEL_SCHEMA, input,
    finalizePipelineGreBendMaterializationState(diagnostics));
}
export function createPipelineGreBendMaterializationPlan(input = {}, diagnostics = []) {
  const state = finalizePipelineGreBendMaterializationState(diagnostics);
  return freezePipelineGreMaterializationValue({ schema: PIPELINE_GRE_BEND_MATERIALIZATION_PLAN_SCHEMA,
    ...clonePipelineGreMaterializationValue(input), materializedModel: state.ready ? input.materializedModel : null,
    diagnostics: state.diagnostics, blockerCodes: state.blockerCodes, ready: state.ready });
}
export function createPipelineGreBendAbortedMaterializationPlan(input = {}, diagnostics = []) {
  return createPipelineGreBendMaterializationPlan({ sourceGeometryPlanSchema: input.sourceGeometryPlanSchema || '',
    sourceBendResolutionSchema: input.sourceBendResolutionSchema || '', sourceRoutingPlanSchema: input.sourceRoutingPlanSchema || '',
    nodeAllocationPlan: input.nodeAllocationPlan || null, materializedModel: null, candidateLineage: Object.freeze([]),
    elementLineage: Object.freeze([]), appliedCandidateIds: Object.freeze([]),
    notApplicableCandidateIds: Object.freeze([...(input.notApplicableCandidateIds || [])].sort(compare)),
    inactiveCornerReferences: Object.freeze([]), coverage: input.coverage || {} }, [...diagnostics,
    createPipelineGreBendMaterializationDiagnostic('PIPELINE_GRE_BEND_MATERIALIZATION_TRANSACTION_ABORTED',
      'GRE bend materialization transaction was aborted.')]);
}
export const buildPipelineGreBendMaterializationPlanJson = (plan) => JSON.stringify(plan, null, 2);
export const buildPipelineGreBendMaterializedModelJson = (model) => JSON.stringify(model, null, 2);
export function buildPipelineGreBendElementLineageTsv(plan) {
  const header = ['SourceElementId', 'SourceElementIndex', 'CandidateIds', 'SuccessorElementIds', 'Dispositions'];
  const rows = (plan?.elementLineage || []).map((item) => [item.sourceElementId, item.sourceElementIndex,
    (item.candidateIds || []).join('|'), (item.successorElementIds || []).join('|'),
    (item.dispositions || []).join('|')]);
  return [header, ...rows].map((row) => row.join('\t')).join('\n');
}
export function buildPipelineGreBendNodeAllocationTsv(plan) {
  const header = ['CandidateId', 'NodeRole', 'MaterializedNodeId', 'NodeNumber'];
  const rows = (plan?.nodeAllocationPlan?.allocations || []).map((item) => [item.candidateId,
    item.nodeRole, item.materializedNodeId, item.nodeNumber]);
  return [header, ...rows].map((row) => row.join('\t')).join('\n');
}
