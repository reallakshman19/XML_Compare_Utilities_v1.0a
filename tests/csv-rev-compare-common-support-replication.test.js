import assert from 'node:assert/strict';

import {
  COMMON_SUPPORT_REMARK_REPLICATED,
  augmentCommonSupportRemarkReplicationEvents,
  commonSupportSiblingGroups,
} from '../tabs/csv-rev-compare/support-revision-common-replication.js';
import { renderSupportRevisionRemarks } from '../tabs/csv-rev-compare/support-revision-remarks.js';

function location(nodeId, rowId, family, pipe, refs = [], options = {}) {
  const activePayload = options.activePayload !== false;
  return Object.freeze({
    nodeId,
    sourceRowId: rowId,
    family,
    supportLocationIdentity: `${family.toUpperCase()}||${pipe.toUpperCase()}`,
    pipe: Object.freeze({ raw: pipe, normalizedCore: pipe.toUpperCase() }),
    persistentReferences: Object.freeze([...refs]),
    components: Object.freeze(refs.map((reference, index) => Object.freeze({
      nodeId: `${nodeId}:component:${index + 1}`,
      memberId: `/${family}.${index + 1}`,
      supportType: 'REST',
      reference,
      ordinal: index + 1,
    }))),
    position: Object.freeze({
      x: Object.freeze({ raw: activePayload ? 'E 100 mm' : '', directedMm: activePayload ? 100 : null }),
      y: Object.freeze({ raw: '', directedMm: null }),
      z: Object.freeze({ raw: '', directedMm: null }),
    }),
    loads: Object.freeze({ slots: Object.freeze([]) }),
    sourceFields: Object.freeze({
      totalSupportPoints: activePayload ? '1' : '',
      primarySupportDescription: activePayload ? 'Active support' : '',
    }),
    provenance: Object.freeze({ cells: Object.freeze({}) }),
  });
}

function model(locations) {
  return Object.freeze({
    locations: Object.freeze(locations),
    locationByNodeId: new Map(locations.map((item) => [item.nodeId, item])),
  });
}

function edge(index, source, target) {
  return Object.freeze({
    edgeId: `edge:${index}`,
    cardinality: '1->1',
    sourceNodeIds: Object.freeze([source.nodeId]),
    targetNodeIds: Object.freeze([target.nodeId]),
    outcome: 'DETERMINISTIC',
    candidateIds: Object.freeze([]),
  });
}

function event(eventId, type, source, target, remarkEligible = true) {
  return Object.freeze({
    eventId,
    type,
    sourceXmlNode: source?.nodeId || null,
    targetXmlNode: target?.nodeId || null,
    sourceCsvRowId: source?.sourceRowId || null,
    targetCsvRowId: target?.sourceRowId || null,
    remarkEligible,
    normalizedState: type === 'PIPE_IDENTITY_CHANGED' ? Object.freeze({ projection: 'LINE_NUMBER_CHANGE' }) : Object.freeze({}),
    persistentReferences: Object.freeze([]),
    candidateIds: Object.freeze([]),
    trace: Object.freeze({}),
  });
}

function ledger(events) {
  return Object.freeze({
    schema: 'test-ledger',
    profileId: 'test',
    profileVersion: '1',
    policyId: 'test',
    policyVersion: '1',
    events: Object.freeze(events),
    summary: Object.freeze({ total: events.length }),
  });
}

function fixture(pipe3 = null) {
  const s1 = location('s1', 'R1-1', 'SL-101', 'LINE-1', ['REF-1']);
  const s2 = location('s2', 'R1-2', 'SL-101', 'LINE-2', ['REF-2']);
  const t1 = location('t1', 'R2-1', 'SL-101', 'LINE-1', ['REF-1']);
  const t2 = location('t2', 'R2-2', 'SL-101', 'LINE-2', ['REF-2']);
  const sources = [s1, s2];
  const targets = [t1, t2];
  const edges = [edge(1, s1, t1), edge(2, s2, t2)];
  if (pipe3) {
    const s3 = location('s3', 'R1-3', 'SL-101', pipe3, ['REF-3']);
    const t3 = location('t3', 'R2-3', 'SL-101', pipe3, ['REF-3']);
    sources.push(s3); targets.push(t3); edges.push(edge(3, s3, t3));
  }
  return Object.freeze({
    sourceModel: model(sources),
    targetModel: model(targets),
    lineage: Object.freeze({ edges: Object.freeze(edges) }),
    source: Object.freeze({ s1, s2, s3: sources[2] || null }),
    target: Object.freeze({ t1, t2, t3: targets[2] || null }),
  });
}

{
  const fx = fixture();
  const base = ledger([event('e-load', 'LOAD_SIGNATURE_CHANGED', fx.source.s2, fx.target.t2)]);
  const augmented = augmentCommonSupportRemarkReplicationEvents(base, fx.sourceModel, fx.targetModel, fx.lineage);
  const replicated = augmented.events.filter((item) => item.type === COMMON_SUPPORT_REMARK_REPLICATED);
  assert.equal(replicated.length, 1);
  assert.equal(replicated[0].targetXmlNode, 't1');
  assert.deepEqual(replicated[0].normalizedState.triggerSiblingNodeIds, ['t2']);
  assert.deepEqual(replicated[0].normalizedState.triggerRemarkEventIds, ['e-load']);
  const remarks = renderSupportRevisionRemarks(augmented, fx.sourceModel, fx.targetModel);
  assert.equal(remarks.targetRemarks['R2-1'].remark, 'Replicated due to Common support');
  assert.equal(remarks.targetRemarks['R2-2'].remark, 'Minor Load change');
}

{
  const fx = fixture();
  const base = ledger([event('e-type', 'SUPPORT_COMPONENT_TYPE_CHANGED', fx.source.s2, fx.target.t2)]);
  const augmented = augmentCommonSupportRemarkReplicationEvents(base, fx.sourceModel, fx.targetModel, fx.lineage);
  const remarks = renderSupportRevisionRemarks(augmented, fx.sourceModel, fx.targetModel);
  assert.equal(remarks.targetRemarks['R2-1'].remark, 'Replicated due to Common support');
  assert.equal(remarks.targetRemarks['R2-2'].remark, 'Support Type Changes');
}

{
  const fx = fixture('LINE-3');
  const base = ledger([event('e-load', 'LOAD_SIGNATURE_CHANGED', fx.source.s2, fx.target.t2)]);
  const augmented = augmentCommonSupportRemarkReplicationEvents(base, fx.sourceModel, fx.targetModel, fx.lineage);
  assert.deepEqual(augmented.events.filter((item) => item.type === COMMON_SUPPORT_REMARK_REPLICATED).map((item) => item.targetXmlNode).sort(), ['t1', 't3']);
}

{
  const fx = fixture();
  const base = ledger([
    event('e-member', 'PRIMARY_MEMBER_RENUMBERED', fx.source.s1, fx.target.t1, false),
    event('e-suppressed', 'SUPPRESSED_FIELD_CHANGED', fx.source.s1, fx.target.t1, false),
    event('e-load', 'LOAD_SIGNATURE_CHANGED', fx.source.s2, fx.target.t2),
  ]);
  const augmented = augmentCommonSupportRemarkReplicationEvents(base, fx.sourceModel, fx.targetModel, fx.lineage);
  const replicated = augmented.events.find((item) => item.type === COMMON_SUPPORT_REMARK_REPLICATED) || null;
  assert.ok(replicated, 'audit-only housekeeping must not block an otherwise unchanged common-support sibling');
  assert.equal(replicated.targetXmlNode, 't1');
  assert.deepEqual(replicated.trace.ignoredAuditEventIds, ['e-member', 'e-suppressed']);
}

{
  const fx = fixture();
  const base = ledger([
    event('e-set-change', 'SUPPORT_COMPONENT_SET_CHANGED', fx.source.s1, fx.target.t1, true),
    event('e-load', 'LOAD_SIGNATURE_CHANGED', fx.source.s2, fx.target.t2),
  ]);
  const augmented = augmentCommonSupportRemarkReplicationEvents(base, fx.sourceModel, fx.targetModel, fx.lineage);
  assert.equal(augmented.events.filter((item) => item.type === COMMON_SUPPORT_REMARK_REPLICATED).length, 0,
    'material structural change on the recipient must block an unchanged-sibling replication label');
}

{
  const fx = fixture();
  const base = ledger([
    event('e-structural', 'COMMON_SUPPORT_REPLICATED', fx.source.s1, fx.target.t1),
    event('e-load', 'LOAD_SIGNATURE_CHANGED', fx.source.s2, fx.target.t2),
  ]);
  const augmented = augmentCommonSupportRemarkReplicationEvents(base, fx.sourceModel, fx.targetModel, fx.lineage);
  assert.equal(augmented.events.filter((item) => item.type === COMMON_SUPPORT_REMARK_REPLICATED).length, 0,
    'legacy structural 1->N replication evidence is not the Owner-visible sibling propagation rule');
  const remarks = renderSupportRevisionRemarks(augmented, fx.sourceModel, fx.targetModel);
  assert.equal(remarks.targetRemarks['R2-1'], undefined, 'legacy structural event must not render the replication remark');
}

{
  const s1 = location('s1', 'R1-1', 'SL-101', 'LINE-1', ['REF-1']);
  const s2 = location('s2', 'R1-2', 'SL-102', 'LINE-2', ['REF-2']);
  const t1 = location('t1', 'R2-1', 'SL-101', 'LINE-1', ['REF-1']);
  const t2 = location('t2', 'R2-2', 'SL-102', 'LINE-2', ['REF-2']);
  const sourceModel = model([s1, s2]);
  const targetModel = model([t1, t2]);
  const lineage = Object.freeze({ edges: Object.freeze([edge(1, s1, t1), edge(2, s2, t2)]) });
  assert.equal(commonSupportSiblingGroups(targetModel).length, 0);
  const augmented = augmentCommonSupportRemarkReplicationEvents(ledger([event('e-load', 'LOAD_SIGNATURE_CHANGED', s2, t2)]), sourceModel, targetModel, lineage);
  assert.equal(augmented.events.filter((item) => item.type === COMMON_SUPPORT_REMARK_REPLICATED).length, 0);
}

{
  const s1 = location('s1', 'R1-1', 'SL-101', 'LINE-1', ['REF-1']);
  const t1 = location('t1', 'R2-1', 'SL-101', 'LINE-1', ['REF-1']);
  const t2 = location('t2', 'R2-2', 'SL-101', 'LINE-2', ['REF-2']);
  const sourceModel = model([s1]);
  const targetModel = model([t1, t2]);
  const lineage = Object.freeze({ edges: Object.freeze([edge(1, s1, t1)]) });
  const augmented = augmentCommonSupportRemarkReplicationEvents(ledger([event('e-load', 'LOAD_SIGNATURE_CHANGED', s1, t1)]), sourceModel, targetModel, lineage);
  assert.equal(augmented.events.filter((item) => item.type === COMMON_SUPPORT_REMARK_REPLICATED).length, 0,
    'a newly added sibling without an exact Civil+PIPE predecessor is not an unchanged recipient');
}

{
  const s1 = location('s1', 'R1-1', 'SL-101', 'LINE-1', ['REF-1']);
  const s2 = location('s2', 'R1-2', 'SL-101', 'LINE-2', ['REF-2']);
  const t1 = location('t1', 'R2-1', 'SL-101', 'LINE-1', ['REF-1'], { activePayload: false });
  const t2 = location('t2', 'R2-2', 'SL-101', 'LINE-2', ['REF-2']);
  const sourceModel = model([s1, s2]);
  const targetModel = model([t1, t2]);
  const lineage = Object.freeze({ edges: Object.freeze([edge(1, s1, t1), edge(2, s2, t2)]) });
  const augmented = augmentCommonSupportRemarkReplicationEvents(ledger([
    event('e-suppressed', 'SUPPRESSED_FIELD_CHANGED', s1, t1, false),
    event('e-load', 'LOAD_SIGNATURE_CHANGED', s2, t2),
  ]), sourceModel, targetModel, lineage);
  assert.equal(augmented.events.filter((item) => item.type === COMMON_SUPPORT_REMARK_REPLICATED).length, 0,
    'component-only retained shells must not inherit a sibling remark');
}

console.log('csv-rev-compare common-support sibling replication tests: PASS');
