import assert from 'node:assert/strict';
import { scanPipelineRawTableReadiness } from '../tabs/pipeline-3d-model/pipeline-3d-model-raw-table-readiness.js';

const longTail = Array.from({ length: 10_000 }, (_, index) => `TAIL-${index}`).join('\n');
const early = scanPipelineRawTableReadiness(`Header\n12\tREADY\n${longTail}`);
assert.equal(early.hasContent, true);
assert.equal(early.hasDataRow, true);
assert.equal(early.scannedLineCount, 2, 'scanner must stop at the first qualifying data row');
assert.equal(Object.isFrozen(early), true);

const late = scanPipelineRawTableReadiness('Header\ntext only\n\n7');
assert.equal(late.hasDataRow, true);
assert.equal(late.scannedLineCount, 4);

assert.deepEqual(scanPipelineRawTableReadiness(''), {
  hasContent: false, hasDataRow: false, scannedLineCount: 1,
});
assert.deepEqual(scanPipelineRawTableReadiness('Header\ntext only'), {
  hasContent: true, hasDataRow: false, scannedLineCount: 2,
});
assert.equal(scanPipelineRawTableReadiness('Header\r\n8').hasDataRow, true);

console.log('pipeline-3d-model raw table readiness: PASS');
