import { categorizedDiagnostic } from './categorized-diagnostics.js';

export const CATEGORIZED_PROFILE_CONTRACT_SCHEMA = 'table-categorizer-profile-contract/v1';
const XML_NAME = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const MODES = Object.freeze(['static', 'zero-or-one', 'one-per-key', 'one-per-row', 'conditional', 'lookup-joined', 'coordinate-clustered', 'many-per-row']);

export function validateCategorizedProfileContract(profile = {}) {
  const diagnostics = [];
  if (!String(profile.profileId || '').trim()) {
    diagnostics.push(categorizedDiagnostic('BLOCKER', 'profile_id_missing', 'profileId is required.'));
  }
  const levels = flatten(profile.levelDefinitions || []);
  if (levels.filter((level) => level.documentRoot).length !== 1) {
    diagnostics.push(categorizedDiagnostic('BLOCKER', 'profile_document_root_count', 'Exactly one document root is required.'));
  }
  for (const level of levels) validateLevel(level, diagnostics);
  return result(diagnostics);
}

function validateLevel(level, diagnostics) {
  if (!String(level.levelId || '').trim()) diagnostics.push(categorizedDiagnostic('BLOCKER', 'profile_level_id_missing', 'levelId is required.'));
  if (!MODES.includes(level.creationMode)) diagnostics.push(categorizedDiagnostic('BLOCKER', 'profile_creation_mode_invalid', `Unsupported creationMode ${level.creationMode}.`, level.levelId));
  const tag = level.xmlTag || level.levelId;
  if (!XML_NAME.test(String(tag || ''))) diagnostics.push(categorizedDiagnostic('BLOCKER', 'profile_xml_tag_invalid', `Invalid XML tag ${tag}.`, level.levelId));
}

function flatten(levels) {
  return levels.flatMap((level) => [level, ...flatten(level.children || [])]);
}

function result(diagnostics) {
  return Object.freeze({ ok: !diagnostics.some((item) => item.severity === 'BLOCKER' || item.severity === 'ERROR'), diagnostics: Object.freeze(diagnostics) });
}
