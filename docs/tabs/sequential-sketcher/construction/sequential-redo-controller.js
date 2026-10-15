import { applyConstructionDecision } from './sequential-construction-runtime.js';
import { createConfirmedSequentialConstruction } from './sequential-construction-acceptance.js';
import { DECISION_ACTIONS } from './sequential-construction-contract.js';
import { buildConfirmedConstructionSupportProjection } from '../support/sequential-confirmed-support-projection.js';

function decisionPayload(root) {
  return {
    reason: root.querySelector('[data-ssk-decision-reason]')?.value || '',
    evidenceNote: root.querySelector('[data-ssk-decision-evidence]')?.value || '',
  };
}
function setStatus(root, message, state = 'info') {
  const status = root.querySelector('[data-ssk-status]');
  if (!status) return;
  status.textContent = message;
  status.dataset.state = state;
}
function downstream(session, indexes) {
  if (session?.state !== 'ROUTE_COMPLETE') {
    return Object.freeze({ confirmedConstruction: null, supportProjection: null });
  }
  const confirmedConstruction = createConfirmedSequentialConstruction(session, indexes);
  const supportProjection = buildConfirmedConstructionSupportProjection(
    confirmedConstruction,
    indexes,
    {
      projectionToleranceMm: 50,
      onCenterlineToleranceMm: 0.001,
      ambiguityToleranceMm: 1,
    },
  );
  return Object.freeze({ confirmedConstruction, supportProjection });
}

export function mountSequentialRedoController(root, workspace, context = {}) {
  function redo() {
    const model = workspace?.getModel?.();
    if (!model?.session || !model.evidence || !model.indexes) {
      setStatus(root, 'No active Sequential Sketcher session is available to redo.', 'info');
      return null;
    }
    const result = applyConstructionDecision(
      model.session,
      model.evidence,
      model.indexes,
      DECISION_ACTIONS.REDO_LAST_TRANSACTION,
      decisionPayload(root),
      {},
    );
    if (result.session === model.session) {
      const messages = {
        NOTHING_TO_REDO: ['No supervised transaction is available to redo.', 'info'],
        REDO_STATE_MISMATCH: ['Redo was blocked because the current construction state no longer matches the recorded undo point.', 'error'],
        REDO_SNAPSHOT_MISMATCH: ['Redo was blocked because the recorded post-transaction snapshot failed fingerprint validation.', 'error'],
      };
      setStatus(root, ...(messages[result.outcome] || [`Redo blocked: ${result.outcome}.`, 'error']));
      return result;
    }
    const branchId = result.session.rootBranchId;
    const projection = downstream(result.session, model.indexes);
    model.branchRegistry.save(branchId, {
      session: result.session,
      confirmedConstruction: projection.confirmedConstruction,
      supportProjection: projection.supportProjection,
      selectedCandidateId: '',
    });
    const branchSelect = root.querySelector('[data-ssk-branch]');
    if (branchSelect) {
      branchSelect.value = branchId;
      branchSelect.dispatchEvent(new Event('change', { bubbles: true }));
    }
    setStatus(root, 'Last supervised transaction was redone from its fingerprint-validated snapshot.', 'ok');
    context.showToast?.('Sequential Sketcher transaction redone.', 'success');
    return result;
  }
  function onClick(event) {
    if (!event.target?.closest?.('[data-ssk-action="redo"]')) return;
    event.preventDefault();
    event.stopPropagation();
    redo();
  }
  function onKeyDown(event) {
    const key = event.key.toLowerCase();
    const redoShortcut = (event.ctrlKey || event.metaKey)
      && ((key === 'z' && event.shiftKey) || key === 'y');
    if (!redoShortcut) return;
    event.preventDefault();
    event.stopPropagation();
    redo();
  }
  root.addEventListener('click', onClick, true);
  root.addEventListener('keydown', onKeyDown, true);
  return Object.freeze({
    redo,
    destroy() {
      root.removeEventListener('click', onClick, true);
      root.removeEventListener('keydown', onKeyDown, true);
    },
  });
}
