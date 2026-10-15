function normalizeIds(ids) {
  if (!Array.isArray(ids)) throw new TypeError('Engineering SVG selection must be an array.');
  const normalized = ids.map((id) => String(id || '').trim());
  if (normalized.some((id) => !id)) throw new TypeError('Engineering SVG selection IDs cannot be empty.');
  return [...new Set(normalized)];
}

export function createEngineeringSvgSelection(initialIds = []) {
  let selectedIds = normalizeIds(initialIds);
  let disposed = false;
  const listeners = new Set();

  function publish(reason) {
    const detail = Object.freeze({ selectedIds: Object.freeze([...selectedIds]), reason });
    listeners.forEach((listener) => listener(detail));
    return detail.selectedIds;
  }

  return Object.freeze({
    getSelection: () => Object.freeze([...selectedIds]),
    setSelection(ids, reason = 'replace') {
      if (disposed) throw new Error('Engineering SVG selection is disposed.');
      selectedIds = normalizeIds(ids);
      return publish(String(reason));
    },
    toggle(id) {
      const value = String(id || '').trim();
      if (!value) throw new TypeError('Selection toggle requires an entity ID.');
      const next = new Set(selectedIds);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      selectedIds = [...next];
      return publish('toggle');
    },
    clear(reason = 'clear') {
      selectedIds = [];
      return publish(String(reason));
    },
    subscribe(listener) {
      if (typeof listener !== 'function') throw new TypeError('Selection listener must be a function.');
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    listenerCount: () => listeners.size,
    dispose() {
      if (disposed) return false;
      disposed = true;
      listeners.clear();
      selectedIds = [];
      return true;
    },
  });
}
