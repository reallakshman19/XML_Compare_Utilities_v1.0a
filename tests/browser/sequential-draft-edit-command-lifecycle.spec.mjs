import { test, expect } from '@playwright/test';

const fixture = '/tests/browser/sequential-draft-edit-command-lifecycle-fixture.html';
const command = (type) => `[data-ssk-draft-edit-command="${type}"]`;

async function ready(page, mode = 'candidate') {
  await page.goto(fixture);
  await expect.poll(() => page.evaluate(() => Boolean(globalThis.__sskCommandLifecycle))).toBe(true);
  await page.evaluate((value) => globalThis.__sskCommandLifecycle.setMode(value), mode);
}
async function fillEvidence(page) {
  await page.locator('[data-ssk-draft-edit-actor]').fill('operator-3h');
  await page.locator('[data-ssk-draft-edit-reason]').fill('Reviewed exact current command authority.');
  await page.locator('[data-ssk-draft-edit-evidence]').fill('Target identity and predicted native outcome independently verified.');
}
async function snapshot(page) {
  return page.evaluate(() => globalThis.__sskCommandLifecycle.snapshot());
}

// SSK-TS-3H-Q-B01
test('SSK-TS-3H-Q-B01 exposes exactly twelve supervised controls without free-form authority IDs', async ({ page }) => {
  await ready(page);
  await expect(page.locator('[data-ssk-draft-edit-command]')).toHaveCount(12);
  await expect(page.locator('[data-ssk-draft-edit-command="REVERSE_COMPONENT"]')).toHaveCount(1);
  await expect(page.locator('[data-ssk-entry-port], [data-ssk-component-id], [data-ssk-candidate-id]')).toHaveCount(0);
  const state = await snapshot(page);
  expect(state.prepares).toBe(0);
  expect(state.accepts).toBe(0);
  expect(state.publications).toBe(0);
});

// SSK-TS-3H-Q-B02
test('SSK-TS-3H-Q-B02 candidate selection is non-publishing and evidence validation fails closed', async ({ page }) => {
  await ready(page, 'candidate');
  let state = await snapshot(page);
  expect(state.panel.candidateId).toBe('CANDIDATE-3H-BROWSER');
  expect(state.commands.CONNECT_CANDIDATE).toBe(false);
  expect(state.prepares).toBe(0);
  expect(state.publications).toBe(0);

  await page.locator(command('CONNECT_CANDIDATE')).click();
  await expect(page.locator('[data-ssk-draft-edit-command-state]')).toContainText('actor ID');
  await page.locator('[data-ssk-draft-edit-actor]').fill('operator-3h');
  await page.locator(command('CONNECT_CANDIDATE')).click();
  await expect(page.locator('[data-ssk-draft-edit-command-state]')).toContainText('operator reason');
  await page.locator('[data-ssk-draft-edit-reason]').fill('Reviewed candidate.');
  await page.locator(command('CONNECT_CANDIDATE')).click();
  await expect(page.locator('[data-ssk-draft-edit-command-state]')).toContainText('evidence note');
  state = await snapshot(page);
  expect(state.prepares).toBe(0);
  expect(state.accepts).toBe(0);
  expect(state.publications).toBe(0);

  await page.locator('[data-ssk-draft-edit-evidence]').fill('Exact candidate evidence reviewed.');
  await page.locator(command('CONNECT_CANDIDATE')).click();
  state = await snapshot(page);
  expect(state.prepares).toBe(1);
  expect(state.accepts).toBe(0);
  expect(state.publications).toBe(0);
  expect(state.lastInput.command.candidateId).toBe('CANDIDATE-3H-BROWSER');
  expect(state.lastInput.command.payload.targetEntityId).toBe('ssk:candidate:CANDIDATE-3H-BROWSER');
  expect(state.preview).toContain('Command: CONNECT_CANDIDATE');
  expect(state.preview).toContain('Prepared ID: SPREP-3H-1');
  expect(state.preview).toContain('Transaction mapping: TXN-3H-1');

  await page.locator('[data-ssk-draft-edit-command-cancel]').click();
  state = await snapshot(page);
  expect(state.panel.pendingPreparedId).toBeNull();
  expect(state.accepts).toBe(0);
  expect(state.publications).toBe(0);
});

// SSK-TS-3H-Q-B03
test('SSK-TS-3H-Q-B03 manual connection request uses the exact candidate-bound indexed port pair', async ({ page }) => {
  await ready(page, 'manual');
  await fillEvidence(page);
  await page.locator(command('MANUAL_CONNECT')).click();
  const state = await snapshot(page);
  expect(state.prepares).toBe(1);
  expect(state.lastInput.command.decisionId).toBe('DECISION-3H-CANDIDATE');
  expect(state.lastInput.command.candidateId).toBe('CANDIDATE-3H-BROWSER');
  expect(state.lastInput.command.fromPortId).toBe('/SSK/3H/BROWSER/P1:LPOS');
  expect(state.lastInput.command.toPortId).toBe('/SSK/3H/BROWSER/C1:APOS');
  expect(state.preview).toContain('From port: /SSK/3H/BROWSER/P1:LPOS');
  expect(state.preview).toContain('To port: /SSK/3H/BROWSER/C1:APOS');
  expect(state.publications).toBe(0);
});

// SSK-TS-3H-Q-B04
test('SSK-TS-3H-Q-B04 boundary classification prepares exact zero-candidate decision evidence', async ({ page }) => {
  await ready(page, 'boundary');
  await fillEvidence(page);
  await page.locator(command('MARK_TERMINAL')).click();
  const state = await snapshot(page);
  expect(state.lastInput.command.decisionId).toBe('DECISION-3H-BOUNDARY');
  expect(state.lastInput.command.candidateId).toBeNull();
  expect(state.lastInput.command.payload.decisionTargetId).toBe('SSK3H-BOUNDARY-TARGET');
  expect(state.lastInput.command.payload.targetDecisionReason).toBe('UNEXPLAINED_TERMINAL');
  expect(state.preview).toContain('Decision: DECISION-3H-BOUNDARY');
  expect(state.preview).toContain('Decision reason: UNEXPLAINED_TERMINAL');
  expect(state.accepts).toBe(0);
});

// SSK-TS-3H-Q-B05
test('SSK-TS-3H-Q-B05 reversal requires exact candidate component and entry port then explicit acceptance', async ({ page }) => {
  await ready(page, 'reversal');
  let state = await snapshot(page);
  expect(state.panel.reversalTargetId).toBe('SSK3H-REVERSAL-TARGET');
  expect(state.commands.REVERSE_COMPONENT).toBe(false);
  expect(state.prepares).toBe(0);
  await fillEvidence(page);
  await page.locator(command('REVERSE_COMPONENT')).click();
  state = await snapshot(page);
  expect(state.prepares).toBe(1);
  expect(state.accepts).toBe(0);
  expect(state.publications).toBe(0);
  expect(state.lastInput.command.decisionId).toBe('DECISION-3H-REVERSAL');
  expect(state.lastInput.command.componentId).toBe('/SSK/3H/BROWSER/P1');
  expect(state.lastInput.command.entryPortId).toMatch(/^\/SSK\/3H\/BROWSER\/P1:(APOS|LPOS)$/);
  expect(state.lastInput.command.payload.reversalTargetId).toBe('SSK3H-REVERSAL-TARGET');
  expect(state.preview).toContain('Command: REVERSE_COMPONENT');
  expect(state.preview).toContain('Predicted outcome: COMPONENT_TRAVERSAL_REVERSED');
  expect(state.preview).toContain('Authority ID: SAUTH-3H-BROWSER');
  expect(state.preview).toContain('Transaction mapping: TXN-3H-1');

  await page.locator('[data-ssk-draft-edit-command-accept]').click();
  state = await snapshot(page);
  expect(state.accepts).toBe(1);
  expect(state.publications).toBe(1);
  expect(state.panel.pendingPreparedId).toBeNull();
  expect(state.panel.reversalTargetId).toBeNull();
  expect(state.status).toContain('accepted and published');
});

// SSK-TS-3H-Q-B06
test('SSK-TS-3H-Q-B06 stale acceptance is rejected without publication', async ({ page }) => {
  await ready(page, 'reversal');
  await fillEvidence(page);
  await page.locator(command('REVERSE_COMPONENT')).click();
  await page.evaluate(() => globalThis.__sskCommandLifecycle.setStaleAcceptance(true));
  await page.locator('[data-ssk-draft-edit-command-accept]').click();
  const state = await snapshot(page);
  expect(state.accepts).toBe(1);
  expect(state.publications).toBe(0);
  expect(state.panel.pendingPreparedId).toBeNull();
  expect(state.panel.reversalTargetId).toBeNull();
  expect(state.status).toContain('PREPARED_COMMAND_STALE');
});

// SSK-TS-3H-Q-B07
test('SSK-TS-3H-Q-B07 authority refresh and panel closure invalidate prepared work', async ({ page }) => {
  await ready(page, 'candidate');
  await fillEvidence(page);
  await page.locator(command('CONNECT_CANDIDATE')).click();
  let state = await snapshot(page);
  expect(state.panel.pendingPreparedId).toBe('SPREP-3H-1');
  state = await page.evaluate(() => globalThis.__sskCommandLifecycle.makeStale());
  expect(state.panel.pendingPreparedId).toBeNull();
  expect(state.panel.candidateId).toBeNull();
  expect(state.commands.CONNECT_CANDIDATE).toBe(true);
  expect(state.publications).toBe(0);

  await page.evaluate(() => globalThis.__sskCommandLifecycle.setMode('reversal'));
  await fillEvidence(page);
  await page.locator(command('REVERSE_COMPONENT')).click();
  state = await snapshot(page);
  expect(state.panel.pendingPreparedId).not.toBeNull();
  state = await page.evaluate(() => globalThis.__sskCommandLifecycle.closePanel());
  expect(state.panel.active).toBe(false);
  expect(state.panel.pendingPreparedId).toBeNull();
  expect(state.panel.reversalTargetId).toBeNull();
  expect(state.publications).toBe(0);
});
