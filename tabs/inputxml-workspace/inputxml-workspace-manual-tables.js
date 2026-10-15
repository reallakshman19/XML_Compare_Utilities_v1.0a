import { applyRoleResolution, tablesFromBranches } from './inputxml-workspace-cleanxml.js';

/**
 * Manual table entry adapter for InputXML Workspace Tab 1.
 * Inputs: pasted Branches/Components/Supports/Coordinates tables (loose TSV/CSV/pipe text, parsed elsewhere).
 * Outputs: the same branches/nodes shape parseAvevaXmlToTables() produces, so manual-table CleanXML goes
 * through the identical role resolver as XML-sourced CleanXML.
 * Fallback: a branch referenced only by a Components row (no matching Branches row) gets a minimal synthesized context.
 */

const clean = (value) => String(value ?? '').trim();
const upper = (value) => clean(value).toUpperCase();
const num = (value) => {
  const n = Number(clean(value));
  return Number.isFinite(n) ? n : null;
};

export const BRANCH_COLUMNS = Object.freeze([
  { key: 'branchName' },
  ...Array.from({ length: 9 }, (_, i) => ({ key: `pressure${i + 1}` })),
  ...Array.from({ length: 9 }, (_, i) => ({ key: `temperature${i + 1}` })),
  { key: 'hydroPressure' },
  { key: 'materialNumber' },
  { key: 'materialName' },
  { key: 'insulationDensity' },
  { key: 'fluidDensity' },
  { key: 'pipingClass' },
  { key: 'rating' },
]);

export const COMPONENT_COLUMNS = Object.freeze([
  { key: 'branchName' },
  { key: 'nodeNumberRaw' },
  { key: 'nodeName' },
  { key: 'endpoint' },
  { key: 'componentType' },
  { key: 'componentTypeOverride' },
  { key: 'connectionType' },
  { key: 'componentRefNo' },
  { key: 'positionX' },
  { key: 'positionY' },
  { key: 'positionZ' },
  { key: 'od' },
  { key: 'wallThickness' },
  { key: 'corrosionAllowance' },
  { key: 'insulationThickness' },
  { key: 'bendRadius' },
  { key: 'sif' },
  { key: 'rigid' },
  { key: 'weight' },
  { key: 'boreMm' },
  { key: 'pipingClass' },
  { key: 'rating' },
  { key: 'materialName' },
  { key: 'materialCode' },
]);

export const SUPPORT_COLUMNS = Object.freeze([
  { key: 'branchName' },
  { key: 'nodeNumber' },
  { key: 'nodeName' },
  { key: 'type' },
  { key: 'stiffness' },
  { key: 'gap' },
  { key: 'friction' },
  { key: 'xcosine' },
  { key: 'ycosine' },
  { key: 'zcosine' },
  { key: 'tag' },
]);

export const COORDINATE_COLUMNS = Object.freeze([
  { key: 'branchName' },
  { key: 'nodeNumber' },
  { key: 'nodeName' },
  { key: 'x' },
  { key: 'y' },
  { key: 'z' },
]);

function nodeKey(branchName, nodeNumber) {
  return `${clean(branchName)}|${clean(nodeNumber)}`;
}

function branchDefaults(source, name) {
  return {
    branchName: name,
    pressures: Array.from({ length: 9 }, (_, i) => clean(source?.[`pressure${i + 1}`])),
    temperatures: Array.from({ length: 9 }, (_, i) => clean(source?.[`temperature${i + 1}`])),
    hydroPressure: clean(source?.hydroPressure),
    materialNumber: clean(source?.materialNumber),
    materialName: clean(source?.materialName),
    insulationDensity: clean(source?.insulationDensity),
    fluidDensity: clean(source?.fluidDensity),
    pipingClass: clean(source?.pipingClass),
    rating: clean(source?.rating),
    nodes: [],
  };
}

function buildSupportsIndex(supportRows = []) {
  const map = new Map();
  for (const row of supportRows) {
    const key = nodeKey(row.branchName, row.nodeNumber);
    const list = map.get(key) || [];
    list.push({
      type: clean(row.type),
      stiffness: clean(row.stiffness),
      gap: clean(row.gap),
      friction: clean(row.friction),
      xcosine: clean(row.xcosine),
      ycosine: clean(row.ycosine),
      zcosine: clean(row.zcosine),
      tag: clean(row.tag),
    });
    map.set(key, list);
  }
  return map;
}

function buildCoordinatesIndex(coordinateRows = []) {
  const map = new Map();
  for (const row of coordinateRows) {
    const key = nodeKey(row.branchName, row.nodeNumber);
    if (map.has(key)) continue;
    const x = num(row.x), y = num(row.y), z = num(row.z);
    if (x === null || y === null || z === null) continue;
    map.set(key, { x, y, z });
  }
  return map;
}

export function buildTablesFromManualRows({ branchRows = [], componentRows = [], supportRows = [], coordinateRows = [] } = {}) {
  const branches = [];
  const branchIndexByName = new Map();
  const ensureBranch = (rawName) => {
    const name = clean(rawName) || '(unnamed branch)';
    if (!branchIndexByName.has(name)) {
      const source = branchRows.find((row) => (clean(row.branchName) || '(unnamed branch)') === name);
      const branch = { ...branchDefaults(source, name), branchIndex: branches.length };
      branchIndexByName.set(name, branches.length);
      branches.push(branch);
    }
    return branches[branchIndexByName.get(name)];
  };

  const supportsIndex = buildSupportsIndex(supportRows);
  const coordinatesIndex = buildCoordinatesIndex(coordinateRows);

  componentRows.forEach((row) => {
    const branch = ensureBranch(row.branchName);
    const posX = num(row.positionX), posY = num(row.positionY), posZ = num(row.positionZ);
    const position = (posX !== null && posY !== null && posZ !== null)
      ? { x: posX, y: posY, z: posZ }
      : coordinatesIndex.get(nodeKey(branch.branchName, row.nodeNumberRaw)) || null;
    const componentType = upper(row.componentType);
    branch.nodes.push({
      branchIndex: branch.branchIndex,
      branchName: branch.branchName,
      branch,
      nodeIndex: branch.nodes.length,
      nodeNumberRaw: clean(row.nodeNumberRaw),
      nodeNumber: num(row.nodeNumberRaw),
      nodeName: clean(row.nodeName),
      endpoint: clean(row.endpoint),
      sourceComponentType: componentType,
      componentType,
      componentTypeOverride: clean(row.componentTypeOverride),
      connectionType: upper(row.connectionType),
      componentRefNo: clean(row.componentRefNo),
      position,
      od: num(row.od),
      wallThickness: clean(row.wallThickness),
      corrosionAllowance: clean(row.corrosionAllowance),
      insulationThickness: clean(row.insulationThickness),
      bendRadius: clean(row.bendRadius),
      sif: clean(row.sif),
      rigid: clean(row.rigid),
      weight: clean(row.weight),
      boreMm: clean(row.boreMm),
      pipingClass: clean(row.pipingClass),
      rating: clean(row.rating),
      materialName: clean(row.materialName),
      materialCode: clean(row.materialCode),
      dtxrPos: '',
      dtxrPs: '',
      teedescPos: '',
      restraints: supportsIndex.get(nodeKey(branch.branchName, row.nodeNumberRaw)) || [],
      resolverConfidence: '',
      resolverBasis: '',
    });
  });

  applyRoleResolution(branches);
  return tablesFromBranches(branches);
}

export const _test = Object.freeze({ nodeKey, branchDefaults, buildSupportsIndex, buildCoordinatesIndex });
