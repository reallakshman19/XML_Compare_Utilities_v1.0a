import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { performance } from 'node:perf_hooks';
import { createRevisionCompareTransferArchiveArtifact } from '../../tabs/revision-compare/revision-transfer-archive.js';
import { renderRevisionCompareTransferArchiveHtml } from '../../tabs/revision-compare/revision-transfer-archive-html.js';
import { transferArchiveFixture } from '../revision-compare-transfer-archive-fixtures.mjs';

const digest = (value) => createHash('sha256').update(value).digest('hex');
const hostileValues = [
  '</script>', '</script><script>alert(1)</script>', '<img src=x onerror=alert(1)>',
  'javascript:alert(1)', 'https://attacker.example/a.css', 'file:///etc/passwd', '<', '>', '&',
  '\u2028', '\u2029', '\u202Ebidirectional', `long:${'x'.repeat(8192)}`,
];

async function temporaryArchive(text, name = 'archive.html') {
  const directory = await mkdtemp(join(tmpdir(), 'rc-xfer-008-'));
  const path = join(directory, name); await writeFile(path, text, 'utf8');
  return { directory, path, url: pathToFileURL(path).href };
}
function parsedDomExpression() {
  return `(() => { const all=[...document.querySelectorAll('*')]; const script=document.scripts[0];
    const active=all.filter(e=>['IMG','IFRAME','OBJECT','EMBED','FORM','LINK','BASE'].includes(e.tagName));
    const events=all.flatMap(e=>[...e.attributes].filter(a=>a.name.toLowerCase().startsWith('on')).map(a=>a.name));
    const external=all.flatMap(e=>['src','href','action','formaction'].filter(n=>e.hasAttribute(n)).map(n=>e.getAttribute(n)));
    return { ready:document.readyState, url:location.href, base:document.baseURI, visible:getComputedStyle(document.body).display,
      sheets:document.styleSheets.length, scripts:document.scripts.length, script:{id:script?.id,type:script?.type,src:script?.getAttribute('src')},
      active:active.map(e=>e.tagName), events, external, embedded:script?JSON.parse(script.textContent):null,
      csp:document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content ?? '' }; })()`;
}
async function heapUsed(page) {
  const session = await page.context().newCDPSession(page);
  try {
    await session.send('Performance.enable'); const output = await session.send('Performance.getMetrics');
    return output.metrics.find((item) => item.name === 'JSHeapUsedSize')?.value ?? null;
  } finally { await session.detach(); }
}
async function navigateNative(page, archive) {
  const requests = []; const errors = []; const started = performance.now();
  let domContentLoadedMs = null; let loadMs = null;
  const request = (item) => requests.push(item.url());
  const consoleError = (message) => { if (message.type() === 'error') errors.push(message.text()); };
  page.on('request', request); page.on('console', consoleError);
  page.once('domcontentloaded', () => { domContentLoadedMs = performance.now() - started; });
  page.once('load', () => { loadMs = performance.now() - started; });
  try {
    await page.goto(archive.url, { waitUntil: 'load' }); const result = await page.evaluate(parsedDomExpression());
    return { ...result, requests, errors, domContentLoadedMs, loadMs,
      durationMs: performance.now() - started, jsHeapUsedBytes: await heapUsed(page) };
  } finally { page.off('request', request); page.off('console', consoleError); }
}
function hostileBundle(bundle) {
  const copy = structuredClone(bundle); const text = hostileValues.join('\n');
  copy.payload.evidencePackage.payload.reviewSession.items[0].note = text;
  copy.payload.completionReport.declaration.declarantName = hostileValues[1];
  copy.payload.completionReport.declaration.organization = hostileValues[4];
  return copy;
}
function largeBundle(bundle) {
  const copy = structuredClone(bundle); const make = (count, mapper) => Array.from({ length: count }, (_, index) => mapper(index));
  copy.payload.evidencePackage.payload.audit.differenceRows = make(8000, (i) => ({ differenceId:`difference:${i}`, differenceCategory:'CHANGED', changeReason:'VALUE_CHANGED' }));
  copy.payload.evidencePackage.payload.reviewSession.items = make(5000, (i) => ({ differenceId:`difference:${i}`, reviewState:'REVIEWED', note:`note:${i}`, updatedAt:'2026-07-25T00:00:00.000Z' }));
  copy.payload.evidencePackage.payload.decisionLedger.decisions = make(2000, (i) => ({ differenceId:`decision:${i}`, decisionState:'CONFIRMED_NO_MATCH', rationale:`rationale:${i}`, updatedAt:'2026-07-25T00:00:00.000Z' }));
  copy.payload.transferPlan.operations = make(6000, (i) => ({ operationId:`operation:${i}`, operationType:'REPLACE_EXISTING_PROPERTY', sourceEntityId:`s:${i}`, targetEntityId:`t:${i}`, targetCanonicalPath:`/rows/${i}`, fieldPath:'/value', beforeValue:i, afterValue:i+1, status:'READY' }));
  copy.payload.transferAudit.rows = make(6000, (i) => ({ operationId:`operation:${i}`, status:'APPLIED' })); return copy;
}

async function mountDownloadHarness(page, workspace, status) {
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await page.evaluate(async ({ workspace, status }) => {
    const archive = await import('/tabs/revision-compare/revision-transfer-archive.js');
    const state = await import('/tabs/revision-compare/revision-transfer-archive-state.js');
    const controllers = await import('/tabs/revision-compare/revision-transfer-archive-controller.js');
    const artifact = await archive.createRevisionCompareTransferArchiveArtifact(workspace, { cryptoRef: crypto });
    const archiveState = { ...state.completeRevisionCompareTransferArchiveState(artifact, workspace), status };
    let current = { ...workspace, transferArchive: archiveState }; const root = document.body;
    const originalCreate = URL.createObjectURL.bind(URL); const originalRevoke = URL.revokeObjectURL.bind(URL);
    window.__rc8 = { artifact, current, created:0, revoked:0, failures:[], blobType:null, actions:0 };
    URL.createObjectURL = (blob) => { window.__rc8.created += 1; window.__rc8.blobType = blob.type; return originalCreate(blob); };
    URL.revokeObjectURL = (url) => { window.__rc8.revoked += 1; return originalRevoke(url); };
    const controller = controllers.createRevisionCompareTransferArchiveController({ root, readState:()=>current,
      writeState:(next)=>{ current=next; window.__rc8.current=next; }, render:()=>{}, cryptoRef:crypto,
      reportFailure:(error)=>window.__rc8.failures.push(error.message), dependencies:{ complete:()=>current, fail:()=>current } });
    const button = document.createElement('button'); button.setAttribute('data-revc-download-transfer-archive','');
    button.addEventListener('click', () => { window.__rc8.actions += 1; void controller.handleClick(button); }); root.appendChild(button);
    window.__rc8.controller = controller;
  }, { workspace: structuredClone(workspace), status });
}
async function downloadOnce(page) {
  const started = performance.now(); const pending = page.waitForEvent('download');
  await page.locator('[data-revc-download-transfer-archive]').click(); const download = await pending;
  return { download, bytes: await readFile(await download.path()), durationMs: performance.now() - started };
}

async function mountPrintHarness(page, workspace, mode) {
  await page.goto('/tests/browser/revision-compare-rc001.html');
  await page.evaluate(async ({ workspace, mode }) => {
    const archive = await import('/tabs/revision-compare/revision-transfer-archive.js');
    const state = await import('/tabs/revision-compare/revision-transfer-archive-state.js');
    const controllers = await import('/tabs/revision-compare/revision-transfer-archive-controller.js');
    const artifact = await archive.createRevisionCompareTransferArchiveArtifact(workspace, { cryptoRef: crypto });
    let current = { ...workspace, transferArchive: state.completeRevisionCompareTransferArchiveState(artifact, workspace) };
    const record = { source:'', order:[], failures:[], opened:0, closeCount:0, userActivation:false,
      completed:false, before:JSON.stringify(current.transferArchive), startedAt:0, completedAt:0 };
    const instrumentedOpen = () => {
      record.userActivation = navigator.userActivation?.isActive === true; record.opened += 1;
      const popup = window.open('', '_blank'); if (!popup) return null;
      const write = popup.document.write.bind(popup.document); const close = popup.close.bind(popup);
      popup.document.write = (value) => { record.source=value; record.order.push('write'); return write(value); };
      popup.focus = () => record.order.push('focus');
      popup.print = () => { record.order.push('print'); if (mode === 'afterprint') popup.dispatchEvent(new popup.Event('afterprint')); };
      popup.close = () => { record.closeCount += 1; return close(); }; return popup;
    };
    if (mode === 'blocked') {
      window.open = () => { record.userActivation = navigator.userActivation?.isActive === true; return null; };
    }
    const options = { root:document.body, readState:()=>current, writeState:(next)=>{current=next;},
      render:()=>{}, cryptoRef:crypto, reportFailure:(error)=>record.failures.push(error.message),
      dependencies:{complete:()=>current,fail:()=>current} };
    if (mode !== 'blocked') options.openWindow = instrumentedOpen;
    const controller = controllers.createRevisionCompareTransferArchiveController(options);
    const button=document.createElement('button'); button.setAttribute('data-revc-print-transfer-archive','');
    button.addEventListener('click', () => { record.startedAt=performance.now(); void controller.handleClick(button)
      .finally(() => { record.completedAt=performance.now(); record.completed=true; }); });
    document.body.appendChild(button); window.__rc8Print={artifact,controller,current:()=>current,record};
  }, { workspace: structuredClone(workspace), mode });
}
async function runPrint(page, workspace, mode, destroy = false) {
  await mountPrintHarness(page, workspace, mode); await page.locator('[data-revc-print-transfer-archive]').click();
  await expect.poll(() => page.evaluate(() => window.__rc8Print.record.completed)).toBeTruthy();
  return page.evaluate((destroyNow) => {
    const value=window.__rc8Print; if (destroyNow) value.controller.destroy();
    const current=value.current(); return { ...value.record, exact:value.record.source===value.artifact.text,
      after:JSON.stringify(current.transferArchive),
      durationMs:value.record.completedAt-value.record.startedAt };
  }, destroy);
}

test('RC-XFER-008 native file navigation and hostile evidence remain inert', async ({ page }) => {
  const fixture = await transferArchiveFixture(); const artifact = await createRevisionCompareTransferArchiveArtifact(fixture.workspace);
  const normal = await temporaryArchive(artifact.text, artifact.filename); const hostile = hostileBundle(fixture.workspace.transferCompletion.bundle);
  const hostileArchive = await temporaryArchive(renderRevisionCompareTransferArchiveHtml(hostile), 'hostile.html');
  try {
    const result = await navigateNative(page, normal); expect(result.url).toBe(normal.url); expect(result.ready).toBe('complete');
    expect(result.visible).not.toBe('none'); expect(result.sheets).toBe(1); expect(result.scripts).toBe(1);
    expect(result.script).toEqual({ id:'revision-compare-transfer-handover', type:'application/json', src:null });
    expect(result.active).toEqual([]); expect(result.events).toEqual([]); expect(result.external).toEqual([]); expect(result.embedded).toEqual(fixture.workspace.transferCompletion.bundle);
    expect(result.csp).toContain("default-src 'none'"); expect(result.csp).not.toContain('frame-ancestors');
    expect(result.requests.filter((url)=>url!==normal.url)).toEqual([]); expect(result.errors).toEqual([]);
    const attack = await navigateNative(page, hostileArchive); expect(attack.embedded).toEqual(hostile);
    expect(attack.active).toEqual([]); expect(attack.events).toEqual([]); expect(attack.external).toEqual([]);
    expect(attack.base).toBe(hostileArchive.url); expect(attack.requests.filter((url)=>url!==hostileArchive.url)).toEqual([]);
    for (const value of hostileValues) await expect(page.locator('body')).toContainText(value);
  } finally { await rm(normal.directory,{recursive:true,force:true}); await rm(hostileArchive.directory,{recursive:true,force:true}); }
});

test('RC-XFER-008 current and historical downloads preserve exact retained bytes', async ({ page }) => {
  const fixture = await transferArchiveFixture();
  for (const status of ['CREATED','STALE']) {
    await mountDownloadHarness(page, fixture.workspace, status); const one=await downloadOnce(page); const two=await downloadOnce(page);
    const facts=await page.evaluate(()=>({artifact:window.__rc8.artifact,created:window.__rc8.created,revoked:window.__rc8.revoked,
      blobType:window.__rc8.blobType,anchors:document.querySelectorAll('a[download]').length,failures:window.__rc8.failures,actions:window.__rc8.actions}));
    expect(one.download.suggestedFilename()).toBe(facts.artifact.filename); expect(one.bytes.equals(two.bytes)).toBeTruthy();
    expect(one.bytes.equals(Buffer.from(facts.artifact.text,'utf8'))).toBeTruthy(); expect(digest(one.bytes)).toBe(facts.artifact.contentSha256);
    expect(one.bytes.byteLength).toBe(facts.artifact.sizeBytes); expect(facts).toMatchObject({created:2,revoked:2,blobType:'text/html',anchors:0,failures:[],actions:2});
    console.log(JSON.stringify({status,downloadOneMs:one.durationMs,downloadTwoMs:two.durationMs,bytes:one.bytes.byteLength}));
  }
});

test('RC-XFER-008 print source, popup failure, and cleanup use trusted activation', async ({ page }) => {
  const fixture = await transferArchiveFixture(); const printed=await runPrint(page,fixture.workspace,'afterprint');
  expect(printed.userActivation).toBeTruthy(); expect(printed.opened).toBe(1); expect(printed.exact).toBeTruthy();
  expect(printed.order).toEqual(['write','focus','print']); expect(printed.closeCount).toBe(1);
  expect(printed.before).toBe(printed.after);
  const retained=await runPrint(page,fixture.workspace,'destroy',true); expect(retained.userActivation).toBeTruthy();
  expect(retained.opened).toBe(1); expect(retained.closeCount).toBe(1); expect(retained.exact).toBeTruthy();
  const blocked=await runPrint(page,fixture.workspace,'blocked'); expect(blocked.userActivation).toBeTruthy(); expect(blocked.opened).toBe(0);
  expect(blocked.failures).toEqual(['The print window could not be opened.']); expect(blocked.before).toBe(blocked.after);
  console.log(JSON.stringify({printSourceInstallMs:printed.durationMs,popupBlocked:true,destroyClosed:true}));
});

test('RC-XFER-008 large native archive smoke retains first and last rows', async ({ page }) => {
  test.setTimeout(110_000); const fixture=await transferArchiveFixture(); const bundle=largeBundle(fixture.workspace.transferCompletion.bundle);
  const text=renderRevisionCompareTransferArchiveHtml(bundle); const archive=await temporaryArchive(text,'large.html');
  try { const result=await navigateNative(page,archive); const body=await page.locator('body').innerText();
    expect(body).toContain('difference:0'); expect(body).toContain('difference:7999'); expect(body).toContain('operation:0'); expect(body).toContain('operation:5999');
    expect(result.requests.filter((url)=>url!==archive.url)).toEqual([]); expect(result.errors).toEqual([]);
    console.log(JSON.stringify({htmlBytes:Buffer.byteLength(text),fileNavigationMs:result.durationMs,
      domContentLoadedMs:result.domContentLoadedMs,loadMs:result.loadMs,jsHeapUsedBytes:result.jsHeapUsedBytes,sha256:digest(text)}));
  } finally { await rm(archive.directory,{recursive:true,force:true}); }
});
