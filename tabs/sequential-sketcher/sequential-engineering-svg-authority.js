import { createEngineeringRevisionToken, freezeJsonValue } from '../../core/engineering-scene/index.js';
import { sequentialSessionFingerprint } from './construction/sequential-session-fingerprint.js';
import { SEQUENTIAL_ENGINEERING_SVG_INDEX_PROJECTION_SCHEMA } from './sequential-engineering-svg-index-projection.js';
import { projectSequentialReversalCandidates } from './sequential-engineering-svg-reversal-scene.js';
import {
  createSequentialSupportAdjustmentRegister,
  assertSequentialSupportAdjustmentRegister,
} from './support/sequential-support-adjustment-register.js';
import {
  applySequentialSupportAdjustmentRegister,
  assertSequentialAdjustedSupportProjection,
  sequentialSupportProjectionFingerprint,
} from './support/sequential-support-adjusted-projection.js';

export const SEQUENTIAL_ENGINEERING_SVG_AUTHORITY_SCHEMA = 'SequentialEngineeringSvgAuthority.v1';

function requireSchema(value, schema, label) {
  if (value?.schema !== schema) throw new TypeError(`${label} must use ${schema}.`);
  return value;
}
function projectionIndexes(projection) {
  requireSchema(projection, SEQUENTIAL_ENGINEERING_SVG_INDEX_PROJECTION_SCHEMA,
    'Sequential index projection');
  return {
    branches: new Map(projection.branches.map((row) => [row.branchId, row.branch])),
    components: new Map(projection.components.map((row) => [row.componentId, row.component])),
    ports: new Map(projection.ports.map((row) => [row.portId, row.port])),
  };
}
function requireIndexes(input) {
  if (input.indexProjection) return projectionIndexes(input.indexProjection);
  if (!(input.indexes?.components instanceof Map) || !(input.indexes?.ports instanceof Map)) {
    throw new TypeError('Sequential engineering SVG requires indexed components and ports.');
  }
  return input.indexes;
}
function sameTextSequence(left = [], right = []) {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}
function validateConfirmed(session, confirmed) {
  if (!confirmed) return null;
  requireSchema(confirmed, 'ConfirmedSequentialConstruction.v1', 'Confirmed construction');
  const componentIds = confirmed.components.map((component) => component.componentId);
  if (confirmed.rootBranchId !== session.rootBranchId
    || !sameTextSequence(componentIds, session.confirmedComponentIds || [])) {
    throw new Error('Confirmed construction does not match the current Sequential session.');
  }
  return confirmed;
}
function validateSupportAuthority(confirmed, input) {
  const base = input.baseSupportProjection || input.supportProjection || null;
  if (!base) {
    if (input.supportAdjustmentRegister) {
      throw new Error('Support adjustments require a confirmed base support projection.');
    }
    return Object.freeze({ base: null, register: null, effective: null });
  }
  requireSchema(base, 'SequentialConfirmedSupportProjection.v1', 'Base support projection');
  if (!confirmed || base.constructionFingerprint !== confirmed.constructionFingerprint) {
    throw new Error('Sequential base support projection is not fingerprint-matched to confirmed construction.');
  }
  const register = input.supportAdjustmentRegister
    ? assertSequentialSupportAdjustmentRegister(input.supportAdjustmentRegister,
      base.constructionFingerprint)
    : createSequentialSupportAdjustmentRegister({
      constructionFingerprint: base.constructionFingerprint,
    });
  const effective = input.baseSupportProjection
    ? assertSequentialAdjustedSupportProjection(base, register, input.supportProjection)
    : applySequentialSupportAdjustmentRegister(base, register);
  return Object.freeze({ base, register, effective });
}
function resolvedPortPositions(session) {
  const positions = new Map();
  for (const connection of session.committedConnections || []) {
    if (connection.fromPortId && connection.fromPosition) positions.set(connection.fromPortId, connection.fromPosition);
    if (connection.toPortId && connection.toPosition) positions.set(connection.toPortId, connection.toPosition);
  }
  return positions;
}
function rejectedCandidateEvidence(session) {
  const rejectedIds = new Set(session.rejectedCandidateIds || []);
  const evidence = new Map();
  for (const decision of session.decisionLedger || []) {
    const selectedId = decision.resolution?.selectedCandidateId;
    if (!selectedId || !rejectedIds.has(selectedId)) continue;
    const candidate = (decision.candidates || []).find((row) => row.candidateId === selectedId);
    if (candidate) evidence.set(selectedId, Object.freeze({ candidate, decision }));
  }
  return Object.freeze({
    rows: Object.freeze([...evidence.entries()].map(([candidateId, value]) => Object.freeze({ candidateId, ...value }))),
    missingIds: Object.freeze([...rejectedIds].filter((candidateId) => !evidence.has(candidateId)).sort()),
  });
}
function supportFamilies(supportProjection) {
  const rows = supportProjection?.branchBundles?.flatMap((bundle) => (
    bundle.resolvedSupportFamilies || []
  )) || [];
  return new Map(rows.map((family) => [family.familyId, family]));
}
function confirmedComponents(session, indexes, confirmed) {
  const accepted = new Map((confirmed?.components || []).map((component) => [component.componentId, component]));
  return Object.freeze((session.confirmedComponentIds || []).map((componentId) => {
    const component = accepted.get(componentId) || indexes.components.get(componentId);
    if (!component) throw new Error(`Confirmed component evidence is missing: ${componentId}`);
    return component;
  }));
}
function revisionToken(session, confirmed, supportAuthority) {
  return createEngineeringRevisionToken({
    sessionFingerprint: sequentialSessionFingerprint(session),
    confirmedConstructionFingerprint: confirmed?.constructionFingerprint || null,
    supportConstructionFingerprint: supportAuthority.effective?.constructionFingerprint || null,
    supportProjectionFingerprint: supportAuthority.effective
      ? sequentialSupportProjectionFingerprint(supportAuthority.effective) : null,
    supportAdjustmentRegisterFingerprint: supportAuthority.register?.headFingerprint || null,
  });
}

export function classifySequentialEngineeringSvgAuthority(input = {}) {
  const session = requireSchema(input.session, 'SequentialConstructionSession.v1', 'Sequential session');
  requireSchema(input.evidenceModel, 'SequentialSourceEvidence.v1', 'Sequential evidence model');
  const indexes = requireIndexes(input);
  const confirmed = validateConfirmed(session, input.confirmedConstruction || null);
  const supportAuthority = validateSupportAuthority(confirmed, input);
  const supportProjection = supportAuthority.effective;
  const supportProjectionFingerprint = supportProjection
    ? sequentialSupportProjectionFingerprint(supportProjection) : null;
  const resolvedPositions = resolvedPortPositions(session);
  const activePort = session.activeExitPortId ? indexes.ports.get(session.activeExitPortId) || null : null;
  const rejected = rejectedCandidateEvidence(session);
  const families = supportFamilies(supportProjection);
  const supports = Object.freeze((supportProjection?.supportGlyphs || []).map((glyph) => Object.freeze({
    glyph,
    family: families.get(glyph.familyId) || null,
  })));
  return freezeJsonValue({
    schema: SEQUENTIAL_ENGINEERING_SVG_AUTHORITY_SCHEMA,
    revision: revisionToken(session, confirmed, supportAuthority),
    sessionFingerprint: sequentialSessionFingerprint(session),
    confirmedConstructionFingerprint: confirmed?.constructionFingerprint || null,
    supportConstructionFingerprint: supportProjection?.constructionFingerprint || null,
    supportProjectionFingerprint,
    supportAdjustmentRegisterFingerprint: supportAuthority.register?.headFingerprint || null,
    state: session.state,
    session,
    evidenceModel: input.evidenceModel,
    confirmedConstruction: confirmed,
    baseSupportProjection: supportAuthority.base,
    supportAdjustmentRegister: supportAuthority.register,
    supportProjection,
    confirmedComponents: confirmedComponents(session, indexes, confirmed),
    committedConnections: session.committedConnections || [],
    repairs: session.repairLedger || [],
    candidates: session.currentDecisionRequest?.candidates || [],
    reversalCandidates: projectSequentialReversalCandidates(session, indexes),
    candidateReason: session.currentDecisionRequest?.reason || null,
    activePort: activePort ? {
      ...activePort,
      resolvedPosition: resolvedPositions.get(activePort.portId) || activePort.sourcePosition || null,
    } : null,
    rejectedCandidates: rejected.rows,
    rejectedCandidateIdsMissingEvidence: rejected.missingIds,
    supports,
    unresolvedSupportFamilies: supportProjection?.unresolvedSupportFamilies || [],
    architecturalOmissions: [
      { category: 'network', reason: 'DERIVED_NETWORK_NOT_TRACEABLE_TO_CONFIRMED_CONSTRUCTION' },
      { category: 'restraint', reason: 'NO_STABLE_SEQUENTIAL_RESTRAINT_DIRECTION_OWNER' },
      { category: 'analyticalSupportAttachment', reason: 'NO_SEQUENTIAL_CONSTRUCTION_FINGERPRINT_BRIDGE' },
    ],
  });
}
