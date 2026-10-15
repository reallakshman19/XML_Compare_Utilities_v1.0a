/**
 * Functionality: integration-test the imported InputXML v2 reader against real release evidence.
 * Parameters: the local 3D_Converters verification release directory.
 * Outputs: PASS validation, separate comparison groups, legacy marking, and mutation rejection.
 * Fallback: none; release verification must run first and produce the expected local evidence.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compareInputXmlReleaseEvidence,
  validateInputXmlReleaseEvidence,
} from '../xml-compare/inputxml-release-evidence/inputxml-release-consumer.js';

const TEST_DIR = dirname(fileURLToPath(import.meta.url));
const ROOT = dirname(TEST_DIR);
const DEFAULT_EVIDENCE = resolve(ROOT, '..', '3D_Converters', '.tmp', 'inputxml-release-verification', 'release');
const EVIDENCE_DIR = resolve(process.env.INPUTXML_RELEASE_EVIDENCE_DIR || DEFAULT_EVIDENCE);
const MANIFEST_NAME = 'selected-output-manifest.json';

async function loadEvidenceFiles() {
  const manifestBytes = await readFile(join(EVIDENCE_DIR, MANIFEST_NAME));
  const manifest = JSON.parse(manifestBytes.toString('utf8'));
  const entries = [[MANIFEST_NAME, new Uint8Array(manifestBytes)]];
  for (const descriptor of Object.values(manifest.artifacts || {})) {
    entries.push([descriptor.fileName, new Uint8Array(await readFile(join(EVIDENCE_DIR, descriptor.fileName)))]);
  }
  return Object.fromEntries(entries);
}

async function expectMutationBlocked(files) {
  const mutated = { ...files, 'released.cii': new TextEncoder().encode('mutated evidence\n') };
  await assert.rejects(
    () => validateInputXmlReleaseEvidence(mutated, MANIFEST_NAME),
    (error) => error?.code === 'ARTIFACT_LENGTH_MISMATCH' || error?.code === 'ARTIFACT_HASH_MISMATCH',
  );
}

const files = await loadEvidenceFiles();
const evidence = await validateInputXmlReleaseEvidence(files, MANIFEST_NAME);
assert.equal(evidence.releaseValidated, true);
assert.equal(evidence.classification, 'RELEASE_VALIDATED_V2');
assert.equal(evidence.semanticTopologyDifferences.status, 'PASS');
const comparison = await compareInputXmlReleaseEvidence(files, files, MANIFEST_NAME);
assert.equal(comparison.releaseValidated, true);
assert.deepEqual(comparison.normalizedDifferences, []);
assert.deepEqual(comparison.semanticTopologyDifferences, []);
const legacy = await validateInputXmlReleaseEvidence({ 'legacy.json': '{}' }, null);
assert.equal(legacy.classification, 'LEGACY_UNVERIFIED');
assert.equal(legacy.releaseValidated, false);
await expectMutationBlocked(files);
console.log(`[inputxml-release-consumer] PASS: verified ${evidence.manifest.contractVersion}; mutated evidence rejected.`);
