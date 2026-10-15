import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  classifySequentialDraftEdit3dAvailability,
  sequentialDraftEdit3dActiveMessage,
} from '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-3d-availability.js';

function shadow(evidence, mounted = false) {
  return {
    evidence: () => evidence,
    host: () => mounted ? {} : null,
    readModel: () => mounted ? {} : null,
  };
}

const idle = classifySequentialDraftEdit3dAvailability(shadow({ status: 'IDLE' }));
assert.equal(idle.available, false);
assert.equal(idle.code, 'IDLE');
assert.match(idle.title, /requires an open Sequential branch/);

const ready = classifySequentialDraftEdit3dAvailability(shadow({ status: 'MOUNTED' }, true));
assert.equal(ready.available, true);
assert.equal(ready.code, 'READY');
assert.match(ready.message, /ready for the current Sequential branch/);

const degraded = classifySequentialDraftEdit3dAvailability(shadow({
  status: 'DEGRADED',
  lastDiagnostic: { error: { code: 'SCENE_INVALID', message: 'Certified scene rejected.' } },
}));
assert.equal(degraded.available, false);
assert.equal(degraded.status, 'error');
assert.match(degraded.title, /SCENE_INVALID: Certified scene rejected/);

assert.match(sequentialDraftEdit3dActiveMessage(0), /no visible entities yet/);
assert.match(sequentialDraftEdit3dActiveMessage(2), /2 entities/);

for (const relative of [
  '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-3d-availability.js',
  '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-3d-controller.js',
]) {
  const source = readFileSync(fileURLToPath(new URL(relative, import.meta.url)), 'utf8');
  assert(source.split(/\r?\n/).length <= 300, `${relative} must remain under 300 lines`);
  assert.doesNotMatch(source, /export\s+default|module\.exports|exports\./);
}

const controller = readFileSync(fileURLToPath(new URL(
  '../tabs/sequential-sketcher/scoped-edit/sequential-scoped-edit-3d-controller.js', import.meta.url)), 'utf8');
assert.match(controller, /dataset\.sskAvailability/);
assert.match(controller, /scene\.entities\.length\) state\.viewer\.fitAll/,
  'empty scenes must not invoke fitAll');
assert.doesNotMatch(controller, /appendEditCommand|wireTopologyEditGestures/);

console.log('Sequential Draft Edit 3D availability classification: ok');
