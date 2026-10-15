export const SUPPORT_RESTRAINT_INTENT_SCHEMA = 'SupportRestraintIntent.v1';

const FUNCTION_ORDER = Object.freeze([
  'REST', 'GUIDE', 'LINE_STOP', 'HOLD_DOWN', 'ANCHOR', 'SPRING', 'CLAMP', 'PIPE_SHOE',
]);
const ATTRIBUTE_KEYS = Object.freeze([
  'RESTRAINT_FUNCTION', 'SUPPORT_FUNCTION', 'FUNCTION', 'CMPSUPTYPE', 'MDSSUPPTYPE',
  'SUPPORT_TYPE', 'SUPPORTTYPE', 'TYPE_CODE',
]);
const DESCRIPTION_KEYS = Object.freeze(['DTXR', 'DESCRIPTION', 'DESC', 'NAME']);

export function classifySupportRestraintIntent(family = {}) {
  const evidence = [];
  for (const member of family.members || []) {
    const attrs = member.attributes || {};
    for (const key of ATTRIBUTE_KEYS) {
      const value = text(attrs[key]);
      for (const supportFunction of classifyText(value)) {
        evidence.push(intentEvidence(supportFunction, 'EXPLICIT_ATTRIBUTE', 'HIGH', member, key, value));
      }
    }
    for (const supportFunction of classifyRole(member.semanticRole)) {
      evidence.push(intentEvidence(supportFunction, 'SEMANTIC_MEMBER_ROLE', 'MEDIUM', member, 'semanticRole', member.semanticRole));
    }
    for (const key of DESCRIPTION_KEYS) {
      const value = text(attrs[key]);
      for (const supportFunction of classifyText(value)) {
        evidence.push(intentEvidence(supportFunction, 'DESCRIPTION_HINT', 'LOW', member, key, value));
      }
    }
  }
  const intendedFunctions = FUNCTION_ORDER
    .filter((supportFunction) => evidence.some((row) => row.supportFunction === supportFunction))
    .map((supportFunction) => {
      const rows = evidence.filter((row) => row.supportFunction === supportFunction);
      return {
        supportFunction,
        confidence: maximumConfidence(rows.map((row) => row.confidence)),
        evidenceIds: rows.map((row) => row.evidenceId),
        evidenceClasses: unique(rows.map((row) => row.evidenceClass)),
        memberIds: unique(rows.map((row) => row.supportMemberId)),
      };
    });
  const conflicts = intentConflicts(intendedFunctions.map((row) => row.supportFunction));
  return {
    schema: SUPPORT_RESTRAINT_INTENT_SCHEMA,
    supportFamilyId: family.familyId || null,
    intendedFunctions,
    evidence,
    conflicts,
    intentStatus: conflicts.length
      ? 'CONFLICTING_INTENT'
      : intendedFunctions.length ? 'INTENT_CLASSIFIED' : 'UNCLASSIFIED_INTENT',
  };
}

function classifyText(value) {
  const normalized = text(value).toUpperCase();
  if (!normalized) return [];
  const functions = [];
  if (/\bANCHOR\b|\bFIXED\b|FULL\s*RESTRAINT/u.test(normalized)) functions.push('ANCHOR');
  if (/LINE\s*STOP|LINESTOP|AXIAL\s*STOP/u.test(normalized)) functions.push('LINE_STOP');
  if (/\bGUIDE\b|GUIDE\s*PLATE/u.test(normalized)) functions.push('GUIDE');
  if (/HOLD[-_ ]?DOWN|UPLIFT\s*RESTRAINT|TOP\s*CLAMP/u.test(normalized)) functions.push('HOLD_DOWN');
  if (/\bSPRING\b|VARIABLE\s*SUPPORT|CONSTANT\s*SUPPORT/u.test(normalized)) functions.push('SPRING');
  if (/\bCLAMP\b|U[-_ ]?BOLT/u.test(normalized)) functions.push('CLAMP');
  if (/\bREST\b|SLIDING\s*SUPPORT|RESTING\s*SUPPORT/u.test(normalized)) functions.push('REST');
  if (/PIPE\s*SHOE|\bSHOE\b|\bSH[-_ ]?\d+/u.test(normalized)) functions.push('PIPE_SHOE');
  return unique(functions);
}

function classifyRole(role) {
  return ({
    PIPE_SHOE: ['PIPE_SHOE'],
    GUIDE_MEMBER: ['GUIDE'],
    LINE_STOP_MEMBER: ['LINE_STOP'],
    CLAMP_MEMBER: ['CLAMP'],
    SPRING_MEMBER: ['SPRING'],
    ANCHOR_MEMBER: ['ANCHOR'],
  })[role] || [];
}

function intentEvidence(supportFunction, evidenceClass, confidence, member, sourceKey, sourceValue) {
  return {
    evidenceId: `SSRF-INTENT:${member.memberId || 'UNKNOWN'}:${supportFunction}:${sourceKey}`,
    supportFunction,
    evidenceClass,
    confidence,
    supportMemberId: member.memberId || null,
    semanticRole: member.semanticRole || 'OTHER_FAMILY_MEMBER',
    sourceKey,
    sourceValue,
  };
}

function intentConflicts(functions) {
  const set = new Set(functions);
  const conflicts = [];
  if (set.has('ANCHOR') && set.has('SPRING')) conflicts.push(conflict('ANCHOR_SPRING_INTENT_CONFLICT', ['ANCHOR', 'SPRING']));
  if (set.has('SPRING') && set.has('LINE_STOP')) conflicts.push(conflict('SPRING_LINE_STOP_INTENT_CONFLICT', ['SPRING', 'LINE_STOP']));
  return conflicts;
}
function conflict(code, functions) {
  return {
    exceptionCode: code,
    severity: 'WARN',
    functions,
    message: `Conflicting intended support functions were identified: ${functions.join(' + ')}.`,
  };
}
function maximumConfidence(values) {
  const rank = { NONE: 0, LOW: 1, MEDIUM: 2, HIGH: 3 };
  return values.reduce((best, value) => (rank[value] || 0) > (rank[best] || 0) ? value : best, 'NONE');
}
function unique(values) { return [...new Set(values.filter(Boolean))].sort(); }
function text(value) { return String(value ?? '').trim(); }
