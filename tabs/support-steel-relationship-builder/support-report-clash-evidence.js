import {
  SUPPORT_REPORT_DIAGNOSTICS,
  SUPPORT_REPORT_EVIDENCE_SCHEMA,
} from './support-report-contract.js?v=20260909-support-report-parity-2';
import {
  decodeXmlEntities,
  parseNumber,
  stripLeadingSlash,
} from '../ps-family-clash-audit/ps-family-token-utils.js';

const FAMILY_RE = /(?:^|[^A-Z0-9])((?:PS|SL)-\d+[A-Z]?)(?=$|[^A-Z0-9])/i;
const MEMBER_RE = /(?:^|[^A-Z0-9])((?:PS|SL)-\d+[A-Z]?(?:\.\d+)?)(?=$|[^A-Z0-9])/i;
const BRANCH_RE = /\/B(?:RANCH)?[-_A-Z0-9.]*$/i;

export function parseSupportReportClashXml(xmlText, options = {}) {
  const source = String(xmlText || '');
  const diagnostics = [];
  const rows = [];
  const rawClashes = [];
  if (!source.trim()) {
    diagnostics.push(diagnostic('ERROR', SUPPORT_REPORT_DIAGNOSTICS.EMPTY_XML, 'Support Report clash XML is empty.'));
    return result(rows, rawClashes, diagnostics, source, options);
  }

  const sourceUnits = readExchangeUnits(source) || options.sourceUnits || 'm';
  const clashRegex = /<clashresult\b([^>]*)>([\s\S]*?)<\/clashresult>/gi;
  let match;
  while ((match = clashRegex.exec(source))) {
    const attrs = parseAttributes(match[1]);
    const body = match[2];
    const clashName = attrs.name || `Clash${rawClashes.length + 1}`;
    const objectXml = Array.from(body.matchAll(/<clashobject>([\s\S]*?)<\/clashobject>/gi)).map((item) => item[1]);
    const objects = objectXml.map(parseClashObject);
    const point = extractPoint(body, sourceUnits);
    rawClashes.push(rawClashRecord({ attrs, clashName, objects, point, sourceUnits }));

    const pipeCandidates = objects.filter((object) => object.branchNode);
    if (!pipeCandidates.length) {
      diagnostics.push(diagnostic('WARN', SUPPORT_REPORT_DIAGNOSTICS.MISSING_PIPE_SIDE, `${clashName} has no clash object with a piping branch node.`, { clashName }));
      continue;
    }
    const pipeSide = choosePipeSide(pipeCandidates);
    if (pipeCandidates.length > 1) {
      diagnostics.push(diagnostic('WARN', SUPPORT_REPORT_DIAGNOSTICS.AMBIGUOUS_PIPE_SIDE, `${clashName} has more than one branch-bearing object; the strongest primary-support member candidate was selected.`, { clashName }));
    }
    const secondarySide = objects.find((object) => object !== pipeSide) || null;
    const primarySupportMemberId = pipeSide.memberId;
    const secondarySupportFamilyId = secondarySide?.familyId || '';
    if (!primarySupportMemberId) {
      diagnostics.push(diagnostic('WARN', SUPPORT_REPORT_DIAGNOSTICS.MISSING_PRIMARY_MEMBER, `${clashName} has piping context but no PS/SL primary-support member identity.`, { clashName, branchNode: pipeSide.branchNode }));
    }
    if (!secondarySupportFamilyId) {
      diagnostics.push(diagnostic('WARN', SUPPORT_REPORT_DIAGNOSTICS.MISSING_SECONDARY_FAMILY, `${clashName} has no PS/SL family identity on the non-pipe clash object.`, { clashName }));
    }
    if (!primarySupportMemberId || !secondarySupportFamilyId) continue;

    rows.push(Object.freeze({
      schema: SUPPORT_REPORT_EVIDENCE_SCHEMA,
      clashName,
      guid: attrs.guid || '',
      href: attrs.href || '',
      status: attrs.status || '',
      distanceSourceUnits: parseNumber(attrs.distance),
      sourceUnits,
      primarySupportMemberId,
      primarySupportFamilyId: extractFamilyRoot(primarySupportMemberId),
      secondarySupportFamilyId,
      branchNode: pipeSide.branchNode,
      fullLineTag: pipeSide.fullLineTag,
      scope: deriveScope(pipeSide.fullLineTag),
      clashPointGlobalMm: point,
      primaryPath: pipeSide.path,
      secondaryPath: secondarySide?.path || [],
      primaryItemName: pipeSide.itemName,
      secondaryItemName: secondarySide?.itemName || '',
    }));
  }
  if (!rows.length) diagnostics.push(diagnostic('WARN', SUPPORT_REPORT_DIAGNOSTICS.NO_CLASH_RESULTS, 'No usable Support Report clash rows were found.'));
  return result(rows, rawClashes, diagnostics, source, options, sourceUnits);
}

export function groupSupportReportClashEvidence(rows = []) {
  const groups = new Map();
  for (const row of rows || []) {
    if (!row?.secondarySupportFamilyId || !row?.fullLineTag) continue;
    const key = `${token(row.secondarySupportFamilyId)}::${token(row.fullLineTag)}`;
    if (!groups.has(key)) groups.set(key, createGroup(row));
    const group = groups.get(key);
    group.evidenceRows.push(row);
    group.primarySupportMemberIds.add(normalizeMemberId(row.primarySupportMemberId));
    if (row.branchNode) group.branchNodes.add(row.branchNode);
    if (row.clashPointGlobalMm) group.clashPointsGlobalMm.push(row.clashPointGlobalMm);
    mergePaths(group.primaryPaths, row.primaryPath);
    mergePaths(group.secondaryPaths, row.secondaryPath);
  }
  const familyCounts = new Map();
  for (const group of groups.values()) {
    const family = token(group.secondarySupportFamilyId);
    familyCounts.set(family, (familyCounts.get(family) || 0) + 1);
  }
  return [...groups.values()]
    .map((group) => Object.freeze({
      groupId: group.groupId,
      secondarySupportFamilyId: group.secondarySupportFamilyId,
      fullLineTag: group.fullLineTag,
      scope: group.scope,
      branchNodes: [...group.branchNodes].sort(),
      primarySupportMemberIds: [...group.primarySupportMemberIds].filter(Boolean).sort(memberCompare),
      clashPointsGlobalMm: group.clashPointsGlobalMm,
      representativeClashPointGlobalMm: averagePoint(group.clashPointsGlobalMm),
      primaryPaths: group.primaryPaths,
      secondaryPaths: group.secondaryPaths,
      evidenceRows: group.evidenceRows,
      clashCount: group.evidenceRows.length,
      totalSupportPointsOnSecondary: familyCounts.get(token(group.secondarySupportFamilyId)) || 0,
    }));
}

function result(rows, rawClashes, diagnostics, source, options, sourceUnits = readExchangeUnits(source) || options.sourceUnits || 'm') {
  const groups = groupSupportReportClashEvidence(rows);
  return Object.freeze({
    schema: SUPPORT_REPORT_EVIDENCE_SCHEMA,
    sourceUnits,
    rawClashCount: rawClashes.length,
    rowCount: rows.length,
    groupCount: groups.length,
    rawClashes,
    rows,
    groups,
    diagnostics,
  });
}

function rawClashRecord({ attrs, clashName, objects, point, sourceUnits }) {
  const branchBearingObjects = objects.filter((object) => object.branchNode);
  return Object.freeze({
    clashName,
    guid: attrs.guid || '',
    href: attrs.href || '',
    status: attrs.status || '',
    distanceSourceUnits: parseNumber(attrs.distance),
    sourceUnits,
    familyIds: uniqueTokens(objects.map((object) => object.familyId)),
    memberIds: uniqueTokens(objects.map((object) => object.memberId)),
    branchBearingObjectCount: branchBearingObjects.length,
    secondaryFamilyIds: uniqueTokens(objects.filter((object) => !object.branchNode).map((object) => object.familyId), false),
    clashPointGlobalMm: point,
    objectPaths: Object.freeze(objects.map((object) => Object.freeze([...(object.path || [])]))),
    objectItemNames: Object.freeze(objects.map((object) => object.itemName).filter(Boolean)),
  });
}

function parseClashObject(xml) {
  const pathMatch = xml.match(/<pathlink>([\s\S]*?)<\/pathlink>/i);
  const path = pathMatch ? extractNodes(pathMatch[1]) : [];
  const itemName = extractSmartTagValue(xml, 'Item Name') || path[path.length - 1] || '';
  const branchNode = findBranchNode(path);
  return {
    path,
    itemName: cleanName(itemName),
    memberId: extractMemberId(itemName) || findMemberInPath(path),
    familyId: extractFamilyRoot(itemName) || findFamilyInPath(path),
    branchNode: branchNode ? cleanName(branchNode) : '',
    fullLineTag: branchNode ? cleanName(branchNode).replace(BRANCH_RE, '') : '',
  };
}

function choosePipeSide(candidates) {
  return [...candidates].sort((left, right) => scorePipeSide(right) - scorePipeSide(left))[0];
}
function scorePipeSide(object) {
  let score = 0;
  if (object.branchNode) score += 10;
  if (/\.(?:\d+)$/i.test(object.memberId || '')) score += 5;
  if (object.path.some((node) => /-CU-PL(?:-|$)/i.test(node))) score += 3;
  if (object.path.some((node) => /-CU-SU(?:-|$)/i.test(node))) score -= 3;
  return score;
}
function createGroup(row) {
  return {
    groupId: `${token(row.secondarySupportFamilyId)}::${token(row.fullLineTag)}`,
    secondarySupportFamilyId: row.secondarySupportFamilyId,
    fullLineTag: row.fullLineTag,
    scope: row.scope,
    branchNodes: new Set(),
    primarySupportMemberIds: new Set(),
    clashPointsGlobalMm: [],
    primaryPaths: [],
    secondaryPaths: [],
    evidenceRows: [],
  };
}
function mergePaths(target, source) {
  const signature = (source || []).join('\u0000');
  if (signature && !target.some((row) => row.join('\u0000') === signature)) target.push([...(source || [])]);
}
function extractNodes(xml) {
  return Array.from(xml.matchAll(/<node>([\s\S]*?)<\/node>/gi)).map((match) => cleanName(match[1]));
}
function extractSmartTagValue(xml, name) {
  const regex = /<smarttag>\s*<name>([\s\S]*?)<\/name>\s*<value>([\s\S]*?)<\/value>\s*<\/smarttag>/gi;
  let match;
  while ((match = regex.exec(xml))) {
    if (decodeXmlEntities(match[1]).trim().toLowerCase() === name.toLowerCase()) return cleanName(match[2]);
  }
  return '';
}
function findBranchNode(path) {
  return [...(path || [])].reverse().find((node) => BRANCH_RE.test(cleanName(node))) || '';
}
function findMemberInPath(path) {
  for (const node of [...(path || [])].reverse()) {
    const value = extractMemberId(node);
    if (value && /\.\d+$/u.test(value)) return value;
  }
  return '';
}
function findFamilyInPath(path) {
  for (const node of [...(path || [])].reverse()) {
    const value = extractFamilyRoot(node);
    if (value) return value;
  }
  return '';
}
function extractMemberId(value) {
  const match = MEMBER_RE.exec(` ${cleanName(value)}`);
  return match ? match[1].toUpperCase() : '';
}
function extractFamilyRoot(value) {
  const match = FAMILY_RE.exec(` ${cleanName(value)}`);
  return match ? match[1].toUpperCase() : '';
}
function normalizeMemberId(value) {
  const clean = cleanName(value);
  return clean ? `/${clean.replace(/^\/+/, '').toUpperCase()}` : '';
}
function extractPoint(xml, units) {
  const match = xml.match(/<pos3f\s+([^>]*)\/?\s*>/i);
  if (!match) return null;
  const attrs = parseAttributes(match[1]);
  const x = convertToMm(parseNumber(attrs.x), units);
  const y = convertToMm(parseNumber(attrs.y), units);
  const z = convertToMm(parseNumber(attrs.z), units);
  if (![x, y, z].every(Number.isFinite)) return null;
  return { x, y, z };
}
function convertToMm(value, units) {
  if (!Number.isFinite(value)) return null;
  const unit = String(units || '').trim().toLowerCase();
  if (unit === 'm' || unit === 'meter' || unit === 'metre' || unit === 'meters' || unit === 'metres') return value * 1000;
  if (unit === 'cm') return value * 10;
  if (unit === 'in' || unit === 'inch' || unit === 'inches') return value * 25.4;
  if (unit === 'ft' || unit === 'foot' || unit === 'feet') return value * 304.8;
  return value;
}
function readExchangeUnits(xml) {
  const match = String(xml || '').match(/<exchange\b([^>]*)>/i);
  return match ? parseAttributes(match[1]).units || '' : '';
}
function parseAttributes(text) {
  const attrs = {};
  const regex = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = regex.exec(String(text || '')))) attrs[match[1]] = decodeXmlEntities(match[2]);
  return attrs;
}
function cleanName(value) { return stripLeadingSlash(value); }
function deriveScope(fullLineTag) {
  return cleanName(fullLineTag).split('-')[0] || '';
}
function token(value) { return cleanName(value).replace(/\(REF\)$/iu, '').toUpperCase(); }
function uniqueTokens(values, sort = true) {
  const tokens = [...new Set((values || []).map(token).filter(Boolean))];
  if (sort) tokens.sort();
  return Object.freeze(tokens);
}
function averagePoint(points) {
  const valid = (points || []).filter((point) => point && [point.x, point.y, point.z].every(Number.isFinite));
  if (!valid.length) return null;
  return {
    x: valid.reduce((sum, point) => sum + point.x, 0) / valid.length,
    y: valid.reduce((sum, point) => sum + point.y, 0) / valid.length,
    z: valid.reduce((sum, point) => sum + point.z, 0) / valid.length,
  };
}
function memberCompare(left, right) {
  const a = String(left || '');
  const b = String(right || '');
  const aNum = Number(a.match(/\.(\d+)$/)?.[1]);
  const bNum = Number(b.match(/\.(\d+)$/)?.[1]);
  if (Number.isFinite(aNum) && Number.isFinite(bNum) && aNum !== bNum) return aNum - bNum;
  return a.localeCompare(b);
}
function diagnostic(severity, code, message, extra = {}) {
  return Object.freeze({ severity, code, message, ...extra });
}

export const _test = Object.freeze({
  parseAttributes,
  parseClashObject,
  extractFamilyRoot,
  extractMemberId,
});
