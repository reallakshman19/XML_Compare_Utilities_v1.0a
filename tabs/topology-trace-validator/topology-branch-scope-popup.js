/**
 * topology-branch-scope-popup.js — "filter branches before load" modal,
 * ported from 3D_Converters' ATT/RVM hierarchy scope popup.
 *
 * Presents the SITE → OWNER → BRANCH tree from staged-json-core's
 * buildBranchScopeTree with tri-state checkboxes, a wildcard glob filter
 * (comma/semicolon/newline token lists, '*' glob, plain substring), a live
 * stats line, and Select-matches / Clear helpers. Promise-based: resolves
 * { cancelled, wildcard, selectedIds } — an empty scope means "load all".
 */

import { scopeRegex } from '../../workbench3d/core/scope-pattern.js';

const KIND_COLORS = Object.freeze({ SITE: '#7c3aed', OWNER: '#0e7490', BRANCH: '#15803d' });

function esc(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
}

function collectIds(node, out) {
  out.push(node.id);
  for (const child of node.children ?? []) collectIds(child, out);
  return out;
}

function descendantBranchIds(node, out = []) {
  if (node.kind === 'BRANCH') out.push(node.id);
  for (const child of node.children ?? []) descendantBranchIds(child, out);
  return out;
}

/**
 * @param {Document} documentRef
 * @param {ReadonlyArray<Record<string, unknown>>} branchTree from buildBranchScopeTree
 * @param {{ defaultWildcard?: string, initialSelectedIds?: string[], title?: string, confirmLabel?: string, stats?: Record<string, unknown> }} options
 * @returns {Promise<{ cancelled: boolean, wildcard: string, selectedIds: string[] }>}
 */
export function openBranchScopePopup(documentRef, branchTree, options = {}) {
  return new Promise((resolve) => {
    const selected = new Set(Array.isArray(options.initialSelectedIds) ? options.initialSelectedIds : []);
    let wildcard = String(options.defaultWildcard ?? '');

    const overlay = documentRef.createElement('div');
    overlay.className = 'ttv-scope-popup-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(2,6,23,.72);display:flex;align-items:center;justify-content:center;z-index:10050;';
    overlay.innerHTML = `
      <div class="ttv-scope-popup" style="width:min(860px,96vw);max-height:88vh;display:flex;flex-direction:column;background:#0f172a;color:#e2e8f0;border:1px solid #334155;border-radius:10px;box-shadow:0 24px 64px rgba(0,0,0,.5);font:13px/1.45 system-ui,sans-serif;">
        <div style="padding:14px 16px;border-bottom:1px solid #1e293b;display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:14px;">${esc(options.title ?? 'Select staged JSON branch scope')}</strong>
          <button type="button" data-scope-cancel-x style="background:none;border:none;color:#94a3b8;font-size:16px;cursor:pointer;">✕</button>
        </div>
        <div style="padding:10px 16px;display:flex;gap:8px;align-items:center;border-bottom:1px solid #1e293b;">
          <input type="text" data-scope-wildcard placeholder="Wildcard filter, e.g. *ASIM-1835* or S8810101, S8810111" value="${esc(wildcard)}"
                 style="flex:1;background:#0b1220;color:#e2e8f0;border:1px solid #334155;border-radius:6px;padding:6px 10px;">
          <button type="button" data-scope-select-matches style="background:#134e4a;color:#a7f3d0;border:1px solid #14b8a6;border-radius:6px;padding:6px 10px;cursor:pointer;">Select matches</button>
          <button type="button" data-scope-clear style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:6px;padding:6px 10px;cursor:pointer;">Clear</button>
        </div>
        <div data-scope-stats style="padding:6px 16px;color:#94a3b8;border-bottom:1px solid #1e293b;"></div>
        <div data-scope-tree style="flex:1;overflow:auto;padding:8px 8px 12px;"></div>
        <div style="padding:12px 16px;border-top:1px solid #1e293b;display:flex;justify-content:flex-end;gap:8px;">
          <button type="button" data-scope-cancel style="background:#1e293b;color:#cbd5e1;border:1px solid #334155;border-radius:6px;padding:8px 14px;cursor:pointer;">Cancel</button>
          <button type="button" data-scope-confirm style="background:#0e7490;color:#e0f2fe;border:1px solid #22d3ee;border-radius:6px;padding:8px 14px;cursor:pointer;font-weight:600;">Load selected scope</button>
        </div>
      </div>`;
    documentRef.body.appendChild(overlay);

    const treeEl = overlay.querySelector('[data-scope-tree]');
    const statsEl = overlay.querySelector('[data-scope-stats]');
    const wildcardEl = overlay.querySelector('[data-scope-wildcard]');
    const confirmEl = overlay.querySelector('[data-scope-confirm]');

    const regexOf = () => { try { return wildcard ? scopeRegex(wildcard) : null; } catch { return null; } };

    function nodeMatches(node, regex) { return regex ? regex.test(String(node.label ?? '')) : false; }
    function hasVisible(node, regex) {
      if (!regex) return true;
      if (nodeMatches(node, regex)) return true;
      return (node.children ?? []).some((child) => hasVisible(child, regex));
    }

    function renderNode(node, regex, depth) {
      if (!hasVisible(node, regex)) return '';
      const checked = selected.has(node.id);
      const someDescendant = !checked && descendantBranchIds(node).some((id) => selected.has(id));
      const highlight = nodeMatches(node, regex);
      const badgeColor = KIND_COLORS[node.kind] ?? '#475569';
      const count = node.kind === 'BRANCH'
        ? (Number.isFinite(node.componentCount) ? `<span style="color:#64748b;">· ${node.componentCount} comp</span>` : '')
        : `<span style="color:#64748b;">(${node.branchCount})</span>`;
      const children = (node.children ?? []).map((child) => renderNode(child, regex, depth + 1)).join('');
      return `
        <div data-scope-row style="margin-left:${depth * 18}px;">
          <label style="display:flex;gap:8px;align-items:center;padding:2px 6px;border-radius:4px;cursor:pointer;${highlight ? 'background:#164e63;' : ''}">
            <input type="checkbox" data-scope-node="${esc(node.id)}" ${checked ? 'checked' : ''} ${someDescendant ? 'data-indeterminate="true"' : ''}>
            <span style="font-size:10px;font-weight:700;color:#fff;background:${badgeColor};border-radius:3px;padding:1px 5px;">${esc(node.kind)}</span>
            <span style="word-break:break-all;">${esc(node.label)}</span>
            ${count}
          </label>
        </div>${children}`;
    }

    function refreshStats(regex) {
      let visibleBranches = 0;
      const walk = (node) => {
        if (!hasVisible(node, regex)) return;
        if (node.kind === 'BRANCH') visibleBranches += 1;
        (node.children ?? []).forEach(walk);
      };
      branchTree.forEach(walk);
      const selectedBranches = [...selected].filter((id) => id.startsWith('branch:')).length;
      statsEl.textContent = `${visibleBranches} visible branch(es), ${selected.size} selected item(s) (${selectedBranches} branches). Wildcard and checked items are combined; empty scope loads everything.`;
      confirmEl.textContent = (!selected.size && !wildcard.trim()) ? 'Load all branches' : 'Load selected scope';
    }

    function render() {
      const regex = regexOf();
      treeEl.innerHTML = branchTree.map((node) => renderNode(node, regex, 0)).join('') || '<p style="color:#94a3b8;padding:8px;">No branches found.</p>';
      treeEl.querySelectorAll('[data-indeterminate]').forEach((input) => { input.indeterminate = true; });
      refreshStats(regex);
    }

    function findNode(id, nodes = branchTree) {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = findNode(id, node.children ?? []);
        if (found) return found;
      }
      return null;
    }

    function close(result) {
      overlay.remove();
      resolve(result);
    }

    treeEl.addEventListener('change', (event) => {
      const input = event.target;
      if (!(input instanceof HTMLInputElement) || !input.hasAttribute('data-scope-node')) return;
      const node = findNode(input.getAttribute('data-scope-node'));
      if (!node) return;
      const ids = collectIds(node, []);
      if (input.checked) ids.forEach((id) => selected.add(id));
      else ids.forEach((id) => selected.delete(id));
      render();
    });
    wildcardEl.addEventListener('input', () => { wildcard = wildcardEl.value; render(); });
    overlay.querySelector('[data-scope-select-matches]').addEventListener('click', () => {
      const regex = regexOf();
      const walk = (node) => {
        if (!hasVisible(node, regex)) return;
        if (node.kind === 'BRANCH') selected.add(node.id);
        (node.children ?? []).forEach(walk);
      };
      branchTree.forEach(walk);
      render();
    });
    overlay.querySelector('[data-scope-clear]').addEventListener('click', () => { selected.clear(); render(); });
    overlay.querySelector('[data-scope-cancel]').addEventListener('click', () => close({ cancelled: true, wildcard: '', selectedIds: [] }));
    overlay.querySelector('[data-scope-cancel-x]').addEventListener('click', () => close({ cancelled: true, wildcard: '', selectedIds: [] }));
    confirmEl.addEventListener('click', () => close({ cancelled: false, wildcard: wildcard.trim(), selectedIds: [...selected] }));

    render();
    wildcardEl.focus();
  });
}

export const _test = Object.freeze({ collectIds, descendantBranchIds });
