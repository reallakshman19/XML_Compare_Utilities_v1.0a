/** Connects the immutable topology scene view-model to the shared 3D viewer. */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { build3dVisualGeometryModel } from './topology-3d-visual-model.js';

let active3dViewer = null;

/** @param {Record<string, Element>} elements @param {Record<string, unknown>} viewModel @param {string} selectedKey @param {(objectKey:string)=>void} selectCallback @returns {Promise<void>} */
export async function render3dViewer(elements, viewModel, selectedKey, selectCallback) {
  let container = elements.svgHost.querySelector('.ttv-3d-container');
  if (!container) {
    elements.svgHost.innerHTML = '<div class="ttv-3d-container" style="position:absolute;inset:0;width:100%;height:100%"><div class="ttv-3d-canvas-host" style="position:absolute;inset:0;width:100%;height:100%"></div><div class="ttv-3d-overlay" style="position:absolute;top:12px;left:12px;display:flex;flex-direction:column;gap:6px;z-index:10"><button type="button" class="ttv-3d-btn" data-action="fit" title="Fit Model">Fit</button><button type="button" class="ttv-3d-btn" data-action="top" title="Top View (XY)">Top</button><button type="button" class="ttv-3d-btn" data-action="front" title="Front View (XZ)">Front</button><button type="button" class="ttv-3d-btn" data-action="side" title="Side View (YZ)">Side</button><button type="button" class="ttv-3d-btn" data-action="iso" title="Isometric View">Iso</button></div></div>';
    container = elements.svgHost.querySelector('.ttv-3d-container');
    const canvasHost = container.querySelector('.ttv-3d-canvas-host'), overlay = container.querySelector('.ttv-3d-overlay');
    const { createWorkbenchViewer } = await import('../../workbench3d/viewer/workbench-viewer.js');
    active3dViewer = await createWorkbenchViewer(canvasHost, {
      onPick: (pick) => {
        const objectKey = pick?.objectId ? Object.keys(viewModel.selectionLookup.byObjectKey).find((key) => key.endsWith(`:${pick.objectId}`) || key === pick.objectId) : '';
        selectCallback(objectKey || '');
      },
    });
    active3dViewer.setStatusStyles({
      'source-route': { colorInt: 0x64748b, alpha: 0.9, label: 'Source Route' },
      'source-ambiguous': { colorInt: 0xa855f7, alpha: 1, label: 'Ambiguous Route' },
      'canonical-edge': { colorInt: 0x22d3ee, alpha: 1, label: 'Canonical Edge' },
      invalid: { colorInt: 0xef4444, alpha: 1, label: 'Invalid / Blocked' },
      junction: { colorInt: 0xfacc15, alpha: 1, label: 'Junction' },
      pointFeature: { colorInt: 0xf472b6, alpha: 1, label: 'Point Feature' },
      boundary: { colorInt: 0xef4444, alpha: 1, label: 'Boundary' },
      support: { colorInt: 0x06b6d4, alpha: 1, label: 'Support / restraint' },
      'issue-blocking': { colorInt: 0xef4444, alpha: 1, label: 'Blocking Issue' },
      'issue-warning': { colorInt: 0xf59e0b, alpha: 1, label: 'Warning Issue' },
      gap: { colorInt: 0x3b82f6, alpha: 1, label: 'Gap' }, overlap: { colorInt: 0xdc2626, alpha: 1, label: 'Overlap' },
    });
    overlay.querySelectorAll('.ttv-3d-btn').forEach((button) => button.addEventListener('click', () => {
      const action = button.dataset.action; if (action === 'fit') active3dViewer.fitAll(); else active3dViewer.setStandardView(action);
    }));
  }
  active3dViewer.reattach(container.querySelector('.ttv-3d-canvas-host'));
  const visualModel = build3dVisualGeometryModel(viewModel), statusMap = buildStatusMap(viewModel);
  active3dViewer.setStatuses(statusMap);
  active3dViewer.setVerticalAxis(viewModel.verticalAxis || 'Y');
  active3dViewer.setModels({ source: visualModel, target: { segments: [], markers: [], bounds: visualModel.bounds } });
  if (selectedKey) {
    const selected = objectRecord(objectRecord(viewModel.selectionLookup).byObjectKey)[selectedKey];
    active3dViewer.setSelection(selected?.id || selected?.sourceEntityId || selected?.sourcePath || selectedKey, []);
  } else active3dViewer.setSelection('', []);
  if (!container.dataset.initialized) { active3dViewer.fitAll(); container.dataset.initialized = 'true'; }
}

/** @param {Record<string, unknown>} viewModel @returns {Map<string,string>} */
function buildStatusMap(viewModel) {
  const statusMap = new Map(), issueIds = new Set(asArray(viewModel.issues).flatMap((row) => asArray(objectRecord(row).canonicalIds)).map(cleanText));
  for (const component of viewModel.sourceComponents) {
    const key = component.sourceEntityId || component.sourcePath;
    statusMap.set(key, issueIds.has(component.objectKey) ? 'invalid' : cleanText(component.disposition) === 'BLOCK_AMBIGUOUS' ? 'source-ambiguous' : 'source-route');
  }
  for (const edge of asArray(viewModel.canonicalEdges)) statusMap.set(edge.id, issueIds.has(edge.id) ? 'invalid' : 'canonical-edge');
  for (const junction of asArray(viewModel.junctions)) statusMap.set(junction.id, issueIds.has(junction.id) ? 'invalid' : 'junction');
  for (const point of asArray(viewModel.pointFeatures)) statusMap.set(point.id, issueIds.has(point.id) ? 'invalid' : 'pointFeature');
  for (const boundary of asArray(viewModel.boundaries)) statusMap.set(boundary.id, issueIds.has(boundary.id) ? 'invalid' : 'boundary');
  for (const support of asArray(viewModel.supports)) statusMap.set(support.id || support.canonicalSupportId, issueIds.has(support.id) ? 'invalid' : 'support');
  return statusMap;
}

/** @param {string} objectKey @returns {void} */
export function select3dObject(objectKey) {
  if (!active3dViewer) return;
  const objectId = objectKey.includes(':') && !objectKey.startsWith('source:') ? objectKey.split(':').pop() : objectKey;
  active3dViewer.setSelection(objectId, []); if (objectId) active3dViewer.fitObject(objectId);
}

/** @returns {void} */
export function dispose3dViewer() { active3dViewer?.dispose(); active3dViewer = null; }

export const _test = Object.freeze({ buildStatusMap });
