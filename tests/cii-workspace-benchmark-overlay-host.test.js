import assert from 'node:assert/strict';
import { ciiBenchmarkOverlayHostMarkup, _test } from '../tabs/cii-workspace/cii-workspace-benchmark-overlay-host.js';

const audit = { rows: [{ rowKey: 'S1:1' }] };
const target = { fileName: 'T.CII', contentSha256: 'target-sha' };
const markup = ciiBenchmarkOverlayHostMarkup(audit, target);
assert.match(markup, /cii-benchmark-overlay-host/);
assert.match(markup, /data-ciiw-benchmark-token="cii-benchmark-/);

const emptyShell = _test.hostShell({ audit, targetDocument: target }, null);
assert.match(emptyShell, /Optional known-positive benchmark/);
assert.match(emptyShell, /Partial expected TARGET CII/);
assert.match(emptyShell, /data-ciiw-benchmark-file/);
assert.match(emptyShell, /never grants correspondence identity authority/);
assert.match(emptyShell, /not a veto/);

const loadedShell = _test.hostShell({ audit, targetDocument: target }, {
  expected: { fileName: 'PARTIAL.CII' }, summary: { expectedCount: 7 },
});
assert.match(loadedShell, /PARTIAL\.CII/);
assert.match(loadedShell, /7 derived positive delta/);
assert.equal(_test.annotationLabel({ status: 'RECOVERED', benchmarkAction: 'REPLACE', benchmarkTargetNodeId: '101' }), 'RECOVERED · REPLACE @ 101');
assert.equal(_test.annotationLabel({ status: 'ADDITIONAL_QUALIFIED_NOT_IN_PARTIAL_BENCHMARK' }), 'ADDITIONAL QUALIFIED · not in partial benchmark');
assert.equal(_test.annotationLabel(null), '—');

console.log('CII benchmark overlay host contract checks: PASS');
