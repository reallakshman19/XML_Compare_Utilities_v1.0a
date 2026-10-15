import assert from 'assert';
import { readFile } from 'fs/promises';
import { _test as uiTest } from '../tabs/cii-workspace/cii-workspace-transfer-scope-ui.js';

const raw = Object.freeze({ transferPlan: Object.freeze({
  sourceDocument: Object.freeze({ contentSha256: 'SRC' }), targetDocument: Object.freeze({ contentSha256: 'TGT' }),
  operations: Object.freeze([
    Object.freeze({ operationId: 'op:p1', action: 'COPY', family: 'PROCESS', property: 'P1', status: 'PREVIEW_READY', blockers: Object.freeze([]) }),
    Object.freeze({ operationId: 'op:sif', action: 'COPY', family: 'SIF_TEE', property: 'SIF', status: 'BLOCKED', blockers: Object.freeze(['SIF_TEE_MUTATION_BLOCKED']) }),
  ]),
}), review: Object.freeze({ reviewedCorrespondenceIds: Object.freeze(['c1']), lockedCorrespondenceIds: Object.freeze([]), rejectedCorrespondenceIds: Object.freeze([]) }) });
const view = Object.freeze({ transferPlan: Object.freeze({ transferScope: Object.freeze({ status: 'BOUND', scopeId: 'scope:1', appliedOperationCount: 1, excludedOperationCount: 1 }) }) });
const decisions = new Map([['op:p1', 'APPLY'], ['op:sif', 'EXCLUDE']]);
const markup = uiTest.scopePanelMarkup(raw, decisions, view, false);
assert(markup.includes('Explicit mutation scope'));
assert(markup.includes('APPLY'));
assert(markup.includes('EXCLUDE'));
assert(markup.includes('USER_EXPLICIT_OPERATION_SCOPE'));
assert(markup.includes('Bind APPLY / EXCLUDE scope'));
assert(markup.includes('op:p1'));
assert(markup.includes('op:sif'));
assert(markup.includes('SIF_TEE_MUTATION_BLOCKED'));

const excluded = uiTest.excludedMarkup(Object.freeze({ transferPlan: Object.freeze({ excludedOperations: Object.freeze([
  Object.freeze({ operationId: 'op:sif', family: 'SIF_TEE', property: 'SIF', status: 'BLOCKED', blockers: Object.freeze(['SIF_TEE_MUTATION_BLOCKED']), sourceEvidence: Object.freeze({ value: 2 }), before: 1 }),
]) }) }));
assert(excluded.includes('Explicitly excluded operations'));
assert(excluded.includes('absent from the Writer mutation set'));
assert(excluded.includes('EXCLUDE'));

assert(uiTest.statusText(Object.freeze({ transferPlan: Object.freeze({ transferScope: Object.freeze({ status: 'UNBOUND' }) }) }), false).includes('not bound'));
assert(uiTest.statusText(Object.freeze({ transferPlan: Object.freeze({ transferScope: Object.freeze({ status: 'BOUND', scopeId: 's', appliedOperationCount: 1, excludedOperationCount: 1 }) }), writerReadiness: Object.freeze({ status: 'READY' }) }), false).includes('Writer 1B READY'));
assert(uiTest.statusText(view, true).includes('Re-apply approvals'));

const tabSource = await readFile(new URL('../tabs/cii-workspace/cii-workspace-tab.js', import.meta.url), 'utf8');
assert(tabSource.includes("mountCiiWorkspaceScopedEngineeringShell"), 'product tile must mount scoped shell');
assert(!tabSource.includes("mountCiiWorkspaceEngineeringShell(overlay"), 'product tile must not bypass explicit scope through legacy engineering shell');

console.log('CII explicit transfer-scope UI and product-routing checks passed.');
