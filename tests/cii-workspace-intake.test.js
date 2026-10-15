import assert from 'assert';
import fs from 'fs';
import { webcrypto } from 'crypto';
import { intakeCiiWorkspaceDocument } from '../tabs/cii-workspace/cii-workspace-intake.js';

// Use the repository's maintained full neutral-CII benchmark as the real-file oracle.
// Root output.cii is a legacy generated artifact with unresolved OD=0 rows and is
// deliberately not normalized or assigned invented engineering data here.
const text = fs.readFileSync(new URL('../Benchmark/Pipeline/CII', import.meta.url), 'utf8');
const document = await intakeCiiWorkspaceDocument(text, 'Benchmark/Pipeline/CII', { side: 'SOURCE', cryptoRef: webcrypto });
const renamed = await intakeCiiWorkspaceDocument(text, 'renamed-copy.cii', { side: 'TARGET', cryptoRef: webcrypto });
assert.strictEqual(document.schema, 'CIIWorkspaceDocument.v1');
assert.strictEqual(document.format, 'NEUTRAL');
assert(document.summary.elementCount > 0);
assert(/^[a-f0-9]{64}$/.test(document.contentSha256));
assert.strictEqual(document.contentSha256, renamed.contentSha256);
assert.strictEqual(document.side, 'SOURCE');
assert.strictEqual(renamed.side, 'TARGET');
assert.strictEqual(document.parserAuthority, 'parser/caesar-parser.js');
assert(document.parserAlias.endsWith('.accdb'));
assert.strictEqual(document.nodeNameEvidence.schema, 'CIIWorkspaceNodeNameEvidence.v1');
assert.strictEqual(document.summary.nodeNameCount, Object.keys(document.nodeNames).length);
assert.strictEqual(document.summary.nodeNameConflictCount, document.nodeNameEvidence.conflicts.length);
console.log('CII Workspace full neutral benchmark intake checks passed.');
