import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PIPELINE_GRE_CAESAR_FIELD_SOURCE_MATRIX_SCHEMA =
  'PipelineGreCaesarFieldSourceMatrix.v1';

const CASES = Object.freeze(['F1', 'F2', 'F3', 'F4', 'F5']);
const COMMON_FIELDS = Object.freeze([
  'caesarVersion', 'caesarBuild', 'xmlVersion', 'unitFileId', 'unitFileSha256',
  'laminateClassification',
]);
const COMMIT_SHA = /^[a-f0-9]{40}$/;
const MAX_XML_BYTES = 5 * 1024 * 1024;
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const text = (value) => typeof value === 'string' ? value.trim() : '';
const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort(compare)
    .map((key) => [key, stableValue(value[key])]));
}

const canonicalJson = (value) => JSON.stringify(stableValue(value));

async function readRegularFile(target, maxBytes = Number.POSITIVE_INFINITY) {
  const stat = await fs.lstat(target);
  if (!stat.isFile() || stat.isSymbolicLink()) throw new Error('FILE_NOT_REGULAR');
  if (stat.size === 0) throw new Error('FILE_EMPTY');
  if (stat.size > maxBytes) throw new Error('FILE_TOO_LARGE');
  return fs.readFile(target, 'utf8');
}

async function readJson(target) {
  return JSON.parse(await readRegularFile(target));
}

function parseAttributes(raw) {
  const result = Object.create(null);
  const pattern = /([A-Za-z_][A-Za-z0-9_.:-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g;
  let cursor = 0, match;
  while ((match = pattern.exec(raw))) {
    if (raw.slice(cursor, match.index).trim()) throw new Error('ATTRIBUTE_SYNTAX_INVALID');
    const key = match[1].toUpperCase();
    if (Object.hasOwn(result, key)) throw new Error('ATTRIBUTE_DUPLICATE');
    result[key] = match[2] ?? match[3] ?? '';
    cursor = pattern.lastIndex;
  }
  if (raw.slice(cursor).trim()) throw new Error('ATTRIBUTE_SYNTAX_INVALID');
  return result;
}

function extractBlocks(xml, tagName) {
  const opening = new RegExp(`<${tagName}\\b`, 'gi');
  const pattern = new RegExp(
    `<${tagName}\\b([^>]*?)(?:\\/\\s*>|>([\\s\\S]*?)<\\/${tagName}\\s*>)`, 'gi');
  const expected = [...xml.matchAll(opening)].length;
  const blocks = [...xml.matchAll(pattern)].map((match) => ({
    attributes: parseAttributes(match[1]), body: match[2] || '',
  }));
  if (expected !== blocks.length) throw new Error(`${tagName}_STRUCTURE_INVALID`);
  return blocks;
}

function parseXml(xml) {
  if (/<!DOCTYPE\b|<!ENTITY\b/i.test(xml)) throw new Error('XML_DTD_PROHIBITED');
  if ([...xml.matchAll(/<PIPINGMODEL\b/gi)].length !== 1) throw new Error('PIPINGMODEL_COUNT_INVALID');
  const elements = extractBlocks(xml, 'PIPINGELEMENT').map((block, index) => {
    const bends = extractBlocks(block.body, 'BEND');
    if (bends.length > 1) throw new Error('ELEMENT_BEND_COUNT_INVALID');
    const id = text(block.attributes.ID);
    if (!id) throw new Error('ELEMENT_ID_REQUIRED');
    return { index, id, attributes: block.attributes, bend: bends[0]?.attributes || null };
  });
  if (!elements.length) throw new Error('PIPINGELEMENT_REQUIRED');
  const ids = new Set();
  for (const element of elements) {
    if (ids.has(element.id)) throw new Error('ELEMENT_ID_DUPLICATE');
    ids.add(element.id);
  }
  if (elements.filter((item) => item.bend).length !== 1) throw new Error('BEND_OWNER_COUNT_INVALID');
  return { elements, byId: Object.fromEntries(elements.map((item) => [item.id, item])) };
}

function endpoint(element, field, diagnostics) {
  const value = numeric(element?.attributes?.[field]);
  if (!Number.isSafeInteger(value) || value <= 0) diagnostics.push(`ELEMENT_ENDPOINT_INVALID:${element?.id || ''}:${field}`);
  return value;
}

function bindPresence(attrs, record, prefix, xmlName, diagnostics) {
  const present = record[`${prefix}AttributePresent`], actual = attrs?.[xmlName];
  if (typeof present !== 'boolean') return diagnostics.push(`MANIFEST_ATTRIBUTE_PRESENCE_INVALID:${xmlName}`);
  if (present && actual === undefined) diagnostics.push(`BEND_ATTRIBUTE_MISSING:${xmlName}`);
  if (!present && actual !== undefined) diagnostics.push(`BEND_ATTRIBUTE_UNEXPECTED:${xmlName}`);
  if (!present || actual === undefined) return;
  if (Number(actual) !== record[`${prefix}Value`]) diagnostics.push(`BEND_ATTRIBUTE_VALUE_MISMATCH:${xmlName}`);
  const lexical = text(record[`${prefix}LexicalValue`]);
  if (lexical && actual !== lexical) diagnostics.push(`BEND_ATTRIBUTE_LEXICAL_MISMATCH:${xmlName}`);
}

function bindCurvature(attrs, record, diagnostics) {
  const nodes = Array.isArray(record.curvatureNodes) ? record.curvatureNodes : [];
  if (nodes.length > 3) diagnostics.push('CURVATURE_NODE_COUNT_UNSUPPORTED');
  for (let index = 0; index < 3; index += 1) {
    const slot = index + 1, item = nodes[index];
    const angle = attrs?.[`ANGLE${slot}`], node = attrs?.[`NODE${slot}`];
    if (!item) {
      if (angle !== undefined || node !== undefined) diagnostics.push(`CURVATURE_NODE_UNEXPECTED:${slot}`);
      continue;
    }
    if (angle === undefined || node === undefined) diagnostics.push(`CURVATURE_NODE_MISSING:${slot}`);
    if (Number(angle) !== item.angle) diagnostics.push(`CURVATURE_ANGLE_MISMATCH:${slot}`);
    if (Number(node) !== item.node) diagnostics.push(`CURVATURE_NODE_MISMATCH:${slot}`);
  }
}

function bindBend(record, bend, diagnostics) {
  if (!bend) return diagnostics.push('BEND_OWNER_XML_MISSING');
  if (Number(bend.RADIUS) !== record.radius) diagnostics.push('BEND_RADIUS_MISMATCH');
  bindPresence(bend, record, 'type', 'TYPE', diagnostics);
  bindPresence(bend, record, 'numMiter', 'NUM_MITER', diagnostics);
  bindPresence(bend, record, 'fittingThickness', 'FITTINGTHICKNESS', diagnostics);
  bindCurvature(bend, record, diagnostics);
}

function turnAngle(owner, leaving, diagnostics) {
  const vector = (element) => ['DELTA_X', 'DELTA_Y', 'DELTA_Z']
    .map((field) => numeric(element?.attributes?.[field]));
  const left = vector(owner), right = vector(leaving);
  if (![...left, ...right].every(Number.isFinite)) {
    diagnostics.push('ELEMENT_VECTOR_INVALID'); return null;
  }
  const leftNorm = Math.hypot(...left), rightNorm = Math.hypot(...right);
  if (!(leftNorm > 0) || !(rightNorm > 0)) {
    diagnostics.push('ELEMENT_VECTOR_ZERO'); return null;
  }
  const dot = left.reduce((sum, value, index) => sum + value * right[index], 0);
  const cosine = Math.max(-1, Math.min(1, dot / (leftNorm * rightNorm)));
  return Math.acos(cosine) * 180 / Math.PI;
}

function inactiveCornerSerialized(parsed, node) {
  return parsed.elements.some((element) => ['FROM_NODE', 'TO_NODE']
    .some((field) => numeric(element.attributes[field]) === node));
}

function attributesWithout(attrs, excluded) {
  return Object.fromEntries(Object.entries(attrs || {})
    .filter(([key]) => !excluded(key)).sort(([a], [b]) => compare(a, b)));
}

function bindCase(caseId, manifest, parsed, xml, expectedSha, diagnostics) {
  if (manifest.fixtureCaseId !== caseId) diagnostics.push('FIXTURE_CASE_ID_MISMATCH');
  if (manifest.fixturePath !== `${caseId}/original-export.xml`) diagnostics.push('FIXTURE_PATH_MISMATCH');
  if (manifest.sourceCommitSha !== expectedSha) diagnostics.push('SOURCE_COMMIT_MISMATCH');
  if (manifest.fixtureSha256 !== sha256(Buffer.from(xml, 'utf8'))) diagnostics.push('FIXTURE_SHA256_MISMATCH');
  const bends = Array.isArray(manifest.bendRecords) ? manifest.bendRecords : [];
  const continuity = Array.isArray(manifest.continuityRecords) ? manifest.continuityRecords : [];
  if (bends.length !== 1) diagnostics.push('MANIFEST_BEND_RECORD_COUNT_INVALID');
  if (continuity.length !== 1) diagnostics.push('MANIFEST_CONTINUITY_RECORD_COUNT_INVALID');
  const bendRecord = bends[0] || {}, record = continuity[0] || {};
  const owner = parsed.byId[bendRecord.ownerElementId], leaving = parsed.byId[record.leavingElementId];
  const xmlOwner = parsed.elements.find((item) => item.bend);
  if (!owner || xmlOwner?.id !== bendRecord.ownerElementId) diagnostics.push('XML_BEND_OWNER_MISMATCH');
  if (!leaving) diagnostics.push('MANIFEST_LEAVING_ELEMENT_NOT_FOUND');
  const ownerFrom = endpoint(owner, 'FROM_NODE', diagnostics), ownerTo = endpoint(owner, 'TO_NODE', diagnostics);
  const leavingFrom = endpoint(leaving, 'FROM_NODE', diagnostics), leavingTo = endpoint(leaving, 'TO_NODE', diagnostics);
  const expected = [bendRecord.ownerFromNode, bendRecord.ownerToNode, record.enteringFromNode,
    record.enteringToNode, record.leavingFromNode, record.leavingToNode];
  const actual = [ownerFrom, ownerTo, ownerFrom, ownerTo, leavingFrom, leavingTo];
  if (!actual.every((value, index) => value === expected[index])) diagnostics.push('MANIFEST_ENDPOINT_BINDING_MISMATCH');
  if (record.enteringElementId !== bendRecord.ownerElementId
    || record.bendOwnerElementId !== bendRecord.ownerElementId) diagnostics.push('MANIFEST_BEND_OWNERSHIP_CONFLICT');
  if (record.sharedLogicalNode === true && ownerTo !== leavingFrom) diagnostics.push('SHARED_NODE_TOPOLOGY_INVALID');
  if (record.sharedLogicalNode === false && ownerTo === leavingFrom) diagnostics.push('SEPARATED_TOPOLOGY_INVALID');
  if (inactiveCornerSerialized(parsed, record.inactiveCornerNode)) diagnostics.push('INACTIVE_CORNER_SERIALIZED');
  bindBend(bendRecord, owner?.bend, diagnostics);
  const bend = owner?.bend || {}, curvature = Array.isArray(bendRecord.curvatureNodes) ? bendRecord.curvatureNodes : [];
  return { turnAngleDeg: turnAngle(owner, leaving, diagnostics), curvature,
    elementProfile: parsed.elements.map((item) => ({ id: item.id, attributes: item.attributes })),
    topologyMode: text(record.observedTopologyMode), bendAttributes: bend,
    bendWithoutCurvature: attributesWithout(bend, (key) => /^(?:ANGLE|NODE)\d+$/.test(key)),
    bendWithoutThickness: attributesWithout(bend, (key) => key === 'FITTINGTHICKNESS'),
    fittingThickness: numeric(bend.FITTINGTHICKNESS),
    pipeWallThickness: numeric(owner?.attributes?.WALL_THICK ?? owner?.attributes?.WALL_THICKNESS),
    session: Object.fromEntries(COMMON_FIELDS.map((field) => [field, manifest[field] ?? ''])),
    code: { id: text(manifest.pipingCodeId), name: text(manifest.pipingCodeName),
      edition: text(manifest.pipingCodeEdition) } };
}

async function verifyCase(root, caseId, expectedSha) {
  const diagnostics = [];
  let state = null;
  try {
    const directory = path.join(root, caseId);
    const manifest = await readJson(path.join(directory, 'manifest.json'));
    const xml = await readRegularFile(path.join(directory, 'original-export.xml'), MAX_XML_BYTES);
    state = bindCase(caseId, manifest, parseXml(xml), xml, expectedSha, diagnostics);
  } catch (error) {
    diagnostics.push(`FIELD_MATRIX_INPUT_INVALID:${error?.message || 'UNKNOWN'}`);
  }
  const unique = [...new Set(diagnostics)].sort(compare);
  return { caseId, status: unique.length ? 'REJECTED_WITH_REASON' : 'ADMITTED', diagnostics: unique, state };
}

const close = (left, right, tolerance = 1e-7) => Number.isFinite(left) && Number.isFinite(right)
  && Math.abs(left - right) <= tolerance;

function controls(cases) {
  const diagnostics = [], byId = Object.fromEntries(cases.map((item) => [item.caseId, item]));
  if (cases.some((item) => item.status !== 'ADMITTED')) diagnostics.push('SOURCE_CASE_NOT_ADMITTED');
  const state = (id) => byId[id]?.state || {};
  for (const field of COMMON_FIELDS) {
    const values = CASES.map((id) => state(id).session?.[field]);
    if (new Set(values).size !== 1 || !text(values[0])) diagnostics.push(`COMMON_SESSION_CONFLICT:${field}`);
  }
  const f1 = state('F1'), f2 = state('F2'), f3 = state('F3'), f4 = state('F4'), f5 = state('F5');
  if (!/ISO\s*14692/i.test(f1.code?.name) || f1.code?.name !== f2.code?.name
    || !/2005/.test(f1.code?.edition) || !/2017/.test(f2.code?.edition)) diagnostics.push('ISO_EDITION_CONTROL_INVALID');
  if (canonicalJson(f1.elementProfile) !== canonicalJson(f2.elementProfile)) diagnostics.push('F1_F2_ELEMENT_PROFILE_MISMATCH');
  if (canonicalJson(f1.bendAttributes) !== canonicalJson(f2.bendAttributes)) diagnostics.push('F1_F2_BEND_PROFILE_MISMATCH');
  if (!close(f1.turnAngleDeg, 90) || !close(f2.turnAngleDeg, 90)) diagnostics.push('F1_F2_ANGLE_CONTROL_INVALID');
  if (f1.curvature?.length || f2.curvature?.length) diagnostics.push('F1_F2_CURVATURE_UNEXPECTED');
  if (canonicalJson(f3.code) !== canonicalJson(f4.code) || canonicalJson(f3.code) !== canonicalJson(f5.code)
    || !text(f3.code?.id) || !text(f3.code?.edition)) diagnostics.push('PROJECT_CODE_CONTROL_INVALID');
  if (canonicalJson(f3.elementProfile) !== canonicalJson(f4.elementProfile)
    || canonicalJson(f3.elementProfile) !== canonicalJson(f5.elementProfile)) diagnostics.push('F3_F5_ELEMENT_PROFILE_MISMATCH');
  if (!Number.isFinite(f3.turnAngleDeg) || close(f3.turnAngleDeg, 90)
    || !close(f3.turnAngleDeg, f4.turnAngleDeg) || !close(f3.turnAngleDeg, f5.turnAngleDeg)) {
    diagnostics.push('PROJECT_ANGLE_CONTROL_INVALID');
  }
  if (f3.curvature?.length || f5.curvature?.length) diagnostics.push('F3_F5_CURVATURE_UNEXPECTED');
  const midpoint = f4.curvature?.[0];
  if (f4.curvature?.length !== 1 || midpoint?.role !== 'USER_MIDPOINT'
    || !(midpoint?.angle > 0 && midpoint.angle < f4.turnAngleDeg)) diagnostics.push('F4_USER_MIDPOINT_INVALID');
  if (canonicalJson(f3.bendWithoutCurvature) !== canonicalJson(f4.bendWithoutCurvature)) {
    diagnostics.push('F3_F4_NON_TARGET_BEND_MISMATCH');
  }
  if (canonicalJson(f3.bendWithoutThickness) !== canonicalJson(f5.bendWithoutThickness)) {
    diagnostics.push('F3_F5_NON_TARGET_BEND_MISMATCH');
  }
  if (!Number.isFinite(f5.fittingThickness) || !Number.isFinite(f5.pipeWallThickness)
    || f5.fittingThickness === f5.pipeWallThickness || f5.fittingThickness === f3.fittingThickness) {
    diagnostics.push('F5_FITTING_THICKNESS_CONTROL_INVALID');
  }
  return [...new Set(diagnostics)].sort(compare);
}

export async function verifyPipelineGreCaesarFieldSourceMatrix(root, expectedSourceCommitSha = '') {
  const diagnostics = [];
  if (!COMMIT_SHA.test(expectedSourceCommitSha)) diagnostics.push('EXPECTED_SOURCE_COMMIT_INVALID');
  const cases = [];
  for (const caseId of CASES) cases.push(await verifyCase(root, caseId, expectedSourceCommitSha));
  diagnostics.push(...controls(cases));
  const outputCases = cases.map((item) => ({ caseId: item.caseId, status: item.status,
    diagnostics: item.diagnostics, turnAngleDeg: item.state?.turnAngleDeg ?? null,
    topologyMode: item.state?.topologyMode || '', curvatureRoles: (item.state?.curvature || []).map((node) => node.role),
    fittingThickness: item.state?.fittingThickness ?? null, pipeWallThickness: item.state?.pipeWallThickness ?? null,
    code: item.state?.code || null }));
  const unique = [...new Set(diagnostics)].sort(compare);
  return { schema: PIPELINE_GRE_CAESAR_FIELD_SOURCE_MATRIX_SCHEMA, packageRoot: '.',
    expectedSourceCommitSha, cases: outputCases, diagnostics: unique,
    ready: unique.length === 0 && outputCases.every((item) => item.status === 'ADMITTED') };
}

async function main() {
  const [, , command, root, sourceSha, reportPath] = process.argv;
  if (command !== 'verify' || !root || !sourceSha) {
    throw new Error('Usage: node pipeline-gre-caesar-field-source-matrix.mjs verify <package-root> <source-sha> [report.json]');
  }
  const report = await verifyPipelineGreCaesarFieldSourceMatrix(root, sourceSha);
  const output = `${JSON.stringify(report, null, 2)}\n`;
  if (reportPath) await fs.writeFile(reportPath, output, 'utf8');
  else process.stdout.write(output);
  if (!report.ready) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  main().catch((error) => { console.error(error.message); process.exitCode = 1; });
}
