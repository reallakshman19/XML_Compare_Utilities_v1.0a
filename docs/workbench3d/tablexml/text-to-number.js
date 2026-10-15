/**
 * text-to-number.js — smart numeric extraction from engineering table text.
 * Pure; rules are plain data (regex source strings) so the UI can edit and
 * persist them, and tests can assert them against real table formats.
 *
 * Examples handled: 'E 3000mm', '106500mm', '2in', '4"', '1179.000' (m column),
 * '250', 'W 27750mm' (negated), 'PIPE CL# CO-ORDINATE (X) (m)' columns.
 */

export const DEFAULT_EXTRACT_RULES = Object.freeze([
  { id: 'inch-quote', label: 'inches (4")', pattern: '([-+]?\\d*\\.?\\d+)\\s*"', scale: 25.4, unit: 'in' },
  { id: 'inch-suffix', label: 'inches (2in)', pattern: '([-+]?\\d*\\.?\\d+)\\s*in\\b', scale: 25.4, unit: 'in' },
  { id: 'mm-suffix', label: 'millimetres (3000mm)', pattern: '([-+]?\\d*\\.?\\d+)\\s*mm\\b', scale: 1, unit: 'mm' },
  { id: 'm-suffix', label: 'metres (1.5m)', pattern: '([-+]?\\d*\\.?\\d+)\\s*m\\b', scale: 1000, unit: 'm' },
  { id: 'plain', label: 'plain number', pattern: '([-+]?\\d*\\.?\\d+)', scale: 1, unit: '' },
]);

/** Column-level unit override → scale to mm (applied when the rule is unitless). */
export const UNIT_SCALES = Object.freeze({ mm: 1, m: 1000, in: 25.4, '': 1 });

/**
 * Extract a number from text using ordered rules (first match wins).
 * @returns { ok, value (scaled to mm for unit rules), unit, ruleId, raw }
 */
export function extractNumber(text, rules = DEFAULT_EXTRACT_RULES) {
  const raw = String(text ?? '').trim();
  if (!raw) return { ok: false, value: NaN, unit: '', ruleId: null, raw };
  for (const rule of rules) {
    let match = null;
    try { match = raw.match(new RegExp(rule.pattern)); } catch { continue; }
    if (!match) continue;
    const num = Number(match[1] ?? match[0]);
    if (!Number.isFinite(num)) continue;
    return { ok: true, value: num * (Number(rule.scale) || 1), unit: rule.unit ?? '', ruleId: rule.id, raw };
  }
  return { ok: false, value: NaN, unit: '', ruleId: null, raw };
}

/**
 * Extract directional axis components from combined position text.
 * 'E 0mm S 3000mm U 100000mm' → { e: 0, n: -3000, u: 100000 }
 * Convention: E / N / U positive; W / S / D negative.
 */
export function extractAxisComponents(text) {
  const out = {};
  const pattern = /\b([ENSWUD])\s*(-?\d*\.?\d+)\s*(mm|m)?\b/gi;
  let match;
  while ((match = pattern.exec(String(text ?? '')))) {
    const letter = match[1].toUpperCase();
    const scale = match[3]?.toLowerCase() === 'm' ? 1000 : 1;
    const value = Number(match[2]) * scale;
    if (!Number.isFinite(value)) continue;
    if (letter === 'E') out.e = value;
    else if (letter === 'W') out.e = -value;
    else if (letter === 'N') out.n = value;
    else if (letter === 'S') out.n = -value;
    else if (letter === 'U') out.u = value;
    else if (letter === 'D') out.u = -value;
  }
  return out;
}

/** NPS inches → DN nominal bore (mm). */
const NPS_TO_DN = Object.freeze([
  [0.5, 15], [0.75, 20], [1, 25], [1.25, 32], [1.5, 40], [2, 50], [2.5, 65],
  [3, 80], [4, 100], [5, 125], [6, 150], [8, 200], [10, 250], [12, 300],
  [14, 350], [16, 400], [18, 450], [20, 500], [24, 600],
]);

export function boreToNb(value, unit) {
  if (unit === 'in') {
    const inches = value / 25.4;
    const hit = NPS_TO_DN.find(([nps]) => Math.abs(nps - inches) < 0.01);
    if (hit) return hit[1];
  }
  return value;
}

/** 'REST-300, SHOE-300; GUIDE-300' → ['REST-300', 'SHOE-300', 'GUIDE-300'] */
export function splitList(text, separator = /[,;]\s*/) {
  return String(text ?? '').split(separator).map((s) => s.trim()).filter(Boolean);
}

/** 'LINE-STOP-300' → 'LINE-STOP'; 'REST-50' → 'REST'; 'REST' → 'REST'. */
export function supportKindOf(entry) {
  return String(entry ?? '').trim().replace(/-\d+(\.\d+)?$/, '').toUpperCase();
}

/** Live per-column extraction preview for the UI. */
export function previewExtraction(rows, columnId, rules = DEFAULT_EXTRACT_RULES, limit = 8) {
  return (rows ?? []).slice(0, limit).map((row) => {
    const raw = row.rawByColumnId?.[columnId] ?? '';
    const result = extractNumber(raw, rules);
    return { raw, value: result.ok ? result.value : null, ruleId: result.ruleId, ok: result.ok };
  });
}

/** Merge default rules with user custom rules (custom first — they win). */
export function combinedRules(customRules = []) {
  return [...customRules, ...DEFAULT_EXTRACT_RULES];
}
