/**
 * Master-file enrichment modal wiring extracted from the workspace event hub.
 * Inputs are the workspace root/controller, its tracked listener helper, and
 * the caller's visible error reporter. Enriched JSON returns through the
 * normal source-artifact pipeline; this module does not build topology.
 */

import { renderStagedJsonEnrichmentPanel } from './stagedjson-enrichment/stagedjson-enrichment-ui.js?v=20260715-ttv-005-css-fix';

function createEnrichmentModal(root) {
  const documentRef = root.ownerDocument;
  const overlay = documentRef.createElement('div');
  overlay.className = 'ttv-modal';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  const container = documentRef.createElement('div');
  container.className = 'ttv-modal-content';
  Object.assign(container.style, { width: '90vw', height: '90vh', background: 'var(--psmap-surface)', display: 'flex', flexDirection: 'column' });
  const header = documentRef.createElement('div');
  Object.assign(header.style, { padding: '10px', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--psmap-border)' });
  const title = documentRef.createElement('h2');
  title.textContent = 'Master File Enrichment Workbench';
  title.style.margin = '0';
  const close = documentRef.createElement('button');
  close.textContent = '× Close';
  const body = documentRef.createElement('div');
  Object.assign(body.style, { flex: '1', overflow: 'hidden', position: 'relative' });
  header.append(title, close);
  container.append(header, body);
  overlay.appendChild(container);
  documentRef.body.appendChild(overlay);
  return Object.freeze({ overlay, body, close });
}

/** Wire the enrichment launcher into the caller-owned cleanup lifecycle. */
export function wireTopologyEnrichment(root, controller, listen, reportError) {
  listen(root.querySelector('[data-ttv-enrich]'), 'click', () => {
    const modal = createEnrichmentModal(root);
    const dispose = renderStagedJsonEnrichmentPanel(modal.body, {
      onApplyToWorkspace: async (json) => {
        try {
          dispose?.();
          modal.overlay.remove();
          await controller.loadArtifact('source', JSON.stringify(json), 'enriched_source.json');
        } catch (error) { reportError(root, error); }
      },
    });
    modal.close.addEventListener('click', () => { dispose?.(); modal.overlay.remove(); });
  });
}

export const _test = Object.freeze({ createEnrichmentModal });
