export const DEFAULT_BORE_TO_OD_PROFILE = 'ASME_B36_10M_B36_19M_2018';
export const BORE_TO_OD_MASTER_SCHEMA = 'navis-tag-bore-od-master/v1';

const STANDARD_BASIS = Object.freeze({
  standards: ['ASME B36.10M-2018', 'ASME B36.19M-2018'],
  description: 'Nominal pipe size / DN to standardized physical outside diameter.',
  notes: 'OD is independent of schedule for a given NPS. Bore remains nominal and is not overwritten.',
});

const ROWS = Object.freeze([
  ['1/8', 6, 10.3], ['1/4', 8, 13.7], ['3/8', 10, 17.1], ['1/2', 15, 21.3],
  ['3/4', 20, 26.7], ['1', 25, 33.4], ['1 1/4', 32, 42.2], ['1 1/2', 40, 48.3],
  ['2', 50, 60.3], ['2 1/2', 65, 73.0], ['3', 80, 88.9], ['3 1/2', 90, 101.6],
  ['4', 100, 114.3], ['5', 125, 141.3], ['6', 150, 168.3], ['8', 200, 219.1],
  ['10', 250, 273.1], ['12', 300, 323.9], ['14', 350, 355.6], ['16', 400, 406.4],
  ['18', 450, 457.2], ['20', 500, 508.0], ['22', 550, 558.8], ['24', 600, 609.6],
  ['26', 650, 660.4], ['28', 700, 711.2], ['30', 750, 762.0], ['32', 800, 812.8],
  ['34', 850, 863.6], ['36', 900, 914.4], ['38', 950, 965.2], ['40', 1000, 1016.0],
  ['42', 1050, 1066.8], ['44', 1100, 1117.6], ['46', 1150, 1168.4], ['48', 1200, 1219.2],
].map(([nps, dn, odMm]) => Object.freeze({ nps, dn, odMm })));

export const BUILT_IN_BORE_TO_OD_PROFILES = Object.freeze({
  [DEFAULT_BORE_TO_OD_PROFILE]: Object.freeze({
    schema: BORE_TO_OD_MASTER_SCHEMA,
    name: DEFAULT_BORE_TO_OD_PROFILE,
    label: 'ASME B36.10M / B36.19M (2018)',
    standardBasis: STANDARD_BASIS,
    rows: ROWS,
  }),
});

function text(value) { return String(value ?? '').trim(); }
function compact(value) { return text(value).toUpperCase().replace(/[\s_\-]/g, '').replace(/[“”″]/g, '"'); }
function decimalNps(nps) {
  const value = text(nps);
  if (!value.includes(' ')) {
    if (!value.includes('/')) return Number(value);
    const [a, b] = value.split('/').map(Number);
    return b ? a / b : NaN;
  }
  const [whole, fraction] = value.split(/\s+/);
  const [a, b] = fraction.split('/').map(Number);
  return Number(whole) + (b ? a / b : 0);
}
function aliases(row) {
  const decimal = decimalNps(row.nps);
  const npsCompact = row.nps.replace(/\s+/g, '');
  return [
    `DN${row.dn}`, `DN ${row.dn}`, `${row.dn}`, `${row.dn}MM`,
    `NPS${npsCompact}`, `NPS ${row.nps}`, `${row.nps}IN`, `${row.nps}"`,
    Number.isFinite(decimal) ? `${decimal}IN` : '', Number.isFinite(decimal) ? `${decimal}"` : '',
  ].filter(Boolean).map(compact);
}

const PROFILE_INDEXES = Object.freeze(Object.fromEntries(Object.entries(BUILT_IN_BORE_TO_OD_PROFILES).map(([name, profile]) => {
  const index = new Map();
  profile.rows.forEach((row) => aliases(row).forEach((alias) => index.set(alias, row)));
  return [name, index];
})));

export function normalizeBoreToOdProfileName(value) {
  const requested = text(value);
  if (!requested) return DEFAULT_BORE_TO_OD_PROFILE;
  const exact = Object.keys(BUILT_IN_BORE_TO_OD_PROFILES).find((name) => name.toUpperCase() === requested.toUpperCase());
  return exact || requested;
}

export function hasBuiltInBoreToOdProfile(value) {
  return Object.prototype.hasOwnProperty.call(BUILT_IN_BORE_TO_OD_PROFILES, normalizeBoreToOdProfileName(value));
}

export function getBuiltInBoreToOdProfile(value) {
  const name = normalizeBoreToOdProfileName(value);
  return BUILT_IN_BORE_TO_OD_PROFILES[name] || null;
}

export function resolveBuiltInBoreToOd({ rawBore = '', boreNominalMm = null, profileName = '' } = {}) {
  const name = normalizeBoreToOdProfileName(profileName);
  const profile = BUILT_IN_BORE_TO_OD_PROFILES[name];
  const index = PROFILE_INDEXES[name];
  if (!profile || !index) return null;
  const candidates = [rawBore, Number.isFinite(boreNominalMm) ? `DN${Number(boreNominalMm)}` : '', Number.isFinite(boreNominalMm) ? String(Number(boreNominalMm)) : ''].filter(Boolean);
  for (const candidate of candidates) {
    const key = compact(candidate);
    const row = index.get(key);
    if (!row) continue;
    return {
      value: row.odMm,
      key,
      lookupName: profile.name,
      profileName: profile.name,
      source: 'BUILT_IN_ASME_BORE_TO_OD_PROFILE',
      standardBasis: profile.standardBasis,
      dn: row.dn,
      nps: row.nps,
      odMm: row.odMm,
    };
  }
  return null;
}

export function builtInBoreToOdProfileSummary(value = '') {
  const profile = getBuiltInBoreToOdProfile(value);
  return profile ? {
    schema: profile.schema,
    name: profile.name,
    label: profile.label,
    rowCount: profile.rows.length,
    standardBasis: profile.standardBasis,
  } : null;
}
