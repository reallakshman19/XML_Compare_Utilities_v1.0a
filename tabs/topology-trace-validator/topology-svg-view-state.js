/** Normalizes Trace display state before immutable SVG view-model construction. */
import { asArray, cleanText, deepFreeze, objectRecord } from './topology-validator-values.js';

export function effectiveTopologySvgState(input) {
  const state = objectRecord(input);
  const isolateSupports = state.isolateSupports === true;
  return deepFreeze({
    ...state,
    isolateSupports,
    types: isolateSupports ? ['SUPPORT'] : asArray(state.types).map(cleanText),
    showComponentSymbols: isolateSupports || state.showComponentSymbols === true,
  });
}
