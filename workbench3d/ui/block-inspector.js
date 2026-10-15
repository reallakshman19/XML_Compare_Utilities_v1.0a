/**
 * block-inspector.js — block-wise collapsible element inspector + node info
 * panel (UI-only; display models come from block-grouper / node-resolver).
 */

import { groupObjectBlocks } from '../adapters/block-grouper.js';

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]);
}

function entriesTable(entries) {
  return `<table class="wb3d-block-table"><tbody>${entries
    .map(([key, value]) => `<tr><td>${esc(key)}</td><td>${esc(value)}</td></tr>`)
    .join('')}</tbody></table>`;
}

/** Block-wise collapsible view of an element (professional format). */
export function blockInspectorHtml(object) {
  const groups = groupObjectBlocks(object);
  if (!groups.length) return '<p class="wb3d-muted">No block data.</p>';
  return groups.map((group, index) => {
    const single = group.instances.length === 1 && !group.instances[0].label;
    const body = single
      ? entriesTable(group.instances[0].entries)
      : group.instances.map((instance) => `
        <details class="wb3d-block wb3d-block-instance">
          <summary>${esc(group.blockName)} ${esc(instance.label)}</summary>
          ${entriesTable(instance.entries)}
        </details>`).join('');
    return `
    <details class="wb3d-block" ${index < 2 ? 'open' : ''}>
      <summary>${esc(group.blockName)}${group.instances.length > 1 ? ` <span class="wb3d-muted">×${group.instances.length}</span>` : ''}</summary>
      ${body}
    </details>`;
  }).join('');
}

/** Node info panel: node id, coordinate, degree, connected elements, packets. */
export function nodeInfoPanelHtml(nodeInfo) {
  if (!nodeInfo) return '<p class="wb3d-muted">Node not found (re-run compare?).</p>';
  const connected = nodeInfo.connectedObjectIds.map((id) => `<li><button class="wb3d-link" data-action="select-object" data-object="${esc(id)}">${esc(id)}</button></li>`).join('');
  const packets = nodeInfo.packets.map((p) => `
    <details class="wb3d-block wb3d-block-instance">
      <summary>${esc(p.kind)} <span class="wb3d-muted">via ${esc(p.resolvedBy)} · on ${esc(p.objectId)}</span></summary>
      ${entriesTable(Object.entries(p.attrs ?? {}))}
    </details>`).join('');
  return `
    <h4>Node ${esc(nodeInfo.nodeId)} <span class="wb3d-badge">${esc(nodeInfo.anchorType)}</span></h4>
    <div class="wb3d-kv">
      <div>Coordinate</div><div>[${nodeInfo.coordMm.map((v) => Number(v).toFixed(1)).join(', ')}] mm</div>
      <div>Degree</div><div>${nodeInfo.degree}</div>
      <div>Component</div><div>${esc(nodeInfo.componentId)}</div>
    </div>
    ${connected ? `<h5>Connected elements</h5><ul class="wb3d-list">${connected}</ul>` : ''}
    ${packets ? `<h5>Property packets at this node</h5>${packets}` : '<p class="wb3d-muted">No packets resolve to this node.</p>'}`;
}
