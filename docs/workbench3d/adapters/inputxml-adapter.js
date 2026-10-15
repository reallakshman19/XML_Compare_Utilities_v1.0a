/**
 * inputxml-adapter.js — raw CAESAR II InputXML and CategorizedInputXML (v3)
 * → raw element records. Records feed the canonical graph builder; this module
 * never renders and never matches.
 *
 * Raw record shape:
 * {
 *   index, fromNode, toNode, deltaMm: [x,y,z], lengthMm,
 *   diameterMm, wallThickMm, name, lineId,
 *   packets: [{ kind: 'RIGID'|'BEND'|'SIF'|'RESTRAINT'|..., attrs: {...} }],
 *   properties: { ATTR: value }  // sentinel-cleaned scalar evidence
 * }
 */

import { parseXml } from '../core/simple-xml.js';
import { parsePsiRecords, isPsiPipeStressText } from './psi-records-adapter.js';

/** CAESAR II uses -1.0101 (and -nan) as "value not set". */
export function isSentinel(value) {
  const text = String(value ?? '').trim();
  if (!text) return true;
  if (/nan/i.test(text)) return true;
  const num = Number(text);
  if (!Number.isFinite(num)) return true;
  return Math.abs(num + 1.0101) < 5e-4;
}

export function cleanNumber(value, fallback = 0) {
  if (isSentinel(value)) return fallback;
  const num = Number(String(value).trim());
  return Number.isFinite(num) ? num : fallback;
}

export function cleanNodeId(value) {
  const num = cleanNumber(value, NaN);
  if (Number.isFinite(num)) return String(Math.round(num));
  const text = String(value ?? '').trim();
  return text || '';
}

const PACKET_KINDS = Object.freeze(['RIGID', 'BEND', 'SIF', 'RESTRAINT', 'HANGER', 'FLANGE', 'NOZZLE', 'DISPLACEMENT', 'FORCE', 'UNIFORM', 'WIND', 'OFFSET', 'REDUCER', 'EXPJNT']);

/** Scalar element attributes carried as transferable/compare evidence. */
const PROPERTY_ATTRS = Object.freeze([
  'DIAMETER', 'WALL_THICK', 'INSUL_THICK', 'CORR_ALLOW',
  'TEMP_EXP_C1', 'TEMP_EXP_C2', 'TEMP_EXP_C3',
  'PRESSURE1', 'PRESSURE2', 'HYDRO_PRESSURE',
  'MATERIAL_NUM', 'MATERIAL_NAME', 'PIPE_DENSITY', 'INSUL_DENSITY', 'FLUID_DENSITY',
  'MODULUS', 'POISSONS', 'NAME',
]);

export const XML_SCHEMA_KINDS = Object.freeze({
  INPUT_XML: 'input-xml',
  CATEGORIZED_XML: 'categorized-xml',
  NODESET_XML: 'nodeset-xml',
  PSI_XML: 'psi-pipestress',
  UNKNOWN: 'unknown',
});

export function detectSchema(xmlText) {
  const raw = String(xmlText ?? '');
  // NodeSet is the most specific marker; categorized next (those files embed
  // original PIPINGELEMENT text in CDATA).
  if (/<NodeSet\b[^>]*schema\s*=\s*["']nodeset\/v1["']/i.test(raw)) return XML_SCHEMA_KINDS.NODESET_XML;
  if (/<CategorizedInputXML\b/i.test(raw) || /<Element\b[^>]*fromNode\s*=/i.test(raw)) return XML_SCHEMA_KINDS.CATEGORIZED_XML;
  if (/<PIPINGELEMENT\b/i.test(raw) && /FROM_NODE\s*=/i.test(raw)) return XML_SCHEMA_KINDS.INPUT_XML;
  if (isPsiPipeStressText(raw)) return XML_SCHEMA_KINDS.PSI_XML;
  return XML_SCHEMA_KINDS.UNKNOWN;
}

function packetFromNode(node) {
  const attrs = {};
  for (const [key, value] of node.attributes) {
    if (isSentinel(value)) continue;
    attrs[key] = String(value).trim();
  }
  return { kind: node.name.toUpperCase(), attrs };
}

function packetsFromChildren(elementNode) {
  const packets = [];
  const visit = (node) => {
    for (const child of node.children) {
      if (PACKET_KINDS.includes(child.name.toUpperCase())) {
        // RESTRAINT rows are emitted as fixed-size arrays with sentinel NODEs; keep real ones only.
        if (child.name.toUpperCase() === 'RESTRAINT' && isSentinel(child.getAttribute('NODE'))) continue;
        packets.push(packetFromNode(child));
      } else {
        visit(child);
      }
    }
  };
  visit(elementNode);
  return packets;
}

function parseRawInputXml(documentElement) {
  const records = [];
  const elements = documentElement.descendantsNamed('PIPINGELEMENT');
  elements.forEach((el, index) => {
    const delta = [cleanNumber(el.getAttribute('DELTA_X')), cleanNumber(el.getAttribute('DELTA_Y')), cleanNumber(el.getAttribute('DELTA_Z'))];
    const properties = {};
    for (const attr of PROPERTY_ATTRS) {
      const value = el.getAttribute(attr);
      if (value !== null && !isSentinel(value)) properties[attr] = String(value).trim();
    }
    records.push({
      index,
      fromNode: cleanNodeId(el.getAttribute('FROM_NODE')),
      toNode: cleanNodeId(el.getAttribute('TO_NODE')),
      deltaMm: delta,
      lengthMm: Math.hypot(delta[0], delta[1], delta[2]),
      diameterMm: cleanNumber(el.getAttribute('DIAMETER'), NaN),
      wallThickMm: cleanNumber(el.getAttribute('WALL_THICK'), NaN),
      name: String(el.getAttribute('NAME') ?? '').trim(),
      lineId: '',
      packets: packetsFromChildren(el),
      properties,
      blocks: null,
    });
  });
  return records;
}

const CATEGORIZED_SKIP_LEAVES = Object.freeze(['ORIGINALELEMENT', 'RAWXML', 'SOURCEXML']);

function collectScalarLeafValues(blockNode, into) {
  for (const child of blockNode.children) {
    if (CATEGORIZED_SKIP_LEAVES.includes(child.name.toUpperCase())) continue;
    if (child.name.toUpperCase() === 'UNMAPPEDATTRIBUTE') {
      const key = String(child.getAttribute('name') ?? '').trim();
      if (key && !isSentinel(child.textContent)) into[key.toUpperCase()] = String(child.textContent).trim();
      continue;
    }
    if (!child.children.length && child.textContent.trim()) {
      if (!isSentinel(child.textContent)) into[child.name.toUpperCase()] = String(child.textContent).trim();
      continue;
    }
    if (child.children.length && !PACKET_KINDS.includes(child.name.toUpperCase())) collectScalarLeafValues(child, into);
  }
}

/**
 * Retain the block structure of a categorized <Element> for the inspector:
 * [{ name: 'RestraintsBlock', entries: [[key,value]], instances: [{name, attrs}] }]
 * Sentinels are dropped; embedded original-XML blobs are skipped.
 */
function blocksFromElement(el) {
  const blocks = [];
  for (const child of el.children) {
    if (CATEGORIZED_SKIP_LEAVES.includes(child.name.toUpperCase())) continue;
    const entries = [];
    const instances = [];
    for (const inner of child.children) {
      if (CATEGORIZED_SKIP_LEAVES.includes(inner.name.toUpperCase())) continue;
      if (inner.name.toUpperCase() === 'UNMAPPEDATTRIBUTE') {
        const key = String(inner.getAttribute('name') ?? '').trim();
        if (key && !isSentinel(inner.textContent)) entries.push([key, String(inner.textContent).trim()]);
      } else if (inner.attributes.size) {
        const attrs = {};
        for (const [key, value] of inner.attributes) {
          if (!isSentinel(value)) attrs[key] = String(value).trim();
        }
        instances.push({ name: inner.name, attrs });
      } else if (!inner.children.length && inner.textContent.trim()) {
        if (!isSentinel(inner.textContent)) entries.push([inner.name, String(inner.textContent).trim()]);
      }
    }
    if (entries.length || instances.length) blocks.push({ name: child.name, entries, instances });
  }
  return blocks;
}

function parseCategorizedXml(documentElement) {
  const records = [];
  let index = 0;
  const lines = documentElement.descendantsNamed('Line');
  const scopes = lines.length ? lines : [documentElement];
  for (const line of scopes) {
    const lineId = String(line.getAttribute('id') ?? '').trim();
    for (const el of line.descendantsNamed('Element')) {
      const properties = {};
      collectScalarLeafValues(el, properties);
      const delta = [cleanNumber(properties.DELTA_X), cleanNumber(properties.DELTA_Y), cleanNumber(properties.DELTA_Z)];
      delete properties.DELTA_X; delete properties.DELTA_Y; delete properties.DELTA_Z;
      records.push({
        index,
        fromNode: cleanNodeId(el.getAttribute('fromNode')),
        toNode: cleanNodeId(el.getAttribute('toNode')),
        deltaMm: delta,
        lengthMm: Math.hypot(delta[0], delta[1], delta[2]),
        diameterMm: cleanNumber(properties.DIAMETER, NaN),
        wallThickMm: cleanNumber(properties.WALL_THICK, NaN),
        name: String(properties.NAME ?? el.getAttribute('elementKey') ?? '').trim(),
        lineId,
        packets: packetsFromChildren(el),
        properties,
        blocks: blocksFromElement(el),
      });
      index += 1;
    }
  }
  return records;
}

/**
 * Parse any supported schema into raw element records.
 * Returns { schema, records, warnings }.
 */
export function parseInputXmlRecords(xmlText) {
  const schema = detectSchema(xmlText);
  if (schema === XML_SCHEMA_KINDS.UNKNOWN) {
    return { schema, records: [], warnings: ['Unrecognized XML schema: expected InputXML (PIPINGELEMENT), CategorizedInputXML (Element fromNode/toNode), or NodeSet (nodeset/v1).'] };
  }
  if (schema === XML_SCHEMA_KINDS.NODESET_XML) {
    // NodeSet models are parsed by nodeset-adapter.js; this parser only reports the schema.
    return { schema, records: [], warnings: [] };
  }
  if (schema === XML_SCHEMA_KINDS.PSI_XML) {
    return parsePsiRecords(xmlText);
  }
  const { documentElement } = parseXml(xmlText);
  const records = schema === XML_SCHEMA_KINDS.INPUT_XML
    ? parseRawInputXml(documentElement)
    : parseCategorizedXml(documentElement);
  const warnings = [];
  if (!records.length) warnings.push('No piping elements found in file.');
  const missingTopology = records.filter((r) => !r.fromNode || !r.toNode).length;
  if (missingTopology) warnings.push(`${missingTopology} element(s) missing FROM/TO node ids.`);
  return { schema, records, warnings };
}
