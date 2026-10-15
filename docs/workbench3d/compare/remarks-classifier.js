/**
 * remarks-classifier.js — classify free-text REMARKS into status flags (pure).
 *
 * Real support registers carry decisions in the remarks column:
 * "Line No. Change(Old Line No. …)", "Hold Removed, Load changes,
 * PS No./Line No. Change", "Deleted Support", "Invalid (Line No. Changed)".
 */

export const REMARK_FLAGS = Object.freeze([
  'INVALID_ROW',
  'DELETED_SUPPORT',
  'LINE_NO_CHANGED',
  'PS_NO_CHANGED',
  'LOAD_CHANGED',
  'HOLD_REMOVED',
  'SUPPORT_COUNT_CHANGED',
]);

const REMARK_RULES = Object.freeze([
  ['INVALID_ROW', /\binvalid\b/i],
  ['DELETED_SUPPORT', /deleted\s*support/i],
  ['LINE_NO_CHANGED', /line\s*no\.?\s*\/?\s*(change|changed)|line\s*no\.?\s*change|\bline\s*number\s*change/i],
  ['PS_NO_CHANGED', /ps\s*no\.?[^a-z]*(change|changed)/i],
  ['LOAD_CHANGED', /load\s*change/i],
  ['HOLD_REMOVED', /hold\s*removed/i],
  ['SUPPORT_COUNT_CHANGED', /(no\.?|number)\s*of\s*support\s*change|support\s*count\s*change/i],
]);

/** @returns string[] flags (empty for unremarkable text) */
export function classifyRemarks(text) {
  const raw = String(text ?? '').trim();
  if (!raw) return [];
  const flags = [];
  for (const [flag, pattern] of REMARK_RULES) {
    if (pattern.test(raw)) flags.push(flag);
  }
  // "PS No./Line No. Change" names both in one phrase
  if (/ps\s*no\.?\s*\/\s*line\s*no\.?\s*change/i.test(raw)) {
    for (const flag of ['PS_NO_CHANGED', 'LINE_NO_CHANGED']) {
      if (!flags.includes(flag)) flags.push(flag);
    }
  }
  return flags;
}
