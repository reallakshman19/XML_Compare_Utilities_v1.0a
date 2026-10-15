import { matchDtxrRowsForNode } from './inputxml-workspace-dtxr.js';

/**
 * CleanXML builder for InputXML Workspace.
 * Inputs: Aveva/workflow node XML text plus optional DTXR rows.
 * Outputs: normalized branch/node tables and 5C-compatible CleanXML.
 * Fallback: component roles are inferred from text, ref grouping, shared POS, bore changes, DTXR, and geometry when Endpoint is blank.
 */

export const INPUTXML_WORKSPACE_CLEANXML_SCHEMA = 'inputxml-workspace-cleanxml/v1';

const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase();
const esc = (value) => clean(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const ROUTE_EXCLUDED_TYPES = new Set(['GASK']);
const POS_KEY_MM = 1;

function tagBlocks(xml = '', tag = '') {
  const out = [];
  const re = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>[\\s\\S]*?<\\/(?:\\w+:)?${tag}>`, 'gi');
  let match;
  while ((match = re.exec(String(xml ?? '')))) out.push(match[0]);
  return out;
}

function tagText(xml = '', tag = '') {
  const re = new RegExp(`<(?:\\w+:)?${tag}\\b[^>]*>([\\s\\S]*?)<\\/(?:\\w+:)?${tag}>`, 'i');
  const match = String(xml ?? '').match(re);
  return clean(match?.[1]?.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1') || '');
}

function firstText(xml = '', tags = []) {
  for (const tag of tags) {
    const value = tagText(xml, tag);
    if (value) return value;
  }
  return '';
}

function maybeNumber(value) {
  const raw = clean(value);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function parsePosition(value = '') {
  const nums = clean(value).split(/[,\s]+/).map(Number).filter(Number.isFinite);
  return nums.length >= 3 ? { x: nums[0], y: nums[1], z: nums[2] } : null;
}

function positionText(position) {
  if (!position) return '';
  return [position.x, position.y, position.z].map((value) => Number(value).toFixed(6).replace(/\.?0+$/, '')).join(' ');
}

function positionKey(position) {
  if (!position) return '';
  return [position.x, position.y, position.z].map((value) => String(Math.round(Number(value) / POS_KEY_MM))).join('|');
}

function branchContext(branchXml = '', branchIndex = 0) {
  const pressureXml = tagBlocks(branchXml, 'Pressure')[0] || branchXml;
  const temperatureXml = tagBlocks(branchXml, 'Temperature')[0] || branchXml;
  const pressures = Array.from({ length: 9 }, (_, index) => firstText(pressureXml, [`Pressure${index + 1}`, `P${index + 1}`]));
  const temperatures = Array.from({ length: 9 }, (_, index) => firstText(temperatureXml, [`Temperature${index + 1}`, `T${index + 1}`]));
  return {
    branchName: firstText(branchXml, ['Branchname', 'BranchName', 'LineNo', 'OWNER']) || `(branch ${branchIndex + 1})`,
    pressures,
    temperatures,
    hydroPressure: firstText(pressureXml, ['HydroPressure', 'Hydro_Pressure']),
    materialNumber: firstText(branchXml, ['MaterialNumber', 'MaterialCode', 'MATERIAL_NUM']),
    materialName: firstText(branchXml, ['MaterialName', 'Material']),
    insulationDensity: firstText(branchXml, ['InsulationDensity', 'INSUL_DENSITY']),
    fluidDensity: firstText(branchXml, ['FluidDensity', 'FLUID_DENSITY']),
    pipingClass: firstText(branchXml, ['PipingClass', 'Piping_Class', 'CLASS']),
    rating: firstText(branchXml, ['Rating', 'CLASS_GRADE']),
  };
}

function parseRestraints(nodeXml = '') {
  const blocks = [...tagBlocks(nodeXml, 'Restraint'), ...tagBlocks(nodeXml, 'CustomRestraint')];
  return blocks.map((block) => ({
    type: firstText(block, ['Type', 'RestraintType', 'Direction']) || firstText(block, ['RES_TYPEID']),
    stiffness: firstText(block, ['Stiffness', 'STIFFNESS']),
    gap: firstText(block, ['Gap', 'GAP']),
    friction: firstText(block, ['Friction', 'FricCoef', 'FRIC_COEF']),
    xcosine: firstText(block, ['DirectionCosineX', 'XCOSINE', 'XCosine']),
    ycosine: firstText(block, ['DirectionCosineY', 'YCOSINE', 'YCosine']),
    zcosine: firstText(block, ['DirectionCosineZ', 'ZCOSINE', 'ZCosine']),
    tag: firstText(block, ['Tag', 'RES_TAG']),
  })).filter((row) => Object.values(row).some((value) => clean(value)));
}

function parseNode(branch, nodeXml = '', nodeIndex = 0) {
  const nodeNumberRaw = firstText(nodeXml, ['NodeNumber', 'Node', 'NODE']);
  const explicitType = firstText(nodeXml, ['RealComponentType', 'ComponentRole', 'ComponentType', 'Type']);
  const sourceType = firstText(nodeXml, ['ComponentType', 'Type']);
  return {
    branchIndex: branch.branchIndex,
    branchName: branch.branchName,
    branch,
    nodeIndex,
    nodeNumberRaw,
    nodeNumber: maybeNumber(nodeNumberRaw),
    nodeName: firstText(nodeXml, ['NodeName', 'Name', 'NAME']),
    endpoint: firstText(nodeXml, ['Endpoint', 'ENDPOINT', 'End']),
    sourceComponentType: upper(sourceType),
    componentType: upper(explicitType || sourceType),
    componentTypeOverride: firstText(nodeXml, ['ComponentTypeOverride']),
    connectionType: upper(firstText(nodeXml, ['ConnectionType', 'Connection', 'BranchConnection'])),
    componentRefNo: firstText(nodeXml, ['ComponentRefNo', 'ComponentRef', 'REF', 'CREF']),
    position: parsePosition(firstText(nodeXml, ['Position', 'POS', 'APOS', 'LPOS'])),
    od: maybeNumber(firstText(nodeXml, ['OutsideDiameter', 'OD', 'ABORE', 'Bore', 'BoreMm'])),
    wallThickness: firstText(nodeXml, ['WallThickness', 'WALL_THICK', 'WT']),
    corrosionAllowance: firstText(nodeXml, ['CorrosionAllowance', 'CORR_ALLOW']),
    insulationThickness: firstText(nodeXml, ['InsulationThickness', 'INSUL_THICK']),
    bendRadius: firstText(nodeXml, ['BendRadius', 'RADIUS']),
    sif: firstText(nodeXml, ['SIF']),
    rigid: firstText(nodeXml, ['Rigid', 'RIGID']),
    weight: firstText(nodeXml, ['Weight', 'WEIGHT', 'NWEI']),
    boreMm: firstText(nodeXml, ['BoreMm', 'Bore', 'ABORE']),
    pipingClass: firstText(nodeXml, ['PipingClass', 'Piping_Class', 'CLASS']),
    rating: firstText(nodeXml, ['Rating', 'CLASS_GRADE']),
    materialName: firstText(nodeXml, ['MaterialName', 'Material']),
    materialCode: firstText(nodeXml, ['MaterialCode', 'MaterialNumber']),
    dtxrPos: firstText(nodeXml, ['DTXR_POS', 'DtxrPos', 'DTXR']),
    dtxrPs: firstText(nodeXml, ['DTXR_PS', 'DtxrPs']),
    teedescPos: firstText(nodeXml, ['TEEDESC_POS', 'TEEDESC']),
    restraints: parseRestraints(nodeXml),
    resolverConfidence: '',
    resolverBasis: '',
  };
}

function inferFromText(row) {
  const hay = upper([row.componentType, row.sourceComponentType, row.connectionType, row.nodeName, row.componentRefNo, row.dtxrPos, row.dtxrPs].join(' '));
  if (/OLET|WOL|SOCKOLET|THREADOLET/.test(hay)) return { role: 'OLET', confidence: 0.95, basis: 'component text contains OLET' };
  if (/TEE|BRANCH/.test(hay)) return { role: /BRANCH/.test(hay) && !/TEE/.test(hay) ? 'BRAN' : 'TEE', confidence: 0.9, basis: 'component text contains TEE/BRANCH' };
  if (/REDU|REDUCER/.test(hay)) return { role: 'REDU', confidence: 0.9, basis: 'component text contains REDUCER' };
  if (/ELBO|BEND/.test(hay)) return { role: 'ELBO', confidence: 0.9, basis: 'component text contains ELBO/BEND' };
  if (/VALV|VALVE/.test(hay)) return { role: 'VALV', confidence: 0.85, basis: 'component text contains VALVE' };
  if (/FLAN/.test(hay)) return { role: 'FLAN', confidence: 0.85, basis: 'component text contains FLANGE' };
  if (/SUPPORT|GUIDE|LINE\s*STOP|REST|ANCHOR|ANCI|ATTA/.test(hay)) return { role: 'ATTA', confidence: 0.82, basis: 'DTXR/name support text' };
  return null;
}

function angleRole(prev, row, next) {
  if (!prev?.position || !row?.position || !next?.position) return null;
  const a = { x: row.position.x - prev.position.x, y: row.position.y - prev.position.y, z: row.position.z - prev.position.z };
  const b = { x: next.position.x - row.position.x, y: next.position.y - row.position.y, z: next.position.z - row.position.z };
  const la = Math.hypot(a.x, a.y, a.z);
  const lb = Math.hypot(b.x, b.y, b.z);
  if (la <= 1e-6 || lb <= 1e-6) return null;
  const dot = (a.x * b.x + a.y * b.y + a.z * b.z) / (la * lb);
  if (Math.abs(dot) < 0.35) return { role: 'ELBO', confidence: 0.7, basis: 'geometry direction change' };
  return null;
}

function resolveRole(row, index, rows, sharedPositionCounts) {
  if (clean(row.componentTypeOverride)) return { role: upper(row.componentTypeOverride), confidence: 1, basis: `manual override=${row.componentTypeOverride}` };
  if (clean(row.endpoint)) return { role: row.componentType || row.sourceComponentType || 'PCOM', confidence: 1, basis: `Endpoint=${row.endpoint}` };
  const textRole = inferFromText(row);
  const sharedCount = sharedPositionCounts.get(positionKey(row.position)) || 0;
  if (sharedCount >= 3) {
    const teeLike = textRole?.role === 'OLET' ? 'OLET' : 'TEE';
    return { role: teeLike, confidence: Math.max(textRole?.confidence || 0, 0.88), basis: `shared POS by ${sharedCount} nodes` };
  }
  const prev = rows[index - 1];
  const next = rows[index + 1];
  const prevOd = Number(prev?.od);
  const nextOd = Number(next?.od);
  if (Number.isFinite(prevOd) && Number.isFinite(nextOd) && Math.abs(prevOd - nextOd) > 0.5) {
    return { role: 'REDU', confidence: 0.78, basis: 'bore change across node' };
  }
  const geometryRole = angleRole(prev, row, next);
  if (geometryRole) return geometryRole;
  if (textRole) return textRole;
  return { role: row.componentType || row.sourceComponentType || 'PCOM', confidence: 0.45, basis: 'default component type fallback' };
}

function normalizeBranches(branches) {
  const allRows = branches.flatMap((branch) => branch.nodes);
  const sharedPositionCounts = new Map();
  for (const row of allRows) {
    const key = positionKey(row.position);
    if (key) sharedPositionCounts.set(key, (sharedPositionCounts.get(key) || 0) + 1);
  }
  for (const branch of branches) {
    branch.nodes = branch.nodes.map((row, index, rows) => {
      const resolved = resolveRole(row, index, rows, sharedPositionCounts);
      return { ...row, componentType: resolved.role, resolverConfidence: resolved.confidence, resolverBasis: resolved.basis };
    });
  }
  return branches;
}

export function applyRoleResolution(branches = []) {
  return normalizeBranches(branches);
}

export function applyDtxrMatches(branches = [], dtxrRows = []) {
  if (!dtxrRows.length) return branches;
  for (const branch of branches) {
    branch.nodes = branch.nodes.map((node) => {
      const match = matchDtxrRowsForNode(node, dtxrRows, { positionToleranceMm: 6 });
      return {
        ...node,
        dtxrPos: match.dtxrPos || node.dtxrPos,
        dtxrPs: match.dtxrPs || node.dtxrPs,
        resolverBasis: [node.resolverBasis, match.basis].filter(Boolean).join('; '),
      };
    });
  }
  return branches;
}

export function tablesFromBranches(branches = []) {
  const nodes = branches.flatMap((branch) => branch.nodes);
  return {
    schema: INPUTXML_WORKSPACE_CLEANXML_SCHEMA,
    branches,
    nodes,
    coordinates: nodes.filter((node) => node.position).map((node) => ({ branchName: node.branchName, nodeNumber: node.nodeNumberRaw, nodeName: node.nodeName, position: positionText(node.position) })),
    dtxr: nodes.filter((node) => node.dtxrPos || node.dtxrPs).map((node) => ({ branchName: node.branchName, nodeNumber: node.nodeNumberRaw, dtxrPos: node.dtxrPos, dtxrPs: node.dtxrPs })),
    supports: nodes.flatMap((node) => node.restraints.map((restraint) => ({ branchName: node.branchName, nodeNumber: node.nodeNumberRaw, nodeName: node.nodeName, ...restraint }))),
  };
}

export function parseAvevaXmlToTables(xmlText = '', options = {}) {
  const branchXmls = tagBlocks(xmlText, 'Branch');
  if (!branchXmls.length) throw new Error('No <Branch> blocks found for CleanXML conversion.');
  const branches = branchXmls.map((branchXml, branchIndex) => {
    const context = branchContext(branchXml, branchIndex);
    const branch = { ...context, branchIndex, nodes: [] };
    branch.nodes = tagBlocks(branchXml, 'Node').map((nodeXml, nodeIndex) => parseNode(branch, nodeXml, nodeIndex));
    return branch;
  });
  applyRoleResolution(branches);
  applyDtxrMatches(branches, options.dtxrRows || []);
  return tablesFromBranches(branches);
}

function tag(name, value, indent = '    ') {
  return clean(value) ? `${indent}<${name}>${esc(value)}</${name}>` : '';
}

function numberedBlock(name, childPrefix, values = [], extra = {}) {
  const rows = values.map((value, index) => tag(`${childPrefix}${index + 1}`, value, '      ')).filter(Boolean);
  for (const [key, value] of Object.entries(extra)) {
    const row = tag(key, value, '      ');
    if (row) rows.push(row);
  }
  return rows.length ? `    <${name}>\n${rows.join('\n')}\n    </${name}>` : '';
}

export function positiveRouteNodes(nodes = []) {
  let generated = 10;
  return nodes.flatMap((node) => {
    if (ROUTE_EXCLUDED_TYPES.has(upper(node.componentType))) return [];
    const n = Number(node.nodeNumber);
    if (Number.isFinite(n) && n > 0) return [node];
    if (clean(node.nodeNumberRaw) === '' && node.position) {
      generated += 10;
      return [{ ...node, nodeNumber: generated, nodeNumberRaw: String(generated), resolverBasis: [node.resolverBasis, 'generated positive NodeNumber'].filter(Boolean).join('; ') }];
    }
    return [];
  });
}

function nodeXml(node) {
  const rows = [
    tag('NodeNumber', node.nodeNumberRaw, '      '),
    tag('NodeName', node.nodeName, '      '),
    tag('Endpoint', node.endpoint, '      '),
    tag('ComponentType', node.componentType, '      '),
    tag('RealComponentType', node.componentType, '      '),
    tag('SourceComponentType', node.sourceComponentType, '      '),
    tag('ComponentTypeOverride', node.componentTypeOverride, '      '),
    tag('ConnectionType', node.connectionType, '      '),
    tag('ComponentRefNo', node.componentRefNo, '      '),
    tag('Position', positionText(node.position), '      '),
    tag('OutsideDiameter', node.od, '      '),
    tag('WallThickness', node.wallThickness, '      '),
    tag('CorrosionAllowance', node.corrosionAllowance, '      '),
    tag('InsulationThickness', node.insulationThickness, '      '),
    tag('BendRadius', node.bendRadius, '      '),
    tag('SIF', node.sif, '      '),
    tag('Rigid', node.rigid, '      '),
    tag('Weight', node.weight, '      '),
    tag('BoreMm', node.boreMm, '      '),
    tag('PipingClass', node.pipingClass, '      '),
    tag('Rating', node.rating, '      '),
    tag('MaterialName', node.materialName, '      '),
    tag('MaterialCode', node.materialCode, '      '),
    tag('DTXR_POS', node.dtxrPos, '      '),
    tag('DTXR_PS', node.dtxrPs, '      '),
    tag('TEEDESC_POS', node.teedescPos, '      '),
    tag('ResolverConfidence', node.resolverConfidence, '      '),
    tag('ResolverBasis', node.resolverBasis, '      '),
  ].filter(Boolean);
  for (const restraint of node.restraints || []) {
    const restRows = [
      tag('Type', restraint.type, '        '),
      tag('Stiffness', restraint.stiffness, '        '),
      tag('Gap', restraint.gap, '        '),
      tag('Friction', restraint.friction, '        '),
      tag('DirectionCosineX', restraint.xcosine, '        '),
      tag('DirectionCosineY', restraint.ycosine, '        '),
      tag('DirectionCosineZ', restraint.zcosine, '        '),
      tag('Tag', restraint.tag, '        '),
    ].filter(Boolean);
    if (restRows.length) rows.push(`      <Restraint>\n${restRows.join('\n')}\n      </Restraint>`);
  }
  return `    <Node>\n${rows.join('\n')}\n    </Node>`;
}

export function buildCleanXmlFromTables(tables = {}, options = {}) {
  const sourceName = clean(options.sourceName) || 'InputXML Workspace CleanXML';
  const branches = tables.branches || [];
  const branchXml = branches.map((branch) => {
    const rows = [
      tag('Branchname', branch.branchName),
      numberedBlock('Pressure', 'Pressure', branch.pressures, { HydroPressure: branch.hydroPressure }),
      numberedBlock('Temperature', 'Temperature', branch.temperatures),
      tag('MaterialNumber', branch.materialNumber),
      tag('MaterialName', branch.materialName),
      tag('InsulationDensity', branch.insulationDensity),
      tag('FluidDensity', branch.fluidDensity),
      tag('PipingClass', branch.pipingClass),
      tag('Rating', branch.rating),
      ...positiveRouteNodes(branch.nodes).map(nodeXml),
    ].filter(Boolean);
    return `  <Branch>\n${rows.join('\n')}\n  </Branch>`;
  }).join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>\n<CleanXML schema="${INPUTXML_WORKSPACE_CLEANXML_SCHEMA}" sourceName="${esc(sourceName)}">\n${branchXml}\n</CleanXML>\n`;
}

export function buildCleanXml(xmlText = '', options = {}) {
  const tables = parseAvevaXmlToTables(xmlText, options);
  return { tables, cleanXmlText: buildCleanXmlFromTables(tables, options) };
}

export const _test = Object.freeze({ tagBlocks, tagText, firstText, parsePosition, positionText, positionKey, branchContext, parseRestraints, inferFromText, angleRole, positiveRouteNodes, resolveRole, normalizeBranches });
