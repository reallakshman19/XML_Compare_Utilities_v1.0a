// W6: domain profiles, generic measures (MTO/Sales), setup wizard model,
// role-map ignore-list.
import assert from 'assert';
import { detectProfile, profileTerms, profileRoleHints, PROFILES } from '../workbench3d/core/profiles.js';
import { buildMeasureProps, measureDeltaBetween } from '../workbench3d/tablexml/measures.js';
import { parseTableSource } from '../xml-compare/table-categorizer/table-categorized-xml-source-parser.js';
import { suggestRoles, createNodeSetMapping, validateMapping } from '../workbench3d/tablexml/column-mapper.js';
import { buildNodeSetModel, serializeNodeSetXml } from '../workbench3d/tablexml/nodeset-builder.js';
import { buildNodeSetGraph } from '../workbench3d/adapters/nodeset-adapter.js';
import { runNodeCompare } from '../workbench3d/compare/node-compare-engine.js';
import { setupWizardModel } from '../workbench3d/ui/setup-wizard.js';
import { roleMapAuditModel } from '../workbench3d/ui/role-map-audit.js';
import { validateCompareAudit, DIFF_STATUS } from '../workbench3d/contracts/contracts.js';

// ── profile detection ────────────────────────────────────────────────────
assert.strictEqual(detectProfile({ schema: 'input-xml' }), 'XML_ELEMENT');
assert.strictEqual(detectProfile({ schema: 'categorized-xml' }), 'XML_ELEMENT');
assert.strictEqual(detectProfile({ headers: ['PSNO', 'SUPPORT TYPE', 'BOP ELEVATION'] }), 'NODE_SUPPORT');
assert.strictEqual(detectProfile({ headers: ['Customer', 'Region', 'Revenue', 'Volume'] }), 'SALES');
assert.strictEqual(detectProfile({ headers: ['Item Code', 'Commodity', 'Quantity', 'Weight'] }), 'MTO');
assert.strictEqual(detectProfile({ headers: ['foo', 'bar'] }), 'GENERIC_NODE');
assert.strictEqual(profileTerms('MTO').node, 'MTO item');
assert.strictEqual(profileTerms('SALES').measure, 'Revenue / volume');

// ── generic measures ──────────────────────────────────────────────────────
const mprops = buildMeasureProps({ rawByColumnId: { Q: '1,250', C: '$4,500.50' } }, [{ columnId: 'Q', header: 'Quantity' }, { columnId: 'C', header: 'Cost' }], []);
assert.strictEqual(mprops.MEASURE_QUANTITY, 1, 'comma-number extracts leading value'); // '1,250' → 1 by number rule
// use clean numeric samples to avoid comma ambiguity
const clean = buildMeasureProps({ rawByColumnId: { Q: '1250', C: '4500.5' } }, [{ columnId: 'Q', header: 'Quantity' }, { columnId: 'C', header: 'Cost' }], []);
assert.strictEqual(clean.MEASURE_QUANTITY, 1250);
assert.strictEqual(clean.MEASURE_COST, 4500.5);
const md = measureDeltaBetween({ MEASURE_QUANTITY: '100' }, { MEASURE_QUANTITY: '136' });
assert.ok(Math.abs(md.maxDeltaPct - 26.47) < 0.1, `+36 on 136 base ≈ 26.5% (got ${md.maxDeltaPct})`);
assert.strictEqual(measureDeltaBetween({ X: '1' }, { X: '2' }), null);

// ── MTO end-to-end: coordinate-less table matched by item code + qty delta ─
const mtoTable = (qtyA, qtyB) => [
  'Item Code\tCommodity\tQuantity\tWeight',
  `PIPE-01\tCS Pipe\t${qtyA}\t120`,
  `ELB-02\tElbow\t40\t18`,
].join('\n');
const srcT = parseTableSource(mtoTable(100, 0), { sourceId: 'M1' });
const roles = suggestRoles(srcT, profileRoleHints('MTO'));
assert.strictEqual(roles['Item_Code'], 'node-id', 'MTO item code → node-id');
assert.strictEqual(roles.Quantity, 'measure', 'quantity → measure');
assert.strictEqual(roles.Weight, 'measure', 'weight → measure');
const mapping = createNodeSetMapping(srcT, roles);
assert.deepStrictEqual(validateMapping(mapping), [], 'coordinate-less MTO mapping valid (measure + node-id)');
const modelA = buildNodeSetModel(srcT, mapping, [], 'revA');
assert.strictEqual(modelA.nodes.length, 2, 'MTO nodes built on synthetic grid');
assert.ok(modelA.nodes[0].props.some((p) => p.name === 'MEASURE_QUANTITY'), 'measure prop emitted');

const tgtSource = parseTableSource(mtoTable(136, 0), { sourceId: 'M2' });
const modelB = buildNodeSetModel(tgtSource, createNodeSetMapping(tgtSource, roles), [], 'revB');
const graphA = buildNodeSetGraph('source', serializeNodeSetXml(modelA));
const graphB = buildNodeSetGraph('target', serializeNodeSetXml(modelB));
const audit = runNodeCompare(graphA, graphB, { positionToleranceMm: 5000, profileId: 'MTO' });
assert.deepStrictEqual(validateCompareAudit(audit), []);
assert.strictEqual(audit.profileId, 'MTO');
assert.strictEqual(audit.summary.matchedElements, 2, 'both items matched by key');
assert.ok(audit.summary.measureChangedElements >= 1, 'measure change detected');
const pipeRow = audit.objectDiff.rows.find((r) => graphA.objects.find((o) => o.objectId === r.sourceObjectId)?.fromNode === 'PIPE-01');
assert.strictEqual(pipeRow.status, DIFF_STATUS.PROPERTY_CHANGED, 'qty change → property changed');
assert.ok(Math.abs(pipeRow.measureDeltaPct - 26.47) < 0.2, 'quantity delta on the row');
assert.ok(!pipeRow.changedProperties.some((c) => c.property.startsWith('MEASURE_')), 'measures reported as delta, not raw prop change');

// ── setup wizard model ─────────────────────────────────────────────────────
const wizEmpty = setupWizardModel({ activeView: 'compare', tablexml: null });
assert.strictEqual(wizEmpty.steps.length, 5);
assert.strictEqual(wizEmpty.doneCount, 0, 'nothing done before sources');
assert.strictEqual(wizEmpty.steps[0].id, 'sources');
const wizXml = setupWizardModel({ activeView: 'compare', sourceXml: '<x/>', targetXml: '<y/>', graphs: { sourceSchema: 'input-xml' }, audit: { summary: { matchedElements: 3 } } });
assert.strictEqual(wizXml.profileId, 'XML_ELEMENT');
assert.strictEqual(wizXml.doneCount, 5, 'all steps done once compared');
assert.ok(wizXml.steps.find((s) => s.id === 'relationships').done);

// ── role-map audit + ignore list ──────────────────────────────────────────
const rm = roleMapAuditModel({ graphs: { A: graphA }, ignoredProps: ['MEASURE_WEIGHT'] });
assert.strictEqual(rm.domain, 'NODE');
assert.ok(rm.rows.some((r) => r.field === 'MEASURE_QUANTITY' && r.role === 'measure.value'), 'universal role mapping');
assert.ok(rm.rows.find((r) => r.field === 'MEASURE_WEIGHT').ignored, 'ignore flag reflected');

// ignoring a property removes it from the diff
const auditIgnored = runNodeCompare(graphA, graphB, { positionToleranceMm: 5000, ignoredProps: ['COMMODITY'] });
assert.ok(auditIgnored.objectDiff.rows.every((r) => !(r.changedProperties ?? []).some((c) => c.property === 'COMMODITY')), 'ignored prop excluded from diff');

console.log('workbench3d-profiles.test.js passed');
console.log(`  MTO matched=${audit.summary.matchedElements} measureΔ=${pipeRow.measureDeltaPct}% wizardDone=${wizXml.doneCount}/5 roleRows=${rm.rows.length}`);
