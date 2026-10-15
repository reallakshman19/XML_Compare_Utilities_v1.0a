import { PS_FAMILY_POSFAMILY_SCHEMA } from './ps-family-clash-audit-contract.js';
import { uniqueSorted } from './ps-family-token-utils.js';

function withinTolerance(a, b, tolerance) {
  return Math.abs(a.e - b.e) <= tolerance && Math.abs(a.s - b.s) <= tolerance && Math.abs(a.u - b.u) <= tolerance;
}

function spreadFor(members, axis) {
  const values = members.map((member) => member.position?.[axis]).filter((value) => Number.isFinite(value));
  if (!values.length) return 0;
  return Math.max(...values) - Math.min(...values);
}

function average(members, axis) {
  const values = members.map((member) => member.position?.[axis]).filter((value) => Number.isFinite(value));
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function buildPsFamilyPosFamilies(detailRows, options = {}) {
  const tolerance = Number.isFinite(options.toleranceMm) ? options.toleranceMm : 25;
  const diagnostics = [];
  const sortedRows = [...(detailRows || [])]
    .filter((row) => {
      if (row.position) return true;
      diagnostics.push({ level: 'WARN', code: 'POSITION_MISSING_FOR_POSFAMILY', message: `${row.displayName || row.rawName} has no parsed position.` });
      return false;
    })
    .sort((a, b) => a.position.e - b.position.e || a.position.s - b.position.s || a.position.u - b.position.u || a.exactMemberKey.localeCompare(b.exactMemberKey));

  const families = [];
  const enrichedRows = (detailRows || []).map((row) => ({ ...row }));
  const byKey = new Map(enrichedRows.map((row) => [row.exactMemberKey, row]));

  sortedRows.forEach((sourceRow) => {
    const row = byKey.get(sourceRow.exactMemberKey) || sourceRow;
    let family = families.find((candidate) => withinTolerance(row.position, candidate.anchor, tolerance));
    if (!family) {
      family = {
        schema: PS_FAMILY_POSFAMILY_SCHEMA,
        posFamilyId: `POSF-${String(families.length + 1).padStart(6, '0')}`,
        anchor: row.position,
        members: [],
      };
      families.push(family);
    }
    row.posFamilyId = family.posFamilyId;
    family.members.push(row);
  });

  const finalFamilies = families.map((family) => ({
    schema: family.schema,
    posFamilyId: family.posFamilyId,
    toleranceMm: tolerance,
    elementCount: family.members.length,
    members: family.members.map((member) => member.displayName),
    exactMemberKeys: family.members.map((member) => member.exactMemberKey),
    sourceFamilies: uniqueSorted(family.members.map((member) => member.sourceFamily)),
    lineFamilies: uniqueSorted(family.members.map((member) => member.lineFamily)),
    pipes: uniqueSorted(family.members.map((member) => member.pipe)),
    center: {
      e: average(family.members, 'e'),
      s: average(family.members, 's'),
      u: average(family.members, 'u'),
    },
    spread: {
      maxDeltaE: spreadFor(family.members, 'e'),
      maxDeltaS: spreadFor(family.members, 's'),
      maxDeltaU: spreadFor(family.members, 'u'),
    },
  }));

  finalFamilies.forEach((family) => {
    if (family.lineFamilies.length > 1) diagnostics.push({ level: 'INFO', code: 'POSFAMILY_WITH_MULTI_LINE', message: `${family.posFamilyId} contains multiple line families: ${family.lineFamilies.join(', ')}` });
  });

  return { rows: enrichedRows, posFamilies: finalFamilies, diagnostics };
}
