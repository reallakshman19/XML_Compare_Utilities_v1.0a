import { deepFreeze } from '../tabs/revision-compare/revision-contract-utils.js';
import { createRevisionCompareTransferCompletionApplication } from '../tabs/revision-compare/revision-transfer-completion-controller.js';
import { completeRevisionCompareTransferCompletionState } from '../tabs/revision-compare/revision-transfer-completion-state.js';
import { adoptRevisionCompareTransferArchiveWorkspace } from '../tabs/revision-compare/revision-transfer-archive-workspace-state.js';
import { completionFixture, cryptoRef, declaredAt } from './revision-compare-transfer-completion-fixtures.mjs';
export { cryptoRef, declaredAt };
export async function transferArchiveFixture() {
  const fixture = await completionFixture();
  const application = await createRevisionCompareTransferCompletionApplication(fixture.workspace, fixture.input, declaredAt, { cryptoRef, preflight: {}, createEvidencePackage: async () => fixture.evidencePackage });
  const completion = completeRevisionCompareTransferCompletionState(application, fixture.workspace);
  const workspace = adoptRevisionCompareTransferArchiveWorkspace(deepFreeze({ ...fixture.workspace, transferCompletion: completion }));
  return { ...fixture, application, workspace };
}
export function clone(value) { return structuredClone(value); }
