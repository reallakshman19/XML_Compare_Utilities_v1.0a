/** Locally vendored official Lucide icon URLs for the topology checker. */

const ICON_NAMES = new Set([
  'network', 'scan-search', 'unlink', 'plug-zap', 'magnet', 'circle-off', 'circle-dot',
  'ruler', 'component', 'scan-line', 'layers', 'undo-2', 'git-commit-horizontal',
  'corner-down-right', 'corner-up-right', 'git-fork', 'split', 'triangle-alert',
  'map-pin-off', 'construction', 'weight', 'circle-help', 'move-3d', 'panel-right',
  'panel-bottom', 'minus', 'x', 'rotate-ccw', 'check-check', 'chevron-up',
  'chevron-down', 'grip', 'dock', 'maximize-2', 'filter', 'eye', 'eye-off',
  'wand-sparkles', 'shield-alert',
  'settings',
]);

/** @param {unknown} name @returns {string} */
export function topologyCheckerIconUrl(name) {
  const normalized = String(name ?? '').trim().toLowerCase();
  const safeName = ICON_NAMES.has(normalized) ? normalized : 'shield-alert';
  return new URL(`../../vendor/lucide/icons/${safeName}.svg`, import.meta.url).href;
}

/** @param {string} name @param {string} label @param {string} className @returns {string} */
export function topologyCheckerIconMarkup(name, label, className) {
  return `<img class="${className}" src="${topologyCheckerIconUrl(name)}" alt="${label}">`;
}

export const _test = Object.freeze({ ICON_NAMES });
