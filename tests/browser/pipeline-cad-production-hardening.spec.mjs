import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-cad-runtime-switch-fixture.html';

async function openCanvasFixture(page) {
  await page.addInitScript(() => {
    if (sessionStorage.getItem('pipelineCadHardeningInitialized') !== '1') {
      localStorage.removeItem('pipeline3dCadRenderer');
      localStorage.removeItem('pipeline3dCadRendererFallback');
      localStorage.removeItem('pipeline3dCadCanvas');
      sessionStorage.setItem('pipelineCadHardeningInitialized', '1');
    }
  });
  await page.goto(FIXTURE);
  await page.waitForFunction(() => document.body.dataset.pipelineCadRuntimeReady === '1');
  await page.waitForFunction(() => Boolean(window.__pipelineCadRuntimeWorkspace?.controller?.model));
}

async function runtimeState(page) {
  return page.evaluate(() => window.__pipelineCadRuntimeState());
}

test.describe('Pipeline CAD production hardening', () => {
  test('CAD-H01 — terminal Table 2 anchors cannot be deleted', async ({ page }) => {
    await openCanvasFixture(page);
    const result = await page.evaluate(() => {
      const workspace = window.__pipelineCadRuntimeWorkspace;
      const first = workspace.controller.model.table2Rows[0];
      const beforeCount = workspace.controller.model.table2Rows.length;
      let rejected = '';
      workspace.controller.addEventListener('commandRejected', (event) => {
        rejected = event.detail?.error?.message || '';
      }, { once: true });
      workspace.graphs.table2x.dispatchEvent(new CustomEvent('nodeDeleted', {
        detail: { graph: 'table2x', entityId: first.id, entityType: 'elevation-node' },
      }));
      return {
        beforeCount,
        afterCount: workspace.controller.model.table2Rows.length,
        firstStillPresent: workspace.controller.model.findRow(first.id)?.id === first.id,
        rejected,
      };
    });
    expect(result.afterCount).toBe(result.beforeCount);
    expect(result.firstStillPresent).toBe(true);
    expect(result.rejected).toMatch(/terminal anchors/i);
    expect((await runtimeState(page)).status.join(' ')).toMatch(/terminal anchors/i);
  });

  test('CAD-H02 — invalid Table 3A continuity is rejected without replacing the active model', async ({ page }) => {
    await openCanvasFixture(page);
    const before = await runtimeState(page);
    await page.evaluate(() => {
      const invalid = `From H(coor)\tTo H(coor)\tText Position X\tHLength Text\n661.791\t682.337\t671.704\t20.5\n690.000\t716.683\t700.435\t26.7\n716.683\t732.683\t723.927\t16.0`;
      window.__pipelineCadSetRaw('table3a', invalid);
    });
    await expect.poll(async () => (await runtimeState(page)).status.join(' ')).toMatch(/previous row ends|profile errors/i);
    const after = await runtimeState(page);
    expect(after.table3LengthRows).toBe(before.table3LengthRows);
    expect(after.status.join(' ')).toMatch(/Table 3A row 2/i);
  });

  test('CAD-H03 — manual raw input clears command history with visible evidence', async ({ page }) => {
    await openCanvasFixture(page);
    await page.evaluate(async () => {
      const workspace = window.__pipelineCadRuntimeWorkspace;
      const commands = await import('/tabs/pipeline-3d-model/pipeline-3d-model-cad-commands.js');
      const middle = workspace.controller.model.table2Rows[1];
      workspace.controller.execute(
        commands.moveTable2ElevationCommand(workspace.controller.model, middle.id, 234.5),
        'browser-hardening-move',
      );
    });
    expect((await runtimeState(page)).history.undo).toBe(1);

    await page.evaluate(() => {
      const element = document.querySelector('[data-p3d-split="table2a-raw"]');
      const lines = element.value.split('\n');
      const cells = lines[2].split('\t');
      cells[4] = '234.75';
      lines[2] = cells.join('\t');
      window.__pipelineCadSetRaw('table2a', lines.join('\n'));
    });

    await expect.poll(async () => (await runtimeState(page)).history.undo).toBe(0);
    const state = await runtimeState(page);
    expect(state.history.redo).toBe(0);
    expect(state.status.join(' ')).toMatch(/history reset \(1 undo, 0 redo discarded\)/i);
  });
});
