/**
 * wb3d-settings.js — persisted workbench settings (pure; storage injected).
 *
 * Single localStorage key holds everything: status colors/alpha, tooltip
 * packet-kind filters, marker placement, node options, heatmap, floating
 * panel positions/columns/filters, and Table-to-XML extraction rules.
 */

export const WB3D_SETTINGS_KEY = 'wb3d.settings.v1';

export const MARKER_PLACEMENTS = Object.freeze(['from', 'to', 'mid', 'text']);

export const PANEL_IDS = Object.freeze(['objectDiff', 'conflicts', 'approval']);

export const PANEL_COLUMNS = Object.freeze({
  objectDiff: Object.freeze([
    ['status', 'Status'], ['diff', 'Diff'], ['source', 'Source'], ['target', 'Target'],
    ['confidence', 'Confidence'], ['reasons', 'Reasons'], ['conflicts', 'Conflicts'],
  ]),
  conflicts: Object.freeze([
    ['kind', 'Kind'], ['detail', 'Detail'], ['status', 'Status'], ['source', 'Source'], ['target', 'Target'],
  ]),
  approval: Object.freeze([
    ['element', 'Element'], ['property', 'Property'], ['oldValue', 'Old value'],
    ['newValue', 'New value'], ['confidence', 'Confidence'], ['approval', 'Approval'],
  ]),
});

const DEFAULT_PANEL = (index, columns) => Object.freeze({
  open: false,
  x: 24 + index * 32,
  y: 90 + index * 40,
  collapsed: false,
  columns: Object.freeze(columns.map(([key]) => key)),
  statusFilter: Object.freeze([]),
  confidenceFilter: Object.freeze([]),
  kindFilter: Object.freeze([]),
});

export const DEFAULT_WB3D_SETTINGS = Object.freeze({
  version: 1,
  /** null = show all packet kinds in tooltips/markers; else allowlist */
  tooltipPacketKinds: null,
  /** per-status overrides: { STATUS: { color: '#rrggbb', alpha: 0..1 } } */
  statusStyles: Object.freeze({}),
  markerPlacement: 'mid',
  showAllNodes: false,
  nodeMarkerSizeMm: 24,
  heatmap: Object.freeze({ enabled: false, maxDeltaMm: 50 }),
  panels: Object.freeze({
    objectDiff: DEFAULT_PANEL(0, PANEL_COLUMNS.objectDiff),
    conflicts: DEFAULT_PANEL(1, PANEL_COLUMNS.conflicts),
    approval: DEFAULT_PANEL(2, PANEL_COLUMNS.approval),
  }),
  tablexml: Object.freeze({ customRules: Object.freeze([]) }),
});

function clamp(value, min, max, fallback) {
  const num = Number(value);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function isHexColor(value) {
  return typeof value === 'string' && /^#[0-9a-fA-F]{6}$/.test(value);
}

function normalizePanel(raw, defaults) {
  const panel = { ...defaults, ...(raw && typeof raw === 'object' ? raw : {}) };
  return {
    open: !!panel.open,
    x: clamp(panel.x, 0, 6000, defaults.x),
    y: clamp(panel.y, 0, 20000, defaults.y),
    collapsed: !!panel.collapsed,
    columns: Array.isArray(panel.columns) && panel.columns.length ? panel.columns.map(String) : [...defaults.columns],
    statusFilter: Array.isArray(panel.statusFilter) ? panel.statusFilter.map(String) : [],
    confidenceFilter: Array.isArray(panel.confidenceFilter) ? panel.confidenceFilter.map(String) : [],
    kindFilter: Array.isArray(panel.kindFilter) ? panel.kindFilter.map(String) : [],
  };
}

/** Deep-normalize a raw settings object: clamp, validate, merge defaults. */
export function normalizeSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const statusStyles = {};
  for (const [status, style] of Object.entries(src.statusStyles ?? {})) {
    if (!style || typeof style !== 'object') continue;
    const entry = {};
    if (isHexColor(style.color)) entry.color = style.color.toLowerCase();
    if (style.alpha !== undefined) entry.alpha = clamp(style.alpha, 0.05, 1, 1);
    if (Object.keys(entry).length) statusStyles[status] = entry;
  }
  return {
    version: 1,
    tooltipPacketKinds: Array.isArray(src.tooltipPacketKinds) ? src.tooltipPacketKinds.map(String) : null,
    statusStyles,
    markerPlacement: MARKER_PLACEMENTS.includes(src.markerPlacement) ? src.markerPlacement : DEFAULT_WB3D_SETTINGS.markerPlacement,
    showAllNodes: !!src.showAllNodes,
    nodeMarkerSizeMm: clamp(src.nodeMarkerSizeMm, 4, 500, DEFAULT_WB3D_SETTINGS.nodeMarkerSizeMm),
    heatmap: {
      enabled: !!(src.heatmap && src.heatmap.enabled),
      maxDeltaMm: clamp(src.heatmap?.maxDeltaMm, 1, 100000, DEFAULT_WB3D_SETTINGS.heatmap.maxDeltaMm),
    },
    panels: {
      objectDiff: normalizePanel(src.panels?.objectDiff, DEFAULT_WB3D_SETTINGS.panels.objectDiff),
      conflicts: normalizePanel(src.panels?.conflicts, DEFAULT_WB3D_SETTINGS.panels.conflicts),
      approval: normalizePanel(src.panels?.approval, DEFAULT_WB3D_SETTINGS.panels.approval),
    },
    tablexml: {
      customRules: Array.isArray(src.tablexml?.customRules)
        ? src.tablexml.customRules.filter((r) => r && typeof r.pattern === 'string').map((r) => ({
          id: String(r.id || `custom-${Math.random().toString(36).slice(2, 8)}`),
          label: String(r.label || r.id || 'custom'),
          pattern: String(r.pattern),
          scale: Number.isFinite(Number(r.scale)) ? Number(r.scale) : 1,
          unit: String(r.unit || ''),
        }))
        : [],
    },
  };
}

export function loadSettings(storage) {
  try {
    const raw = storage?.getItem?.(WB3D_SETTINGS_KEY);
    return normalizeSettings(raw ? JSON.parse(raw) : null);
  } catch {
    return normalizeSettings(null);
  }
}

export function saveSettings(storage, settings) {
  try {
    storage?.setItem?.('wb3d.settings.v1', JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}

/** Sorted unique packet kinds across graphs (for the dynamic checkbox list). */
export function discoverPacketKinds(...graphs) {
  const kinds = new Set();
  for (const graph of graphs) {
    for (const object of graph?.objects ?? []) {
      for (const packet of object.packets ?? []) kinds.add(packet.kind);
    }
  }
  return [...kinds].sort();
}

/**
 * Merge default STATUS_STYLES with user overrides.
 * defaults: { STATUS: { color: 0xrrggbb, label } } (viewer shape)
 * → { STATUS: { colorInt, colorHex, alpha, label } }
 */
export function effectiveStatusStyles(settings, defaults) {
  const out = {};
  for (const [status, base] of Object.entries(defaults ?? {})) {
    const override = settings?.statusStyles?.[status] ?? {};
    const colorHex = isHexColor(override.color) ? override.color : `#${base.color.toString(16).padStart(6, '0')}`;
    out[status] = {
      label: base.label,
      colorHex,
      colorInt: parseInt(colorHex.slice(1), 16),
      alpha: clamp(override.alpha, 0.05, 1, 1),
    };
  }
  return out;
}

/** True when a packet kind should be shown in tooltips/markers. */
export function packetKindVisible(settings, kind) {
  const list = settings?.tooltipPacketKinds;
  if (!Array.isArray(list)) return true;
  return list.includes(kind);
}
