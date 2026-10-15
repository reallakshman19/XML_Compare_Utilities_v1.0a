from pathlib import Path
import re

PATH = Path('tabs/model-converters/json-trace/json-trace-panel.js')


def replace_once(source, old, new, label):
    count = source.count(old)
    if count != 1:
        raise SystemExit(f'{label}: expected one exact match, found {count}')
    return source.replace(old, new, 1)


def regex_once(source, pattern, replacement, label):
    output, count = re.subn(pattern, lambda _: replacement, source, count=1, flags=re.S)
    if count != 1:
        raise SystemExit(f'{label}: expected one regex match, found {count}')
    return output


source = PATH.read_text()
source = replace_once(
    source,
    "import { buildJsonTraceTree } from '../../../converters/xml-cii2019-core/json-trace-tree.js';",
    "import { buildJsonTraceTree } from '../../../converters/xml-cii2019-core/json-trace-tree.js';\nimport { buildXmlNodeWiseTraceRows, evidenceTreeToCsv, matchedFactsToClipboardText, xmlNodeWiseTraceToCsv } from '../../../converters/xml-cii2019-core/xml-node-wise-trace.js';",
    'dual trace import',
)
source = replace_once(
    source,
    "function downloadText(name, value, type) { const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([value], { type })); anchor.download = name; anchor.click(); URL.revokeObjectURL(anchor.href); }",
    "function downloadText(name, value, type) { const anchor = document.createElement('a'); anchor.href = URL.createObjectURL(new Blob([value], { type })); anchor.download = name; anchor.click(); URL.revokeObjectURL(anchor.href); }\nasync function copyText(value) {\n  const output = String(value ?? '');\n  if (globalThis.navigator?.clipboard?.writeText) { await globalThis.navigator.clipboard.writeText(output); return; }\n  const area = document.createElement('textarea');\n  area.value = output; area.setAttribute('readonly', ''); area.style.position = 'fixed'; area.style.opacity = '0';\n  document.body.appendChild(area); area.select(); document.execCommand?.('copy'); area.remove();\n}",
    'copy helper',
)
matched_panel = '''function dashboardMatchedFacts(current) {
  const rows = (current.xmlTraceRows || []).filter((row) => row.status === 'RESOLVED');
  const preview = rows.slice(0, 40);
  const body = preview.length
    ? `<div class="json-trace-table-wrap"><table class="json-trace-table"><thead><tr><th>XML Node</th><th>Match</th><th>DTXR_PS/NAME</th><th>DTXR_PS Value</th><th>Authority</th></tr></thead><tbody>${preview.map((row) => `<tr><td>${esc(row.xmlNode)}</td><td>${esc(row.matchType)}</td><td>${esc(row.dtxrPsName)}</td><td>${esc(row.dtxrPsValue)}</td><td>${esc(row.evidenceAuthority)}</td></tr>`).join('')}</tbody></table></div>`
    : '<div class="json-trace-empty">Build XML node trace to show matched facts.</div>';
  const more = rows.length > preview.length ? `<div class="json-trace-muted">Showing first ${preview.length} of ${rows.length} matched facts.</div>` : '';
  return `<div class="json-trace-tree-card" data-json-trace-matched-facts><div class="json-trace-section-head"><div class="json-trace-card-title">✅ Matched Facts</div><button type="button" class="json-trace-ghost-btn" data-json-trace-copy-matched title="Copy matched facts" aria-label="Copy matched facts">⧉ Copy</button></div>${body}${more}</div>`;
}
'''
source = replace_once(
    source,
    'function dashboardTreePanel(traceRows, current) {',
    matched_panel + 'function dashboardTreePanel(traceRows, current) {',
    'matched facts panel',
)
dashboard_xml = '''function dashboardXmlTraceTable(current) {
  const rows = (current.xmlTraceRows || []).slice(0, TRACE_RENDER_LIMIT);
  if (!rows.length) return `<div class="json-trace-table-wrap"><div class="json-trace-empty">Build XML node trace after importing JSON and loading XML.</div></div>`;
  const cells = (row) => [
    esc(row.xmlNode),
    `<span title="${esc(row.xmlBranch)}">${esc(compactBranch(row.xmlBranch))}</span>`,
    esc(row.componentType),
    esc(row.jsonNodeNoDtxrPs),
    esc(row.jsonNodeNoDtxrPos),
    esc(row.matchType),
    esc(row.posBasis),
    esc(row.dtxrPosValue),
    esc(row.dtxrPsName),
    esc(row.dtxrPsValue),
    esc(row.branchRelationship),
    esc(row.distanceMm),
    esc(row.toleranceMm),
    `<span class="json-trace-status ${row.status === 'RESOLVED' ? 'is-applied' : ''}">${esc(row.status || '')}</span>`,
  ];
  const heads = ['XML Node', 'XML Branch', 'Type', 'JsonNodeNo(DTXR_PS)', 'JsonNodeNo(DTXR_POS)', 'Match Type', 'POS Basis', 'DTXR_POS Value', 'DTXR_PS/NAME', 'DTXR_PS Value', 'Branch Relationship', 'Distance mm', 'Tolerance mm', 'Status'];
  return `<div class="json-trace-table-wrap"><table class="json-trace-table" data-xml-trace-table><thead><tr>${heads.map((head) => `<th>${esc(head)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${cells(row).map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
'''
source = regex_once(
    source,
    r"function dashboardXmlTraceTable\(current\) \{.*?\n\}\nfunction dashboardPanel",
    dashboard_xml + 'function dashboardPanel',
    'dashboard XML table',
)
dashboard_panel = '''function dashboardPanel(current, services) {
  const traceRows = activeTraceRows(current), treeRows = traceRowsForTree(current), sourceDrawer = dashboardSourceDrawer(current, services);
  const sourceTop = text(current.stagedJsonText) || traceRows.length ? '' : sourceDrawer;
  const sourceBottom = sourceTop ? '' : sourceDrawer;
  return `<div class="json-trace-dashboard"><div class="json-trace-page-title">Import tab</div>${dashboardDelimiterControls(current)}${sourceTop}${dashboardMatchedFacts(current)}<div class="json-trace-section-head"><div class="json-trace-section-title">🌿 Evidence Tree</div><div class="json-trace-section-actions"><button type="button" class="json-trace-ghost-btn" data-json-trace-export-tree>Export tree JSON</button><button type="button" class="json-trace-ghost-btn" data-json-trace-export-tree-csv>Evidence Tree CSV</button></div></div>${dashboardTreePanel(treeRows, current)}<div class="json-trace-section-head"><div class="json-trace-section-title">📋 XML Node Wise Trace</div><div class="json-trace-section-actions"><button type="button" class="json-trace-ghost-btn" data-json-trace-build-xml>Build XML node trace</button><button type="button" class="json-trace-ghost-btn" data-json-trace-export-xml>Export JSON</button><button type="button" class="json-trace-ghost-btn" data-json-trace-export-xml-csv>XML Node Wise Trace CSV</button><span class="json-trace-muted">${esc(current.xmlTraceStatus || '')}</span></div></div>${dashboardXmlTraceTable(current)}${sourceBottom}</div>`;
}
'''
source = regex_once(
    source,
    r"function dashboardPanel\(current, services\) \{.*?\n\}\nfunction importPanel",
    dashboard_panel + 'function importPanel',
    'dashboard panel',
)
json_node_panel = '''function jsonNodePanel(current) {
  const displayTrace = activeTraceRows(current), { rows, total } = jsonTraceRows(displayTrace), countLabel = scopeSummaryText(current, total);
  const cols = [{ key: 'jsonNodeNo', label: 'JsonNodeNo' }, { key: 'matchType', label: 'Match Type' }, { key: 'matchedToken', label: 'Matched Token/Text' }, { key: 'jsonPath', label: 'JSON Path' }, { key: 'objectType', label: 'Type' }, { key: 'branchName', label: 'Branch' }, { key: 'nodeNumber', label: 'Node' }, { key: 'field', label: 'Field' }, { key: 'sourceAttribute', label: 'Source Attr' }, { key: 'finalValue', label: 'Value' }, { key: 'basis', label: 'Basis' }, { key: 'status', label: 'Status' }];
  const title = current.traceScopeSummary ? 'XML-scoped JsonNode Trace' : 'JsonNode Trace';
  return `<section class="xml-cii-native-card"><div class="model-converters-workflow-detail-title">🌿 Evidence Tree / ${title}</div><div class="model-converters-workflow-detail-text">Parsed staged JSON facts filtered by uploaded XML BranchName, DTXR_POS, DTXR_PS, and delimited PS support tags when XML is available.</div><div class="xml-cii-native-toolbar" style="margin-bottom:4px;"><button type="button" class="model-converters-download-btn" data-json-trace-export-tree>Export tree JSON</button><button type="button" class="model-converters-download-btn" data-json-trace-export-tree-csv>Evidence Tree CSV</button></div>${jsonTraceTree(traceRowsForTree(current), current)}${filterBar('data-json-trace-filter', 'data-json-trace-count')}${compactTable(cols, rows, 'Import and parse staged JSON to show JsonNode trace rows.', 'data-json-trace-table', countLabel)}</section>`;
}
'''
source = regex_once(
    source,
    r"function jsonNodePanel\(current\) \{.*?\n\}\nfunction xmlNodePanel",
    json_node_panel + 'function xmlNodePanel',
    'JSON node panel',
)
xml_node_panel = '''function xmlNodePanel(current) {
  const allRows = current.xmlTraceRows || [], displayRows = allRows.slice(0, TRACE_RENDER_LIMIT), countLabel = allRows.length > TRACE_RENDER_LIMIT ? `Showing first ${TRACE_RENDER_LIMIT} of ${allRows.length} rows. Use the filter below to find specific values.` : `${allRows.length} row${allRows.length !== 1 ? 's' : ''}`;
  const cols = [{ key: 'xmlNode', label: 'XML Node' }, { key: 'xmlBranch', label: 'XML Branch' }, { key: 'componentType', label: 'Type' }, { key: 'jsonNodeNoDtxrPs', label: 'JsonNodeNo(DTXR_PS)' }, { key: 'jsonNodeNoDtxrPos', label: 'JsonNodeNo(DTXR_POS)' }, { key: 'matchType', label: 'Match Type' }, { key: 'posBasis', label: 'POS Basis' }, { key: 'dtxrPosValue', label: 'DTXR_POS Value' }, { key: 'dtxrPsName', label: 'DTXR_PS/NAME' }, { key: 'dtxrPsValue', label: 'DTXR_PS Value' }, { key: 'branchRelationship', label: 'Branch Relationship' }, { key: 'distanceMm', label: 'Distance mm' }, { key: 'toleranceMm', label: 'Tolerance mm' }, { key: 'status', label: 'Status' }, { key: 'evidenceAuthority', label: 'Restraint/SIF Authority' }, { key: 'identityJsonPath', label: 'Identity JSON Path' }, { key: 'matchedPositionJsonPaths', label: 'Position JSON Path(s)' }, { key: 'detail', label: 'Detail' }];
  return `<section class="xml-cii-native-card"><div class="model-converters-workflow-detail-title">📋 XML Node Wise Trace</div><div class="model-converters-workflow-detail-text">One decision row per XML node. DTXR_POS is authoritative for restraint/SIF derivation; DTXR_PS/NAME is retained independently and used only as fallback.</div><div class="xml-cii-native-toolbar"><button type="button" class="model-converters-run-btn" data-json-trace-build-xml>Build XML node trace</button><button type="button" class="model-converters-download-btn" data-json-trace-export-xml>Export XML node trace JSON</button><button type="button" class="model-converters-download-btn" data-json-trace-export-xml-csv>XML Node Wise Trace CSV</button><span class="xml-cii-native-status-text">${esc(current.xmlTraceStatus || '')}</span></div>${filterBar('data-xml-trace-filter', 'data-xml-trace-count')}${compactTable(cols, displayRows, 'Build XML node trace after importing JSON and loading XML.', 'data-xml-trace-table', countLabel)}</section>`;
}
'''
source = regex_once(
    source,
    r"function xmlNodePanel\(current\) \{.*?\n\}\nfunction activePanel",
    xml_node_panel + 'function activePanel',
    'XML node panel',
)
export_tree = "  body.querySelector('[data-json-trace-export-tree]')?.addEventListener('click', () => { const cur = state(), delimiterOpts = { useDelimiter: cur.useDelimiter === true, delimiter: cur.delimiter || '|', joinMode: cur.joinMode || 'unique' }; const tree = buildJsonTraceTree(traceRowsForTree(cur), { rowLimit: 999, groupLimit: 999, ...delimiterOpts }); downloadText('xml_cii_json_trace_tree.json', JSON.stringify(tree, null, 2), 'application/json'); });"
source = replace_once(
    source,
    export_tree,
    export_tree + "\n  body.querySelector('[data-json-trace-export-tree-csv]')?.addEventListener('click', () => { const cur = state(), options = { useDelimiter: cur.useDelimiter === true, delimiter: cur.delimiter || '|', joinMode: cur.joinMode || 'unique' }; downloadText('xml_cii_evidence_tree.csv', evidenceTreeToCsv(traceRowsForTree(cur), options), 'text/csv'); });",
    'Evidence Tree CSV listener',
)
export_xml = "  body.querySelector('[data-json-trace-export-xml]')?.addEventListener('click', () => downloadText('xml_cii_xml_node_trace.json', JSON.stringify(state().xmlTraceRows || [], null, 2), 'application/json'));"
source = replace_once(
    source,
    export_xml,
    export_xml + "\n  body.querySelector('[data-json-trace-export-xml-csv]')?.addEventListener('click', () => downloadText('xml_cii_xml_node_trace.csv', xmlNodeWiseTraceToCsv(state().xmlTraceRows || []), 'text/csv'));\n  body.querySelector('[data-json-trace-copy-matched]')?.addEventListener('click', async () => { await copyText(matchedFactsToClipboardText(state().xmlTraceRows || [])); });",
    'XML trace export/copy listeners',
)
old_try = "    try { const rows = await services?.buildXmlNodeTrace?.(), next = state(); let xmlRows = xmlTraceRowsFromDiagnostics(rows || []); crossLinkJsonNodeNo(xmlRows, next.fullTrace || next.trace || []); xmlRows = enrichXmlTraceRows(xmlRows, next); next.xmlTraceRows = xmlRows; next.xmlTraceStatus = `Ready: ${next.xmlTraceRows.length} row(s)`; next.active = 'xml-node-trace'; save(next); }"
new_try = "    try {\n      const diagnosticRows = await services?.buildXmlNodeTrace?.();\n      const next = state();\n      const xmlTextValue = await currentXmlText(services);\n      next.xmlTraceRows = buildXmlNodeWiseTraceRows({\n        xmlText: xmlTextValue,\n        diagnostics: diagnosticRows || [],\n        traceRows: next.fullTrace || next.trace || [],\n        options: { coordinateToleranceMm: 6 },\n      });\n      next.xmlTraceStatus = `Ready: ${next.xmlTraceRows.length} row(s)`;\n      next.active = 'xml-node-trace';\n      save(next);\n    }"
source = replace_once(source, old_try, new_try, 'shared-ledger trace handler')
PATH.write_text(source)
print(f'patched {PATH}')
