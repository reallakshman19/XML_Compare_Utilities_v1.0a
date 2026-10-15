import assert from 'node:assert/strict';
import { decodeCiiNumericRow } from '../parser/fixed-field.js';
import { createCiiPhysicalFile, ciiPhysicalSectionRows } from '../tabs/cii-workspace/cii-workspace-physical-file.js';
import { extractCiiWriter1CSifEvidence } from '../tabs/cii-workspace/cii-workspace-writer1c-sif-custody.js';
import { applyCiiTargetWriterComposite, ciiWriterCompositeReadiness } from '../tabs/cii-workspace/cii-workspace-target-writer-composite.js';
import { CII_WRITER_1C_SIF_IN_PLANE_POLICY } from '../tabs/cii-workspace/cii-workspace-writer1c-sif.js';

const WIDTHS = [15, 13, 13, 13, 13, 13];
const DELTA_AUTHORITY = 'CII_V11_SIF_TEE_ITEM3_ITEM4_EXACT_PHYSICAL_CUSTODY';
const CONTEXT_AUTHORITY = 'ENGINEER_ATTESTED_SAME_ACTIVE_PIPING_CODE';
function row(values) { return values.map((value, index) => String(value ?? '').padStart(WIDTHS[index], ' ')).join(''); }
function elementBlock() {
  const rows = Array.from({ length: 15 }, () => row([0, 0, 0, 0, 0, 0]));
  rows[0] = row([10, 20, 0, 0, 1000, 273]);
  rows[3] = row([0, 0, 100, 0, 0, 0]);
  rows[13] = row([0, 0, 0, 0, 1, 0]);
  return rows;
}
function sifBlock() {
  const rows = Array.from({ length: 10 }, () => row([0, 0, 0, 0, 0, 0]));
  rows[0] = row([100, 5, 1.25, 1.50, 0, 0]);
  rows[5] = row([200, 5, 1.75, 2.00, 0, 0]);
  return rows;
}
function rawFile() {
  return [
    '#$ VERSION', row([5, 11, 1256, 0, 0, 0]),
    '#$ CONTROL', row([1, 0, 0, 0, 0, 0]), row([0, 0, 0, 0, 0, 0]), row([0, 0, 0, 0, 1, 0]), row([0, 0, 0, 0, 0, 0]),
    '#$ ELEMENTS', ...elementBlock(), '#$ SIF&TEES', ...sifBlock(),
  ].join('\r\n');
}
const parsed = Object.freeze({ nodes: Object.freeze({ 10: {}, 20: {} }), elements: Object.freeze([Object.freeze({ index: 0, from: 10, to: 20 })]) });
const bytes = new TextEncoder().encode(rawFile()); const physicalFile = createCiiPhysicalFile(bytes);
const sifEvidence = extractCiiWriter1CSifEvidence(physicalFile.text, parsed, { physicalFile });
const targetDocument = Object.freeze({
  physicalFile, writer1CByteEligible: physicalFile.writer1CByteEligible, sifWriter1CEvidence: sifEvidence,
  parsed, nodeNames: Object.freeze({}), auxiliaryEvidence: Object.freeze({}), hangerEvidence: Object.freeze({}),
});
const targetGraph = Object.freeze({ edges: Object.freeze([Object.freeze({ elementId: 'E1', parsedElementIndex: 0, from: 10, to: 20 })]) });
const correspondence = Object.freeze({ elementRows: Object.freeze([Object.freeze({ correspondenceId: 'C1', targetElementId: 'E1' })]) });
const slot = sifEvidence.byPointer['1'].slots[1];
const lower = Object.freeze({
  operationId: 'LOWER-P3', family: 'PROCESS', property: 'P3', action: 'COPY', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
  policyAuthority: 'CII_WRITER_1B_CARDINALITY_PRESERVING_ELEMENT_FIELD',
  before: 100, proposed: 200, matchAuthority: Object.freeze({ status: 'REVIEWED', correspondenceId: 'C1' }),
});
const sif = Object.freeze({
  operationId: 'SIF-II', family: 'SIF_TEE', property: 'SIF/Tee slot 1 In-Plane SIF (ii)', action: 'COPY', status: 'PREVIEW_READY', scopeDecision: 'APPLY',
  policyAuthority: CII_WRITER_1C_SIF_IN_PLANE_POLICY,
  sourceEvidence: Object.freeze({ authority: DELTA_AUTHORITY }), before: 1.25, proposed: 1.75,
  matchAuthority: Object.freeze({ status: 'REVIEWED', correspondenceId: 'C1' }),
  sifContext: Object.freeze({ status: 'QUALIFIED', authority: CONTEXT_AUTHORITY, sourceCode: 'ASME B31.3-2018', targetCode: 'ASME B31.3-2018' }),
  sifField: Object.freeze({
    slot: 1, item: 3, fieldKey: 'ii', sourceParsedElementIndex: 0, targetParsedElementIndex: 0,
    sourcePointer: 1, targetPointer: 1, sourceNode: slot.node, targetNode: slot.node, sourceType: slot.type, targetType: slot.type,
    nodeMappingQualified: true, sourceNeutralVersion: 11, targetNeutralVersion: 11,
  }),
});
const transferPlan = Object.freeze({
  status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze([lower, sif]), transferScope: Object.freeze({ status: 'BOUND' }),
});
const readiness = ciiWriterCompositeReadiness(transferPlan, targetDocument);
assert.equal(readiness.ready, true);
assert.deepEqual(readiness.familyOperationCounts, { writer1A: 0, writer1B: 1, writer1C: 1 });
const result = applyCiiTargetWriterComposite({ targetDocument, targetGraph, correspondence, transferPlan });
assert.equal(result.mutationCount, 2);
assert.equal(result.familyCounts.writer1A, 0);
assert.equal(result.familyCounts.writer1B, 1);
assert.equal(result.familyCounts.writer1C, 1);
assert(result.components.lower);
assert(result.components.writer1C);

const afterPhysical = createCiiPhysicalFile(result.bytes);
const elementRows = ciiPhysicalSectionRows(afterPhysical, 'ELEMENTS');
assert.equal(Number(decodeCiiNumericRow(elementRows[3].text)[2]), 200);
const afterSif = extractCiiWriter1CSifEvidence(afterPhysical.text, parsed, { physicalFile: afterPhysical });
assert.equal(afterSif.status, 'QUALIFIED');
assert.equal(afterSif.byPointer['1'].slots[1].ii.numericValue, 1.75);
assert.equal(afterPhysical.byteLength, physicalFile.byteLength);
assert.deepEqual(afterPhysical.lineEndings.sequence, physicalFile.lineEndings.sequence);

const unqualifiedLowerPlan = Object.freeze({ ...transferPlan, operations: Object.freeze([{ ...lower, policyAuthority: 'UNQUALIFIED' }, sif]) });
const unqualifiedReadiness = ciiWriterCompositeReadiness(unqualifiedLowerPlan, targetDocument);
assert.equal(unqualifiedReadiness.ready, false);
assert(unqualifiedReadiness.blockers.some((item) => item.startsWith('WRITER_COMPOSITE_LOWER_POLICY_AUTHORITY_REQUIRED')));

console.log('Mixed Writer 1B + Writer 1C transaction patches one original byte vector with explicit lower authority.');
