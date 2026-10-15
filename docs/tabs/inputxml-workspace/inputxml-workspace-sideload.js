import { parseLooseTable, projectRows, rowsToTabText } from './inputxml-workspace-table.js';
import { mutateRestraintType } from '../../converters/xml-cii2019-core/restraint-type-mutation.js';

/**
 * ACCDB-helper/paste enrichment adapter for InputXML Workspace.
 * Inputs: pasted helper exports for CII tables.
 * Outputs: the four existing XmlCompare sideload text inputs and a projected Basic Element table.
 * Fallback: REST_PTR is used to map restraints to element FROM/TO nodes when direct node pairs are absent.
 */

export const BASIC_ELEMENT_COLUMNS = Object.freeze([
  { key: 'ELEMENTID', aliases: ['ELEMENTID', 'ELEMENT_ID', 'ID'] },
  { key: 'FROM_NODE', aliases: ['FROM_NODE', 'FROM NODE', 'FROM'] },
  { key: 'TO_NODE', aliases: ['TO_NODE', 'TO NODE', 'TO'] },
  { key: 'FROM_NODE_NAME', aliases: ['FROM_NODE_NAME', 'FROM NAME', 'FROM_NODE_NAME'] },
  { key: 'TO_NODE_NAME', aliases: ['TO_NODE_NAME', 'TO NAME', 'TO_NODE_NAME'] },
  { key: 'LINE_NO', aliases: ['LINE_NO', 'LINE NO', 'LINE_ID', 'BRANCH'] },
  { key: 'REST_PTR', aliases: ['REST_PTR', 'REST PTR', 'RESTPTR'] },
  { key: 'ELEMENT_NAME', aliases: ['ELEMENT_NAME', 'ELEMENT NAME', 'NAME'] },
]);

export const RESTRAINT_COLUMNS = Object.freeze([
  { key: 'REST_PTR', aliases: ['REST_PTR', 'REST PTR', 'RESTPTR'] },
  { key: 'NODE_NUM', aliases: ['NODE_NUM', 'NODE', 'NODE NUMBER'] },
  { key: 'NODE_NAME', aliases: ['NODE_NAME', 'NODE NAME'] },
  { key: 'RES_TYPEID', aliases: ['RES_TYPEID', 'TYPE', 'RES TYPE'] },
  { key: 'STIFFNESS', aliases: ['STIFFNESS', 'STIFF'] },
  { key: 'GAP', aliases: ['GAP'] },
  { key: 'FRIC_COEF', aliases: ['FRIC_COEF', 'FRICTION', 'MU'] },
  { key: 'CNODE', aliases: ['CNODE'] },
  { key: 'RES_TAG', aliases: ['RES_TAG', 'TAG', 'SUPPORT TAG'] },
]);

export const NODAL_COORD_COLUMNS = Object.freeze([
  { key: 'FROM_NODE', aliases: ['FROM_NODE', 'FROM NODE', 'FROM'] },
  { key: 'TO_NODE', aliases: ['TO_NODE', 'TO NODE', 'TO'] },
  { key: 'FROM_NODE_X', aliases: ['FROM_NODE_X', 'FROM X'] },
  { key: 'FROM_NODE_Y', aliases: ['FROM_NODE_Y', 'FROM Y'] },
  { key: 'FROM_NODE_Z', aliases: ['FROM_NODE_Z', 'FROM Z'] },
  { key: 'TO_NODE_X', aliases: ['TO_NODE_X', 'TO X'] },
  { key: 'TO_NODE_Y', aliases: ['TO_NODE_Y', 'TO Y'] },
  { key: 'TO_NODE_Z', aliases: ['TO_NODE_Z', 'TO Z'] },
]);

export const USER_COORD_COLUMNS = Object.freeze([
  { key: 'NODE', aliases: ['NODE', 'NODE_NUM', 'NODE NUMBER'] },
  { key: 'NODE_X', aliases: ['NODE_X', 'X'] },
  { key: 'NODE_Y', aliases: ['NODE_Y', 'Y'] },
  { key: 'NODE_Z', aliases: ['NODE_Z', 'Z'] },
]);

export const SAMPLE_BASIC_TEXT = 'ELEMENTID\tFROM_NODE\tTO_NODE\tFROM_NODE_NAME\tTO_NODE_NAME\tLINE_NO\tREST_PTR\tELEMENT_NAME\n1\t10\t20\tPS-1\tPS-2\tL100\tR1\tPIPE-1';
export const SAMPLE_RESTRAINTS_TEXT = 'REST_PTR\tNODE_NUM\tNODE_NAME\tRES_TYPEID\tSTIFFNESS\tGAP\tFRIC_COEF\tCNODE\tRES_TAG\nR1\t20\tPS-2\tGUIDE\t1E12\t0\t0.3\t\tG-101';
export const SAMPLE_NODAL_TEXT = 'FROM_NODE\tTO_NODE\tFROM_NODE_X\tFROM_NODE_Y\tFROM_NODE_Z\tTO_NODE_X\tTO_NODE_Y\tTO_NODE_Z\n10\t20\t0\t0\t0\t1000\t0\t0';
export const SAMPLE_USER_NODAL_TEXT = 'NODE\tNODE_X\tNODE_Y\tNODE_Z\n20\t1000\t0\t0';

const clean = (value) => String(value ?? '').trim();
const nodeKey = (value) => {
  const raw = clean(value);
  const n = Number(raw);
  return Number.isFinite(n) && Math.abs(n - Math.round(n)) < 1e-6 ? String(Math.round(n)) : raw.replace(/\.0+$/, '');
};

function parseBasic(text = '') {
  return projectRows(parseLooseTable(text, BASIC_ELEMENT_COLUMNS), BASIC_ELEMENT_COLUMNS)
    .filter((row) => clean(row.FROM_NODE) || clean(row.TO_NODE) || clean(row.ELEMENTID));
}

function pairByRestPtr(basicRows = []) {
  const map = new Map();
  for (const row of basicRows) {
    const restPtr = clean(row.REST_PTR);
    if (!restPtr) continue;
    map.set(restPtr, { from: row.FROM_NODE, to: row.TO_NODE });
  }
  return map;
}

function uniqueLines(lines = []) {
  return [...new Set(lines.map((line) => clean(line)).filter(Boolean))];
}

function buildLineIdText(basicRows = []) {
  const lines = ['FROM_NODE\tTO_NODE\tLINE_ID'];
  lines.push(...uniqueLines(basicRows.map((row) => `${nodeKey(row.FROM_NODE)}\t${nodeKey(row.TO_NODE)}\t${row.LINE_NO}`)));
  return lines.join('\n');
}

function buildNodeNameText(basicRows = []) {
  const lines = ['FROM_NODE\tTO_NODE\tFROM_NAME\tTO_NAME'];
  lines.push(...uniqueLines(basicRows.map((row) => `${nodeKey(row.FROM_NODE)}\t${nodeKey(row.TO_NODE)}\t${row.FROM_NODE_NAME}\t${row.TO_NODE_NAME}`)));
  return lines.join('\n');
}

function buildRestraintTagResult(restraintRows = [], restPtrPairs = new Map(), mutationConfig = {}) {
  const lines = ['FROM_NODE\tTO_NODE\tNODE\tTYPE\tSTIFFNESS\tGAP\tMU\tCNODE\tTAG'];
  let changedTypes = 0;
  for (const row of restraintRows) {
    const pair = restPtrPairs.get(clean(row.REST_PTR)) || {};
    const tag = clean(row.RES_TAG) || clean(row.NODE_NAME);
    const inputType = clean(row.RES_TYPEID);
    const outputType = mutateRestraintType(inputType, mutationConfig);
    if (outputType !== inputType) changedTypes += 1;
    lines.push([
      nodeKey(pair.from),
      nodeKey(pair.to),
      nodeKey(row.NODE_NUM),
      outputType,
      clean(row.STIFFNESS),
      clean(row.GAP),
      clean(row.FRIC_COEF),
      clean(row.CNODE),
      tag,
    ].join('\t'));
  }
  return { text: uniqueLines(lines).join('\n'), changedTypes };
}

function buildRestraintTagText(restraintRows = [], restPtrPairs = new Map(), mutationConfig = {}) {
  return buildRestraintTagResult(restraintRows, restPtrPairs, mutationConfig).text;
}

function pushCoordinate(map, node, x, y, z, source) {
  const key = nodeKey(node);
  if (!key || ![x, y, z].every((value) => clean(value))) return;
  map.set(key, { node: key, x: clean(x), y: clean(y), z: clean(z), source });
}

function buildCoordinateText(nodalRows = [], userRows = []) {
  const map = new Map();
  for (const row of nodalRows) {
    pushCoordinate(map, row.FROM_NODE, row.FROM_NODE_X, row.FROM_NODE_Y, row.FROM_NODE_Z, 'INPUT_NODAL_COORDINATES:FROM');
    pushCoordinate(map, row.TO_NODE, row.TO_NODE_X, row.TO_NODE_Y, row.TO_NODE_Z, 'INPUT_NODAL_COORDINATES:TO');
  }
  for (const row of userRows) pushCoordinate(map, row.NODE, row.NODE_X, row.NODE_Y, row.NODE_Z, 'INPUT_USER_NODAL_COORDINATES');
  return ['NODE\tX\tY\tZ', ...[...map.values()].map((row) => `${row.node}\t${row.x}\t${row.y}\t${row.z}`)].join('\n');
}

export function buildAccdbSideloadTables({ basicText = '', restraintsText = '', nodalText = '', userNodalText = '', restraintTypeMutation = {} } = {}) {
  const basicRows = parseBasic(basicText);
  const restraintRows = parseLooseTable(restraintsText, RESTRAINT_COLUMNS);
  const nodalRows = parseLooseTable(nodalText, NODAL_COORD_COLUMNS);
  const userRows = parseLooseTable(userNodalText, USER_COORD_COLUMNS);
  const restPtrPairs = pairByRestPtr(basicRows);
  const restraintTags = buildRestraintTagResult(restraintRows, restPtrPairs, restraintTypeMutation);
  return {
    basicRows,
    basicProjectedText: rowsToTabText(basicRows, BASIC_ELEMENT_COLUMNS),
    lineIdText: buildLineIdText(basicRows),
    nodeNameText: buildNodeNameText(basicRows),
    restraintTagText: restraintTags.text,
    coordinateText: buildCoordinateText(nodalRows, userRows),
    diagnostics: {
      basicRows: basicRows.length,
      restraintRows: restraintRows.length,
      nodalRows: nodalRows.length,
      userCoordinateRows: userRows.length,
      restPtrPairs: restPtrPairs.size,
      restraintTypeMutations: restraintTags.changedTypes,
    },
  };
}

export const _test = Object.freeze({ parseBasic, pairByRestPtr, buildLineIdText, buildNodeNameText, buildRestraintTagText, buildRestraintTagResult, buildCoordinateText, nodeKey });
