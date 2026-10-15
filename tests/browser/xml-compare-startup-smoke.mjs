import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

const baseUrl = process.env.STARTUP_BASE_URL || 'http://127.0.0.1:4173/';
const browser = await chromium.launch({ headless: true });

async function persistReport(report) {
  await mkdir('artifacts', { recursive: true });
  const safeName = report.name.replace(/[^a-z0-9_-]+/gi, '-').toLowerCase();
  const environment = report.baseUrl.includes('127.0.0.1') ? 'branch' : 'deployed';
  await writeFile(
    `artifacts/startup-smoke-${environment}-${safeName}.json`,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
}

async function runScenario(name, activeTabId = null) {
  const context = await browser.newContext();
  const page = await context.newPage();
  const pageErrors = [];
  const consoleErrors = [];
  const failedRequests = [];

  if (activeTabId) {
    await page.addInitScript((tabId) => {
      localStorage.setItem('xml-compare-utilities.activeTabId', tabId);
    }, activeTabId);
  }
  page.on('pageerror', (error) => {
    pageErrors.push(error.stack || error.message || String(error));
  });
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('requestfailed', (request) => {
    failedRequests.push(`${request.url()} :: ${request.failure()?.errorText || 'request failed'}`);
  });

  await page.goto(baseUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(1000);
  const bodyText = await page.locator('body').innerText();
  const report = {
    name,
    baseUrl,
    activeTabId,
    pageErrors,
    consoleErrors,
    failedRequests,
    visibleStartupError: bodyText.includes('XML Compare Utilities startup error') ? bodyText : null,
  };
  console.log(JSON.stringify(report, null, 2));
  await persistReport(report);
  assert.deepEqual(pageErrors, [], `${name}: browser page errors detected:\n${pageErrors.join('\n\n')}`);
  assert.equal(report.visibleStartupError, null, report.visibleStartupError || `${name}: unexpected startup error`);
  assert.deepEqual(failedRequests, [], `${name}: failed startup requests detected:\n${failedRequests.join('\n')}`);
  await context.close();
}

await runScenario('default-tab');
await runScenario('persisted-utilities-tab', 'psnm-utility');
await browser.close();
