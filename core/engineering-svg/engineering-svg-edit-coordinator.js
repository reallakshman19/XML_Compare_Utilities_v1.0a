import { validateEngineeringEditIntent } from '../engineering-scene/index.js';
import { engineeringRevisionTokensEqual } from './engineering-svg-command-gateway.js';
import { validateEngineeringSvgPropertyChanges } from './engineering-svg-property-runtime.js';

export const ENGINEERING_SVG_EDIT_COORDINATOR_SCHEMA = 'EngineeringSvgEditCoordinator.v1';

function assertDraftMatches(intent, draft) {
  if (!draft.operationId) throw new Error('Cannot commit without an active engineering SVG draft.');
  if (draft.operationId !== intent.operationId) throw new Error('Draft operationId does not match the edit intent.');
  if (!engineeringRevisionTokensEqual(draft.baseRevision, intent.baseRevision)) {
    throw new Error('Draft base revision does not match the edit intent.');
  }
}

export function createEngineeringSvgEditCoordinator(options = {}) {
  const { commandGateway, propertyProvider, draftStore } = options;
  if (!commandGateway?.execute || !draftStore?.getSnapshot) {
    throw new TypeError('Engineering SVG edit coordinator requires a command gateway and draft store.');
  }

  async function commit(intentValue) {
    const intent = validateEngineeringEditIntent(intentValue);
    assertDraftMatches(intent, draftStore.getSnapshot());
    if (intent.changes.properties != null) {
      if (!propertyProvider?.getPropertySets) throw new Error('Property edits require an engineering SVG property provider.');
      const propertySets = await propertyProvider.getPropertySets(intent.entityIds, intent.baseRevision);
      validateEngineeringSvgPropertyChanges(intent, propertySets);
    }
    const result = await commandGateway.execute(intent);
    draftStore.clear(`command-${result.status}`);
    return result;
  }

  return Object.freeze({
    schema: ENGINEERING_SVG_EDIT_COORDINATOR_SCHEMA,
    begin: draftStore.begin,
    stageGeometry: draftStore.stageGeometry,
    stageProperty: draftStore.stageProperty,
    getDraft: draftStore.getSnapshot,
    subscribeDraft: draftStore.subscribe,
    commit,
    cancel(reason = 'cancelled') {
      return draftStore.clear(String(reason));
    },
  });
}
