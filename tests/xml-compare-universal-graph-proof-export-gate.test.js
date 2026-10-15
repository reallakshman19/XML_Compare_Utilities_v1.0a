import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { normalizeUniversalCategorizerProfile } from '../xml-compare/universal-categorizer/universal-xml-categorizer-contracts.js';
import { createUniversalSourceRegistry } from '../xml-compare/universal-categorizer/universal-source-registry.js';
import { createUniversalCategorizedGraphPreview } from '../xml-compare/universal-categorizer/universal-graph-builder.js';
import { canonicalizeUniversalGraph, createLinewiseUniversalGraphProof, createUniversalGraphProof, findForbiddenUxc003Changes, hashStableString, stableStringify, UNIVERSAL_GRAPH_PROOF_SCHEMA } from '../xml-compare/universal-categorizer/universal-graph-proof.js';
import { assertUniversalXmlExportBlocked, evaluateUniversalXmlExportGate, UNIVERSAL_EXPORT_GATE_SCHEMA, UNIVERSAL_XML_EXPORT_GATE_STATUS } from '../xml-compare/universal-categorizer/universal-export-gate.js';

const profile = normalizeUniversalCategorizerProfile({
  profileId: 'uxc-graph-proof-test',
  sources: [
    { sourceId: 'mainXml', role: 'primary', sourceKind: 'xml' },
    { sourceId: 'coordLookup', role: 'sideload', requiredColumns: ['NODE', 'GLOBAL_X', 'GLOBAL_Y'] },
  ],
  levelDefinitions: [
    { levelId: 'documentRoot', displayName: 'DocumentRoot', children: ['node'] },
    { levelId: 'node', displayName: 'Node' },
  ],
  blockDefinitions: [
    { blockName: 'DerivedCoordinateBlock', attachToLevelId: 'node' },
  ],
  sideloadAttachments: [
    { ruleId: 'coord-to-node', sourceId: 'coordLookup', attachToLevelId: 'node', sourceKey: 'NODE', targetKey: 'nodeNumber', blockName: 'DerivedCoordinateBlock', mode: 'create-block', fieldBindings: [{ targetField: 'y', sourceField: 'GLOBAL_Y' }, { targetField: 'x', sourceField: 'GLOBAL_X' }] },
  ],
});

const sourceInputs = {
  coordLookup: { rows: [{ GLOBAL_Y: '2000', NODE: '10', GLOBAL_X: '1000' }] },
  mainXml: { columns: ['DocumentRoot'] },
};
const targetRows = [{ label: 'Node 10', nodeNumber: '10', levelId: 'node' }];
const registry = createUniversalSourceRegistry(profile, sourceInputs);
const graphA = createUniversalCategorizedGraphPreview({ profile, registry, targetRows });
const graphB = createUniversalCategorizedGraphPreview({
  profile,
  registry: createUniversalSourceRegistry(profile, {
    mainXml: { columns: ['DocumentRoot'] },
    coordLookup: { rows: [{ NODE: '10', GLOBAL_X: '1000', GLOBAL_Y: '2000' }] },
  }),
  targetRows: [{ nodeNumber: '10', levelId: 'node', label: 'Node 10' }],
});

const proofA = createUniversalGraphProof({ graph: graphA });
const proofB = createUniversalGraphProof({ graph: graphB });

assert.equal(proofA.schema, UNIVERSAL_GRAPH_PROOF_SCHEMA);
assert.equal(proofA.graphSchema, 'CategorizedGraph.v1-preview-shadow');
assert.equal(proofA.signature, proofB.signature, 'Equivalent graph inputs must produce the same deterministic signature');
assert.equal(proofA.xmlExportEnabled, false);
assert.equal(proofA.counts.nodes, 1);
assert.equal(proofA.counts.blocks, 1);
assert.equal(proofA.counts.sideloadAttachments, 1);
assert.match(proofA.signature, /^uxc-[0-9a-f]{8}$/);
assert.ok(proofA.canonicalJson.includes('DerivedCoordinateBlock'));

const canonicalA = canonicalizeUniversalGraph(graphA);
const canonicalB = canonicalizeUniversalGraph(graphB);
assert.equal(stableStringify(canonicalA), stableStringify(canonicalB));
assert.equal(hashStableString(stableStringify(canonicalA)), proofA.signature);

const gate = evaluateUniversalXmlExportGate({ proof: proofA });
assert.equal(gate.schema, UNIVERSAL_EXPORT_GATE_SCHEMA);
assert.equal(gate.status, UNIVERSAL_XML_EXPORT_GATE_STATUS);
assert.equal(gate.allowed, false);
assert.equal(gate.blocked, true);
assert.equal(gate.xml, null);
assert.equal(gate.output, null);
assert.equal(gate.fileName, '');
assert.equal(gate.graphSignature, proofA.signature);
assert.ok(gate.diagnostics.some((item) => item.code === 'UXC_XML_EXPORT_DISABLED'));

const assertedGate = assertUniversalXmlExportBlocked({ proof: proofA });
assert.equal(assertedGate.allowed, false);

const linewiseProof = createLinewiseUniversalGraphProof();
assert.equal(linewiseProof.xmlExportEnabled, false);
assert.match(linewiseProof.signature, /^uxc-[0-9a-f]{8}$/);

const changedForbiddenFiles = findForbiddenUxc003Changes(changedFilesFromGit());
assert.deepEqual(changedForbiddenFiles, [], `UXC-003 modified forbidden files: ${changedForbiddenFiles.join(', ')}`);

function changedFilesFromGit() {
  const baseRef = safeGitRef(process.env.GITHUB_BASE_REF || 'uxc-002-graph-builder-preview');
  const commands = [
    `git fetch --no-tags --depth=1 origin ${baseRef}:refs/remotes/origin/${baseRef} && git diff --name-only --diff-filter=ACMRTUXB origin/${baseRef}...HEAD`,
    `git diff --name-only --diff-filter=ACMRTUXB origin/${baseRef}...HEAD`,
    `git diff --name-only --diff-filter=ACMRTUXB ${baseRef}...HEAD`,
  ];
  for (const command of commands) {
    try {
      const output = execSync(command, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
      return [...new Set(output.split(/\r?\n/).map((line) => line.trim()).filter(Boolean))];
    } catch {
      // Try the next git command. This keeps the guard portable across local and CI checkouts.
    }
  }
  return [];
}

function safeGitRef(value) {
  const ref = String(value || 'uxc-002-graph-builder-preview').trim();
  return /^[A-Za-z0-9._/-]+$/.test(ref) ? ref : 'uxc-002-graph-builder-preview';
}

console.log('xml-compare-universal-graph-proof-export-gate tests passed');
