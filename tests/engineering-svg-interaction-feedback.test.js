import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createEngineeringSnapAcquisition,
  createEngineeringSnapCandidate,
  createEngineeringSnapEvidence,
  createSegmentGeometry,
} from '../core/engineering-scene/index.js';
import {
  buildEngineeringSvgProjectedScene,
  createEngineeringSvgSceneSource,
  createEngineeringSvgWorkspace,
} from '../core/engineering-svg/index.js';
import {
  composeEngineeringSvgFeedbackScene,
  engineeringSvgFeedbackEntityId,
} from '../core/engineering-svg/interaction-runtime.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) {
    if (force === true) this.values.add(name);
    else if (force === false) this.values.delete(name);
    else if (this.values.has(name)) this.values.delete(name);
    else this.values.add(name);
  }
}

class FakeElement {
  constructor(ownerDocument, localName) {
    this.ownerDocument = ownerDocument;
    this.localName = localName;
    this.children = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.listeners = new Map();
    this.classList = new FakeClassList();
    this.style = {};
    this.clientWidth = 600;
    this.clientHeight = 360;
  }
  get firstElementChild() { return this.children[0] || null; }
  appendChild(child) {
    child.remove();
    child.parentNode = this;
    this.children.push(child);
    return child;
  }
  remove() {
    if (!this.parentNode) return;
    this.parentNode.children = this.parentNode.children.filter((child) => child !== this);
    this.parentNode = null;
  }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  addEventListener(type, listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type).add(listener);
  }
  removeEventListener(type, listener) { this.listeners.get(type)?.delete(listener); }
}

class FakeDocument {
  createElementNS(namespace, localName) { return new FakeElement(this, localName); }
  createHost() { return new FakeElement(this, 'div'); }
}

const revision = createEngineeringRevisionToken('feedback-r1');
const original = createSegmentGeometry(
  { x: 0, y: 0, z: 0 },
  { x: 100, y: 0, z: 0 },
);
const draft = createSegmentGeometry(
  { x: 0, y: 10, z: 0 },
  { x: 100, y: 10, z: 0 },
);
const scene = createEngineeringScene({
  sceneId: 'feedback-scene',
  revision,
  entities: [createEngineeringSceneEntity({
    id: 'segment-1', kind: 'segment', geometry: original,
    domainRef: { owner: 'synthetic', id: 'segment-1' },
  })],
});
const viewport = { width: 600, height: 360 };
const initialProjected = buildEngineeringSvgProjectedScene(scene, {
  projection: 'XY', viewport, padding: 20,
});
const candidate = createEngineeringSnapCandidate({
  id: 'feedback-snap', providerId: 'synthetic-provider', mode: 'endpoint',
  sourceEntityIds: ['target-1'], worldPoint: { x: 50, y: 10, z: 0 },
  screenPoint: { x: 300, y: 124 }, screenDistance: 0, priority: 0,
  lockedAxes: { x: true, y: true }, label: 'Endpoint',
});
const acquisition = createEngineeringSnapAcquisition({
  rawScreenPoint: { x: 300, y: 124 }, rawWorldPoint: { x: 50, y: 10, z: 0 },
  aperture: 12, candidate,
  evidence: createEngineeringSnapEvidence({
    considered: 1, compatible: 1, inAperture: 1, deduplicated: 0,
    winnerId: candidate.id, orderedIds: [candidate.id],
    providerCounts: { 'synthetic-provider': 1 }, providerErrors: [],
  }),
});
const feedbackScene = composeEngineeringSvgFeedbackScene(scene, {
  entityId: 'segment-1',
  constraint: { kind: 'plane', axes: ['X', 'Y'] },
  projection: 'XY',
  fit: initialProjected.fit,
  draftGeometry: draft,
  acquisition,
  handlePixelLength: 48,
});
const feedbackProjected = buildEngineeringSvgProjectedScene(feedbackScene, {
  projection: 'XY', viewport, padding: 20,
});
assert.deepEqual(feedbackProjected.fit, initialProjected.fit, 'feedback entities must not change fit');

function projectedEntity(id) {
  return feedbackProjected.entities.find((entity) => entity.id === id);
}
function screenLength(entity) {
  const [start, end] = entity.projectedGeometry.points;
  return Math.hypot(end.x - start.x, end.y - start.y);
}
const xHandleId = engineeringSvgFeedbackEntityId('handle', 'segment-1', 'X');
const yHandleId = engineeringSvgFeedbackEntityId('handle', 'segment-1', 'Y');
const xHandle = projectedEntity(xHandleId);
const yHandle = projectedEntity(yHandleId);
assert.ok(xHandle);
assert.ok(yHandle);
assert.ok(Math.abs(screenLength(xHandle) - 48) < 1e-9);
assert.ok(Math.abs(screenLength(yHandle) - 48) < 1e-9);
assert.equal(feedbackScene.entities.find((entity) => entity.id === xHandleId).contributesToFit, false);
assert.ok(projectedEntity(engineeringSvgFeedbackEntityId('guide', 'segment-1')));
assert.ok(projectedEntity(engineeringSvgFeedbackEntityId('snap', 'segment-1')));

const invisible = composeEngineeringSvgFeedbackScene(scene, {
  entityId: 'segment-1', constraint: { kind: 'axis', axis: 'Z' },
  projection: 'XY', fit: initialProjected.fit, handlePixelLength: 48,
});
assert.equal(invisible.entities.some((entity) => entity.id.includes('/handle/')), false);

const documentRef = new FakeDocument();
const host = documentRef.createHost();
const source = createEngineeringSvgSceneSource(scene);
const workspace = createEngineeringSvgWorkspace({
  host, sceneSource: source, projection: 'XY', viewport, padding: 20,
});
const authoritativeNode = workspace.getEntityNode('segment-1');
source.setSnapshot(feedbackScene, 'feedback-update');
assert.equal(workspace.getEntityNode('segment-1'), authoritativeNode, 'feedback updates must preserve authoritative SVG node identity');
assert.ok(workspace.getEntityNode(xHandleId));
assert.equal(host.children.length, 1);
workspace.destroy();
assert.equal(host.children.length, 0);

assert.throws(() => composeEngineeringSvgFeedbackScene(scene, {
  entityId: 'segment-1', constraint: { kind: 'path', referenceId: 'route-1' },
  projection: 'XY', fit: initialProjected.fit,
}), /requires resolveReferenceVector/);

console.log('engineering SVG interaction feedback: ok');
