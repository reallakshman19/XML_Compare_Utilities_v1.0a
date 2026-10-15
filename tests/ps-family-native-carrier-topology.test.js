import assert from 'node:assert/strict';
import test from 'node:test';
import { buildPsFamilyNativeAuditPipeline } from '../tabs/ps-family-clash-audit/ps-family-native-audit-pipeline.js';
import { createPsFamilyNativePipelineExports } from '../tabs/ps-family-clash-audit/ps-family-native-audit-pipeline-export.js';

const SUPPORT_SOURCE = {
  objects: [{
    type: 'BRANCH',
    attributes: { NAME: '/LINE-500/B1', FULL_LINE_TAG: 'LINE-500' },
    children: [
      {
        type: 'PIPE',
        attributes: {
          NAME: '/PIPE-500-A', CARRIER_ID: '/PIPE-500-A',
          AXIS_START: '0 0 0', AXIS_END: '100 0 0', OUTSIDE_DIAMETER: 100,
        },
        children: [{
          type: 'ATTA',
          attributes: {
            NAME: '/PS-950.1', POS: '50 55 0', BOUNDS: '40 50 -10 60 60 10',
            STEEL_REF: '/SL-950',
          },
        }],
      },
      {
        type: 'ELBOW',
        attributes: { NAME: '/ELBOW-500', APOS: '100 0 0', LPOS: '100 100 0', BORE: 100 },
      },
      {
        type: 'PIPE',
        attributes: { NAME: '/PIPE-500-B', AXIS_START: '100 100 0', AXIS_END: '200 100 0', BORE: 100 },
      },
    ],
  }],
};

const STEEL_SOURCE = {
  objects: [{
    type: 'GROUP',
    attributes: { NAME: '/SL-950', CLASS: 'STRUCTURAL STEEL' },
    children: [{
      type: 'SCTN',
      attributes: { NAME: '/SL-950/BEAM', AXIS_START: '0 50 0', AXIS_END: '100 50 0' },
    }],
  }],
};

test('native pipeline exposes fail-closed carrier topology through the audit', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({
    supportInput: SUPPORT_SOURCE,
    steelInput: STEEL_SOURCE,
  });
  assert.equal(pipeline.outputSchemas.carrierTopologyCatalog, 'SupportCarrierTopologyCatalog.v1');
  assert.equal(pipeline.outputSchemas.carrierTopology, 'SupportCarrierTopologyBundle.v1');
  assert.equal(pipeline.summary.carrierTopologyComponentCount, 3);
  assert.equal(pipeline.summary.carrierTopologyConnectionCount, 2);
  assert.equal(pipeline.summary.carrierTopologyPathCount, 1);
  assert.equal(pipeline.summary.carrierTopologyRepairCount, 0);
  assert.equal(pipeline.summary.carrierTopologyExceptionCount, 0);
  assert.equal(pipeline.audit.carrierTopologyComponentRows.length, 3);
  assert.equal(pipeline.audit.carrierTopologyConnectionRows.length, 2);
  assert.equal(pipeline.audit.carrierTopologyPathRows.length, 1);
  assert.equal(pipeline.audit.carrierTopologyExceptionRows.length, 0);
  assert.deepEqual(
    pipeline.audit.carrierTopologyPathRows[0].componentIds,
    ['/ELBOW-500', '/PIPE-500-A', '/PIPE-500-B'],
  );
  assert.ok(pipeline.audit.carrierTopologyConnectionRows.every((row) => row.relationshipStatus === 'EXACT_PORT_CONNECTION'));
});

test('native package exports topology evidence separately', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({
    supportInput: SUPPORT_SOURCE,
    steelInput: STEEL_SOURCE,
  });
  const exports = createPsFamilyNativePipelineExports(pipeline);
  assert.match(exports.summaryCsv, /CarrierTopologyComponentCount/);
  assert.match(exports.summaryCsv, /CarrierTopologyConnectionCount/);
  assert.match(exports.carrierTopologyComponentsCsv, /ComponentId,CanonicalType/);
  assert.match(exports.carrierTopologyPortsCsv, /PortId,ComponentId,Role/);
  assert.match(exports.carrierTopologyConnectionsCsv, /EXACT_PORT_CONNECTION/);
  assert.match(exports.carrierTopologyPathsCsv, /SCT-PATH:1/);
  assert.match(exports.carrierTopologyExceptionsCsv, /ExceptionId,ExceptionCode/);
});

test('topology exceptions remain advisory evidence rather than XML dependencies', () => {
  const pipeline = buildPsFamilyNativeAuditPipeline({
    supportInput: {
      objects: [{
        type: 'BRANCH', attributes: { NAME: '/LINE-501/B1' }, children: [
          {
            type: 'PIPE',
            attributes: { NAME: '/PIPE-501', AXIS_START: '0 0 0', AXIS_END: '100 0 0', TREF: '/MISSING' },
            children: [{ type: 'ATTA', attributes: { NAME: '/PS-951.1', POS: '50 0 0', STEEL_REF: '/SL-950' } }],
          },
        ],
      }],
    },
    steelInput: STEEL_SOURCE,
  });
  assert.equal(pipeline.xmlRequired, false);
  assert.equal(pipeline.xmlConsumed, false);
  assert.ok(pipeline.summary.carrierTopologyExceptionCount >= 1);
  assert.ok(pipeline.audit.carrierTopologyExceptionRows.some((row) => row.exceptionCode === 'MISSING_CARRIER_REFERENCE_TARGET'));
  assert.ok(pipeline.diagnostics.some((row) => row.code === 'CARRIER_TOPOLOGY_EXCEPTIONS_REMAIN'));
});
