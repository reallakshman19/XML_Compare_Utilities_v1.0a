const LEGACY_DIRECTIVE_REGEX = '^(.*?)\\s*\\(\\s*applies\\s+to\\s+([\\s\\S]+?)\\s*\\)\\s*\\.?\\s*$';
const DEFAULT_DIRECTIVE_REGEX = '^(.*?)\\s*\\(\\s*((?:appl(?:y|ies)|typ(?:\\.|ical)?))\\s+to\\s+([\\s\\S]+?)\\s*\\)\\s*\\.?\\s*$';
const DEFAULT_LINE_KEY_REGEX = '(?:^|[-/])([A-Z]\\d{7})(?=-|/|$)';
const DEFAULT_TARGET_SEPARATOR_REGEX = '\\s*[,;\\n]\\s*';

export const APPLIES_TO_TARGET_LIST_MODE = 'TARGET_LIST';
export const APPLIES_TO_ALL_MODE = 'ALL_PARALLEL_IN_WINDOW';
export const APPLIES_TO_AMBIGUOUS_MODE = 'AMBIGUOUS';

export const DEFAULT_APPLIES_TO_CONFIG = Object.freeze({
  appliesToEnabled: true,
  appliesToDirectiveRegex: DEFAULT_DIRECTIVE_REGEX,
  appliesToTargetSeparatorRegex: DEFAULT_TARGET_SEPARATOR_REGEX,
  appliesToLineKeyRegex: DEFAULT_LINE_KEY_REGEX,
  appliesToLineKeyCaptureGroup: 1,
  appliesToParallelOffsetToleranceMm: 500,
  appliesToAlongAxisToleranceMm: 100,
  appliesToElevationToleranceMm: 700,
  appliesToAxisDominanceRatio: 1.25,
  appliesToMinimumAxisSpanMm: 1,
  appliesToDerivedNoteTemplate: '{note} (Based on Tag {tagId})',
  appliesToAllEnabled: true,
  appliesToAllExcludeSourcePipe: true,
  appliesToAllMaxTargetRows: 5000,
});

export function text(value) { return String(value ?? '').trim(); }
export function unique(values) { return [...new Set((values || []).map(text).filter(Boolean))]; }
export function normalizePipeName(value) {
  return text(value).replace(/^\/+|\/+$/g, '').replace(/\s+/g, '').toUpperCase();
}

function nonNegative(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : fallback;
}
function positive(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}
function integer(value, fallback) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : fallback;
}
function bool(value, fallback) {
  if (value === false || value === 'false') return false;
  if (value === true || value === 'true') return true;
  return fallback;
}
function compileRegex(source, fallback, flags = 'i') {
  try { return { regex: new RegExp(text(source) || fallback, flags), error: '' }; }
  catch (error) { return { regex: new RegExp(fallback, flags), error: error?.message || String(error) }; }
}
function directiveRegex(value) {
  const source = text(value);
  return !source || source === LEGACY_DIRECTIVE_REGEX ? DEFAULT_DIRECTIVE_REGEX : source;
}

export function normalizeAppliesToConfig(input = {}) {
  const defaults = DEFAULT_APPLIES_TO_CONFIG;
  return {
    appliesToEnabled: bool(input.appliesToEnabled, defaults.appliesToEnabled),
    appliesToDirectiveRegex: directiveRegex(input.appliesToDirectiveRegex),
    appliesToTargetSeparatorRegex: text(input.appliesToTargetSeparatorRegex) || defaults.appliesToTargetSeparatorRegex,
    appliesToLineKeyRegex: text(input.appliesToLineKeyRegex) || defaults.appliesToLineKeyRegex,
    appliesToLineKeyCaptureGroup: integer(input.appliesToLineKeyCaptureGroup, defaults.appliesToLineKeyCaptureGroup),
    appliesToParallelOffsetToleranceMm: nonNegative(input.appliesToParallelOffsetToleranceMm, defaults.appliesToParallelOffsetToleranceMm),
    appliesToAlongAxisToleranceMm: nonNegative(input.appliesToAlongAxisToleranceMm, defaults.appliesToAlongAxisToleranceMm),
    appliesToElevationToleranceMm: nonNegative(input.appliesToElevationToleranceMm, defaults.appliesToElevationToleranceMm),
    appliesToAxisDominanceRatio: positive(input.appliesToAxisDominanceRatio, defaults.appliesToAxisDominanceRatio),
    appliesToMinimumAxisSpanMm: nonNegative(input.appliesToMinimumAxisSpanMm, defaults.appliesToMinimumAxisSpanMm),
    appliesToDerivedNoteTemplate: text(input.appliesToDerivedNoteTemplate) || defaults.appliesToDerivedNoteTemplate,
    appliesToAllEnabled: bool(input.appliesToAllEnabled, defaults.appliesToAllEnabled),
    appliesToAllExcludeSourcePipe: bool(input.appliesToAllExcludeSourcePipe, defaults.appliesToAllExcludeSourcePipe),
    appliesToAllMaxTargetRows: integer(input.appliesToAllMaxTargetRows, defaults.appliesToAllMaxTargetRows),
  };
}

function directiveGroups(match) {
  if ((match?.length || 0) >= 4) return { note: match[1], alias: match[2], targetText: match[3] };
  return { note: match?.[1], alias: 'APPLIES', targetText: match?.[2] };
}
function normalizedAlias(value) { return text(value).replace(/\./g, '').replace(/\s+/g, ' ').toUpperCase(); }
function emptyDirective(source, regexError = '') {
  return { matched: false, mode: 'NONE', appliesToAll: false, ambiguous: false, note: source, targets: [], rawTargetText: '', rawDirectiveText: '', normalizedDirective: '', matchedAlias: '', regexError };
}

export function parseAppliesToDirective(commentBody, inputConfig = {}) {
  const config = normalizeAppliesToConfig(inputConfig);
  const directive = compileRegex(config.appliesToDirectiveRegex, DEFAULT_DIRECTIVE_REGEX, 'i');
  const separator = compileRegex(config.appliesToTargetSeparatorRegex, DEFAULT_TARGET_SEPARATOR_REGEX, 'i');
  const source = text(commentBody);
  const match = source.match(directive.regex);
  const regexError = directive.error || separator.error;
  if (!match) return emptyDirective(source, regexError);
  const groups = directiveGroups(match);
  const note = text(groups.note) || source;
  const alias = normalizedAlias(groups.alias);
  const rawTargetText = text(groups.targetText).replace(/\s*\.\s*$/, '');
  const targets = unique(rawTargetText.split(separator.regex).map((value) => text(value).replace(/\s*\.\s*$/, '')));
  const allTargets = targets.filter((target) => /^all$/i.test(target));
  const rawDirectiveText = `${text(groups.alias)} TO ${rawTargetText}`.trim();
  if (allTargets.length === 1 && targets.length === 1) {
    return { matched: true, mode: APPLIES_TO_ALL_MODE, appliesToAll: true, ambiguous: false, note, targets: [], rawTargetText, rawDirectiveText, normalizedDirective: 'APPLIES_TO_ALL', matchedAlias: alias, regexError };
  }
  const typAlias = alias.startsWith('TYP');
  const ambiguous = allTargets.length > 0 || typAlias;
  return {
    matched: Boolean(targets.length),
    mode: ambiguous ? APPLIES_TO_AMBIGUOUS_MODE : APPLIES_TO_TARGET_LIST_MODE,
    appliesToAll: false,
    ambiguous,
    ambiguity: allTargets.length ? 'MIXED_ALL_AND_TARGETS' : typAlias ? 'TYP_REQUIRES_ALL' : '',
    note,
    targets,
    rawTargetText,
    rawDirectiveText,
    normalizedDirective: ambiguous ? 'AMBIGUOUS' : 'APPLIES_TO_TARGET_LIST',
    matchedAlias: alias,
    regexError,
  };
}

export function extractLineKey(pipeName, inputConfig = {}) {
  const config = normalizeAppliesToConfig(inputConfig);
  const compiled = compileRegex(config.appliesToLineKeyRegex, DEFAULT_LINE_KEY_REGEX, 'i');
  const match = text(pipeName).match(compiled.regex);
  return { key: text(match?.[config.appliesToLineKeyCaptureGroup] ?? match?.[0]).toUpperCase(), regexError: compiled.error };
}

export function derivedNote(note, tagId, template) {
  return text(template)
    .replaceAll('{note}', text(note))
    .replaceAll('{tagId}', text(tagId))
    .replaceAll('{tag}', text(tagId));
}

export const _test = Object.freeze({ LEGACY_DIRECTIVE_REGEX, DEFAULT_DIRECTIVE_REGEX, normalizedAlias });
