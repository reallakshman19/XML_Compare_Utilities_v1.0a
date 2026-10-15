/** Guarded non-visual Draft Edit 3D adapter over Sequential accepted-command authority. */
import { immutableJson, isIsoTimestamp, requiredContractText } from '../../../contracts/contract-values.js';
import {
  SEQUENTIAL_COMMAND_REJECTION,
  SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES,
  sequentialCommandCodedError,
} from './sequential-command-contracts.js';
import { validateSequentialCommandJournalState } from './sequential-command-journal.js';
import { createSequentialCommandService } from './sequential-command-service.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';

export const SEQUENTIAL_DRAFT_EDIT_COMMAND_GATEWAY_SCHEMA = 'SequentialDraftEditCommandGateway.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}
function coded(code, message, Constructor = Error) {
  throw sequentialCommandCodedError(code, message, Constructor);
}
function jsonContract(value, label) {
  try { return immutableJson(value, label); }
  catch (error) {
    coded(SEQUENTIAL_COMMAND_REJECTION.COMMAND_SCHEMA_INVALID, error.message || String(error), TypeError);
  }
}
function requiredText(value, label) {
  try { return requiredContractText(value, label); }
  catch (error) { coded(SEQUENTIAL_COMMAND_REJECTION.COMMAND_SCHEMA_INVALID, error.message, TypeError); }
}
function current(reader) {
  const value = reader();
  if (!value || typeof value !== 'object') throw new TypeError('Sequential Draft Edit command state is unavailable.');
  return value;
}
function authorityStatus(state) {
  const branchId = String(state?.session?.rootBranchId || '').trim();
  if (!branchId) return Object.freeze({ ready: false, branchId: null, reasonCode: SEQUENTIAL_COMMAND_REJECTION.COMMAND_BRANCH_MISMATCH });
  if (state.journalState === null || state.journalState === undefined) {
    return Object.freeze({ ready: false, branchId, reasonCode: SEQUENTIAL_COMMAND_REJECTION.JOURNAL_NOT_ADOPTED });
  }
  const errors = validateSequentialCommandJournalState(state.journalState);
  if (errors.length) return Object.freeze({ ready: false, branchId, reasonCode: SEQUENTIAL_COMMAND_REJECTION.COMMAND_AUTHORITY_MISMATCH });
  try { deriveSequentialEditAuthority(state); }
  catch {
    return Object.freeze({ ready: false, branchId, reasonCode: SEQUENTIAL_COMMAND_REJECTION.COMMAND_AUTHORITY_MISMATCH });
  }
  return Object.freeze({ ready: true, branchId, reasonCode: null });
}
function requireReady(reader) {
  const state = current(reader);
  const status = authorityStatus(state);
  if (!status.ready) coded(status.reasonCode, 'Sequential Draft Edit command authority is not ready.', RangeError);
  return status;
}
function validatedOrigin(value) {
  const origin = jsonContract(value, 'Sequential Draft Edit command origin');
  if (String(origin?.kind || '').toUpperCase() !== 'USER') {
    coded(SEQUENTIAL_COMMAND_REJECTION.COMMAND_SCHEMA_INVALID, 'Draft Edit commands require USER origin.', TypeError);
  }
  requiredText(origin.actorId, 'Draft Edit command origin actorId');
  if (!isIsoTimestamp(origin.issuedAt)) {
    coded(SEQUENTIAL_COMMAND_REJECTION.COMMAND_SCHEMA_INVALID, 'Draft Edit command issuedAt must be an exact ISO timestamp.', TypeError);
  }
  return origin;
}
function validatedCommand(value, branchId) {
  const command = jsonContract(value, 'Sequential Draft Edit command');
  const commandType = requiredText(command.commandType, 'Draft Edit commandType').toUpperCase();
  if (!SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES.includes(commandType)) {
    coded(SEQUENTIAL_COMMAND_REJECTION.COMMAND_RUNTIME_NOT_DETERMINISTIC,
      `Draft Edit command ${commandType} is not enabled for deterministic preparation.`, RangeError);
  }
  const suppliedBranch = String(command.branchId || '').trim();
  if (suppliedBranch && suppliedBranch !== branchId) {
    coded(SEQUENTIAL_COMMAND_REJECTION.COMMAND_BRANCH_MISMATCH,
      'Draft Edit command branch does not match the active Sequential branch.', RangeError);
  }
  return jsonContract({ ...command, commandType, branchId }, 'Bound Sequential Draft Edit command');
}

export function createSequentialDraftEditCommandGateway(options = {}) {
  const readCurrentState = requiredFunction(options.readCurrentState, 'readCurrentState');
  const publishCandidate = requiredFunction(options.publishCandidate, 'publishCandidate');
  const service = createSequentialCommandService({ readCurrentState, publishCandidate });
  let destroyed = false;
  function requireLive() {
    if (destroyed) coded(SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_INVALID,
      'Sequential Draft Edit command gateway is destroyed.', RangeError);
  }
  function prepare(input = {}) {
    requireLive();
    const status = requireReady(readCurrentState);
    return service.prepare({
      command: validatedCommand(input.command, status.branchId),
      origin: validatedOrigin(input.origin),
    });
  }
  function accept(prepared) { requireLive(); return service.accept(prepared); }
  function execute(input = {}) {
    const prepared = prepare(input);
    return Object.freeze({ prepared, acceptance: accept(prepared) });
  }
  function gatewayState() {
    if (destroyed) return Object.freeze({ destroyed, ready: false, branchId: null,
      reasonCode: SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_INVALID,
      allowedCommandTypes: SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES });
    return Object.freeze({ destroyed, ...authorityStatus(current(readCurrentState)),
      allowedCommandTypes: SEQUENTIAL_PREPARATION_ENABLED_COMMAND_TYPES });
  }
  return Object.freeze({
    schema: SEQUENTIAL_DRAFT_EDIT_COMMAND_GATEWAY_SCHEMA,
    getState: gatewayState,
    prepare, accept, execute,
    destroy() { if (destroyed) return false; destroyed = true; service.destroy(); return true; },
  });
}
