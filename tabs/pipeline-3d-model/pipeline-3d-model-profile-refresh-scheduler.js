function frameRequest(options) {
  if (typeof options.requestFrame === 'function') return options.requestFrame;
  return typeof globalThis.requestAnimationFrame === 'function'
    ? globalThis.requestAnimationFrame.bind(globalThis) : null;
}

function frameCancel(options) {
  if (typeof options.cancelFrame === 'function') return options.cancelFrame;
  return typeof globalThis.cancelAnimationFrame === 'function'
    ? globalThis.cancelAnimationFrame.bind(globalThis) : null;
}

export function createPipelineProfileRefreshScheduler(run, options = {}) {
  if (typeof run !== 'function') throw new TypeError('Profile refresh scheduler requires a runner.');
  const request = frameRequest(options), cancelFrame = frameCancel(options);
  let pending = false, frameId = null, generation = 0, destroyed = false;
  function execute(expected) {
    if (destroyed || !pending || expected !== generation) return false;
    pending = false; frameId = null; run(); return true;
  }
  function schedule() {
    if (destroyed || pending) return false;
    pending = true; const expected = ++generation;
    if (request) frameId = request(() => execute(expected));
    else queueMicrotask(() => execute(expected));
    return true;
  }
  function cancel() {
    if (!pending) return false;
    const activeFrame = frameId;
    pending = false; frameId = null; generation += 1;
    if (activeFrame != null) cancelFrame?.(activeFrame);
    return true;
  }
  function destroy() {
    destroyed = true;
    return cancel();
  }
  return Object.freeze({ schedule, cancel, destroy, get pending() { return pending; } });
}
