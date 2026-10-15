/**
 * heatmap.js — position-delta heatmap coloring (pure).
 * Blue (no movement) → red (>= maxDeltaMm), via green/yellow/orange HSL ramp.
 */

function hslToInt(h, s, l) {
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    const c = l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(255 * c);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

/** deltaMm ∈ [0, maxDeltaMm] → color int (blue 220° → red 0°). */
export function heatmapColor(deltaMm, maxDeltaMm = 50) {
  const t = Math.max(0, Math.min(1, Number(deltaMm) / Math.max(1e-6, Number(maxDeltaMm))));
  const hue = 220 * (1 - t);
  return hslToInt(hue, 0.85, 0.55);
}

/**
 * Map objectId → heatmap color for every matched diff row that carries a
 * positionDeltaMm (both source and target ids get the pair's color).
 */
export function buildHeatmapOverrides(audit, settings) {
  const overrides = new Map();
  if (!settings?.heatmap?.enabled) return overrides;
  const max = settings.heatmap.maxDeltaMm ?? 50;
  for (const row of audit?.objectDiff?.rows ?? []) {
    if (!Number.isFinite(row.positionDeltaMm)) continue;
    const color = heatmapColor(row.positionDeltaMm, max);
    if (row.sourceObjectId) overrides.set(row.sourceObjectId, color);
    if (row.targetObjectId) overrides.set(row.targetObjectId, color);
  }
  return overrides;
}
