/**
 * psi-records-adapter.js — AVEVA PSI PipeStressExport XML → raw element
 * records for the 3D Data Compare Workbench (same shape as inputxml-adapter).
 *
 * Model: every consecutive pair of numbered branch nodes is one element
 * (from→to), mirroring how CAESAR sees the route. Support nodes (ANCI/ATTA,
 * Endpoint 0) sit on the route, so their restraints arrive as RESTRAINT
 * packets on the element that reaches them; enrichment scalars (PipingClass,
 * Rating, BoreMm, MaterialCode, ElementLengthMm) ride as properties.
 */

const PROPERTY_TAGS = Object.freeze([
  'PipingClass', 'Rating', 'BoreMm', 'MaterialCode', 'ElementLengthMm',
  'OutsideDiameter', 'WallThickness', 'CorrosionAllowance', 'InsulationThickness',
]);

function tagText(block, tag) {
  const match = new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(block);
  return match ? match[1].trim() : '';
}

function tagBlocks(text, tag) {
  const out = [];
  const re = new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`, 'g');
  let match;
  while ((match = re.exec(text))) out.push(match[1]);
  return out;
}

function parsePoint(text) {
  const parts = String(text || '').trim().split(/[\s,]+/).map(Number);
  if (parts.length < 3 || !parts.slice(0, 3).every(Number.isFinite)) return null;
  return parts.slice(0, 3);
}

function parseNode(body) {
  const properties = {};
  for (const tag of PROPERTY_TAGS) {
    const value = tagText(body, tag);
    if (value !== '' && value !== '-1') properties[tag.toUpperCase()] = value;
  }
  return {
    number: tagText(body, 'NodeNumber'),
    name: tagText(body, 'NodeName'),
    endpoint: tagText(body, 'Endpoint'),
    componentType: tagText(body, 'ComponentType').toUpperCase(),
    componentRef: tagText(body, 'ComponentRefNo'),
    position: parsePoint(tagText(body, 'Position')),
    restraints: tagBlocks(body, 'Restraint').map((r) => ({
      TYPE: tagText(r, 'Type'), STIFFNESS: tagText(r, 'Stiffness'),
      GAP: tagText(r, 'Gap'), FRICTION: tagText(r, 'Friction'),
    })),
    properties,
  };
}

function restraintPackets(node) {
  return node.restraints.map((attrs) => ({
    kind: 'RESTRAINT',
    attrs: { NODE: node.number, TAG: node.name, ...attrs },
  }));
}

/** True when the text looks like an AVEVA PSI PipeStressExport document. */
export function isPsiPipeStressText(sourceText) {
  return /<PipeStressExport\b/i.test(String(sourceText || '').slice(0, 4000));
}

/** Parse PSI XML into workbench element records: { schema, records, warnings }. */
export function parsePsiRecords(xmlText) {
  const text = String(xmlText || '');
  const records = [];
  const warnings = [];
  let index = 0;
  for (const branchBody of tagBlocks(text, 'Branch')) {
    const branchName = tagText(branchBody, 'Branchname') || 'BRANCH';
    const nodes = tagBlocks(branchBody, 'Node').map(parseNode)
      .filter((node) => node.number && node.number !== '-1' && node.position);
    for (let i = 0; i + 1 < nodes.length; i += 1) {
      const from = nodes[i];
      const to = nodes[i + 1];
      const delta = [to.position[0] - from.position[0], to.position[1] - from.position[1], to.position[2] - from.position[2]];
      const diameter = Number(to.properties.OUTSIDEDIAMETER ?? from.properties.OUTSIDEDIAMETER ?? NaN);
      const properties = { ...from.properties, ...to.properties };
      const name = to.name || from.name || '';
      if (name) properties.NAME = name;
      records.push({
        index,
        fromNode: from.number,
        toNode: to.number,
        deltaMm: delta,
        lengthMm: Math.hypot(delta[0], delta[1], delta[2]),
        diameterMm: Number.isFinite(diameter) ? diameter : NaN,
        wallThickMm: Number(to.properties.WALLTHICKNESS ?? NaN),
        name,
        lineId: branchName,
        // Restraints on either endpoint belong to this element's evidence;
        // the from-node's packets were already emitted by the previous element.
        packets: i === 0 ? [...restraintPackets(from), ...restraintPackets(to)] : restraintPackets(to),
        properties,
        blocks: null,
        componentType: to.componentType,
        componentRef: to.componentRef,
      });
      index += 1;
    }
  }
  if (!records.length) warnings.push('No numbered branch nodes found in PipeStressExport.');
  return { schema: 'psi-pipestress', records, warnings };
}
