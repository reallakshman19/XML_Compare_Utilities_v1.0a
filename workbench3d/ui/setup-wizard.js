/**
 * setup-wizard.js — 5-step guided setup (W6, vision doc §4): Sources → Roles →
 * Grain → Relationships → Workspace. Pure model + a compact banner that routes
 * to the existing views/actions; it orchestrates, it doesn't duplicate.
 */

import { detectProfile, PROFILES } from '../core/profiles.js';
import { validateMapping } from '../tablexml/column-mapper.js';

function activeTable(state) {
  const tx = state.tablexml;
  return tx ? tx.tables[tx.active] : null;
}

/**
 * @returns { profileId, profileLabel, steps:[{id,label,done,hint,goto}], doneCount }
 * goto = { view, action? } the banner offers to advance the step.
 */
export function setupWizardModel(state) {
  const table = activeTable(state);
  const headers = table?.parsed?.headers ?? [];
  const schema = state.graphs?.sourceSchema ?? null;
  const profileId = state.profileOverride ?? detectProfile({ schema, headers });
  const usingTable = state.activeView === 'table-to-xml' || (!state.sourceXml && !!table?.parsed);

  const sourcesDone = !!(state.sourceXml && state.targetXml) || !!table?.parsed;
  const rolesDone = usingTable
    ? !!(table?.mapping && table.mapping.columns.some((c) => c.role && c.role !== 'ignore'))
    : sourcesDone; // XML roles are structural (auto)
  const grainDone = usingTable ? !!table?.mapping?.grain : sourcesDone;
  const mappingValid = usingTable ? !!(table?.mapping && validateMapping(table.mapping).length === 0) : sourcesDone;
  const relationshipsDone = !!state.audit;
  const workspaceDone = !!state.audit;

  const steps = [
    { id: 'sources', label: 'Sources', done: sourcesDone, hint: sourcesDone ? 'Source & target loaded' : 'Load/paste source & target', goto: { view: usingTable ? 'table-to-xml' : 'compare' } },
    { id: 'roles', label: 'Roles', done: rolesDone, hint: usingTable ? (rolesDone ? 'Roles assigned' : 'Assign column roles') : 'Auto (XML structure)', goto: { view: usingTable ? 'table-to-xml' : 'compare' } },
    { id: 'grain', label: 'Grain', done: grainDone, hint: usingTable ? `Grain: ${table?.mapping?.grain ?? 'row'}` : 'Canonical element', goto: { view: usingTable ? 'table-to-xml' : 'compare' } },
    { id: 'relationships', label: 'Relationships', done: relationshipsDone, hint: relationshipsDone ? `${state.audit.summary.matchedElements} matched` : (mappingValid ? 'Run compare' : 'Fix mapping first'), goto: usingTable ? { view: 'table-to-xml' } : { view: 'compare', action: 'run-compare' } },
    { id: 'workspace', label: 'Workspace', done: workspaceDone, hint: workspaceDone ? 'Open dashboard' : 'Awaiting compare', goto: { view: 'dashboard' } },
  ];
  return {
    profileId,
    profileLabel: (PROFILES[profileId] ?? PROFILES.GENERIC_NODE).label,
    steps,
    doneCount: steps.filter((s) => s.done).length,
  };
}

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

/** Compact stepper banner. Collapsible; hidden once all steps are done unless pinned. */
export function setupBannerHtml(state) {
  const model = setupWizardModel(state);
  if (model.doneCount === model.steps.length && !state.wizardPinned) return '';
  const profileOptions = Object.values(PROFILES)
    .map((p) => `<option value="${p.id}" ${model.profileId === p.id ? 'selected' : ''}>${esc(p.label)}</option>`).join('');
  const steps = model.steps.map((step, i) => `
    <button class="wb3d-wiz-step ${step.done ? 'is-done' : ''}" data-action="wizard-goto" data-view="${step.goto.view}" ${step.goto.action ? `data-run="${step.goto.action}"` : ''}>
      <span class="wb3d-wiz-num">${step.done ? '✓' : i + 1}</span>
      <span class="wb3d-wiz-label">${esc(step.label)}</span>
      <span class="wb3d-wiz-hint">${esc(step.hint)}</span>
    </button>`).join('<span class="wb3d-wiz-sep">›</span>');
  return `
  <div class="wb3d-wizard">
    <div class="wb3d-wiz-head">
      <strong>Guided setup</strong>
      <label>Profile <select data-action="wizard-profile">${profileOptions}</select></label>
      <span class="wb3d-muted">${model.doneCount}/${model.steps.length} steps</span>
      <span class="wb3d-float-spacer"></span>
      <button class="wb3d-btn wb3d-btn-mini" data-action="wizard-dismiss">Hide</button>
    </div>
    <div class="wb3d-wiz-steps">${steps}</div>
  </div>`;
}
