import { test, expect } from '@playwright/test';
import { readFile } from 'node:fs/promises';

const fixture = (name) => new URL(`../fixtures/revision-compare/${name}`, import.meta.url);
const staged = (branches, metadata = {}) => Buffer.from(JSON.stringify({
  schema: 'inputxml-managed-stage/v1', unit: 'mm', verticalAxis: 'Z', coordinateFrame: 'PLANT',
  ...metadata, branches: branches.map((name) => ({ name, children: [{ type: 'PIPE' }] })),
}));

async function upload(page, slot, name, buffer) {
  const bytes = buffer ?? await readFile(fixture(name));
  await page.locator(`[data-revc-file="${slot}"]`).setInputFiles({ name, mimeType: 'application/json', buffer: bytes });
}

async function openWorkspace(page, options) {
  await page.goto('/tests/browser/revision-compare-rc001.html');
  if (options) await page.evaluate((value) => { window.rcMountOptions = value; }, options);
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await expect(page.locator('.revc-dialog')).toBeVisible();
}

async function openAndLoad(page) {
  await openWorkspace(page);
  await upload(page, 'baseline', 'rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'rev-b.json');
  await expect(page.getByRole('heading', { name: 'Confirm branch scope' })).toBeVisible();
}

function basisBadge(page, status) {
  return page.locator(`footer [data-status="${status.toLowerCase()}"]`);
}

test('load, scope, approve, download, invalidate, recover, and remount', async ({ page }) => {
  await openAndLoad(page);
  await expect(page.getByRole('heading', { name: /^Rev A only/ })).toBeVisible();
  await expect(page.getByRole('heading', { name: /^Rev B only/ })).toBeVisible();
  const removed = page.locator('[data-revc-branch-id="branch:/REMOVED-300"]');
  const added = page.locator('[data-revc-branch-id="branch:/ADDED-400"]');
  await expect(removed).toBeChecked();
  await expect(added).toBeChecked();
  await removed.uncheck();
  await expect(page.getByText(/one-sided branch\(es\) were explicitly excluded/)).toBeVisible();
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await expect(basisBadge(page, 'CURRENT')).toBeVisible();

  const sessionDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download session manifest' }).first().click();
  const sessionPath = await (await sessionDownload).path();
  const session = JSON.parse(await readFile(sessionPath, 'utf8'));
  expect(session.schema).toBe('RevisionSessionManifest.v1');
  expect(JSON.stringify(session)).not.toContain('"type":"PIPE"');

  const scopeDownload = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download scope/basis manifest' }).click();
  const scopePath = await (await scopeDownload).path();
  const scope = JSON.parse(await readFile(scopePath, 'utf8'));
  expect(scope.basis.schema).toBe('RevisionComparisonBasis.v1');
  expect(scope.proposal.summary.includedBranchCountA).toBe(2);

  await page.locator('[data-revc-branch-id="branch:/COMMON-200"]').uncheck();
  await expect(basisBadge(page, 'STALE')).toBeVisible();
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await expect(basisBadge(page, 'CURRENT')).toBeVisible();

  await upload(page, 'baseline', 'rev-a.json');
  await expect(basisBadge(page, 'STALE')).toBeVisible();
  await page.getByRole('button', { name: 'Approve comparison basis' }).click();
  await expect(basisBadge(page, 'CURRENT')).toBeVisible();

  await page.getByRole('button', { name: 'Close Revision Compare' }).first().click();
  await expect(page.locator('.revc-dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Open Revision Compare' }).click();
  await expect(page.locator('.revc-dialog')).toHaveCount(1);
  await expect(page.getByText('Load Rev A and Rev B staged JSON files.')).toBeVisible();
});

test('invalid JSON and unsupported roots remain blocked', async ({ page }) => {
  await openWorkspace(page);
  await upload(page, 'baseline', 'bad.json', Buffer.from('{bad'));
  await expect(page.getByText(/JSON/).first()).toBeVisible();
  await upload(page, 'baseline', 'bad-root.json', Buffer.from('{"wrong":[]}'));
  await expect(page.getByText(/Unsupported staged JSON root/).first()).toBeVisible();
});

test('incompatible metadata blocks basis approval', async ({ page }) => {
  await openWorkspace(page);
  await upload(page, 'baseline', 'a.json', staged(['/COMMON']));
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'b.json', staged(['/COMMON'], { unit: 'in', verticalAxis: 'Y', coordinateFrame: 'LOCAL' }));
  await expect(page.getByText(/Unit mismatch/)).toBeVisible();
  await expect(page.getByText(/Coordinate frame mismatch/)).toBeVisible();
  await expect(page.getByText(/Vertical axis mismatch/)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve comparison basis' })).toBeDisabled();
});

test('no-common scope keeps one-sided additions and removals visible', async ({ page }) => {
  await openWorkspace(page);
  await upload(page, 'baseline', 'a.json', staged(['/A-ONLY']));
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  await upload(page, 'candidate', 'b.json', staged(['/B-ONLY']));
  await expect(page.getByRole('heading', { name: 'Confirm branch scope' })).toBeVisible();
  await expect(page.locator('[data-revc-scope-group="common"] h3 span')).toHaveText('0');
  await expect(page.locator('[data-revc-scope-group="revAOnly"] h3 span')).toHaveText('1');
  await expect(page.locator('[data-revc-scope-group="revBOnly"] h3 span')).toHaveText('1');
  await expect(page.locator('[data-revc-branch-id="branch:/A-ONLY"]')).toBeChecked();
  await expect(page.locator('[data-revc-branch-id="branch:/B-ONLY"]')).toBeChecked();
});

test('empty included scope blocks approval', async ({ page }) => {
  await openAndLoad(page);
  await page.locator('[data-revc-group="common"][data-revc-include="none"]').click();
  await page.locator('[data-revc-group="revAOnly"][data-revc-include="none"]').click();
  await expect(page.getByText('Rev A included scope is empty.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Approve comparison basis' })).toBeDisabled();
});

test('download failure reports error without mutating review state', async ({ page }) => {
  await page.addInitScript(() => {
    window.rcMountOptions = { downloadArtifact: () => { throw new Error('Injected download failure'); } };
  });
  await openWorkspace(page);
  await upload(page, 'baseline', 'rev-a.json');
  await expect(page.locator('[data-slot="baseline"] strong')).toContainText('ready');
  const before = await page.evaluate(() => JSON.stringify(window.rcHandle.evidence().state));
  await page.getByRole('button', { name: 'Download session manifest' }).click();
  await expect(page.locator('[data-revc-live]')).toContainText('Injected download failure');
  const after = await page.evaluate(() => JSON.stringify(window.rcHandle.evidence().state));
  expect(after).toBe(before);
});
