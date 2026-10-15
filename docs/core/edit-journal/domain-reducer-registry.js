/** Immutable command-type to domain-reducer bindings for edit-journal replay. */

function normalizeCommandType(value) {
  const commandType = String(value ?? '').trim().toUpperCase();
  if (!commandType) throw new TypeError('Command type must be a non-empty string.');
  return commandType;
}

function compareText(left, right) {
  if (left === right) return 0;
  return left < right ? -1 : 1;
}

function registryEntries(bindings) {
  if (!bindings || typeof bindings !== 'object' || Array.isArray(bindings)) {
    throw new TypeError('Domain reducer bindings must be an object.');
  }
  const entries = [], seen = new Set();
  for (const [rawType, reducer] of Object.entries(bindings)) {
    const commandType = normalizeCommandType(rawType);
    if (seen.has(commandType)) throw new TypeError(`Duplicate command type ${commandType}.`);
    if (typeof reducer !== 'function') throw new TypeError(`Reducer for ${commandType} must be a function.`);
    seen.add(commandType); entries.push([commandType, reducer]);
  }
  return entries.sort(([left], [right]) => compareText(left, right));
}

function contextualReducerError(error, envelope) {
  const detail = error instanceof Error ? error.message : String(error);
  const message = `Command ${envelope.commandId} (${envelope.commandType}) failed: ${detail}`;
  if (error instanceof RangeError) return new RangeError(message, { cause: error });
  if (error instanceof TypeError) return new TypeError(message, { cause: error });
  return new Error(message, { cause: error });
}

/** Create one deterministic immutable reducer registry. */
export function createDomainReducerRegistry(bindings) {
  const entries = registryEntries(bindings), reducers = new Map(entries);
  const commandTypes = Object.freeze(entries.map(([commandType]) => commandType));
  const getReducer = (value) => {
    const commandType = normalizeCommandType(value);
    const reducer = reducers.get(commandType);
    if (!reducer) throw new RangeError(`Unknown command type ${commandType}.`);
    return reducer;
  };
  const reduce = (state, envelope) => {
    try { return getReducer(envelope?.commandType)(state, envelope); }
    catch (error) { throw contextualReducerError(error, envelope ?? {}); }
  };
  return Object.freeze({
    commandTypes,
    has: (value) => reducers.has(normalizeCommandType(value)),
    getReducer,
    reduce,
  });
}
