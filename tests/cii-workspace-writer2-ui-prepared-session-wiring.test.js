import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const source = await readFile(
  new URL('../tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js', import.meta.url),
  'utf8',
);

assert(source.includes("prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge"));
assert(source.includes("createCiiCommonAnalysisCache"));
assert(source.includes("createCiiWriter2SourceSetPreviewFromPreparedSession"));
assert(!source.includes("inspectCiiWorkspaceSourceSetWithVersionBridge"));
assert(!source.includes("createCiiWriter2SourceSetPreviewWithVersionBridge"));

const inspectStart = source.indexOf('const inspectMultiSource = async');
const previewInputStart = source.indexOf('const previewInput =', inspectStart);
const analyzeStart = source.indexOf('const analyzeMultiSource = async', previewInputStart);
const reviewStart = source.indexOf('const applyMultiSourceReview = async', analyzeStart);
const transferStart = source.indexOf('const bindExpectedScope = async', reviewStart);
assert(inspectStart >= 0 && previewInputStart > inspectStart && analyzeStart > previewInputStart && reviewStart > analyzeStart);

const inspectBody = source.slice(inspectStart, previewInputStart);
const previewInputBody = source.slice(previewInputStart, analyzeStart);
const analyzeBody = source.slice(analyzeStart, reviewStart);
const reviewBody = source.slice(reviewStart, transferStart);

assert(inspectBody.includes('prepareAndInspectCiiWorkspaceSourceSetWithVersionBridge'));
assert(inspectBody.includes('inspection = prepared.inspection'));
assert(inspectBody.includes('preparedSession = prepared.preparedSession'));
assert(inspectBody.includes('commonAnalysisCache = createCiiCommonAnalysisCache()'));

assert(!previewInputBody.includes('sources: cachedSources'));
assert(!previewInputBody.includes('targetBytes: cachedTargetBytes'));
assert(!previewInputBody.includes('targetFileName: cachedTargetName'));
assert(previewInputBody.includes('baseLoopsBySource'));
assert(previewInputBody.includes('anchorPairsBySource'));

for (const body of [analyzeBody, reviewBody]) {
  assert(body.includes('createCiiWriter2SourceSetPreviewFromPreparedSession(preparedSession'));
  assert(body.includes('commonAnalysisCache'));
}
assert(analyzeBody.includes("if (!inspection || !preparedSession || !commonAnalysisCache)"));

const resetStart = source.indexOf('const resetMulti = () =>');
const bindAnchorStart = source.indexOf('function bindAnchorActions()', resetStart);
const resetBody = source.slice(resetStart, bindAnchorStart);
assert(resetBody.includes('preparedSession = null'));
assert(resetBody.includes('commonAnalysisCache = null'));

const anchorBody = source.slice(bindAnchorStart, inspectStart);
assert(!anchorBody.includes('commonAnalysisCache = null'),
  'anchor/manual authority changes must rely on authority-keyed per-member cache invalidation');

const reviewDecisionStart = source.indexOf('const onMultiReviewDecision =');
const exportStart = source.indexOf('const onCsvExport =', reviewDecisionStart);
const reviewDecisionBody = source.slice(reviewDecisionStart, exportStart);
assert(!reviewDecisionBody.includes('commonAnalysisCache = null'),
  'review-only changes must retain common analysis cache');

const destroyStart = source.indexOf('destroy() {');
const destroyBody = source.slice(destroyStart);
assert(destroyBody.includes('preparedSession = null'));
assert(destroyBody.includes('commonAnalysisCache = null'));
assert(destroyBody.includes('cachedTargetBytes = null'));

assert(!source.includes('AbortController'));
assert(!source.includes('AbortSignal'));
assert(!source.includes('operationGeneration'));
assert(!source.includes('inFlightPromise'));

console.log('CII Writer2 UI prepared-session/cache wiring checks: PASS');
