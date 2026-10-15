import { webcrypto } from 'node:crypto';
import { createRevisionCompareJsonDocumentSnapshot } from '../tabs/revision-compare/revision-json-document.js';
import {
  captureRevisionCompareTransferAuthority,
  createRevisionCompareTransferSelection,
  createRevisionCompareTransferState,
} from '../tabs/revision-compare/revision-transfer-contracts.js';
import { REVISION_COMPARE_TRANSFER_POLICY_VERSION } from '../tabs/revision-compare/revision-transfer-policy.js';

export const cryptoRef = webcrypto;
export const hash = (value) => value.repeat(64);
export const sourceRecordId = 'record:A:doc:A:$.branches[0].children[0]';
export const targetRecordId = 'record:B:doc:B:$.branches[0].children[0]';
export const differenceId = `difference:${sourceRecordId}:${targetRecordId}`;

export async function snapshots(targetMode = 'VALUE') {
  const source = { id: 'S-1', type: 'PIPE', description: 'New', supportType: 'GUIDE' };
  const target = { id: 'T-1', type: 'PIPE' };
  if (targetMode === 'VALUE') target.description = 'Old';
  if (targetMode === 'NULL') target.description = null;
  const revA = await createRevisionCompareJsonDocumentSnapshot({
    side: 'REV_A', sourceDocumentId: 'doc:A', sourceContentSha256: hash('a'),
    fileName: 'a.json', profile: 'stage/v1',
    parsedValue: { schema: 'stage/v1', branches: [{ name: 'B-1', children: [source] }] },
  }, cryptoRef);
  const revB = await createRevisionCompareJsonDocumentSnapshot({
    side: 'REV_B', sourceDocumentId: 'doc:B', sourceContentSha256: hash('b'),
    fileName: 'b.json', profile: 'stage/v1',
    parsedValue: { schema: 'stage/v1', branches: [{ name: 'B-1', children: [target] }] },
  }, cryptoRef);
  return { revA, revB };
}
export function propertyFor({
  propertyKey = 'description', targetMode = 'VALUE', targetPath = '/description',
} = {}) {
  const sourcePath = propertyKey === 'supportType'
    ? '$.branches[0].children[0].supportType'
    : '$.branches[0].children[0].description';
  const targetEvidence = targetMode === 'VALUE'
    ? `$.branches[0].children[0]${targetPath.replaceAll('/', '.')}` : null;
  return Object.freeze({
    propertyKey,
    revAValue: propertyKey === 'supportType' ? 'GUIDE' : 'New',
    revBValue: targetMode === 'VALUE' ? 'Old' : null,
    revAEvidencePath: sourcePath, revBEvidencePath: targetEvidence,
    normalizationRule: 'trim-preserve-scalar',
  });
}
export function stateFor(revA, revB, property, overrides = {}) {
  const audit = Object.freeze({
    schema: 'RevisionCompareAudit.v1', auditId: 'audit:1', basisId: 'basis:1',
    revADocumentId: 'doc:A', revBDocumentId: 'doc:B', engineVersion: 'rc-engine:test',
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
    differenceRows: Object.freeze([Object.freeze({
      differenceId, differenceCategory: 'CHANGED', matchCertainty: 'EXACT',
      sourceRecordId, targetRecordId, changedProperties: Object.freeze([property]),
    })]),
  });
  const review = Object.freeze({
    schema: 'ReviewSession.v1', reviewSessionId: 'review:1', auditId: audit.auditId,
    basisId: audit.basisId, revADocumentId: 'doc:A', revBDocumentId: 'doc:B',
    status: 'CURRENT', revision: 1,
    items: Object.freeze([Object.freeze({ differenceId, reviewState: 'REVIEWED' })]),
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
  const decision = Object.freeze({
    schema: 'AmbiguityDecisionLedger.v1', ledgerId: 'decision:1', auditId: audit.auditId,
    basisId: audit.basisId, revADocumentId: 'doc:A', revBDocumentId: 'doc:B',
    status: 'CURRENT', revision: 0, decisions: Object.freeze([]),
    validation: Object.freeze({ status: 'READY', errors: Object.freeze([]) }),
  });
  const base = {
    schema: 'RevisionCompareWorkspaceState.v8',
    proposal: Object.freeze({ proposalId: 'proposal:1' }),
    basisStatus: 'CURRENT',
    basis: Object.freeze({
      basisId: 'basis:1', revADocumentId: 'doc:A', revBDocumentId: 'doc:B',
      revAContentHash: hash('a'), revBContentHash: hash('b'),
    }),
    slots: Object.freeze({
      baseline: Object.freeze({ status: 'SCOPED',
        document: Object.freeze({ documentId: 'doc:A', sourceHash: hash('a'), fileName: 'a.json' }), jsonSnapshot: revA }),
      candidate: Object.freeze({ status: 'SCOPED',
        document: Object.freeze({ documentId: 'doc:B', sourceHash: hash('b'), fileName: 'b.json' }), jsonSnapshot: revB }),
    }),
    compare: Object.freeze({ status: 'COMPLETE', audit, presentationMode: 'overlay' }),
    review: Object.freeze({ session: review }), decision: Object.freeze({ ledger: decision }),
    evidencePackageImport: Object.freeze({ status: 'IDLE', packageId: null, contentSha256: null }),
    ...overrides,
  };
  return Object.freeze({
    ...base,
    transfer: createRevisionCompareTransferState(
      REVISION_COMPARE_TRANSFER_POLICY_VERSION,
      captureRevisionCompareTransferAuthority(base),
    ),
  });
}
export function selectionFor(property, targetFieldPath = '/description', revision = 1) {
  return createRevisionCompareTransferSelection({
    selectionRevision: revision,
    items: [{
      differenceId, sourceRecordId, targetRecordId,
      fields: [{ propertyKey: property.propertyKey,
        revAEvidencePath: property.revAEvidencePath,
        revBEvidencePath: property.revBEvidencePath, targetFieldPath }],
    }],
  });
}
export function withReviewRevision(state, revision) {
  return Object.freeze({ ...state, review: Object.freeze({
    session: Object.freeze({ ...state.review.session, revision }),
  }) });
}
export function withDecisionRevision(state, revision) {
  return Object.freeze({ ...state, decision: Object.freeze({
    ledger: Object.freeze({ ...state.decision.ledger, revision }),
  }) });
}
