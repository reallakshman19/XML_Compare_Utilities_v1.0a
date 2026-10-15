export const XML_COMPARE_ENRICHMENT_APPLY_SCHEMA = 'xml-compare-enrichment-apply/v3-idempotent-upsert';

const GENERATED_CHILD_TAGS = Object.freeze([
  'Point_properties_basis', 'ComponentType', 'DTXR_POS', 'DTXR_PS',
  'PipingClass', 'Rating', 'Position',
]);

function normalizeNode(v) {
  const n = Number(v);
  return Number.isFinite(n) ? String(Math.round(n)) : String(v ?? '').trim();
}
function isSentinel(n) { return Number.isFinite(n) && n <= -1.0 && n >= -2.0; }
function attrVal(attrsStr, name) { const m = new RegExp(`\\b${name}\\s*=\\s*"([^"]*)"`, 'i').exec(attrsStr); return m ? m[1] : ''; }
function xmlEsc(v) { return String(v ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;'); }
function childEl(name, value) { return value == null || value === '' ? '' : `<${name}>${xmlEsc(String(value))}</${name}>`; }
function emptyReport() { return { restraintTypeConverted: 0, pipingClassApplied: 0, ratingApplied: 0, componentTypeApplied: 0, positionApplied: 0, dtxrApplied: 0, pointBasisApplied: 0 }; }

function buildRestraintTypeConvertMap(cfg) {
  const map = new Map();
  if (!cfg?.enabled || !Array.isArray(cfg.rows)) return map;
  for (const row of cfg.rows) {
    const from = String(row.from ?? '').trim(), to = String(row.to ?? '').trim();
    if (from && to && from !== to) map.set(from, to);
  }
  return map;
}
function analysisFromBody(body = '') {
  const restraintTypes = [];
  body.replace(/<RESTRAINT\b([^>]*)>/gi, (_m, attrs) => {
    const t = Number(attrVal(attrs, 'TYPE'));
    if (Number.isFinite(t) && !isSentinel(t)) restraintTypes.push(Math.round(t));
    return _m;
  });
  return { hasBend: /<BEND\b/i.test(body), hasSif: /<SIF\b/i.test(body), hasRigid: /<RIGID\b/i.test(body), restraintTypes };
}
function buildAnalysisMapRegex(xmlText) {
  const map = new Map();
  String(xmlText || '').replace(/<PIPINGELEMENT\b([^>]*)>([\s\S]*?)<\/PIPINGELEMENT>/gi, (_m, attrs, body) => {
    const key = `${normalizeNode(attrVal(attrs, 'FROM_NODE'))}->${normalizeNode(attrVal(attrs, 'TO_NODE'))}`;
    map.set(key, analysisFromBody(body));
    return _m;
  });
  return map;
}
function buildAnalysisMap(xmlText) {
  if (typeof DOMParser === 'undefined') return buildAnalysisMapRegex(xmlText);
  try {
    const doc = new DOMParser().parseFromString(xmlText, 'application/xml');
    if (doc.querySelector('parsererror')) return buildAnalysisMapRegex(xmlText);
    const map = new Map();
    for (const el of doc.documentElement.children) {
      if (el.tagName !== 'PIPINGELEMENT') continue;
      const from = normalizeNode(el.getAttribute('FROM_NODE')), to = normalizeNode(el.getAttribute('TO_NODE'));
      map.set(`${from}->${to}`, analysisFromBody(el.innerHTML || ''));
    }
    return map;
  } catch { return buildAnalysisMapRegex(xmlText); }
}

function parseTypeMap(text) {
  const map = new Map();
  for (const row of String(text || '').trim().split(/\r?\n/)) {
    const [type, kind, dtxrPos] = row.split('\t').map(s => s.trim());
    if (!type || /^type$/i.test(type)) continue;
    map.set(type, { kind: kind || '', dtxrPos: dtxrPos || kind || '' });
  }
  return map;
}
function parseRatingTable(text) {
  const map = new Map();
  for (const row of String(text || '').trim().split(/\r?\n/)) {
    const [cls, rating] = row.split('\t').map(s => s.trim());
    if (!cls || !rating || /^piping/i.test(cls)) continue;
    map.set(cls.toUpperCase(), rating);
  }
  return map;
}
function cleanLineIdForTokens(lineId) { return String(lineId || '').trim().replace(/^\/+/, '').replace(/\/B\d+$/i, ''); }
function splitLineIdTokens(lineId, cfg = {}) { return cleanLineIdForTokens(lineId).split(cfg.tokenDelimiter || '-').map(s => s.trim()).filter(Boolean); }
function extractRegexValue(lineId, cfg = {}) {
  const regex = String(cfg.regex || '').trim();
  if (!regex) return { value: '', error: '' };
  try { const match = new RegExp(regex, 'i').exec(String(lineId || '').trim()); return { value: match?.[Math.max(0, Number(cfg.group) || 1)]?.trim() || '', error: '' }; }
  catch { return { value: '', error: 'Invalid regex pattern.' }; }
}
function extractTokenValue(lineId, cfg = {}) {
  const tokens = splitLineIdTokens(lineId, cfg);
  return { value: tokens[Math.max(0, (Number(cfg.tokenPosition) || 4) - 1)] || '', tokens };
}
function resolvePreviewRating(selectedValue, ratingCfg = {}) {
  if (!selectedValue || !ratingCfg?.enabled) return '';
  if (ratingCfg.method === 'fixed') return String(ratingCfg.fixedValue || '').trim();
  return parseRatingTable(ratingCfg.tableText).get(String(selectedValue).toUpperCase()) || '';
}
export function previewPipingClassExtraction(lineId, config = {}) {
  const pcCfg = config.pipingClass || config || {}, ratingCfg = config.rating || {}, text = String(lineId || '').trim();
  const regex = extractRegexValue(text, pcCfg), token = extractTokenValue(text, pcCfg), selectedValue = regex.value || token.value || '';
  const source = regex.value ? 'regex' : (token.value ? 'token' : 'none');
  return { lineId: text, regexValue: regex.value, regexError: regex.error, tokenValue: token.value, selectedValue, tokens: token.tokens, pipingClass: selectedValue, rating: resolvePreviewRating(selectedValue, ratingCfg), source };
}
export function extractPipingClass(lineId, cfg) { return previewPipingClassExtraction(lineId, cfg).selectedValue; }

function generatedChildRegex() { return new RegExp(`\\n?\\s*<(${GENERATED_CHILD_TAGS.join('|')})>[^<]*<\\/\\1>`, 'gi'); }
export function stripGeneratedChildren(xmlBody = '') { return String(xmlBody || '').replace(generatedChildRegex(), ''); }
function addChild(children, report, key, tag, value) {
  const child = childEl(tag, value);
  if (!child || children.some((row) => row.startsWith(`<${tag}>`))) return;
  children.push(child); report[key] += 1;
}
function generatedChildrenForElement(attrs, ctx) {
  const { pcCfg, rtCfg, ctCfg, posCfg, dtxrCfg, ppbCfg, analysisMap, typeMap, ratingMap, nodeCoords, report } = ctx;
  const fromNode = normalizeNode(attrVal(attrs, 'FROM_NODE')), toNode = normalizeNode(attrVal(attrs, 'TO_NODE'));
  const key = `${fromNode}->${toNode}`;
  if (analysisMap.size > 0 && !analysisMap.has(key)) return [];
  const analysis = analysisMap.get(key) || {}, lineId = attrVal(attrs, 'LINE_ID').replaceAll('&quot;', '"'), children = [];
  if (ppbCfg?.enabled) addChild(children, report, 'pointBasisApplied', 'Point_properties_basis', ppbCfg.value || 'TO');
  if (ctCfg?.enabled) addChild(children, report, 'componentTypeApplied', 'ComponentType', analysis.hasBend ? (ctCfg.bendType || 'ELBO') : analysis.hasSif ? (ctCfg.sifType || 'BRAN') : analysis.hasRigid ? (ctCfg.rigidType || 'ATTA') : (ctCfg.defaultType || 'ATTA'));
  if (dtxrCfg?.enabled && analysis.restraintTypes?.length) {
    const entry = typeMap.get(String(analysis.restraintTypes[0]));
    if (entry?.dtxrPos) { children.push(childEl('DTXR_POS', entry.dtxrPos), childEl('DTXR_PS', entry.dtxrPos)); report.dtxrApplied += 1; }
  }
  if (pcCfg?.enabled && lineId) applyClassAndRating(children, report, lineId, pcCfg, rtCfg, ratingMap);
  if (posCfg?.enabled) applyPosition(children, report, attrs, fromNode, toNode, nodeCoords);
  return children.filter(Boolean);
}
function applyClassAndRating(children, report, lineId, pcCfg, rtCfg, ratingMap) {
  const cls = extractPipingClass(lineId, pcCfg);
  if (!cls) return;
  addChild(children, report, 'pipingClassApplied', 'PipingClass', cls);
  if (!rtCfg?.enabled) return;
  const rating = rtCfg.method === 'fixed' ? (rtCfg.fixedValue || '') : (ratingMap.get(cls.toUpperCase()) || '');
  addChild(children, report, 'ratingApplied', 'Rating', rating);
}
function applyPosition(children, report, attrs, fromNode, toNode, nodeCoords) {
  const fromCoords = nodeCoords.get(fromNode);
  if (!fromCoords) return;
  const delta = ['DELTA_X', 'DELTA_Y', 'DELTA_Z'].map((name) => Number(attrVal(attrs, name))).map((n) => !isSentinel(n) ? n : 0);
  const toCoords = { x: fromCoords.x + delta[0], y: fromCoords.y + delta[1], z: fromCoords.z + delta[2] };
  nodeCoords.set(toNode, toCoords);
  addChild(children, report, 'positionApplied', 'Position', `${toCoords.x.toFixed(2)} ${toCoords.y.toFixed(2)} ${toCoords.z.toFixed(2)}`);
}
function upsertGeneratedChildrenInBlock(match, attrs, body, ctx) {
  const children = generatedChildrenForElement(attrs, ctx);
  if (!children.length) return match;
  const cleanedBody = stripGeneratedChildren(body);
  const prefix = cleanedBody.startsWith('\n') ? '' : '\n';
  return `<PIPINGELEMENT${attrs}>\n    ${children.join('\n    ')}${prefix}${cleanedBody}</PIPINGELEMENT>`;
}

export function applyXmlCompareEnrichment(xmlText, config = {}) {
  const { pipingClass: pcCfg, rating: rtCfg, componentType: ctCfg, position: posCfg, dtxr: dtxrCfg, pointPropertiesBasis: ppbCfg, restraintTypeConvert: rtcCfg } = config || {};
  if (![pcCfg, rtCfg, ctCfg, posCfg, dtxrCfg, ppbCfg, rtcCfg].some(c => c?.enabled)) return { xmlText, report: emptyReport() };
  const report = emptyReport(), rtcMap = buildRestraintTypeConvertMap(rtcCfg);
  let workingText = String(xmlText || '');
  if (rtcMap.size) workingText = workingText.replace(/<RESTRAINT\b([^>]*)>/gi, (match, attrs) => convertRestraintType(match, attrs, rtcMap, report));
  const ctx = { pcCfg, rtCfg, ctCfg, posCfg, dtxrCfg, ppbCfg, report, analysisMap: buildAnalysisMap(workingText), typeMap: dtxrCfg?.enabled ? parseTypeMap(dtxrCfg.typeMapText) : new Map(), ratingMap: (rtCfg?.enabled && rtCfg.method !== 'fixed') ? parseRatingTable(rtCfg.tableText) : new Map(), nodeCoords: initialNodeCoords(workingText, posCfg) };
  const output = workingText.replace(/<PIPINGELEMENT\b([^>]*)>([\s\S]*?)<\/PIPINGELEMENT>/gi, (match, attrs, body) => upsertGeneratedChildrenInBlock(match, attrs, body, ctx));
  return { xmlText: output, report };
}
function convertRestraintType(match, attrs, rtcMap, report) {
  const typeMatch = /\bTYPE\s*=\s*"([^"]*)"/.exec(attrs);
  if (!typeMatch) return match;
  const toType = rtcMap.get(typeMatch[1].trim());
  if (toType == null) return match;
  report.restraintTypeConverted += 1;
  return `<RESTRAINT${attrs.replace(/\bTYPE\s*=\s*"[^"]*"/, `TYPE="${xmlEsc(toType)}"`)}>`;
}
function initialNodeCoords(xmlText, posCfg) {
  const nodeCoords = new Map();
  if (!posCfg?.enabled) return nodeCoords;
  const firstTag = /<PIPINGELEMENT\b([^>]*)>/i.exec(xmlText);
  const fn = firstTag ? normalizeNode(attrVal(firstTag[1], 'FROM_NODE')) : '';
  if (fn) nodeCoords.set(fn, { x: Number(posCfg.startX) || 0, y: Number(posCfg.startY) || 0, z: Number(posCfg.startZ) || 0 });
  return nodeCoords;
}

export const _test = Object.freeze({ normalizeNode, isSentinel, attrVal, extractPipingClass, parseTypeMap, parseRatingTable, buildAnalysisMap, buildRestraintTypeConvertMap, emptyReport, cleanLineIdForTokens, splitLineIdTokens, previewPipingClassExtraction, stripGeneratedChildren, generatedChildrenForElement });
