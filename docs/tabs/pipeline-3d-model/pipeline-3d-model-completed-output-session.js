import { canonicalPipelineMetadataValue as canonicalValue,
  resolvePipelineMetadataIdentity } from './pipeline-3d-model-metadata-identity.js';
import { isPipelineCanonicalRawProfile } from './pipeline-3d-model-raw-readiness-session.js';
export const PIPELINE_COMPLETED_OUTPUT_EMPTY = 'EMPTY';
export const PIPELINE_COMPLETED_OUTPUT_BUILT = 'BUILT';
export const PIPELINE_COMPLETED_OUTPUT_REUSED = 'REUSED';
export const PIPELINE_COMPLETED_OUTPUT_FAILED = 'FAILED';
const PROFILE_TEXT_KEYS = Object.freeze(['table2a', 'table3a', 'table3b', 'table3c']);
function plain(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  return [Object.prototype, null].includes(Object.getPrototypeOf(value));
}
function sourceText(value) {
  if (value == null) return '';
  if (typeof value !== 'string') throw new TypeError('Pipeline source table identity must be text.');
  return value;
}
function profileMetadata(profileRaw) {
  if (!plain(profileRaw)) return profileRaw ?? null;
  return Object.fromEntries(Object.entries(profileRaw)
    .filter(([key]) => !PROFILE_TEXT_KEYS.includes(key)));
}
function inputIdentityParts(input = {}) {
  const profileActive = Boolean(input.profileRaw);
  const profile = plain(input.profileRaw) ? input.profileRaw : {};
  const profileIdentity = isPipelineCanonicalRawProfile(input.profileRaw)
    ? input.profileRaw : PROFILE_TEXT_KEYS.map((key) => sourceText(profile[key]));
  const sourceTexts = profileActive
    ? [sourceText(input.table1Text), ...(Array.isArray(profileIdentity) ? profileIdentity : [profileIdentity])]
    : [sourceText(input.table1Text), sourceText(input.table2Text), sourceText(input.table3Text)];
  const { table1Text, table2Text, table3Text, profileRaw, ...metadata } = input;
  return Object.freeze({ sourceTexts: Object.freeze(sourceTexts),
    metadata: Object.freeze({ ...metadata, profileRaw: profileMetadata(profileRaw) }) });
}
function metadataSignature(metadata) {
  return JSON.stringify(canonicalValue(metadata));
}
function identityMetadataSignature(identity) {
  return metadataSignature(identity.metadata);
}
function sameSourceTexts(previous, next) {
  if (!previous || previous.length !== next.length) return false;
  return previous.every((value, index) => value === next[index]);
}
function freezeTree(value, seen = new WeakSet()) {
  if (!value || typeof value !== 'object') return value;
  if (!Array.isArray(value) && !plain(value)) {
    throw new TypeError('Completed Pipeline output must contain plain immutable data.');
  }
  if (seen.has(value)) return value;
  seen.add(value); Object.values(value).forEach((item) => freezeTree(item, seen));
  return Object.isFrozen(value) ? value : Object.freeze(value);
}
function resolutionSnapshot(disposition, counts, output) {
  return Object.freeze({ disposition, buildCount: counts.build,
    reuseCount: counts.reuse, failureCount: counts.failure, hasOutput: Boolean(output) });
}
export function createPipelineCompletedOutputSession(buildOutput) {
  if (typeof buildOutput !== 'function') throw new TypeError('Completed output session requires a builder.');
  let sourceTexts = null, metadata = null, output = null;
  let disposition = PIPELINE_COMPLETED_OUTPUT_EMPTY;
  const counts = { build: 0, reuse: 0, failure: 0 };
  function resolve(input) {
    const identity = inputIdentityParts(input);
    const nextMetadata = resolvePipelineMetadataIdentity(identity.metadata, metadata);
    if (output && metadata === nextMetadata && sameSourceTexts(sourceTexts, identity.sourceTexts)) {
      counts.reuse += 1; disposition = PIPELINE_COMPLETED_OUTPUT_REUSED; return output;
    }
    try {
      const built = buildOutput(input);
      if (!built || typeof built !== 'object') throw new TypeError('Pipeline output builder must return an object.');
      const immutable = freezeTree(built);
      sourceTexts = identity.sourceTexts; metadata = nextMetadata; output = immutable; counts.build += 1;
      disposition = PIPELINE_COMPLETED_OUTPUT_BUILT; return output;
    } catch (error) {
      counts.failure += 1; disposition = PIPELINE_COMPLETED_OUTPUT_FAILED; throw error;
    }
  }
  function reset() { sourceTexts = null; metadata = null; output = null; disposition = PIPELINE_COMPLETED_OUTPUT_EMPTY; }
  function snapshot() { return resolutionSnapshot(disposition, counts, output); }
  return Object.freeze({ resolve, reset, snapshot });
}
export const _test = Object.freeze({ canonicalValue, inputIdentityParts, metadataSignature,
  identityMetadataSignature, sameSourceTexts, freezeTree, resolutionSnapshot });
