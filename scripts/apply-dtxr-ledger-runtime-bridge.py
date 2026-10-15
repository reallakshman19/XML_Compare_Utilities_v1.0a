from pathlib import Path

PATH = Path('tabs/model-converters/converters/xmltocii2019_helper/enrichment-core.js')
source = PATH.read_text()
marker = "  if (Array.isArray(options._diagOut)) options._diagOut.push(...diagnostics);\n  return { xmlText: xmlOut, stats, config, diagnostics, diagnosticRows: diagnosticRowsForTable(diagnostics), diagnosticText, dtxrResolutionLedger: dtxrResolutionLedgerAudit };"
replacement = "  if (Array.isArray(options._diagOut)) options._diagOut.push(...diagnostics);\n  if (typeof globalThis !== 'undefined') {\n    globalThis.xmlCiiDtxrResolutionLedger = Object.freeze({\n      getSnapshot: () => dtxrResolutionLedgerAudit,\n    });\n  }\n  return { xmlText: xmlOut, stats, config, diagnostics, diagnosticRows: diagnosticRowsForTable(diagnostics), diagnosticText, dtxrResolutionLedger: dtxrResolutionLedgerAudit };"
if 'globalThis.xmlCiiDtxrResolutionLedger' in source:
    print(f'already patched {PATH}')
elif source.count(marker) != 1:
    raise SystemExit(f'runtime ledger bridge marker count={source.count(marker)}')
else:
    PATH.write_text(source.replace(marker, replacement, 1))
    print(f'patched {PATH}')
