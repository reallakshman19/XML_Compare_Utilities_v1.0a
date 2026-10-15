import assert from 'node:assert/strict';
import { createPipelineRenderedSurfaceSession } from '../tabs/pipeline-3d-model/pipeline-3d-model-rendered-surface-session.js';
function node(values = {}) {
  const attributes = { ...(values.attributes || {}) };
  return { value: '', innerHTML: '', textContent: '', title: '', id: '', disabled: false,
    dataset: {}, ...values,
    getAttribute(name) { return Object.hasOwn(attributes, name) ? attributes[name] : null; },
    setAttribute(name, value) { attributes[name] = String(value); },
    querySelector: values.querySelector || (() => null) };
}
const table2 = node({ value: 'T2' }), table3 = node({ value: 'T3' });
const table2Grid = node({ innerHTML: '<table>2</table>' });
const table3Grid = node({ innerHTML: '<table>3</table>' });
const table2Reference = node({ innerHTML: '<svg>2</svg>' });
const table3Reference = node({ innerHTML: '<svg>3</svg>' });
const table2Holder = node({ querySelector: () => table2Reference });
const table3Holder = node({ querySelector: () => table3Reference });
const download = node({ disabled: true, title: 'blocked',
  dataset: { inputXmlState: 'BLOCKED', approvedCatalogState: 'BLOCKED' },
  attributes: { 'aria-disabled': 'true', 'aria-describedby': 'status' } });
const warningPanel = node({ open: false });
const elements = new Map([
  ['[data-p3d="table2"]', table2], ['[data-p3d="table3"]', table3],
  ['[data-p3d="table2x-output"]', table2Grid], ['[data-p3d="table3x-output"]', table3Grid],
  ['[data-p3d-split="table2x-preview"]', table2Holder], ['[data-p3d-split="table3x-preview"]', table3Holder],
  ['[data-p3d="table1-output"]', node({ textContent: 'T1' })],
  ['[data-p3d="coordinate-output"]', node({ textContent: 'C' })],
  ['[data-p3d="xml-output"]', node({ textContent: 'X' })],
  ['[data-p3d-core-artifacts]', node({ innerHTML: '<section>A</section>' })],
  ['[data-p3d-approved-catalog-status]', node({ textContent: 'catalog', id: 'catalog',
    title: 'c', dataset: { state: 'BLOCKED' } })],
  ['[data-p3d-inputxml-status]', node({ textContent: 'xml', id: 'xml',
    title: 'x', dataset: { state: 'BLOCKED' } })],
  ['[data-p3d="download-xml"]', download],
  ['[data-p3d-warning-count]', node({ textContent: '1' })],
  ['[data-p3d-warning-body]', node({ innerHTML: '<div>warning</div>' })],
  ['[data-p3d-warning-log]', warningPanel],
]);
const dialog = { querySelector(selector) { return elements.get(selector) || null; } };
const output = Object.freeze({ id: 'O1' });
const session = createPipelineRenderedSurfaceSession();
assert.equal(session.matches(dialog, output), false);
assert.equal(session.capture(dialog, output), true);
assert.equal(session.matches(dialog, output), true);
warningPanel.open = true;
assert.equal(session.matches(dialog, output), true);
table2Grid.innerHTML = '<table>changed</table>';
assert.equal(session.matches(dialog, output), false);
table2Grid.innerHTML = '<table>2</table>';
assert.equal(session.matches(dialog, output), true);
table2Reference.innerHTML = '<svg>changed</svg>';
assert.equal(session.matches(dialog, output), false);
table2Reference.innerHTML = '<svg>2</svg>';
download.disabled = false;
assert.equal(session.matches(dialog, output), false);
download.disabled = true;
assert.equal(session.matches(dialog, output), true);
elements.set('[data-p3d="table3x-output"]', node({ innerHTML: '<table>3</table>' }));
assert.equal(session.matches(dialog, output), false);
elements.set('[data-p3d="table3x-output"]', table3Grid);
assert.equal(session.matches(dialog, Object.freeze({ id: 'O1' })), false);
session.reset();
assert.equal(session.matches(dialog, output), false);
console.log('rendered surface session: PASS');
