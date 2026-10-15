/**
 * Edit Draft extensions: ghost-mode autofix proposals with Apply/Reject UI,
 * the bottom "Updates" ledger grid, the staged JSON export, and the P4B
 * read-only production shadow observer. Runs beside the edit controller.
 */

import { loadTopologyProducerCore } from './topology-producer-loader.js';
import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { buildGapBridgeSuggestions, buildAttributeFixSuggestions } from './topology-extended-fix-suggestions.js';
import { buildGhostVisualModel, ghostSuggestionId } from './topology-fix-ghost-model.js';
import { buildUpdateLedgerRows, UPDATE_LEDGER_COLUMNS } from './topology-update-ledger-model.js';
import { createUpdateLedgerGrid } from './topology-update-ledger-grid.js';
import { buildStagedExport } from './topology-staged-export.js';
import { downloadText, outputStem } from './topology-edit-controller-helpers.js';
import {
  createTopologyScopedEditProductionShadow,
  createTopologyScopedEditProductionSnapshot,
  topologyProductionShadowSourceKey,
} from './topology-scoped-edit-production-shadow-index.js';

export function createTopologyEditExtensions(root, controller) {
  const dismissed = new Set();
  let ghostsEnabled = false;
  let suggestionsById = new Map();
  let attributeById = new Map();
  let refreshing = false;
  const documentRef = root.ownerDocument;

  function editEvidence() { return objectRecord(controller.edit.evidence()); }
  function stagedSource() { return objectRecord(objectRecord(objectRecord(objectRecord(controller.evidence()).trace).artifacts).source).raw ?? null; }
  function currentCanonical() {
    const evidence = editEvidence();
    return objectRecord(evidence.editedArtifacts).canonicalTopology ?? objectRecord(evidence.baseArtifacts).canonicalTopology ?? null;
  }

  const shadowTarget = root.querySelector('[data-ttv-edit-root]') ?? root;
  const productionShadow = createTopologyScopedEditProductionShadow({
    snapshotKeyProvider: () => topologyProductionShadowSourceKey({ controller, root }),
    snapshotProvider: () => createTopologyScopedEditProductionSnapshot({ controller, root }),
    authorityProvider: () => cleanText(objectRecord(editEvidence().commandAuthority).authorityId),
    onDiagnostic: (diagnostic) => {
      shadowTarget.setAttribute('data-ttv-shadow-status', cleanText(diagnostic.status));
      shadowTarget.setAttribute('data-ttv-shadow-authority', cleanText(diagnostic.authorityId));
      const EventCtor = documentRef.defaultView?.CustomEvent;
      if (EventCtor) shadowTarget.dispatchEvent(new EventCtor('topology-shadow-diagnostic',
        { detail: diagnostic }));
    },
  }, { cryptoRef: documentRef.defaultView?.crypto });

  const updatesHost = root.querySelector('[data-ttv-edit-updates]');
  const grid = updatesHost ? createUpdateLedgerGrid(updatesHost, {
    columns: UPDATE_LEDGER_COLUMNS,
    onCellEdit: (row, key, value) => { if (key === 'remark') controller.edit.setCommandRemark(cleanText(row.id), value); },
    onRowFocus: (row) => {
      const target = cleanText(row.target).split(',')[0].trim();
      if (row.source === 'COMMAND' && target) controller.edit.setExternalSelection([{ kind: target.startsWith('CN-') ? 'node' : 'edge', id: target }]);
    },
  }) : null;

  function refreshLedger() {
    const evidence = editEvidence();
    grid?.setRows([...buildUpdateLedgerRows({ draft: evidence.draft, attributeLedger: evidence.attributeLedger, remarks: evidence.remarks })]);
  }

  async function refreshGhosts() {
    if (!ghostsEnabled) { controller.edit.setGhostModel(null); return; }
    const canonical = currentCanonical();
    if (!canonical || refreshing) return;
    refreshing = true;
    try {
      const core = await loadTopologyProducerCore();
      const report = core.runTopologyChecks(canonical, { shortElementMm: 6, toleranceMm: Number(canonical.toleranceMm ?? 0.1), snapToleranceMm: 25, angleToleranceDeg: 5, originToleranceMm: 0.1, clearanceMm: 0 });
      const geometry = [
        ...core.buildTopologyFixSuggestions(canonical, report, {}),
        ...buildGapBridgeSuggestions(canonical, { snapToleranceMm: 25, maxBridgeGapMm: 100 }),
      ].filter((row) => row.operations?.length && !dismissed.has(row.id));
      const attributes = buildAttributeFixSuggestions(stagedSource() ?? [])
        .filter((row) => row.after !== null && !dismissed.has(row.id))
        .filter((row) => !asArray(objectRecord(editEvidence().attributeLedger).edits)
          .some((edit) => edit.sourcePath === row.sourcePath && edit.field === row.field));
      suggestionsById = new Map(geometry.map((row) => [row.id, row]));
      attributeById = new Map(attributes.map((row) => [row.id, row]));
      controller.edit.setGhostModel(buildGhostVisualModel(geometry, attributes, canonical, editEvidence().projectDocument));
      setGhostSummary(`${geometry.length} geometry + ${attributes.length} attribute proposal(s) shown as ghosts. Click a ghost to review.`);
    } catch (error) { setGhostSummary(`Ghost refresh failed: ${error?.message || String(error)}`); }
    finally { refreshing = false; }
  }

  function setGhostSummary(message) {
    const target = root.querySelector('[data-ttv-edit-ghost-summary]');
    if (target) target.textContent = message;
  }

  function applyAttributeSuggestion(row, origin) {
    const warning = cleanText(row.warning);
    const issuedAt = new Date().toISOString();
    controller.edit.appendAttributeEditCommand({
      branchIndex: row.branchIndex, childIndex: row.childIndex, sourcePath: row.sourcePath,
      field: row.field, before: row.before, after: row.after,
      reason: warning ? `⚠ ${warning}` : row.rationale, fixCode: row.fixCode,
    }, { kind: origin.startsWith('AUTOFIX:') ? 'AUTOFIX' : 'USER', actorId: origin, issuedAt });
    return warning;
  }

  function closeOverlay() { root.querySelector('[data-ttv-ghost-overlay]')?.remove(); }

  function showOverlay(record, isAttribute) {
    closeOverlay();
    const overlay = documentRef.createElement('div');
    overlay.setAttribute('data-ttv-ghost-overlay', '');
    overlay.style.cssText = 'position:absolute;right:16px;top:64px;width:320px;z-index:40;background:#0f172a;border:1px solid #22d3ee;border-radius:8px;padding:12px;color:#e2e8f0;font-size:12px;box-shadow:0 12px 32px rgba(0,0,0,.5);';
    overlay.innerHTML = `
      <strong style="display:block;margin-bottom:4px;">${cleanText(record.title)}</strong>
      <p style="margin:0 0 6px;color:#94a3b8;">${cleanText(record.rationale)}</p>
      <p style="margin:0 0 8px;"><b>${cleanText(record.fixability)}</b> · ${cleanText(record.risk ?? '')} ${isAttribute ? `· ${cleanText(record.field)}: ${cleanText(String(record.before ?? '∅'))} → ${cleanText(String(record.after))}` : ''}</p>
      <div style="display:flex;gap:6px;justify-content:flex-end;">
        ${record.fixability === 'MANUAL_ENGINEERING' ? '' : '<button type="button" data-ghost-apply style="background:#0e7490;color:#e0f2fe;border:1px solid #22d3ee;border-radius:5px;padding:5px 10px;cursor:pointer;">Apply</button>'}
        <button type="button" data-ghost-reject style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:5px;padding:5px 10px;cursor:pointer;">Reject</button>
        <button type="button" data-ghost-close style="background:none;border:none;color:#64748b;cursor:pointer;">✕</button>
      </div>`;
    (root.querySelector('[data-ttv-edit-root]') ?? root).appendChild(overlay);
    overlay.querySelector('[data-ghost-apply]')?.addEventListener('click', async () => {
      try {
        let warning = '';
        if (isAttribute) warning = applyAttributeSuggestion(record, `AUTOFIX:${record.fixCode}`);
        else await controller.edit.applyTopologyFixSuggestions([record], false);
        closeOverlay(); refreshLedger(); await refreshGhosts();
        if (warning) setGhostSummary(`Applied with warning: ${warning}`);
      } catch (error) { setGhostSummary(`Apply failed: ${error?.message || String(error)}`); }
    });
    overlay.querySelector('[data-ghost-reject]').addEventListener('click', async () => {
      dismissed.add(record.id); closeOverlay(); await refreshGhosts();
    });
    overlay.querySelector('[data-ghost-close]').addEventListener('click', closeOverlay);
  }

  async function applyAllApproved() {
    const geometry = [...suggestionsById.values()].filter((row) => row.approvedByDefault);
    const attributes = [...attributeById.values()].filter((row) => row.approvedByDefault);
    if (!geometry.length && !attributes.length) { setGhostSummary('No auto-approved proposals pending.'); return; }
    try {
      const warnings = attributes.map((row) => applyAttributeSuggestion(row, `AUTOFIX:${row.fixCode}`)).filter(Boolean);
      if (geometry.length) await controller.edit.applyTopologyFixSuggestions(geometry, true);
      refreshLedger(); await refreshGhosts();
      setGhostSummary(`Applied ${geometry.length} geometry fix(es) as one transaction and ${attributes.length} attribute fix(es).`
        + (warnings.length ? ` ⚠ ${warnings.length} defaulted-by-heuristic (see ledger remarks).` : ''));
    } catch (error) { setGhostSummary(`Apply-all failed: ${error?.message || String(error)}`); }
  }

  function exportStaged() {
    const evidence = editEvidence();
    const base = stagedSource();
    if (!base) throw new Error('Load a staged/managed source JSON before exporting.');
    if (!evidence.draft) throw new Error('Edit Draft has not been initialized.');
    const rows = buildUpdateLedgerRows({ draft: evidence.draft, attributeLedger: evidence.attributeLedger, remarks: evidence.remarks });
    const { text, summary } = buildStagedExport({
      baseStagedJson: base,
      baseCanonical: objectRecord(evidence.baseArtifacts).canonicalTopology,
      draft: evidence.draft,
      editedCanonicalHash: cleanText(objectRecord(objectRecord(evidence.editedArtifacts).canonicalTopology).canonicalTopologyHash),
      attributeLedger: evidence.attributeLedger,
      commandJournal: evidence.commandJournal,
      exportedAt: new Date().toISOString(),
      ledgerRows: rows,
      toleranceMm: 0.5,
    });
    const stem = outputStem(cleanText(objectRecord(objectRecord(controller.evidence()).trace)?.fileNames?.source) || 'staged-edit');
    downloadText(documentRef, `${stem}_edited_stage.json`, text, 'application/json;charset=utf-8');
    setGhostSummary(`Exported staged JSON: ${summary.remaps} node remap(s), ${summary.coordinatesTouched} coordinate(s) rewritten, ${summary.attributeEdits} attribute edit(s).`);
  }

  const ghostToggle = root.querySelector('[data-ttv-edit-ghosts]');
  ghostToggle?.addEventListener('change', async (event) => { ghostsEnabled = event.target.checked; await refreshGhosts(); });
  root.querySelector('[data-ttv-edit-apply-approved]')?.addEventListener('click', applyAllApproved);
  root.querySelector('[data-ttv-edit-export-staged]')?.addEventListener('click', () => {
    try { exportStaged(); } catch (error) { setGhostSummary(error?.message || String(error)); }
  });

  return Object.freeze({
    onRender() {
      refreshLedger();
      if (ghostsEnabled) refreshGhosts();
      productionShadow.observe();
    },
    refreshLedger,
    onGhostPick(objectId) {
      const id = ghostSuggestionId(objectId);
      if (!id) return;
      if (suggestionsById.has(id)) showOverlay(suggestionsById.get(id), false);
      else if (attributeById.has(id)) showOverlay(attributeById.get(id), true);
    },
    getAttributeLedger: () => editEvidence().attributeLedger,
    shadowEvidence: productionShadow.evidence,
    destroy() { productionShadow.destroy(); closeOverlay(); grid?.destroy(); },
  });
}
