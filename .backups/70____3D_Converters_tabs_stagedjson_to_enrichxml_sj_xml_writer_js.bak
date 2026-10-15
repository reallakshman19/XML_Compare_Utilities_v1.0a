/**
 * Functionality: builds PSI-116 compliant XML output from enriched
 * component records. Emits the exact schema consumed by xml_to_cii2019.py:
 * PipeStressExport > Pipe > Branch > Node, with all mandatory child tags.
 * Parameters: explicit. Outputs: XML string. No side effects.
 */

import { formatRestraintXml } from './sj-restraint-resolver.js';
import { formatPosition, arrivePosition, leavePosition, bestPosition } from './sj-point-resolver.js';
import { isRigidType, isBoundaryType, isSupportType, rigidValue } from './sj-type-mapper.js';

// ─── Schema constants ────────────────────────────────────────────

const XML_NS = 'http://aveva.com/pipeStress116.xsd';
const NULL_TEMP = '-100000';

/**
 * Build complete enriched XML from a map of branch name → enriched records.
 * @param {Map<string, EnrichedRecord[]>} branchMap
 * @param {Object} config
 * @returns {string}
 */
export function buildEnrichedXml(branchMap, config = {}) {
  const lines = [];
  lines.push(`<?xml version="1.0" encoding="utf-8"?>`);
  lines.push(`<PipeStressExport xmlns="${XML_NS}">`);

  // Root metadata expected by Python parser
  const now = new Date();
  lines.push(`<DateTime>${now.toLocaleString('en-GB')}</DateTime>`);
  lines.push(`<Source>StagedJSON→EnrichXML</Source>`);
  lines.push(`<Version>1.0</Version>`);
  lines.push(`<Purpose>StagedJSON enrichment output</Purpose>`);
  lines.push(`<ProjectName>${esc(config.projectName || '')}</ProjectName>`);
  lines.push(`<MDBName>${esc(config.mdbName || '/')}</MDBName>`);
  lines.push(`<TitleLine>StagedJSON Enriched Export</TitleLine>`);
  lines.push(`<Units>`);
  lines.push(`  <DistanceUnits>mm</DistanceUnits>`);
  lines.push(`  <BoreUnits>mm</BoreUnits>`);
  lines.push(`  <PressureUnits>pascal</PressureUnits>`);
  lines.push(`  <TemperatureUnits>degC</TemperatureUnits>`);
  lines.push(`  <WeightUnits>kg</WeightUnits>`);
  lines.push(`  <ForceUnits>newton</ForceUnits>`);
  lines.push(`  <WallThicknessUnits>mm</WallThicknessUnits>`);
  lines.push(`  <FluidDensityUnits>kg/m3</FluidDensityUnits>`);
  lines.push(`</Units>`);
  lines.push(`<RestrainOpenEnds>Yes</RestrainOpenEnds>`);
  lines.push(`<AmbientTemperature>21</AmbientTemperature>`);

  // Wrap ALL branches in a single <Pipe> element (PSI-116 requirement)
  lines.push(`<Pipe>`);
  lines.push(`<FullName>${esc(config.pipeName || '/STAGEDJSON-EXPORT')}</FullName>`);

  let nodeCounter = 10; // PSI-116 convention: start at 10, increment by 10
  for (const [branchName, records] of branchMap) {
    const branchBlock = buildBranchBlock(branchName, records, config, nodeCounter);
    lines.push(...branchBlock.lines);
    nodeCounter += branchBlock.nodeCount * 10;
  }

  lines.push(`</Pipe>`);
  lines.push(`</PipeStressExport>`);
  return lines.join('\n');
}

// ─── Branch block ────────────────────────────────────────────────

function buildBranchBlock(branchName, records, config, startNum) {
  const lines = [`<Branch>`];
  lines.push(`<Branchname>${esc(branchName)}</Branchname>`);

  // Extract temperature and pressure from first record that has it
  let t1 = NULL_TEMP, t2 = NULL_TEMP, t3 = NULL_TEMP;
  let p1 = '0', p2 = '0', p3 = '0';
  
  for (const rec of records) {
    const ea = rec.enrichedAttributes || {};
    const a = rec.attrs || {};
    if (t1 === NULL_TEMP && (ea.designTemperatureC !== undefined || a.T1 !== undefined)) t1 = ea.designTemperatureC ?? a.T1 ?? a.T ?? NULL_TEMP;
    if (t2 === NULL_TEMP && (ea.operatingTemperatureC !== undefined || a.T2 !== undefined)) t2 = ea.operatingTemperatureC ?? a.T2 ?? NULL_TEMP;
    if (t3 === NULL_TEMP && (ea.minimumTemperatureC !== undefined || a.T3 !== undefined)) t3 = ea.minimumTemperatureC ?? a.T3 ?? NULL_TEMP;
    
    if (p1 === '0') {
       if (ea.designPressureMpa !== undefined && ea.designPressureMpa !== null) p1 = ea.designPressureMpa * 1000000;
       else if (a.P1 !== undefined) p1 = a.P1;
       else if (a.P !== undefined) p1 = a.P;
    }
    if (p2 === '0') p2 = a.P2 ?? '0';
    if (p3 === '0') p3 = a.P3 ?? '0';
  }

  // Temperature block: 9 slots, -100000 = not set (PSI-116 convention)
  lines.push(`<Temperature>`);
  lines.push(`  <Temperature1>${t1}</Temperature1>`);
  lines.push(`  <Temperature2>${t2}</Temperature2>`);
  lines.push(`  <Temperature3>${t3}</Temperature3>`);
  for (let i = 4; i <= 9; i++) lines.push(`  <Temperature${i}>${NULL_TEMP}</Temperature${i}>`);
  lines.push(`</Temperature>`);

  // Pressure block: 9 slots, 0 = not set
  lines.push(`<Pressure>`);
  lines.push(`  <Pressure1>${p1}</Pressure1>`);
  lines.push(`  <Pressure2>${p2}</Pressure2>`);
  lines.push(`  <Pressure3>${p3}</Pressure3>`);
  for (let i = 4; i <= 9; i++) lines.push(`  <Pressure${i}>0</Pressure${i}>`);
  lines.push(`</Pressure>`);

  lines.push(`<MaterialNumber>0</MaterialNumber>`);
  lines.push(`<InsulationDensity>0</InsulationDensity>`);
  lines.push(`<FluidDensity>0</FluidDensity>`);

  let nodeCount = 0;
  for (const rec of records) {
    rec.xmlNodeNum = startNum + nodeCount * 10;
    const nodeXml = buildNodeBlocks(rec, rec.xmlNodeNum, config);
    lines.push(...nodeXml.lines);
    nodeCount += nodeXml.count;
  }

  lines.push(`</Branch>`);
  return { lines, nodeCount };
}

// ─── Node block dispatcher ───────────────────────────────────────

function buildNodeBlocks(rec, nodeNum, config) {
  const type = rec.componentType;

  if (isSupportType(type)) {
    return { lines: buildSupportNode(rec, nodeNum, config), count: 1 };
  }
  if (isBoundaryType(type)) {
    return { lines: buildBoundaryNodePair(rec, nodeNum, config), count: 2 };
  }
  return { lines: buildRigidNode(rec, nodeNum, config), count: 1 };
}

// ─── Node builders ───────────────────────────────────────────────

function buildSupportNode(rec, nodeNum, config) {
  const res = rec.resolved || {};
  const r = res.restraint || {};
  const pos = bestPosition(rec.attrs);

  const lines = [`<Node>`];
  lines.push(`  <NodeNumber>${nodeNum}</NodeNumber>`);
  lines.push(`  <NodeName>${esc(rec.supportTag || rec.name)}</NodeName>`);
  lines.push(`  <Endpoint>1</Endpoint>`);
  lines.push(`  <Rigid>0</Rigid>`);
  lines.push(`  <ComponentType>ATTA</ComponentType>`);
  lines.push(`  <Weight>0</Weight>`);
  lines.push(`  <ComponentRefNo>${esc(rec.ref || rec.name)}</ComponentRefNo>`);
  lines.push(`  <ConnectionType>${esc(res.connectionType || 'SUPPORT')}</ConnectionType>`);
  lines.push(`  <OutsideDiameter>${res.odMm || 0}</OutsideDiameter>`);
  lines.push(`  <WallThickness>${res.wallMm || 0}</WallThickness>`);
  lines.push(`  <CorrosionAllowance>${res.corrMm ?? 0}</CorrosionAllowance>`);
  lines.push(`  <InsulationThickness>${rec.insuMm ?? 0}</InsulationThickness>`);
  if (pos) lines.push(`  <Position>${formatPosition(pos)}</Position>`);
  lines.push(`  <BendRadius>0</BendRadius>`);
  lines.push(`  <SIF>0</SIF>`);

  // <Restraint> block — core fix for ATTA support nodes
  const restraints = Array.isArray(res.restraint) ? res.restraint : (res.restraint ? [res.restraint] : []);
  for (const rest of restraints) {
    if (rest && (rest.type || rest.kind)) {
      lines.push(`  ${formatRestraintXml(rest).split('\n').join('\n  ')}`);
    }
  }

  // DTXR_PS for downstream enrichment pass
  const dtxrPs = rec.cmpStressN || rec.supportTag || rec.dtxr;
  if (dtxrPs) lines.push(`  <DTXR_PS>${esc(dtxrPs)}</DTXR_PS>`);
  if (dtxrPs) lines.push(`  <DTXR_SOURCE>staged-json-ps-fallback</DTXR_SOURCE>`);

  lines.push(`</Node>`);
  return lines;
}

function buildBoundaryNodePair(rec, nodeNum, config) {
  const res = rec.resolved || {};
  const attrs = rec.attrs;
  const posA = arrivePosition(attrs);
  const posL = leavePosition(attrs);
  const rigid = rigidValue(rec.componentType);

  const lines = [];

  // Start node (Endpoint 1)
  lines.push(`<Node>`);
  lines.push(`  <NodeNumber>${nodeNum}</NodeNumber>`);
  lines.push(`  <NodeName>${esc(rec.name)}</NodeName>`);
  lines.push(`  <Endpoint>1</Endpoint>`);
  lines.push(`  <Rigid>${rigid}</Rigid>`);
  lines.push(`  <ComponentType>${esc(rec.componentType)}</ComponentType>`);
  lines.push(`  <Weight>0</Weight>`);
  lines.push(`  <ComponentRefNo>${esc(rec.ref || rec.name)}</ComponentRefNo>`);
  lines.push(`  <ConnectionType>${esc(rec.connectionType || '')}</ConnectionType>`);
  lines.push(...buildMandatoryDims(rec, res));
  if (posA) lines.push(`  <Position>${formatPosition(posA)}</Position>`);
  lines.push(`  <BendRadius>0</BendRadius>`);
  if (rec.anglDeg) lines.push(`  <AlphaAngle>${rec.anglDeg}</AlphaAngle>`);
  lines.push(`  <SIF>0</SIF>`);
  if (rec.dtxr) lines.push(`  <DTXR_POS>${esc(rec.dtxr)}</DTXR_POS>`);
  if (rec.dtxr) lines.push(`  <DTXR_SOURCE>staged-json-position-group</DTXR_SOURCE>`);
  lines.push(`</Node>`);

  // End node (Endpoint 2)
  lines.push(`<Node>`);
  lines.push(`  <NodeNumber>${nodeNum + 10}</NodeNumber>`);
  lines.push(`  <NodeName></NodeName>`);
  lines.push(`  <Endpoint>2</Endpoint>`);
  lines.push(`  <Rigid>${rigid}</Rigid>`);
  lines.push(`  <ComponentType>${esc(rec.componentType)}</ComponentType>`);
  lines.push(`  <Weight>0</Weight>`);
  lines.push(`  <ComponentRefNo>${esc(rec.ref || rec.name)}</ComponentRefNo>`);
  lines.push(`  <ConnectionType></ConnectionType>`);
  lines.push(...buildMandatoryDims(rec, res));
  if (posL) lines.push(`  <Position>${formatPosition(posL)}</Position>`);
  lines.push(`  <BendRadius>0</BendRadius>`);
  lines.push(`  <SIF>0</SIF>`);
  if (rec.dtxr) lines.push(`  <DTXR_POS>${esc(rec.dtxr)}</DTXR_POS>`);
  lines.push(`</Node>`);

  return lines;
}

function buildRigidNode(rec, nodeNum, config) {
  const res = rec.resolved || {};
  const pos = bestPosition(rec.attrs);
  const w = res.weightKg ?? rec.sourceWeightKg ?? 0;

  const lines = [`<Node>`];
  lines.push(`  <NodeNumber>${nodeNum}</NodeNumber>`);
  lines.push(`  <NodeName>${esc(rec.name)}</NodeName>`);
  lines.push(`  <Endpoint>1</Endpoint>`);
  lines.push(`  <Rigid>${rigidValue(rec.componentType)}</Rigid>`);
  lines.push(`  <ComponentType>${esc(rec.componentType)}</ComponentType>`);
  lines.push(`  <Weight>${Number(w).toFixed(2)}</Weight>`);
  lines.push(`  <ComponentRefNo>${esc(rec.ref || rec.name)}</ComponentRefNo>`);
  lines.push(`  <ConnectionType></ConnectionType>`);
  lines.push(...buildMandatoryDims(rec, res));
  if (pos) lines.push(`  <Position>${formatPosition(pos)}</Position>`);
  lines.push(`  <BendRadius>0</BendRadius>`);
  lines.push(`  <SIF>0</SIF>`);
  if (rec.dtxr) lines.push(`  <DTXR_POS>${esc(rec.dtxr)}</DTXR_POS>`);
  if (rec.dtxr) lines.push(`  <DTXR_SOURCE>staged-json-position-group</DTXR_SOURCE>`);
  lines.push(`</Node>`);
  return lines;
}

// ─── Shared helpers ──────────────────────────────────────────────

/** Emit mandatory dimension tags (always present, 0 if unknown). */
function buildMandatoryDims(rec, res) {
  return [
    `  <OutsideDiameter>${res.odMm || 0}</OutsideDiameter>`,
    `  <WallThickness>${res.wallMm || 0}</WallThickness>`,
    `  <CorrosionAllowance>${res.corrMm ?? 0}</CorrosionAllowance>`,
    `  <InsulationThickness>${rec.insuMm ?? 0}</InsulationThickness>`,
  ];
}

function esc(v) {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
