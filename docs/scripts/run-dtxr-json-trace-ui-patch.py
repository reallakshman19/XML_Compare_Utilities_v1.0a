from pathlib import Path
import runpy

panel = Path('tabs/model-converters/json-trace/json-trace-panel.js')
source = panel.read_text()
markers = [
    'buildXmlNodeWiseTraceRows',
    'data-json-trace-export-tree-csv',
    'data-json-trace-export-xml-csv',
    'data-json-trace-copy-matched',
    'function dashboardMatchedFacts',
]
if all(marker in source for marker in markers):
    print(f'already patched {panel}')
else:
    runpy.run_path('scripts/apply-dtxr-json-trace-ui.py', run_name='__main__')
