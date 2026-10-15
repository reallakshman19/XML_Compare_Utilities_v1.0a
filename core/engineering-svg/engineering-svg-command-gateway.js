import {
  assertEngineeringRevisionToken,
  createEngineeringCommandResult,
  validateEngineeringCommandResult,
  validateEngineeringEditIntent,
} from '../engineering-scene/index.js';

export const ENGINEERING_SVG_COMMAND_GATEWAY_SCHEMA = 'EngineeringSvgCommandGateway.v1';

function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (value && typeof value === 'object') {
    const entries = Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value);
}

export function engineeringRevisionTokensEqual(left, right) {
  assertEngineeringRevisionToken(left, 'leftRevision');
  assertEngineeringRevisionToken(right, 'rightRevision');
  return canonicalJson(left) === canonicalJson(right);
}

function rejected(intent, code, message, data = {}) {
  return createEngineeringCommandResult({
    operationId: intent.operationId,
    status: 'rejected',
    code,
    message,
    data,
  });
}

export function createEngineeringSvgCommandGateway(options = {}) {
  if (typeof options.getCurrentRevision !== 'function' || typeof options.execute !== 'function') {
    throw new TypeError('Engineering SVG command gateway requires getCurrentRevision and execute functions.');
  }
  const inFlight = new Set();

  async function execute(intentValue) {
    const intent = validateEngineeringEditIntent(intentValue);
    const currentRevision = assertEngineeringRevisionToken(
      await options.getCurrentRevision(),
      'currentRevision',
    );
    if (!engineeringRevisionTokensEqual(intent.baseRevision, currentRevision)) {
      return rejected(intent, 'STALE_BASE_REVISION', 'The authoritative revision changed before the edit committed.', { currentRevision });
    }
    if (inFlight.has(intent.operationId)) {
      return rejected(intent, 'DUPLICATE_OPERATION_ID', 'The edit operation is already in progress.');
    }
    inFlight.add(intent.operationId);
    try {
      const result = validateEngineeringCommandResult(await options.execute(intent));
      if (result.operationId !== intent.operationId) throw new Error('Command result operationId does not match its intent.');
      return result;
    } finally {
      inFlight.delete(intent.operationId);
    }
  }

  return Object.freeze({
    schema: ENGINEERING_SVG_COMMAND_GATEWAY_SCHEMA,
    execute,
    inFlightCount: () => inFlight.size,
  });
}
