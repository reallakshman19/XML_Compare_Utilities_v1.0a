/** Focused factory contract consumed by revision-compare-viewer-adapter.js. */
import {
  assertEngineeringViewerBackend,
  createEngineeringViewerFactory,
} from '../../core/engineering-viewer/index.js';

export const REVISION_COMPARE_VIEWER_FACTORY_SCHEMA = 'RevisionCompareViewerFactory.v1';

export const REVISION_COMPARE_VIEWER_METHODS = Object.freeze([
  'setModels',
  'setStatuses',
  'setMode',
  'setSelection',
  'setVerticalAxis',
  'fitAll',
  'fitSelection',
  'reattach',
  'getStateSnapshot',
  'dispose',
]);

export function assertRevisionCompareViewer(value, label = 'Revision Compare viewer') {
  return assertEngineeringViewerBackend(value, {
    label,
    requiredMethods: REVISION_COMPARE_VIEWER_METHODS,
  });
}

export function createRevisionCompareViewerFactory(factory, label) {
  return createEngineeringViewerFactory(factory, {
    label,
    requiredMethods: REVISION_COMPARE_VIEWER_METHODS,
  });
}
