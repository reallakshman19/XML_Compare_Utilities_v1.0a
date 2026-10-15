import assert from 'node:assert/strict';

import { buildFieldCatalog } from '../xml-compare/table-categorizer/table-categorized-field-catalog.js';
import { normalizeOutputViews, validateOutputViews } from '../xml-compare/table-categorizer/table-categorized-output-view-contracts.js';
import { normalizePivotSpec, PIVOT_AGGREGATES } from '../xml-compare/table-categorizer/table-categorized-pivot-spec-contracts.js';
import { buildCategorizedGraph } from '../xml-compare/table-categorizer/table-categorized-xml-graph-builder.js';
import { exportCategorizedGraphArtifacts } from '../xml-compare/table-categorizer/table-categorized-xml-exporter.js';
import { createBlankUniversalProfile, normalizeImportedProfile, parseProfileRecipeJson, serializeProfileRecipe } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { validateEditableProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-validation.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';

const source = parseTableSource([
  'Line ID,Rating,Length,Active',
  'L-001,CL150,1200,yes',
  'L-002,CL150,700,no',
].join('\n'), { sourceId: 'S1', delimiterMode: 'comma' });
const catalog = buildFieldCatalog([source]);
const byHeader = Object.fromEntries(catalog.fields.map((field) => [field.header, field]));
const baseProfile = { ...createBlankUniversalProfile(), exportPolicy: { includeDiagnosticsElement: false } };

function validView(patch = {}) {
  return {
    viewId: 'pivot-main',
    type: 'pivot',
    displayName: 'Main Pivot',
    enabled: true,
    pivotSpec: {
      filters: [{ fieldId: byHeader.Active.fieldId }],
      rows: [{ fieldId: byHeader['Line ID'].fieldId }],
      columns: [{ fieldId: byHeader.Rating.fieldId }],
      values: [{ fieldId: byHeader.Length.fieldId, aggregate: 'sum', label: 'Length Sum' }],
      layout: { showGrandTotals: true },
    },
    ...patch,
  };
}

assert.ok(PIVOT_AGGREGATES.includes('countDistinct'));
const normalizedSpec = normalizePivotSpec(validView().pivotSpec);
assert.equal(normalizedSpec.schema, 'PivotSpec.v1');
assert.equal(normalizedSpec.values[0].aggregate, 'sum');

const normalizedViews = normalizeOutputViews([validView()]);
assert.equal(normalizedViews[0].schema, 'OutputView.v1');
assert.equal(normalizedViews[0].pivotSpec.schema, 'PivotSpec.v1');
assert.equal(validateOutputViews(normalizedViews, catalog).some((item) => item.severity === 'BLOCKER'), false);

const profileWithViews = { ...baseProfile, outputViews: normalizedViews };
const normalizedProfile = normalizeImportedProfile(profileWithViews).profile;
assert.equal(normalizedProfile.outputViews[0].schema, 'OutputView.v1');
assert.equal(normalizedProfile.outputViews[0].pivotSpec.values[0].fieldId, byHeader.Length.fieldId);
const serialized = serializeProfileRecipe(profileWithViews);
assert.ok(serialized.includes('"outputViews"'));
assert.ok(serialized.includes('"PivotSpec.v1"'));
assert.deepEqual(parseProfileRecipeJson(serialized).profile.outputViews, normalizedProfile.outputViews);

const noViews = normalizeImportedProfile(createBlankUniversalProfile()).profile;
assert.equal(Object.prototype.hasOwnProperty.call(noViews, 'outputViews'), false, 'profiles without outputViews retain old shape');

const validDiagnostics = validateEditableProfile(profileWithViews, { sources: [source] });
assert.equal(validDiagnostics.some((item) => item.severity === 'BLOCKER'), false, 'valid output view does not block profile validation');

const duplicate = validateEditableProfile({ ...baseProfile, outputViews: [validView(), validView()] }, { sources: [source] });
assert.ok(duplicate.some((item) => item.code === 'output_view_id_duplicate'));
const unknownType = validateEditableProfile({ ...baseProfile, outputViews: [validView({ type: 'chart' })] }, { sources: [source] });
assert.ok(unknownType.some((item) => item.code === 'output_view_type_unknown'));
const unknownField = validateEditableProfile({ ...baseProfile, outputViews: [validView({ pivotSpec: { values: [{ fieldId: 'S1.Missing', aggregate: 'count', label: 'Missing' }] } })] }, { sources: [source] });
assert.ok(unknownField.some((item) => item.code === 'pivot_field_unknown'));
const badAggregate = validateEditableProfile({ ...baseProfile, outputViews: [validView({ pivotSpec: { values: [{ fieldId: byHeader.Rating.fieldId, aggregate: 'sum', label: 'Bad Sum' }] } })] }, { sources: [source] });
assert.ok(badAggregate.some((item) => item.code === 'pivot_numeric_aggregate_requires_number'));
const noValue = validateEditableProfile({ ...baseProfile, outputViews: [validView({ pivotSpec: { values: [] } })] }, { sources: [source] });
assert.ok(noValue.some((item) => item.code === 'pivot_values_missing'));

const disabledDraft = { ...baseProfile, outputViews: [{ viewId: 'draft', type: 'pivot', enabled: false, pivotSpec: { values: [{ fieldId: 'UNKNOWN', aggregate: 'sum', label: 'Draft' }] } }] };
const disabledDiagnostics = validateEditableProfile(disabledDraft, { sources: [source] });
assert.equal(disabledDiagnostics.some((item) => ['pivot_field_unknown', 'pivot_numeric_aggregate_requires_number', 'pivot_values_missing'].includes(item.code)), false);
assert.equal(normalizeImportedProfile(disabledDraft).profile.outputViews[0].enabled, false);

const baseGraph = buildCategorizedGraph(baseProfile, [source]);
const withViewsGraph = buildCategorizedGraph(profileWithViews, [source]);
assert.deepEqual(baseGraph.nodes, withViewsGraph.nodes, 'outputViews do not change graph nodes');
assert.deepEqual(baseGraph.edges, withViewsGraph.edges, 'outputViews do not change graph edges');
const baseXml = exportCategorizedGraphArtifacts({ graph: baseGraph, profile: baseProfile, validationResults: [], sources: [source] }).xmlText;
const withViewsXml = exportCategorizedGraphArtifacts({ graph: withViewsGraph, profile: profileWithViews, validationResults: [], sources: [source] }).xmlText;
assert.equal(withViewsXml, baseXml, 'outputViews do not change XML export output');

console.log('table-categorized-output-view-contracts.test.js passed');
