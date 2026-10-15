/** Behavioral consumer-local conformance for Topology authority and atomic acceptance. */
import { immutableJson } from '../../contracts/contract-values.js';
import { TOPOLOGY_SCOPED_EDIT_AUTHORITY_BASIS_V1, TOPOLOGY_SCOPED_EDIT_CONFORMANCE_V1 } from './topology-scoped-edit-authority-contracts.js';
import { semanticHash } from './topology-validator-values.js';
const REQUIRED_METHODS = Object.freeze(['currentAuthority', 'prepareNative', 'prepareNativeBatch', 'prepareAttribute',
  'prepareRemark', 'prepareUndo', 'prepareRedo', 'prepareLoad', 'certifyRegeneration', 'acceptPrepared',
  'restore', 'evidence', 'destroy']);
const SCENARIOS = Object.freeze(['authorized-commit', 'boundary-rejection', 'excluded-rejection',
  'payload-command-mismatch', 'persistence-failure', 'stale-writer', 'forged-recovery',
  'undo-redo', 'load-regeneration', 'destroy-terminality', 'input-immutability']);
function deeplyFrozen(value, seen = new WeakSet()) { if (!value || typeof value !== 'object') return true; if (seen.has(value)) return true; if (!Object.isFrozen(value)) return false; seen.add(value); return Object.values(value).every((child) => deeplyFrozen(child, seen)); }
function check(name, passed, detail, evidence = null) { return Object.freeze({ name, passed: Boolean(passed), detail: String(detail ?? ''), evidence }); }
function codeOf(error) { return String(error?.code ?? ''); }
function expectThrownCode(action, expected) { try { action(); return { passed: false, code: '' }; } catch (error) { return { passed: codeOf(error) === expected, code: codeOf(error) }; } }
function accepted(service, prepared, fixture) { const built = fixture.regenerate(prepared), regeneration = service.certifyRegeneration(prepared, built); return service.acceptPrepared(prepared, regeneration); }
async function authorizedScenario(factory) {
  const fixture = await factory('authorized-commit'), service = fixture.service;
  const before = service.currentAuthority(), inputHash = semanticHash(fixture.authorizedInput);
  const result = accepted(service, service.prepareNative(fixture.authorizedInput), fixture);
  const output = { passed: result.accepted && result.authority.authorityId !== before.authorityId
    && fixture.persistenceWrites() === 1 && semanticHash(fixture.authorizedInput) === inputHash,
    evidence: { reasonCode: result.reasonCode, persistenceWrites: fixture.persistenceWrites() } };
  service.destroy(); return output;
}
async function rejectionScenario(factory, name, expected, key) {
  const fixture = await factory(name), result = expectThrownCode(() => fixture.service.prepareNative(fixture[key]), expected);
  const output = { passed: result.passed && fixture.persistenceWrites() === 0, evidence: { code: result.code, persistenceWrites: fixture.persistenceWrites() } };
  fixture.service.destroy(); return output;
}
async function mismatchScenario(factory) {
  const fixture = await factory('payload-command-mismatch'), prepared = fixture.service.prepareNative(fixture.authorizedInput);
  const tampered = structuredClone(prepared); tampered.authorization.targets.commandType = fixture.mismatchCommandType;
  const result = fixture.service.acceptPrepared(tampered, fixture.service.certifyRegeneration(prepared, fixture.regenerate(prepared)));
  const output = { passed: !result.accepted && result.reasonCode === 'COMMAND_AUTHORITY_MISMATCH' && fixture.persistenceWrites() === 0,
    evidence: { reasonCode: result.reasonCode } }; fixture.service.destroy(); return output;
}
async function persistenceScenario(factory) {
  const fixture = await factory('persistence-failure'), service = fixture.service, before = service.currentAuthority();
  const prepared = service.prepareNative(fixture.authorizedInput), result = accepted(service, prepared, fixture);
  const output = { passed: !result.accepted && result.reasonCode === 'RECOVERY_PERSISTENCE_FAILED'
    && service.currentAuthority().authorityId === before.authorityId && fixture.persistenceWrites() === 0,
    evidence: { reasonCode: result.reasonCode, persistenceAttempts: fixture.persistenceAttempts() } };
  service.destroy(); return output;
}
async function staleWriterScenario(factory) {
  const fixture = await factory('stale-writer'), code = await fixture.attemptSecondWriter();
  const output = { passed: code === 'TOPOLOGY_EDIT_WRITER_UNAVAILABLE', evidence: { reasonCode: code } }; fixture.service.destroy(); return output;
}
async function forgedScenario(factory) {
  const fixture = await factory('forged-recovery'), result = expectThrownCode(() => fixture.service.restore(), 'SESSION_DRAFT_INVALID');
  const output = { passed: result.passed, evidence: { reasonCode: result.code } }; fixture.service.destroy(); return output;
}
async function undoRedoScenario(factory) {
  const fixture = await factory('undo-redo'), service = fixture.service;
  let result = accepted(service, service.prepareNative(fixture.authorizedInput), fixture);
  if (!result.accepted) return { passed: false, evidence: { step: 'commit' } };
  const afterCommit = service.currentAuthority().authorityId, now = fixture.nextTime();
  result = accepted(service, service.prepareUndo(fixture.uiState, now, afterCommit), fixture);
  if (!result.accepted) return { passed: false, evidence: { step: 'undo', reasonCode: result.reasonCode } };
  result = accepted(service, service.prepareRedo(fixture.uiState, fixture.nextTime(), service.currentAuthority().authorityId), fixture);
  const output = { passed: result.accepted && service.currentAuthority().activeCommandIds.length === 1,
    evidence: { step: 'redo', persistenceWrites: fixture.persistenceWrites() } }; service.destroy(); return output;
}
async function loadScenario(factory) {
  const source = await factory('load-source'), sourceService = source.service;
  const committed = accepted(sourceService, sourceService.prepareNative(source.authorizedInput), source);
  if (!committed.accepted) return { passed: false, evidence: { step: 'source-commit' } };
  const snapshot = sourceService.evidence().lastSnapshot; sourceService.destroy();
  const target = await factory('load-regeneration'), targetService = target.service;
  const before = targetService.currentAuthority().authorityId, prepared = targetService.prepareLoad(snapshot, before);
  if (target.persistenceWrites() !== 0 || targetService.currentAuthority().authorityId !== before) {
    targetService.destroy(); return { passed: false, evidence: { step: 'prepare-published' } };
  }
  const result = accepted(targetService, prepared, target); targetService.destroy();
  return { passed: result.accepted && target.persistenceWrites() === 1,
    evidence: { reasonCode: result.reasonCode, persistenceWrites: target.persistenceWrites() } };
}
async function destroyScenario(factory) {
  const fixture = await factory('destroy-terminality'); fixture.service.destroy();
  const result = expectThrownCode(() => fixture.service.prepareNative(fixture.authorizedInput), 'TOPOLOGY_EDIT_SERVICE_DESTROYED');
  return { passed: result.passed, evidence: { reasonCode: result.code } };
}
async function immutabilityScenario(factory) {
  const fixture = await factory('input-immutability'), hash = semanticHash(fixture.authorizedInput);
  const result = accepted(fixture.service, fixture.service.prepareNative(fixture.authorizedInput), fixture);
  const output = { passed: result.accepted && semanticHash(fixture.authorizedInput) === hash && deeplyFrozen(result), evidence: { acceptanceFrozen: deeplyFrozen(result) } }; fixture.service.destroy(); return output;
}
const RUNNERS = Object.freeze({
  'authorized-commit': authorizedScenario,
  'boundary-rejection': (factory) => rejectionScenario(factory, 'boundary-rejection', 'BOUNDARY_TARGET_NOT_EDITABLE', 'boundaryInput'),
  'excluded-rejection': (factory) => rejectionScenario(factory, 'excluded-rejection', 'EXCLUDED_TARGET_NOT_EDITABLE', 'excludedInput'),
  'payload-command-mismatch': mismatchScenario, 'persistence-failure': persistenceScenario,
  'stale-writer': staleWriterScenario, 'forged-recovery': forgedScenario,
  'undo-redo': undoRedoScenario, 'load-regeneration': loadScenario, 'destroy-terminality': destroyScenario,
  'input-immutability': immutabilityScenario,
});
export async function runTopologyScopedEditConformance(input = {}) {
  if (typeof input.fixtureFactory !== 'function') throw new TypeError('Topology conformance requires fixtureFactory().');
  const structural = await input.fixtureFactory('structural'), service = structural.service, checks = [];
  for (const name of REQUIRED_METHODS) checks.push(check(`method:${name}`, typeof service?.[name] === 'function', `${name} must be a function.`));
  let authority = null; try { authority = service.currentAuthority(); } catch (error) { checks.push(check('authority:readable', false, error.message)); }
  checks.push(check('authority:schema', authority?.schema === TOPOLOGY_SCOPED_EDIT_AUTHORITY_BASIS_V1, 'Current authority schema is required.'));
  checks.push(check('authority:immutable', deeplyFrozen(authority), 'Current authority must be deeply immutable.'));
  checks.push(check('authority:json', (() => { try { JSON.stringify(authority); return true; } catch { return false; } })(), 'Current authority must be JSON-safe.'));
  structural.service.destroy();
  for (const name of SCENARIOS) {
    try { const result = await RUNNERS[name](input.fixtureFactory); checks.push(check(`scenario:${name}`, result.passed, `${name} must pass.`, result.evidence)); }
    catch (error) { checks.push(check(`scenario:${name}`, false, error.message, { reasonCode: codeOf(error) })); }
  }
  return immutableJson({ schema: TOPOLOGY_SCOPED_EDIT_CONFORMANCE_V1, valid: checks.every((entry) => entry.passed),
    checkCount: checks.length, checks, prohibitedAdoption: { sharedRuntimeMounted: false, rendererReplaced: false,
      gesturesRewired: false, solverMigrated: false } }, 'Topology scoped-edit conformance report');
}
export const _test = Object.freeze({ deeplyFrozen, REQUIRED_METHODS, SCENARIOS });
