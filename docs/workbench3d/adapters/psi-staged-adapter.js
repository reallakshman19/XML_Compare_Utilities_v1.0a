/**
 * psi-staged-adapter.js — AVEVA PSI PipeStressExport XML → staged JSON
 * (schema "inputxml-managed-stage/v1").
 *
 * Pure string parsing (no DOMParser) so it runs in browser and Node alike.
 * Consecutive <Node> rows sharing a ComponentRefNo become one component;
 * implicit tube between route components is synthesized as PIPE components so
 * the canonical topology builder sees a connected branch. Restraint blocks and
 * enrichment scalars (PipingClass, Rating, BoreMm, MaterialCode,
 * ElementLengthMm) are preserved on component attributes for compare/transfer.
 */

const TUBE_GAP_MM = 1;

/** ComponentType → staged component type. ANCI/ATTA are support attachments. */
const TYPE_MAP = Object.freeze({
  ELBO: 'ELBO', BEND: 'BEND', FLAN: 'FLAN', GASK: 'GASK', VALV: 'VALV',
  REDU: 'REDU', TEE: 'TEE', OLET: 'OLET', INST: 'INST', PIPE: 'PIPE',
  RIGID: 'INST', ANCI: 'SUPPORT', ATTA: 'SUPPORT',
});

/** Scalar node tags copied onto component attributes when present. */
const PROPERTY_TAGS = Object.freeze([
  'OutsideDiameter', 'WallThickness', 'CorrosionAllowance', 'InsulationThickness',
  'PipingClass', 'Rating', 'BoreMm', 'MaterialCode', 'ElementLengthMm',
  'BendRadius', 'BendType', 'Weight', 'ConnectionType', 'LineNumber',
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
  return { x: parts[0], y: parts[1], z: parts[2] };
}

function parseNode(body) {
  const restraints = tagBlocks(body, 'Restraint').map((r) => ({
    type: tagText(r, 'Type'),
    stiffness: tagText(r, 'Stiffness'),
    gap: tagText(r, 'Gap'),
    friction: tagText(r, 'Friction'),
  }));
  const properties = {};
  for (const tag of PROPERTY_TAGS) {
    const value = tagText(body, tag);
    if (value !== '' && value !== '-1') properties[tag.toUpperCase()] = value;
  }
  return {
    nodeNumber: tagText(body, 'NodeNumber'),
    nodeName: tagText(body, 'NodeName'),
    endpoint: Number(tagText(body, 'Endpoint') || '0'),
    componentType: tagText(body, 'ComponentType').toUpperCase(),
    componentRef: tagText(body, 'ComponentRefNo'),
    position: parsePoint(tagText(body, 'Position')),
    restraints,
    properties,
  };
}

/** Group consecutive nodes that share a ComponentRefNo. */
function groupComponents(nodes) {
  const groups = [];
  for (const node of nodes) {
    const last = groups[groups.length - 1];
    if (last && last.ref === node.componentRef && node.componentRef) last.nodes.push(node);
    else groups.push({ ref: node.componentRef, type: node.componentType, nodes: [node] });
  }
  return groups;
}

function distance(a, b) {
  if (!a || !b) return Infinity;
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function componentFromGroup(group, sequence) {
  const type = TYPE_MAP[group.type] || 'INST';
  const start = group.nodes.find((n) => n.endpoint === 1) || group.nodes[0];
  const end = group.nodes.find((n) => n.endpoint === 2) || group.nodes[group.nodes.length - 1];
  const center = group.nodes.find((n) => n.endpoint === 0) || null;
  const named = group.nodes.find((n) => n.nodeName) || null;
  const attributes = {
    REF: group.ref,
    NAME: named?.nodeName || '',
    COMPONENT_TYPE: group.type,
    NODE_NUMBERS: group.nodes.map((n) => n.nodeNumber).join(','),
  };
  for (const node of group.nodes) Object.assign(attributes, node.properties);
  if (type === 'SUPPORT') {
    const pos = center?.position || start?.position || null;
    if (pos) attributes.POS = pos;
    const restraints = group.nodes.flatMap((n) => n.restraints);
    if (restraints.length) {
      attributes.RESTRAINTS = restraints;
      // Explicit stress-support evidence for the support classifier.
      attributes.SUPPORT_TYPE = restraints.map((r) => r.type).filter(Boolean).join('+') || 'REST';
    }
    attributes.DTXR = attributes.RESTRAINTS ? `PIPE SUPPORT ${attributes.SUPPORT_TYPE}` : (named?.nodeName || '');
  } else {
    if (start?.position) attributes.APOS = start.position;
    if (end?.position) attributes.LPOS = end.position;
    if (center?.position) attributes.POS = center.position;
    const bore = attributes.OUTSIDEDIAMETER || attributes.BOREMM;
    if (bore) { attributes.ABORE = bore; attributes.LBORE = bore; }
    const restraints = group.nodes.flatMap((n) => n.restraints);
    if (restraints.length) attributes.RESTRAINTS = restraints;
  }
  return {
    name: named?.nodeName || `${group.type}-${sequence}`,
    type,
    attributes,
  };
}

function tubeComponent(fromPoint, toPoint, sequence, template) {
  const attributes = {
    APOS: fromPoint,
    LPOS: toPoint,
    COMPONENT_TYPE: 'TUBE',
  };
  for (const key of ['OUTSIDEDIAMETER', 'WALLTHICKNESS', 'PIPINGCLASS', 'RATING', 'BOREMM', 'MATERIALCODE']) {
    if (template?.[key] != null) attributes[key] = template[key];
  }
  const bore = attributes.OUTSIDEDIAMETER || attributes.BOREMM;
  if (bore) { attributes.ABORE = bore; attributes.LBORE = bore; }
  return { name: `TUBE-${sequence}`, type: 'PIPE', attributes };
}

function branchObject(branchBody, pipeName) {
  const name = tagText(branchBody, 'Branchname') || 'BRANCH';
  const nodes = tagBlocks(branchBody, 'Node').map(parseNode);
  const groups = groupComponents(nodes);

  const children = [];
  let previousEnd = null;
  let tubeSeq = 0;
  let headPos = null;
  let tailPos = null;
  for (const group of groups) {
    if (group.type === 'BRAN') {
      const pos = group.nodes[0]?.position || null;
      if (!headPos) headPos = pos; else tailPos = pos;
      continue;
    }
    const component = componentFromGroup(group, children.length + 1);
    const isSupport = component.type === 'SUPPORT';
    const startPos = component.attributes.APOS || null;
    if (!isSupport && startPos && previousEnd && distance(previousEnd, startPos) > TUBE_GAP_MM) {
      tubeSeq += 1;
      children.push(tubeComponent(previousEnd, startPos, tubeSeq, component.attributes));
    }
    children.push(component);
    if (!isSupport) previousEnd = component.attributes.LPOS || previousEnd;
  }
  if (previousEnd && tailPos && distance(previousEnd, tailPos) > TUBE_GAP_MM) {
    tubeSeq += 1;
    children.push(tubeComponent(previousEnd, tailPos, tubeSeq, null));
  }

  const attributes = { NAME: name, OWNER: pipeName || '', OWNER_SITE: pipeName || '' };
  if (headPos) attributes.HPOS = headPos;
  if (tailPos || previousEnd) attributes.TPOS = tailPos || previousEnd;
  return { name, type: 'BRANCH', attributes, children };
}

/** True when the text looks like an AVEVA PSI PipeStressExport document. */
export function isPsiPipeStressXml(sourceText) {
  const text = String(sourceText || '').slice(0, 4000);
  return /<PipeStressExport\b/i.test(text);
}

/**
 * Convert PSI PipeStressExport XML into a staged JSON document.
 * @returns {{ schema: string, sourceName: string, objects: Array }}
 */
export function convertPsiXmlToStaged(sourceText, sourceName = 'psi.xml') {
  const text = String(sourceText || '');
  if (!isPsiPipeStressXml(text)) throw new TypeError('Not a PipeStressExport XML document.');
  const objects = [];
  const pipes = tagBlocks(text, 'Pipe');
  const scopes = pipes.length ? pipes : [text];
  for (const pipeBody of scopes) {
    const pipeName = tagText(pipeBody, 'FullName');
    for (const branchBody of tagBlocks(pipeBody, 'Branch')) {
      objects.push(branchObject(branchBody, pipeName));
    }
  }
  if (!objects.length) throw new TypeError('PipeStressExport contains no <Branch> sections.');
  return {
    schema: 'inputxml-managed-stage/v1',
    sourceName: String(sourceName),
    generator: 'psi-staged-adapter/v1',
    objects,
  };
}
