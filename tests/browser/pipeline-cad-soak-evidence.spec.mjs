import { readFile } from 'node:fs/promises';

import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-cad-runtime-switch-fixture.html';
const SOAK_MODULE = '/tabs/pipeline-3d-model/pipeline-3d-model-cad-soak-evidence.js';

async function openCleanCanvasFixture(page) {
  await page.addInitScript(() => {
    localStorage.removeItem('pipeline3dCadRenderer');
    localStorage.removeItem('pipeline3dCadRendererFallback');
    localStorage.removeItem('pipeline3dCadCanvas');
    localStorage.removeItem('pipeline3dCadSoakLedgerV1');
    sessionStorage.removeItem('pipeline3dCadSoakSessionV1');
  });
  await page.goto(FIXTURE);
  await page.waitForFunction(() => document.body.dataset.pipelineCadRuntimeReady === '1');
  await page.waitForFunction(() => Boolean(window.__pipelineCadRuntimeWorkspace?.controller?.model));
  await expect(page.locator('[data-p3d-cad-diagnostics-download]')).toBeVisible();
}

test.describe('Pipeline CAD soak evidence', () => {
  test('CAD-S01 — mounted Canvas produces a privacy-safe downloadable diagnostics bundle', async ({ page }) => {
    await openCleanCanvasFixture(page);

    const bundle = await page.evaluate(async (modulePath) => {
      const evidence = await import(modulePath);
      return evidence.buildPipelineCadDiagnosticsBundle();
    }, SOAK_MODULE);

    expect(bundle.schema).toBe('PipelineCadDiagnosticsBundle.v1');
    expect(bundle.privacy.rawTablesIncluded).toBe(false);
    expect(bundle.privacy.xmlIncluded).toBe(false);
    expect(bundle.privacy.modelRowsIncluded).toBe(false);
    expect(bundle.runtime.renderer).toBe('canvas');
    expect(bundle.soakAudit.verdict).toBe('IN_PROGRESS');
    expect(bundle.soakAudit.summary.retainedSessions).toBe(1);
    expect(bundle.soakAudit.summary.mounts).toBe(1);
    expect(bundle.graphRuntime).toHaveLength(2);

    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain('659.791');
    expect(serialized).not.toContain('PM-001');
    expect(serialized).not.toContain('table2a-raw');

    const downloadPromise = page.waitForEvent('download');
    await page.locator('[data-p3d-cad-diagnostics-download]').click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^pipeline-cad-diagnostics-.*\.json$/);
    const path = await download.path();
    const downloaded = JSON.parse(await readFile(path, 'utf8'));
    expect(downloaded.schema).toBe('PipelineCadDiagnosticsBundle.v1');
    expect(downloaded.privacy.rawTablesIncluded).toBe(false);
    expect(JSON.stringify(downloaded)).not.toContain('659.791');
  });

  test('CAD-S02 — three clean Canvas sessions produce a READY soak verdict', async ({ page }) => {
    await openCleanCanvasFixture(page);

    const audit = await page.evaluate(async (modulePath) => {
      const evidence = await import(modulePath);
      evidence.clearPipelineCadSoakLedger();
      for (let index = 1; index <= 3; index += 1) {
        const sessionId = `browser-clean-${index}`;
        evidence.recordPipelineCadEvidence('session-start', {
          renderer: 'canvas',
          runtimeBuild: 'browser-test',
          devicePixelRatio: window.devicePixelRatio,
          viewportWidth: window.innerWidth,
          viewportHeight: window.innerHeight,
          language: navigator.language,
        }, { sessionId, now: `2026-07-13T05:2${index}:00.000Z` });
        evidence.recordPipelineCadEvidence('workspace-mounted', {
          renderer: 'canvas',
          table2Rows: 3,
          table3LengthRows: 3,
          table3DepthRows: 2,
          table3MarkerRows: 1,
        }, { sessionId, now: `2026-07-13T05:2${index}:01.000Z` });
      }
      return evidence.createPipelineCadSoakAudit(evidence.readPipelineCadSoakLedger(), {
        now: '2026-07-13T05:30:00.000Z',
      });
    }, SOAK_MODULE);

    expect(audit.verdict).toBe('READY');
    expect(audit.progress.successfulCanvasSessions).toBe(3);
    expect(audit.progress.successfulMounts).toBe(3);
    await expect(page.locator('[data-p3d-cad-soak-status]')).toHaveAttribute('data-verdict', 'READY');
    await expect(page.locator('[data-p3d-cad-soak-status]')).toContainText('3/3 clean sessions');
  });

  test('CAD-S03 — a retained CAD runtime error produces a BLOCKED verdict', async ({ page }) => {
    await openCleanCanvasFixture(page);

    const audit = await page.evaluate(async (modulePath) => {
      const evidence = await import(modulePath);
      evidence.clearPipelineCadSoakLedger();
      evidence.recordPipelineCadEvidence('session-start', { renderer: 'canvas' }, {
        sessionId: 'browser-blocked',
        now: '2026-07-13T05:31:00.000Z',
      });
      evidence.recordPipelineCadEvidence('workspace-mounted', {
        renderer: 'canvas',
        table2Rows: 3,
        table3LengthRows: 3,
      }, {
        sessionId: 'browser-blocked',
        now: '2026-07-13T05:31:01.000Z',
      });
      evidence.recordPipelineCadEvidence('runtime-error', {
        name: 'PipelineCadRuntimeError',
        message: 'PipelineCad synthetic retained failure',
        rawTable: '659.791\tSECRET',
      }, {
        sessionId: 'browser-blocked',
        now: '2026-07-13T05:31:02.000Z',
      });
      return evidence.createPipelineCadSoakAudit(evidence.readPipelineCadSoakLedger());
    }, SOAK_MODULE);

    expect(audit.verdict).toBe('BLOCKED');
    expect(audit.summary.runtimeErrors).toBe(1);
    expect(audit.blockers.map((entry) => entry.code)).toContain('CAD_RUNTIME_ERRORS_PRESENT');
    expect(JSON.stringify(audit)).not.toContain('659.791');
    await expect(page.locator('[data-p3d-cad-soak-status]')).toHaveAttribute('data-verdict', 'BLOCKED');
    await expect(page.locator('[data-p3d-cad-soak-status]')).toContainText('1 blocker');
  });
});
