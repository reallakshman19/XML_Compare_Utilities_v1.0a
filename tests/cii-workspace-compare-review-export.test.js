import assert from 'assert';
import { correspondenceRowsToCsv } from '../tabs/cii-workspace/cii-workspace-export.js';

const row = {
  correspondenceId: 'element:S:T', kind: 'ELEMENT', sourceElementId: 'S', targetElementIds: ['T'], status: 'REVIEW', authority: 'ANCHOR_PROPAGATED_M1_M2',
};
const correspondence = { nodeRows: [], elementRows: [row], componentRows: [] };
const compareReview = { rows: [{ correspondenceId: row.correspondenceId, confidence: 'MEDIUM', changeCount: 2, changeFamilies: ['GEOMETRY', 'RESTRAINT'] }] };
const csv = correspondenceRowsToCsv(correspondence, { compareReview, review: {}, transferPlan: { operations: [] } });
const lines = csv.split('\n');
assert(lines[0].includes('confidence'));
assert(lines[0].includes('workflowStatus'));
assert(lines[0].includes('engineeringChangeCount'));
assert(lines[0].includes('engineeringChangeFamilies'));
assert(lines[1].includes('"MEDIUM"'), 'engineering confidence must be exported independently');
assert(lines[1].includes('"REVIEW"'), 'workflow review state must remain separately visible');
assert(lines[1].includes('"2"'));
assert(lines[1].includes('"GEOMETRY|RESTRAINT"'));
console.log('CII Compare Review CSV projection checks passed.');
