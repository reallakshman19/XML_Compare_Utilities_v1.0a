import assert from 'assert';
import { _test } from '../tabs/inputxml-workspace/inputxml-workspace-cleanxml.js';

const { inferFromText, angleRole, resolveRole } = _test;

// inferFromText: one case per text-heuristic branch.
assert.strictEqual(inferFromText({ componentType: 'THREADOLET' }).role, 'OLET', 'OLET text should infer OLET role.');
assert.strictEqual(inferFromText({ componentType: 'TEE' }).role, 'TEE', 'TEE text should infer TEE role.');
assert.strictEqual(inferFromText({ componentType: 'BRANCH' }).role, 'BRAN', 'BRANCH-only text should infer BRAN role.');
assert.strictEqual(inferFromText({ componentType: 'REDUCER' }).role, 'REDU', 'REDUCER text should infer REDU role.');
assert.strictEqual(inferFromText({ componentType: 'ELBOW' }).role, 'ELBO', 'ELBOW text should infer ELBO role.');
assert.strictEqual(inferFromText({ componentType: 'GATE VALVE' }).role, 'VALV', 'VALVE text should infer VALV role.');
assert.strictEqual(inferFromText({ componentType: 'FLANGE' }).role, 'FLAN', 'FLANGE text should infer FLAN role.');
assert.strictEqual(inferFromText({ componentType: 'ANCHOR' }).role, 'ATTA', 'ANCHOR text should infer ATTA role.');
assert.strictEqual(inferFromText({ componentType: 'PIPE' }), null, 'Unrecognized text should return null.');

// angleRole: straight line -> null, sharp bend -> ELBO.
const straight = [{ position: { x: 0, y: 0, z: 0 } }, { position: { x: 1000, y: 0, z: 0 } }, { position: { x: 2000, y: 0, z: 0 } }];
assert.strictEqual(angleRole(straight[0], straight[1], straight[2]), null, 'Collinear points should not infer a bend.');
const bend = [{ position: { x: 0, y: 0, z: 0 } }, { position: { x: 1000, y: 0, z: 0 } }, { position: { x: 1000, y: 1000, z: 0 } }];
assert.strictEqual(angleRole(bend[0], bend[1], bend[2]).role, 'ELBO', 'A 90-degree direction change should infer ELBO role.');

// resolveRole: manual componentTypeOverride takes precedence even over a present Endpoint.
const overrideRow = { endpoint: '1', componentType: 'ATTA', componentTypeOverride: 'tee', position: null };
const resolved = resolveRole(overrideRow, 0, [overrideRow], new Map());
assert.strictEqual(resolved.role, 'TEE', 'componentTypeOverride must win over a present Endpoint value.');
assert.strictEqual(resolved.confidence, 1, 'Manual override should be full confidence.');

// resolveRole: Endpoint still wins when no override is supplied.
const endpointRow = { endpoint: '1', componentType: 'ELBO', componentTypeOverride: '', position: null };
assert.strictEqual(resolveRole(endpointRow, 0, [endpointRow], new Map()).role, 'ELBO', 'Endpoint should still resolve the role when no override is given.');

console.log('CleanXML resolveRole/inferFromText/angleRole checks passed.');
