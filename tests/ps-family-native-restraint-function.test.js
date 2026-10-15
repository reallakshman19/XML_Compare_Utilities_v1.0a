import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPsFamilyNativeAuditPipeline } from '../tabs/ps-family-clash-audit/ps-family-native-combined-input.js';
import { createPsFamilyNativePipelineExports } from '../tabs/ps-family-clash-audit/ps-family-native-audit-pipeline-export.js';

const COMBINED_MODEL = {
  objects: [
    {
      type: 'BRANCH',
      attributes: { NAME: '/LINE-700/B1', FULL_LINE_TAG: 'LINE-700' },
      children: [
        {
          type: 'PIPE',
          attributes: {
            NAME: '/PIPE-700-A', CARRIER_ID: '/PIPE-700-A',
            AXIS_START: '0 0 0', AXIS_END: '100 0 0', OUTSIDE_DIAMETER: 100,
          },
          children: [{
            type: 'ATTA',
            attributes: {
              NAME: '/PS-970.1', POS: '50 0 -55',
              BOUNDS: '40 -10 -60 60 10 -50',
              STEEL_REF: '/SL-970', CMPSUPTYPE: 'REST', DTXR: 'PIPE SHOE REST',
            },
          }],
        },
        {
          type: 'ELBOW',
          attributes: { NAME: '/ELBOW-700', APOS: '100 0 0', LPOS: '100 100 0' },
        },
      ],
    },
    {
      type: 'GROUP',
      attributes: { NAME: '/SL-970', CLASS: 'STRUCTURAL STEEL' },
      children: [{
        type: 'SCTN',
        attributes: {
          NAME: '/SL-970/BEAM-01',
          AXIS_START: '0 0 -60', AXIS_END: '100 0 -60',
          BOUNDS: '0 -20 -70 100 20 -50',
        },
      }],
    },
  ],
};

test('one combined model proves a REST function candidate through the graph audit', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({ combinedInput: COMBINED_MODEL });
  assert.equal(pipeline.inputMode, 'COMBINED_STAGED_MODEL');
  assert.equal(pipeline.outputSchemas.carrierLocalFrame, 'SupportCarrierLocalFrame.v1');
  assert.equal(pipeline.outputSchemas.restraintFunction, 'SupportRestraintFunctionBundle.v1');
  assert.equal(pipeline.summary.completeCarrierToStructurePathCount, 1);
  assert.equal(pipeline.summary.restraintFunctionConfirmedFamilyCount, 1);
  assert.equal(pipeline.summary.restraintFunctionExceptionCount, 0);
  assert.equal(pipeline.audit.carrierFrameRows.length, 1);
  assert.equal(pipeline.audit.restraintFunctionAssessmentRows.length, 2);
  const rest = pipeline.audit.restraintFunctionAssessmentRows.find((row) => row.supportFunction === 'REST');
  assert.equal(rest.functionStatus, 'FUNCTION_CONFIRMED');
  assert.deepEqual(rest.requiredDirections, ['-VERTICAL']);
  assert.ok(rest.evidencedDirections.includes('-VERTICAL'));
  assert.ok(pipeline.audit.restraintDirectionEdgeRows.some((row) => row.movementDirection === '-VERTICAL'));
  assert.equal(pipeline.xmlRequired, false);
  assert.equal(pipeline.xmlConsumed, false);
});

test('native exports preserve frames, assessments, directions and exceptions', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({ combinedInput: COMBINED_MODEL });
  const exports = createPsFamilyNativePipelineExports(pipeline);
  assert.match(exports.summaryCsv, /RestraintFunctionAssessmentCount/);
  assert.match(exports.carrierFramesCsv, /CarrierObjectId,FrameStatus/);
  assert.match(exports.restraintFunctionAssessmentsCsv, /SupportFunction,FunctionStatus/);
  assert.match(exports.restraintFunctionAssessmentsCsv, /FUNCTION_CONFIRMED/);
  assert.match(exports.restraintDirectionEdgesCsv, /MovementDirection/);
  assert.match(exports.restraintDirectionEdgesCsv, /-VERTICAL/);
  assert.match(exports.restraintFunctionExceptionsCsv, /ExceptionId,ExceptionCode/);
  assert.match(exports.restraintFunctionFamiliesCsv, /SupportFamilyId,FunctionStatus/);
});
