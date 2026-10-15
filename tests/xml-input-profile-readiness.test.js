import assert from 'node:assert/strict';

import { createReadinessDiagnostic } from '../xml-compare/contracts/xml-input-readiness-contracts.js';
import { classifyInputReadinessProfile } from '../xml-compare/input/classify-input-readiness-profile.js';

function has(result, code, severity = 'BLOCKER') {
  return result.diagnostics.some((item) => item.code === code && item.severity === severity);
}

let result = classifyInputReadinessProfile({ rawText: '   ' });
assert.equal(result.inputKind, 'empty');
assert.equal(result.blocker, true);
assert.equal(has(result, 'blank_input'), true);

result = classifyInputReadinessProfile({ rawText: '<Root><Broken></Root>', fileName: 'bad.xml' });
assert.equal(result.inputKind, 'xml');
assert.equal(result.blocker, true);
assert.equal(has(result, 'xml_parse_failed'), true);

result = classifyInputReadinessProfile({ rawText: '<UnknownRoot></UnknownRoot>', fileName: 'unknown.xml' });
assert.equal(result.inputKind, 'xml');
assert.equal(result.supported, false);
assert.equal(has(result, 'unsupported_xml_profile'), true);

result = classifyInputReadinessProfile({ rawText: '{"bad":', fileName: 'bad.json' });
assert.equal(result.inputKind, 'json');
assert.equal(has(result, 'json_parse_failed'), true);

result = classifyInputReadinessProfile({ rawText: '{"foo":"bar"}', fileName: 'unsupported.json' });
assert.equal(result.inputKind, 'json');
assert.equal(has(result, 'unsupported_json_profile'), true);

result = classifyInputReadinessProfile({ rawText: 'Line,Node\nL1,10', fileName: 'table.csv' });
assert.equal(result.inputKind, 'table');
assert.equal(has(result, 'unsupported_table_profile'), true);

result = classifyInputReadinessProfile({ rawText: 'plain unsupported notes' });
assert.equal(result.inputKind, 'unknown');
assert.equal(has(result, 'unknown_input_profile'), true);

result = classifyInputReadinessProfile({
  rawText: '<PIPINGMODEL><PIPINGELEMENT FROM_NODE="10" TO_NODE="20" /></PIPINGMODEL>',
  records: [{ uid: 'p1' }],
});
assert.equal(result.profile, 'inputxml');
assert.equal(result.supported, true);
assert.equal(result.blocker, false);

result = classifyInputReadinessProfile({
  rawText: '<PIPINGMODEL><PIPINGELEMENT FROM_NODE="10" TO_NODE="20" /></PIPINGMODEL>',
  profile: 'inputxml',
  confidence: 0.4,
  records: [{ uid: 'p1' }],
});
assert.equal(has(result, 'profile_low_confidence', 'WARNING'), true);
assert.equal(result.blocker, false);

const compatible = createReadinessDiagnostic(result.diagnostics[0]);
assert.equal(['INFO', 'WARNING', 'BLOCKER'].includes(compatible.severity), true);
assert.equal(typeof compatible.code, 'string');
assert.equal(typeof compatible.message, 'string');

console.log('XML input profile readiness tests passed');
