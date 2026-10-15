import assert from 'node:assert/strict';
import {
  createEngineeringRevisionToken,
  createEngineeringScene,
  createEngineeringSceneEntity,
  createPointGeometry,
  createSegmentGeometry,
} from '../core/engineering-scene/index.js';
import {
  createEngineeringSvgSceneSource,
  createEngineeringSvgWorkspace,
} from '../core/engineering-svg/index.js';

class FakeClassList {
  constructor() { this.values = new Set(); }
  toggle(name, force) {
    if (force === true) this.values.add(name);
    else if (force === false) this.values.delete(name);
    else if (this.values.has(name)) this.values.delete(name);
    else this.values.add(name);
  }
  contains(name) { return this.values.has(name); }
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
  dispatch(type, target = this) {
    this.listeners.get(type)?.forEach((listener) => listener({ type, target }));
  }
}

class FakeDocument {
  createElementNS(namespace, localName) { return new FakeElement(this, localName); }
  createHost() { return new FakeElement(this, 'div'); }
}

function entity(id, geometry, renderOrder = 0) {
  return createEngineeringSceneEntity({
    id,
    kind: geometry.kind,
    geometry,
    renderOrder,
    domainRef: { owner: 'synthetic', id },
  });
}

function scene(revision, entities) {
  return createEngineeringScene({
    sceneId: 'workspace-scene',
    revision: createEngineeringRevisionToken(revision),
    entities,
  });
}

const entityA = entity('a', createSegmentGeometry({ x: 0, y: 0, z: 0 }, { x: 100, y: 0, z: 0 }));
const entityB = entity('b', createPointGeometry({ x: 25, y: 0, z: 10 }), 5);
const entityC = entity('c', createPointGeometry({ x: 75, y: 0, z: 15 }), 6);
const source = createEngineeringSvgSceneSource(scene('r1', [entityA, entityB]));
const documentRef = new FakeDocument();
const hostA = documentRef.createHost();
const hostB = documentRef.createHost();
const workspaceA = createEngineeringSvgWorkspace({ host: hostA, sceneSource: source });
const nodeA = workspaceA.getEntityNode('a');
assert.equal(hostA.children.length, 1);
assert.equal(workspaceA.getEntityCount(), 2);

source.setSnapshot(scene('r2', [
  entity('a', createSegmentGeometry({ x: 0, y: 0, z: 0 }, { x: 125, y: 0, z: 0 })),
  entityC,
]));
assert.equal(workspaceA.getEntityNode('a'), nodeA, 'unchanged entity ID must preserve its group node');
assert.equal(workspaceA.getEntityNode('b'), null);
assert.ok(workspaceA.getEntityNode('c'));
assert.equal(workspaceA.getEntityCount(), 2);

const workspaceB = createEngineeringSvgWorkspace({ host: hostB, sceneSource: source });
assert.equal(source.listenerCount(), 2);
workspaceA.setSelection(['a']);
assert.equal(workspaceA.getEntityNode('a').classList.contains('is-selected'), true);
assert.equal(workspaceB.getEntityNode('a').classList.contains('is-selected'), false);
workspaceA.root.dispatch('click', workspaceA.getEntityNode('c'));
assert.deepEqual(workspaceA.getSelection(), ['c']);

assert.equal(workspaceA.destroy(), true);
assert.equal(workspaceA.destroy(), false);
assert.equal(hostA.children.length, 0);
assert.equal(source.listenerCount(), 1);
assert.equal(workspaceB.destroy(), true);
assert.equal(source.listenerCount(), 0);

const remounted = createEngineeringSvgWorkspace({ host: hostA, sceneSource: source });
assert.equal(hostA.children.length, 1, 'remount must create exactly one SVG root');
remounted.destroy();
assert.equal(hostA.children.length, 0);

const stateSource = createEngineeringSvgSceneSource(scene('state-r1', [entityA, entityB]));
const stateHost = documentRef.createHost();
const stateWorkspace = createEngineeringSvgWorkspace({ host: stateHost, sceneSource: stateSource });

const initialState = stateWorkspace.getState();
assert.equal(initialState.schema, 'EngineeringSvgWorkspaceState.v1');
assert.equal(initialState.sequence, 0);
assert.equal(initialState.reason, 'initial');
assert.deepEqual(initialState.selectedIds, []);
assert(Object.isFrozen(initialState));
assert(Object.isFrozen(initialState.viewport));
assert(Object.isFrozen(initialState.selectedIds));
assert.equal(typeof initialState.revision, 'object');
assert(!(initialState.viewport instanceof Map) && !(initialState.selectedIds instanceof Set));
assert.doesNotThrow(() => JSON.stringify(initialState), 'owner state must be JSON-safe');

const publications = [];
const unsubscribeState = stateWorkspace.subscribeState((state) => publications.push(state));
stateWorkspace.setSelection(['a'], 'test-select');
assert.equal(publications.length, 1, 'one transition must generate exactly one publication');
assert.equal(publications[0].reason, 'test-select');
assert.equal(publications[0].sequence, 1);
assert.deepEqual(publications[0].selectedIds, ['a']);

stateSource.setSnapshot(scene('state-r2', [entityA, entityB]));
assert.equal(publications.length, 2);
assert.equal(publications[1].reason, 'scene-changed');
assert.equal(publications[1].revision.value, 'state-r2');

assert.equal(typeof unsubscribeState, 'function');
unsubscribeState();
stateWorkspace.setSelection(['b'], 'after-unsubscribe');
assert.equal(publications.length, 2, 'unsubscribed listener must not receive further publications');
assert.equal(stateWorkspace.getState().reason, 'after-unsubscribe', 'getState must reflect the latest transition regardless of subscriptions');

let publishedAfterDestroy = false;
stateWorkspace.subscribeState(() => { publishedAfterDestroy = true; });
stateWorkspace.destroy();
assert.throws(() => stateWorkspace.subscribeState(() => {}), /destroyed/);
assert.equal(publishedAfterDestroy, false, 'destroy must not itself emit a publication');

console.log('engineering SVG workspace: ok');
