import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPsFamilyNativeAuditPipeline } from '../tabs/ps-family-clash-audit/ps-family-native-audit-pipeline.js';
import { createPsFamilyNativePipelineExports } from '../tabs/ps-family-clash-audit/ps-family-native-audit-pipeline-export.js';

const SUPPORT_SOURCE = {
  objects: [{
    type: 'BRANCH',
    attributes: { NAME: '/LINE-300/B3' },
    children: [{
      type: 'PIPE',
      attributes: {
        NAME: '/PIPE-300',
        CARRIER_ID: '/PIPE-300',
        POS: 'E 0 N 0 U 0',
        AXIS_START: 'E -100 N 0 U 0',
        AXIS_END: 'E 100 N 0 U 0',
        OUTSIDE_DIAMETER: '100',
      },
      children: [{
        type: 'ATTA',
        attributes: {
          NAME: '/PS-930.1',
          POS: 'E 0 N 55 U 0',
          BOUNDS: '-10 50 -10 10 60 10',
          STEEL_REF: '/SL-930',
        },
      }],
    }],
  }],
};

const STEEL_SOURCE = {
  objects: [{
    type: 'GROUP',
    attributes: { NAME: '/SL-930', CLASS: 'STRUCTURAL STEEL' },
    children: [{
      type: 'SCTN',
      attributes: {
        NAME: '/SL-930/BEAM-01',
        AXIS_START: 'E -100 N 0 U 0',
        AXIS_END: 'E 100 N 0 U 0',
      },
    }],
  }],
};

test('native pipeline carries authoritative carrier catalog and analytical attachment into audit', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({
    supportInput: SUPPORT_SOURCE,
    steelInput: STEEL_SOURCE,
  });
  assert.equal(pipeline.xmlRequired, false);
  assert.equal(pipeline.xmlConsumed, false);
  assert.equal(pipeline.outputSchemas.carrierResolution, 'SupportCarrierResolution.v1');
  assert.equal(pipeline.outputSchemas.carrierCatalog, 'SupportCarrierCatalog.v1');
  assert.equal(pipeline.outputSchemas.carrierAttachment, 'SupportCarrierAttachmentBundle.v1');
  assert.equal(pipeline.summary.carrierObjectCount, 1);
  assert.equal(pipeline.summary.resolvedPhysicalCarrierCount, 1);
  assert.equal(pipeline.summary.analyticalCarrierGeometryCount, 1);
  assert.equal(pipeline.summary.carrierAttachmentCandidateCount, 1);
  assert.equal(pipeline.relationshipBundle.supportCarrierResolution.supportCarrierEdges.length, 1);
  assert.equal(pipeline.relationshipBundle.supportCarrierAttachment.supportCarrierAttachmentEdges.length, 1);
  assert.equal(pipeline.audit.carrierObjectRows.length, 1);
  assert.equal(pipeline.audit.carrierResolutionRows.length, 1);
  assert.equal(pipeline.audit.supportCarrierEdgeRows.length, 1);
  assert.equal(pipeline.audit.carrierAttachmentEvaluationRows.length, 1);
  assert.equal(pipeline.audit.carrierAttachmentRows.length, 1);
  assert.equal(pipeline.audit.summary.carrierObjectCount, 1);
  assert.equal(pipeline.audit.summary.resolvedCarrierEdgeCount, 1);
  assert.equal(pipeline.audit.summary.carrierAttachmentCandidateCount, 1);
  const resolution = pipeline.audit.carrierResolutionRows[0];
  assert.equal(resolution.supportMemberId, '/PS-930.1');
  assert.equal(resolution.carrierObjectId, '/PIPE-300');
  assert.equal(resolution.resolutionStatus, 'RESOLVED_HIERARCHY_CARRIER');
  assert.equal(resolution.contactEvidenceStatus, 'NOT_PROVEN');
  const evaluation = pipeline.audit.carrierAttachmentEvaluationRows[0];
  assert.equal(evaluation.attachmentStatus, 'ANALYTICAL_CARRIER_CONTACT_CANDIDATE');
  assert.equal(evaluation.contactEvidenceStatus, 'ANALYTICAL_CONTACT_CANDIDATE');
  assert.equal(evaluation.distanceMm, 0);
  const attachmentEdge = pipeline.audit.carrierAttachmentRows[0];
  assert.equal(attachmentEdge.edgeType, 'SUPPORT_MEMBER_TO_CARRIER_ATTACHMENT');
  assert.equal(attachmentEdge.relationshipStatus, 'ANALYTICAL_CARRIER_CONTACT_CANDIDATE');
});

test('native pipeline exports carrier identity and attachment evidence separately', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({
    supportInput: SUPPORT_SOURCE,
    steelInput: STEEL_SOURCE,
  });
  const exports = createPsFamilyNativePipelineExports(pipeline);
  assert.match(exports.summaryCsv, /CarrierObjectCount,ResolvedPhysicalCarrierCount/);
  assert.match(exports.summaryCsv, /CarrierAttachmentCandidateCount/);
  assert.match(exports.carrierCatalogCsv, /CarrierObjectId,CarrierObjectClass/);
  assert.match(exports.carrierCatalogCsv, /PIPE-300/);
  assert.match(exports.carrierResolutionCsv, /ResolutionStatus,CarrierObjectId/);
  assert.match(exports.carrierResolutionCsv, /RESOLVED_HIERARCHY_CARRIER/);
  assert.match(exports.supportCarrierEdgesCsv, /SUPPORT_MEMBER_TO_CARRIER/);
  assert.match(exports.supportCarrierEdgesCsv, /SSCR-EDGE/);
  assert.match(exports.carrierAttachmentCsv, /ANALYTICAL_CARRIER_CONTACT_CANDIDATE/);
  assert.match(exports.carrierAttachmentEdgesCsv, /SUPPORT_MEMBER_TO_CARRIER_ATTACHMENT/);
  assert.match(exports.carrierAttachmentEdgesCsv, /ANALYTICAL_CONTACT_CANDIDATE/);
});

test('branch-only carrier context stays non-physical through the audit boundary', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({
    supportInput: {
      objects: [{
        type: 'BRANCH',
        attributes: { NAME: '/LINE-301/B1' },
        children: [{
          type: 'ATTA',
          attributes: { NAME: '/PS-931.1', POS: 'E 0 N 0 U 0', STEEL_REF: '/SL-930' },
        }],
      }],
    },
    steelInput: STEEL_SOURCE,
  });
  assert.equal(pipeline.summary.carrierObjectCount, 0);
  assert.equal(pipeline.summary.resolvedPhysicalCarrierCount, 0);
  assert.equal(pipeline.summary.branchContextOnlyCount, 1);
  assert.equal(pipeline.summary.carrierAttachmentCandidateCount, 0);
  assert.equal(pipeline.audit.supportCarrierEdgeRows.length, 0);
  assert.equal(pipeline.audit.branchContextEdgeRows.length, 1);
  assert.equal(pipeline.audit.carrierAttachmentRows.length, 0);
  assert.equal(
    pipeline.audit.carrierResolutionRows[0].resolutionStatus,
    'BRANCH_CONTEXT_ONLY',
  );
});
