import { parseTable1 } from './pipeline-3d-model-geometry.js?v=20260711-collinear-1';
import {
  framesFromTable1,
  parseTable2Paste,
  parseTable3Paste,
} from './pipeline-3d-model-table-paste-parser.js?v=20260716-table-paste-1';
import {
  SAMPLE_TABLE_2_PASTE_MULTISHEET,
  SAMPLE_TABLE_3_PASTE_MULTISHEET,
} from './pipeline-3d-model-table-paste-samples.js?v=20260716-table-paste-samples-1';
import {
  installPipelineProfilePropagation,
} from './pipeline-3d-model-profile-propagation-runtime.js?v=20260722-p3d-base-039-1';
import { installPipelineElasticBendSettingsUi } from './pipeline-3d-model-elastic-bend-ui.js?v=20260722-p3d-base-039-1';

const STYLE_ID = 'pipeline-3d-model-table-paste-style';
const PATCHED = new WeakSet();

function ensureStyle(doc = globalThis.document) {
  if (!doc || doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
.p3d-table-paste-panel{border:1px solid rgba(56,189,248,.32);border-radius:10px;background:rgba(8,47,73,.16);padding:10px;gap:7px!important}
.p3d-table-paste-panel textarea{width:100%;min-height:150px;max-height:320px;resize:vertical;box-sizing:border-box;font-family:monospace;font-size:12px;background:#07101d;color:#e2e8f0;border:1px solid rgba(125,211,252,.34);border-radius:8px;padding:8px}
.p3d-table-paste-actions{display:flex;align-items:center;gap:10px;flex-wrap:wrap}
.p3d-table-paste-actions button{background:#0369a1;color:#fff;border:1px solid rgba(125,211,252,.45);border-radius:8px;padding:7px 11px;cursor:pointer;font-size:12px}
.p3d-table-paste-actions button:hover{background:#0284c7}
.p3d-table-paste-status{min-height:16px;font-size:11px;color:#cbd5e1}
.p3d-table-paste-status[data-state="ok"]{color:#bbf7d0}
.p3d-table-paste-status[data-state="error"]{color:#fecaca}
.p3d-raw-text-group{border:1px solid rgba(148,163,184,.25);border-radius:10px;background:#0b1220;overflow:hidden}
.p3d-raw-text-group>summary{cursor:pointer;padding:9px 11px;color:#93c5fd;font-weight:600;list-style-position:inside}
.p3d-raw-text-group[open]>summary{border-bottom:1px solid rgba(148,163,184,.18)}
.p3d-raw-text-group>.p3d-input-panel{padding:10px;border:0;border-radius:0}
`;
  doc.head?.appendChild(style);
}

function pastePanelHtml(kind) {
  const number = kind === 'table2' ? '2' : '3';
  const authority = kind === 'table2'
    ? 'Table 2 station/elevation values are the sole generated-geometry Z authority.'
    : 'Table 3 HLength, Z text and PMS values are marker evidence only; they do not alter generated geometry elevation.';
  return `<div class="p3d-input-panel p3d-table-paste-panel" data-p3d-table-paste-panel="${kind}">
<label class="p3d-input-title" for="pipeline-3d-model-${kind}-paste">Table ${number} Paste</label>
<div class="p3d-table-hint">Paste AutoCAD <code>_LIST</code> output. Local coordinates are used directly; global coordinates use the active Table 1 origin and angle. ${authority}</div>
<textarea id="pipeline-3d-model-${kind}-paste" data-p3d-table-paste="${kind}" spellcheck="false" placeholder="Paste AutoCAD _LIST output here"></textarea>
<div class="p3d-table-paste-actions">
<button type="button" data-p3d-table-transfer="${kind}">Transfer to Raw Table ${number} Text</button>
<span class="p3d-table-paste-status" data-p3d-table-paste-status="${kind}" aria-live="polite"></span>
</div>
</div>`;
}

function makeRawGroup(doc, title, panels) {
  const details = doc.createElement('details');
  details.className = 'p3d-raw-text-group';
  details.dataset.p3dRawTextGroup = title.includes('2') ? 'table2' : 'table3';
  const summary = doc.createElement('summary');
  summary.textContent = title;
  details.appendChild(summary);
  panels[0].before(details);
  panels.forEach((panel) => details.appendChild(panel));
  return details;
}

function setStatus(dialog, kind, message, state = '') {
  const status = dialog.querySelector(`[data-p3d-table-paste-status="${kind}"]`);
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}

function setRawValue(dialog, name, value) {
  const textarea = dialog.querySelector(`[data-p3d-split="${name}"]`);
  if (!textarea) throw new Error(`Raw target ${name} is not available.`);
  textarea.value = value;
  textarea.dispatchEvent(new Event('input', { bubbles: true }));
}

function setPasteValue(dialog, kind, value) {
  const textarea = dialog.querySelector(`[data-p3d-table-paste="${kind}"]`);
  if (!textarea) throw new Error(`Table ${kind === 'table2' ? '2' : '3'} Paste is not available.`);
  textarea.value = value;
}

function readFrames(dialog) {
  const table1Text = dialog.querySelector('[data-p3d="table1"]')?.value || '';
  return framesFromTable1(parseTable1(table1Text));
}

function transferTable2(dialog) {
  const source = dialog.querySelector('[data-p3d-table-paste="table2"]')?.value || '';
  const result = parseTable2Paste(source, { frames: readFrames(dialog) });
  setRawValue(dialog, 'table2a-raw', result.rawText);
  const warning = result.warnings.length ? ` ${result.warnings.join(' ')}` : '';
  setStatus(dialog, 'table2', `Transferred ${result.rows.length} row(s).${warning}`, 'ok');
  return result;
}

function transferTable3(dialog) {
  const source = dialog.querySelector('[data-p3d-table-paste="table3"]')?.value || '';
  const result = parseTable3Paste(source, { frames: readFrames(dialog) });
  setRawValue(dialog, 'table3a-raw', result.table3ARaw);
  setRawValue(dialog, 'table3b-raw', result.table3BRaw);
  setRawValue(dialog, 'table3c-raw', result.table3CRaw);
  setStatus(
    dialog,
    'table3',
    `Transferred ${result.lengthRows.length} H-length, ${result.zRows.length} Z, and ${result.markerRows.length} marker row(s).`,
    'ok',
  );
  return result;
}

export function loadMultiSheetPasteSamples(dialog) {
  setPasteValue(dialog, 'table2', SAMPLE_TABLE_2_PASTE_MULTISHEET);
  setPasteValue(dialog, 'table3', SAMPLE_TABLE_3_PASTE_MULTISHEET);
  const table2 = transferTable2(dialog);
  const table3 = transferTable3(dialog);
  return { table2, table3 };
}

function wireTransfers(dialog) {
  dialog.addEventListener('click', (event) => {
    const button = event.target instanceof Element ? event.target.closest('[data-p3d-table-transfer]') : null;
    if (!button) return;
    const kind = button.dataset.p3dTableTransfer;
    try {
      if (kind === 'table2') transferTable2(dialog);
      else if (kind === 'table3') transferTable3(dialog);
    } catch (error) {
      setStatus(dialog, kind, error instanceof Error ? error.message : 'Transfer failed.', 'error');
    }
  });
}

function wireMultiSheetSample(dialog) {
  const button = dialog.querySelector('[data-p3d="new-multisheet"]');
  if (!button) return;
  button.addEventListener('click', () => {
    setTimeout(() => {
      try {
        loadMultiSheetPasteSamples(dialog);
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Multi-sheet paste samples could not be loaded.';
        setStatus(dialog, 'table2', message, 'error');
        setStatus(dialog, 'table3', message, 'error');
      }
    }, 0);
  });
}

export function patchPipeline3dTablePasteDialog(dialog) {
  if (!dialog || PATCHED.has(dialog)) return Boolean(dialog);
  const table2Panel = dialog.querySelector('[data-p3d-split-panel="table2a-raw"]');
  const table3Panels = ['table3a-raw', 'table3b-raw', 'table3c-raw']
    .map((name) => dialog.querySelector(`[data-p3d-split-panel="${name}"]`));
  if (!table2Panel || table3Panels.some((panel) => !panel)) return false;
  PATCHED.add(dialog);
  ensureStyle(dialog.ownerDocument || globalThis.document);

  const table2Group = makeRawGroup(dialog.ownerDocument, 'Raw Table 2 Text', [table2Panel]);
  table2Group.insertAdjacentHTML('beforebegin', pastePanelHtml('table2'));

  const table3Group = makeRawGroup(dialog.ownerDocument, 'Raw Table 3 Text', table3Panels);
  table3Group.insertAdjacentHTML('beforebegin', pastePanelHtml('table3'));

  wireTransfers(dialog);
  wireMultiSheetSample(dialog);
  installPipelineProfilePropagation(dialog);
  installPipelineElasticBendSettingsUi(dialog);
  return true;
}

function patchAll(doc) {
  doc?.querySelectorAll?.('.pipeline-3d-model-dialog').forEach((dialog) => patchPipeline3dTablePasteDialog(dialog));
}

export function installPipeline3dTablePasteAddon(container, doc = container?.ownerDocument || globalThis.document) {
  ensureStyle(doc);
  patchAll(doc);
  const handleClick = (event) => {
    const launcher = event.target instanceof Element ? event.target.closest('[data-p3d-open="1"]') : null;
    if (!launcher) return;
    queueMicrotask(() => patchAll(doc));
    setTimeout(() => patchAll(doc), 0);
  };
  container?.addEventListener?.('click', handleClick);
  return () => container?.removeEventListener?.('click', handleClick);
}

export const _test = Object.freeze({ pastePanelHtml, loadMultiSheetPasteSamples });
