import assert from 'node:assert/strict';

import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

function rootWith(child, extra = {}) {
  return {
    profileId: 'creation-mode-test',
    ...extra,
    levelDefinitions: [
      { levelId: 'Root', levelType: 'container', creationMode: 'static', key: 'ROOT', documentRoot: true, children: [child] },
    ],
  };
}

const conditionalSource = parseTableSource('ID,Active\n1,Y\n2,N\n3,Y', { sourceId: 'S1', delimiterMode: 'comma' });
const conditionalGraph = buildCategorizedGraph(rootWith({
  levelId: 'ConditionalItem',
  levelType: 'occurrence',
  creationMode: 'conditional',
  keyResolver: { op: 'trim', column: 'ID' },
  conditionResolver: { op: 'booleanParser', column: 'Active' },
}), [conditionalSource]);
assert.equal(conditionalGraph.nodes.filter((node) => node.levelId === 'ConditionalItem').length, 2);

const main = parseTableSource('ID,Name\n1,A\n2,B', { sourceId: 'MAIN', delimiterMode: 'comma' });
const lookup = parseTableSource('ID,Rating\n1,R1\n2,R2', { sourceId: 'LOOKUP', delimiterMode: 'comma' });
const joinedGraph = buildCategorizedGraph(rootWith({
  levelId: 'JoinedItem',
  levelType: 'occurrence',
  creationMode: 'lookup-joined',
  keyResolver: { op: 'trim', sourceId: 'MAIN', column: 'ID' },
  fieldResolvers: { Rating: { op: 'trim', sourceId: 'LOOKUP', column: 'Rating' } },
}, {
  drivingSourceId: 'MAIN',
  joins: [{ joinId: 'rating', leftSourceId: 'MAIN', rightSourceId: 'LOOKUP', leftKeyResolver: { column: 'ID' }, rightKeyResolver: { column: 'ID' }, duplicatePolicy: 'first', missingPolicy: 'warning', joinType: 'left' }],
}), [main, lookup]);
assert.equal(joinedGraph.nodes.filter((node) => node.fields.Rating).length, 2);

const coordinateSource = parseTableSource('ID,X,Y,Z\n1,0,0,0\n2,1,1,1\n3,100,100,100', { sourceId: 'S1', delimiterMode: 'comma' });
const clusterGraph = buildCategorizedGraph(rootWith({
  levelId: 'CoordinateCluster',
  levelType: 'group',
  creationMode: 'coordinate-clustered',
  keyResolver: { op: 'coordinateCluster', contract: { axisMapping: { x: 'X', y: 'Y', z: 'Z' }, tolerance: 2, unit: 'mm' } },
}), [coordinateSource]);
assert.equal(clusterGraph.nodes.filter((node) => node.levelId === 'CoordinateCluster').length, 2);

const manySource = parseTableSource('ID,Tags\n1,A|B|C', { sourceId: 'S1', delimiterMode: 'comma' });
const manyGraph = buildCategorizedGraph(rootWith({
  levelId: 'Tag',
  levelType: 'attribute',
  creationMode: 'many-per-row',
  listResolver: { op: 'trim', column: 'Tags' },
  delimiter: '|',
}), [manySource]);
assert.equal(manyGraph.nodes.filter((node) => node.levelId === 'Tag').length, 3);

const alignedSource = parseTableSource(
  'ID,Members,Types,References\n1,"M1,M2","REST,GUIDE","R1,R2,R3"',
  { sourceId: 'S1', delimiterMode: 'comma' },
);
const alignedGraph = buildCategorizedGraph(rootWith({
  levelId: 'Component',
  levelType: 'feature',
  creationMode: 'many-per-row',
  delimiter: ',',
  listResolver: { op: 'trim', column: 'Members' },
  parallelListResolvers: {
    memberId: { op: 'trim', column: 'Members' },
    supportType: { op: 'trim', column: 'Types' },
    reference: { op: 'trim', column: 'References' },
  },
}), [alignedSource]);
const alignedNodes = alignedGraph.nodes.filter((node) => node.levelId === 'Component');
assert.equal(alignedNodes.length, 3, 'longest parallel list is preserved');
assert.equal(alignedNodes[0].fields.memberId, 'M1');
assert.equal(alignedNodes[0].fields.supportType, 'REST');
assert.equal(alignedNodes[2].fields.memberId, '');
assert.equal(alignedNodes[2].fields.reference, 'R3');
assert.ok(alignedGraph.diagnostics.some((item) => item.code === 'many_per_row_parallel_list_length_mismatch'));

const seriesSource = parseTableSource('ID,Fy,Fy,Fz\n1,-10,-20,5', { sourceId: 'S1', delimiterMode: 'comma' });
const seriesGraph = buildCategorizedGraph(rootWith({
  levelId: 'Load',
  levelType: 'measure',
  creationMode: 'many-per-row',
  columnSeries: { headerPattern: '^[Ff][YyZz]$', includeBlank: true, valueType: 'number' },
}), [seriesSource]);
const seriesNodes = seriesGraph.nodes.filter((node) => node.levelId === 'Load');
assert.deepEqual(seriesSource.columnIds, ['ID', 'Fy', 'Fy__2', 'Fz']);
assert.equal(seriesNodes.length, 3);
assert.equal(seriesNodes[0].fields.columnId, 'Fy');
assert.equal(seriesNodes[0].fields.ordinal, 1);
assert.equal(seriesNodes[1].fields.columnId, 'Fy__2');
assert.equal(seriesNodes[1].fields.ordinal, 2);
assert.equal(seriesNodes[1].fields.raw, '-20');
assert.equal(seriesNodes[1].fields.sourceCellRef, 'S1:1:Fy__2');

console.log('Table categorized creation mode tests passed');
