import { CII_WORKSPACE_SCHEMAS, deepFreeze, stableId, stableStringify } from './cii-workspace-contracts.js';
import { registeredCiiPoint } from './cii-workspace-geometry.js';

function edgeMap(graph) { return new Map((graph?.edges || []).map((edge) => [String(edge.elementId), edge])); }
function nodeMap(graph) { return new Map((graph?.nodes || []).map((node) => [String(node.id), node])); }
function capability(document, family) { return document?.capabilities?.families?.[family] || null; }
function finite(value) { const n = Number(value); return Number.isFinite(n) ? n : null; }
function numberDelta(source, target) { const a = finite(source); const b = finite(target); return a == null || b == null ? null : b - a; }
function changedNumber(source, target, tolerance = 1e-9) { const delta = numberDelta(source, target); return delta == null ? false : Math.abs(delta) > tolerance; }
function vectorDistance(a, b) {
  if (!a || !b) return null;
  const ax = finite(a.x); const ay = finite(a.y); const az = finite(a.z);
  const bx = finite(b.x); const by = finite(b.y); const bz = finite(b.z);
  if ([ax, ay, az, bx, by, bz].some((value) => value == null)) return null;
  return Math.hypot(bx - ax, by - ay, bz - az);
}
function vectorDifference(source, target) {
  if (!source || !target) return null;
  const s = [finite(source.dx), finite(source.dy), finite(source.dz)];
  const t = [finite(target.dx), finite(target.dy), finite(target.dz)];
  if ([...s, ...t].some((value) => value == null)) return null;
  const direct = Math.hypot(t[0] - s[0], t[1] - s[1], t[2] - s[2]);
  const reversed = Math.hypot(-t[0] - s[0], -t[1] - s[1], -t[2] - s[2]);
  return direct <= reversed ? { distanceMm: direct, orientation: 'DIRECT' } : { distanceMm: reversed, orientation: 'REVERSED' };
}
function sourceIds(row) { return row?.sourceElementIds || (row?.sourceElementId ? [row.sourceElementId] : []); }
function targetIds(row) { return row?.targetElementIds || (row?.targetElementId ? [row.targetElementId] : []); }
function candidateEvidence(row) { return row?.evidence?.candidates || row?.evidence?.element?.candidates || null; }
function sortedUniqueNumeric(values) { return [...new Set((values || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b); }
function sortedStable(values) { return [...(values || [])].sort((a, b) => stableStringify(a).localeCompare(stableStringify(b), undefined, { numeric: true })); }
function pointerFamilyReady(document, family, authorityToken) {
  const item = capability(document, family);
  if (!item || item.state === 'PARSE_ERROR') return false;
  return String(item.authority || '').includes(authorityToken);
}

export function ciiIdentityConfidence(row) {
  if (!row) return 'UNRESOLVED';
  if (row.status === 'LOCKED') return 'LOCKED';
  const candidates = candidateEvidence(row);
  const explicit = candidates?.winnerIdentityConfidence
    || row?.evidence?.identityConfidence
    || row?.evidence?.element?.identityConfidence;
  if (explicit) return explicit;
  if (row.status === 'HIGH') return 'HIGH';
  if (['UNRESOLVED', 'CONFLICT', 'DELETED', 'INSERTED'].includes(row.status)) return 'UNRESOLVED';
  return 'REVIEW';
}

export function ciiIdentityBound(row) {
  if (!row) return false;
  if (row.status === 'LOCKED' || row.status === 'HIGH') return true;
  if (['UNRESOLVED', 'CONFLICT', 'DELETED', 'INSERTED'].includes(row.status)) return false;
  if (row?.evidence?.nodeCustodyGate) return false;
  const candidates = candidateEvidence(row);
  if (candidates) return candidates.status === 'SUPPORTED';
  const evidence = row?.evidence?.element || row?.evidence;
  return evidence?.identitySupported === true;
}

function deltaRow(row, category, property, sourceValue, targetValue, config = {}) {
  const sourceIdentity = row.sourceNodeId || row.sourceComponentId || row.sourceElementId || sourceIds(row).join('|') || null;
  const targetIdentity = row.targetNodeId || row.targetComponentId || targetIds(row).join('|') || null;
  const changed = config.changed ?? stableStringify(sourceValue) !== stableStringify(targetValue);
  return deepFreeze({
    deltaId: stableId('delta', row.correspondenceId, category, property),
    correspondenceId: row.correspondenceId,
    identityKind: row.kind,
    sourceIdentity,
    targetIdentity,
    identityConfidence: config.identityConfidence || ciiIdentityConfidence(row),
    category,
    property,
    sourceValue,
    targetValue,
    delta: config.delta ?? null,
    semanticChange: config.semanticChange || (changed ? 'CHANGED' : 'UNCHANGED'),
    changed: Boolean(changed),
    evidenceStatus: config.evidenceStatus || 'QUALIFIED',
    authority: config.authority || null,
    limitations: Object.freeze(config.limitations || []),
  });
}

function legacyRestraint(document, nodeId) {
  return (document?.parsed?.restraints || []).find((item) => String(item.node) === String(nodeId)) || null;
}
function restraintEvidence(document, nodeId) {
  const family = capability(document, 'restraints');
  const byNode = document?.auxiliaryEvidence?.restraints?.byNode;
  if (document?.auxiliaryEvidence?.restraints) {
    if (family?.state === 'PARSE_ERROR') return { mode: 'UNAVAILABLE', reason: 'RESTRAINT_AUXILIARY_PARSE_ERROR', records: [], legacy: null };
    const qualified = family?.details?.gapFrictionQualified === true
      && String(family?.authority || '').includes('#RESTRANT');
    if (qualified && byNode && typeof byNode === 'object') {
      return { mode: 'AUXILIARY_QUALIFIED', records: [...(byNode[String(nodeId)] || [])], legacy: null };
    }
    return { mode: 'UNAVAILABLE', reason: 'RESTRAINT_AUXILIARY_CUSTODY_NOT_QUALIFIED', records: [], legacy: null };
  }
  const legacy = legacyRestraint(document, nodeId);
  return { mode: 'LEGACY_PARTIAL', legacy, records: [] };
}
function qualifiedRestraintSet(records) {
  return sortedStable((records || []).map((record) => ({
    typeCode: Number(record.typeCode), stiffness: Number(record.stiffness), gap: Number(record.gap), friction: Number(record.friction),
    directionCosines: record.directionCosines || null,
  })));
}
function legacyRestraintDeltas(row, sourceRestraint, targetRestraint) {
  const deltas = []; const sourcePresent = Boolean(sourceRestraint); const targetPresent = Boolean(targetRestraint);
  if (!sourcePresent && !targetPresent) return deltas;
  deltas.push(deltaRow(row, 'RESTRAINT', 'Restraint presence', sourcePresent, targetPresent, {
    changed: sourcePresent !== targetPresent, semanticChange: sourcePresent === targetPresent ? 'UNCHANGED' : (targetPresent ? 'ADDED_IN_TARGET' : 'REMOVED_IN_TARGET'),
    evidenceStatus: 'PARTIAL', authority: 'parser/sections/restraints.js', limitations: ['Legacy restraint evidence is partial; auxiliary fixed-field custody was not supplied.'],
  }));
  const sourceCodes = sortedUniqueNumeric(sourceRestraint?.dofs || []); const targetCodes = sortedUniqueNumeric(targetRestraint?.dofs || []);
  deltas.push(deltaRow(row, 'RESTRAINT', 'Restraint code set', sourceCodes, targetCodes, {
    evidenceStatus: 'PARTIAL', authority: 'parser/sections/restraints.js#dofs',
    limitations: ['Numeric restraint codes are compared exactly; derived support type semantics are not authoritative for all CAESAR codes.'],
  }));
  const sourceRows = sortedStable([...(sourceRestraint?.rows || [])].map((item) => [...item]));
  const targetRows = sortedStable([...(targetRestraint?.rows || [])].map((item) => [...item]));
  deltas.push(deltaRow(row, 'RESTRAINT', 'Raw restraint records', sourceRows, targetRows, {
    evidenceStatus: 'PARTIAL', authority: 'parser/sections/restraints.js#rows',
    semanticChange: stableStringify(sourceRows) === stableStringify(targetRows) ? 'UNCHANGED' : 'RAW_ROWS_CHANGED',
    limitations: ['Raw numeric row differences are retained without labelling unqualified columns as gap or friction.'],
  }));
  return deltas;
}
function qualifiedRestraintDeltas(row, sourceRecords, targetRecords) {
  const deltas = []; const sourcePresent = sourceRecords.length > 0; const targetPresent = targetRecords.length > 0;
  if (!sourcePresent && !targetPresent) return deltas;
  const authority = 'PROTECTED_WRITER_RESTRANT_LINE1_LINE2';
  deltas.push(deltaRow(row, 'RESTRAINT', 'Restraint presence', sourcePresent, targetPresent, {
    changed: sourcePresent !== targetPresent, semanticChange: sourcePresent === targetPresent ? 'UNCHANGED' : (targetPresent ? 'ADDED_IN_TARGET' : 'REMOVED_IN_TARGET'),
    authority,
  }));
  deltas.push(deltaRow(row, 'RESTRAINT', 'Restraint code set', sortedUniqueNumeric(sourceRecords.map((record) => record.typeCode)), sortedUniqueNumeric(targetRecords.map((record) => record.typeCode)), {
    evidenceStatus: 'PARTIAL', authority,
    limitations: ['The numeric CAESAR restraint type field is source-qualified; human-readable meaning for every code 1..62 is not mapped here.'],
  }));
  deltas.push(deltaRow(row, 'RESTRAINT', 'Restraint gap values', sortedUniqueNumeric(sourceRecords.map((record) => record.gap)), sortedUniqueNumeric(targetRecords.map((record) => record.gap)), { authority }));
  deltas.push(deltaRow(row, 'RESTRAINT', 'Restraint friction values', sortedUniqueNumeric(sourceRecords.map((record) => record.friction)), sortedUniqueNumeric(targetRecords.map((record) => record.friction)), { authority }));
  deltas.push(deltaRow(row, 'RESTRAINT', 'Restraint stiffness values', sortedUniqueNumeric(sourceRecords.map((record) => record.stiffness)), sortedUniqueNumeric(targetRecords.map((record) => record.stiffness)), { authority }));
  deltas.push(deltaRow(row, 'RESTRAINT', 'Restraint direction-cosine set', sortedStable(sourceRecords.map((record) => record.directionCosines)), sortedStable(targetRecords.map((record) => record.directionCosines)), { authority }));
  deltas.push(deltaRow(row, 'RESTRAINT', 'Qualified restraint numeric record set', qualifiedRestraintSet(sourceRecords), qualifiedRestraintSet(targetRecords), {
    evidenceStatus: 'PARTIAL', authority,
    limitations: ['Numeric fields are qualified by fixed position; restraint type-code descriptions remain intentionally unresolved.'],
  }));
  return deltas;
}

function hangerEvidence(document, nodeId) {
  const family = capability(document, 'hangers');
  if (!family || family.state === 'PARSE_ERROR') return { mode: 'UNAVAILABLE', records: [] };
  const qualified = family.details?.nodePresenceQualified === true
    && String(family.authority || '').includes('#CONTROL_NOHGRS_IHGRNODE')
    && document?.hangerEvidence?.status === 'QUALIFIED';
  if (!qualified) return { mode: 'UNAVAILABLE', records: [] };
  return { mode: 'NODE_PRESENCE_QUALIFIED', records: [...(document.hangerEvidence?.byNode?.[String(nodeId)] || [])] };
}
function qualifiedHangerDeltas(row, sourceRecords, targetRecords) {
  const sourceCount = sourceRecords.length; const targetCount = targetRecords.length;
  if (sourceCount === 0 && targetCount === 0) return [];
  const sourcePresent = sourceCount > 0; const targetPresent = targetCount > 0;
  const authority = 'CONTROL_NOHGRS_PLUS_MISCE L_1_IHGRNODE'.replace('MISCE L', 'MISCEL');
  return [
    deltaRow(row, 'HANGER', 'Hanger presence', sourcePresent, targetPresent, {
      changed: sourcePresent !== targetPresent,
      semanticChange: sourcePresent === targetPresent ? 'UNCHANGED' : (targetPresent ? 'ADDED_IN_TARGET' : 'REMOVED_IN_TARGET'),
      authority,
      evidenceStatus: 'PARTIAL',
      limitations: ['Hanger node presence/count is qualified; HGRDAT and other hanger attributes are not normalized.'],
    }),
    deltaRow(row, 'HANGER', 'Hanger record count at node', sourceCount, targetCount, {
      changed: sourceCount !== targetCount, delta: targetCount - sourceCount, authority,
      evidenceStatus: 'PARTIAL',
      limitations: ['Count is derived from qualified IHGRNODE membership only.'],
    }),
  ];
}

function nodeDeltas(rows, sourceDocument, targetDocument, sourceGraph, targetGraph, options) {
  const sourceNodes = nodeMap(sourceGraph); const targetNodes = nodeMap(targetGraph);
  const sourceNameCapability = capability(sourceDocument, 'nodeNames'); const targetNameCapability = capability(targetDocument, 'nodeNames');
  const nameQualified = sourceNameCapability?.qualification === 'QUALIFIED' && targetNameCapability?.qualification === 'QUALIFIED';
  const nameLimitations = [...(sourceNameCapability?.limitations || []), ...(targetNameCapability?.limitations || [])];
  const deltas = []; const toleranceMm = Number(options.engineeringGeometryToleranceMm ?? 0.01);
  for (const row of rows || []) {
    if (row.kind !== 'NODE' || !row.sourceNodeId || !row.targetNodeId || !ciiIdentityBound(row)) continue;
    const sourceNode = sourceNodes.get(String(row.sourceNodeId)); const targetNode = targetNodes.get(String(row.targetNodeId));
    const nativeDistanceMm = vectorDistance(sourceNode?.position, targetNode?.position);
    if (nativeDistanceMm != null) deltas.push(deltaRow(row, 'GEOMETRY', 'Node location (native basis)', sourceNode.position, targetNode.position, {
      changed: nativeDistanceMm > toleranceMm, delta: { distanceMm: nativeDistanceMm, basis: 'NATIVE' }, authority: 'PARSED_NATIVE_NODE_COORDINATES',
    }));
    const registeredSource = registeredCiiPoint(options.geometryTransform, sourceNode?.position);
    const registeredDistanceMm = registeredSource ? vectorDistance(registeredSource, targetNode?.position) : null;
    if (registeredDistanceMm != null) deltas.push(deltaRow(row, 'GEOMETRY', 'Node location (registered basis)', registeredSource, targetNode.position, {
      changed: registeredDistanceMm > toleranceMm,
      delta: { distanceMm: registeredDistanceMm, basis: 'REGISTERED_RIGID_3D' },
      authority: 'QUALIFIED_RIGID_3D_REGISTRATION',
    }));

    const sourceName = sourceDocument?.nodeNames?.[String(row.sourceNodeId)] || '';
    const targetName = targetDocument?.nodeNames?.[String(row.targetNodeId)] || '';
    if (nameQualified || sourceName || targetName) deltas.push(deltaRow(row, 'NODE_NAME', 'Node name / to-name', sourceName, targetName, {
      evidenceStatus: nameQualified ? 'QUALIFIED' : 'PARTIAL', authority: 'CII_NODENAME_FIXED_LAYOUT', limitations: nameLimitations,
    }));

    const sourceRestraint = restraintEvidence(sourceDocument, row.sourceNodeId);
    const targetRestraint = restraintEvidence(targetDocument, row.targetNodeId);
    if (sourceRestraint.mode === 'AUXILIARY_QUALIFIED' && targetRestraint.mode === 'AUXILIARY_QUALIFIED') {
      deltas.push(...qualifiedRestraintDeltas(row, sourceRestraint.records, targetRestraint.records));
    } else if (sourceRestraint.mode === 'LEGACY_PARTIAL' && targetRestraint.mode === 'LEGACY_PARTIAL') {
      deltas.push(...legacyRestraintDeltas(row, sourceRestraint.legacy, targetRestraint.legacy));
    }

    const sourceHanger = hangerEvidence(sourceDocument, row.sourceNodeId);
    const targetHanger = hangerEvidence(targetDocument, row.targetNodeId);
    if (sourceHanger.mode === 'NODE_PRESENCE_QUALIFIED' && targetHanger.mode === 'NODE_PRESENCE_QUALIFIED') {
      deltas.push(...qualifiedHangerDeltas(row, sourceHanger.records, targetHanger.records));
    }
  }
  return deltas;
}

const SIF_TEE_NODE_REFERENCE_ROWS = Object.freeze([0, 5]);
function ciiNodeId(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? String(number) : null;
}
function uniqueBoundNodePairKeys(nodeRows) {
  const sourceClaims = new Map(); const targetClaims = new Map();
  for (const row of nodeRows || []) {
    if (row?.kind !== 'NODE' || !ciiIdentityBound(row)) continue;
    const sourceId = ciiNodeId(row.sourceNodeId); const targetId = ciiNodeId(row.targetNodeId);
    if (!sourceId || !targetId) continue;
    if (!sourceClaims.has(sourceId)) sourceClaims.set(sourceId, new Set());
    if (!targetClaims.has(targetId)) targetClaims.set(targetId, new Set());
    sourceClaims.get(sourceId).add(targetId); targetClaims.get(targetId).add(sourceId);
  }
  const keys = new Set();
  for (const [sourceId, targets] of sourceClaims) {
    if (targets.size !== 1) continue;
    const [targetId] = targets;
    if (targetClaims.get(targetId)?.size === 1) keys.add(`${sourceId}=>${targetId}`);
  }
  return keys;
}
function sifPayloadWithRawNodeReferences(record) {
  if (!record) return null;
  const payload = (record.normalizedPayload || []).map((row) => Array.isArray(row) ? [...row] : row);
  if (Array.isArray(payload[0])) payload[0][0] = record.firstRowFields?.[0] ?? record.node ?? payload[0][0];
  return payload;
}
function correspondenceNormalizedSifPayloads(sourceRecord, targetRecord, nodeRows) {
  const sourcePayload = sifPayloadWithRawNodeReferences(sourceRecord);
  const targetPayload = sifPayloadWithRawNodeReferences(targetRecord);
  if (!sourcePayload || !targetPayload) return { sourcePayload, targetPayload };
  const pairKeys = uniqueBoundNodePairKeys(nodeRows);
  for (const rowIndex of SIF_TEE_NODE_REFERENCE_ROWS) {
    const sourceId = ciiNodeId(sourcePayload[rowIndex]?.[0]);
    const targetId = ciiNodeId(targetPayload[rowIndex]?.[0]);
    if (sourceId && targetId && pairKeys.has(`${sourceId}=>${targetId}`)) {
      sourcePayload[rowIndex][0] = null; targetPayload[rowIndex][0] = null;
    }
  }
  return { sourcePayload, targetPayload };
}
function sifTeeDeltas(row, sourceDocument, targetDocument, source, target, nodeRows) {
  if (!pointerFamilyReady(sourceDocument, 'sifTee', '#SIF_TEE_POINTER')
    || !pointerFamilyReady(targetDocument, 'sifTee', '#SIF_TEE_POINTER')) return [];
  const sourceRecord = source?.sifTeeEvidence || null; const targetRecord = target?.sifTeeEvidence || null;
  if (!sourceRecord && !targetRecord) return [];
  const authority = 'ELEMENT_POINTER_TO_SIF_TEES_RAW_RECORD';
  const deltas = [deltaRow(row, 'SIF_TEE', 'SIF/Tee record presence', Boolean(sourceRecord), Boolean(targetRecord), {
    changed: Boolean(sourceRecord) !== Boolean(targetRecord), authority,
  })];
  deltas.push(deltaRow(row, 'SIF_TEE', 'SIF/Tee raw code (field 2)', sourceRecord?.rawCode ?? null, targetRecord?.rawCode ?? null, {
    evidenceStatus: 'PARTIAL', authority,
    limitations: ['The second numeric field is preserved as a raw code; its CAESAR semantic label is not asserted by the current source authority.'],
  }));
  const normalized = correspondenceNormalizedSifPayloads(sourceRecord, targetRecord, nodeRows);
  deltas.push(deltaRow(row, 'SIF_TEE', 'SIF/Tee normalized raw payload', normalized.sourcePayload, normalized.targetPayload, {
    evidenceStatus: 'PARTIAL', authority,
    limitations: ['Only the directly qualified V11 tee-slot Node fields (row 0 field 0 and row 5 field 0) are canonicalized, and only when the exact SOURCE/TARGET node pair has unique accepted correspondence; every other numeric payload field remains exact.'],
  }));
  return deltas;
}

function elementDeltas(rows, sourceDocument, targetDocument, sourceGraph, targetGraph, nodeRows, options) {
  const sourceEdges = edgeMap(sourceGraph); const targetEdges = edgeMap(targetGraph); const deltas = [];
  const geometryToleranceMm = Number(options.engineeringGeometryToleranceMm ?? 0.01);
  const valueTolerance = Number(options.engineeringNumericTolerance ?? 1e-9);
  for (const row of rows || []) {
    if (row.kind !== 'ELEMENT' || !ciiIdentityBound(row)) continue;
    const sourceIdList = sourceIds(row); const targetIdList = targetIds(row);
    if (sourceIdList.length !== 1 || targetIdList.length !== 1) continue;
    const source = sourceEdges.get(String(sourceIdList[0])); const target = targetEdges.get(String(targetIdList[0]));
    if (!source || !target) continue;
    const vector = vectorDifference(source, target);
    if (vector) deltas.push(deltaRow(row, 'GEOMETRY', 'Element vector', { dx: source.dx, dy: source.dy, dz: source.dz }, { dx: target.dx, dy: target.dy, dz: target.dz }, {
      changed: vector.distanceMm > geometryToleranceMm, delta: vector, authority: 'PARSED_ELEMENT_GEOMETRY',
    }));
    deltas.push(deltaRow(row, 'GEOMETRY', 'Element length', source.lengthMm, target.lengthMm, {
      changed: changedNumber(source.lengthMm, target.lengthMm, geometryToleranceMm), delta: numberDelta(source.lengthMm, target.lengthMm), authority: 'PARSED_ELEMENT_GEOMETRY',
    }));
    deltas.push(deltaRow(row, 'PIPE_SIZE', 'OD', source.diameter, target.diameter, {
      changed: changedNumber(source.diameter, target.diameter, valueTolerance), delta: numberDelta(source.diameter, target.diameter), authority: 'PARSED_ELEMENT_PIPE_PROPERTY',
    }));
    deltas.push(deltaRow(row, 'WALL', 'Wall thickness', source.wall, target.wall, {
      changed: changedNumber(source.wall, target.wall, valueTolerance), delta: numberDelta(source.wall, target.wall), authority: 'PROTECTED_WRITER_ELEMENT_ROW2_WT_FIXED_FIELD',
    }));
    const processFields = [
      ['P1', 'P1', 'PROTECTED_WRITER_ELEMENT_ROW4_P1_FIXED_FIELD'],
      ['T1', 'T1', 'PROTECTED_WRITER_ELEMENT_ROW2_T1_FIXED_FIELD'],
      ['T2', 'T2', 'PROTECTED_WRITER_ELEMENT_ROW2_T2_FIXED_FIELD'],
    ];
    for (const [property, key, authority] of processFields) {
      deltas.push(deltaRow(row, 'PROCESS', property, source[key], target[key], {
        changed: changedNumber(source[key], target[key], valueTolerance), delta: numberDelta(source[key], target[key]), authority,
        limitations: ['This value is qualified at its fixed ELEMENT field; a complete multi-case process/load-case model is not asserted.'],
      }));
    }
    deltas.push(...sifTeeDeltas(row, sourceDocument, targetDocument, source, target, nodeRows));
  }
  return deltas;
}

function componentDeltas(componentRows, elementRows, sourceGraph, targetGraph, options) {
  const sourceEdges = edgeMap(sourceGraph); const targetEdges = edgeMap(targetGraph); const deltas = [];
  const elementById = new Map((elementRows || []).map((row) => [row.correspondenceId, row]));
  const tolerance = Number(options.engineeringMassTolerance ?? 1e-9);
  for (const row of componentRows || []) {
    if (row.kind !== 'COMPONENT' || row.componentKind !== 'RIGID') continue;
    const parent = elementById.get(row.parentElementCorrespondenceId);
    if (!parent || !ciiIdentityBound(parent) || (row.evidence?.blockers || []).length) continue;
    const source = sourceEdges.get(String(row.sourceElementId)); const target = targetEdges.get(String(targetIds(row)[0] || ''));
    if (!source || !target) continue;
    const sourceWeight = source.rigidEvidence?.weight ?? source.rigidEvidence?.mass ?? null;
    const targetWeight = target.rigidEvidence?.weight ?? target.rigidEvidence?.mass ?? null;
    if (sourceWeight == null && targetWeight == null) continue;
    deltas.push(deltaRow(row, 'WEIGHT_RIGID', 'Rigid weight', sourceWeight, targetWeight, {
      changed: changedNumber(sourceWeight, targetWeight, tolerance), delta: numberDelta(sourceWeight, targetWeight), authority: 'ELEMENT_RIGID_POINTER_TO_RIGID_RECORD',
      identityConfidence: ciiIdentityConfidence(parent),
    }));
  }
  return deltas;
}

function limitation(sourceDocument, targetDocument, family, label, forcedState = null, forcedReason = null) {
  const source = sourceDocument?.capabilities?.families?.[family] || null;
  const target = targetDocument?.capabilities?.families?.[family] || null;
  const sourceState = source?.state || 'UNAVAILABLE'; const targetState = target?.state || 'UNAVAILABLE';
  const sourceQualification = source?.qualification || 'NONE'; const targetQualification = target?.qualification || 'NONE';
  const parseBlocked = sourceState === 'PARSE_ERROR' || targetState === 'PARSE_ERROR';
  const comparisonState = forcedState || (parseBlocked ? 'BLOCKED' : ((sourceQualification === 'QUALIFIED' && targetQualification === 'QUALIFIED') ? 'QUALIFIED' : 'LIMITED'));
  return deepFreeze({
    family, label, sourceState, targetState, sourceQualification, targetQualification, comparisonState,
    reason: forcedReason || [...(source?.limitations || []), ...(target?.limitations || [])][0] || '',
  });
}
function pointerPartialLimitation(sourceDocument, targetDocument, family, label, authorityToken) {
  const source = capability(sourceDocument, family); const target = capability(targetDocument, family);
  if (source?.state === 'PARSE_ERROR' || target?.state === 'PARSE_ERROR') return limitation(sourceDocument, targetDocument, family, label, 'BLOCKED');
  if (pointerFamilyReady(sourceDocument, family, authorityToken) && pointerFamilyReady(targetDocument, family, authorityToken)) {
    return limitation(sourceDocument, targetDocument, family, label, 'PARTIAL');
  }
  return limitation(sourceDocument, targetDocument, family, label);
}
function hangerPartialLimitation(sourceDocument, targetDocument) {
  const source = capability(sourceDocument, 'hangers'); const target = capability(targetDocument, 'hangers');
  if (source?.state === 'PARSE_ERROR' || target?.state === 'PARSE_ERROR') return limitation(sourceDocument, targetDocument, 'hangers', 'Hangers', 'BLOCKED');
  const ready = source?.details?.nodePresenceQualified === true && target?.details?.nodePresenceQualified === true
    && String(source?.authority || '').includes('#CONTROL_NOHGRS_IHGRNODE')
    && String(target?.authority || '').includes('#CONTROL_NOHGRS_IHGRNODE');
  return ready
    ? limitation(sourceDocument, targetDocument, 'hangers', 'Hangers', 'PARTIAL', 'Hanger count/node presence is qualified; HGRDAT and other hanger attributes remain unnormalized.')
    : limitation(sourceDocument, targetDocument, 'hangers', 'Hangers');
}

function capabilityLimitations(sourceDocument, targetDocument) {
  return Object.freeze([
    pointerPartialLimitation(sourceDocument, targetDocument, 'restraints', 'Restraints', '#RESTRANT'),
    hangerPartialLimitation(sourceDocument, targetDocument),
    pointerPartialLimitation(sourceDocument, targetDocument, 'sifTee', 'SIF / Tee', '#SIF_TEE_POINTER'),
    limitation(sourceDocument, targetDocument, 'weightData', 'General weight data'),
    limitation(sourceDocument, targetDocument, 'lineNumbers', 'Line numbers'),
    limitation(sourceDocument, targetDocument, 'process', 'Process P1/T1/T2', 'PARTIAL', 'P1/T1/T2 fixed fields are qualified individually; the remaining process/load-case model is not normalized.'),
  ]);
}

function familyCounts(rows) {
  const counts = {};
  for (const row of rows.filter((item) => item.changed)) counts[row.category] = (counts[row.category] || 0) + 1;
  return Object.freeze(counts);
}

export function buildCiiEngineeringDeltas(sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence, options = {}) {
  const rows = [
    ...nodeDeltas(correspondence?.nodeRows, sourceDocument, targetDocument, sourceGraph, targetGraph, options),
    ...elementDeltas(correspondence?.elementRows, sourceDocument, targetDocument, sourceGraph, targetGraph, correspondence?.nodeRows, options),
    ...componentDeltas(correspondence?.componentRows, correspondence?.elementRows, sourceGraph, targetGraph, options),
  ];
  rows.sort((a, b) => `${a.sourceIdentity}|${a.category}|${a.property}`.localeCompare(`${b.sourceIdentity}|${b.category}|${b.property}`, undefined, { numeric: true }));
  const changedRows = rows.filter((row) => row.changed);
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.engineeringDeltaSet,
    direction: 'SOURCE_TO_TARGET',
    rows: Object.freeze(rows),
    changedRows: Object.freeze(changedRows),
    limitations: capabilityLimitations(sourceDocument, targetDocument),
    summary: Object.freeze({
      comparedPropertyCount: rows.length,
      engineeringChangeCount: changedRows.length,
      unchangedPropertyCount: rows.length - changedRows.length,
      changeFamilyCounts: familyCounts(rows),
      identityMutationAuthority: 'NONE_READ_ONLY_DOWNSTREAM',
      geometryBases: Object.freeze({ native: 'PARSED_NATIVE_NODE_COORDINATES', registered: options.geometryTransform?.status === 'READY' ? 'QUALIFIED_RIGID_3D_REGISTRATION' : 'UNAVAILABLE' }),
    }),
  });
}
