import assert from 'node:assert/strict';
import test from 'node:test';

import { statusMessage } from '../tabs/cii-workspace/cii-workspace-find-replace-editor-view.js';

const diagnostics = Object.freeze({ hasErrors: false, counts: Object.freeze({ error: 0, info: 0 }) });
const session = (status = 'PREVIEW_READY', rows = [{ status: 'PROPOSED' }]) => ({ status, rows, errors: [], qualification: null });
const summary = (patch = {}) => ({
  total: 3,
  proposed: 0,
  approved: 0,
  rejected: 3,
  blocked: 0,
  targetLoaded: true,
  canValidate: false,
  qualified: false,
  appliedToNewCopy: false,
  ...patch,
});

test('all-rejected workflow state is explicit and actionable', () => {
  const message = statusMessage(session('PREVIEW_READY', [{}, {}, {}]), summary(), diagnostics);
  assert.equal(message, 'All 3 replacement row(s) are rejected. Reset decisions or approve at least one row before validation.');
  assert.doesNotMatch(message, /No approved replacement rows/);
});

test('pending review workflow state reports approved rejected and proposed counts', () => {
  const message = statusMessage(session(), summary({ proposed: 2, approved: 1, rejected: 0 }), diagnostics);
  assert.match(message, /1 approved, 0 rejected, 2 awaiting review/);
  assert.match(message, /Approve or reject every pending row/);
});

test('review-complete workflow state reports counts and directs validation', () => {
  const message = statusMessage(session(), summary({ total: 4, approved: 3, rejected: 1, canValidate: true }), diagnostics);
  assert.equal(message, 'Review complete — 3 approved, 1 rejected. Validate & Preview to build a qualified in-memory TARGET1.');
});
