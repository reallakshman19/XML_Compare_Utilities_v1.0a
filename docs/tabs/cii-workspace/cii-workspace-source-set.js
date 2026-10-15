import { ciiSha256, detectCiiNeutralVersion } from './cii-workspace-v11-v14-converter.js';

export const CII_SOURCE_SET_SCHEMA = 'CIIWorkspaceSourceSet.v1';
export const CII_SOURCE_SET_INSPECTION_SCHEMA = 'CIIWorkspaceSourceSetInspection.v1';
export const CII_SOURCE_SET_WP2_BLOCKER = 'MULTISOURCE_CORRESPONDENCE_REQUIRES_WP_002';

function value(input, key) {
  return input?.[`${key}Bytes`] ?? input?.[`${key}Text`];
}
function sourceValue(source) { return source?.bytes ?? source?.text; }
function sourceId(source, index) { return String(source?.sourceId || `S${index + 1}`).trim(); }
function sourceFileName(source, index) { return String(source?.fileName || `${sourceId(source, index)}.CII`).trim(); }
function sourceRows(input) {
  const rows = Array.isArray(input) ? input : input?.sources;
  if (!Array.isArray(rows) || rows.length < 2) throw new Error('CII_SOURCE_SET_TWO_OR_MORE_SOURCES_REQUIRED');
  const ids = rows.map(sourceId);
  if (ids.some((id) => !id)) throw new Error('CII_SOURCE_SET_SOURCE_ID_REQUIRED');
  if (new Set(ids).size !== ids.length) throw new Error('CII_SOURCE_SET_DUPLICATE_SOURCE_ID');
  return rows;
}
function authoritySha(member) {
  return String(member?.originalSha256 || member?.authoritySha256 || member?.contentSha256 || '').trim();
}
export function canonicalCiiSourceSetPreimage(members) {
  if (!Array.isArray(members) || !members.length) throw new Error('CII_SOURCE_SET_MEMBERS_REQUIRED');
  return members.map((member, index) => {
    const id = String(member?.sourceId || '').trim(); const sha = authoritySha(member);
    if (!id) throw new Error(`CII_SOURCE_SET_SOURCE_ID_REQUIRED:${index}`);
    if (!/^[0-9a-f]{64}$/i.test(sha)) throw new Error(`CII_SOURCE_SET_SHA256_REQUIRED:${id}`);
    return `${id}:${sha.toLowerCase()}\n`;
  }).join('');
}
export async function ciiSourceSetSha256(members, cryptoRef = globalThis.crypto) {
  return ciiSha256(canonicalCiiSourceSetPreimage(members), cryptoRef);
}
function frozenSourceSet(members, sourceSetSha256, mode) {
  return Object.freeze({
    schema: CII_SOURCE_SET_SCHEMA, status: 'CUSTODY_READY', authority: 'INDEPENDENT_SOURCE_MEMBERS', mode,
    memberCount: members.length, sourceSetSha256, members: Object.freeze(members),
  });
}
export async function intakeCiiWorkspaceSourceSet(input, options = {}) {
  const sources = sourceRows(input); const members = [];
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index]; const id = sourceId(source, index); const fileName = sourceFileName(source, index); const raw = sourceValue(source);
    if (raw == null) throw new Error(`CII_SOURCE_SET_SOURCE_BYTES_REQUIRED:${id}`);
    members.push(Object.freeze({
      sourceId: id, fileName,
      originalSha256: await ciiSha256(raw, options.cryptoRef), originalVersion: detectCiiNeutralVersion(raw),
      normalizedSha256: null, normalizedVersion: null, normalizationStatus: 'NOT_RUN',
    }));
  }
  return frozenSourceSet(members, await ciiSourceSetSha256(members, options.cryptoRef), 'RAW_MEMBER_CUSTODY');
}
function bridgeMember(source, index, inspection) {
  const side = inspection?.versionBridge?.source;
  if (!side?.originalSha256 || !side?.normalizedSha256) throw new Error(`CII_SOURCE_SET_BRIDGE_EVIDENCE_REQUIRED:${sourceId(source, index)}`);
  return Object.freeze({
    sourceId: sourceId(source, index), fileName: sourceFileName(source, index),
    originalVersion: side.originalVersion, normalizedVersion: side.normalizedVersion,
    originalSha256: side.originalSha256, normalizedSha256: side.normalizedSha256,
    normalizationStatus: 'PASS_BRIDGE_EVIDENCE', baselineCanonicalSha256: side.baselineCanonicalSha256,
    exactBaselineRoundTrip: side.exactBaselineRoundTrip, summary: inspection.source?.summary || null,
  });
}
function targetCustodyKey(inspection) {
  const target = inspection?.versionBridge?.target;
  return [target?.originalVersion, target?.originalSha256, target?.normalizedSha256, target?.baselineCanonicalSha256].join('|');
}
function assertSharedTargetCustody(inspections) {
  const keys = new Set(inspections.map(targetCustodyKey));
  if (keys.size !== 1 || [...keys][0].includes('undefined')) throw new Error('CII_SOURCE_SET_TARGET_CUSTODY_MISMATCH');
}
export async function inspectCiiWorkspaceSourceSetWithVersionBridge(input, options = {}) {
  const sources = sourceRows(input); const targetInput = value(input, 'target');
  if (targetInput == null) throw new Error('CII_SOURCE_SET_TARGET_REQUIRED');
  const targetFileName = String(input?.targetFileName || 'TARGET.CII');
  const { inspectCiiWorkspaceModelsWithVersionBridge } = await import('./cii-workspace-writer-version-bridge.js');
  const inspections = [];
  for (let index = 0; index < sources.length; index += 1) {
    const source = sources[index];
    inspections.push(await inspectCiiWorkspaceModelsWithVersionBridge({
      sourceBytes: source?.bytes, sourceText: source?.text, sourceFileName: sourceFileName(source, index),
      targetBytes: input?.targetBytes, targetText: input?.targetText, targetFileName,
    }, { ...options, writerVersion: '2' }));
  }
  assertSharedTargetCustody(inspections);
  const members = inspections.map((inspection, index) => bridgeMember(sources[index], index, inspection));
  const sourceSetSha256 = await ciiSourceSetSha256(members, options.cryptoRef);
  const sourceSet = frozenSourceSet(members, sourceSetSha256, 'V11_V14_BRIDGE_MEMBER_CUSTODY');
  const memberInspections = Object.freeze(inspections.map((inspection, index) => Object.freeze({
    sourceId: sourceId(sources[index], index), fileName: sourceFileName(sources[index], index), inspection,
  })));
  const first = inspections[0];
  return Object.freeze({
    schema: CII_SOURCE_SET_INSPECTION_SCHEMA, status: 'CORRESPONDENCE_INPUT_READY', sourceSet, target: first.target,
    memberInspections,
    baseAnchorSuggestionsBySource: Object.freeze(Object.fromEntries(memberInspections.map((item) => [item.sourceId, item.inspection.baseAnchorSuggestions || Object.freeze([])]))),
    versionBridge: Object.freeze({
      schema: 'CIIWorkspaceSourceSetVersionBridge.v1', mode: 'MULTI_SOURCE_SET_CUSTODY_AND_MEMBER_INSPECTION',
      sourceSetSha256, members: sourceSet.members, target: first.versionBridge.target, conversionSource: first.versionBridge.conversionSource,
    }),
    baseAnchorSuggestions: Object.freeze([]), blockers: Object.freeze([]),
  });
}

export const _test = Object.freeze({ authoritySha, sourceId, sourceRows, targetCustodyKey });
