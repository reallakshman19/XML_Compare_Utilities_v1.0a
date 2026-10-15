/**
 * Functionality: verify established topology readers accept producer-owned InputXML v2 evidence.
 * Parameters: real local release artifacts produced by 3D_Converters verification.
 * Outputs: immutable parsed topology, PASS v2 report, and explicit legacy classification.
 * Fallback: none; missing or malformed release evidence fails the test.
 */
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  readParsedInputXmlTopology,
  readTopologyParityReport,
  topologyEvidenceClassification,
} from '../tabs/topology-trace-validator/topology-parity-artifact-reader.js';

const ROOT = dirname(dirname(fileURLToPath(import.meta.url)));
const DEFAULT_EVIDENCE = resolve(ROOT, '..', '3D_Converters', '.tmp', 'inputxml-release-verification', 'release');
const EVIDENCE_DIR = resolve(process.env.INPUTXML_RELEASE_EVIDENCE_DIR || DEFAULT_EVIDENCE);

async function readJson(name) {
  return JSON.parse(await readFile(join(EVIDENCE_DIR, name), 'utf8'));
}

const parsed = readParsedInputXmlTopology(await readJson('parsed-inputxml-topology.json'));
const report = readTopologyParityReport(await readJson('topology-parity-report-v2.json'));
assert.equal(parsed.schema, 'ParsedInputXmlTopology.v1');
assert.equal(Object.isFrozen(parsed), true);
assert.equal(report.schema, 'TopologyParityReport.v2');
assert.equal(report.status, 'PASS');
assert.equal(topologyEvidenceClassification(report), 'RELEASE_EVIDENCE_V2');
assert.equal(topologyEvidenceClassification({ schema: 'TopologyParityReport.v1' }), 'LEGACY_UNVERIFIED');
console.log('[topology-parity-v2-artifact-reader] PASS: v2 evidence read; v1 marked LEGACY_UNVERIFIED.');
