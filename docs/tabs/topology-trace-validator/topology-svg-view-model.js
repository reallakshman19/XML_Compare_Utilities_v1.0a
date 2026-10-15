/** Applies display-state normalization before the immutable SVG view-model core. */
import {
  buildTopologySvgViewModel as buildCoreTopologySvgViewModel,
  updateTopologySearchViewModel as updateCoreTopologySearchViewModel,
  _test as coreTest,
} from './topology-svg-view-model-core.js?v=20260717-ttv-native-svg-3d-1';
import { effectiveTopologySvgState } from './topology-svg-view-state.js?v=20260717-ttv-native-svg-3d-1';

export function buildTopologySvgViewModel(input) {
  return buildCoreTopologySvgViewModel({ ...input, state: effectiveTopologySvgState(input?.state) });
}

export function updateTopologySearchViewModel(viewModel, state) {
  return updateCoreTopologySearchViewModel(viewModel, effectiveTopologySvgState(state));
}

export const _test = Object.freeze({ ...coreTest, effectiveTopologySvgState });
