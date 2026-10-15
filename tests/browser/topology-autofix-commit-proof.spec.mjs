import { expect, test } from '@playwright/test';

test('TTV-C04 — Auto fix commits journal authority, persists recovery, and survives reload', async ({ page }, testInfo) => {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));

  await page.goto('/tests/browser/topology-checker-autofix-fixture.html');
  await page.waitForFunction(() => document.body.dataset.topologyValidatorReady === '1');
  await page.locator('[data-ttv-checker-open]').click();

  const before = await page.evaluate(() => ({
    checker: window.__topologyValidatorHarness.controller.checker.evidence(),
    edit: window.__topologyValidatorHarness.controller.evidence().edit,
  }));
  expect(before.checker.autoEligibleCount).toBeGreaterThan(0);

  await page.locator('[data-ttv-checker-auto-fix]').click();
  await page.waitForFunction(() => window.__topologyValidatorHarness.controller.checker.evidence().autoFixRuns.length > 0, null, { timeout: 30_000 });

  const after = await page.evaluate(() => ({
    checker: window.__topologyValidatorHarness.controller.checker.evidence(),
    edit: window.__topologyValidatorHarness.controller.evidence().edit,
  }));
  const run = after.checker.autoFixRuns.at(-1);
  const proof = run.commitProof;

  expect(run.schema).toBe('TopologyAutoFixRun.v1');
  expect(run.committed).toBe(true);
  expect(proof.schema).toBe('TopologyAutoFixCommitProof.v1');
  expect(proof.authorityAdvanced).toBe(true);
  expect(proof.beforeAuthorityId).not.toBe(proof.afterAuthorityId);
  expect(proof.transactionId).toBe(run.transactionId);
  expect(proof.journalCommandId).toMatch(/^CJ-\d+$/);
  expect(proof.activeCommandIds).toContain(proof.journalCommandId);
  expect(proof.recoveryCommandIds).toContain(proof.journalCommandId);
  expect(proof.recoverySnapshotSchema).toBe('TopologyEditSessionDraft.v2');

  expect(after.edit.commandAuthority.authorityId).toBe(proof.afterAuthorityId);
  expect(after.edit.commandAuthority.currentDraftHash).toBe(proof.currentDraftHash);
  expect(after.edit.draft.topologyEditDraftHash).toBe(proof.currentDraftHash);
  expect(after.edit.commandJournal.activeCommandIds).toContain(proof.journalCommandId);
  expect(after.edit.editedArtifacts.canonicalTopology.canonicalTopologyHash).toBe(proof.canonicalTopologyHash);
  expect(after.checker.report.canonicalTopologyHash).toBe(proof.canonicalTopologyHash);
  expect(after.checker.resolvedIssues.length).toBe(run.applied.length + run.related.length);

  await testInfo.attach('topology-autofix-commit-proof.json', {
    body: Buffer.from(`${JSON.stringify({
      before: {
        canonicalTopologyHash: before.checker.report.canonicalTopologyHash,
        openIssueIds: before.checker.report.issues.map((row) => row.id),
        commandAuthority: before.edit.commandAuthority,
      },
      run,
      after: {
        canonicalTopologyHash: after.checker.report.canonicalTopologyHash,
        activeIssueIds: after.checker.report.issues.map((row) => row.id),
        resolvedIssueIds: after.checker.resolvedIssues.map((row) => row.issue.id),
        commandAuthority: after.edit.commandAuthority,
        commandJournal: after.edit.commandJournal,
      },
    }, null, 2)}\n`),
    contentType: 'application/json',
  });

  await page.reload();
  await page.waitForFunction(() => document.body.dataset.topologyValidatorReady === '1');
  await page.locator('[data-ttv-checker-open]').click();

  const reloaded = await page.evaluate(() => ({
    checker: window.__topologyValidatorHarness.controller.checker.evidence(),
    edit: window.__topologyValidatorHarness.controller.evidence().edit,
  }));
  const reloadedRun = reloaded.checker.autoFixRuns.find((row) => row.runId === run.runId);

  expect(reloaded.edit.commandAuthority.authorityId).toBe(proof.afterAuthorityId);
  expect(reloaded.edit.commandAuthority.currentDraftHash).toBe(proof.currentDraftHash);
  expect(reloaded.edit.draft.topologyEditDraftHash).toBe(proof.currentDraftHash);
  expect(reloaded.edit.commandJournal.activeCommandIds).toContain(proof.journalCommandId);
  expect(reloaded.edit.editedArtifacts.canonicalTopology.canonicalTopologyHash).toBe(proof.canonicalTopologyHash);
  expect(reloaded.checker.report.canonicalTopologyHash).toBe(proof.canonicalTopologyHash);
  expect(reloaded.checker.resolvedIssues.length).toBe(after.checker.resolvedIssues.length);
  expect(reloadedRun.active).toBe(true);
  expect(reloadedRun.commitProof).toEqual(proof);
  expect(errors).toEqual([]);
});
