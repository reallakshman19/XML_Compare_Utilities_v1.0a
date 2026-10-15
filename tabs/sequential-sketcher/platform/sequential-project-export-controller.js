import { buildSequentialProjectMigration } from '../sequential-sketcher-project-adapter.js';

function downloadArtifact(documentRef, artifact) {
  const blob = new Blob([artifact.text], { type: `${artifact.mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const anchor = documentRef.createElement('a');
  anchor.href = url;
  anchor.download = artifact.name;
  documentRef.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

export function mountSequentialProjectExportController(root, workspace, context = {}) {
  const button = root.querySelector('[data-ssk-action="export"]');
  if (!button) throw new Error('Sequential project export control is missing.');

  async function exportProject() {
    const model = workspace?.getModel?.();
    workspace?.saveActiveBranch?.();
    if (!model?.evidence || !model?.session) {
      throw new Error('Inspect and construct a route before project export.');
    }
    const migration = await buildSequentialProjectMigration({
      sourceText: root.querySelector('[data-ssk-source]')?.value || '',
      sourceName: model.sourceName || 'sequential-staged-json',
      evidence: model.evidence,
      session: model.session,
      confirmedConstruction: model.confirmedConstruction,
      supportProjection: model.supportProjection,
      createdAt: new Date().toISOString(),
      cryptoRef: globalThis.crypto,
    });
    if (migration.exportPlan.gate.status !== 'READY') {
      throw new Error(migration.exportPlan.gate.blockers.join(' '));
    }
    downloadArtifact(root.ownerDocument, migration.outputs[0]);
    context.showToast?.('Accepted Sequential project metadata envelope exported.', 'success');
    return migration;
  }

  async function onClick(event) {
    if (!event.target?.closest?.('[data-ssk-action="export"]')) return;
    event.preventDefault();
    try { await exportProject(); } catch (error) {
      context.showToast?.(error.message || String(error), 'error');
    }
  }

  button.addEventListener('click', onClick);
  return Object.freeze({
    exportProject,
    destroy() { button.removeEventListener('click', onClick); },
  });
}
