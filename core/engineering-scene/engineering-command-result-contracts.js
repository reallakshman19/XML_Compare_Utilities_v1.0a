import { freezeJsonValue } from './engineering-json-value.js';
import { assertEngineeringRevisionToken } from './engineering-revision-contracts.js';

export const ENGINEERING_COMMAND_RESULT_SCHEMA = 'EngineeringCommandResult.v1';
export const ENGINEERING_COMMAND_STATUS = Object.freeze({
  COMMITTED: 'committed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
});

function requiredText(value, label) {
  const result = String(value ?? '').trim();
  if (!result) throw new TypeError(`${label} is required.`);
  return result;
}

export function createEngineeringCommandResult(input = {}) {
  const status = input.status;
  if (!Object.values(ENGINEERING_COMMAND_STATUS).includes(status)) {
    throw new TypeError(`Unsupported command status "${status}".`);
  }
  if (status === 'committed') assertEngineeringRevisionToken(input.resultingRevision, 'resultingRevision');
  if (status === 'rejected') {
    requiredText(input.code, 'Rejected command code');
    requiredText(input.message, 'Rejected command message');
  }
  return freezeJsonValue({
    schema: ENGINEERING_COMMAND_RESULT_SCHEMA,
    operationId: requiredText(input.operationId, 'operationId'),
    status,
    resultingRevision: input.resultingRevision ?? null,
    code: input.code == null ? null : String(input.code),
    message: input.message == null ? null : String(input.message),
    commandReason: input.commandReason == null ? null : String(input.commandReason),
    data: input.data ?? {},
  });
}
