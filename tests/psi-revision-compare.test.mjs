// PSI PipeStressExport → staged JSON → basis/derived compare → transfer →
// apply-to-PSI pipeline test. Two synthetic revisions share ComponentRefNos
// and a support tag but are renumbered and translated (reroute), so spatial
// matching alone cannot pair them — identity basis must.
import assert from 'node:assert/strict';

import { convertPsiXmlToStaged, isPsiPipeStressXml } from '../workbench3d/adapters/psi-staged-adapter.js';
import { buildComponentTopologyArtifacts } from '../vendor/3d-converters/topology-browser-core.mjs';
import { annotateTopology, extractBasisPairs } from '../workbench3d/compare/topology-identity.js';
import { runCompare } from '../workbench3d/compare/compare-engine.js';
import { buildTransferPlan, batchApprove } from '../workbench3d/compare/transfer-planner.js';
import { applyTransferPlanToPsi } from '../workbench3d/apply/psi-transfer-apply.js';
import { buildConnectorModel, validateConnectorModel } from '../workbench3d/viewer/connector-model.js';
import { CONNECTOR_TYPES } from '../workbench3d/contracts/contracts.js';

const node = ({ num, name = '', ep, type, ref, pos, extra = '' }) => `<Node>
<NodeNumber>${num}</NodeNumber><NodeName>${name}</NodeName><Endpoint>${ep}</Endpoint>
<ComponentType>${type}</ComponentType><ComponentRefNo>${ref}</ComponentRefNo>
<OutsideDiameter>219.1</OutsideDiameter><WallThickness>15</WallThickness>
<Position>${pos}</Position><BendRadius>0</BendRadius><SIF>0</SIF>${extra}</Node>`;

// OLD: enriched (PipingClass etc), origin at 0. NEW: renumbered +1000,
// translated +5000 in X, no enrichment, one extra flange.
const psi = ({ shift, offset, enrich, extraFlange }) => {
  const p = (x) => `${x + offset}.00 0.00 100.00`;
  const enrichTags = enrich ? '<PipingClass>01</PipingClass><Rating>150</Rating><BoreMm>200.000</BoreMm><MaterialCode>106</MaterialCode>' : '';
  const restr = '<Restraint><Type>+Y</Type><Stiffness>0</Stiffness><Gap>0</Gap><Friction>0.3</Friction></Restraint>';
  return `<?xml version="1.0" encoding="utf-8"?>
<PipeStressExport xmlns="http://aveva.com/pipeStress116.xsd">
<Units><DistanceUnits>mm</DistanceUnits></Units>
<Pipe><FullName>/PL-T</FullName>
<Branch><Branchname>/PL-T/B1</Branchname>
${node({ num: -1, ep: 1, type: 'BRAN', ref: '=1/1', pos: p(0) })}
${node({ num: 10 + shift, ep: 1, type: 'FLAN', ref: '=1/100', pos: p(0), extra: enrichTags })}
${node({ num: 20 + shift, ep: 2, type: 'FLAN', ref: '=1/100', pos: p(80), extra: enrichTags })}
${node({ num: 30 + shift, ep: 1, type: 'ELBO', ref: '=1/200', pos: p(2000), extra: enrichTags })}
${node({ num: 40 + shift, ep: 2, type: 'ELBO', ref: '=1/200', pos: p(2400), extra: enrichTags })}
${node({ num: 50 + shift, name: 'PS-TEST.1', ep: 0, type: 'ANCI', ref: '=1/300', pos: p(1000), extra: (enrich ? enrichTags : '') + restr })}
${extraFlange ? node({ num: 60 + shift, ep: 1, type: 'FLAN', ref: '=1/400', pos: p(3000) }) + node({ num: 70 + shift, ep: 2, type: 'FLAN', ref: '=1/400', pos: p(3080) }) : ''}
${node({ num: -1, ep: 2, type: 'BRAN', ref: '=1/1', pos: p(extraFlange ? 3080 : 2400) })}
</Branch></Pipe></PipeStressExport>`;
};

const oldXml = psi({ shift: 0, offset: 0, enrich: true, extraFlange: false });
const newXml = psi({ shift: 1000, offset: 5000, enrich: false, extraFlange: true });

assert.equal(isPsiPipeStressXml(oldXml), true);
assert.equal(isPsiPipeStressXml('{"schema":"x"}'), false);

const stagedA = convertPsiXmlToStaged(oldXml, 'old.xml');
const stagedB = convertPsiXmlToStaged(newXml, 'new.xml');
assert.equal(stagedA.schema, 'inputxml-managed-stage/v1');
assert.equal(stagedA.objects.length, 1);
const typesA = stagedA.objects[0].children.map((c) => c.type);
assert.ok(typesA.includes('FLAN') && typesA.includes('ELBO') && typesA.includes('SUPPORT'), `types: ${typesA}`);
assert.ok(typesA.includes('PIPE'), 'implicit tube synthesized between components');

const topoA = annotateTopology(
  (await buildComponentTopologyArtifacts(JSON.stringify(stagedA), { sourceName: 'baseline', toleranceMm: 6 })).canonicalTopology,
  stagedA, 'source');
const topoB = annotateTopology(
  (await buildComponentTopologyArtifacts(JSON.stringify(stagedB), { sourceName: 'candidate', toleranceMm: 6 })).canonicalTopology,
  stagedB, 'target');

assert.ok(topoA.edges.every((e) => e.id.startsWith('source:')), 'source ids prefixed');
assert.ok(topoB.edges.every((e) => e.id.startsWith('target:')), 'target ids prefixed');
assert.ok(topoA.edges.some((e) => e.ref === '=1/100'), 'edges carry ComponentRefNo');
assert.ok(topoA.edges.some((e) => Object.keys(e.properties).includes('PIPINGCLASS')), 'edges carry property block');

const basis = extractBasisPairs(topoA, topoB);
assert.ok(basis.length >= 2, `expected ref-basis pairs, got ${basis.length}`);

const audit = runCompare(topoA, topoB, {}, []);
assert.ok(audit.summary.basisElements >= 2, 'basis matches recorded despite 5m translation');
assert.ok(audit.summary.matchedElements >= audit.summary.basisElements, 'derived adds to basis');
const basisRow = audit.objectDiff.rows.find((r) => r.basis);
assert.equal(basisRow.confidence, 'HIGH', 'basis rows carry highest confidence');
assert.ok(basisRow.reasons[0], 'basis rows explain their identity evidence');
const changed = audit.objectDiff.rows.flatMap((r) => r.changedProperties ?? []);
assert.ok(changed.some((c) => c.property === 'PIPINGCLASS'), 'field compare flags enrichment gap');

// Connector model: basis connectors are their own class.
const visualOf = (topo) => ({ segments: topo.edges.map((e) => ({ objectId: e.id, start: [0, 0, 0], end: [1, 1, 1] })), markers: [] });
const graphOf = (topo) => ({ nodes: topo.nodes.map((n) => ({ nodeId: n.id, coordMm: [n.position.x, n.position.y, n.position.z] })) });
const plan = buildTransferPlan(audit, topoA, topoB, { rule: 'FILL_BLANK_ONLY', minConfidence: 'HIGH' });
batchApprove(plan, 'HIGH');
const model = buildConnectorModel({
  compareAudit: audit, transferPlan: plan,
  sourceVisual: visualOf(topoA), targetVisual: visualOf(topoB),
  sourceGraph: graphOf(topoA), targetGraph: graphOf(topoB),
});
assert.deepEqual(validateConnectorModel(model, { compareAudit: audit, transferPlan: plan }), []);
assert.ok(model.connectors.some((c) => c.type === CONNECTOR_TYPES.BASIS_CONNECTOR), 'basis connectors emitted');
assert.ok(model.connectors.some((c) => c.type === CONNECTOR_TYPES.REGISTRATION_ANCHOR_CONNECTOR), 'support-tag anchor emitted');

// Apply approved rows to the NEW xml: enrichment must land on renumbered nodes.
assert.ok(plan.summary.approvedRows > 0, 'plan has approved rows');
const applied = applyTransferPlanToPsi(newXml, plan, topoB);
assert.ok(applied.applied > 0, 'rows applied');
assert.match(applied.xmlText, /<NodeNumber>1010<\/NodeNumber>[\s\S]*?<PipingClass>01<\/PipingClass>/, 'PipingClass written to renumbered node');
const roundTrip = convertPsiXmlToStaged(applied.xmlText, 'roundtrip.xml');
assert.equal(roundTrip.objects.length, 1, 'applied XML still parses as PSI');

console.log(`psi-revision-compare.test.mjs passed — basis=${audit.summary.basisElements} matched=${audit.summary.matchedElements} applied=${applied.applied}`);
