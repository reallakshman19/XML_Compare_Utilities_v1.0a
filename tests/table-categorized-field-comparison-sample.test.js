import assert from 'node:assert/strict';

import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { FIELD_COMPARISON_SAMPLE, FIELD_COMPARISON_SAMPLE_PROFILE } from '../xml-compare/table-categorizer/table-categorized-xml-pilot-profiles.js';
import { validateEditableProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-validation.js';
import { runResolver } from '../xml-compare/table-categorizer/table-categorized-xml-resolver-engine.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { runCategorizerValidation } from '../xml-compare/table-categorizer/table-categorized-xml-validation.js';

const source = parseTableSource(FIELD_COMPARISON_SAMPLE, { sourceId: 'S1', sourceName: 'Field Comparison Sample', delimiterMode: 'tab' });
assert.deepEqual(source.headers, ['SupportISONOTE', 'Remarks']);
assert.equal(source.rows.length, 2);

const genericCompare = runResolver({ op: 'compare', mode: 'number', left: { op: 'literal', value: 25 }, right: { op: 'literal', value: 15 } }, source.rows[0]);
assert.equal(genericCompare.value, 'MISMATCH', 'compare resolver is generic numeric comparison, not SupportISONOTE-specific');

const genericTemplate = runResolver({ op: 'template', template: '{{a}}/{{b}}', values: { a: { op: 'literal', value: 'LEFT' }, b: { op: 'literal', value: 'RIGHT' } } }, source.rows[0]);
assert.equal(genericTemplate.value, 'LEFT/RIGHT', 'template resolver formats any resolver values');

const profileDiagnostics = validateEditableProfile(FIELD_COMPARISON_SAMPLE_PROFILE, { sources: [source] });
assert.equal(profileDiagnostics.some((item) => ['BLOCKER', 'ERROR'].includes(item.severity)), false, JSON.stringify(profileDiagnostics, null, 2));

const graph = buildCategorizedGraph(FIELD_COMPARISON_SAMPLE_PROFILE, [source]);
const comparisonItems = graph.nodes.filter((node) => node.levelId === 'comparisonItem');
assert.equal(comparisonItems.length, 2);

const changed = comparisonItems.find((node) => node.key === 'SL-14143');
assert.ok(changed, 'revision rows are grouped by parsed support base id');
assert.equal(changed.fields.leftRevision, '1');
assert.equal(changed.fields.rightRevision, '3');
assert.equal(changed.fields.restLoadStatus, 'MATCH');
assert.equal(changed.fields.guideLoadStatus, 'MATCH');
assert.equal(changed.fields.guideGapStatus, 'MISMATCH');
assert.equal(changed.fields.lineStopLoadStatus, 'MATCH');
assert.equal(changed.fields.leftGuideGapMm, 25);
assert.equal(changed.fields.rightGuideGapMm, 15);
assert.match(changed.fields.comparisonSummary, /GUIDE GAP MISMATCH/);

const unchanged = comparisonItems.find((node) => node.key === 'SL-14144');
assert.ok(unchanged);
assert.equal(unchanged.fields.guideGapStatus, 'MATCH');
assert.match(unchanged.fields.comparisonSummary, /GUIDE GAP MATCH/);

const validationResults = runCategorizerValidation({ profile: FIELD_COMPARISON_SAMPLE_PROFILE, sources: [source], graph });
const exportResult = exportCategorizedGraphArtifacts({ graph, profile: FIELD_COMPARISON_SAMPLE_PROFILE, validationResults, sources: [source] });
assert.equal(exportResult.ok, true, JSON.stringify(exportResult.diagnostics, null, 2));
assert.match(exportResult.xmlText, /<FieldComparisonReport/);
assert.match(exportResult.xmlText, /<guideGapStatus>MISMATCH<\/guideGapStatus>/);
assert.match(exportResult.xmlText, /SL-14143 rev 1 vs 3/);

console.log('table-categorized-field-comparison-sample.test.js passed');
