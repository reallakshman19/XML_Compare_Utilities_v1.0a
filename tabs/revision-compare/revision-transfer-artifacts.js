/** Deterministic transfer artifact payload descriptors without DOM or download behavior. */
import { assertJsonSafe, deepFreeze, stableStringify } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';

export const REVISION_COMPARE_TRANSFER_MANIFEST_SCHEMA = 'RevisionCompareTransferManifest.v1';
export const REVISION_COMPARE_TRANSFER_ARTIFACT_SCHEMA = 'RevisionCompareTransferArtifact.v1';
const MIME_TYPE = 'application/json';
const MANIFEST_PREFIX = 'revision-transfer-manifest:';

function sanitizeStem(fileName) {
  const text = String(fileName ?? '').trim().replace(/\.[^.]*$/, '');
  const stem = text.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '').toLowerCase();
  return stem || 'revision_target';
}
function jsonText(value) { return `${JSON.stringify(value, null, 2)}\n`; }
function sizeBytes(text) { return new TextEncoder().encode(text).byteLength; }
async function descriptor(filename, schema, text, cryptoRef) {
  const artifact = deepFreeze({
    descriptorSchema: REVISION_COMPARE_TRANSFER_ARTIFACT_SCHEMA, filename, schema,
    mimeType: MIME_TYPE, text, contentSha256: await sha256Text(text, cryptoRef), sizeBytes: sizeBytes(text),
  });
  assertJsonSafe(artifact, REVISION_COMPARE_TRANSFER_ARTIFACT_SCHEMA); return artifact;
}
function artifactReference(artifact) {
  return deepFreeze({
    filename: artifact.filename, schema: artifact.schema, mimeType: artifact.mimeType,
    contentSha256: artifact.contentSha256, sizeBytes: artifact.sizeBytes,
  });
}
function manifestArtifactReference(stem) {
  return deepFreeze({
    filename: `${stem}_transfer_manifest.json`, schema: REVISION_COMPARE_TRANSFER_MANIFEST_SCHEMA,
    mimeType: MIME_TYPE, contentHashPolicy: 'CANONICAL_MANIFEST_MATERIAL',
    byteHashDescriptorSchema: REVISION_COMPARE_TRANSFER_ARTIFACT_SCHEMA,
  });
}
async function manifestContract(input, artifacts, stem, cryptoRef) {
  const material = {
    schema: REVISION_COMPARE_TRANSFER_MANIFEST_SCHEMA, planId: input.result.planId,
    resultId: input.result.resultId, createdAt: input.result.createdAt,
    targetFileStem: stem, artifacts: Object.freeze(artifacts.map(artifactReference)),
    manifestArtifact: manifestArtifactReference(stem),
  };
  const contentSha256 = await sha256Text(stableStringify(material), cryptoRef);
  return deepFreeze({ ...material, manifestId: `${MANIFEST_PREFIX}${contentSha256}`, contentSha256 });
}

export async function createRevisionCompareTransferArtifacts(input, options = {}) {
  const cryptoRef = options.cryptoRef ?? globalThis.crypto;
  const stem = sanitizeStem(input.targetFileName);
  const patchedSchema = input.patchedSnapshot?.profile ?? input.patchedTargetSchema ?? 'UNKNOWN';
  const patched = await descriptor(
    `${stem}_patched_target.json`, patchedSchema,
    input.result.patchedTargetText, cryptoRef,
  );
  const audit = await descriptor(
    `${stem}_transfer_audit.json`, input.audit.schema, jsonText(input.audit), cryptoRef,
  );
  const proof = await descriptor(
    `${stem}_transfer_proof.json`, input.proof.schema, jsonText(input.proof), cryptoRef,
  );
  const manifest = await manifestContract(input, Object.freeze([patched, audit, proof]), stem, cryptoRef);
  const manifestDescriptor = await descriptor(
    `${stem}_transfer_manifest.json`, manifest.schema, jsonText(manifest), cryptoRef,
  );
  const artifacts = Object.freeze([patched, audit, proof, manifestDescriptor]);
  return deepFreeze({ manifest, artifacts });
}

export const _test = Object.freeze({ artifactReference, jsonText, sanitizeStem, sizeBytes });