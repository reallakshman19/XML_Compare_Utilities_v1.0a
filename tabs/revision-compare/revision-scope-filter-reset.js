/** Pure model and bounded action for clearing Revision Compare scope filters. */
import { cleanText, deepFreeze } from './revision-contract-utils.js';

export const REVISION_SCOPE_FILTER_GROUPS = Object.freeze(['common', 'revAOnly', 'revBOnly']);

function activeGroups(state) {
  return REVISION_SCOPE_FILTER_GROUPS.filter((group) => Boolean(cleanText(state?.search?.[group])));
}

function clearedMessage(count) {
  return `Cleared ${count} scope filter${count === 1 ? '' : 's'}.`;
}

export function revisionScopeFilterResetModel(state) {
  const groups = Object.freeze(activeGroups(state));
  const count = groups.length;
  return deepFreeze({
    visible: count > 0,
    activeCount: count,
    activeGroups: groups,
    label: count === 1 ? 'Clear 1 scope filter' : `Clear ${count} scope filters`,
    message: count === 1 ? 'Reveal all branches by clearing 1 active scope filter.'
      : `Reveal all branches by clearing ${count} active scope filters.`,
  });
}

export function clearRevisionScopeFilters(state, setSearch) {
  if (typeof setSearch !== 'function') throw new TypeError('Scope-search transition is required.');
  const model = revisionScopeFilterResetModel(state);
  let next = state;
  for (const group of REVISION_SCOPE_FILTER_GROUPS) next = setSearch(next, group, '');
  const message = clearedMessage(model.activeCount);
  if (model.visible) next = deepFreeze({ ...next, message });
  return Object.freeze({ message, model, state: next });
}

export function createRevisionScopeFilterResetAction(context) {
  return () => {
    const result = clearRevisionScopeFilters(context.readState(), context.setSearch);
    if (!result.model.visible) return;
    context.writeState(result.state); context.render(result.state);
    context.showToast?.(result.message, 'success');
  };
}

export const _test = Object.freeze({ activeGroups, clearedMessage });
