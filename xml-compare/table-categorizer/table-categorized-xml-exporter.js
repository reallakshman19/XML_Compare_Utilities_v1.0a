import { graphChildren } from './table-categorized-xml-graph-builder.js';
import { buildTableCategorizedAudit } from './table-categorized-xml-audit-export.js';
import { hasBlockingValidation } from './table-categorized-xml-validation.js';
import { exportPolicyPresent, isValidXmlTagName, normalizeExportPolicy, validateExportPolicy, validateProfileXmlNames } from './table-categorized-xml-export-policy.js';

export const TABLE_CATEGORIZED_XML_EXPORTER_SCHEMA = 'table-categorized-xml-exporter/v3-xml-contract-hardening';

export function exportCategorizedGraphArtifacts({ graph = null, profile = null, validationResults = [], sources = [] } = {}) {
  if (hasBlockingValidation(validationResults)) return blockedExport();
  if (!graph) return blockedExport('export_blocked_no_graph', 'Graph has not been built.');
  const exportDiagnostics = [...validateProfileXmlNames(profile), ...validateExportPolicy(profile)];
  if (hasPolicyBlockers(exportDiagnostics)) return blockedExport('export_blocked_by_export_policy', 'Export blocked by invalid XML/export policy.', exportDiagnostics);
  const xmlText = serializeCategorizedGraphXml(graph, profile, validationResults, exportDiagnostics);
  const diagnostics = [...validationResults, ...exportDiagnostics];
  if (hasPolicyBlockers(exportDiagnostics)) return blockedExport('export_blocked_by_xml_contract', 'Export blocked by XML contract proof.', exportDiagnostics);
  const audit = buildTableCategorizedAudit({ graph, profile, validationResults, sources });
  return Object.freeze({ ok: true, xmlText, graphJson: JSON.stringify(graph, null, 2), profileJson: JSON.stringify(profile || {}, null, 2), diagnosticsJson: JSON.stringify(diagnostics, null, 2), auditJson: JSON.stringify(audit, null, 2), diagnostics: Object.freeze(exportDiagnostics) });
}

export function serializeCategorizedGraphXml(graph, profile, validationResults = [], exportDiagnostics = []) {
  const documentRoot = documentRootNode(graph);
  const tagMap = levelTagMap(profile);
  const policy = normalizeExportPolicy(profile);
  const configuredPolicy = exportPolicyPresent(profile);
  const fallbackRoot = tagMap.get(documentRoot?.levelId) || documentRoot?.levelId || 'CategorizedTableXml';
  const rootTag = emergencySafeTag(configuredPolicy && policy.documentRootTag ? policy.documentRootTag : fallbackRoot);
  const children = graphChildren(graph, documentRoot?.id).map((node) => nodeXml(graph, node, 1, tagMap, policy, documentRoot?.id)).join('');
  const diagnostics = policy.includeDiagnosticsElement ? diagnosticsXml(validationResults, 1) : '';
  const attrs = attrsText({ key: documentRoot?.key || 'CATEGORIZED_ROOT', profileId: profile?.profileId || graph?.profileId || '' });
  const declaration = configuredPolicy && policy.includeXmlDeclaration ? '<?xml version="1.0" encoding="UTF-8"?>\n' : '';
  const xml = `${declaration}<${rootTag} ${attrs}>\n${children}${diagnostics}</${rootTag}>\n`;
  exportDiagnostics.push(wellFormedDiagnostic(xml));
  return xml;
}

export function levelTagMap(profile = {}) { const map = new Map(); for (const level of flattenLevels(profile?.levelDefinitions || [])) map.set(level.levelId, level.xmlTag || level.levelId); return map; }
export function proofXmlWellFormed(xmlText = '') { return simpleXmlStackProof(String(xmlText || '')); }

function blockedExport(code = 'export_blocked_by_validation', message = 'Export blocked by validation BLOCKER diagnostics.', diagnostics = null) { return Object.freeze({ ok: false, xmlText: '', graphJson: '', profileJson: '', diagnosticsJson: '', auditJson: '', diagnostics: Object.freeze(diagnostics || [{ severity: 'BLOCKER', status: 'FAIL', code, message }]) }); }
function documentRootNode(graph) { const roots = graph?.documentRootNodeIds || []; return (graph?.nodes || []).find((node) => node.id === roots[0]) || (graph?.nodes || []).find((node) => node.fields?.documentRoot); }
function nodeXml(graph, node, depth, tagMap, policy, parentId) { const tag = nodeTag(node, tagMap, policy, parentId); const children = graphChildren(graph, node.id); const pad = '  '.repeat(depth); const body = fieldElements(node, policy, depth + 1); const attrs = attrsText({ ...nodeAttrs(node), ...fieldAttrs(node, policy) }); if (node.levelId === 'gap') return `${pad}<${tag} ${attrs}>${xmlText(node.fields?.value ?? node.fields?.rawValue ?? '')}</${tag}>\n`; if (!children.length && !body) return `${pad}<${tag} ${attrs} />\n`; return `${pad}<${tag} ${attrs}>\n${body}${children.map((child) => nodeXml(graph, child, depth + 1, tagMap, policy, node.id)).join('')}${pad}</${tag}>\n`; }
function nodeTag(node, tagMap, policy, parentId) { if (parentId && node.levelId === 'rootPartition' && policy.rootPartitionTag) return emergencySafeTag(policy.rootPartitionTag); return emergencySafeTag(tagMap.get(node.levelId) || node.levelId); }
function nodeAttrs(node) { const attrs = { key: node.key, levelType: node.levelType }; if (node.displayName && node.displayName !== node.key) attrs.name = node.displayName; if ((node.sourceRefs || []).length) attrs.sourceRefs = node.sourceRefs.join(' '); if (node.levelId === 'supportFeature' && node.fields?.featureType) attrs.type = node.fields.featureType; if (node.levelId === 'gap') attrs.unit = 'mm'; return attrs; }
function fieldAttrs(node, policy) { return Object.fromEntries(policy.attributeFields.filter((field) => node.fields?.[field] != null).map((field) => [field, node.fields[field]])); }
function fieldElements(node, policy, depth) { const pad = '  '.repeat(depth); return policy.childElementFields.filter((field) => node.fields?.[field] != null).map((field) => `${pad}<${emergencySafeTag(field)}>${xmlText(node.fields[field])}</${emergencySafeTag(field)}>\n`).join(''); }
function diagnosticsXml(validationResults, depth) { const pad = '  '.repeat(depth); const itemPad = '  '.repeat(depth + 1); const rows = (validationResults || []).map((item) => `${itemPad}<Diagnostic ${attrsText({ gate: item.gate, severity: item.severity, status: item.status, ref: item.ref })}>${xmlText(item.message)}</Diagnostic>\n`).join(''); return `${pad}<Diagnostics key="DIAGNOSTICS" levelType="diagnosticContainer">\n${rows}${pad}</Diagnostics>\n`; }
function flattenLevels(levels = []) { return levels.flatMap((level) => [level, ...flattenLevels(level.children || [])]); }
function attrsText(attrs) { return Object.entries(attrs).filter(([, value]) => value !== undefined && value !== null && String(value) !== '').map(([key, value]) => `${key}="${xmlAttr(value)}"`).join(' '); }
function emergencySafeTag(value) { const tag = String(value || 'Node'); if (isValidXmlTagName(tag)) return tag; const cleaned = tag.replace(/[^A-Za-z0-9_.-]/g, ''); return /^[A-Za-z_]/.test(cleaned) ? cleaned : `Node${cleaned}`; }
function hasPolicyBlockers(items = []) { return items.some((item) => item.severity === 'BLOCKER' && item.status !== 'PASS'); }
function wellFormedDiagnostic(xml) { const proof = proofXmlWellFormed(xml); return proof.ok ? { severity: 'INFO', status: 'PASS', code: 'export_xml_well_formed', message: 'Serialized XML passed deterministic well-formed proof.' } : { severity: 'BLOCKER', status: 'FAIL', code: 'export_xml_well_formed', message: proof.message }; }
function simpleXmlStackProof(xml) { const stack = []; const tokens = xml.match(/<[^!?][^>]*>/g) || []; for (const token of tokens) { const closing = token.startsWith('</'); const selfClosing = token.endsWith('/>'); const name = closing ? token.slice(2, -1).trim() : token.slice(1).split(/[\s>/]/)[0]; if (closing && stack.pop() !== name) return { ok: false, message: `XML closing tag mismatch: ${name}.` }; if (!closing && !selfClosing) stack.push(name); } return stack.length ? { ok: false, message: `XML has unclosed tag: ${stack.at(-1)}.` } : { ok: true, message: 'XML is well formed.' }; }
export function xmlAttr(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&apos;'); }
export function xmlText(value) { return String(value ?? '').replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;'); }
