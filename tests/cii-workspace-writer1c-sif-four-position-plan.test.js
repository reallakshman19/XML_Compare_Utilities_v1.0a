import assert from 'node:assert/strict';
import {
  buildWriter1CSifPlan, CII_WRITER_1C_SIF_IN_PLANE_POLICY, CII_WRITER_1C_SIF_OUT_PLANE_POLICY,
} from '../tabs/cii-workspace/cii-workspace-writer1c-sif.js';

const DELTA_AUTHORITY = 'CII_V11_SIF_TEE_ITEM3_ITEM4_EXACT_PHYSICAL_CUSTODY';
const CONTEXT = Object.freeze({
  status: 'QUALIFIED', authority: 'ENGINEER_ATTESTED_SAME_ACTIVE_PIPING_CODE',
  sourceCode: 'ASME B31.3-2018', targetCode: 'ASME B31.3-2018',
});

const CASES = Object.freeze([
  Object.freeze({ slot: 1, item: 3, fieldKey: 'ii', policy: CII_WRITER_1C_SIF_IN_PLANE_POLICY, byteStart: 100, byteEnd: 113, before: 1.25 }),
  Object.freeze({ slot: 1, item: 4, fieldKey: 'io', policy: CII_WRITER_1C_SIF_OUT_PLANE_POLICY, byteStart: 113, byteEnd: 126, before: 1.50 }),
  Object.freeze({ slot: 2, item: 3, fieldKey: 'ii', policy: CII_WRITER_1C_SIF_IN_PLANE_POLICY, byteStart: 200, byteEnd: 213, before: 1.75 }),
  Object.freeze({ slot: 2, item: 4, fieldKey: 'io', policy: CII_WRITER_1C_SIF_OUT_PLANE_POLICY, byteStart: 213, byteEnd: 226, before: 2.00 }),
]);

function rawField(value) { return String(value.toFixed(5)).padStart(13, ' '); }
function field(spec) {
  return Object.freeze({
    qualified: true, item: spec.item, width: 13, byteStart: spec.byteStart, byteEnd: spec.byteEnd,
    lineNumber: spec.slot === 1 ? 20 : 25, start: spec.item === 3 ? 28 : 41, end: spec.item === 3 ? 41 : 54,
    fieldIdentity: spec.item === 3 ? 'SIF_TEE_IN_PLANE_II' : 'SIF_TEE_OUT_PLANE_IO',
    rawField: rawField(spec.before), numericValue: spec.before,
  });
}

function targetDocument() {
  const slot1ii = field(CASES[0]); const slot1io = field(CASES[1]); const slot2ii = field(CASES[2]); const slot2io = field(CASES[3]);
  const owner = (spec) => Object.freeze({ parsedElementIndex: 0, blockIndex: 0, from: '10', to: '20', pointer: 1, slot: spec.slot, item: spec.item, node: String(spec.slot === 1 ? 100 : 200), type: 5 });
  return Object.freeze({
    sifWriter1CEvidence: Object.freeze({
      status: 'QUALIFIED', neutralVersion: Object.freeze({ major: 11 }),
      byParsedElementIndex: Object.freeze({
        0: Object.freeze({ parsedElementIndex: 0, blockIndex: 0, from: '10', to: '20', pointer: 1, bindingAuthority: 'EXACT_PARSED_INDEX_AND_ENDPOINTS' }),
      }),
      byPointer: Object.freeze({
        1: Object.freeze({ slots: Object.freeze({
          1: Object.freeze({ node: '100', type: 5, ii: slot1ii, io: slot1io }),
          2: Object.freeze({ node: '200', type: 5, ii: slot2ii, io: slot2io }),
        }) }),
      }),
      bySpan: Object.freeze(Object.fromEntries(CASES.map((spec, index) => {
        const f = [slot1ii, slot1io, slot2ii, slot2io][index];
        return [`${spec.byteStart}:${spec.byteEnd}`, Object.freeze({ ...f, owners: Object.freeze([owner(spec)]) })];
      }))),
    }),
  });
}

function operation(spec) {
  const node = String(spec.slot === 1 ? 100 : 200);
  return Object.freeze({
    operationId: `SIF-S${spec.slot}-I${spec.item}`, family: 'SIF_TEE',
    property: `SIF/Tee slot ${spec.slot} ${spec.item === 3 ? 'In-Plane SIF (ii)' : 'Out-Plane SIF (io)'}`,
    action: 'COPY', status: 'PREVIEW_READY', scopeDecision: 'APPLY', policyAuthority: spec.policy,
    sourceEvidence: Object.freeze({ authority: DELTA_AUTHORITY }), before: spec.before, proposed: spec.before + 0.25,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }), sifContext: CONTEXT,
    sifField: Object.freeze({
      slot: spec.slot, item: spec.item, fieldKey: spec.fieldKey,
      sourceParsedElementIndex: 0, targetParsedElementIndex: 0, sourcePointer: 1, targetPointer: 1,
      sourceNode: node, targetNode: node, sourceType: 5, targetType: 5,
      nodeMappingQualified: true, sourceNeutralVersion: 11, targetNeutralVersion: 11,
    }),
  });
}

const document = targetDocument();
for (const spec of CASES) {
  const op = operation(spec);
  const transferPlan = Object.freeze({
    status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze([op]), transferScope: Object.freeze({ status: 'BOUND' }),
  });
  const plan = buildWriter1CSifPlan({ transferPlan, targetDocument: document });
  assert.equal(plan.ready, true, `slot ${spec.slot} item ${spec.item} should qualify`);
  assert.equal(plan.mutationCount, 1);
  assert.equal(plan.mutations[0].byteStart, spec.byteStart);
  assert.equal(plan.mutations[0].byteEnd, spec.byteEnd);
  assert.equal(plan.mutations[0].slot, spec.slot);
  assert.equal(plan.mutations[0].item, spec.item);
  assert.equal(plan.mutations[0].fieldKey, spec.fieldKey);
}

console.log('All four Version-11 Writer 1C SIF positions produce the expected exact mutation span.');
