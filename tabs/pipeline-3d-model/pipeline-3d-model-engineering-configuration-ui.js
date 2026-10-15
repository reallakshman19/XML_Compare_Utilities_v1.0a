import {
  createEmptyPipelineEngineeringConfigurationDraft,
  setPipelineEngineeringConfigurationField,
  updatePipelineEngineeringConfigurationDraftCollections,
} from './pipeline-3d-model-engineering-configuration-fields.js';
import {
  PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY,
  confirmPipelineEngineeringConfigurationFields,
  loadPipelineEngineeringConfigurationDraft,
  rejectAllPipelineEngineeringLegacyFields,
  rejectPipelineEngineeringConfigurationFields,
  savePipelineEngineeringConfigurationDraft,
} from './pipeline-3d-model-engineering-configuration-storage.js';
import {
  buildPipelineEngineeringConfigurationPlan,
  buildPipelineEngineeringConfigurationTsv,
} from './pipeline-3d-model-engineering-configuration.js';
import {
  buildPipelineEngineeringConfigurationBlockerText,
  buildPipelineEngineeringConfigurationJson,
} from './pipeline-3d-model-engineering-configuration-contracts.js';
import {
  PIPELINE_SECTION_PROPERTY_FIELD_IDS,
  pipelineSectionPropertyAssignmentId,
} from './pipeline-3d-model-section-property-assignment.js';
import {
  analysisSectionRowHtml,
  engineeringConfigurationEscapeHtml,
  engineeringConfigurationHtml,
} from './pipeline-3d-model-engineering-configuration-ui-view.js';

const INSTANCES = new WeakMap();
const STATUS = Object.freeze({ SOURCE_DERIVED: 'Source-derived', USER_ENTERED: 'User-entered',
  LEGACY_UNCONFIRMED: 'Legacy — confirmation required', CONFIRMED: 'Confirmed legacy',
  UNSET: 'Missing', INVALID: 'Invalid', NOT_APPLICABLE: 'Not applicable' });
const STYLE_ID = 'pipeline-engineering-configuration-style';
const text = (value) => String(value ?? '').trim();
function ensureStyle(doc) {
  if (doc.getElementById(STYLE_ID)) return;
  const style = doc.createElement('style'); style.id = STYLE_ID;
  style.textContent = `.p3d-engineering-config{width:min(1180px,96vw);max-height:94vh;padding:0;background:#07101d;color:#e2e8f0;border:1px solid #475569;border-radius:12px}
.p3d-engineering-config::backdrop{background:rgba(2,6,23,.78)}.p3d-engineering-config header,.p3d-engineering-config footer{display:flex;gap:10px;align-items:center;justify-content:space-between;padding:12px 16px;background:#0f172a;position:sticky;z-index:3}.p3d-engineering-config header{top:0}.p3d-engineering-config footer{bottom:0;flex-wrap:wrap}.p3d-engineering-config h3,.p3d-engineering-config h4,.p3d-engineering-config h5{margin:0 0 8px}.p3d-engineering-config p{margin:3px 0}.p3d-config-body{padding:12px;display:grid;gap:10px}.p3d-config-section{border:1px solid #334155;border-radius:9px;padding:11px;background:#0b1220}.p3d-config-grid,.p3d-config-section-row,.p3d-config-assignment-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:9px}.p3d-config-section-row{border-top:1px solid #334155;padding:10px 0}.p3d-config-section label{display:grid;gap:4px;font-size:12px}.p3d-config-section input,.p3d-config-section select{background:#020617;color:#e2e8f0;border:1px solid #475569;border-radius:6px;padding:7px}.p3d-config-section input[readonly]{background:#172033;color:#cbd5e1;border-style:dashed}.p3d-config-section small{color:#94a3b8}.p3d-config-section small[data-state="INVALID"],.p3d-config-section small[data-state="LEGACY_UNCONFIRMED"]{color:#fca5a5}.p3d-config-check{grid-template-columns:auto 1fr;align-items:center}.p3d-config-check small{grid-column:2}.p3d-config-actions{display:flex;gap:7px;flex-wrap:wrap}.p3d-config-actions button{border:1px solid #475569;border-radius:7px;background:#1e293b;color:#fff;padding:7px 10px}.p3d-config-actions button:disabled{opacity:.45}.p3d-config-actions.compact{margin-top:8px}.p3d-config-note{color:#cbd5e1;font-size:12px}.p3d-engineering-config pre{white-space:pre-wrap;max-height:280px;overflow:auto;background:#020617;padding:9px;border-radius:6px}.p3d-config-legacy-row{display:flex;align-items:center;gap:8px;padding:5px 0;border-bottom:1px solid #1e293b}.p3d-config-boundary-evidence{font-size:12px;color:#cbd5e1}.p3d-config-assignment-grid fieldset{border:1px solid #334155}.p3d-config-assignment-grid label{display:flex;grid-template-columns:auto 1fr;align-items:center}.p3d-assignment-table{width:100%;border-collapse:collapse;font-size:12px}.p3d-assignment-table th,.p3d-assignment-table td{border:1px solid #334155;padding:5px;text-align:left}`;
  doc.head.appendChild(style);
}
function saveText(doc, name, content, mime) {
  const blob = new Blob([content], { type: mime }), url = URL.createObjectURL(blob);
  const link = doc.createElement('a'); link.href = url; link.download = name;
  doc.body.appendChild(link); link.click(); link.remove(); URL.revokeObjectURL(url);
}
function toolbarButton(host) {
  const existing = host.querySelector('[data-p3d-engineering-config-open]'); if (existing) return existing;
  const button = host.ownerDocument.createElement('button'); button.type = 'button';
  button.dataset.p3dEngineeringConfigOpen = 'true'; button.textContent = 'Engineering Configuration';
  const anchor = host.querySelector('[data-p3d="run"]')?.parentElement || host.querySelector('.p3d-toolbar') || host;
  anchor.appendChild(button); return button;
}
function fieldElement(modal, fieldId) {
  return modal.querySelector(`[data-p3d-config-field="${CSS.escape(fieldId)}"]`);
}
function renderField(modal, field) {
  const element = fieldElement(modal, field.fieldId); if (!element) return;
  element.value = field.value === true ? 'true' : field.value === false ? 'false' : field.value ?? '';
  const status = modal.querySelector(`[data-p3d-config-status="${CSS.escape(field.fieldId)}"]`);
  if (status) { status.textContent = STATUS[field.state] || field.state; status.dataset.state = field.state; }
}
function canonicalSections(instance) {
  return instance.canonicalAnalysisSectionPlan?.sections || [];
}
function evidenceFor(instance, canonical, index) {
  const supplied = instance.draft.sections[index];
  if (supplied?.analysisSectionId === canonical.analysisSectionId
    && supplied.startElementIndex === canonical.startElementIndex) return supplied;
  return { analysisSectionId: canonical.analysisSectionId, startElementIndex: canonical.startElementIndex,
    boundaryAuthority: canonical.boundaryAuthority,
    boundarySourceReference: canonical.boundarySourceReference };
}
function renderSections(instance) {
  const host = instance.modal.querySelector('[data-p3d-config-sections]'); if (!host) return;
  const canonical = canonicalSections(instance);
  if (!canonical.length) { host.textContent = 'Canonical analysis-section plan unavailable. Run geometry analysis first.'; return; }
  const rows = canonical.map((section, index) => ({ ...section, ...evidenceFor(instance, section, index),
    analysisSectionId: section.analysisSectionId, startElementIndex: section.startElementIndex,
    boundaryAuthority: section.boundaryAuthority,
    boundarySourceReference: section.boundarySourceReference }));
  host.innerHTML = rows.map(analysisSectionRowHtml).join('');
  rows.forEach((section, index) => {
    for (const key of ['profileId', 'outsideDiameterMm', 'nominalPipeSizeNps', 'greVendorNominalBoreMm']) {
      const element = fieldElement(instance.modal, `section:${index}:${key}`);
      if (element) element.value = section[key] ?? '';
    }
    const status = instance.modal.querySelector(`[data-p3d-config-section-status="${index}"]`);
    const result = instance.plan?.analysisSections?.[index];
    const blocked = !result || (result.blockerCodes || []).length > 0;
    if (status) status.textContent = blocked ? 'Invalid' : 'User-entered';
  });
}
function sourceFieldLabels() {
  return Object.fromEntries(PIPELINE_SECTION_PROPERTY_FIELD_IDS.map((fieldId) => [fieldId,
    fieldId.replace(/([A-Z]|\d+)/g, ' $1').trim()]));
}
function renderAssignmentControls(instance) {
  const targets = instance.modal.querySelector('[data-p3d-config-assignment-targets]');
  const fields = instance.modal.querySelector('[data-p3d-config-assignment-fields]');
  if (!targets || !fields) return;
  const sections = canonicalSections(instance).filter((item) => item.startElementIndex > 0);
  targets.innerHTML = sections.length ? sections.map((item) => `<label><input type="checkbox" data-p3d-assignment-target="${engineeringConfigurationEscapeHtml(item.analysisSectionId)}">${engineeringConfigurationEscapeHtml(item.analysisSectionId)}</label>`).join('')
    : '<span>Not applicable — no later sections.</span>';
  const values = instance.plan?.sectionPropertyAssignmentPlan?.sourceValues || {};
  const labels = sourceFieldLabels();
  fields.innerHTML = Object.keys(values).map((fieldId) => `<label><input type="checkbox" data-p3d-assignment-field="${engineeringConfigurationEscapeHtml(fieldId)}">${engineeringConfigurationEscapeHtml(labels[fieldId] || fieldId)} = ${engineeringConfigurationEscapeHtml(values[fieldId])}</label>`).join('')
    || '<span>No assignable branch values are present.</span>';
}
function renderAssignmentReview(instance) {
  const host = instance.modal.querySelector('[data-p3d-config-assignment-review]'); if (!host) return;
  const assignments = instance.plan?.sectionPropertyAssignmentPlan?.assignments || [];
  if (!assignments.length) { host.textContent = 'No assignment transactions recorded.'; return; }
  const rows = assignments.map((item, index) => `<tr><td>${engineeringConfigurationEscapeHtml(item.transactionId)}</td>
<td>${engineeringConfigurationEscapeHtml(item.analysisSectionIds.join(', '))}</td>
<td>${engineeringConfigurationEscapeHtml(item.fieldIds.join(', '))}</td>
<td>${engineeringConfigurationEscapeHtml(JSON.stringify(item.assignedValues))}</td>
<td>${engineeringConfigurationEscapeHtml(`${item.sourceKind}:${item.sourceReference}`)}</td>
<td>${item.ready ? 'Ready' : 'Invalid'}</td><td><button type="button" data-p3d-config-remove-assignment="${index}">Remove</button></td></tr>`).join('');
  host.innerHTML = `<table class="p3d-assignment-table"><thead><tr><th>Transaction</th><th>Targets</th><th>Fields</th><th>Values</th><th>Provenance</th><th>Status</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}
function renderLegacy(instance) {
  const host = instance.modal.querySelector('[data-p3d-config-legacy]'); if (!host) return;
  const fields = Object.values(instance.draft.fields).filter((item) => item.legacyObserved);
  if (!fields.length) { host.textContent = 'No legacy evidence observed.'; return; }
  host.innerHTML = fields.map((item) => `<div class="p3d-config-legacy-row"><code>${engineeringConfigurationEscapeHtml(item.fieldId)}</code>
<span>${engineeringConfigurationEscapeHtml(item.value)}</span><span>${STATUS[item.state] || item.state}</span>
<button type="button" data-p3d-config-confirm="${engineeringConfigurationEscapeHtml(item.fieldId)}">Confirm</button>
<button type="button" data-p3d-config-reject="${engineeringConfigurationEscapeHtml(item.fieldId)}">Reject</button></div>`).join('')
    + '<div class="p3d-config-actions compact"><button type="button" data-p3d-config-action="confirm-legacy">Confirm all observed</button><button type="button" data-p3d-config-action="reject-legacy">Reject all legacy</button></div>';
}
function renderDerivedGre(instance) {
  const input = fieldElement(instance.modal, 'greBendBreakLengthMm');
  const inputStatus = instance.modal.querySelector('[data-p3d-config-status="greBendBreakLengthMm"]');
  const output = instance.modal.querySelector('[data-p3d-derived-gre-break]');
  const outputStatus = instance.modal.querySelector('[data-p3d-derived-gre-break-status]');
  if (!input || !inputStatus || !output || !outputStatus) return;
  const multiplier = instance.draft.fields.greBendBreakLengthBasis?.value === 'NOMINAL_BORE_MULTIPLIER';
  input.readOnly = multiplier;
  if (multiplier) input.setAttribute('aria-readonly', 'true'); else input.removeAttribute('aria-readonly');
  const bore = Number(instance.draft.fields.greVendorNominalBoreMm?.value);
  const factor = Number(instance.draft.fields.greBendBreakMultiplierBore?.value);
  const derived = multiplier && Number.isFinite(bore) && bore > 0 && Number.isFinite(factor) && factor > 0
    ? bore * factor : null;
  output.value = derived === null ? '' : String(derived);
  output.textContent = derived === null ? 'Missing' : String(derived);
  outputStatus.textContent = multiplier ? (derived === null ? 'Missing' : 'Source-derived') : 'Not applicable';
  outputStatus.dataset.state = multiplier ? (derived === null ? 'UNSET' : 'SOURCE_DERIVED') : 'NOT_APPLICABLE';
  if (multiplier) {
    const explicitPresent = instance.draft.fields.greBendBreakLengthMm?.value !== null;
    inputStatus.textContent = explicitPresent ? 'Invalid' : 'Not applicable';
    inputStatus.dataset.state = explicitPresent ? 'INVALID' : 'NOT_APPLICABLE';
  }
}
function render(instance, validate = true) {
  Object.values(instance.draft.fields).forEach((field) => renderField(instance.modal, field));
  if (validate) instance.plan = buildPipelineEngineeringConfigurationPlan(instance.draft, {
    canonicalAnalysisSectionPlan: instance.canonicalAnalysisSectionPlan });
  renderSections(instance); renderAssignmentControls(instance); renderAssignmentReview(instance);
  renderLegacy(instance); renderDerivedGre(instance);
  const summary = instance.modal.querySelector('[data-p3d-config-summary]');
  if (summary) summary.textContent = instance.plan?.ready
    ? 'Ready — configuration, assignments and canonical section evidence are complete.'
    : `Blocked — ${instance.plan?.blockerCodes?.length || 0} blocker(s).`;
  const preview = instance.modal.querySelector('[data-p3d-config-preview]');
  if (preview) preview.textContent = buildPipelineEngineeringConfigurationJson(instance.plan || instance.draft);
  const diameter = instance.modal.querySelector('[data-p3d-config-diameter-preview]');
  if (diameter) diameter.textContent = (instance.plan?.analysisSections || []).map((section) =>
    `${section.analysisSectionId}: ${section.profileId || 'Missing profile'} — OD ${section.outsideDiameterMm ?? 'Missing'} mm — ${(section.blockerCodes || []).length ? 'Invalid' : 'User-entered'}`).join('\n') || 'No canonical sections available.';
  const apply = instance.modal.querySelector('[data-p3d-config-action="apply"]');
  if (apply) apply.disabled = instance.plan?.ready !== true;
}
function canonicalEvidenceRows(instance) {
  return canonicalSections(instance).map((section, index) => ({ ...evidenceFor(instance, section, index),
    analysisSectionId: section.analysisSectionId, startElementIndex: section.startElementIndex,
    boundaryAuthority: section.boundaryAuthority, boundarySourceReference: section.boundarySourceReference }));
}
function sectionInput(instance, fieldId, raw) {
  const [, indexText, key] = fieldId.split(':'), index = Number(indexText);
  if (!['profileId', 'outsideDiameterMm', 'nominalPipeSizeNps', 'greVendorNominalBoreMm'].includes(key)) return;
  const sections = canonicalEvidenceRows(instance); if (!sections[index]) return;
  sections[index][key] = raw === '' ? null : (key === 'profileId' ? raw : Number(raw));
  sections[index].sourceAuthority = 'ENGINEERING_CONFIGURATION';
  sections[index].sourceReference = `engineering-configuration:${sections[index].analysisSectionId}`;
  instance.draft = updatePipelineEngineeringConfigurationDraftCollections(instance.draft, { sections });
}
function onField(instance, target) {
  const fieldId = target?.dataset?.p3dConfigField; if (!fieldId || target.readOnly) return;
  const raw = target.value;
  if (fieldId.startsWith('section:')) sectionInput(instance, fieldId, raw);
  else instance.draft = setPipelineEngineeringConfigurationField(instance.draft, fieldId, raw);
  render(instance);
}
function selected(modal, attribute) {
  return Array.from(modal.querySelectorAll(`[${attribute}]:checked`)).map((item) => item.getAttribute(attribute));
}
function assignProperties(instance) {
  const analysisSectionIds = selected(instance.modal, 'data-p3d-assignment-target');
  const fieldIds = selected(instance.modal, 'data-p3d-assignment-field');
  const userConfirmed = instance.modal.querySelector('[data-p3d-config-assignment-confirm]')?.checked === true;
  const source = instance.plan?.sectionPropertyAssignmentPlan?.sourceValues || {};
  const values = Object.fromEntries(fieldIds.filter((fieldId) => Object.hasOwn(source, fieldId))
    .map((fieldId) => [fieldId, source[fieldId]]));
  const assignment = { analysisSectionIds, fieldIds, sourceKind: 'BRANCH_INPUT_BLOCK',
    sourceReference: 'engineering-configuration:branch', userConfirmed,
    sourceValues: values, assignedValues: values };
  assignment.transactionId = pipelineSectionPropertyAssignmentId(assignment);
  instance.draft = updatePipelineEngineeringConfigurationDraftCollections(instance.draft, {
    sectionPropertyAssignments: [...instance.draft.sectionPropertyAssignments, assignment] });
  render(instance);
}
function removeAssignment(instance, index) {
  instance.draft = updatePipelineEngineeringConfigurationDraftCollections(instance.draft, {
    sectionPropertyAssignments: instance.draft.sectionPropertyAssignments.filter((_, itemIndex) => itemIndex !== index) });
  render(instance);
}
function apply(instance) {
  render(instance); if (!instance.plan.ready) return;
  instance.draft = savePipelineEngineeringConfigurationDraft(instance.draft);
  instance.host.dispatchEvent(new CustomEvent('pipeline-engineering-configuration-apply', {
    bubbles: true, detail: { draft: instance.draft, plan: instance.plan } }));
  instance.host.querySelector('[data-p3d="run"]')?.click();
}
function importVisibleBranch(instance) {
  const mapping = { jobName: 'jobName', issueNo: 'issueNo', caesarVersion: 'caesarVersion',
    branchName: 'branchName', lineNo: 'lineNo', outsideDiameterMm: 'outsideDiameterMm',
    wallThickness: 'wallThickness', materialCode: 'materialNumber', corrosionAllowance: 'corrosionAllowance',
    insulationThickness: 'insulationThickness', insulationDensity: 'insulationDensity',
    fluidDensity: 'fluidDensity', hydroPressure: 'hydroPressure' };
  for (let index = 1; index <= 9; index += 1) {
    mapping[`p${index}`] = `pressure${index}`; mapping[`t${index}`] = `temperature${index}`;
  }
  let draft = instance.draft;
  for (const [sourceKey, fieldId] of Object.entries(mapping)) {
    const raw = instance.host.querySelector(`[data-p3d-field="${sourceKey}"]`)?.value;
    if (raw === undefined || raw === '') continue;
    draft = setPipelineEngineeringConfigurationField(draft, fieldId, raw, {
      state: 'CONFIRMED', sourceKind: 'BRANCH_INPUT_BLOCK', userConfirmed: true,
      sourceReference: `visible-branch-block:${sourceKey}` });
  }
  instance.draft = draft; render(instance);
}
function clearDraft(instance) {
  let draft = createEmptyPipelineEngineeringConfigurationDraft(PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY);
  draft = updatePipelineEngineeringConfigurationDraftCollections(draft, { sections: canonicalEvidenceRows(instance) });
  instance.draft = savePipelineEngineeringConfigurationDraft(draft); render(instance);
}
function action(instance, name) {
  if (name === 'close') { instance.modal.close(); return; }
  if (name === 'save') { instance.draft = savePipelineEngineeringConfigurationDraft(instance.draft); render(instance); return; }
  if (name === 'validate') { render(instance); return; }
  if (name === 'apply') { apply(instance); return; }
  if (name === 'import-branch') { importVisibleBranch(instance); return; }
  if (name === 'assign-properties') { assignProperties(instance); return; }
  if (name === 'clear') { clearDraft(instance); return; }
  if (name === 'confirm-legacy') { instance.draft = confirmPipelineEngineeringConfigurationFields(instance.draft,
    Object.values(instance.draft.fields).filter((item) => item.legacyObserved).map((item) => item.fieldId)); render(instance); return; }
  if (name === 'reject-legacy') { instance.draft = rejectAllPipelineEngineeringLegacyFields(instance.draft); render(instance); return; }
  const exports = {
    'export-json': ['pipeline-engineering-configuration.json', buildPipelineEngineeringConfigurationJson(instance.plan), 'application/json'],
    'export-tsv': ['pipeline-engineering-configuration.tsv', buildPipelineEngineeringConfigurationTsv(instance.plan), 'text/tab-separated-values'],
    'export-blockers': ['pipeline-engineering-configuration-blockers.tsv', buildPipelineEngineeringConfigurationBlockerText(instance.plan), 'text/tab-separated-values'],
  };
  if (exports[name]) saveText(instance.modal.ownerDocument, ...exports[name]);
}
export function installPipelineEngineeringConfigurationUi(host) {
  if (!host || INSTANCES.has(host)) return INSTANCES.get(host)?.destroy || null;
  const doc = host.ownerDocument; ensureStyle(doc); host.insertAdjacentHTML('beforeend', engineeringConfigurationHtml());
  const modal = host.querySelector('[data-p3d-engineering-config]'), open = toolbarButton(host);
  const instance = { host, modal, draft: loadPipelineEngineeringConfigurationDraft(), plan: null,
    canonicalAnalysisSectionPlan: host.pipelineCanonicalAnalysisSectionPlan || null };
  const controller = new AbortController();
  open.addEventListener('click', () => { render(instance); modal.showModal(); }, { signal: controller.signal });
  modal.addEventListener('input', (event) => onField(instance, event.target), { signal: controller.signal });
  modal.addEventListener('change', (event) => onField(instance, event.target), { signal: controller.signal });
  host.addEventListener('pipeline-canonical-analysis-section-plan', (event) => {
    instance.canonicalAnalysisSectionPlan = event.detail?.plan || null; render(instance);
  }, { signal: controller.signal });
  modal.addEventListener('click', (event) => {
    const button = event.target.closest('button'); if (!button) return;
    if (button.dataset.p3dConfigRemoveAssignment !== undefined) removeAssignment(instance,
      Number(button.dataset.p3dConfigRemoveAssignment));
    else if (button.dataset.p3dConfigConfirm) { instance.draft = confirmPipelineEngineeringConfigurationFields(
      instance.draft, [button.dataset.p3dConfigConfirm]); render(instance); }
    else if (button.dataset.p3dConfigReject) { instance.draft = rejectPipelineEngineeringConfigurationFields(
      instance.draft, [button.dataset.p3dConfigReject]); render(instance); }
    else if (button.dataset.p3dConfigAction) action(instance, button.dataset.p3dConfigAction);
  }, { signal: controller.signal });
  render(instance);
  instance.destroy = () => { controller.abort(); modal.remove(); open.remove(); INSTANCES.delete(host); };
  INSTANCES.set(host, instance); return instance.destroy;
}
export const _test = Object.freeze({ STATUS, sectionInput, canonicalEvidenceRows, assignProperties, clearDraft });
