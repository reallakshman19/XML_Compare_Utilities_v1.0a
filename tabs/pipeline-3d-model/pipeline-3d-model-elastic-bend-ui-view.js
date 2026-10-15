import { bendCommonHtml, bendPolicyHtml } from './pipeline-3d-model-elastic-bend-ui-policy-view.js?v=20260721-p3d-meta-phase1-2';

export function bendField(page, key) {
  return page.querySelector(`[data-p3d-elastic-field="${key}"]`);
}

function visible(page, selector, show) {
  for (const element of page.querySelectorAll(selector)) element.hidden = !show;
}

export function bendSettingsPageHtml() {
  return `<section class="p3d-elastic-page" data-p3d-elastic-page hidden><div class="p3d-elastic-head"><div><h3>Pipeline Bend Settings</h3><p>Explicit policy, classification and geometry evidence only. Pressure, temperature, installation and buckling verification remain external.</p></div><div class="p3d-elastic-actions"><button data-p3d-elastic-action="reset">Reset</button><button data-p3d-elastic-action="preview">Preview</button><button data-p3d-elastic-action="download">Download Ledger</button><button data-p3d-elastic-action="save" data-primary>Save & Apply</button><button data-p3d-elastic-action="close">Close</button></div></div><div class="p3d-elastic-body"><div class="p3d-elastic-card"><h4>Policy and geometry inputs</h4>${bendPolicyHtml()}${bendCommonHtml()}<div class="p3d-elastic-status" data-p3d-elastic-status></div></div><div class="p3d-elastic-card"><h4>Resolution and candidate ledger</h4><div class="p3d-elastic-summary" data-p3d-elastic-summary></div><div class="p3d-elastic-result" data-p3d-elastic-result>Preview to calculate.</div><div class="p3d-elastic-warnings" data-p3d-elastic-warnings></div></div></div></section>`;
}

function syncPreset(page) {
  const multiplier = Number(bendField(page, 'coldFieldRadiusMultiplierD')?.value);
  const preset = page.querySelector('[data-p3d-cold-preset]');
  if (preset) preset.value = [40, 60].includes(multiplier) ? String(multiplier) : 'custom';
}

export function syncBendSettingsVisibility(page) {
  const basis = bendField(page, 'designBasis')?.value || 'default-metallic';
  const mode = bendField(page, 'classificationMode')?.value || 'source-authority-auto';
  const coldMode = bendField(page, 'coldFieldRadiusMode')?.value || 'project-multiplier';
  const shortMode = bendField(page, 'shortElementAnglePolicy')?.value || 'include-all';
  for (const section of page.querySelectorAll('[data-p3d-basis]')) {
    section.hidden = section.dataset.p3dBasis !== basis;
  }
  visible(page, '[data-p3d-legacy-class]', basis === 'asme-b31.4' && mode === 'legacy-global');
  visible(page, '[data-p3d-cold-multiplier]', basis === 'asme-b31.4' && coldMode === 'project-multiplier');
  visible(page, '[data-p3d-size-band]', basis === 'asme-b31.4' && coldMode === 'b31.4-size-band');
  visible(page, '[data-p3d-short-threshold]', shortMode === 'ignore-below-length');
  const emit = bendField(page, 'emitToInputXml');
  if (emit) emit.disabled = basis === 'gre';
  syncPreset(page);
}

export function writeBendSettings(page, settings) {
  for (const [key, value] of Object.entries(settings)) {
    const input = bendField(page, key);
    if (!input) continue;
    if (input.type === 'checkbox') input.checked = Boolean(value);
    else input.value = value ?? '';
  }
  syncBendSettingsVisibility(page);
}

export function readBendSettings(page, normalize) {
  const value = {};
  for (const input of page.querySelectorAll('[data-p3d-elastic-field]')) {
    value[input.dataset.p3dElasticField] = input.type === 'checkbox' ? input.checked : input.value;
  }
  return normalize(value);
}
