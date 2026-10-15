export const TABLE_CATEGORIZED_XML_EXPORT_POLICY_SCHEMA = 'table-categorized-xml-export-policy/v2-diagnostics-policy';

export const DEFAULT_TABLE_CATEGORIZED_EXPORT_POLICY = Object.freeze({
  documentRootTag: '',
  rootPartitionTag: '',
  includeXmlDeclaration: false,
  includeDiagnosticsElement: true,
  valueMode: 'child-elements',
  attributeFields: Object.freeze([]),
  childElementFields: Object.freeze([]),
});

const XML_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_.-]*$/;
const clean = (value) => String(value ?? '').trim();
const stringList = (value) => Object.freeze((Array.isArray(value) ? value : []).map(clean).filter(Boolean));

export function isValidXmlTagName(value) {
  return XML_NAME_PATTERN.test(clean(value));
}

export function normalizeExportPolicy(profile = {}) {
  const policy = profile?.exportPolicy || {};
  return Object.freeze({
    documentRootTag: clean(policy.documentRootTag),
    rootPartitionTag: clean(policy.rootPartitionTag),
    includeXmlDeclaration: Boolean(policy.includeXmlDeclaration),
    includeDiagnosticsElement: policy.includeDiagnosticsElement !== false,
    valueMode: clean(policy.valueMode || 'child-elements'),
    attributeFields: stringList(policy.attributeFields),
    childElementFields: stringList(policy.childElementFields),
  });
}

export function validateExportPolicy(profile = {}) {
  const policy = normalizeExportPolicy(profile);
  return Object.freeze([
    ...validateOptionalTag(policy.documentRootTag, 'export_policy_document_root_tag_invalid', 'documentRootTag is not a valid XML tag.'),
    ...validateOptionalTag(policy.rootPartitionTag, 'export_policy_root_partition_tag_invalid', 'rootPartitionTag is not a valid XML tag.'),
    ...validatePolicyFields(policy.attributeFields, 'attributeFields'),
    ...validatePolicyFields(policy.childElementFields, 'childElementFields'),
  ]);
}

export function validateProfileXmlNames(profile = {}) {
  const diagnostics = [];
  for (const item of flattenLevels(profile.levelDefinitions || [])) {
    const tag = clean(item.level.xmlTag || item.level.levelId);
    if (!isValidXmlTagName(tag)) diagnostics.push(blocker('xml_tag_invalid', `Level cannot map to an XML tag: ${tag || '(blank)'}.`, pathText(item.path)));
  }
  return Object.freeze(diagnostics);
}

export function exportPolicyPresent(profile = {}) {
  return Boolean(profile?.exportPolicy && typeof profile.exportPolicy === 'object');
}

function validateOptionalTag(tag, code, message) {
  return tag && !isValidXmlTagName(tag) ? [blocker(code, message, tag)] : [];
}

function validatePolicyFields(fields, group) {
  return fields.filter((field) => !isValidXmlTagName(field)).map((field) => blocker('export_policy_field_tag_invalid', `${group} contains invalid XML field tag: ${field}.`, field));
}

function flattenLevels(levelDefinitions = []) {
  const out = [];
  const walk = (items, path = []) => items.forEach((level, index) => { const nextPath = [...path, index]; out.push({ level, path: nextPath }); walk(level.children || [], nextPath); });
  walk(levelDefinitions);
  return out;
}

function pathText(path = []) {
  return path.join('.') || 'root';
}

function blocker(code, message, ref = '') {
  return Object.freeze({ gate: code, severity: 'BLOCKER', status: 'FAIL', code, message, ref });
}
