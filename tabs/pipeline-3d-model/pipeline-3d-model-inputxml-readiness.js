function blockerCodes(value) {
  return Array.isArray(value) ? value.map((code) => String(code || '').trim()).filter(Boolean) : [];
}

function blockerSources(output) {
  return [
    ['ORCHESTRATION', output?.orchestration?.blockerCodes],
    ['EXPORT_QUALIFICATION', output?.exportQualification?.blockerCodes],
    ['INPUTXML_DOCUMENT_PLAN', output?.inputXmlDocumentPlan?.blockerCodes],
  ];
}

function appendSource(rows, indexes, source, code) {
  const existing = indexes.get(code);
  if (existing !== undefined) {
    rows[existing].sources.push(source);
    return;
  }
  indexes.set(code, rows.length);
  rows.push({ blockerCode: code, sources: [source] });
}

export function resolvePipelineInputXmlBlockerProvenance(output = {}) {
  const rows = [], indexes = new Map();
  for (const [source, values] of blockerSources(output)) {
    for (const code of blockerCodes(values)) appendSource(rows, indexes, source, code);
  }
  if (output.exportQualification
    && output.exportQualification.inputXmlAllowed !== true && rows.length === 0) {
    appendSource(rows, indexes, 'EXPORT_QUALIFICATION',
      'PIPELINE_PROJECT_MIGRATION_INPUTXML_NOT_ALLOWED');
  }
  return Object.freeze(rows.map((row, index) => Object.freeze({
    order: index + 1,
    blockerCode: row.blockerCode,
    sources: Object.freeze([...row.sources]),
  })));
}

export function resolvePipelineInputXmlBlockers(output = {}) {
  return Object.freeze(resolvePipelineInputXmlBlockerProvenance(output)
    .map((row) => row.blockerCode));
}

export function resolvePipelineInputXmlReadiness(output = {}) {
  const blockerCodes = resolvePipelineInputXmlBlockers(output);
  const blocked = blockerCodes.length > 0;
  return Object.freeze({ state: blocked ? 'BLOCKED' : 'READY', blocked, blockerCodes });
}
