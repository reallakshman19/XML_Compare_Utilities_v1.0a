import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  resolveSequentialPortTopology,
  SEQUENTIAL_EDITABLE_TOPOLOGY_IDENTITY_REJECTION,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-identity.js';
import { projectSequentialEditableTopology } from '../tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-projection.js';

function source(relative) {
  return readFileSync(fileURLToPath(new URL(`../${relative}`, import.meta.url)), 'utf8');
}

const identity = source(
  'tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-identity.js',
);
const projection = source(
  'tabs/sequential-sketcher/scoped-edit/sequential-editable-topology-projection.js',
);
const index = source(
  'tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-index.js',
);

for (const [name, value] of [['identity', identity], ['projection', projection]]) {
  assert(value.split(/\r?\n/).length <= 300, `${name} module must remain under 300 lines`);
  assert.doesNotMatch(value, /export\s+default|module\.exports|exports\./);
  assert.doesNotMatch(value,
    /querySelector|addEventListener|publishCandidate|localStorage|sessionStorage|indexedDB|raycast|canvas/);
}

assert.match(identity, /resolveSequentialPortTopology/);
assert.match(identity, /PORT_POSITION_CONFLICT/);
assert.match(identity, /sameSequentialTopologyPoint/);
assert.match(projection, /resolveSequentialPortTopology/);
assert.match(projection, /Editable topology cannot omit unresolved support families/);
assert.match(projection, /carrierIds\.has\(glyph\.carrierId\)/);
assert.match(index, /sequential-editable-topology-identity/);

const missingConnectionPosition = {
  confirmedComponents: [{
    componentId: 'COMP-1', branchId: '/B',
    ports: [{ portId: 'PORT-1', sourcePosition: { x: 0, y: 0, z: 0 } }],
  }],
  committedConnections: [{
    connectionId: 'CONNECTION-1', fromPortId: 'PORT-1', toPortId: 'PORT-2',
    fromPosition: null, toPosition: { x: 0, y: 0, z: 0 },
  }],
  repairs: [],
};
assert.throws(
  () => resolveSequentialPortTopology(missingConnectionPosition),
  (error) => error.code
    === SEQUENTIAL_EDITABLE_TOPOLOGY_IDENTITY_REJECTION.PORT_POSITION_MISSING,
);

const portOnlyNodeAuthority = {
  sessionFingerprint: 'SESSION-1', confirmedConstructionFingerprint: 'CONFIRMED-1',
  confirmedComponents: [{
    componentId: 'COMP-1', sourceComponentId: 'SOURCE-1', branchId: '/B', sourceIndex: 0,
    canonicalType: 'PIPE', ports: [
      { portId: 'PORT-1', sourcePosition: { x: 0, y: 0, z: 0 } },
      { portId: 'PORT-2', sourcePosition: { x: 10, y: 0, z: 0 } },
    ],
  }],
  committedConnections: [], repairs: [], supports: [], unresolvedSupportFamilies: [],
  confirmedConstruction: {
    strokeLedger: [{ op: 'DRAW_PIPE', componentId: 'COMP-1' }],
    boundaryClassifications: [],
  },
};
const pointOnlyScene = { entities: [{
  id: 'ssk:component:COMP-1',
  domainRef: { category: 'confirmed', componentId: 'COMP-1' },
  geometry: { kind: 'point', position: { x: 0, y: 0, z: 0 } },
}] };
const projected = projectSequentialEditableTopology(portOnlyNodeAuthority, pointOnlyScene);
assert.equal(projected.ports.length, 2);
assert(projected.ports.every((port) => projected.nodes.some((node) => node.nodeId === port.nodeId)));
assert.equal(projected.components[0].nodeIds.length, 2);

console.log('Sequential editable topology identity containment: ok');
