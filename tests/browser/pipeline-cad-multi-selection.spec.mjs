import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-cad-multi-selection-fixture.html';
async function openFixture(page) {
  await page.goto(FIXTURE);
  await page.waitForFunction(() => document.body.dataset.pcadMultiReady === '1');
}
const state = (page) => page.evaluate(() => window.__pcadMulti.state());
async function selectIds(page, name, type, count, primaryIndex = 0) {
  await page.evaluate(({ name, type, count, primaryIndex }) => {
    const nodes = window.__pcadMulti.items(name, type, count);
    window.__pcadMulti.select(name, nodes.map((node) => ({ id: node.id })), nodes[primaryIndex]?.id);
  }, { name, type, count, primaryIndex });
  await page.evaluate(() => window.__pcadMulti.settle());
}

test.describe('PCAD-004R current-main reconstruction', () => {
  test('PCAD-004R-B01 click replacement', async ({ page }) => {
    await openFixture(page);
    const ids = await page.evaluate(() => window.__pcadMulti.items('table2x', null, 2).map((item) => item.id));
    await page.evaluate((id) => window.__pcadMulti.click('table2x', { id }), ids[0]);
    await page.evaluate((id) => window.__pcadMulti.click('table2x', { id }), ids[1]);
    expect((await state(page)).selection.table2x.entityIds).toEqual([ids[1]]);
  });

  test('PCAD-004R-B02 modifier toggling', async ({ page }) => {
    await openFixture(page);
    const ids = await page.evaluate(() => window.__pcadMulti.items('table2x', null, 2).map((item) => item.id));
    await page.evaluate((id) => window.__pcadMulti.click('table2x', { id }), ids[0]);
    await page.evaluate((id) => window.__pcadMulti.toggle('table2x', { id }, 'ctrl'), ids[1]);
    expect((await state(page)).selection.table2x.entityIds).toEqual(ids);
    await page.evaluate((id) => window.__pcadMulti.toggle('table2x', { id }, 'meta'), ids[0]);
    expect((await state(page)).selection.table2x.entityIds).toEqual([ids[1]]);
  });

  test('PCAD-004R-B03 select all', async ({ page }) => {
    await openFixture(page);
    const total = await page.evaluate(() => window.__pcadMulti.items('table2x').length);
    await page.evaluate(() => window.__pcadMulti.press('table2x', 'a', { ctrlKey: true }));
    expect((await state(page)).selection.table2x.count).toBe(total);
  });

  test('PCAD-004R-B04 window selection', async ({ page }) => {
    await openFixture(page);
    const proof = await page.evaluate(() => {
      const [a,b]=window.__pcadMulti.items('table2x',null,2).map((item)=>window.__pcadMulti.findNode('table2x',{id:item.id}).screen);
      return window.__pcadMulti.box('table2x',{x:Math.min(a.x,b.x)-10,y:Math.min(a.y,b.y)-10},{x:Math.max(a.x,b.x)+10,y:Math.max(a.y,b.y)+10});
    });
    expect(proof.count).toBe(2);
  });

  test('PCAD-004R-B05 crossing selection', async ({ page }) => {
    await openFixture(page);
    const proof = await page.evaluate(() => {
      const node=window.__pcadMulti.items('table2x',null,1)[0];const p=window.__pcadMulti.findNode('table2x',{id:node.id}).screen;
      return window.__pcadMulti.box('table2x',{x:p.x+3,y:p.y+3},{x:p.x-3,y:p.y-3});
    });
    expect(proof.count).toBe(1);
  });

  test('PCAD-004R-B06 Table 2 group preview', async ({ page }) => {
    await openFixture(page); await selectIds(page,'table2x',null,2);
    const before=await state(page);const id=before.selection.table2x.primaryId;
    await page.evaluate((id)=>window.__pcadMulti.preview('table2x',{id},{y:1}),id);
    const preview=await state(page);
    expect(preview.revision).toBe(before.revision);expect(preview.raw.table2a).toBe(before.raw.table2a);expect(preview.overrides.table2).toHaveLength(2);
  });

  test('PCAD-004R-B07 Table 2 atomic commit', async ({ page }) => {
    await openFixture(page); await selectIds(page,'table2x',null,2);
    const before=await state(page);const id=before.selection.table2x.primaryId;
    await page.evaluate((id)=>window.__pcadMulti.drag('table2x',{id},{y:1}),id);
    const after=await state(page);
    expect(after.history.undo).toBe(1);expect(after.raw.table2a).not.toBe(before.raw.table2a);
    expect(after.authority.inputXmlCoordinateRows).not.toBe(before.authority.inputXmlCoordinateRows);
  });

  test('PCAD-004R-B08 Table 3 marker-only group operation', async ({ page }) => {
    await openFixture(page); await selectIds(page,'table3x','marker',2);
    const before=await state(page);const id=before.selection.table3x.primaryId;
    await page.evaluate((id)=>window.__pcadMulti.drag('table3x',{id},{x:2}),id);
    const after=await state(page);
    expect(after.history.undo).toBe(1);expect(after.raw.table3c).not.toBe(before.raw.table3c);
    expect(after.authority.coordinateRows).not.toBe(before.authority.coordinateRows);
    expect(after.authority.inputXmlCoordinateRows).toBe(before.authority.inputXmlCoordinateRows);
    expect(after.authority.xmlText).toBe(before.authority.xmlText);expect(after.authority.bends).toBe(before.authority.bends);
  });

  test('PCAD-004R-B09 mixed-selection homogeneous subset', async ({ page }) => {
    await openFixture(page);
    const selected=await page.evaluate(()=>{
      const markers=window.__pcadMulti.items('table3x','marker',2);const depth=window.__pcadMulti.items('table3x','depth-node',1)[0];
      window.__pcadMulti.select('table3x',[...markers,depth].map((item)=>({id:item.id})),markers[0].id);return{primary:markers[0].id,depth:depth.id};
    });
    const before=await state(page);await page.evaluate((id)=>window.__pcadMulti.drag('table3x',{id},{x:2}),selected.primary);
    const after=await state(page);
    expect(after.history.undo).toBe(1);expect(after.depthRows).toEqual(before.depthRows);
    expect(after.authority.inputXmlCoordinateRows).toBe(before.authority.inputXmlCoordinateRows);
    expect(after.resolutions.at(-1).skippedEntityIds).toEqual([selected.depth]);
  });

  test('PCAD-004R-B10 batch delete', async ({ page }) => {
    await openFixture(page); await selectIds(page,'table3x','marker',2);
    const before=await state(page);await page.evaluate(()=>window.__pcadMulti.press('table3x','Delete'));
    const after=await state(page);
    expect(after.history.undo).toBe(1);expect(after.markerRows.length).toBe(before.markerRows.length-2);
  });

  test('PCAD-004R-B11 Undo/Redo', async ({ page }) => {
    await openFixture(page); await selectIds(page,'table3x','marker',2);
    const before=await state(page);await page.evaluate(()=>window.__pcadMulti.press('table3x','Delete'));const committed=await state(page);
    await page.evaluate(()=>window.__pcadMulti.workspace.controller.undo());expect((await state(page)).raw.table3c).toBe(before.raw.table3c);
    await page.evaluate(()=>window.__pcadMulti.workspace.controller.redo());expect((await state(page)).raw.table3c).toBe(committed.raw.table3c);
  });

  test('PCAD-004R-B12 precision cancellation', async ({ page }) => {
    await openFixture(page); await selectIds(page,'table2x',null,1);expect((await state(page)).precision.table2x).toBe(true);
    await selectIds(page,'table2x',null,2);expect((await state(page)).precision.table2x).toBe(false);
  });

  test('PCAD-004R-B13 overlay lockout', async ({ page }) => {
    await openFixture(page); await selectIds(page,'table2x',null,2);await page.evaluate(()=>window.__pcadMulti.setMode('overlay'));
    const after=await state(page);expect(after.enabled.table2x).toBe(false);expect(after.enabled.table3x).toBe(false);expect(after.selection.table2x.count).toBe(0);
  });

  test('PCAD-004R-B14 bend/InputXML gate preservation', async ({ page }) => {
    await openFixture(page); await selectIds(page,'table3x','depth-node',2);
    const before=await state(page);const id=before.selection.table3x.primaryId;
    await page.evaluate((id)=>window.__pcadMulti.drag('table3x',{id},{y:-1}),id);
    const after=await state(page);
    expect(after.history.undo).toBe(0);expect(after.raw.table3b).toBe(before.raw.table3b);expect(after.overrides.depth).toHaveLength(0);
    expect(after.authority.inputXmlCoordinateRows).toBe(before.authority.inputXmlCoordinateRows);
    expect(after.authority.xmlText).toBe(before.authority.xmlText);expect(after.authority.bends).toBe(before.authority.bends);
    expect(after.rejections.at(-1).code).toBe('TABLE3_DEPTH_BATCH_NOT_AUTHORIZED');
  });

  test('PCAD-004R-B15 destroy/remount', async ({ page }) => {
    await openFixture(page); await selectIds(page,'table2x',null,2);const first=(await state(page)).mountId;
    await page.evaluate(()=>window.__pcadMulti.destroy());await page.evaluate(()=>window.__pcadMulti.remount());const after=await state(page);
    expect(after.mountId).toBeGreaterThan(first);expect(after.selection.table2x.count).toBe(0);expect(after.selection.table3x.count).toBe(0);
  });

  test('PCAD-004R-B16 no shared-SVG authoring ownership', async ({ page }) => {
    await openFixture(page);
    expect(await page.evaluate(()=>Boolean(window.__pcadMulti.workspace.graphs.table2x.onPrimaryPointerDown))).toBe(true);
    expect(await page.evaluate(()=>Boolean(window.__pcadMulti.workspace.commandGateway))).toBe(false);
    expect(await page.locator('[data-engineering-svg-workspace]').count()).toBe(0);
  });
});
