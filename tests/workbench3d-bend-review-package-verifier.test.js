import assert from 'node:assert/strict';
import { buildBendReviewPackageManifest, serializeBendReviewPackageManifest } from '../workbench3d/ui/bend-review-package.js';
import {
  BEND_REVIEW_VERIFICATION_STATUS,
  bendReviewVerifierControlsHtml,
  bendReviewVerifierHtml,
  parseBendReviewPackageText,
  receiptVerificationResultHtml,
  verificationResultHtml,
  verifyBendReviewPackage,
} from '../workbench3d/ui/bend-review-package-verifier.js';
import {
  BEND_REVIEW_RECEIPT_STATUS,
  BEND_REVIEW_VERIFICATION_RECEIPT_CONTRACT,
  buildBendReviewVerificationReceipt,
  computeBendReviewVerificationReceiptSignature,
  parseBendReviewVerificationReceiptText,
  serializeBendReviewVerificationReceipt,
  verifyBendReviewVerificationReceipt,
} from '../workbench3d/ui/bend-review-verification-receipt.js';
import {
  BEND_REVIEW_HISTORY_FILTER,
  BEND_REVIEW_HISTORY_KIND,
  BEND_REVIEW_HISTORY_KIND_FILTER,
  BEND_REVIEW_HISTORY_LIMIT,
  BEND_REVIEW_HISTORY_SEARCH_LIMIT,
  BEND_REVIEW_HISTORY_STATUS_FILTER,
  bendReviewHistoryCount,
  bendReviewHistoryHtml,
  bendReviewHistorySummaryHtml,
  clearBendReviewHistory,
  filterBendReviewHistory,
  filterBendReviewHistoryByKind,
  filterBendReviewHistoryByStatus,
  filterBendReviewHistoryByText,
  getBendReviewHistory,
  recordBendReviewHistory,
  summarizeBendReviewHistory,
} from '../workbench3d/ui/bend-review-verification-history.js';

const bendAudit = (signature) => ({
  contract: 'BendGeometryAudit.v1', signatureAlgorithm: 'stable-json-fnv1a32', signature,
  payload: { summaryConsistent: true, declaredSummary: { requested: 1, resolved: 1, blocked: 0, arcSegments: 12 } },
});
const visual = (signature) => ({ bendSummary: { requested: 1, resolved: 1, blocked: 0, arcSegments: 12 }, geometryDiagnostics: [], bendAudit: bendAudit(signature) });
const state = {
  sourceName: 'source.xml', targetName: 'target.xml', sourceXml: '<A/>', targetXml: '<B/>',
  graphs: { sourceSchema: 'INPUT_XML', targetSchema: 'INPUT_XML' }, config: { lengthToleranceMm: 6 },
  audit: { contract: 'CompareAudit.v1', compareKind: 'topology-edge', sourceObjectIds: ['source:E1'], targetObjectIds: ['target:E1'], objectDiff: { rows: [] }, conflictLedger: { rows: [] } },
  visuals: { A: visual('wb3d-bend-11111111'), B: visual('wb3d-bend-22222222') },
};
const imported = buildBendReviewPackageManifest(state);
const current = buildBendReviewPackageManifest(state);
const matching = verifyBendReviewPackage(imported, current);
assert.strictEqual(matching.status, BEND_REVIEW_VERIFICATION_STATUS.MATCH);
assert.strictEqual(verifyBendReviewPackage(imported, buildBendReviewPackageManifest({ ...state, sourceXml: '<A changed="1"/>' })).status, BEND_REVIEW_VERIFICATION_STATUS.STALE_INPUT);
assert.strictEqual(verifyBendReviewPackage(imported, buildBendReviewPackageManifest({ ...state, config: { lengthToleranceMm: 7 } })).status, BEND_REVIEW_VERIFICATION_STATUS.STALE_COMPARE);
assert.strictEqual(verifyBendReviewPackage(imported, buildBendReviewPackageManifest({ ...state, visuals: { ...state.visuals, B: visual('wb3d-bend-33333333') } })).status, BEND_REVIEW_VERIFICATION_STATUS.STALE_BEND_EVIDENCE);
assert.strictEqual(verifyBendReviewPackage({ ...imported, packageSignature: 'wb3d-review-00000000' }, imported).status, BEND_REVIEW_VERIFICATION_STATUS.INVALID_PACKAGE);
const parsed = parseBendReviewPackageText(serializeBendReviewPackageManifest(imported));
assert.strictEqual(parsed.ok, true);
assert.strictEqual(parsed.manifest.packageSignature, imported.packageSignature);
assert.strictEqual(parseBendReviewPackageText('{bad').ok, false);

const receipt = buildBendReviewVerificationReceipt({ importedManifest: imported, currentManifest: current, verification: matching });
assert.strictEqual(receipt.contract, BEND_REVIEW_VERIFICATION_RECEIPT_CONTRACT);
assert.match(receipt.receiptSignature, /^wb3d-verify-[0-9a-f]{8}$/);
assert.strictEqual(receipt.payload.importedPackage.packageSignature, imported.packageSignature);
assert.strictEqual(receipt.payload.currentPackage.packageSignature, current.packageSignature);
assert.strictEqual(receipt.payload.verification.status, 'MATCH');
assert.strictEqual(receipt.payload.verification.differenceCount, 0);
assert.strictEqual(serializeBendReviewVerificationReceipt(receipt), serializeBendReviewVerificationReceipt(receipt));
assert.doesNotMatch(serializeBendReviewVerificationReceipt(receipt), /<A\/>|sourceXml|targetXml|"inputs"/);
assert.match(verificationResultHtml(matching, receipt), /Export verification receipt/);
assert.match(verificationResultHtml(matching, receipt), new RegExp(receipt.receiptSignature));

const receiptParsed = parseBendReviewVerificationReceiptText(serializeBendReviewVerificationReceipt(receipt));
assert.strictEqual(receiptParsed.ok, true);
assert.strictEqual(verifyBendReviewVerificationReceipt(receipt, current).status, BEND_REVIEW_RECEIPT_STATUS.MATCH);
const changedCurrent = buildBendReviewPackageManifest({ ...state, config: { lengthToleranceMm: 8 } });
const staleCurrent = verifyBendReviewVerificationReceipt(receipt, changedCurrent);
assert.strictEqual(staleCurrent.status, BEND_REVIEW_RECEIPT_STATUS.STALE_CURRENT_PACKAGE);
assert.deepStrictEqual(staleCurrent.differences.map((row) => row.field), ['Current package signature']);
assert.strictEqual(verifyBendReviewVerificationReceipt({ ...receipt, receiptSignature: 'wb3d-verify-00000000' }, current).status,
  BEND_REVIEW_RECEIPT_STATUS.INVALID_RECEIPT);
const missingReferencePayload = { ...receipt.payload, currentPackage: null };
const missingReference = { ...receipt, payload: missingReferencePayload, receiptSignature: computeBendReviewVerificationReceiptSignature(missingReferencePayload) };
assert.strictEqual(verifyBendReviewVerificationReceipt(missingReference, current).status, BEND_REVIEW_RECEIPT_STATUS.INVALID_RECEIPT);
assert.strictEqual(parseBendReviewVerificationReceiptText('{bad').ok, false);
assert.match(receiptVerificationResultHtml(staleCurrent), /STALE CURRENT PACKAGE/);
assert.match(receiptVerificationResultHtml(staleCurrent), /Current package signature/);

clearBendReviewHistory();
recordBendReviewHistory({
  checkKind: BEND_REVIEW_HISTORY_KIND.PACKAGE, verification: matching,
  artifactSignature: imported.packageSignature, currentManifest: current,
});
recordBendReviewHistory({
  checkKind: BEND_REVIEW_HISTORY_KIND.RECEIPT, verification: staleCurrent,
  artifactSignature: receipt.receiptSignature, currentManifest: changedCurrent,
});
const history = getBendReviewHistory();
assert.strictEqual(history.length, 2);
assert.strictEqual(history[0].kind, BEND_REVIEW_HISTORY_KIND.RECEIPT);
assert.strictEqual(history[0].differenceCount, 1);
assert.strictEqual(history[1].artifactSignature, imported.packageSignature);
assert.strictEqual(bendReviewHistoryCount(history), '2 checks');
assert.match(bendReviewHistoryHtml(history), /STALE CURRENT PACKAGE/);
assert.match(bendReviewHistoryHtml(history), new RegExp(receipt.receiptSignature));
assert.doesNotMatch(bendReviewHistoryHtml(history), /sourceXml|targetXml|<A\/>/);
assert.deepStrictEqual(summarizeBendReviewHistory(history),
  { total: 2, match: 1, stale: 1, invalid: 0, other: 0 });
assert.match(bendReviewHistorySummaryHtml(history), /Match 1/);
assert.match(bendReviewHistorySummaryHtml(history), /Stale 1/);
assert.match(bendReviewHistorySummaryHtml(history), /Invalid 0/);

const currentOnly = filterBendReviewHistory(
  history, BEND_REVIEW_HISTORY_FILTER.CURRENT_PACKAGE, current.packageSignature,
);
assert.strictEqual(currentOnly.length, 1);
assert.strictEqual(currentOnly[0].kind, BEND_REVIEW_HISTORY_KIND.PACKAGE);
assert.strictEqual(getBendReviewHistory().length, 2);
assert.strictEqual(bendReviewHistoryCount(currentOnly, history), '1 of 2 checks');
assert.deepStrictEqual(summarizeBendReviewHistory(currentOnly),
  { total: 1, match: 1, stale: 0, invalid: 0, other: 0 });
const changedOnly = filterBendReviewHistory(
  history, BEND_REVIEW_HISTORY_FILTER.CURRENT_PACKAGE, changedCurrent.packageSignature,
);
assert.strictEqual(changedOnly.length, 1);
assert.strictEqual(changedOnly[0].kind, BEND_REVIEW_HISTORY_KIND.RECEIPT);
assert.strictEqual(filterBendReviewHistory(history, 'UNKNOWN', current.packageSignature).length, 2);
assert.strictEqual(filterBendReviewHistory(
  history, BEND_REVIEW_HISTORY_FILTER.CURRENT_PACKAGE, 'wb3d-review-missing',
).length, 0);
assert.match(bendReviewHistoryHtml([], 'No checks match <current>.'), /&lt;current&gt;/);

const attentionOnly = filterBendReviewHistoryByStatus(
  history, BEND_REVIEW_HISTORY_STATUS_FILTER.NEEDS_ATTENTION,
);
assert.strictEqual(attentionOnly.length, 1);
assert.strictEqual(attentionOnly[0].status, BEND_REVIEW_RECEIPT_STATUS.STALE_CURRENT_PACKAGE);
assert.strictEqual(filterBendReviewHistoryByStatus(
  currentOnly, BEND_REVIEW_HISTORY_STATUS_FILTER.NEEDS_ATTENTION,
).length, 0);
assert.strictEqual(filterBendReviewHistoryByStatus(
  changedOnly, BEND_REVIEW_HISTORY_STATUS_FILTER.NEEDS_ATTENTION,
).length, 1);
assert.strictEqual(filterBendReviewHistoryByStatus(history, 'UNKNOWN').length, 2);
assert.strictEqual(filterBendReviewHistoryByStatus([
  { status: 'MATCH' }, { status: 'INVALID_RECEIPT' }, { status: 'UNAVAILABLE' },
], BEND_REVIEW_HISTORY_STATUS_FILTER.NEEDS_ATTENTION).length, 2);

const packageOnly = filterBendReviewHistoryByKind(history, BEND_REVIEW_HISTORY_KIND_FILTER.PACKAGE);
const receiptOnly = filterBendReviewHistoryByKind(history, BEND_REVIEW_HISTORY_KIND_FILTER.RECEIPT);
assert.deepStrictEqual(packageOnly.map((entry) => entry.kind), [BEND_REVIEW_HISTORY_KIND.PACKAGE]);
assert.deepStrictEqual(receiptOnly.map((entry) => entry.kind), [BEND_REVIEW_HISTORY_KIND.RECEIPT]);
assert.strictEqual(filterBendReviewHistoryByKind(attentionOnly, BEND_REVIEW_HISTORY_KIND_FILTER.PACKAGE).length, 0);
assert.strictEqual(filterBendReviewHistoryByKind(attentionOnly, BEND_REVIEW_HISTORY_KIND_FILTER.RECEIPT).length, 1);
assert.strictEqual(filterBendReviewHistoryByKind(history, 'UNKNOWN').length, 2);
assert.strictEqual(filterBendReviewHistoryByKind([{ kind: 'UNKNOWN' }], BEND_REVIEW_HISTORY_KIND_FILTER.PACKAGE).length, 0);
assert.strictEqual(filterBendReviewHistoryByText(history, '').length, 2);
assert.deepStrictEqual(filterBendReviewHistoryByText(history, 'stale current').map((entry) => entry.kind),
  [BEND_REVIEW_HISTORY_KIND.RECEIPT]);
assert.strictEqual(filterBendReviewHistoryByText(history, 'CURRENT_PACKAGE_CHANGED').length, 1);
assert.strictEqual(filterBendReviewHistoryByText(history, receipt.receiptSignature.slice(-6)).length, 1);
assert.strictEqual(filterBendReviewHistoryByText(history, current.packageSignature.toUpperCase()).length, 1);
assert.strictEqual(filterBendReviewHistoryByText(packageOnly, 'receipt').length, 0);
assert.strictEqual(filterBendReviewHistoryByText(receiptOnly, 'receipt').length, 1);
assert.strictEqual(filterBendReviewHistoryByText(history, 'missing value').length, 0);
assert.strictEqual(filterBendReviewHistoryByText(history,
  `${'x'.repeat(BEND_REVIEW_HISTORY_SEARCH_LIMIT)}stale`).length, 0);
assert.strictEqual(getBendReviewHistory().length, 2);

const categorized = summarizeBendReviewHistory([...history,
  { status: 'INVALID_RECEIPT' }, { status: 'UNAVAILABLE' }]);
assert.deepStrictEqual(categorized, { total: 4, match: 1, stale: 1, invalid: 1, other: 1 });
assert.match(bendReviewHistorySummaryHtml([...history, { status: 'UNAVAILABLE' }]), /Other 1/);
assert.match(bendReviewHistoryHtml([], 'No checks.'), /data-verification-history-summary/);

for (let index = 0; index < BEND_REVIEW_HISTORY_LIMIT + 2; index += 1) {
  recordBendReviewHistory({ checkKind: BEND_REVIEW_HISTORY_KIND.PACKAGE, verification: matching,
    artifactSignature: `wb3d-review-${String(index).padStart(8, '0')}`, currentManifest: current });
}
assert.strictEqual(getBendReviewHistory().length, BEND_REVIEW_HISTORY_LIMIT);
assert.strictEqual(getBendReviewHistory()[0].sequence, BEND_REVIEW_HISTORY_LIMIT + 4);
clearBendReviewHistory();
assert.strictEqual(getBendReviewHistory().length, 0);
assert.match(bendReviewHistoryHtml(), /No package or receipt checks/);

const html = bendReviewVerifierHtml(imported);
assert.match(html, /wb3d-bend-review-verifier/);
assert.match(html, /data-current=/);
const controls = bendReviewVerifierControlsHtml();
assert.match(controls, /Session verification history/);
assert.match(controls, /Page-memory only/);
assert.match(controls, /data-history-clear/);
assert.match(controls, /data-history-filter/);
assert.match(controls, /Current package only/);
assert.match(controls, /data-history-status-filter/);
assert.match(controls, /Needs attention only/);
assert.match(controls, /data-history-kind-filter/);
assert.match(controls, /Package checks only/);
assert.match(controls, /Receipt checks only/);
assert.match(controls, /data-history-search/);
assert.match(controls, new RegExp(`maxlength="${BEND_REVIEW_HISTORY_SEARCH_LIMIT}"`));
assert.match(controls, /Status, code, kind, or signature/);
console.log('workbench3d-bend-review-package-verifier.test.js passed');
