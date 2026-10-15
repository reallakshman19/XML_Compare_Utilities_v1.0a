import { extractFamilyRoot, makeExactMemberKey, uniqueSorted } from './ps-family-token-utils.js';

export function normalizeValidationFamily(value) {
  const root = extractFamilyRoot(value, { familyPrefixesText: 'PS, SL' });
  return root || makeExactMemberKey(value);
}

export function normalizeValidationSteel(value) {
  const root = extractFamilyRoot(value, { familyPrefixesText: 'PS, SL' });
  if (root) return root;
  const text = makeExactMemberKey(value);
  const match = text.match(/(?:^|\/)((?:PS|SL)-[A-Z0-9_.-]+)/u);
  return match?.[1]?.replace(/(?:\/.*)$/u, '') || text;
}

export function normalizeValidationMember(value) {
  return makeExactMemberKey(value);
}

export function structuralPair(familyId, steelGroupId) {
  const family = normalizeValidationFamily(familyId);
  const steel = normalizeValidationSteel(steelGroupId);
  return family && steel ? `${family}::${steel}` : '';
}

export function chainPair(left, right) {
  const members = uniqueSorted([
    normalizeValidationMember(left),
    normalizeValidationMember(right),
  ]);
  return members.length === 2 ? `${members[0]}::${members[1]}` : '';
}

export function splitStructuralPair(key) {
  const [supportFamilyId = '', steelGroupId = ''] = String(key || '').split('::');
  return { supportFamilyId, steelGroupId };
}

export function splitChainPair(key) {
  const [supportA = '', supportB = ''] = String(key || '').split('::');
  return { supportA, supportB };
}

export function uniqueValidationRows(rows, keyField = 'key') {
  const seen = new Set();
  return rows.filter((row) => {
    const key = row[keyField];
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function groupValidationRows(rows, keySelector) {
  const groups = new Map();
  rows.forEach((row) => {
    const key = keySelector(row);
    if (!key) return;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  });
  return groups;
}
