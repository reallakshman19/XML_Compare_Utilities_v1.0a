/**
 * Compatibility entry for a stale 3D_Converters module graph on the shared
 * localhost origin. The XML utility does not own the Model Converters tab.
 * When an older shell requests this path, one cache-busted navigation reloads
 * the current XML Compare Utilities entry point. Output is a no-op renderer
 * after the guard has already run; there is no cross-repository fallback.
 */

const CURRENT_APP_BUILD = 'xml-compare-utilities-20260716';

/** @param {Element|null} container @returns {null} */
export function renderModelConvertersTab(container) {
  const locationUrl = new URL(globalThis.location.href);
  if (locationUrl.searchParams.get('appBuild') !== CURRENT_APP_BUILD) {
    locationUrl.searchParams.set('appBuild', CURRENT_APP_BUILD);
    globalThis.location.replace(locationUrl.href);
    return null;
  }
  if (container) {
    container.textContent = 'This localhost origin now serves XML Compare Utilities. Reload the page to use its current tab set.';
  }
  return null;
}

export const __MODEL_CONVERTERS_COMPATIBILITY_BUILD__ = CURRENT_APP_BUILD;
