import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const PIPELINE_GRE_CAESAR_TOPOLOGY_SOURCE_PAIR_SCHEMA =
  'PipelineGreCaesarTopologySourcePair.v1';

const COMMIT_SHA = /^[a-f0-9]{40}$/;
const MAX_XML_BYTES = 5 * 1024 * 1024;
const PAIR_CASES = Object.freeze(['F6', 'F7']);
const SESSION_FIELDS = Object.freeze([
  'caesarVersion', 'caesarBuild', 'xmlVersion', 'unitFileId', 'unitFileSha256',
  'pipingCodeId', 'pipingCodeName', 'pipingCodeEdition', 'laminateClassification',
]);
const NODE_BEND_ATTRIBUTE = /^(?:ANGLE|NODE)\d+$|^(?:NODE|NEAR_NODE|FAR_NODE)$/;
const compare = (left, right) => left < right ? -1 : left > right ? 1 : 0;
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.keys(value).sort(compare)
    .map((key) => [key, stableValue(value[key])]));
}

const canonicalJson = (value) => JSON.stringify(stableValue(value));
const numeric = (value) => Number.isFinite(Number(value)) ? Number(value) : null;
const text = (value) => typeof value === 'string' ? value.trim() : '';

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

async function writeJson(target, value) {
  await fs.writeFile(target, `${JSON.stringify(value, null, 2)}\n`, 'utf8');
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
    attributes: parseAttributes(match[1]), body: match[2] || '', source: match[0],
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

function pushMismatch(diagnostics, code, actual, expected) {
  if (actual !== expected) diagnostics.push(`${code}:${actual ?? ''}:${expected ?? ''}`);
}

function endpoint(element, field, diagnostics) {
  const value = numeric(element?.attributes?.[field]);
  if (!Number.isSafeInteger(value) || value <= 0) diagnostics.push(`ELEMENT_ENDPOINT_INVALID:${element?.id || ''}:${field}`);
  return value;
}

function bindPresence(attrs, record, prefix, xmlName, diagnostics) {
  const presentField = `${prefix}AttributePresent`, valueField = `${prefix}Value`;
  const lexicalField = `${prefix}LexicalValue`, present = record[presentField];
  if (typeof present !== 'boolean') return;
  const actual = attrs[xmlName];
  if (present && actual === undefined) diagnostics.push(`BEND_ATTRIBUTE_MISSING:${xmlName}`);
  if (!present && actual !== undefined) diagnostics.push(`BEND_ATTRIBUTE_UNEXPECTED:${xmlName}`);
  if (!present || actual === undefined) return;
  if (Number(actual) !== record[valueField]) diagnostics.push(`BEND_ATTRIBUTE_VALUE_MISMATCH:${xmlName}`);
  if (text(record[lexicalField]) && actual !== record[lexicalField]) {
    diagnostics.push(`BEND_ATTRIBUTE_LEXICAL_MISMATCH:${xmlName}`);
  }
}

function bindCurvatureNodes(attrs, record, diagnostics) {
  const nodes = Array.isArray(record.curvatureNodes) ? record.curvatureNodes : [];
  if (nodes.length > 3) diagnostics.push('CURVATURE_NODE_COUNT_UNSUPPORTED');
  for (let index = 0; index < 3; index += 1) {
    const slot = index + 1, angleKey = `ANGLE${slot}`, nodeKey = `NODE${slot}`, item = nodes[index];
    if (!item) {
      if (attrs[angleKey] !== undefined || attrs[nodeKey] !== undefined) diagnostics.push(`CURVATURE_NODE_UNEXPECTED:${slot}`);
      continue;
    }
    if (attrs[angleKey] === undefined || attrs[nodeKey] === undefined) diagnostics.push(`CURVATURE_NODE_MISSING:${slot}`);
    if (Number(attrs[angleKey]) !== item.angle) diagnostics.push(`CURVATURE_ANGLE_MISMATCH:${slot}`);
    if (Number(attrs[nodeKey]) !== item.node) diagnostics.push(`CURVATURE_NODE_MISMATCH:${slot}`);
  }
  for (const key of Object.keys(attrs)) {
    const match = /^(?:ANGLE|NODE)(\d+)$/.exec(key);
    if (match && Number(match[1]) > 3) diagnostics.push(`CURVATURE_SLOT_UNSUPPORTED:${match[1]}`);
  }
}

function bindBend(record, bend, diagnostics) {
  if (!bend) return diagnostics.push('BEND_OWNER_XML_MISSING');
  if (Number(bend.RADIUS) !== record.radius) diagnostics.push('BEND_RADIUS_MISMATCH');
  bindPresence(bend, record, 'type', 'TYPE', diagnostics);
  bindPresence(bend, record, 'numMiter', 'NUM_MITER', diagnostics);
  bindPresence(bend, record, 'fittingThickness', 'FITTINGTHICKNESS', diagnostics);
  bindCurvatureNodes(bend, record, diagnostics);
}

function nonTopologyBendAttributes(attrs) {
  return Object.fromEntries(Object.entries(attrs || {})
    .filter(([key]) => !NODE_BEND_ATTRIBUTE.test(key)).sort(([a], [b]) => compare(a, b)));
}

function inactiveCornerSerialized(parsed, node) {
  return parsed.elements.some((element) => ['FROM_NODE', 'TO_NODE']
    .some((field) => numeric(element.attributes[field]) === node));
}

function bindCommon(caseId, manifest, parsed, diagnostics) {
  const bends = Array.isArray(manifest.bendRecords) ? manifest.bendRecords : [];
  const continuity = Array.isArray(manifest.continuityRecords) ? manifest.continuityRecords : [];
  if (bends.length !== 1) diagnostics.push('MANIFEST_BEND_RECORD_COUNT_INVALID');
  if (continuity.length !== 1) diagnostics.push('MANIFEST_CONTINUITY_RECORD_COUNT_INVALID');
  const bendRecord = bends[0] || {}, record = continuity[0] || {};
  const owner = parsed.byId[bendRecord.ownerElementId], leaving = parsed.byId[record.leavingElementId];
  const xmlOwner = parsed.elements.find((item) => item.bend);
  if (!owner) diagnostics.push('MANIFEST_BEND_OWNER_NOT_FOUND');
  if (!leaving) diagnostics.push('MANIFEST_LEAVING_ELEMENT_NOT_FOUND');
  if (xmlOwner?.id !== bendRecord.ownerElementId) diagnostics.push('XML_BEND_OWNER_MISMATCH');
  if (record.enteringElementId !== bendRecord.ownerElementId
    || record.bendOwnerElementId !== bendRecord.ownerElementId) diagnostics.push('MANIFEST_BEND_OWNERSHIP_CONFLICT');
  const ownerFrom = endpoint(owner, 'FROM_NODE', diagnostics), ownerTo = endpoint(owner, 'TO_NODE', diagnostics);
  const leavingFrom = endpoint(leaving, 'FROM_NODE', diagnostics), leavingTo = endpoint(leaving, 'TO_NODE', diagnostics);
  pushMismatch(diagnostics, 'OWNER_FROM_NODE_MISMATCH', ownerFrom, bendRecord.ownerFromNode);
  pushMismatch(diagnostics, 'OWNER_TO_NODE_MISMATCH', ownerTo, bendRecord.ownerToNode);
  pushMismatch(diagnostics, 'ENTERING_FROM_NODE_MISMATCH', ownerFrom, record.enteringFromNode);
  pushMismatch(diagnostics, 'ENTERING_TO_NODE_MISMATCH', ownerTo, record.enteringToNode);
  pushMismatch(diagnostics, 'LEAVING_FROM_NODE_MISMATCH', leavingFrom, record.leavingFromNode);
  pushMismatch(diagnostics, 'LEAVING_TO_NODE_MISMATCH', leavingTo, record.leavingToNode);
  bindBend(bendRecord, owner?.bend, diagnostics);
  if (inactiveCornerSerialized(parsed, record.inactiveCornerNode)) diagnostics.push('INACTIVE_CORNER_SERIALIZED');
  return { caseId, bendRecord, record, owner, leaving, ownerTo, leavingFrom,
    bendAttributes: nonTopologyBendAttributes(owner?.bend) };
}

function bindF6(state, parsed, diagnostics) {
  const { record, ownerTo, leavingFrom } = state;
  if (record.observedTopologyMode !== 'TANGENCY_SEPARATED_BRIDGE' || record.sharedLogicalNode !== false) {
    diagnostics.push('F6_TOPOLOGY_MODE_INVALID');
  }
  if (ownerTo === leavingFrom || record.incomingTangencyNode !== ownerTo
    || record.outgoingTangencyNode !== leavingFrom) diagnostics.push('F6_TANGENCY_RELATION_INVALID');
  const bridge = parsed.elements.some((item) => {
    const from = numeric(item.attributes.FROM_NODE), to = numeric(item.attributes.TO_NODE);
    return (from === ownerTo && to === leavingFrom) || (from === leavingFrom && to === ownerTo);
  });
  if (bridge) diagnostics.push('F6_BRIDGE_ELEMENT_SERIALIZED');
}

function bindF7(state, diagnostics) {
  const { record, ownerTo, leavingFrom } = state;
  if (record.observedTopologyMode !== 'CONSECUTIVE_SHARED_LOGICAL_NODE' || record.sharedLogicalNode !== true) {
    diagnostics.push('F7_TOPOLOGY_MODE_INVALID');
  }
  if (ownerTo !== leavingFrom || record.incomingTangencyNode !== ownerTo
    || record.outgoingTangencyNode !== ownerTo) diagnostics.push('F7_SHARED_NODE_RELATION_INVALID');
}

async function verifyCase(root, caseId, expectedSourceCommitSha) {
  const diagnostics = [];
  let manifest = {}, parsed = null, state = null;
  try {
    const directory = path.join(root, caseId);
    manifest = await readJson(path.join(directory, 'manifest.json'));
    const xml = await readRegularFile(path.join(directory, 'original-export.xml'), MAX_XML_BYTES);
    if (manifest.fixtureCaseId !== caseId) diagnostics.push('FIXTURE_CASE_ID_MISMATCH');
    if (manifest.sourceCommitSha !== expectedSourceCommitSha) diagnostics.push('SOURCE_COMMIT_MISMATCH');
    parsed = parseXml(xml);
    state = bindCommon(caseId, manifest, parsed, diagnostics);
    if (caseId === 'F6') bindF6(state, parsed, diagnostics); else bindF7(state, diagnostics);
  } catch (error) {
    diagnostics.push(`SOURCE_PAIR_INPUT_INVALID:${error?.message || 'UNKNOWN'}`);
  }
  const unique = [...new Set(diagnostics)].sort(compare);
  const bendAttributes = state?.bendAttributes || {};
  return { caseId, status: unique.length ? 'REJECTED_WITH_REASON' : 'ADMITTED', diagnostics: unique,
    topology: state ? { ownerElementId: state.bendRecord.ownerElementId,
      leavingElementId: state.record.leavingElementId, ownerToNode: state.ownerTo,
      leavingFromNode: state.leavingFrom, mode: state.record.observedTopologyMode } : null,
    bendAttributes, bendFieldFingerprint: sha256(canonicalJson(bendAttributes)),
    session: Object.fromEntries(SESSION_FIELDS.map((field) => [field, manifest[field] ?? ''])) };
}

function pairDiagnostics(cases) {
  const diagnostics = [], [f6, f7] = cases;
  if (f6.status !== 'ADMITTED' || f7.status !== 'ADMITTED') diagnostics.push('SOURCE_CASE_NOT_ADMITTED');
  if (canonicalJson(f6.bendAttributes) !== canonicalJson(f7.bendAttributes)) {
    diagnostics.push('BEND_FIELD_PROFILE_MISMATCH');
  }
  for (const field of SESSION_FIELDS) if (f6.session[field] !== f7.session[field]) {
    diagnostics.push(`PAIR_SESSION_CONFLICT:${field}`);
  }
  return [...new Set(diagnostics)].sort(compare);
}

export async function verifyPipelineGreCaesarTopologySourcePair(root, expectedSourceCommitSha = '') {
  const diagnostics = [];
  if (!COMMIT_SHA.test(expectedSourceCommitSha)) diagnostics.push('EXPECTED_SOURCE_COMMIT_INVALID');
  const cases = [];
  for (const caseId of PAIR_CASES) cases.push(await verifyCase(root, caseId, expectedSourceCommitSha));
  diagnostics.push(...pairDiagnostics(cases));
  const outputCases = cases.map(({ session: ignored, bendAttributes: omitted, ...item }) => item);
  const unique = [...new Set(diagnostics)].sort(compare);
  return { schema: PIPELINE_GRE_CAESAR_TOPOLOGY_SOURCE_PAIR_SCHEMA, packageRoot: '.',
    sourceCommitSha: expectedSourceCommitSha, cases: outputCases,
    pairBendFieldFingerprint: cases[0]?.bendFieldFingerprint || '', diagnostics: unique,
    ready: unique.length === 0 && outputCases.every((item) => item.status === 'ADMITTED') };
}

async function runCli() {
  const [command, root = 'pipeline-gre-caesar-evidence', sourceSha = '', reportPath = ''] = process.argv.slice(2);
  if (command !== 'verify') throw new Error('Usage: verify <package-root> <source-sha> [report-path]');
  const report = await verifyPipelineGreCaesarTopologySourcePair(root, sourceSha);
  if (reportPath) await writeJson(reportPath, report);
  else process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (!report.ready) process.exitCode = 1;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) runCli().catch((error) => {
  process.stderr.write(`${error.message}\n`); process.exitCode = 1;
});
