import assert from 'node:assert/strict';

import { createPsMappingPreset } from '../xml-compare/table-categorizer/presets/ps-mapping/ps-mapping-profile.js';
import { comparePsMappingCategorizedGraphs } from '../xml-compare/table-categorizer/presets/ps-mapping/ps-mapping-compare.js';

const preset = createPsMappingPreset();
assert.equal(preset.schema, 'table-categorizer-ps-mapping-preset/v1');
assert.equal(Boolean(preset.profile.profileId), true);
assert.equal(preset.samples.table2.length > 0, true);

const graph = {
  nodes: [
    { id: 'f1', levelId: 'supportFamily', key: 'F1', sourceRefs: ['S1:1'] },
    { id: 'o1', levelId: 'supportOccurrence', key: 'O1', fields: { Bore: '10' }, sourceRefs: ['S1:1'] },
  ],
  edges: [{ fromNodeId: 'f1', toNodeId: 'o1' }],
};
const result = comparePsMappingCategorizedGraphs({ sourceGraph: graph, targetGraph: graph });
assert.equal(result.schema, 'table-categorized-xml-ps-mapping-compare/v1');
assert.equal(result.summary.mapped, 2);

console.log('Table categorized PS Mapping preset tests passed');
