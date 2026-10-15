import { createHash } from 'node:crypto';

export const CII_OWNER_GOLDEN_SCHEMA = 'CiiOwnerLexicalRelationGolden.v1';
export const CII_OWNER_RECONCILIATION_SCHEMA = 'CiiOwnerLexicalReconciliation.v1';
export const CII_OWNER_GOLDEN_STATUS = Object.freeze({
  MISSING: 'BLOCKED_AUTHENTIC_OWNER_GOLDEN_MISSING',
  CUSTODY: 'BLOCKED_OWNER_GOLDEN_CUSTODY',
  PARSE: 'BLOCKED_OWNER_GOLDEN_PARSE_OR_CARDINALITY',
  EXCEPTIONS: 'BLOCKED_OWNER_GOLDEN_EXCEPTIONS',
  ATTESTATION: 'TECHNICALLY_RECONCILED_OWNER_ATTESTATION_PENDING',
});
const values = ['MATCHED', 'REVIEWABLE', 'AMBIGUOUS', 'MISSING', 'INVALID'];
const countSummary = (rows) => Object.fromEntries(values.map((state) =>
  [state, rows.filter((row) => row.disposition === state).length]));
const sha256 = (bytes) => createHash('sha256').update(bytes).digest('hex');
const exact = (value) => String(value ?? '');  // NEVER casefold/normalize lexical identity.
const key = (sourceId, sourceNodeId) => sourceId + ':' + sourceNodeId;
const frozen = (value) => Object.freeze(value);
const natural = (a, b) => String(a).localeCompare(String(b), undefined, { numeric: true });
const unique = (items) => [...new Set(items)];
const refShape = /^https:\/\/github\.com\/[^/]+\/[^/]+\/(?:issues|pull)\/\d+(?:#issuecomment-\d+)?$/;
const isSha = (value) => /^[a-f0-9]{64}$/.test(exact(value));
function blocked(status, reasons = [], extra = {}) {
  return frozen({
    schema: CII_OWNER_RECONCILIATION_SCHEMA, status,
    authority: 'TEST_ONLY_UNATTESTED_OWNER_INPUT_NEVER_PHYSICAL_BIND_AUTHORITY',
    ownerAccepted: false, mergerAuthority: false, canAuthorizeWriter2: false,
    rows: frozen([]), summary: frozen(countSummary([])),
    blockers: frozen(reasons), ...extra,
  });
}
function parseLines(raw) {
  // The intake is deliberately strict: no ignored prose, comments, empty
  // names, member coercion, or punctuation/zero-padding corrections.
  // Each nonblank row is either S1<TAB>PS...<TAB>SL..., or PS... -> SL...
  // (->, =>, or →). The latter leaves SOURCE-member provenance unresolved.
  const lines = raw.split(/\n/);
  const records = [];
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i].replace(/\r$/, '');
    if (!line.trim()) continue;
    let parts;
    if (line.includes('\t')) {
      const columns = line.split('\t');
      if (columns.length === 3) parts = {
        sourceId: columns[0], sourceLabel: columns[1], targetLabel: columns[2],
      };
    } else {
      const m = line.match(/^(?:(S[123]):\s*)?(.*?)\s*(?:→|->|=>)\s*(.*?)$/);
      if (m) parts = { sourceId: m[1] || '', sourceLabel: m[2], targetLabel: m[3] };
    }
    const sourceId = exact(parts?.sourceId);
    const sourceLabel = exact(parts?.sourceLabel);
    const targetLabel = exact(parts?.targetLabel);
    const reasons = [];
    if (!parts) reasons.push('UNPARSEABLE_LEXICAL_RELATION');
    if (sourceId && !['S1','S2','S3'].includes(sourceId)) reasons.push('UNKNOWN_SOURCE_MEMBER');
    if (!sourceLabel || sourceLabel !== sourceLabel.trim()) reasons.push('SOURCE_LABEL_EMPTY_OR_UNTRIMMED');
    if (!targetLabel || targetLabel !== targetLabel.trim()) reasons.push('TARGET_LABEL_EMPTY_OR_UNTRIMMED');
    if (sourceLabel.includes('\t') || targetLabel.includes('\t')) reasons.push('LEXICAL_COLUMN_DELIMITER');
    const anomalies = [
      ...(/\.{2,}/.test(sourceLabel) || /\.{2,}/.test(targetLabel) ? ['REPEATED_DOT_PUNCTUATION'] : []),
      ...(/SL-275-A\.8/.test(targetLabel) ? ['SUFFIX_NEEDS_OWNER_ADJUDICATION'] : []),
    ];
    records.push(frozen({
      ordinal: records.length + 1, physicalLine: i + 1,
      rawLine: line, sourceId, sourceLabel, targetLabel,
      invalidReasons: frozen(reasons), lexicalAnomalies: frozen(anomalies),
    }));
  }
  return records;
}
function indexes(sourceRows, targetNodes) {
  const sources = new Map(); const targets = new Map();
  for (const row of sourceRows || []) {
    if (!row || !row.sourceId || !row.sourceNodeId || !row.sourceNodeName) continue;
    const label = exact(row.sourceNodeName);
    if (!sources.has(label)) sources.set(label, []);
    sources.get(label).push(row);
  }
  for (const node of targetNodes || []) {
    const label = exact(node?.nodeName);
    if (!label || node?.id == null) continue;
    if (!targets.has(label)) targets.set(label, []);
    targets.get(label).push(node);
  }
  return { sources, targets };
}
export function reconcileCiiOwnerLexicalGolden({
  goldenBytes = null, declaredSha256 = null, declaredRowCount = null,
  ownerEvidenceRef = null, sourceRows = [], targetNodes = [],
  sourceSetSha256 = null, requiredSourceSetSha256 = null,
  targetOriginalSha256 = null, requiredTargetOriginalSha256 = null,
} = {}) {
  const details = frozen({
    declaredSha256: declaredSha256 || null, declaredRowCount,
    ownerEvidenceRef: ownerEvidenceRef || null,
    sourceSetSha256: sourceSetSha256 || null, targetOriginalSha256: targetOriginalSha256 || null,
  });
  if (goldenBytes == null) return blocked(CII_OWNER_GOLDEN_STATUS.MISSING,
    ['COMPLETE_ORIGINAL_OWNER_LEXICAL_TEXT_REQUIRED'], { custody: details });
  if (!(goldenBytes instanceof Uint8Array)) return blocked(CII_OWNER_GOLDEN_STATUS.CUSTODY,
    ['OWNER_GOLDEN_MUST_BE_ORIGINAL_BYTE_SEQUENCE'], { custody: details });
  const actualSha256 = sha256(goldenBytes);
  const custody = frozen({ ...details, actualSha256, byteCount: goldenBytes.byteLength });
  const errors = [];
  if (!isSha(declaredSha256) || declaredSha256 !== actualSha256) errors.push('OWNER_GOLDEN_SHA256_MISMATCH');
  if (!Number.isSafeInteger(declaredRowCount) || declaredRowCount <= 0) errors.push('OWNER_ROW_CARDINALITY_NOT_PINNED');
  if (!refShape.test(exact(ownerEvidenceRef))) errors.push('OWNER_GOLDEN_PROVENANCE_REFERENCE_REQUIRED');
  if (!isSha(requiredSourceSetSha256) || sourceSetSha256 !== requiredSourceSetSha256)
    errors.push('SOURCE_SET_DIGEST_MISMATCH');
  if (!isSha(requiredTargetOriginalSha256) || targetOriginalSha256 !== requiredTargetOriginalSha256)
    errors.push('TARGET_ORIGINAL_DIGEST_MISMATCH');
  if (errors.length) return blocked(CII_OWNER_GOLDEN_STATUS.CUSTODY, errors, { custody });
  let raw;
  try { raw = new TextDecoder('utf-8', { fatal: true }).decode(goldenBytes); }
  catch { return blocked(CII_OWNER_GOLDEN_STATUS.PARSE, ['OWNER_GOLDEN_UTF8_INVALID'], { custody }); }
  const records = parseLines(raw);
  if (records.length !== declaredRowCount) return blocked(CII_OWNER_GOLDEN_STATUS.PARSE,
    ['OWNER_GOLDEN_ROW_COUNT_MISMATCH'], { custody,
      observedRowCount: records.length, declaredRowCount });
  const { sources, targets } = indexes(sourceRows, targetNodes);
  const seen = new Map(); const targetNamesBySource = new Map();
  for (const record of records) {
    const labelKey = record.sourceId + '|' + record.sourceLabel;
    if (!targetNamesBySource.has(labelKey)) targetNamesBySource.set(labelKey, new Set());
    targetNamesBySource.get(labelKey).add(record.targetLabel);
  }
  const results = records.map((record) => {
    const rawKey = record.sourceId + '\u0000' + record.sourceLabel + '\u0000' + record.targetLabel;
    const duplicateIndex = seen.get(rawKey) || 0;
    seen.set(rawKey, duplicateIndex + 1);
    const candidateSources = (sources.get(record.sourceLabel) || [])
      .filter((row) => !record.sourceId || row.sourceId === record.sourceId)
      .sort((a,b) => natural(a.rowKey,b.rowKey));
    const candidateTargets = [...(targets.get(record.targetLabel) || [])]
      .sort((a,b) => natural(a.id,b.id));
    const candidateSourceKeys = candidateSources.map((row) => key(row.sourceId,row.sourceNodeId));
    const candidateTargetNodeIds = candidateTargets.map((node) => exact(node.id));
    const reasons = [...record.invalidReasons];
    const nameSet = targetNamesBySource.get(record.sourceId + '|' + record.sourceLabel);
    if (duplicateIndex) reasons.push('DUPLICATE_OWNER_RELATION_PRESERVED');
    if (nameSet.size > 1) reasons.push('ONE_SOURCE_LABEL_MULTIPLE_EXPECTED_TARGET_LABELS');
    if (!record.sourceId) reasons.push('SOURCE_MEMBER_PROVENANCE_NOT_SUPPLIED');
    if (candidateSources.length > 1) reasons.push('SOURCE_LABEL_REUSED_ON_MULTIPLE_PHYSICAL_NODES');
    if (candidateTargets.length > 1) reasons.push('TARGET_LABEL_REUSED_ON_MULTIPLE_PHYSICAL_NODES');
    if (!record.sourceId && candidateSources.length) {
      const memberIds = unique(candidateSources.map((row) => row.sourceId));
      if (memberIds.length > 1) reasons.push('SOURCE_MEMBER_PROVENANCE_AMBIGUOUS');
    }
    if (!candidateSources.length) reasons.push('SOURCE_LABEL_NOT_FOUND_IN_PHYSICAL_CENSUS');
    if (!candidateTargets.length) reasons.push('TARGET_LABEL_NOT_FOUND_IN_PHYSICAL_TARGET');
    const observed = candidateSources.flatMap((row) => (row.targetNodeIds || [])
      .map((targetNodeId) => frozen({
        sourceKey: row.rowKey, targetNodeId: exact(targetNodeId),
        bound: row.identityBound === true, confidence: row.confidence || 'UNRESOLVED',
        physicalCensusState: row.state || (row.identityBound ? 'BOUND' : 'UNRESOLVED'),
        correspondenceIds: frozen([...(row.correspondenceIds || [])]),
        evidenceBasis: frozen([...(row.evidenceBases || [])]),
      })));
    let disposition;
    if (record.invalidReasons.length) disposition = 'INVALID';
    else if (!candidateSources.length || !candidateTargets.length) disposition = 'MISSING';
    else if (reasons.some((reason) => [
      'DUPLICATE_OWNER_RELATION_PRESERVED',
      'ONE_SOURCE_LABEL_MULTIPLE_EXPECTED_TARGET_LABELS',
      'SOURCE_MEMBER_PROVENANCE_NOT_SUPPLIED',
      'SOURCE_LABEL_REUSED_ON_MULTIPLE_PHYSICAL_NODES',
      'TARGET_LABEL_REUSED_ON_MULTIPLE_PHYSICAL_NODES',
      'SOURCE_MEMBER_PROVENANCE_AMBIGUOUS',
    ].includes(reason))) disposition = 'AMBIGUOUS';
    else if (observed.some((claim) => claim.bound && candidateTargetNodeIds.includes(claim.targetNodeId)))
      disposition = 'MATCHED';
    else {
      disposition = 'REVIEWABLE';
      if (candidateSources[0]?.identityBound) reasons.push('BOUND_TO_DIFFERENT_PHYSICAL_TARGET');
      else reasons.push('NO_SUPPORTED_PHYSICAL_BINDING_TO_EXPECTED_TARGET');
    }
    return frozen({
      ...record, relationId: 'OWNER-ROW-' + String(record.ordinal).padStart(6,'0'),
      disposition, discrepancyType: disposition,
      reasons: frozen(reasons),
      expectedLabelTargetCardinality: nameSet.size,
      sourcePhysicalCandidateCount: candidateSourceKeys.length,
      targetPhysicalCandidateCount: candidateTargetNodeIds.length,
      sourcePhysicalNodeKeys: frozen(candidateSourceKeys),
      targetPhysicalNodeIds: frozen(candidateTargetNodeIds),
      observedConfidence: disposition === 'MATCHED'
        ? (observed.find((claim) => claim.bound && candidateTargetNodeIds.includes(claim.targetNodeId))
          ?.confidence || 'REVIEW') : 'REVIEW',
      observedPhysicalClaims: frozen(observed),
      // Lexical anomaly flags are NOT auto-corrected; they need Owner review.
      ownerAdjudicationRequired: record.lexicalAnomalies.length > 0
        || disposition === 'AMBIGUOUS' || disposition === 'INVALID',
    });
  });
  const counts = frozen(countSummary(results));
  const perMember = [...new Set(results.map((row)=>row.sourceId || 'UNSPECIFIED'))].sort()
    .map((sourceId) => {
      const scoped=results.filter((row)=>(row.sourceId || 'UNSPECIFIED')===sourceId);
      return frozen({
        sourceId, total:scoped.length, ...countSummary(scoped),
        duplicates:scoped.filter((row)=>row.reasons.includes('DUPLICATE_OWNER_RELATION_PRESERVED')).length,
      });
    });
  const qualificationSummary = frozen({
    total:results.length, resolved:counts.MATCHED,
    high:results.filter((row)=>row.disposition==='MATCHED' && row.observedConfidence==='HIGH').length,
    medium:results.filter((row)=>row.disposition==='MATCHED' && row.observedConfidence==='MEDIUM').length,
    review:results.filter((row)=>row.disposition==='REVIEWABLE' || (row.disposition==='MATCHED' && row.observedConfidence==='REVIEW')).length,
    ambiguous:counts.AMBIGUOUS, missing:counts.MISSING, invalid:counts.INVALID,
    duplicates:results.filter((row)=>row.reasons.includes('DUPLICATE_OWNER_RELATION_PRESERVED')).length,
    byMember:frozen(perMember),
  });
  const blockers = [];
  if (counts.AMBIGUOUS || counts.MISSING || counts.INVALID) blockers.push('OWNER_GOLDEN_LEXICAL_EXCEPTIONS_REQUIRE_ADJUDICATION');
  if (results.some((row) => row.ownerAdjudicationRequired))
    blockers.push('OWNER_GOLDEN_ANOMALY_OR_MULTIPLICITY_REQUIRES_ADJUDICATION');
  if (counts.REVIEWABLE) blockers.push('OWNER_EXPECTED_RELATIONS_LACK_SUPPORTED_PHYSICAL_BINDING');
  return frozen({
    schema: CII_OWNER_RECONCILIATION_SCHEMA,
    status: blockers.length ? CII_OWNER_GOLDEN_STATUS.EXCEPTIONS : CII_OWNER_GOLDEN_STATUS.ATTESTATION,
    authority: 'TEST_ONLY_UNATTESTED_OWNER_INPUT_NEVER_PHYSICAL_BIND_AUTHORITY',
    ownerAccepted: false, mergerAuthority: false, canAuthorizeWriter2: false,
    custody, observedRowCount: records.length,
    summary: counts, qualificationSummary, blockers: frozen(blockers),
    rows: frozen(results),
    observedSourcePopulation: (sourceRows || []).length,
    // A file whose checksum equals its declared digest is internally intact;
    // it is NOT proof that an Owner supplied or approved it or that no row was omitted.
    completenessProof: 'PINNED_DECLARED_ROW_COUNT_ONLY_EXTERNAL_OWNER_ATTESTATION_REQUIRED',
  });
}

const csvEscape = (value) => '"' + String(value == null ? '' : value).replace(/"/g,'""') + '"';
export function ciiOwnerLexicalGoldenToCsv(report) {
  const keys = [
    'relationId','ordinal','physicalLine','sourceId','sourceLabel','targetLabel',
    'disposition','observedConfidence','expectedLabelTargetCardinality',
    'sourcePhysicalCandidateCount','targetPhysicalCandidateCount',
    'sourcePhysicalNodeKeys','targetPhysicalNodeIds','observedPhysicalClaims',
    'reasons','lexicalAnomalies','ownerAdjudicationRequired','rawLine',
  ];
  const arrayColumns=new Set(['sourcePhysicalNodeKeys','targetPhysicalNodeIds',
    'observedPhysicalClaims','reasons','lexicalAnomalies']);
  return [keys.join(','),...(report?.rows || []).map((row)=>
    keys.map((k)=>csvEscape(arrayColumns.has(k)?JSON.stringify(row[k]||[]):row[k])).join(','))].join('\n');
}
