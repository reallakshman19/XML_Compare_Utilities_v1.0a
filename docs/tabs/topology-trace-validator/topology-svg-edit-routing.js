/** First-class SVG Edit routing facade over the current Topology workspace. */
import { createTopologyWorkspaceController as createBaseTopologyWorkspaceController } from './topology-workspace-controller.js?v=20260718-headless-autofix-v2';
import { workspaceMarkup as baseWorkspaceMarkup } from './topology-workspace-markup.js?v=20260718-headless-autofix-v2';

const TRACE_TAB = '<button type="button" role="tab" aria-selected="true" class="is-active" data-ttv-workspace-tab="trace">Trace</button>';
const EDIT_TAB = '<button type="button" role="tab" aria-selected="false" data-ttv-workspace-tab="edit">Edit Draft</button>';
const SVG_EDIT_TAB = '<button type="button" role="tab" aria-selected="false" data-ttv-workspace-tab="svg-edit" title="Edit support positions directly in the native SVG view">SVG Edit</button>';
const TOPOLOGY_EDIT_TAB = '<button type="button" role="tab" aria-selected="false" data-ttv-workspace-tab="edit" title="Open the broader canonical topology editing workspace">Topology Edit</button>';

function replaceRequired(value, fragment, replacement, label) {
  if (!value.includes(fragment)) throw new Error(`Topology SVG Edit routing is missing ${label}.`);
  return value.replace(fragment, replacement);
}

function routedMarkup() {
  let markup = baseWorkspaceMarkup();
  markup = replaceRequired(markup, `${TRACE_TAB}${EDIT_TAB}`, `${TRACE_TAB}${SVG_EDIT_TAB}${TOPOLOGY_EDIT_TAB}`, 'workspace tabs');
  markup = replaceRequired(markup, 'aria-label="Trace authoring mode"', 'aria-label="Native SVG support editor mode"', 'SVG editor mode label');
  markup = replaceRequired(markup, 'data-ttv-editor-mode="review">Review</button>', 'data-ttv-editor-mode="review">Review SVG</button>', 'Review SVG action');
  markup = replaceRequired(markup, 'data-ttv-editor-mode="edit">Edit Draft</button>', 'data-ttv-editor-mode="edit">Edit SVG</button>', 'Edit SVG action');
  markup = replaceRequired(markup, '<strong>Support Draft</strong>', '<strong>SVG Support Draft</strong>', 'SVG Support Draft heading');
  markup = replaceRequired(markup, 'Edit Draft uses X/Y/Z handles', 'SVG Edit uses X/Y/Z handles', 'SVG Edit navigation hint');
  return markup;
}

function setWorkspaceTabState(root, activeTab) {
  root.querySelectorAll('[data-ttv-workspace-tab]').forEach((button) => {
    const active = button.getAttribute('data-ttv-workspace-tab') === activeTab;
    button.classList.toggle('is-active', active);
    button.setAttribute('aria-selected', String(active));
  });
}

export function workspaceMarkup() {
  return routedMarkup();
}

export function createTopologyWorkspaceController(traceController, editController, parityController, editorController) {
  const base = createBaseTopologyWorkspaceController(traceController, editController, parityController, editorController);
  let activeTab = String(base.evidence().activeTab || 'trace');

  async function activateTab(tab, root) {
    const next = String(tab ?? '').trim();
    if (next === 'svg-edit') {
      await base.activateTab('trace', root);
      editorController.setMode('edit');
      setWorkspaceTabState(root, 'svg-edit');
      activeTab = 'svg-edit';
      return true;
    }
    const result = await base.activateTab(next, root);
    if (next === 'trace') editorController.setMode('review');
    activeTab = next;
    return result;
  }

  function evidence() {
    return Object.freeze({ ...base.evidence(), activeTab });
  }

  return Object.freeze({ ...base, activateTab, evidence });
}

export const _test = Object.freeze({ replaceRequired, routedMarkup, setWorkspaceTabState });
