import { PS_FAMILY_STATUS } from './ps-family-clash-audit-contract.js';
import { uniqueSorted } from './ps-family-token-utils.js';
import { normalizeMemberKey } from './ps-family-evidence-graph-shared.js';

export function createEvidenceCoverageReports(families, expectedRows, detailRows, config) {
  const actualMembers = families.flatMap((family) => (family.members || []).map((member) => ({
    ...member,
    familyId: family.familyId,
  })));
  const byKey = groupMembersByKey(actualMembers);
  const detailByKey = new Map(detailRows.map((row) => [
    normalizeMemberKey(row.exactMemberKey || row.displayName),
    row,
  ]));
  const coverageRows = expectedRows.map((expected, index) => coverageRow(
    expected,
    index,
    byKey,
    detailByKey,
    config,
  ));
  const expectedKeys = new Set(expectedRows.map((row) => normalizeMemberKey(
    row.exactMemberKey || row.displayName || row.rawItemName,
  )).filter(Boolean));
  return {
    coverageRows,
    missingRows: coverageRows.filter((row) => row.status === PS_FAMILY_STATUS.MISSING),
    duplicateRows: duplicateMemberRows(byKey),
    unexpectedInFamilyRows: expectedKeys.size
      ? actualMembers.filter((member) => !expectedKeys.has(normalizeMemberKey(member.memberId)))
      : [],
  };
}

export function createEvidenceSourceVsPosRows(families, coverageRows, posFamilies) {
  return families.map((family) => {
    const rows = coverageRows.filter((row) => row.sourceFamily === family.familyId);
    return {
      source: family.familyId,
      posFamilyCount: uniqueSorted(rows.map((row) => row.posFamilyId).filter(Boolean)).length,
      elementCount: family.members?.length || 0,
      foundElementCount: rows.filter((row) => row.found).length,
      missingElementCount: rows.filter((row) => !row.found).length,
      clashCount: 0,
      evidenceCount: family.members?.length || 0,
      outOfFamilyCount: 0,
      posFamilyIds: uniqueSorted(rows.map((row) => row.posFamilyId).filter(Boolean)),
      lineFamilies: uniqueSorted(posFamilies.flatMap((row) => row.lineFamilies || [])),
      remarks: 'Counts derived from XML-free relationship and member-chain evidence.',
    };
  });
}

function groupMembersByKey(actualMembers) {
  const byKey = new Map();
  actualMembers.forEach((member) => {
    const key = normalizeMemberKey(member.memberId);
    if (!key) return;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(member);
  });
  return byKey;
}

function coverageRow(expected, index, byKey, detailByKey, config) {
  const key = normalizeMemberKey(expected.exactMemberKey || expected.displayName || expected.rawItemName);
  const matches = byKey.get(key) || [];
  const detail = detailByKey.get(key);
  const status = matches.length > 1
    ? PS_FAMILY_STATUS.FOUND_DUPLICATE_CLASH
    : matches.length === 1 ? PS_FAMILY_STATUS.FOUND : PS_FAMILY_STATUS.MISSING;
  return {
    no: index + 1,
    sourceFamily: config.sourceFamily || expected.familyRoot || matches[0]?.familyId || '',
    expectedMember: expected.displayName || expected.rawItemName || expected.exactMemberKey,
    expectedRawName: expected.rawItemName || '',
    exactMemberKey: expected.exactMemberKey || key,
    status,
    found: matches.length > 0,
    clashCount: 0,
    evidenceCount: matches.length,
    evidenceIds: matches.map((member) => `SSRB-MEMBER:${member.memberId}`),
    againstMembers: matches.map((member) => member.memberId),
    lineFamilies: [],
    fullLineTags: [],
    branchNodes: [],
    sourceObjects: matches.map((member) => member.familyId),
    minDistance: null,
    detailAvailable: Boolean(detail),
    posFamilyId: detail?.posFamilyId || '',
    p1bore: detail?.p1bore ?? null,
    pipe: detail?.pipe || '',
    lineFamily: detail?.lineFamily || '',
    supportText: detail?.supportText || '',
    supportGap: detail?.supportGap || '',
    reference: detail?.reference || '',
    position: detail?.position || null,
    positionText: detail?.positionText || '',
    isometricNotes: detail?.isometricNotes || '',
    remarks: matches.length
      ? 'Expected member found in XML-free evidence graph.'
      : 'Expected member not found in XML-free evidence graph.',
  };
}

function duplicateMemberRows(byKey) {
  return [...byKey.entries()]
    .filter(([, rows]) => rows.length > 1)
    .map(([exactMemberKey, rows]) => ({
      exactMemberKey,
      member: rows[0].memberId,
      evidenceCount: rows.length,
      familyIds: uniqueSorted(rows.map((row) => row.familyId)),
    }));
}
