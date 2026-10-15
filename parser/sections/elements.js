/**
 * elements.js — Parse #$ ELEMENTS section of CAESAR II neutral file.
 *
 * Protected CII writer authority uses a fixed 15-row element block. The
 * engineering rows consumed here are:
 *   Row 1 : FROM TO DX DY DZ OD
 *   Row 2 : WALL INSUL CORR T1 T2 T3
 *   Row 3 : T4 T5 T6 T7 T8 T9
 *   Row 4 : P1 P2 P3 P4 P5 P6
 *   Row 5 : P7 P8 P9 <protected unrelated fields>
 *   Row 6 : INSUL_DENS FLUID_DENS <protected fields> HYDRO_P
 *
 * Remaining rows contain material data, flags and auxiliary pointers. Writer
 * 1B must never infer writable semantics for those rows merely because they
 * are numeric.
 *
 * CAESAR neutral records are fixed-field/Fortran-style records. Adjacent
 * positive/negative values need not contain whitespace, so the fixed-field
 * decoder remains the primary numeric reader.
 */

import { pipeLength } from '../../utils/formatter.js';
import { decodeCiiNumericRow } from '../fixed-field.js';

const ELEMENT_BLOCK_ROWS = 15;

/** Default material properties (Carbon Steel ASTM A106 Gr. B). */
const CS_DEFAULTS = {
  E_cold: 203390.7,
  E_hot: 178960.6,
  density: 7.833e-3,
  poisson: 0.292,
  material: 'CS',
};

function isElementHeader(parts) {
  if (!Array.isArray(parts) || parts.length < 6) return false;
  const [from, to, , , , od] = parts;
  if (!Number.isInteger(from) || from <= 0 || from > 99999) return false;
  if (!Number.isInteger(to) || to <= 0 || to > 99999 || from === to) return false;
  return Number.isFinite(od) && od > 10;
}

function canonicalBlocks(lines) {
  const rows = lines.filter((line) => line.trim() && !line.trim().startsWith('*'));
  if (!rows.length || rows.length % ELEMENT_BLOCK_ROWS !== 0) return null;
  const blocks = [];
  for (let offset = 0; offset < rows.length; offset += ELEMENT_BLOCK_ROWS) {
    const decoded = rows.slice(offset, offset + ELEMENT_BLOCK_ROWS).map((row) => decodeCiiNumericRow(row));
    if (!isElementHeader(decoded[0])) return null;
    blocks.push(decoded);
  }
  return blocks;
}

function legacyBlocks(lines, log) {
  const dataRows = lines
    .filter((line) => line.trim() && !line.trim().startsWith('*'))
    .map((line) => decodeCiiNumericRow(line))
    .filter((parts) => Array.isArray(parts) && parts.length >= 5 && Number.isFinite(parts[0]) && Number.isFinite(parts[1]));
  const blocks = [];
  let current = null;
  for (const parts of dataRows) {
    if (isElementHeader(parts)) {
      current = [parts];
      blocks.push(current);
    } else if (current) current.push(parts);
  }
  if (blocks.length) {
    log.push({ level: 'WARN', msg: 'ELEMENTS: fixed 15-row block layout unavailable; using legacy element-start fallback' });
  }
  return blocks;
}

function finiteField(row, index, fallback = 0) {
  const value = Number(row?.[index]);
  return Number.isFinite(value) ? value : fallback;
}

function processFields(block) {
  const row2 = block[1] || [];
  const row3 = block[2] || [];
  const row4 = block[3] || [];
  const row5 = block[4] || [];
  const row6 = block[5] || [];
  return {
    wall: finiteField(row2, 0),
    insul: finiteField(row2, 1),
    corrosion: finiteField(row2, 2),
    T1: finiteField(row2, 3),
    T2: finiteField(row2, 4),
    T3: finiteField(row2, 5),
    T4: finiteField(row3, 0),
    T5: finiteField(row3, 1),
    T6: finiteField(row3, 2),
    T7: finiteField(row3, 3),
    T8: finiteField(row3, 4),
    T9: finiteField(row3, 5),
    P1: finiteField(row4, 0),
    P2: finiteField(row4, 1),
    P3: finiteField(row4, 2),
    P4: finiteField(row4, 3),
    P5: finiteField(row4, 4),
    P6: finiteField(row4, 5),
    P7: finiteField(row5, 0),
    P8: finiteField(row5, 1),
    P9: finiteField(row5, 2),
    insulationDensity: finiteField(row6, 0),
    fluidDensity: finiteField(row6, 1),
    hydroPressure: finiteField(row6, 5),
  };
}

function sanitizePressure(value) {
  return value === 9999.99 || value < 0 ? 0 : value;
}

export function parseElements(lines, log) {
  const elements = [];
  const nodes = {};
  let blocks = canonicalBlocks(lines);
  if (!blocks) blocks = legacyBlocks(lines, log);
  if (!blocks.length) {
    log.push({ level: 'WARN', msg: 'ELEMENTS: no element blocks detected — check fixed-field format' });
    return { elements, nodes };
  }

  const firstFrom = Math.round(Number(blocks[0][0]?.[0]));
  nodes[firstFrom] = { x: 0, y: 0, z: 0 };

  for (let idx = 0; idx < blocks.length; idx += 1) {
    const header = blocks[idx][0] || [];
    if (!isElementHeader(header)) {
      log.push({ level: 'ERROR', msg: `ELEMENTS: invalid fixed-field header at block ${idx + 1}` });
      continue;
    }
    const from = Math.round(header[0]);
    const to = Math.round(header[1]);
    const dx = Number(header[2]);
    const dy = Number(header[3]);
    const dz = Number(header[4]);
    const od = Number(header[5]);
    if (![dx, dy, dz, od].every(Number.isFinite)) {
      log.push({ level: 'ERROR', msg: `ELEMENTS: invalid fixed-field geometry for ${from}→${to}` });
      continue;
    }

    if (!nodes[from]) {
      log.push({ level: 'WARN', msg: `Node ${from}: no known position — using origin` });
      nodes[from] = { x: 0, y: 0, z: 0 };
    }
    const origin = nodes[from];
    const toPos = { x: origin.x + dx, y: origin.y + dy, z: origin.z + dz };
    if (!nodes[to]) nodes[to] = toPos;

    const process = processFields(blocks[idx]);
    for (let caseIndex = 1; caseIndex <= 9; caseIndex += 1) {
      process[`P${caseIndex}`] = sanitizePressure(process[`P${caseIndex}`]);
    }
    const { E_cold, E_hot, density, poisson, material } = CS_DEFAULTS;

    elements.push({
      index: idx,
      from,
      to,
      dx,
      dy,
      dz,
      od,
      ...process,
      E_cold,
      E_hot,
      density,
      poisson,
      material,
      length: pipeLength(dx, dy, dz),
      fromPos: { ...origin },
      toPos: { ...toPos },
      hasBend: false,
    });
  }

  log.push({ level: 'INFO', msg: `ELEMENTS: ${elements.length} element(s) parsed → ${Object.keys(nodes).length} unique node(s)` });
  if (elements.length) {
    const uniqueODs = [...new Set(elements.map((element) => element.od.toFixed(1)))];
    const T1s = elements.map((element) => element.T1);
    const P1s = elements.map((element) => element.P1);
    log.push({ level: 'INFO', msg: `ELEMENTS: OD sizes detected → ${uniqueODs.join(', ')} mm` });
    log.push({
      level: 'INFO',
      msg: `ELEMENTS: T1 range ${Math.min(...T1s)}–${Math.max(...T1s)}°C | P1 range ${Math.min(...P1s)}–${Math.max(...P1s)} bar | Material: ${CS_DEFAULTS.material} (default)`,
    });
  }
  return { elements, nodes };
}
