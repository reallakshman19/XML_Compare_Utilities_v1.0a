from pathlib import Path

PATH = Path('converters/xml-cii2019-core/xml-node-wise-trace.js')


def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one exact match, found {count}')
    return source.replace(old, new, 1)


source = PATH.read_text()
if "function ledgerDecision(seed, ledgerRow, traceRows)" in source and "'dtxr-resolution-ledger'" in source:
    print(f'already patched {PATH}')
    raise SystemExit(0)

source = replace_once(
    source,
    "const TRACE_TYPES = new Set(['dtxr-pos', 'dtxr-ps', 'support-match', 'dtxr-pos-sif-zero']);",
    "const TRACE_TYPES = new Set(['dtxr-pos', 'dtxr-ps', 'support-match', 'dtxr-pos-sif-zero', 'dtxr-resolution-ledger']);",
    'ledger diagnostic type',
)

marker = "function meaningfulDiagnosticValue(value) {\n  const output = text(value);\n  return output && output !== NONE ? output : '';\n}\n\nfunction buildDecision(seed, diagnosticRows, traceRows, options = {}) {"
insert = '''function meaningfulDiagnosticValue(value) {
  const output = text(value);
  return output && output !== NONE ? output : '';
}
function traceNodeNumbersForPaths(traceRows, paths = []) {
  const wanted = new Set((paths || []).map(componentPath).filter(Boolean));
  return unique((traceRows || [])
    .filter((row) => wanted.has(componentPath(row.sourcePath || row.jsonPath)))
    .map(jsonNodeNo));
}
function ledgerDecision(seed, ledgerRow, traceRows) {
  const positionPaths = Array.isArray(ledgerRow.positionPaths)
    ? ledgerRow.positionPaths
    : (Array.isArray(ledgerRow.dtxrPositionPaths) ? ledgerRow.dtxrPositionPaths : []);
  const posNodes = traceNodeNumbersForPaths(traceRows, positionPaths);
  const psPath = ledgerRow.sourcePath || ledgerRow.dtxrPsPath || '';
  const psNodes = traceNodeNumbersForPaths(traceRows, [psPath]);
  const posNodeText = nodeRange(posNodes);
  const psNodeText = nodeRange(psNodes.length ? psNodes : posNodes.slice(0, 1));
  const dtxrPosValue = text(ledgerRow.dtxrPosValue) || NONE;
  const dtxrPsValue = text(ledgerRow.dtxrPsValue) || NONE;
  const status = text(ledgerRow.status) || (dtxrPosValue !== NONE || dtxrPsValue !== NONE ? 'RESOLVED' : 'UNRESOLVED');
  const authority = text(ledgerRow.effectiveAuthority) || 'NONE';
  return Object.freeze({
    schema: XML_CII_XML_NODE_TRACE_SCHEMA,
    xmlNode: seed.xmlNode || text(ledgerRow.nodeNumber) || NONE,
    xmlBranch: seed.xmlBranch || text(ledgerRow.branchName) || NONE,
    componentType: seed.componentType || text(ledgerRow.componentType) || NONE,
    jsonNodeNoDtxrPs: psNodeText,
    jsonNodeNoDtxrPos: posNodeText,
    matchType: authority === 'DTXR_POS_PRIMARY' ? 'POS/PS' : (authority === 'DTXR_PS_FALLBACK' ? 'PS' : 'none'),
    posBasis: text(ledgerRow.position) || positionLabel(seed.position),
    dtxrPosValue,
    dtxrPsName: text(ledgerRow.dtxrPsName) || stripIdentityPrefix(seed.nodeName || seed.componentRefNo) || NONE,
    dtxrPsValue,
    branchRelationship: text(ledgerRow.branchRelationship) || 'NONE',
    distanceMm: ledgerRow.distanceMm ?? '',
    toleranceMm: ledgerRow.toleranceMm ?? '',
    status,
    evidenceAuthority: authority,
    restraintSifBasis: authority,
    matchedPositionJsonNodes: Object.freeze(posNodes),
    matchedPositionJsonPaths: Object.freeze(positionPaths),
    identityJsonPath: psPath,
    identityJsonNodeNo: psNodeText,
    candidateCount: 1,
    diagnosticTypes: Object.freeze(['dtxr-resolution-ledger']),
    jsonNodeNo: psNodeText !== NONE ? psNodeText : posNodeText,
    position: text(ledgerRow.position) || positionLabel(seed.position),
    basis: authority,
    field: 'xml-node-decision',
    finalValue: dtxrPsValue === NONE ? '' : dtxrPsValue,
    oldValue: '',
    detail: text(ledgerRow.message) || (authority === 'DTXR_POS_PRIMARY'
      ? 'Authoritative DTXR ledger: positional group drives restraint/SIF and XML annotation.'
      : authority === 'DTXR_PS_FALLBACK'
        ? 'Authoritative DTXR ledger: PS/NAME fallback used because no positional group resolved.'
        : 'Authoritative DTXR ledger retained unresolved provenance.'),
  });
}

function buildDecision(seed, diagnosticRows, traceRows, options = {}) {
  const ledgerRow = diagnosticRows.find((row) => text(row.type) === 'dtxr-resolution-ledger');
  if (ledgerRow) return ledgerDecision(seed, ledgerRow, traceRows);
'''
source = replace_once(source, marker, insert, 'ledger decision')
PATH.write_text(source)
print(f'patched {PATH}')
