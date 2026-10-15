/**
 * profiles.js — domain profiles (W6, pure).
 *
 * One universal engine, several domain profiles. A profile carries the
 * display labels for the universal terms (Node / Relationship / Measure /
 * Dimension / Status — vision doc §8), extra role-suggestion hints, and an
 * auto-detector over the source schema + headers.
 */

export const PROFILES = Object.freeze({
  XML_ELEMENT: {
    id: 'XML_ELEMENT',
    label: 'XML Element (piping)',
    terms: { node: 'Element', relationship: 'Connector', measure: 'Geometry', dimension: 'Line / path', status: 'Change' },
    roleHints: [],
    kind: 'element',
  },
  NODE_SUPPORT: {
    id: 'NODE_SUPPORT',
    label: 'Node Support',
    terms: { node: 'Support point', relationship: 'Support match', measure: 'Load', dimension: 'Line / type', status: 'Load / line change' },
    roleHints: [],
    kind: 'node',
  },
  MTO: {
    id: 'MTO',
    label: 'MTO (material take-off)',
    terms: { node: 'MTO item', relationship: 'Item match', measure: 'Quantity / cost', dimension: 'Material / size', status: 'Qty change' },
    // measure = quantity/weight/cost columns; node id = item code/commodity
    roleHints: [
      ['measure', /qty|quantity|weight|mass|cost|price|amount|length\b|total/i],
      ['node-id', /item\s*code|commodity|mto\s*id|part\s*no|tag\s*no|^item$/i],
    ],
    kind: 'node',
  },
  SALES: {
    id: 'SALES',
    label: 'Sales / revenue',
    terms: { node: 'Customer-product', relationship: 'Sales key match', measure: 'Revenue / volume', dimension: 'Region / product', status: 'Revenue change' },
    roleHints: [
      ['measure', /revenue|sales|volume|units|amount|value|qty|quantity/i],
      ['node-id', /customer|account|sku|product\s*id|deal\s*id/i],
    ],
    kind: 'node',
  },
  GENERIC_NODE: {
    id: 'GENERIC_NODE',
    label: 'Generic node',
    terms: { node: 'Node', relationship: 'Relationship', measure: 'Measure', dimension: 'Dimension', status: 'Status' },
    roleHints: [],
    kind: 'node',
  },
});

export const PROFILE_IDS = Object.freeze(Object.keys(PROFILES));

/**
 * Auto-detect the profile from the source schema and/or headers.
 * @param {object} args { schema?: 'nodeset-xml'|'input-xml'|'categorized-xml', headers?: string[] }
 */
export function detectProfile({ schema = null, headers = [] } = {}) {
  if (schema === 'input-xml' || schema === 'categorized-xml') return 'XML_ELEMENT';
  const text = headers.join(' ').toLowerCase();
  if (/support\s*type|piping\s*primary\s*support|bop\s*elevation|stress\s*sys|civil\s*second/.test(text)) return 'NODE_SUPPORT';
  if (/revenue|customer|region|\bsales\b|\bsku\b/.test(text)) return 'SALES';
  if (/\bmto\b|commodity|take[-\s]?off|quantity|weight.*(kg|mm)|item\s*code|bill\s*of\s*material/.test(text)) return 'MTO';
  if (/east\/west|north\/south|node\s*no|coordinate|rawx|rawy/.test(text)) return 'NODE_SUPPORT';
  return 'GENERIC_NODE';
}

export function profileTerms(profileId) {
  return (PROFILES[profileId] ?? PROFILES.GENERIC_NODE).terms;
}

export function profileRoleHints(profileId) {
  return (PROFILES[profileId] ?? PROFILES.GENERIC_NODE).roleHints ?? [];
}

/** Profile id for a completed audit (element vs node domains). */
export function profileForAudit(audit, fallback = 'GENERIC_NODE') {
  if (!audit) return fallback;
  if (audit.compareKind !== 'node-wise') return 'XML_ELEMENT';
  return PROFILES[audit.profileId] ? audit.profileId : (fallback === 'XML_ELEMENT' ? 'NODE_SUPPORT' : fallback);
}
