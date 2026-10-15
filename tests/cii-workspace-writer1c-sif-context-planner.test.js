import assert from 'node:assert/strict';
import {
  buildWriter1CSifPlan, CII_WRITER_1C_SIF_IN_PLANE_POLICY,
} from '../tabs/cii-workspace/cii-workspace-writer1c-sif.js';

const DELTA_AUTHORITY = 'CII_V11_SIF_TEE_ITEM3_ITEM4_EXACT_PHYSICAL_CUSTODY';
const CONTEXT_AUTHORITY = 'ENGINEER_ATTESTED_SAME_ACTIVE_PIPING_CODE';

function targetDocument() {
  const field = Object.freeze({
    qualified: true, item: 3, width: 13, byteStart: 100, byteEnd: 113,
    lineNumber: 20, start: 28, end: 41, fieldIdentity: 'SIF_TEE_IN_PLANE_II',
    rawField: '      1.25000', numericValue: 1.25,
  });
  const owner = Object.freeze({ parsedElementIndex: 0, blockIndex: 0, from: '10', to: '20', pointer: 1, slot: 1, item: 3, node: '100', type: 5 });
  return Object.freeze({
    sifWriter1CEvidence: Object.freeze({
      status: 'QUALIFIED', neutralVersion: Object.freeze({ major: 11 }),
      byParsedElementIndex: Object.freeze({
        0: Object.freeze({ parsedElementIndex: 0, blockIndex: 0, from: '10', to: '20', pointer: 1, bindingAuthority: 'EXACT_PARSED_INDEX_AND_ENDPOINTS' }),
      }),
      byPointer: Object.freeze({
        1: Object.freeze({ slots: Object.freeze({ 1: Object.freeze({ node: '100', type: 5, ii: field }) }) }),
      }),
      bySpan: Object.freeze({
        '100:113': Object.freeze({ ...field, owners: Object.freeze([owner]) }),
      }),
    }),
  });
}

function operation(sifContext) {
  return Object.freeze({
    operationId: 'SIF-CONTEXT-PLANNER', family: 'SIF_TEE', property: 'SIF/Tee slot 1 In-Plane SIF (ii)',
    action: 'COPY', status: 'PREVIEW_READY', scopeDecision: 'APPLY', policyAuthority: CII_WRITER_1C_SIF_IN_PLANE_POLICY,
    sourceEvidence: Object.freeze({ authority: DELTA_AUTHORITY }), before: 1.25, proposed: 1.75,
    matchAuthority: Object.freeze({ status: 'REVIEWED' }), sifContext,
    sifField: Object.freeze({
      slot: 1, item: 3, fieldKey: 'ii', sourceParsedElementIndex: 0, targetParsedElementIndex: 0,
      sourcePointer: 1, targetPointer: 1, sourceNode: '100', targetNode: '100', sourceType: 5, targetType: 5,
      nodeMappingQualified: true, sourceNeutralVersion: 11, targetNeutralVersion: 11,
    }),
  });
}

function plan(context) {
  return buildWriter1CSifPlan({
    targetDocument: targetDocument(),
    transferPlan: Object.freeze({ status: 'PREVIEW_READY', blockers: Object.freeze([]), operations: Object.freeze([operation(context)]), transferScope: Object.freeze({ status: 'BOUND' }) }),
  });
}

const valid = plan(Object.freeze({ status: 'QUALIFIED', authority: CONTEXT_AUTHORITY, sourceCode: 'ASME B31.3-2018', targetCode: ' asme  b31.3-2018 ' }));
assert.equal(valid.ready, true);

const forgedAuthority = plan(Object.freeze({ status: 'QUALIFIED', authority: 'CALLER_ASSERTED', sourceCode: 'ASME B31.3-2018', targetCode: 'ASME B31.3-2018' }));
assert.equal(forgedAuthority.ready, false);
assert(forgedAuthority.blockers.some((item) => item.startsWith('WRITER_1C_SIF_CODE_CONTEXT_AUTHORITY_REQUIRED')));

const mismatchedCode = plan(Object.freeze({ status: 'QUALIFIED', authority: CONTEXT_AUTHORITY, sourceCode: 'ASME B31.3-2018', targetCode: 'ASME B31.8-2018' }));
assert.equal(mismatchedCode.ready, false);
assert(mismatchedCode.blockers.some((item) => item.startsWith('WRITER_1C_SIF_CODE_CONTEXT_MISMATCH')));

const statusOnly = plan(Object.freeze({ status: 'QUALIFIED' }));
assert.equal(statusOnly.ready, false);
assert(statusOnly.blockers.some((item) => item.startsWith('WRITER_1C_SIF_CODE_CONTEXT_AUTHORITY_REQUIRED')));
assert(statusOnly.blockers.some((item) => item.startsWith('WRITER_1C_SIF_CODE_CONTEXT_VALUES_REQUIRED')));

console.log('Writer 1C SIF low-level planner independently validates piping-code context authority.');
