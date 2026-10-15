/** Exact retained-byte verification for imported transfer handover artifacts. */
import { stableStringify } from './revision-contract-utils.js';
import { sha256Text } from './revision-hash.js';
import {
  REVISION_COMPARE_TRANSFER_ARTIFACT_SCHEMA,
  REVISION_COMPARE_TRANSFER_MANIFEST_SCHEMA,
  createRevisionCompareTransferArtifacts,
} from './revision-transfer-artifacts.js';
import {
  REVISION_COMPARE_TRANSFER_AUDIT_SCHEMA,
  REVISION_COMPARE_TRANSFER_PROOF_SCHEMA,
} from './revision-transfer-verifier.js';

function equal(left, right) { return stableStringify(left) === stableStringify(right); }
function byteSize(text) { return new TextEncoder().encode(String(text)).byteLength; }
function descriptorReference(item) {
  return { descriptorSchema: item.descriptorSchema, filename: item.filename, schema: item.schema,
    mimeType: item.mimeType, contentSha256: item.contentSha256, sizeBytes: item.sizeBytes };
}
function retainedJson(item, role) {
  let parsed;
  try { parsed = JSON.parse(item.text); } catch (error) { throw new Error(`${role} artifact JSON is invalid: ${error.message}`); }
  if (item.text !== `${JSON.stringify(parsed, null, 2)}\n`) {
    throw new Error(`${role} artifact text does not equal governing retained bytes.`);
  }
  return parsed;
}

export async function verifyRevisionCompareRetainedTransferArtifacts(payload, roles, cryptoRef = globalThis.crypto) {
  const artifacts = payload.transferArtifacts;
  if (!Array.isArray(artifacts) || artifacts.length !== 4) {
    throw new Error('Exactly four embedded transfer artifacts are required in governing order.');
  }
  const schemas = [payload.transferPlan.receiverDocument.profile, REVISION_COMPARE_TRANSFER_AUDIT_SCHEMA,
    REVISION_COMPARE_TRANSFER_PROOF_SCHEMA, REVISION_COMPARE_TRANSFER_MANIFEST_SCHEMA];
  for (let index = 0; index < artifacts.length; index += 1) {
    const item = artifacts[index]; const role = roles[index];
    if (item?.descriptorSchema !== REVISION_COMPARE_TRANSFER_ARTIFACT_SCHEMA || item.schema !== schemas[index]
        || item.mimeType !== 'application/json' || typeof item.filename !== 'string' || !item.filename
        || typeof item.text !== 'string') throw new Error(`${role} artifact descriptor is invalid.`);
    if (await sha256Text(item.text, cryptoRef) !== item.contentSha256) throw new Error(`${role} artifact SHA-256 does not match.`);
    if (byteSize(item.text) !== item.sizeBytes) throw new Error(`${role} artifact UTF-8 size does not match.`);
  }
  if (artifacts[0].text !== payload.transferResult.patchedTargetText) {
    throw new Error('PATCHED_TARGET artifact does not equal governing retained bytes.');
  }
  const retainedAudit = retainedJson(artifacts[1], roles[1]);
  const retainedProof = retainedJson(artifacts[2], roles[2]);
  const retainedManifest = retainedJson(artifacts[3], roles[3]);
  if (!equal(retainedAudit, payload.transferAudit)) throw new Error('TRANSFER_AUDIT artifact does not equal governing retained bytes.');
  if (!equal(retainedProof, payload.transferProof)) throw new Error('TRANSFER_PROOF artifact does not equal governing retained bytes.');
  if (!equal(retainedManifest, payload.transferManifest)) throw new Error('TRANSFER_MANIFEST artifact does not equal governing retained bytes.');
  const expected = await createRevisionCompareTransferArtifacts({
    result: payload.transferResult, audit: retainedAudit, proof: retainedProof,
    targetFileName: payload.transferPlan.receiverDocument.fileName,
    patchedTargetSchema: payload.transferPlan.receiverDocument.profile,
  }, { cryptoRef });
  if (!equal(payload.transferManifest, expected.manifest)) {
    throw new Error('Transfer manifest does not equal deterministic manifest material.');
  }
  for (let index = 0; index < artifacts.length; index += 1) {
    if (!equal(artifacts[index], expected.artifacts[index])) {
      throw new Error(`${roles[index]} artifact does not equal governing retained bytes.`);
    }
  }
  return expected.artifacts.map(descriptorReference);
}
