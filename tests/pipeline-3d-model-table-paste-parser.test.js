import assert from 'node:assert/strict';
import {
  framesFromTable1,
  parseAutocadListEntities,
  parseTable2Paste,
  parseTable3Paste,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-parser.js';
import {
  SAMPLE_TABLE_2_PASTE_MULTISHEET,
  SAMPLE_TABLE_3_PASTE_MULTISHEET,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-table-paste-samples.js';

const WORLD_FRAME_POINTS = [{
  sheetIndex: 0,
  originX: 302276.361,
  originY: 2037954.7525,
  originZ: 0,
  angleDeg: 180,
}];

const worldTable2 = `
                  LINE      Layer: "F953"
              from point, X=301525.661  Y=2038670.577  Z=    0.000
                to point, X=301525.661  Y=2038605.011  Z=    0.000
          Length =   65.567
                  TEXT      Layer: "F953"
             start point, X=301527.661  Y=2038666.207  Z=    0.000
              text 0+088.9
                  TEXT      Layer: "F953"
             start point, X=301527.661  Y=2038633.072  Z=    0.000
              text  231.08`;

const entities = parseAutocadListEntities(worldTable2);
assert.equal(entities.length, 3, 'LINE and two TEXT entities are parsed');
const worldResult = parseTable2Paste(worldTable2, { frames: framesFromTable1(WORLD_FRAME_POINTS) });
assert.deepEqual(worldResult.rows[0], {
  h: 750.7,
  vFrom: -715.825,
  vTo: -650.258,
  length: 65.567,
  stationText: '0+088.9',
  elevationText: '231.08',
});
assert.match(worldResult.rawText, /750\.700\t-715\.825 → -650\.258\t65\.567\t0\+088\.9\t231\.08/);

const fragmentedLocalTable2 = `
                  LINE      Layer: "F953"
              from point, X= 1486.976  Y= -715.825  Z=    0.000
                to point, X= 1486.976  Y= -711.808  Z=    0.000
                  LINE      Layer: "F953"
              from point, X= 1486.976  Y= -685.275  Z=    0.000
                to point, X= 1486.976  Y= -673.514  Z=    0.000
                  LINE      Layer: "F953"
              from point, X= 1486.976  Y= -651.948  Z=    0.000
                to point, X= 1486.976  Y= -650.258  Z=    0.000
                  TEXT      Layer: "F953"
             start point, X= 1488.856  Y= -710.808  Z=    0.000
              text 13+657.5
                  TEXT      Layer: "F953"
             start point, X= 1488.856  Y= -678.267  Z=    0.000
              text  240.19`;

const localResult = parseTable2Paste(fragmentedLocalTable2);
assert.deepEqual(localResult.rows[0], {
  h: 1486.976,
  vFrom: -715.825,
  vTo: -650.258,
  length: 65.567,
  stationText: '13+657.5',
  elevationText: '240.19',
}, 'fragmented ordinates merge by their full vertical envelope');

const localTable3 = `
                  DIMENSION  Layer: "0"
1st extension  defining point: X= 1513.232  Y= -842.649  Z=    0.000
2nd extension  defining point: X= 1534.160  Y= -842.649  Z=    0.000
default text position: X= 1523.696  Y= -842.649  Z=    0.000
default text
                  DIMENSION  Layer: "0"
1st extension  defining point: X= 1513.232  Y= -862.088  Z=    0.000
2nd extension  defining point: X= 1534.160  Y= -862.088  Z=    0.000
user specified text position: X= 1523.696  Y= -856.220  Z=    0.000
dimension text modifier: A/G
                  DIMENSION  Layer: "0"
1st extension  defining point: X= 1430.577  Y= -856.220  Z=   55.325
2nd extension  defining point: X= 1513.232  Y= -856.220  Z= -527.884
user specified text position: X= 1478.826  Y= -856.131  Z=    0.000
dimension text modifier: 1.5M
                  CIRCLE    Layer: "1"
            center point, X= 1492.213  Y= -868.478  Z=    0.000
            radius     1.854
                  CIRCLE    Layer: "1"
            center point, X= 1459.416  Y= -868.478  Z=    0.000
            radius     1.854`;

const table3Result = parseTable3Paste(localTable3);
assert.equal(table3Result.table3ARaw, [
  'From H(coor)\tTo H(coor)\tText Position X\tHLength Text',
  '1513.232\t1534.160\t1523.696\t20.9',
].join('\n'));
assert.equal(table3Result.table3BRaw, [
  'From H(coor)\tTo H(coor)\tText Position X\tZ Text',
  '1430.577\t1513.232\t1478.826\t1.5M',
  '1513.232\t1534.160\t1523.696\tA/G',
].join('\n'));
assert.equal(table3Result.table3CRaw, [
  'Text Position X\tMarker Text',
  '1459.416\tPMS-001',
  '1492.213\tPMS-002',
].join('\n'), 'Layer 1 circles become deterministic PMS markers sorted by center X');

const multiSheetTable2 = parseTable2Paste(SAMPLE_TABLE_2_PASTE_MULTISHEET);
assert.equal(multiSheetTable2.rows.length, 10, 'chat Table 2 sample yields ten geometry-backed rows');
assert.deepEqual(multiSheetTable2.rows[0], {
  h: 1451.141,
  vFrom: -715.825,
  vTo: -650.258,
  length: 65.567,
  stationText: '13+621.6',
  elevationText: '240.17',
});
assert.deepEqual(multiSheetTable2.rows.at(-1), {
  h: 1524.946,
  vFrom: -715.825,
  vTo: -650.258,
  length: 65.567,
  stationText: '13+695.4',
  elevationText: '240.30',
});
assert.deepEqual(
  multiSheetTable2.warnings,
  ['Ignored 1 unmatched station/elevation pair(s).'],
  'duplicate 13+704.7 text is deduplicated and its missing parent line is reported',
);
assert.match(multiSheetTable2.rawText, /1486\.976\t-715\.825 → -650\.258\t65\.567\t13\+657\.5\t240\.19/);

const multiSheetTable3 = parseTable3Paste(SAMPLE_TABLE_3_PASTE_MULTISHEET);
assert.equal(multiSheetTable3.lengthRows.length, 4);
assert.equal(multiSheetTable3.zRows.length, 2);
assert.deepEqual(
  multiSheetTable3.markerRows.map((row) => [row.textX, row.markerText]),
  [
    [1459.416, 'PMS-001'],
    [1465.887, 'PMS-002'],
    [1492.213, 'PMS-003'],
    [1530.289, 'PMS-004'],
  ],
);
assert.match(multiSheetTable3.table3ARaw, /1430\.577\t1445\.249\t1437\.913\t14\.7/);
assert.match(multiSheetTable3.table3BRaw, /1430\.577\t1513\.232\t1478\.826\t1\.5M/);
assert.match(multiSheetTable3.table3CRaw, /1530\.289\tPMS-004/);

assert.throws(
  () => parseTable2Paste(worldTable2),
  /requires Table 1 origin and angle data/,
  'global-coordinate paste does not guess a coordinate frame',
);

console.log('pipeline-3d-model-table-paste-parser.test.js passed');