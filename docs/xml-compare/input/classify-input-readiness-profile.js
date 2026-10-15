import { detectXmlCompareProfile, XML_COMPARE_PROFILE_TYPES } from '../XmlCompareProfileDetector.js';

export const PROFILE_READINESS_TYPES = Object.freeze({
  EMPTY: 'empty',
  XML: 'xml',
  JSON: 'json',
  TABLE: 'table',
  TEXT: 'text',
  UNKNOWN: 'unknown',
});

const PROFILE_SCHEMA = 'xml-input-profile-readiness/v1';
const SUPPORTED = new Set(Object.values(XML_COMPARE_PROFILE_TYPES).filter((item) => item !== XML_COMPARE_PROFILE_TYPES.UNKNOWN));

function clean(value) {
  return String(value ?? '').trim();
}

function clamp(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.min(1, number)) : 0;
}

function diagnostic(severity, code, message, ref = '') {
  return Object.freeze({ severity, code, message, ref });
}

function normalizeProfile(value = '') {
  const profile = clean(value), key = profile.toLowerCase().replace(/[^a-z0-9]+/g, '');
  if (key === 'categorizedinputxml') return XML_COMPARE_PROFILE_TYPES.CATEGORIZED_XML;
  if (key === 'inputxml' || key === 'caesarinputxml') return XML_COMPARE_PROFILE_TYPES.INPUT_XML;
  if (key === 'xmlcii2019enrichedxml') return XML_COMPARE_PROFILE_TYPES.CII_ENRICHED_XML;
  if (key === 'xmlcii2019enrichedstage') return XML_COMPARE_PROFILE_TYPES.CII_ENRICHED_STAGE;
  return profile || XML_COMPARE_PROFILE_TYPES.UNKNOWN;
}

function confidenceOf(input = {}, detected = {}, profile = '') {
  if (input.confidence != null || input.dataset?.confidence != null) return clamp(input.confidence ?? input.dataset?.confidence);
  if (detected.confidence) return clamp(detected.confidence);
  return input.profile && SUPPORTED.has(profile) ? 1 : 0;
}

export function createProfileReadinessDiagnostic(input = {}) {
  return diagnostic(clean(input.severity || 'WARNING'), clean(input.code || 'profile_diagnostic'), clean(input.message || input.code || 'Profile readiness diagnostic.'), input.ref || '');
}

function kindOf(rawText = '', fileName = '') {
  const text = clean(rawText), name = clean(fileName).toLowerCase();
  if (!text) return PROFILE_READINESS_TYPES.EMPTY;
  if (/^</.test(text) || name.endsWith('.xml')) return PROFILE_READINESS_TYPES.XML;
  if (/^[\[{]/.test(text) || name.endsWith('.json')) return PROFILE_READINESS_TYPES.JSON;
  if (text.includes('\n') && /[,\t|]/.test(text.split(/\r?\n/)[0] || '')) return PROFILE_READINESS_TYPES.TABLE;
  if (/\s/.test(text) || /[A-Za-z0-9]/.test(text)) return PROFILE_READINESS_TYPES.UNKNOWN;
  return PROFILE_READINESS_TYPES.TEXT;
}

function parseJson(rawText = '') {
  try { return { ok: true, value: JSON.parse(rawText) }; }
  catch (error) { return { ok: false, error }; }
}

function xmlWellFormed(rawText = '') {
  const source = String(rawText || ''), stack = [];
  for (let i = 0; i < source.length;) {
    const lt = source.indexOf('<', i);
    if (lt < 0) return stack.length === 0;
    if (source.startsWith('<!--', lt)) { const end = source.indexOf('-->', lt + 4); if (end < 0) return false; i = end + 3; continue; }
    if (source.startsWith('<![CDATA[', lt)) { const end = source.indexOf(']]>', lt + 9); if (end < 0) return false; i = end + 3; continue; }
    const gt = source.indexOf('>', lt + 1);
    if (gt < 0) return false;
    const tag = clean(source.slice(lt + 1, gt));
    if (!tag || tag.startsWith('?') || tag.startsWith('!')) { i = gt + 1; continue; }
    if (tag.startsWith('/')) { const name = tag.slice(1).split(/\s+/)[0]; if (stack.pop() !== name) return false; }
    else if (!/\/\s*$/.test(tag)) stack.push(tag.split(/\s+/)[0]);
    i = gt + 1;
  }
  return stack.length === 0;
}

function tableDiagnostic() {
  return createProfileReadinessDiagnostic({ severity: 'BLOCKER', code: 'unsupported_table_profile', message: 'Table-like input is not supported by XML Compare intake.' });
}

function supportedJson(payload, detectedType) {
  if (SUPPORTED.has(detectedType)) return true;
  const roots = [payload?.hierarchy, payload?.children, payload?.components].filter(Boolean);
  return roots.some((item) => Array.isArray(item) && item.some((node) => node?.type || node?.attributes));
}

function profileLowConfidence(confidence, recordCount, diagnostics) {
  if (confidence >= 0.8) return;
  diagnostics.push(createProfileReadinessDiagnostic({ severity: recordCount > 0 ? 'WARNING' : 'BLOCKER', code: 'profile_low_confidence', message: `Profile confidence is low (${confidence.toFixed(2)}).` }));
}

function result({ profile, confidence, inputKind, supported, blocker, diagnostics }) {
  return Object.freeze({ schema: PROFILE_SCHEMA, profile, confidence, inputKind, supported, blocker, diagnostics: Object.freeze(diagnostics) });
}

export function classifyInputReadinessProfile(input = {}) {
  const rawText = String(input.rawText || ''), fileName = clean(input.fileName), inputKind = kindOf(rawText, fileName), diagnostics = [];
  if (inputKind === 'empty') return result({ profile: 'empty', confidence: 0, inputKind, supported: false, blocker: true, diagnostics: [createProfileReadinessDiagnostic({ severity: 'BLOCKER', code: 'blank_input', message: 'Input text is blank.' })] });
  if (inputKind === 'table') return result({ profile: 'table', confidence: 0.2, inputKind, supported: false, blocker: true, diagnostics: [tableDiagnostic()] });
  if (inputKind === 'unknown' || inputKind === 'text') return result({ profile: 'unknown', confidence: 0, inputKind: 'unknown', supported: false, blocker: true, diagnostics: [createProfileReadinessDiagnostic({ severity: 'BLOCKER', code: 'unknown_input_profile', message: 'Input profile could not be recognized.' })] });
  return inputKind === 'json' ? classifyJson(input, diagnostics) : classifyXml(input, diagnostics);
}

function classifyJson(input = {}, diagnostics = []) {
  const parsed = parseJson(String(input.rawText || ''));
  if (!parsed.ok) return result({ profile: 'json', confidence: 0, inputKind: 'json', supported: false, blocker: true, diagnostics: [createProfileReadinessDiagnostic({ severity: 'BLOCKER', code: 'json_parse_failed', message: parsed.error.message })] });
  const detected = detectXmlCompareProfile({ name: input.fileName, text: input.rawText, json: parsed.value });
  const profile = normalizeProfile(input.profile || detected.type || 'unknown'), confidence = confidenceOf(input, detected, profile);
  const supported = supportedJson(parsed.value, profile), recordCount = Number(input.recordCount ?? input.records?.length ?? 0) || 0;
  if (!supported) diagnostics.push(createProfileReadinessDiagnostic({ severity: 'BLOCKER', code: 'unsupported_json_profile', message: 'JSON input shape is not supported by XML Compare intake.' }));
  else if (recordCount <= 0) diagnostics.push(createProfileReadinessDiagnostic({ severity: 'BLOCKER', code: 'zero_records', message: 'Recognized JSON profile produced zero records.' }));
  profileLowConfidence(confidence, recordCount, diagnostics);
  return result({ profile, confidence, inputKind: 'json', supported, blocker: diagnostics.some((item) => item.severity === 'BLOCKER'), diagnostics });
}

function classifyXml(input = {}, diagnostics = []) {
  if (!xmlWellFormed(input.rawText)) return result({ profile: 'xml', confidence: 0, inputKind: 'xml', supported: false, blocker: true, diagnostics: [createProfileReadinessDiagnostic({ severity: 'BLOCKER', code: 'xml_parse_failed', message: 'XML-looking input is not well formed.' })] });
  const detected = detectXmlCompareProfile({ name: input.fileName, text: input.rawText });
  const profile = normalizeProfile(input.profile || detected.type || 'unknown'), confidence = confidenceOf(input, detected, profile);
  const supported = SUPPORTED.has(profile), recordCount = Number(input.recordCount ?? input.records?.length ?? 0) || 0;
  if (!supported) diagnostics.push(createProfileReadinessDiagnostic({ severity: 'BLOCKER', code: 'unsupported_xml_profile', message: 'XML root/profile is not supported by XML Compare intake.' }));
  else if (recordCount <= 0) diagnostics.push(createProfileReadinessDiagnostic({ severity: 'BLOCKER', code: 'zero_records', message: 'Recognized XML profile produced zero records.' }));
  profileLowConfidence(confidence, recordCount, diagnostics);
  return result({ profile, confidence, inputKind: 'xml', supported, blocker: diagnostics.some((item) => item.severity === 'BLOCKER'), diagnostics });
}
