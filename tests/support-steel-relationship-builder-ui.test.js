import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  renderSupportSteelDialog,
  renderSupportSteelLauncher,
  renderSupportSteelWorkspace,
} from '../tabs/support-steel-relationship-builder/support-steel-relationship-shell.js';

const launcher = renderSupportSteelLauncher();
assert.match(launcher, /Support \/ Steel Relationship Builder/);
assert.match(launcher, /data-ssrb-open="1"/);
assert.match(launcher, /data-ssrb-version="restraint-function-1"/);
assert.match(launcher, /Path and restraint-function evidence/);

const dialog = renderSupportSteelDialog();
assert.match(dialog, /XML-free assembly workspace/i);
assert.match(dialog, /one staged model JSON containing piping, support and structural records/i);
assert.match(dialog, /proves fail-closed carrier-to-structure paths/i);
assert.match(dialog, /validates intended restraint functions/i);
assert.match(dialog, /without clash XML/i);
assert.match(dialog, /data-ssrb-fullscreen="1"/);
assert.match(dialog, /data-ssrb-close="1"/);

const workspace = renderSupportSteelWorkspace();
for (const tab of ['input', 'rules', 'build', 'relationships', 'chain', 'evidence', 'export']) {
  assert.ok(workspace.includes(`data-ssrb-tab="${tab}"`), `missing ${tab} tab`);
}
for (const label of [
  'Load one combined staged model JSON', 'Combined staged model JSON',
  'One hierarchy containing piping, support and structural records',
  'Separate support and steel files are not required',
  'restraint-function validation',
  'Support family regex', 'Steel group regex', 'Steel projection tolerance mm',
  'Member contact tolerance mm', 'Carrier attachment tolerance mm',
  'Carrier topology exact tolerance mm', 'Carrier topology small-gap tolerance mm',
  'Complete-path policy', 'SupportCarrierToStructurePathBundle.v1',
  'Build Relationships', 'Support-centred hierarchy', 'Geometry evidence ledger',
  'Carrier-to-structure path evidence',
  'Complete paths and missing-link exceptions are reported separately',
  'Selected relationship and complete-path evidence',
  'Carrier → Structure Path CSV',
]) assert.ok(workspace.includes(label), `missing UI label ${label}`);
assert.match(workspace, /data-ssrb-input="model"/);
assert.match(workspace, /data-ssrb-file="model"/);
assert.doesNotMatch(workspace, /data-ssrb-input="support"/);
assert.doesNotMatch(workspace, /data-ssrb-input="steel"/);
assert.equal((workspace.match(/<textarea /g) || []).length, 1);

const utilityTab = readFileSync('tabs/psnm-utility-tab.js', 'utf8');
const layout = readFileSync('tabs/psnm-utility-tab-layout-stabilizer.js', 'utf8');
const relationshipTab = readFileSync('tabs/support-steel-relationship-builder/support-steel-relationship-tab.js', 'utf8');
const relationshipView = readFileSync('tabs/support-steel-relationship-builder/support-steel-relationship-view.js', 'utf8');
const evidenceBundle = readFileSync('tabs/support-steel-relationship-builder/support-steel-evidence-bundle.js', 'utf8');
const restraintFacade = readFileSync('tabs/support-steel-relationship-builder/support-steel-restraint-evidence-bundle.js', 'utf8');
const restraintAddon = readFileSync('tabs/support-steel-relationship-builder/support-restraint-function-addon.js', 'utf8');
const restraintView = readFileSync('tabs/support-steel-relationship-builder/support-restraint-function-view.js', 'utf8');
const supportReportAddon = readFileSync('tabs/support-steel-relationship-builder/support-report-addon.js', 'utf8');
const supportReportEngine = readFileSync('tabs/support-steel-relationship-builder/support-report-engine.js', 'utf8');
const supportReportClash = readFileSync('tabs/support-steel-relationship-builder/support-report-clash-evidence.js', 'utf8');
const bootstrap = readFileSync('tabs/support-steel-relationship-builder/support-steel-relationship-bootstrap.js', 'utf8');
const pathEngine = readFileSync('tabs/support-steel-relationship-builder/support-carrier-to-structure-path.js', 'utf8');
const topologyEngine = readFileSync('tabs/support-steel-relationship-builder/support-carrier-topology-engine.js', 'utf8');
const carrierAttachment = readFileSync('tabs/support-steel-relationship-builder/support-carrier-attachment-engine.js', 'utf8');
const chainEngine = readFileSync('tabs/support-steel-relationship-builder/support-member-chain-engine.js', 'utf8');
assert.match(utilityTab, /installSupportSteelRelationshipBuilderTile/);
assert.match(utilityTab, /destroySupportSteelRelationshipBuilder/);
assert.match(layout, /data-psnm-deck/);
assert.match(layout, /app-dashboard-grid/);
assert.match(relationshipTab, /supportSteelBuildInputSnapshot/);
assert.match(relationshipTab, /data-ssrb-input=\"model\"/);
assert.doesNotMatch(relationshipTab, /data-ssrb-input=\"support\"/);
assert.doesNotMatch(relationshipTab, /data-ssrb-input=\"steel\"/);
assert.match(relationshipTab, /supportCarrierToStructurePathsToCsv/);
assert.match(relationshipView, /Complete carrier-to-structure paths/);
assert.match(relationshipView, /Carrier-to-structure missing-link exceptions/);
assert.match(relationshipView, /ANALYTICAL_PATH_CANDIDATE/);
assert.match(evidenceBundle, /combinedInput/);
assert.match(evidenceBundle, /COMBINED_STAGED_MODEL/);
assert.match(restraintFacade, /supportRestraintFunction/);
assert.match(restraintAddon, /data-ssrb-input=\"model\"/);
assert.match(restraintAddon, /support-steel-restraint-evidence-bundle/);
assert.match(restraintView, /Support restraint-function validation/);
assert.match(restraintView, /ANALYTICAL_FUNCTION_CANDIDATE/);
assert.match(supportReportAddon, /Support Report/);
assert.match(supportReportAddon, /data-ssr-xml/);
assert.match(supportReportAddon, /buildSupportReportBundle/);
assert.match(supportReportAddon, /legacyBlankPrimarySupportHeader/);
assert.match(supportReportAddon, /XML changed; rebuild the Support Report/);
assert.match(supportReportAddon, /Combined staged model changed; rebuild the Support Report/);
assert.match(supportReportAddon, /Relationship rules changed; rebuild the Support Report/);
assert.match(supportReportEngine, /SupportReportBundle/);
assert.match(supportReportEngine, /nativeOnlyMemberIds/);
assert.match(supportReportClash, /secondarySupportFamilyId/);
assert.match(supportReportClash, /fullLineTag/);
assert.match(bootstrap, /support-restraint-function-addon\.js/);
assert.match(bootstrap, /support-report-addon\.js/);
assert.match(bootstrap, /restraint-function-1/);
assert.match(pathEngine, /SupportCarrierToStructurePathBundle\.v1/);
assert.match(topologyEngine, /EXACT_PORT_CONNECTION/);
assert.match(carrierAttachment, /SUPPORT_MEMBER_TO_CARRIER_ATTACHMENT/);
assert.match(chainEngine, /SUPPORT_MEMBER_TO_STRUCTURE/);

const css = readFileSync('tabs/support-steel-relationship-builder/support-steel-relationship-tab.css', 'utf8');
assert.match(css, /\.ssrb-results-layout/);
assert.match(css, /\.ssrb-table-wrap/);
assert.match(css, /position:sticky/);
assert.match(css, /@media\(max-width:700px\)/);

console.log('support-steel-relationship-builder-ui tests passed');
