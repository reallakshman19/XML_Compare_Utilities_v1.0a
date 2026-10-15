import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPsFamilyNativeAuditPipeline } from '../tabs/ps-family-clash-audit/ps-family-native-audit-pipeline.js';
import { createPsFamilyNativePipelineExports } from '../tabs/ps-family-clash-audit/ps-family-native-audit-pipeline-export.js';

const SUPPORT_SOURCE = {
  objects: [{
    type: 'BRANCH',
    attributes: { NAME: '/LINE-600/B1', FULL_LINE_TAG: 'LINE-600' },
    children: [
      {
        type: 'PIPE',
        attributes: {
          NAME: '/PIPE-600-A', CARRIER_ID: '/PIPE-600-A',
          AXIS_START: '0 0 0', AXIS_END: '100 0 0', OUTSIDE_DIAMETER: 100,
        },
        children: [{
          type: 'ATTA',
          attributes: {
            NAME: '/PS-960.1', POS: '50 55 0',
            BOUNDS: '40 50 -10 60 60 10', STEEL_REF: '/SL-960',
          },
        }],
      },
      {
        type: 'ELBOW',
        attributes: { NAME: '/ELBOW-600', APOS: '100 0 0', LPOS: '100 100 0' },
      },
    ],
  }],
};

const STEEL_SOURCE = {
  objects: [{
    type: 'GROUP',
    attributes: { NAME: '/SL-960', CLASS: 'STRUCTURAL STEEL' },
    children: [{
      type: 'SCTN',
      attributes: {
        NAME: '/SL-960/BEAM-01',
        AXIS_START: '0 50 0', AXIS_END: '100 50 0',
      },
    }],
  }],
};

test('native pipeline proves a complete carrier-to-structure analytical path', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({
    supportInput: SUPPORT_SOURCE,
    steelInput: STEEL_SOURCE,
  });
  assert.equal(pipeline.outputSchemas.carrierToStructurePath, 'SupportCarrierToStructurePathBundle.v1');
  assert.equal(pipeline.summary.carrierTopologyConnectionCount, 1);
  assert.equal(pipeline.summary.carrierAttachmentCandidateCount, 1);
  assert.equal(pipeline.summary.structuralTerminalCount, 1);
  assert.equal(pipeline.summary.completeCarrierToStructurePathCount, 1);
  assert.equal(pipeline.summary.completeCarrierToStructureFamilyCount, 1);
  assert.equal(pipeline.summary.incompleteCarrierToStructureFamilyCount, 0);
  assert.equal(pipeline.summary.carrierToStructurePathExceptionCount, 0);
  assert.equal(pipeline.audit.carrierToStructureCompletePathRows.length, 1);
  assert.equal(pipeline.audit.carrierToStructurePathExceptionRows.length, 0);
  const path = pipeline.audit.carrierToStructureCompletePathRows[0];
  assert.equal(path.pathStatus, 'COMPLETE_CARRIER_TO_STRUCTURE_PATH');
  assert.equal(path.carrierObjectId, '/PIPE-600-A');
  assert.equal(path.attachmentSupportMemberId, '/PS-960.1');
  assert.equal(path.structuralTerminalMemberId, '/PS-960.1');
  assert.equal(path.steelGroupId, '/SL-960');
  assert.deepEqual(path.supportChainEdgeIds, []);
  assert.equal(path.contactEvidenceStatus, 'ANALYTICAL_PATH_CANDIDATE');
});

test('native exports preserve complete paths and family status', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({
    supportInput: SUPPORT_SOURCE,
    steelInput: STEEL_SOURCE,
  });
  const exports = createPsFamilyNativePipelineExports(pipeline);
  assert.match(exports.summaryCsv, /CompleteCarrierToStructurePathCount/);
  assert.match(exports.carrierToStructureCompletePathsCsv, /COMPLETE_CARRIER_TO_STRUCTURE_PATH/);
  assert.match(exports.carrierToStructureCompletePathsCsv, /PIPE-600-A/);
  assert.match(exports.carrierToStructureFamiliesCsv, /PS-960/);
  assert.match(exports.carrierToStructureFamiliesCsv, /COMPLETE/);
  assert.match(exports.carrierToStructurePathExceptionsCsv, /ExceptionId,ExceptionCode/);
});

test('a carrier without connected topology remains an incomplete path', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({
    supportInput: {
      objects: [{
        type: 'BRANCH', attributes: { NAME: '/LINE-601/B1' }, children: [{
          type: 'PIPE',
          attributes: {
            NAME: '/PIPE-601', CARRIER_ID: '/PIPE-601',
            AXIS_START: '0 0 0', AXIS_END: '100 0 0', OUTSIDE_DIAMETER: 100,
          },
          children: [{
            type: 'ATTA',
            attributes: {
              NAME: '/PS-961.1', POS: '50 55 0',
              BOUNDS: '40 50 -10 60 60 10', STEEL_REF: '/SL-960',
            },
          }],
        }],
      }],
    },
    steelInput: STEEL_SOURCE,
  });
  assert.equal(pipeline.summary.completeCarrierToStructurePathCount, 0);
  assert.ok(pipeline.audit.carrierToStructurePathExceptionRows.some(
    (row) => row.exceptionCode === 'CARRIER_TOPOLOGY_PATH_REVIEW_REQUIRED',
  ));
  assert.ok(pipeline.diagnostics.some(
    (row) => row.code === 'CARRIER_TO_STRUCTURE_PATH_EXCEPTIONS_REMAIN',
  ));
});
