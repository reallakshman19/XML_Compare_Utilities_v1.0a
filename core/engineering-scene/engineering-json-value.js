export function isPlainObject(value) {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertPrimitive(value, path) {
  const type = typeof value;
  if (type === 'number' && !Number.isFinite(value)) {
    throw new TypeError(`${path} must be a finite number.`);
  }
  if (['undefined', 'function', 'symbol', 'bigint'].includes(type)) {
    throw new TypeError(`${path} contains unsupported JSON type "${type}".`);
  }
}

function assertObject(value, path, seen) {
  if (seen.has(value)) throw new TypeError(`${path} contains a circular reference.`);
  if (!Array.isArray(value) && !isPlainObject(value)) {
    throw new TypeError(`${path} must contain only arrays and plain objects.`);
  }
  seen.add(value);
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertJsonValue(item, `${path}[${index}]`, seen));
  } else {
    Object.entries(value).forEach(([key, item]) => assertJsonValue(item, `${path}.${key}`, seen));
  }
  seen.delete(value);
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(deepFreeze);
  return Object.freeze(value);
}

export function assertJsonValue(value, path = '$', seen = new Set()) {
  if (value === null) return value;
  assertPrimitive(value, path);
  if (typeof value === 'object') assertObject(value, path, seen);
  return value;
}

export function cloneJsonValue(value) {
  assertJsonValue(value);
  return JSON.parse(JSON.stringify(value));
}

export function freezeJsonValue(value) {
  return deepFreeze(cloneJsonValue(value));
}
