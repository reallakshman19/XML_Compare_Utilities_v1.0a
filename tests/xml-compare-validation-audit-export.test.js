import assert from 'node:assert/strict';

import { createValidationAudit, validationAuditToCsv } from '../xml-compare/XmlCompareValidationAuditExport.js';

const validationModel = {
  mode: 'coordinate-transform-nearest',
  validationLayer: 'node',
  toleranceMm: 1,
  compareFields: ['globalX', 'globalY', 'globalZ'],
  anchor: { sourceUid: 's1', targetUid: 't1' },
  summary: { sourceCount: 1, targetCount: 1, validatedCount: 1, okCount: 1 },
  rows: [
    {
      sourceUid: 's1',
      sourceLabel: 'Source, 1',
      targetUid: 't1',
      targetLabel: 'Target "1"',
      sourceCoordinate: { x: 1, y: 2, z: 3 },
      expectedTargetCoordinate: { x: 4, y: 5, z: 6 },
      actualTargetCoordinate: { x: 4, y: 5, z: 6 },
      deltaX: 0,
      deltaY: 0,
      deltaZ: 0,
      srss: 0,
      status: 'OK',
    },
  ],
  diagnostics: [],
};

const audit = createValidationAudit({
  sourceName: 'source.xml',
  targetName: 'target.xml',
  validationModel,
  compareFields: validationModel.compareFields,
  validationLayer: 'node',
  toleranceMm: 1,
});

assert.equal(audit.schema, 'xml-compare-validation-audit/v1');
assert.deepEqual(audit.anchor, { sourceUid: 's1', targetUid: 't1' });
assert.equal(audit.summary.okCount, 1);
assert.equal(audit.rows[0].srss, 0);

const csv = validationAuditToCsv(audit);
assert.match(csv, /Source Item,Nearest Target Item,Source X/);
assert.match(csv, /SRSS,Status/);
assert.match(csv, /"Source, 1","Target ""1"""/);

const emptyCsv = validationAuditToCsv(createValidationAudit({ validationModel: { rows: [] } }));
assert.match(emptyCsv, /Source Item,Nearest Target Item/);

assert.equal(validationModel.rows.length, 1);

console.log('XML Compare validation audit export tests passed');
