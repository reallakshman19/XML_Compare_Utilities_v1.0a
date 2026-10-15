import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const tab = await readFile(new URL('../tabs/cii-workspace/cii-workspace-tab.js', import.meta.url), 'utf8');
const filters = await readFile(new URL('../tabs/cii-workspace/cii-workspace-multisource-review-only-filter-shell.js', import.meta.url), 'utf8');
const router = await readFile(new URL('../tabs/cii-workspace/cii-workspace-multisource-review-only-router.js', import.meta.url), 'utf8');
const wrapper = await readFile(new URL('../tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js', import.meta.url), 'utf8');
const sourceSet = await readFile(new URL('../tabs/cii-workspace/cii-workspace-source-set.js', import.meta.url), 'utf8');

assert(tab.includes("import { mountCiiWriter2MultiSourceReviewRouter } from './cii-workspace-multisource-review-only-filter-shell.js?v=20260909-ms-review-filters-1';"));
assert(tab.includes("import { mountCiiWriter2MultiSourceNextStepShell } from './cii-workspace-multisource-next-step-shell.js?v=20260909-ms-custody-auto-1';"));
assert(tab.includes("writerVersion === '2'"));
assert(tab.includes('mountCiiWriter2MultiSourceReviewRouter'));
assert(tab.includes('mountCiiWriter2MultiSourceNextStepShell'));
assert(tab.includes('mountCiiWorkspaceScopedEngineeringShell'), 'legacy/single-source shell route must remain present');

assert(filters.includes("mountReviewRouter"), 'filter shell must wrap, not replace, the generic custody router');
assert(filters.includes("[data-ciiw-ms-review-only-transfer=\"1\"]"), 'filters must activate only inside generic REVIEW_ONLY');
assert(filters.includes('[data-ciiw-confidence-filter]'));
assert(filters.includes('[data-ciiw-search]'));
assert(filters.includes('[data-ciiw-changed-only]'));
assert(!filters.includes('applyCiiWorkspaceTargetWriter2'), 'filter shell must not import Writer2 apply');

assert(router.includes('mountCiiWriter2MultiSourceShell'), 'router must delegate exact retained custody to the existing Writer2 shell');
assert(router.includes('createCiiMultiSourceReviewOnlyPreviewWithVersionBridge'));
assert(router.includes('ciiMultiSourceReviewBySource'));
assert(router.includes('Bind review decisions'));
assert(router.includes('CII_MS_REVIEW_ONLY_WRITE_AUTHORITY_REQUIRED'));
assert(router.includes("target.matches('[data-ciiw-ms-bind-expected],[data-ciiw-ms-apply]')"));
assert(router.includes('Writer2 operations 0'));
assert(!router.includes('applyCiiWorkspaceTargetWriter2'), 'generic router must never import Writer2 apply');

assert(wrapper.includes('sourceInput.multiple = true'));
assert(wrapper.includes("analyzeButton.addEventListener('click', analyzeMultiSource, true)"));
assert(wrapper.includes("analyzeButton.addEventListener('click', blockLegacyAnalyze, true)"));
assert(wrapper.includes("inspectButton.addEventListener('click', inspectMultiSource, true)"));
assert(wrapper.includes('inspectCiiWorkspaceSourceSetWithVersionBridge'));
assert(wrapper.includes('S1.CII') === false, 'retained source identities must still come from selected bytes, not hard-coded fixture names');
assert(wrapper.includes('Writer 2 multi-source custody'));
assert(wrapper.includes('TARGET original SHA'));

assert(sourceSet.includes("await import('./cii-workspace-writer-version-bridge.js')"));
assert(sourceSet.includes('inspectCiiWorkspaceModelsWithVersionBridge'));
assert(sourceSet.includes('MULTISOURCE_CORRESPONDENCE_REQUIRES_WP_002'));
assert(sourceSet.includes("normalizationStatus: 'NOT_RUN'"));
assert(sourceSet.includes("normalizationStatus: 'PASS_BRIDGE_EVIDENCE'"));
assert(!sourceSet.includes('createCiiWorkspacePreviewWithVersionBridge'));
assert(!sourceSet.includes('applyCiiWorkspaceTargetWriter2WithVersionBridge'));

console.log('CII Writer2 retained/write + generic REVIEW_ONLY routing/filter contract: PASS');
