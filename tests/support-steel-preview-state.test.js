import assert from 'node:assert/strict';
import {
  markSupportSteelPreviewFresh,
  SUPPORT_STEEL_STALE_PREVIEW_MESSAGE,
  supportSteelBuildInputSnapshot,
  supportSteelPreviewExportReady,
  syncSupportSteelPreviewFreshness,
} from '../tabs/support-steel-relationship-builder/support-steel-preview-state.js';

const baseRules = Object.freeze({
  projectionToleranceMm: 25,
  requireAnalyticalGeometryForSpatialResolution: true,
});
const source = '[{"type":"BRANCH"}]';
const builtSnapshot = supportSteelBuildInputSnapshot(source, baseRules);
const state = { bundle: { schema: 'SupportSteelRelationshipBundle.v1' }, buildInputSnapshot: '', previewStale: false };

markSupportSteelPreviewFresh(state, builtSnapshot);
assert.equal(supportSteelPreviewExportReady(state), true);
assert.equal(syncSupportSteelPreviewFreshness(state, builtSnapshot), false);
assert.equal(state.previewStale, false);

const changedRuleSnapshot = supportSteelBuildInputSnapshot(source, { ...baseRules, projectionToleranceMm: 30 });
assert.equal(syncSupportSteelPreviewFreshness(state, changedRuleSnapshot), true);
assert.equal(state.previewStale, true);
assert.equal(supportSteelPreviewExportReady(state), false);
assert.equal(SUPPORT_STEEL_STALE_PREVIEW_MESSAGE, 'Inputs changed. Rebuild relationships to refresh exports.');

assert.equal(syncSupportSteelPreviewFreshness(state, builtSnapshot), true);
assert.equal(state.previewStale, false, 'restoring exact build inputs should restore export readiness');
assert.equal(supportSteelPreviewExportReady(state), true);

const changedSourceSnapshot = supportSteelBuildInputSnapshot(`${source} `, baseRules);
assert.equal(syncSupportSteelPreviewFreshness(state, changedSourceSnapshot), true);
assert.equal(state.previewStale, true);

assert.equal(syncSupportSteelPreviewFreshness({ bundle: null }, changedSourceSnapshot), false);
console.log('support-steel stale preview state tests passed');
