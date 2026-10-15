import { mountCiiWorkspaceScopedEngineeringShell } from './cii-workspace-transfer-scope-ui.js';
import { mountCiiWriter2MultiSourceReviewRouter } from './cii-workspace-multisource-review-only-filter-shell.js?v=20260909-ms-review-filters-1';
import { mountCiiWriter2MultiSourceNextStepShell } from './cii-workspace-multisource-next-step-shell.js?v=20260909-ms-custody-auto-1';
import { mountCiiFindReplaceShell } from './cii-workspace-find-replace-ui.js?v=20260904-padded-find-scroll-1';

const STYLE_ID = 'cii-workspace-style';
const ENGINEERING_STYLE_ID = 'cii-workspace-engineering-style';
const FIND_REPLACE_STYLE_ID = 'cii-workspace-find-replace-style';
const SIF_CONTEXT_AUTHORITY = 'ENGINEER_ATTESTED_SAME_ACTIVE_PIPING_CODE';
function stylesheet(documentRef, id, relativeUrl) {
  const href = new URL(relativeUrl, import.meta.url).href;
  const existing = documentRef.getElementById(id);
  if (existing) {
    if (existing.href !== href) existing.href = href;
    return;
  }
  const link = documentRef.createElement('link'); link.id = id; link.rel = 'stylesheet';
  link.href = href; documentRef.head.appendChild(link);
}
function ensureStylesheet(documentRef) {
  stylesheet(documentRef, STYLE_ID, './cii-workspace.css');
  stylesheet(documentRef, ENGINEERING_STYLE_ID, './cii-workspace-engineering-ui.css');
  stylesheet(documentRef, FIND_REPLACE_STYLE_ID, './cii-workspace-find-replace.css?v=20260904-padded-find-scroll-1');
}
function installWriter1CSifContextControls(root, state) {
  const panel = root.querySelector('[data-ciiw-panel="inputs"]'); if (!panel) return () => {};
  const section = root.ownerDocument.createElement('section'); section.className = 'ciiw-sif-context'; section.setAttribute('data-ciiw-sif-context', '1');
  section.innerHTML = `<h3>Writer 1C SIF engineering context</h3><p>Required only for Version-11 item3/item4 ii/io mutation. Enter the active piping-code basis on both models and explicitly attest that the basis is the same.</p><div class="ciiw-intake"><label>SOURCE active piping code <input type="text" data-ciiw-sif-source-code placeholder="e.g. ASME B31.3-2018"></label><label>TARGET active piping code <input type="text" data-ciiw-sif-target-code placeholder="e.g. ASME B31.3-2018"></label><label><input type="checkbox" data-ciiw-sif-code-attest> I attest that SOURCE and TARGET use the same active piping-code basis for these SIF values.</label></div><small>Changing this context invalidates the current mutation authorization. Run Compare models again before Writer 1C authorization.</small>`;
  panel.appendChild(section);
  const source = section.querySelector('[data-ciiw-sif-source-code]'); const target = section.querySelector('[data-ciiw-sif-target-code]'); const attest = section.querySelector('[data-ciiw-sif-code-attest]');
  source.value = state.sourceCode || ''; target.value = state.targetCode || ''; attest.checked = state.authority === SIF_CONTEXT_AUTHORITY;
  const update = () => {
    state.sourceCode = source.value.trim(); state.targetCode = target.value.trim();
    state.authority = attest.checked ? SIF_CONTEXT_AUTHORITY : null;
    const apply = root.querySelector('[data-ciiw-apply-target]'); if (apply) apply.disabled = true;
    const status = root.querySelector('[data-ciiw-status]'); if (status) status.textContent = 'SIF piping-code context changed. Run Compare models again before Writer 1C authorization.';
  };
  source.addEventListener('input', update); target.addEventListener('input', update); attest.addEventListener('change', update);
  return () => { source.removeEventListener('input', update); target.removeEventListener('input', update); attest.removeEventListener('change', update); section.remove(); };
}

function workspaceTile(documentRef, attribute, title, description) {
  const tile = documentRef.createElement('button'); tile.type = 'button';
  tile.className = 'psmap-card psmap-tile'; tile.setAttribute(attribute, '1');
  tile.innerHTML = `<b>${title}</b><span>${description}</span>`;
  return tile;
}

export function installCiiWorkspaceTile(container, context = {}) {
  ensureStylesheet(container.ownerDocument);
  if (container.querySelector('[data-ciiw-open]')) return () => {};
  const tile = workspaceTile(
    container.ownerDocument,
    'data-ciiw-open',
    'CII Workspace',
    'Method-qualified model correspondence and explicitly scoped target transfer review',
  );
  container.appendChild(tile);
  const writer2Tile = context.writerVersion ? null : workspaceTile(
    container.ownerDocument,
    'data-ciiw-open-writer2',
    'CII Writer 2 — V11 / V14',
    'Explicit Writer 2 cardinality transfer using V11 authority and the frozen V11↔V14 bridge',
  );
  if (writer2Tile) container.appendChild(writer2Tile);
  const findReplaceTile = context.writerVersion ? null : workspaceTile(
    container.ownerDocument,
    'data-ciiw-open-find-replace',
    '↔ CII Find & Replace — V14',
    'CSV/manual-table preview, exact scoped validation and qualified in-memory postimage',
  );
  if (findReplaceTile) container.appendChild(findReplaceTile);

  let overlay = null; let active = null; let disposeSifContext = null;
  const close = () => { disposeSifContext?.(); active?.destroy(); overlay?.remove(); disposeSifContext = null; active = null; overlay = null; };
  const open = (writerVersionOverride = null) => {
    if (active) return;
    const writerVersion = writerVersionOverride || context.writerVersion || null;
    overlay = container.ownerDocument.createElement('div'); overlay.className = 'ciiw-backdrop';
    container.ownerDocument.body.appendChild(overlay);
    const sifEngineeringContext = {
      authority: context.sifEngineeringContext?.authority || null,
      sourceCode: String(context.sifEngineeringContext?.sourceCode || ''),
      targetCode: String(context.sifEngineeringContext?.targetCode || ''),
    };
    const mountEngineeringShell = writerVersion === '2'
      ? (root, shellOptions) => mountCiiWriter2MultiSourceNextStepShell(root, shellOptions, mountCiiWriter2MultiSourceReviewRouter)
      : mountCiiWorkspaceScopedEngineeringShell;
    active = mountEngineeringShell(overlay, {
      close, showToast: context.showToast,
      ...(writerVersion ? { writerVersion } : {}),
      ...(writerVersion === '1C' ? { sifEngineeringContext } : {}),
    });
    if (writerVersion === '1C') disposeSifContext = installWriter1CSifContextControls(overlay, sifEngineeringContext);
  };
  const openFindReplace = () => {
    if (active) return;
    overlay = container.ownerDocument.createElement('div'); overlay.className = 'ciiw-backdrop';
    container.ownerDocument.body.appendChild(overlay);
    active = mountCiiFindReplaceShell(overlay, {
      close,
      showToast: context.showToast,
      downloadJson: context.downloadJson,
    });
  };
  const openDefault = () => open();
  const openWriter2 = () => open('2');
  tile.addEventListener('click', openDefault);
  writer2Tile?.addEventListener('click', openWriter2);
  findReplaceTile?.addEventListener('click', openFindReplace);
  return () => {
    tile.removeEventListener('click', openDefault);
    writer2Tile?.removeEventListener('click', openWriter2);
    findReplaceTile?.removeEventListener('click', openFindReplace);
    close(); tile.remove(); writer2Tile?.remove(); findReplaceTile?.remove();
  };
}

export const _test = Object.freeze({ ensureStylesheet, installWriter1CSifContextControls, workspaceTile });