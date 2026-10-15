import assert from 'node:assert/strict';
import test from 'node:test';
import { extractStagedRecords } from '../workbench3d/adapters/staged-json-adapter.js';

test('extractStagedRecords maps basic elements', () => {
  const stagedDoc = {
    branches: [
      {
        name: 'LINE-1',
        children: [
          {
            type: 'PIPE',
            name: 'P-100',
            attributes: {
              APOS: { x: 0, y: 0, z: 0 },
              LPOS: { x: 1000, y: 0, z: 0 },
              APORT_ID: 'PORT-A',
              LPORT_ID: 'PORT-B',
              DIAMETER: '200',
              WALL_THICK: '10'
            }
          }
        ]
      }
    ]
  };

  const records = extractStagedRecords(stagedDoc);
  
  assert.equal(records.length, 1);
  const rec = records[0];
  assert.equal(rec.name, 'P-100');
  assert.equal(rec.fromNode, 'PORT-A');
  assert.equal(rec.toNode, 'PORT-B');
  assert.deepEqual(rec.deltaMm, [1000, 0, 0]);
  assert.equal(rec.lengthMm, 1000);
  assert.equal(rec.diameterMm, 200);
  assert.equal(rec.wallThickMm, 10);
  assert.equal(rec.properties.DIAMETER, '200');
});

test('extractStagedRecords handles missing positions gracefully', () => {
  const stagedDoc = {
    branches: [
      {
        name: 'LINE-1',
        children: [
          { type: 'SUPPORT', attributes: {} } // No APOS, LPOS, APORT_ID
        ]
      }
    ]
  };

  const records = extractStagedRecords(stagedDoc);
  assert.equal(records.length, 1);
  const rec = records[0];
  assert.deepEqual(rec.deltaMm, [0, 0, 0]);
  assert.equal(rec.lengthMm, 0);
  assert.ok(rec.fromNode.includes('START'));
  assert.ok(rec.toNode.includes('END'));
  assert.ok(Number.isNaN(rec.diameterMm));
});
