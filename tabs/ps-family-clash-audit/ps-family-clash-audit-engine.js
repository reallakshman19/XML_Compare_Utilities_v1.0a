import { PS_FAMILY_CLASH_AUDIT_SCHEMA, PS_FAMILY_COVERAGE_ROW_SCHEMA, PS_FAMILY_STATUS } from './ps-family-clash-audit-contract.js';
import { extractFamilyRoot, uniqueSorted } from './ps-family-token-utils.js';

function firstSourceFamily(expectedRows, config) {
  if (config?.sourceFamily) return String(config.sourceFamily).toUpperCase();
  return expectedRows.find((row) => row.familyRoot)?.familyRoot || '';
}

function groupBy(rows, keyFn) {
  const map = new Map();
  rows.forEach((row) => { const key = keyFn(row); if (!key) return; if (!map.has(key)) map.set(key, []); map.get(key).push(row); });
  return map;
}

function detailFields(detail) {
  return { detailAvailable: Boolean(detail), posFamilyId: detail?.posFamilyId || '', p1bore: detail?.p1bore ?? null, pipe: detail?.pipe || '', lineFamily: detail?.lineFamily || '', supportText: detail?.supportText || '', supportGap: detail?.supportGap || '', reference: detail?.reference || '', position: detail?.position || null, positionText: detail?.positionText || '', isometricNotes: detail?.isometricNotes || '' };
}

function summarizeMatches(matches) {
  return { clashNames: matches.map((row) => row.clashName), lineFamilies: uniqueSorted(matches.map((row) => row.against.pipe?.lineFamily)), fullLineTags: uniqueSorted(matches.map((row) => row.against.pipe?.fullLineTag)), branchNodes: uniqueSorted(matches.map((row) => row.against.pipe?.fullBranchNode)), sourceObjects: uniqueSorted(matches.map((row) => row.source.objectName)), minDistance: matches.reduce((min, row) => (row.distance == null ? min : Math.min(min, row.distance)), Infinity) };
}

function sourceRoot(row, config, sourceFamily) { return row.source.familyRoot || extractFamilyRoot(row.source.objectName, config) || extractFamilyRoot((row.source.path || []).join('/'), config) || sourceFamily; }
export function rowLocalFamilyStatus(row, config = {}, sourceFamily = '') { const leftRoot = sourceRoot(row, config, sourceFamily); const rightRoot = row.against.familyRoot || extractFamilyRoot(row.against.memberName, config); return leftRoot && rightRoot && leftRoot !== rightRoot ? PS_FAMILY_STATUS.OUT_OF_FAMILY : 'IN_FAMILY'; }

function createCoverageRows(expectedRows, actualInFamilyByKey, detailByKey, sourceFamily) {
  return expectedRows.map((expected, index) => {
    const matches = actualInFamilyByKey.get(expected.exactMemberKey) || [];
    const summary = summarizeMatches(matches);
    const status = matches.length > 1 ? PS_FAMILY_STATUS.FOUND_DUPLICATE_CLASH : matches.length === 1 ? PS_FAMILY_STATUS.FOUND : PS_FAMILY_STATUS.MISSING;
    return { schema: PS_FAMILY_COVERAGE_ROW_SCHEMA, no: index + 1, sourceFamily, expectedMember: expected.displayName, expectedRawName: expected.rawItemName, exactMemberKey: expected.exactMemberKey, status, found: matches.length > 0, clashCount: matches.length, clashNames: summary.clashNames, againstMembers: uniqueSorted(matches.map((row) => row.against.memberName)), lineFamilies: summary.lineFamilies, fullLineTags: summary.fullLineTags, branchNodes: summary.branchNodes, sourceObjects: summary.sourceObjects, minDistance: Number.isFinite(summary.minDistance) ? summary.minDistance : null, ...detailFields(detailByKey.get(expected.exactMemberKey)), remarks: matches.length ? 'Expected member found in clash XML.' : 'Expected member not found in clash XML.' };
  });
}

function createLineFamilyRows(clashRows) {
  return Array.from(groupBy(clashRows, (row) => row.against.pipe?.lineFamily || 'NO_LINE_FAMILY').entries()).map(([lineFamily, rows]) => ({ lineFamily, fullLineTags: uniqueSorted(rows.map((row) => row.against.pipe?.fullLineTag)), branches: uniqueSorted(rows.map((row) => row.against.pipe?.branch)), members: uniqueSorted(rows.map((row) => row.against.memberName)), clashNames: rows.map((row) => row.clashName), clashCount: rows.length })).sort((a, b) => a.lineFamily.localeCompare(b.lineFamily));
}

function createSourceVsPosFamilyRows(detailRows, coverageRows, clashRows, posFamilies, config) {
  const bySource = groupBy(detailRows, (row) => row.sourceFamily || extractFamilyRoot(row.displayName, config));
  return Array.from(bySource.entries()).map(([source, rows]) => ({ source, posFamilyCount: uniqueSorted(rows.map((row) => row.posFamilyId)).length, elementCount: rows.length, foundElementCount: coverageRows.filter((row) => row.sourceFamily === source && row.found).length, missingElementCount: coverageRows.filter((row) => row.sourceFamily === source && !row.found).length, clashCount: clashRows.filter((row) => row.source.familyRoot === source).length, outOfFamilyCount: clashRows.filter((row) => row.source.familyRoot === source && row.familyStatus === PS_FAMILY_STATUS.OUT_OF_FAMILY).length, posFamilyIds: uniqueSorted(rows.map((row) => row.posFamilyId)), lineFamilies: uniqueSorted(posFamilies.flatMap((family) => family.lineFamilies)), remarks: 'POSFamily count derived from Element Detail CSV.' })).sort((a, b) => a.source.localeCompare(b));
}

function createCoverageLookup(clashRows) { const map = new Map(); clashRows.forEach((row) => { if (!row.against.exactMemberKey || map.has(row.against.exactMemberKey)) return; map.set(row.against.exactMemberKey, row); }); return map; }
function naturalSort(values) { return uniqueSorted(values).sort((a, b) => a.localeCompare(b, undefined, { numeric: true })); }
function rowKey(row) { return row.supportGroup || `${row.lineFamily}_${row.psRoot}`; }
function edgeMembers(row) { return [row.supportA, row.supportB, row.support].filter(Boolean); }
function exception(code, severity, row, reason) { return { exceptionCode: code, severity, supportGroup: row.supportGroup || '', lineFamily: row.lineFamily || '', fullLineTag: row.fullLineTag || '', branchNode: row.branchNode || '', structuralGroup: row.structuralGroup || '', support: row.support || '', supportA: row.supportA || '', supportB: row.supportB || '', sourceInput: row.sourceInput || '', evidenceClash: row.clashName || '', reason }; }
function isDirectRestingSupport(contacts, chains, supports) { return contacts.length > 0 && chains.length === 0 && supports.length === 1; }
function summaryRemarks(contacts, chains, supports) {
  if (isDirectRestingSupport(contacts, chains, supports)) return 'Direct structural resting support.';
  return contacts.length ? 'Valid structure + supports evidence.' : 'Support chain without StructuralGroup.';
}

function suffixNumber(value) { const match = String(value || '').match(/\.(\d+)\b/); return match ? Number(match[1]) : Number.POSITIVE_INFINITY; }
function representativeContact(rows) { return [...rows].sort((a, b) => (/datum/i.test(b.support) ? 1 : 0) - (/datum/i.test(a.support) ? 1 : 0) || suffixNumber(a.support) - suffixNumber(b.support) || a.support.localeCompare(b.support))[0] || null; }
function coordDistance(a, b) { if (!a || !b) return null; return Math.hypot((a.x ?? 0) - (b.x ?? 0), (a.y ?? 0) - (b.y ?? 0), (a.z ?? 0) - (b.z ?? 0)); }
function structuralRoot(row) { return row.structuralRoot || extractFamilyRoot(row.structuralGroup || '') || row.psRoot || ''; }
function proximityContacts(rows, toleranceMm) {
  const representative = representativeContact(rows);
  if (!representative?.point) return rows;
  return rows.filter((row) => { const distance = coordDistance(row.point, representative.point); return distance == null || distance <= toleranceMm; });
}
function formatPoint(value) { return value ? `X=${value.x ?? ''};Y=${value.y ?? ''};Z=${value.z ?? ''}` : ''; }

function createStructureLineProximityRows(structureRows, toleranceMm = 250) {
  const groups = groupBy(structureRows.filter((row) => row.edgeType === 'StructuralContact' && structuralRoot(row) && row.fullLineTag), (row) => `${structuralRoot(row)}|${row.fullLineTag}|${row.branchNode || ''}`);
  const rows = Array.from(groups.values()).map((items, index) => {
    const near = proximityContacts(items, toleranceMm);
    const representative = representativeContact(near) || representativeContact(items);
    const supports = naturalSort(near.map((row) => row.support));
    const root = structuralRoot(items[0]);
    return { no: index + 1, structuralGroupRoot: root, structuralGroupNames: naturalSort(items.map((row) => row.structuralGroup)).join('|'), lineNo: items[0].fullLineTag, lineFamily: items[0].lineFamily, branchNode: items[0].branchNode, supportGroup: items[0].supportGroup, supportsWithin250mm: supports.join('|'), supportCount: supports.length, totalSupportCount: 0, representativeSupport: representative?.support || supports[0] || '', representativeCoordinate: formatPoint(representative?.point), evidenceClashes: naturalSort(near.map((row) => row.clashName)).join('|'), remarks: supports.length === 1 ? 'Direct resting support' : 'Supports within ±250 mm of representative coordinate' };
  }).sort((a, b) => a.structuralGroupRoot.localeCompare(b.structuralGroupRoot) || a.lineNo.localeCompare(b.lineNo));
  const totals = new Map();
  rows.forEach((row) => totals.set(row.structuralGroupRoot, (totals.get(row.structuralGroupRoot) || 0) + row.supportCount));
  return rows.map((row) => ({ ...row, totalSupportCount: totals.get(row.structuralGroupRoot) || row.supportCount }));
}

export function buildSupportChangeReports(structureRows = [], supportRows = [], clashRows = []) {
  const exceptions = [];
  [...structureRows, ...supportRows].forEach((row) => { if (!row.supportGroup) exceptions.push(exception('ORPHAN_STRUCTURAL_GROUP', 'ERROR', row, 'SupportGroup key cannot be formed.')); });
  supportRows.forEach((row) => { if (row.supportRoots?.length > 1 && new Set(row.supportRoots).size > 1) exceptions.push(exception('STRANGER_SUPPORT_PS_WITHIN_SUPPORT_CHAIN', 'WARN', row, 'PS roots differ in support-support chain.')); });
  structureRows.forEach((row) => { if (row.structuralRoot && row.supportRoots?.[0] && row.structuralRoot !== row.supportRoots[0]) exceptions.push(exception('STRANGER_SUPPORT_PS_VS_STRUCTURAL_GROUP', 'ERROR', row, 'StructuralGroup root differs from contacted support root.')); });
  const coverage = createCoverageLookup(clashRows);
  const summaryRows = [], treeRows = [], contactRows = [], chainRows = [], memberRows = [], ledgerRows = [], matrixRows = [];
  Array.from(groupBy([...structureRows, ...supportRows].filter((row) => row.supportGroup && row.lineFamily && row.branchNode), rowKey).entries()).forEach(([supportGroup, rows], index) => {
    const contacts = rows.filter((row) => row.edgeType === 'StructuralContact');
    const chains = rows.filter((row) => row.edgeType === 'SupportChain');
    const supports = naturalSort(rows.flatMap(edgeMembers));
    const structuralGroups = naturalSort(contacts.map((row) => row.structuralGroup));
    const representative = supports[0] || '';
    const clashNames = naturalSort(rows.map((row) => row.clashName));
    const sample = rows[0];
    const directResting = isDirectRestingSupport(contacts, chains, supports);
    if (!contacts.length) exceptions.push(exception('SUPPORT_GROUP_WITHOUT_STRUCTURAL_GROUP', 'ERROR', sample, 'Support chain has no StructuralGroup contact.'));
    const covered = supports.map((support) => coverage.get(support.toUpperCase())).find(Boolean);
    summaryRows.push({ no: index + 1, line: sample.fullLineTag, branchNode: sample.branchNode, lineFamily: sample.lineFamily, psRoot: sample.psRoot, supportGroup, structuralGroupCount: structuralGroups.length, supportCount: supports.length, supportMembers: supports, evidenceClashes: clashNames, status: exceptions.some((item) => item.supportGroup === supportGroup && item.severity === 'ERROR') ? 'ERROR' : 'OK', remarks: summaryRemarks(contacts, chains, supports) });
    treeRows.push({ supportGroup, treeText: `Line: ${sample.fullLineTag}\n└─ Branch: ${sample.branchNode}\n   └─ SupportGroup: ${supportGroup}\n      ├─ StructuralGroup\n${structuralGroups.map((item) => `      │  └─ ${item}`).join('\n') || '      │  └─ None'}\n      └─ Supports\n${supports.map((item) => `         ├─ ${item}`).join('\n') || '         └─ None'}` });
    contacts.forEach((row) => contactRows.push({ supportGroup, structuralGroup: row.structuralGroup, support: row.support, line: row.fullLineTag, lineFamily: row.lineFamily, branchNode: row.branchNode, contactClash: row.clashName, distance: row.distance, point: row.point, remarks: directResting ? 'Direct structural resting support' : 'Structural contact detected' }));
    chains.forEach((row) => chainRows.push({ supportGroup, supportA: row.supportA, supportB: row.supportB, line: row.fullLineTag, lineFamily: row.lineFamily, branchNode: row.branchNode, supportClash: row.clashName, distance: row.distance, point: row.point, remarks: 'Support chain edge' }));
    structuralGroups.forEach((member) => memberRows.push({ supportGroup, representativeSupport: representative, support: member, memberType: 'StructuralGroup', connectedTo: supports.filter((support) => contacts.some((row) => row.structuralGroup === member && row.support === support)), evidenceClashes: contacts.filter((row) => row.structuralGroup === member).map((row) => row.clashName), coverageRole: 'StructuralGroup', remarks: directResting ? 'Resting support structure group' : 'Structure group in family' }));
    supports.forEach((support, idx) => memberRows.push({ supportGroup, representativeSupport: representative, support, memberType: 'Support', connectedTo: rows.filter((row) => edgeMembers(row).includes(support) || row.support === support).flatMap((row) => [row.supportA, row.supportB, row.structuralGroup]).filter((item) => item && item !== support), evidenceClashes: rows.filter((row) => edgeMembers(row).includes(support) || row.support === support).map((row) => row.clashName), coverageRole: idx === 0 && covered ? `Covered by ${covered.clashName}` : idx === 0 ? 'Representative' : `Same SupportGroup ${representative}`, remarks: directResting ? 'Direct resting support' : idx === 0 ? 'Representative support' : 'Support chain member' }));
    rows.forEach((row) => { ledgerRows.push({ sourceInput: row.sourceInput, clashName: row.clashName, objectAType: row.objectA?.objectType, objectBType: row.objectB?.objectType, lineFamily: row.lineFamily, branchNode: row.branchNode, supportGroup, distance: row.distance, parsedEdge: row.parsedEdge }); matrixRows.push({ supportGroup, from: row.structuralGroup || row.supportA, to: row.support || row.supportB, edgeType: row.edgeType, clash: row.clashName, sourceInput: row.sourceInput, status: 'Connected' }); });
  });
  return { supportSummaryRows: summaryRows, lineSupportTreeRows: treeRows, structureContactRows: contactRows, supportChainRows: chainRows, supportMemberRows: memberRows, supportExceptionRows: exceptions, inputEvidenceRows: ledgerRows, connectivityMatrixRows: matrixRows, structureLineProximityRows: createStructureLineProximityRows(structureRows, 250) };
}

export function buildPsClashReportRows(psClashRows = [], clashRows = []) { return buildSupportChangeReports([], psClashRows, clashRows).supportMemberRows.map((row) => ({ psClashName: '', source: row.supportGroup, sourceObject: row.support, pipe: '', lineFamily: '', fullLineTag: '', branchNode: '', coverageInClashReport: row.coverageRole.startsWith('Covered') ? 'Yes' : 'No', clashNo: row.coverageRole.replace('Covered by ', ''), remarks: row.remarks })); }

export function buildPsFamilyClashAudit(input) {
  const config = input?.config || {}; const expectedRows = input?.expectedRows || []; const detailRows = input?.elementDetailRows || []; const posFamilies = input?.posFamilies || []; const sourceFamily = firstSourceFamily(expectedRows, config); const detailByKey = new Map(detailRows.map((row) => [row.exactMemberKey, row])); const diagnostics = [...(input?.diagnostics || [])];
  const clashRows = (input?.clashRows || []).map((row) => { const familyStatus = rowLocalFamilyStatus(row, config, sourceFamily); const detail = detailByKey.get(row.against.exactMemberKey); if (!detail && row.against?.memberName) diagnostics.push({ level: 'WARN', code: 'DETAIL_ROW_NOT_FOUND_FOR_CLASH_MEMBER', message: `${row.against.memberName} has no Element Detail CSV row.` }); return { ...row, familyStatus, elementDetail: detailFields(detail) }; });
  const actualInFamilyByKey = groupBy(clashRows.filter((row) => row.familyStatus !== PS_FAMILY_STATUS.OUT_OF_FAMILY), (row) => row.against.exactMemberKey); const expectedKeySet = new Set(expectedRows.map((row) => row.exactMemberKey)); const coverageRows = createCoverageRows(expectedRows, actualInFamilyByKey, detailByKey, sourceFamily); const missingRows = coverageRows.filter((row) => row.status === PS_FAMILY_STATUS.MISSING); const duplicateRows = Array.from(actualInFamilyByKey.entries()).filter(([, rows]) => rows.length > 1).map(([exactMemberKey, rows]) => ({ exactMemberKey, member: rows[0].against.memberName, clashCount: rows.length, clashNames: rows.map((row) => row.clashName), sourceObjects: uniqueSorted(rows.map((row) => row.source.objectName)) }));
  const outOfFamilyRows = clashRows.filter((row) => row.familyStatus === PS_FAMILY_STATUS.OUT_OF_FAMILY); const unexpectedInFamilyRows = clashRows.filter((row) => row.familyStatus !== PS_FAMILY_STATUS.OUT_OF_FAMILY && !expectedKeySet.has(row.against.exactMemberKey)); const lineFamilyRows = createLineFamilyRows(clashRows); const sourceVsPosFamilyRows = createSourceVsPosFamilyRows(detailRows, coverageRows, clashRows, posFamilies, config);
  const supportReports = buildSupportChangeReports(input?.structureGroupRows || [], input?.supportChainRows || input?.psClashRows || [], clashRows); const psClashRows = input?.psClashRows || []; const psClashReportRows = buildPsClashReportRows(psClashRows, clashRows);
  const summary = { sourceFamily, expectedCount: expectedRows.length, clashCount: clashRows.length, psClashCount: psClashRows.length, supportGroupCount: supportReports.supportSummaryRows.length, supportExceptionCount: supportReports.supportExceptionRows.length, foundExactCount: coverageRows.filter((row) => row.found).length, missingCount: missingRows.length, outOfFamilyCount: outOfFamilyRows.length, duplicateMemberCount: duplicateRows.length, unexpectedInFamilyCount: unexpectedInFamilyRows.length, posFamilyCount: posFamilies.length, psClashReportCount: psClashReportRows.length, structureLineProximityCount: supportReports.structureLineProximityRows.length, coveragePct: expectedRows.length ? Number(((coverageRows.filter((row) => row.found).length / expectedRows.length) * 100).toFixed(2)) : 0 };
  return { schema: PS_FAMILY_CLASH_AUDIT_SCHEMA, summary, coverageRows, clashRows, psClashRows, psClashReportRows, missingRows, outOfFamilyRows, duplicateRows, unexpectedInFamilyRows, lineFamilyRows, posFamilyRows: posFamilies, sourceVsPosFamilyRows, diagnostics, ...supportReports };
}
