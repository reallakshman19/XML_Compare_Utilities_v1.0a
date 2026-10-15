import assert from 'node:assert/strict';
import { createPipelineCanonicalPlanPublicationSession } from '../tabs/pipeline-3d-model/pipeline-3d-model-canonical-plan-publication-session.js';
class EventRecord {
  constructor(type, init) { this.type = type; Object.assign(this, init); }
}
const events = [];
const dialog = { dispatchEvent(event) { events.push(event); return true; } };
const session = createPipelineCanonicalPlanPublicationSession(EventRecord);
const first = Object.freeze({ schema: 'PipelineAnalysisSectionPlan.v1',
  sections: Object.freeze([{ profileId: 'normal-metallic', startElementIndex: 0 }]) });
const reordered = { sections: [{ startElementIndex: 0, profileId: 'normal-metallic' }],
  schema: 'PipelineAnalysisSectionPlan.v1' };
assert.equal(session.publish(dialog, first), true);
assert.equal(events.length, 1);
assert.equal(events[0].bubbles, false);
assert.equal(events[0].detail.plan, first);
assert.equal(dialog.pipelineCanonicalAnalysisSectionPlan, first);
assert.equal(session.publish(dialog, reordered), false);
assert.equal(events.length, 1);
const changed = { ...reordered, sections: [{ startElementIndex: 0, profileId: 'gre' }] };
assert.equal(session.publish(dialog, changed), true);
assert.equal(events.length, 2);
session.reset();
assert.equal(session.publish(dialog, changed), true);
assert.equal(events.length, 3);
const failing = createPipelineCanonicalPlanPublicationSession(EventRecord);
const badDialog = { dispatchEvent() { throw new Error('dispatch failed'); } };
assert.throws(() => failing.publish(badDialog, first), /dispatch failed/);
badDialog.dispatchEvent = (event) => { events.push(event); return true; };
assert.equal(failing.publish(badDialog, first), true);
console.log('canonical plan publication session: PASS');
