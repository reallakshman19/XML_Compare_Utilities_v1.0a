import { deepFreeze } from '../tabs/revision-compare/revision-contract-utils.js';
import { createRevisionCompareTransferReviewState } from '../tabs/revision-compare/revision-transfer-review-state.js';

const documentHash = (character) => character.repeat(64);
const entityHash = (index, side) => `${side === 'A' ? 'a' : 'b'}${index.toString(16).padStart(63, '0')}`.slice(-64);
function path(index) { return `/branches/0/children/${index}`; }
function evidence(index, field) { return `$.branches[0].children[${index}].${field}`; }
function entity(index, side, documentId) {
  return deepFreeze({
    entityId: `record:${side}:${documentId}:$.branches[0].children[${index}]`,
    canonicalPath: path(index), projectionPath: `$.branches[0].children[${index}]`,
    parentEntityId: 'branch:/SCALE', entityKind: 'COMPONENT', identity: { kind: 'ID', value: `PIPE-${index}` },
    entitySha256: entityHash(index, side),
  });
}
function changedProperties(index, blocked = false) {
  const values = [{ propertyKey: 'description', revAValue: `Donor ${index}`, revBValue: `Receiver ${index}`, revAEvidencePath: evidence(index, 'description'), revBEvidencePath: evidence(index, 'description') }];
  if (blocked) values.push(
    { propertyKey: 'supportType', revAValue: 'GUIDE', revBValue: 'STOP', revAEvidencePath: evidence(index, 'supportType'), revBEvidencePath: evidence(index, 'supportType') },
    { propertyKey: 'id', revAValue: `NEW-${index}`, revBValue: `PIPE-${index}`, revAEvidencePath: evidence(index, 'id'), revBEvidencePath: evidence(index, 'id') },
    { propertyKey: 'description', revAValue: `Nested ${index}`, revBValue: undefined, revAEvidencePath: evidence(index, 'attributes.DESCRIPTION'), revBEvidencePath: null },
    { propertyKey: 'description', revAValue: 'A', revBValue: undefined, revAEvidencePath: evidence(index, 'tags[0]'), revBEvidencePath: null },
  );
  return Object.freeze(values.map(deepFreeze));
}
export function productivityState(count = 6, options = {}) {
  const sourceChildren = []; const targetChildren = []; const sourceEntities = []; const targetEntities = [];
  const rows = []; const reviewItems = [];
  for (let index = 0; index < count; index += 1) {
    sourceChildren.push({ id: `PIPE-${index}`, description: `Donor ${index}`, supportType: 'GUIDE', tags: ['A'] });
    targetChildren.push({ id: `PIPE-${index}`, description: `Receiver ${index}`, supportType: 'STOP', tags: ['B'] });
    const source = entity(index, 'A', 'doc:A'); const target = entity(index, 'B', 'doc:B'); sourceEntities.push(source); targetEntities.push(target);
    rows.push(deepFreeze({
      differenceId: `difference:${String(index).padStart(4, '0')}`, differenceCategory: 'CHANGED',
      matchCertainty: index % 3 === 0 ? 'EXACT' : index % 3 === 1 ? 'INFERRED' : 'AMBIGUOUS',
      sourceRecordId: source.entityId, targetRecordId: target.entityId,
      changedProperties: changedProperties(index, options.blocked && index === 0),
    }));
    reviewItems.push(deepFreeze({ differenceId: rows.at(-1).differenceId, reviewState: options.unreviewed && index === 1 ? 'UNREVIEWED' : 'REVIEWED' }));
  }
  const sourceValue = { branches: [{ name: '/SCALE', children: sourceChildren }] };
  const targetValue = { branches: [{ name: '/SCALE', children: targetChildren }] };
  const snapshot = (side, id, hash, parsedValue, entityIndex) => deepFreeze({
    schema: 'RevisionCompareJsonDocumentSnapshot.v1', side, sourceDocumentId: id,
    sourceContentSha256: hash, fileName: `${id}.json`, rootKind: 'ENVELOPE', profile: 'stage/v1',
    parsedValue, entityIndex: Object.freeze(entityIndex), errors: Object.freeze([]),
  });
  return deepFreeze({
    schema: 'RevisionCompareWorkspaceState.v12', basisStatus: 'CURRENT',
    slots: { baseline: { jsonSnapshot: snapshot('REV_A', 'doc:A', documentHash('1'), sourceValue, sourceEntities) }, candidate: { jsonSnapshot: snapshot('REV_B', 'doc:B', documentHash('2'), targetValue, targetEntities) } },
    compare: { audit: { validation: { status: 'READY' }, differenceRows: Object.freeze(rows) } },
    review: { session: { status: 'CURRENT', items: Object.freeze(reviewItems) } },
    decision: { ledger: { status: 'CURRENT', decisions: Object.freeze([]) } },
    transferReview: createRevisionCompareTransferReviewState(),
    transfer: { status: 'IDLE', request: null, applyRequest: null, plan: null, result: null, artifacts: Object.freeze([]), error: null },
  });
}
