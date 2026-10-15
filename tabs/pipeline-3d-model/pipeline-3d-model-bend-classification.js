const DEG = 180 / Math.PI;
const EPSILON = 1e-9;

function vector(a, b) { return { x: b.x - a.x, y: b.y - a.y, z: b.z - a.z }; }
function magnitude(value) { return Math.hypot(value.x, value.y, value.z); }
function dot(a, b) { return a.x * b.x + a.y * b.y + a.z * b.z; }
function unit(value) {
  const size = magnitude(value);
  return size > EPSILON ? { x: value.x / size, y: value.y / size, z: value.z / size } : null;
}
function angleDeg(a, b) {
  const left = unit(a), right = unit(b);
  if (!left || !right) return null;
  return Math.acos(Math.max(-1, Math.min(1, dot(left, right)))) * DEG;
}
function planAngleDeg(a, b) {
  return angleDeg({ x: a.x, y: a.y, z: 0 }, { x: b.x, y: b.y, z: 0 }) ?? 0;
}
function slopeDeg(value) { return Math.atan2(value.z, Math.hypot(value.x, value.y)) * DEG; }
function profileAngleDeg(a, b) { return Math.abs(slopeDeg(b) - slopeDeg(a)); }
function sources(point) { return Array.isArray(point?.sources) ? point.sources : [point?.source].filter(Boolean); }
function hasSource(point, source) { return sources(point).includes(source); }
function distanceMm(a, b) {
  return Math.hypot(Number(b.x) - Number(a.x), Number(b.y) - Number(a.y), Number(b.z) - Number(a.z));
}

export function buildSegmentLengths(entries = []) {
  return entries.slice(0, -1).map((entry, index) => distanceMm(entry.row, entries[index + 1].row));
}

export function buildAngleWindow(entries, lengths, index, settings) {
  const active = settings.shortElementAnglePolicy === 'ignore-below-length'
    && settings.minimumAngleElementLengthMm > 0;
  let leftSegment = index - 1;
  let rightSegment = index;
  if (active) {
    while (leftSegment >= 0 && lengths[leftSegment] < settings.minimumAngleElementLengthMm) leftSegment -= 1;
    while (rightSegment < lengths.length && lengths[rightSegment] < settings.minimumAngleElementLengthMm) rightSegment += 1;
  }
  if (leftSegment < 0 || rightSegment >= lengths.length) return null;
  const ignoredSegmentIndexes = [];
  for (let segment = leftSegment + 1; segment < rightSegment; segment += 1) ignoredSegmentIndexes.push(segment);
  const interiorIndexes = [];
  for (let point = leftSegment + 1; point <= rightSegment; point += 1) interiorIndexes.push(point);
  return Object.freeze({ leftSegment, rightSegment, ignoredSegmentIndexes, interiorIndexes, active });
}

function geometricClass(planTurn, profileTurn, settings) {
  if (planTurn && profileTurn) return settings.detectCompound ? 'COMPOUND' : null;
  if (planTurn) return settings.detectHorizontal ? 'HORIZONTAL' : null;
  if (profileTurn) return settings.detectVertical ? 'VERTICAL' : null;
  return null;
}

function sourceOwners(entries, window, source) {
  return window.interiorIndexes.filter((index) => hasSource(entries[index].point, source));
}

function automaticB314(entries, window, settings, angles) {
  const table1Owners = sourceOwners(entries, window, 'vertex');
  const table2Owners = sourceOwners(entries, window, 'table2');
  const planTurn = angles.planAngleDeg >= settings.minimumPlanTurnAngleDeg && table1Owners.length > 0;
  const profileTurn = angles.profileAngleDeg >= settings.minimumProfileTurnAngleDeg && table2Owners.length > 0;
  const classification = geometricClass(planTurn, profileTurn, settings);
  if (!classification) return null;
  return Object.freeze({
    bendClass: planTurn ? 'cold-field' : 'elastic',
    classification,
    classificationReason: planTurn && profileTurn
      ? 'TABLE1_PLAN_PRECEDENCE_COMPOUND_COLD_FIELD'
      : planTurn ? 'TABLE1_PLAN_TURN_COLD_FIELD' : 'TABLE2_PROFILE_ONLY_ELASTIC',
    sourceBasis: planTurn && profileTurn
      ? 'TABLE_1_AND_TABLE_2_COMPOUND'
      : planTurn ? 'TABLE_1_PLAN' : 'TABLE_2_PROFILE_ONLY',
    ownerIndexes: Object.freeze(planTurn ? table1Owners : table2Owners),
    ...angles,
  });
}

function generalClassification(window, settings, angles) {
  const planTurn = angles.planAngleDeg >= settings.minimumPlanTurnAngleDeg;
  const profileTurn = angles.profileAngleDeg >= settings.minimumProfileTurnAngleDeg;
  const classification = geometricClass(planTurn, profileTurn, settings);
  if (!classification) return null;
  const bendClass = settings.designBasis === 'gre'
    ? 'gre-placeholder'
    : settings.designBasis === 'default-metallic' ? 'standard' : settings.bendClass;
  return Object.freeze({
    bendClass,
    classification,
    classificationReason: settings.designBasis === 'gre'
      ? 'GRE_POLICY_PLACEHOLDER'
      : settings.designBasis === 'default-metallic' ? 'DEFAULT_METALLIC_TURN' : 'LEGACY_GLOBAL_CLASS',
    sourceBasis: 'GEOMETRY_AUTHORITY',
    ownerIndexes: Object.freeze([...window.interiorIndexes]),
    ...angles,
  });
}

export function classifyAngleWindow(entries, window, settings) {
  const incoming = vector(entries[window.leftSegment].point, entries[window.leftSegment + 1].point);
  const outgoing = vector(entries[window.rightSegment].point, entries[window.rightSegment + 1].point);
  const angles = Object.freeze({
    planAngleDeg: planAngleDeg(incoming, outgoing),
    profileAngleDeg: profileAngleDeg(incoming, outgoing),
    turnAngleDeg: angleDeg(incoming, outgoing),
  });
  if (!Number.isFinite(angles.turnAngleDeg)) return null;
  if (settings.designBasis === 'asme-b31.4' && settings.classificationMode === 'source-authority-auto') {
    return automaticB314(entries, window, settings, angles);
  }
  return generalClassification(window, settings, angles);
}

export function resolveRadiusForClassification(classification, screening) {
  const { settings, outsideDiameterMm } = screening;
  if (classification.bendClass === 'standard') {
    return Object.freeze({
      radiusBasis: 'DEFAULT_MULTIPLIER',
      radiusD: settings.standardRadiusMultiplierD,
      radiusMm: outsideDiameterMm ? settings.standardRadiusMultiplierD * outsideDiameterMm : null,
      policyReady: true,
    });
  }
  if (classification.bendClass === 'elastic') {
    const radiusMm = screening.elasticGoverningRadiusMm;
    return Object.freeze({
      radiusBasis: 'B31_4_ELASTIC',
      radiusD: outsideDiameterMm && radiusMm ? radiusMm / outsideDiameterMm : null,
      radiusMm,
      policyReady: true,
    });
  }
  if (classification.bendClass === 'gre-placeholder') {
    return Object.freeze({ radiusBasis: 'GRE_PLACEHOLDER', radiusD: null, radiusMm: null, policyReady: false });
  }
  if (settings.coldFieldRadiusMode === 'project-multiplier') {
    return Object.freeze({
      radiusBasis: 'B31_4_COLD_FIELD_MULTIPLIER',
      radiusD: settings.coldFieldRadiusMultiplierD,
      radiusMm: outsideDiameterMm ? settings.coldFieldRadiusMultiplierD * outsideDiameterMm : null,
      policyReady: true,
    });
  }
  const policy = screening.coldFieldPolicy;
  return Object.freeze({
    radiusBasis: 'B31_4_COLD_FIELD_SIZE_BAND',
    radiusD: policy?.governingRadiusD,
    radiusMm: policy?.governingRadiusMm,
    policyReady: Boolean(policy?.normalCodeRadiusD),
    qualificationRequired: Boolean(policy?.qualificationEvidenceRequired),
  });
}
