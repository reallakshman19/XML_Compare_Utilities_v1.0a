import assert from 'node:assert/strict';

import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

function profile(exportPolicy = null) {
  return {
    profileId: 'export-policy-test',
    exportPolicy,
    levelDefinitions: [
      {
        levelId: 'Root',
        levelType: 'container',
        creationMode: 'static',
        key: 'ROOT',
        documentRoot: true,
        children: [
          {
            levelId: 'rootPartition',
            levelType: 'partition',
            creationMode: 'static',
            key: 'MODEL_SIDE',
            children: [
              {
                levelId: 'Item',
                levelType: 'occurrence',
                creationMode: 'one-per-row',
                keyResolver: { op: 'trim', column: 'ID' },
                fieldResolvers: {
                  Name: { op: 'trim', column: 'Name' },
                  Kind: { op: 'trim', column: 'Kind' },
                },
              },
            ],
          },
        ],
      },
    ],
  };
}

const source = parseTableSource('ID,Name,Kind\n1,Alpha,Pipe', { sourceId: 'S1', delimiterMode: 'comma' });
const graph = buildCategorizedGraph(profile(), [source]);
const stable = exportCategorizedGraphArtifacts({ graph, profile: profile(), validationResults: [], sources: [source] });
assert.equal(stable.ok, true);
assert.match(stable.xmlText, /^<Root /);
assert.doesNotMatch(stable.xmlText, /^<\?xml/);

const policy = {
  documentRootTag: 'CategorizedTableXml',
  rootPartitionTag: 'ModelSection',
  includeXmlDeclaration: true,
  attributeFields: ['Kind'],
  childElementFields: ['Name'],
};
const customProfile = profile(policy);
const customGraph = buildCategorizedGraph(customProfile, [source]);
const custom = exportCategorizedGraphArtifacts({ graph: customGraph, profile: customProfile, validationResults: [], sources: [source] });
assert.equal(custom.ok, true);
assert.match(custom.xmlText, /^<\?xml version="1.0" encoding="UTF-8"\?>/);
assert.match(custom.xmlText, /<CategorizedTableXml /);
assert.match(custom.xmlText, /<ModelSection /);
assert.match(custom.xmlText, /Kind="Pipe"/);
assert.match(custom.xmlText, /<Name>Alpha<\/Name>/);

const invalid = exportCategorizedGraphArtifacts({
  graph,
  profile: profile({ documentRootTag: '1 Bad Root' }),
  validationResults: [],
  sources: [source],
});
assert.equal(invalid.ok, false);
assert.equal(invalid.diagnostics[0].severity, 'BLOCKER');

console.log('Table categorized export policy tests passed');
