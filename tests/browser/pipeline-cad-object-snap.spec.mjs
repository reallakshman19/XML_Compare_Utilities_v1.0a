import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-cad-object-snap-fixture.html';
const MODE_KEYS = ['endpointEnabled','midpointEnabled','stationObjectEnabled','markerEnabled','nearestEnabled','projectionEnabled','intersectionEnabled'];

async function open(page) {
  const errors=[]; page.on('pageerror',(error)=>errors.push(error.message));
  page.on('console',(message)=>{if(message.type()==='error')errors.push(message.text());});
  await page.goto(FIXTURE);
  await page.waitForFunction(()=>document.body.dataset.pcadObjectSnapReady==='1');
  await page.waitForFunction(()=>Boolean(window.__pcadObjectSnap.workspace?.objectSnap));
  await expect(page.locator('[data-p3d-cad-object-snap-glyph]')).toHaveCount(2);
  return errors;
}

async function state(page){return page.evaluate(()=>window.__pcadObjectSnap.state());}
async function setMode(page,name,key,extra={}){
  const values=Object.fromEntries(MODE_KEYS.map((field)=>[field,false]));
  values.objectEnabled=true; values.objectAperture=12; values[key]=true;
  await page.evaluate(({name,values,extra})=>window.__pcadObjectSnap.setSettings(name,{...values,...extra}),{name,values,extra});
}
async function node(page,name,query){return page.evaluate(({name,query})=>window.__pcadObjectSnap.findNode(name,query),{name,query});}
async function world(page,name,value){return page.evaluate(({name,value})=>window.__pcadObjectSnap.worldPoint(name,value),{name,value});}
async function client(page,name,local){
  const box=await page.locator(`[data-p3d-cad-canvas="${name}"]`).boundingBox();
  const viewport=await page.evaluate((key)=>window.__pcadObjectSnap.workspace.graphs[key].getViewport(),name);
  return{x:box.x+local.x*box.width/viewport.width,y:box.y+local.y*box.height/viewport.height};
}
async function moveLocal(page,name,local){const point=await client(page,name,local);await page.mouse.move(point.x,point.y);return point;}
async function waitMode(page,name,mode){await expect.poll(async()=>((await state(page)).acquisitions[name]?.candidate?.mode||null)).toBe(mode);}

function closeTo(actual,expected,precision=4){expect(Math.abs(actual-expected)).toBeLessThan(10**-precision);}

test.describe('Pipeline CAD Object Snap',()=>{
  test('PCAD-OS-B01 Object Snap controls and defaults',async({page})=>{
    await open(page);const toggle=page.locator('[data-p3d-cad-object-snap-action="toggle"]');
    await expect(toggle).toHaveAttribute('aria-pressed','true');
    await page.locator('[data-p3d-cad-object-snap-action="settings"]').click();
    const palette=page.locator('[data-p3d-cad-object-snap-palette]');await expect(palette).toBeVisible();
    await palette.locator('[data-object-snap-field="objectAperture"]').fill('18');
    await palette.locator('[data-object-snap-field="nearestEnabled"]').uncheck();
    await palette.locator('[data-object-snap-action="apply"]').click();
    expect((await state(page)).settings.table2x.objectAperture).toBe(18);
    await page.locator('[data-p3d-cad-object-snap-action="settings"]').click();
    await palette.locator('[data-object-snap-action="defaults"]').click();
    expect((await state(page)).settings.table2x.objectAperture).toBe(12);
    await page.locator('[data-p3d-cad-object-snap-action="settings"]').click();
    await palette.locator('[data-object-snap-action="cancel"]').click();await expect(palette).toBeHidden();
  });

  test('PCAD-OS-B02 Endpoint acquisition and glyph',async({page})=>{
    await open(page);await setMode(page,'table2x','endpointEnabled');const target=await node(page,'table2x',{x:19});
    await moveLocal(page,'table2x',{x:target.screen.x+4,y:target.screen.y});await waitMode(page,'table2x','endpoint');
    await expect(page.locator('[data-p3d-cad-object-snap-glyph="table2x"]')).toHaveAttribute('data-active','true');
  });

  test('PCAD-OS-B03 Midpoint acquisition',async({page})=>{
    await open(page);await setMode(page,'table2x','midpointEnabled');
    const local=await page.evaluate(()=>{const g=window.__pcadObjectSnap.workspace.graphs.table2x,n=g.currentNodes();return g.worldToScreen({x:(n[0].x+n[1].x)/2,y:(n[0].y+n[1].y)/2});});
    await moveLocal(page,'table2x',local);await waitMode(page,'table2x','midpoint');
  });

  test('PCAD-OS-B04 Station and marker acquisition',async({page})=>{
    await open(page);await setMode(page,'table2x','stationObjectEnabled');const target=await node(page,'table2x',{x:19});
    await moveLocal(page,'table2x',{x:target.screen.x+5,y:target.screen.y+80});await waitMode(page,'table2x','station');
    await setMode(page,'table3x','markerEnabled');const marker=await node(page,'table3x',{type:'marker',text:'PM-001'});
    await moveLocal(page,'table3x',{x:marker.screen.x+4,y:marker.screen.y+30});await waitMode(page,'table3x','marker');
  });

  test('PCAD-OS-B05 Nearest and projection acquisition',async({page})=>{
    await open(page);const local=await page.evaluate(()=>{const g=window.__pcadObjectSnap.workspace.graphs.table2x,n=g.currentNodes();const p=g.worldToScreen({x:(n[1].x+n[2].x)/2,y:(n[1].y+n[2].y)/2});return{x:p.x,y:p.y+6};});
    await setMode(page,'table2x','nearestEnabled');await moveLocal(page,'table2x',local);await waitMode(page,'table2x','nearest');
    await setMode(page,'table2x','projectionEnabled');await moveLocal(page,'table2x',{x:local.x+0.2,y:local.y});await waitMode(page,'table2x','projection');
  });

  test('PCAD-OS-B06 Deterministic intersection acquisition',async({page})=>{
    await open(page);await setMode(page,'table3x','intersectionEnabled');
    const local=await page.evaluate(()=>{const g=window.__pcadObjectSnap.workspace.graphs.table3x,n=g.depthNodes();const t=(0-n[0].y)/(n[1].y-n[0].y);return g.worldToScreen({x:n[0].x+t*(n[1].x-n[0].x),y:0});});
    await moveLocal(page,'table3x',local);await waitMode(page,'table3x','intersection');
    expect((await state(page)).acquisitions.table3x.evidence.winnerId).toContain('intersection');
  });

  test('PCAD-OS-B07 Aperture remains screen-space stable across zoom',async({page})=>{
    await open(page);await setMode(page,'table2x','endpointEnabled');let target=await node(page,'table2x',{x:19});
    await moveLocal(page,'table2x',{x:target.screen.x+8,y:target.screen.y});await waitMode(page,'table2x','endpoint');
    closeTo((await state(page)).acquisitions.table2x.candidate.screenDistance,8,2);
    await page.evaluate(()=>{const g=window.__pcadObjectSnap.workspace.graphs.table2x;g.zoomAt(g.worldToScreen(g.currentNodes()[2]),2);});
    target=await node(page,'table2x',{x:19});await moveLocal(page,'table2x',{x:target.screen.x+8,y:target.screen.y});await waitMode(page,'table2x','endpoint');
    closeTo((await state(page)).acquisitions.table2x.candidate.screenDistance,8,2);
  });

  test('PCAD-OS-B08 Dragged entity is excluded from self-snap',async({page})=>{
    await open(page);await setMode(page,'table2x','endpointEnabled');const target=await node(page,'table2x',{x:19});const start=await client(page,'table2x',target.screen);
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+2,start.y+2);
    const acquired=(await state(page)).acquisitions.table2x?.candidate;
    expect(acquired===null||!acquired.sourceIds.includes(target.id)).toBe(true);await page.mouse.up();
  });

  test('PCAD-OS-B09 Object Snap composes with Grid and Station snap',async({page})=>{
    await open(page);const result=await page.evaluate(()=>{const g=window.__pcadObjectSnap.workspace.graphs.table2x,n=g.currentNodes()[2],s=g.worldToScreen(n);
      g.setSnapSettings({objectEnabled:true,endpointEnabled:true,midpointEnabled:false,stationObjectEnabled:false,markerEnabled:false,nearestEnabled:false,projectionEnabled:false,intersectionEnabled:false,gridEnabled:true,elevationStep:1});
      const locked=g.composePipelineCadPointerWorld({screen:{x:s.x+3,y:s.y},world:g.screenToWorld({x:s.x+3,y:s.y}),phase:'test'});
      g.setSnapSettings({objectEnabled:false,gridEnabled:true,elevationStep:1});
      const scalar=g.composePipelineCadPointerWorld({screen:{x:s.x+30,y:s.y+4},world:g.screenToWorld({x:s.x+30,y:s.y+4}),phase:'test'});return{locked,scalar,node:n};});
    closeTo(result.locked.x,result.node.x);closeTo(result.locked.y,result.node.y);expect(Number.isInteger(result.scalar.y)).toBe(true);
  });

  test('PCAD-OS-B10 Table 2X Add Node preview equals committed value',async({page})=>{
    await open(page);await setMode(page,'table2x','midpointEnabled');const before=(await state(page)).table2Rows.map((row)=>row.id);
    const local=await page.evaluate(()=>{const g=window.__pcadObjectSnap.workspace.graphs.table2x,n=g.currentNodes();g.setTool('add-node');return g.worldToScreen({x:(n[1].x+n[2].x)/2,y:(n[1].y+n[2].y)/2});});
    const point=await client(page,'table2x',local);await page.mouse.click(point.x,point.y);
    await expect.poll(async()=>(await state(page)).table2Rows.length).toBe(before.length+1);const next=await state(page);const added=next.table2Rows.find((row)=>!before.includes(row.id));
    closeTo(added.stationValue,next.composed.table2x.x);closeTo(added.elevationValue,next.composed.table2x.y);
  });

  test('PCAD-OS-B11 Table 3X Add Marker and Add Node preview equal commit',async({page})=>{
    await open(page);await setMode(page,'table3x','stationObjectEnabled');let before=(await state(page)).markerRows.map((row)=>row.id);
    let local=await page.evaluate(()=>{const g=window.__pcadObjectSnap.workspace.graphs.table3x;g.setTool('add-marker');return g.worldToScreen({x:20.5,y:g.markerRailY});});
    let point=await client(page,'table3x',local);await page.mouse.click(point.x,point.y);await expect.poll(async()=>(await state(page)).markerRows.length).toBe(before.length+1);
    let next=await state(page);let added=next.markerRows.find((row)=>!before.includes(row.id));closeTo(added.absoluteH,682.337,3);
    await setMode(page,'table3x','midpointEnabled');before=next.depthRows.map((row)=>row.id);
    local=await page.evaluate(()=>{const g=window.__pcadObjectSnap.workspace.graphs.table3x,n=g.depthNodes();g.setTool('add-node');return g.worldToScreen({x:(n[0].x+n[1].x)/2,y:(n[0].y+n[1].y)/2});});
    point=await client(page,'table3x',local);await page.mouse.click(point.x,point.y);await expect.poll(async()=>(await state(page)).depthRows.length).toBe(before.length+1);
    next=await state(page);added=next.depthRows.find((row)=>!before.includes(row.id));closeTo(added.z,next.composed.table3x.y);
  });

  test('PCAD-OS-B12 Undo restores previous raw and model value',async({page})=>{
    await open(page);await setMode(page,'table3x','stationObjectEnabled');const before=await state(page);
    const local=await page.evaluate(()=>{const g=window.__pcadObjectSnap.workspace.graphs.table3x;g.setTool('add-marker');return g.worldToScreen({x:20.5,y:g.markerRailY});});
    const point=await client(page,'table3x',local);await page.mouse.click(point.x,point.y);await expect.poll(async()=>(await state(page)).markerRows.length).toBe(before.markerRows.length+1);
    await page.evaluate(()=>window.__pcadObjectSnap.workspace.controller.undo());await expect.poll(async()=>(await state(page)).markerRows.length).toBe(before.markerRows.length);
    expect((await state(page)).raw.table3c).toBe(before.raw.table3c);
  });

  test('PCAD-OS-B13 Escape and Cancel clear acquisition and visual override',async({page})=>{
    await open(page);await setMode(page,'table2x','endpointEnabled');const target=await node(page,'table2x',{x:19});const start=await client(page,'table2x',target.screen);
    await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(start.x+20,start.y+20);await page.keyboard.press('Escape');
    await expect.poll(async()=>((await state(page)).glyphs.some((item)=>item.active==='true'))).toBe(false);expect((await state(page)).overrides.table2).toEqual([]);await page.mouse.up();
    await page.locator('[data-p3d-cad-object-snap-action="settings"]').click();await page.locator('[data-object-snap-action="cancel"]').click();await expect(page.locator('[data-p3d-cad-object-snap-palette]')).toBeHidden();
  });

  test('PCAD-OS-B14 Overlay disables editing and acquisition controls',async({page})=>{
    await open(page);await page.locator('.p3d-x-tab[data-x-tab="overlay"]').click();
    await expect(page.locator('[data-p3d-cad-object-snap-action="toggle"]')).toBeDisabled();await expect(page.locator('[data-p3d-cad-object-snap-action="settings"]')).toBeDisabled();
    expect((await state(page)).glyphs.every((item)=>item.active==='false')).toBe(true);
  });

  test('PCAD-OS-B15 Destroy and remount leave one lifecycle and no glyph leak',async({page})=>{
    await open(page);expect((await state(page)).lifecycle).toBe('1');expect(await page.locator('[data-p3d-cad-object-snap-glyph]').count()).toBe(2);
    expect(await page.evaluate(()=>window.__pcadObjectSnap.destroy())).toBe(true);expect(await page.locator('[data-p3d-cad-object-snap-glyph]').count()).toBe(0);
    expect(await page.evaluate(()=>window.__pcadObjectSnap.remount())).toBe(true);expect(await page.locator('[data-p3d-cad-object-snap-glyph]').count()).toBe(2);
    expect(await page.locator('[data-p3d-cad-object-snap-action="toggle"]').count()).toBe(1);
  });

  test('PCAD-OS-B16 Existing Pipeline CAD browser behavior remains green',async({page})=>{
    const errors=await open(page);await page.evaluate(()=>window.__pcadObjectSnap.setSettings('table2x',{objectEnabled:false,gridEnabled:true,elevationStep:0.05}));
    const target=await node(page,'table2x',{x:19});const start=await client(page,'table2x',target.screen);const end=await client(page,'table2x',await world(page,'table2x',{x:target.world.x,y:232.48}));
    const before=(await state(page)).raw.table2a;await page.mouse.move(start.x,start.y);await page.mouse.down();await page.mouse.move(end.x,end.y,{steps:5});await page.mouse.up();
    await expect.poll(async()=>(await state(page)).table2Rows.find((row)=>row.id===target.id)?.elevationValue).toBe(232.5);
    await page.evaluate(()=>window.__pcadObjectSnap.workspace.controller.undo());await expect.poll(async()=>(await state(page)).raw.table2a).toBe(before);expect(errors).toEqual([]);
  });
});
