import assert from 'node:assert/strict';
import fs from 'node:fs';

import { renderTableCategorizedXmlShellHtml } from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { applySourceTransformRules } from '../xml-compare/table-categorizer/table-categorized-xml-source-transforms.js';
import { createBlankUniversalProfile, updateLevelAtPath } from '../xml-compare/table-categorizer/table-categorized-xml-profile-designer.js';
import { validateEditableProfile } from '../xml-compare/table-categorizer/table-categorized-xml-profile-validation.js';

const runtime = fs.readFileSync(new URL('../tabs/xml-compare-table-categorized-runtime.js', import.meta.url), 'utf8');
const layoutCss = fs.readFileSync(new URL('../tabs/xml-compare-table-categorized-layout-fix.css', import.meta.url), 'utf8');
const recipeUxCss = fs.readFileSync(new URL('../tabs/xml-compare-table-categorized-recipe-builder-ux.css', import.meta.url), 'utf8');
const indexHtml = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const source = applySourceTransformRules(
  parseTableSource(['PS NO	Rating	Length', 'PS-100.1	CL150	1200mm'].join('\n'), { sourceId: 'S1', delimiterMode: 'tab' }),
  [{ ruleId: 'trim-ps', newColumn: 'PS_NO_Trimmed', sourceColumn: 'PS NO', operation: 'take-before', find: '.' }],
);
const profile = createBlankUniversalProfile();
const html = renderTableCategorizedXmlShellHtml({ activeStep: 'structure', activeTab: 'graph', profile, sources: [source], activeSourceId: 'S1', columnsConfirmed: true, selectedLevelPath: '0' });

assert.ok(indexHtml.includes('xml-compare-table-categorized-layout-fix.css'), 'stable layout CSS is loaded from index.html');
assert.ok(indexHtml.includes('xml-compare-table-categorized-recipe-builder-ux.css'), 'recipe builder UX CSS is loaded from index.html');
assert.ok(layoutCss.includes('.table-categorized-xml-dialog') && layoutCss.includes('height: min(840px, calc(100vh - 28px))'), 'dialog height is stable across tabs');
assert.ok(layoutCss.includes('.table-categorized-xml-body') && layoutCss.includes('overflow: hidden'), 'body uses internal scroll, not dialog resize');
assert.ok(layoutCss.includes('.table-categorized-shell-main') && layoutCss.includes('overflow-y: auto'), 'tab columns scroll internally');
assert.ok(layoutCss.includes('.table-categorized-structure-workspace') && layoutCss.includes('overflow-y: auto'), 'Structure Recipe Builder has vertical scroll');
assert.ok(layoutCss.includes('.table-categorized-recipe-tree') && layoutCss.includes('overflow-y: auto'), 'recipe tree has vertical scroll');
assert.ok(recipeUxCss.includes('.table-categorized-recipe-tree') && recipeUxCss.includes('border-left: 1px dashed'), 'recipe tree gets clearer hierarchy styling');
assert.ok(recipeUxCss.includes('[data-table-categorized-selected-node-panel]') && recipeUxCss.includes('position: sticky'), 'selected node editor stays visible while scrolling');
assert.ok(recipeUxCss.includes('Edit one hierarchy level at a time'), 'selected node panel adds user guidance');
assert.ok(recipeUxCss.includes('.table-categorized-field-action-chip') && recipeUxCss.includes('grid-template-columns: repeat(auto-fit'), 'field catalog choices are styled as responsive guided action chips');
assert.ok(recipeUxCss.includes('[data-table-categorized-node-summary]'), 'selected node summary is styled');
assert.ok(recipeUxCss.includes('Shows how the selected node will resolve from real rows'), 'live preview gets explanatory guidance');
assert.ok(html.includes('data-table-categorized-fullscreen-icon'), 'fullscreen icon toggle is rendered');
assert.ok(html.includes('table-categorized-structure-workspace is-scrollable'), 'Structure Recipe Builder gets vertical scroll container');
assert.ok(html.includes('data-table-categorized-structure-scroll="true"'), 'scroll container has explicit structure scroll marker');
assert.ok(html.includes('data-table-categorized-structure-live-preview'), 'live preview panel is rendered');
assert.ok(html.includes('Live Data Preview'), 'live preview heading is visible');
assert.ok(html.includes('PS-100.1'), 'live preview uses parsed source row data');
assert.ok(html.includes('data-table-categorized-recipe-tree="true"'), 'recipe tree is rendered');
assert.ok(html.includes('data-table-categorized-selected-node-panel'), 'selected-node panel is rendered');
assert.ok(html.includes('data-table-categorized-node-summary'), 'selected-node summary is rendered');
assert.ok(html.includes('XML: documentRoot') && html.includes('Fields: 0'), 'node summary shows XML/key/display/field-count status');
assert.ok(html.includes('data-field-catalog-resolver-options="FieldCatalog.v1"'), 'FieldCatalog compact field panel is rendered');
assert.ok(html.includes('PS NO') && html.includes('PS_NO_Trimmed'), 'FieldCatalog fields appear in resolver choices');
assert.ok(html.includes('data-table-categorized-action="assign-field-key"'), 'guided key assignment action is rendered');
assert.ok(html.includes('data-table-categorized-action="assign-field-display"'), 'guided display assignment action is rendered');
assert.ok(html.includes('data-table-categorized-action="add-field-resolver"'), 'guided XML field resolver action is rendered');
assert.ok(html.includes('data-table-categorized-action="create-child-from-field"'), 'guided child-level creation action is rendered');
assert.ok(html.includes('data-field-header="PS NO"'), 'guided action carries source field header');
assert.ok(html.includes('data-level-field="levelId"'), 'levelId editor is rendered');
assert.ok(html.includes('data-level-field="displayName"'), 'displayName editor is rendered');
assert.ok(html.includes('data-level-field="xmlTag"'), 'xmlTag editor is rendered');
assert.ok(html.includes('data-level-field="levelType"'), 'levelType selector is rendered');
assert.ok(html.includes('data-level-field="creationMode"'), 'creationMode selector is rendered');
assert.ok(html.includes('<option value="container"'), 'levelType options include container');
assert.ok(html.includes('<option value="one-per-key"'), 'creationMode options include one-per-key');
assert.ok(html.includes('data-level-field="keyColumn"'), 'key resolver field selector is rendered');
assert.ok(html.includes('data-level-display-column'), 'display resolver field selector is rendered');
assert.ok(html.includes('Field Resolvers'), 'field resolver list is rendered');
assert.ok(html.includes('data-table-categorized-action="select-level"'), 'level selection action is rendered');
assert.ok(html.includes('data-table-categorized-action="add-child-level"'), 'add child remains rendered');
assert.ok(html.includes('data-table-categorized-action="remove-level" data-path="0" disabled'), 'root delete is disabled');

const keyedProfile = updateLevelAtPath(profile, [0, 0], { creationMode: 'one-per-key', keyResolver: { op: 'trim', column: 'PS NO' } });
const childHtml = renderTableCategorizedXmlShellHtml({ activeStep: 'structure', activeTab: 'graph', profile: keyedProfile, sources: [source], activeSourceId: 'S1', columnsConfirmed: true, selectedLevelPath: '0,0' });
assert.ok(childHtml.includes('data-level-path="0,0"'), 'child path is stable and rendered');
assert.ok(childHtml.includes('data-level-split-dot="true"'), 'text-before-dot quick behavior remains available for keyed nodes');
assert.ok(childHtml.includes('Key: PS NO'), 'live preview follows selected key resolver column');

assert.ok(runtime.includes('selectLevelFromButton'), 'runtime handles selected tree node action');
assert.ok(runtime.includes('changeDisplayColumn'), 'runtime handles display resolver field selection');
assert.ok(runtime.includes('applyGuidedFieldAction'), 'runtime handles guided field-chip actions');
assert.ok(runtime.includes('assign-field-key') && runtime.includes('assign-field-display'), 'runtime maps field chips to key/display actions');
assert.ok(runtime.includes('add-field-resolver') && runtime.includes('create-child-from-field'), 'runtime maps field chips to XML field and child level actions');
assert.ok(runtime.includes('uniqueResolverName'), 'runtime avoids overwriting existing field resolvers');

const invalid = updateLevelAtPath(profile, [0], { xmlTag: 'Bad Tag' });
const diagnostics = validateEditableProfile(invalid, { sources: [source] });
assert.ok(diagnostics.some((item) => item.message.includes('XML')), 'invalid XML tag remains caught by validation');

console.log('table-categorized-structure-builder-ui.test.js passed');
