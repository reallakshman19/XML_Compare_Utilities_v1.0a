export const DEFAULT_FAMILY_PREFIXES = Object.freeze(['PS', 'SL']);

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function normalizeFamilyPrefixes(options = {}) {
  const raw = Array.isArray(options.familyPrefixes)
    ? options.familyPrefixes
    : String(options.familyPrefixesText || options.familyPrefixes || DEFAULT_FAMILY_PREFIXES.join(',')).split(/[,;\s]+/);
  const prefixes = raw.map((item) => String(item || '').trim().toUpperCase().replace(/-+$/g, ''))
    .filter((item) => /^[A-Z][A-Z0-9_]*$/.test(item));
  return uniqueSorted(prefixes.length ? prefixes : DEFAULT_FAMILY_PREFIXES);
}

export function buildFamilyRootRegex(options = {}, flags = 'i') {
  const pattern = normalizeFamilyPrefixes(options).map(escapeRegex).join('|');
  return new RegExp(`(?:^|[^A-Z0-9])((?:${pattern})-\\d+)`, flags);
}

export function buildFamilyRootDetectorLabel(options = {}) {
  return `/(?:${normalizeFamilyPrefixes(options).join('|')})-\\d+/i`;
}

export function decodeXmlEntities(value) {
  return String(value || '')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

export function stripLeadingSlash(value) {
  return decodeXmlEntities(value).trim().replace(/^\/+/, '');
}

export function normalizeHeader(value) {
  return String(value || '').replace(/[\r\n]+/g, ' ').replace(/\s+/g, ' ').trim();
}

export function makeExactMemberKey(value) {
  return stripLeadingSlash(value).replace(/\s+/g, ' ').toUpperCase();
}

export function makeDisplayName(value) {
  return stripLeadingSlash(value).replace(/\s+/g, ' ');
}

export function extractFamilyRoot(value, options = {}) {
  const clean = makeExactMemberKey(value);
  const match = buildFamilyRootRegex(options).exec(` ${clean}`);
  return match ? match[1].toUpperCase() : '';
}

export function extractFamilyRoots(value, options = {}) {
  const regex = buildFamilyRootRegex(options, 'gi');
  const roots = [];
  let match;
  while ((match = regex.exec(` ${makeExactMemberKey(value)}`))) roots.push(match[1].toUpperCase());
  return uniqueSorted(roots);
}

export function parseNumber(value) {
  const text = String(value || '').replace(/,/g, '').trim();
  if (!text) return null;
  const number = Number(text);
  return Number.isFinite(number) ? number : null;
}

export function parsePosition(positionText) {
  const text = decodeXmlEntities(positionText).trim();
  const match = text.match(/E\s*(-?\d+(?:\.\d+)?)\s*mm\s*S\s*(-?\d+(?:\.\d+)?)\s*mm\s*U\s*(-?\d+(?:\.\d+)?)\s*mm/i);
  if (!match) return null;
  return { e: Number(match[1]), s: Number(match[2]), u: Number(match[3]) };
}

export function parsePipeTag(value) {
  const raw = stripLeadingSlash(value);
  const slashIndex = raw.lastIndexOf('/');
  const fullLineTag = slashIndex >= 0 ? raw.slice(0, slashIndex) : raw;
  const branch = slashIndex >= 0 ? raw.slice(slashIndex + 1) : '';
  const parts = fullLineTag.split('-');
  return {
    raw,
    fullBranchNode: raw,
    fullLineTag,
    branch,
    project: parts.length >= 2 ? `${parts[0]}-${parts[1]}` : (parts[0] || ''),
    size: parts[2] || '',
    lineFamily: parts[3] || '',
    classOrSpec: parts[4] || '',
    suffix: parts.slice(5).join('-'),
  };
}

export function uniqueSorted(values) {
  return Array.from(new Set(values.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b)));
}

export function parseDelimitedRows(text) {
  const source = String(text || '').replace(/^\uFEFF/, '');
  const firstLine = source.split(/\r?\n/, 1)[0] || '';
  const delimiter = (firstLine.match(/\t/g) || []).length > (firstLine.match(/,/g) || []).length ? '\t' : ',';
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;

  for (let index = 0; index < source.length; index += 1) {
    const ch = source[index];
    const next = source[index + 1];
    if (delimiter === ',' && ch === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === delimiter && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((ch === '\n' || ch === '\r') && !inQuotes) {
      if (ch === '\r' && next === '\n') index += 1;
      row.push(field);
      if (row.some((cell) => String(cell).trim())) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field);
  if (row.some((cell) => String(cell).trim())) rows.push(row);
  return rows;
}

export function rowsToObjects(text) {
  const rows = parseDelimitedRows(text);
  if (!rows.length) return [];
  const headers = rows[0].map((header) => normalizeHeader(header));
  return rows.slice(1).map((row, rowIndex) => {
    const object = { __rowIndex: rowIndex + 2 };
    headers.forEach((header, index) => { object[header] = row[index] ?? ''; });
    return object;
  });
}

export function findField(object, candidates) {
  const entries = Object.entries(object || {});
  for (const [key, value] of entries) {
    const normalized = normalizeHeader(key).toLowerCase();
    if (candidates.some((candidate) => normalized === candidate || normalized.includes(candidate))) return value;
  }
  return '';
}
