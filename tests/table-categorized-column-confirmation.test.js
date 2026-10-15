import assert from 'node:assert/strict';

import {
  createTableCategorizedStepStatus,
  renderTableCategorizedXmlShellHtml,
} from '../xml-compare/table-categorizer/table-categorized-xml-shell.js';

// Verifies Step 2 confirmation state. Input is a parsed table state; output is
// static shell HTML plus workflow status used by the browser runtime.

const parsedRows = [{ rowId: 'R1', rawCells: ['PS-XYZ-1'], values: { 'PS NO': 'PS-XYZ-1' } }];
const parsedSource = { sourceId: 'S1', headers: ['PS NO'], rows: parsedRows };
const unconfirmedState = { activeTab: 'levels', activeSourceId: 'S1', sources: [parsedSource] };
const confirmedState = { ...unconfirmedState, columnsConfirmed: true };

const unconfirmedStatus = createTableCategorizedStepStatus(unconfirmedState);
assert.equal(unconfirmedStatus.columns, 'ready');
assert.equal(unconfirmedStatus.structure, 'locked');

const confirmedStatus = createTableCategorizedStepStatus(confirmedState);
assert.equal(confirmedStatus.columns, 'complete');
assert.equal(confirmedStatus.structure, 'ready');

const confirmedHtml = renderTableCategorizedXmlShellHtml(confirmedState);
assert.match(confirmedHtml, /Fields confirmed/);
assert.doesNotMatch(confirmedHtml, /Confirm fields/);

const warningHtml = renderTableCategorizedXmlShellHtml({
  ...confirmedState,
  profileValidation: [{ severity: 'ERROR', message: 'Missing field' }],
});
assert.match(warningHtml, /Review field issues/);

console.log('Table categorized column confirmation tests passed');
