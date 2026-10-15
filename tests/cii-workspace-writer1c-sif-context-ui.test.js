import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { _test as scopeUiTest } from '../tabs/cii-workspace/cii-workspace-transfer-scope-ui.js';

const AUTHORITY = 'ENGINEER_ATTESTED_SAME_ACTIVE_PIPING_CODE';
const operation = Object.freeze({
  operationId: 'SIF-CONTEXT-1', family: 'SIF_TEE', scopeDecision: 'APPLY',
  policyAuthority: 'CII_WRITER_1C_SIF_IN_PLANE_EXISTING_BLOCK',
  sifContext: Object.freeze({ status: 'QUALIFIED', authority: AUTHORITY, sourceCode: 'ASME B31.3-2018', targetCode: 'ASME B31.3-2018' }),
});
const preview = Object.freeze({ transferPlan: Object.freeze({ operations: Object.freeze([operation]) }) });

assert.equal(scopeUiTest.assertCurrentSifContext(preview, {
  authority: AUTHORITY, sourceCode: ' asme  b31.3-2018 ', targetCode: 'ASME B31.3-2018',
}), true);
assert.throws(() => scopeUiTest.assertCurrentSifContext(preview, {
  authority: AUTHORITY, sourceCode: 'ASME B31.3-2018', targetCode: 'ASME B31.8-2018',
}), /CURRENT_CODE_CONTEXT_NOT_QUALIFIED/);
assert.throws(() => scopeUiTest.assertCurrentSifContext(preview, {
  authority: AUTHORITY, sourceCode: 'ASME B31.8-2018', targetCode: 'ASME B31.8-2018',
}), /SIF_CONTEXT_STALE/);
assert.equal(scopeUiTest.assertCurrentSifContext({ transferPlan: { operations: [] } }, null), true);

const tabSource = readFileSync('tabs/cii-workspace/cii-workspace-tab.js', 'utf8');
assert(tabSource.includes('data-ciiw-sif-source-code'));
assert(tabSource.includes('data-ciiw-sif-target-code'));
assert(tabSource.includes('data-ciiw-sif-code-attest'));
assert(tabSource.includes(AUTHORITY));

console.log('Writer 1C SIF code-context UI and stale-preview guard checks passed.');
