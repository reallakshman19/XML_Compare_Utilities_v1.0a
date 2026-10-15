import { parse as parseCaesarFile } from '../../parser/caesar-parser.js';
import { applyCiiAuxiliaryCapabilities, buildCiiWorkspaceAuxiliaryEvidence } from './cii-workspace-auxiliary.js';
import { applyCiiHangerCapabilities, buildCiiHangerEvidence } from './cii-workspace-hanger.js';
import { buildCiiWorkspaceCapabilities, capabilityCount } from './cii-workspace-capabilities.js';
import { CII_WORKSPACE_SCHEMAS, deepFreeze } from './cii-workspace-contracts.js';
import { extractCiiNodeNameEvidence } from './cii-workspace-nodename.js';
import { ciiPhysicalFileBytes, createCiiPhysicalFile } from './cii-workspace-physical-file.js';
import { extractCiiWriter1CSifEvidence } from './cii-workspace-writer1c-sif-custody.js';

function parserAlias(fileName) {
  const name = String(fileName || 'model.cii').trim() || 'model.cii';
  return /\.cii$/i.test(name) ? name.replace(/\.cii$/i, '.accdb') : `${name}.accdb`;
}

function versionLabel(text) {
  const rows = String(text || '').split(/\r?\n/); const start = rows.findIndex((row) => /^\s*#\$\s*VERSION\s*$/i.test(row));
  if (start < 0) return '';
  for (let index = start + 1; index < rows.length; index += 1) {
    if (/^\s*#\$/.test(rows[index])) break;
    const value = rows[index].trim(); if (value) return value.slice(0, 120);
  }
  return '';
}

async function sha256Bytes(bytes, cryptoRef) {
  if (!cryptoRef?.subtle) throw new Error('CII_WORKSPACE_SHA256_UNAVAILABLE');
  const digest = await cryptoRef.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map((value) => value.toString(16).padStart(2, '0')).join('');
}

function capabilityStates(capabilities) {
  return Object.freeze(Object.fromEntries(
    Object.entries(capabilities?.families || {}).map(([family, capability]) => [family, capability.state]),
  ));
}

function parsedDetailCount(capability, key) {
  const count = capabilityCount(capability);
  return count === null ? null : Number(capability?.details?.[key] ?? count);
}

export async function intakeCiiWorkspaceDocument(rawInput, fileName, options = {}) {
  const physicalFile = createCiiPhysicalFile(rawInput); const sourceText = physicalFile.text;
  if (!sourceText.trim()) throw new Error('CII_WORKSPACE_EMPTY_INPUT');
  if (!/^#\$\s*(VERSION|CONTROL|ELEMENTS)/m.test(sourceText)) throw new Error('CII_WORKSPACE_NEUTRAL_CII_REQUIRED');
  const parsed = parseCaesarFile(sourceText, parserAlias(fileName));
  if (parsed.format !== 'NEUTRAL') throw new Error('CII_WORKSPACE_NEUTRAL_CII_REQUIRED');
  if (!parsed.elements?.length) throw new Error('CII_WORKSPACE_ELEMENTS_REQUIRED');
  if (parsed.errors?.length) throw new Error(`CII_WORKSPACE_PARSE_BLOCKED: ${parsed.errors[0].msg || parsed.errors[0]}`);
  const cryptoRef = options.cryptoRef ?? globalThis.crypto;
  const contentSha256 = await sha256Bytes(ciiPhysicalFileBytes(physicalFile), cryptoRef);
  const nodeNameEvidence = extractCiiNodeNameEvidence(sourceText, parsed, { physicalFile });
  const sifWriter1CEvidence = extractCiiWriter1CSifEvidence(sourceText, parsed, { physicalFile });
  const auxiliaryEvidence = buildCiiWorkspaceAuxiliaryEvidence(sourceText, parsed);
  const hangerEvidence = buildCiiHangerEvidence(sourceText, parsed);
  const baselineCapabilities = buildCiiWorkspaceCapabilities(sourceText, parsed, nodeNameEvidence);
  const auxiliaryCapabilities = applyCiiAuxiliaryCapabilities(baselineCapabilities, auxiliaryEvidence);
  const capabilities = applyCiiHangerCapabilities(auxiliaryCapabilities, hangerEvidence);
  const families = capabilities.families;
  return deepFreeze({
    schema: CII_WORKSPACE_SCHEMAS.document,
    side: options.side === 'TARGET' ? 'TARGET' : 'SOURCE',
    fileName: String(fileName || 'model.cii'), contentSha256,
    textLength: sourceText.length, byteLength: physicalFile.byteLength,
    byteAuthority: physicalFile.byteAuthority, writer1CByteEligible: physicalFile.writer1CByteEligible,
    textEncodingAuthority: physicalFile.textEncodingAuthority,
    physicalFile,
    format: parsed.format, parserAuthority: 'parser/caesar-parser.js + CII Workspace fixed-field auxiliary/hanger custody', parserAlias: parserAlias(fileName), parsed,
    nodeNames: nodeNameEvidence.names, nodeNameEvidence, sifWriter1CEvidence, auxiliaryEvidence, hangerEvidence, capabilities,
    summary: Object.freeze({
      version: versionLabel(sourceText),
      neutralVersionMajor: sifWriter1CEvidence.neutralVersion?.major ?? null,
      sifWriter1CCustodyStatus: sifWriter1CEvidence.status,
      sifWriter1CSemanticStatus: sifWriter1CEvidence.semanticStatus,
      elementCount: parsed.elements.length,
      nodeCount: capabilityCount(families.nodes),
      bendCount: parsed.bends?.length || 0,
      rigidRecordCount: capabilityCount(families.rigidMass),
      restraintNodeCount: parsedDetailCount(families.restraints, 'nodeCount'),
      restraintRecordCount: parsedDetailCount(families.restraints, 'rawRecordCount'),
      forceNodeCount: capabilityCount(families.forces),
      hangerCount: capabilityCount(families.hangers),
      sifTeeCount: capabilityCount(families.sifTee),
      weightRecordCount: capabilityCount(families.weightData),
      lineNumberCount: capabilityCount(families.lineNumbers),
      nodeNameCount: Object.keys(nodeNameEvidence.names).length,
      nodeNameConflictCount: nodeNameEvidence.conflicts.length,
      auxiliaryConflictCount: auxiliaryEvidence.conflicts.length,
      hangerConflictCount: hangerEvidence.conflicts.length,
      byteAuthority: physicalFile.byteAuthority,
      writer1CByteEligible: physicalFile.writer1CByteEligible,
      textEncodingAuthority: physicalFile.textEncodingAuthority,
      lineEndingStyle: physicalFile.lineEndings.style,
      pipeProperties: families.pipeProperties.details || null,
      process: families.process.details || null,
      capabilityStates: capabilityStates(capabilities),
    }),
  });
}
