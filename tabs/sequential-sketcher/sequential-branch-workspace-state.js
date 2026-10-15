function text(value) { return String(value ?? '').trim(); }

function frozenSnapshot(snapshot = {}) {
  return Object.freeze({
    session: snapshot.session || null,
    confirmedConstruction: snapshot.confirmedConstruction || null,
    supportProjection: snapshot.supportProjection || null,
    selectedCandidateId: text(snapshot.selectedCandidateId),
  });
}
function normalizedIds(ids = []) {
  return Object.freeze([...new Set(ids.map(text).filter(Boolean))]);
}

export function createSequentialBranchWorkspaceRegistry() {
  let branchIds = Object.freeze([]);
  const snapshots = new Map();

  function assertKnown(branchId) {
    if (!branchIds.includes(branchId)) throw new Error(`Unknown Sequential Sketcher branch: ${branchId}`);
  }
  function replace(ids = [], entries = []) {
    const nextIds = normalizedIds(ids);
    const nextSnapshots = new Map();
    for (const entry of entries || []) {
      const branchId = text(entry?.branchId);
      if (!branchId || !nextIds.includes(branchId) || nextSnapshots.has(branchId)) {
        throw new Error(`Invalid Sequential Sketcher workspace entry: ${branchId || '(missing)'}`);
      }
      nextSnapshots.set(branchId, frozenSnapshot(entry.snapshot));
    }
    branchIds = nextIds;
    snapshots.clear();
    for (const [branchId, snapshot] of nextSnapshots) snapshots.set(branchId, snapshot);
    return Object.freeze({ branchIds, savedCount: snapshots.size });
  }

  return Object.freeze({
    reset(ids = []) {
      return replace(ids, []).branchIds;
    },
    replace,
    save(branchIdValue, snapshot) {
      const branchId = text(branchIdValue);
      if (!branchId) return null;
      assertKnown(branchId);
      const saved = frozenSnapshot(snapshot);
      snapshots.set(branchId, saved);
      return saved;
    },
    open(branchIdValue, createSession) {
      const branchId = text(branchIdValue);
      assertKnown(branchId);
      const cached = snapshots.get(branchId);
      const snapshot = cached || frozenSnapshot({ session: createSession(branchId) });
      if (!cached) snapshots.set(branchId, snapshot);
      return Object.freeze({
        branchId,
        index: branchIds.indexOf(branchId),
        count: branchIds.length,
        restored: Boolean(cached),
        snapshot,
      });
    },
    adjacent(branchIdValue, delta) {
      if (!branchIds.length) return null;
      const branchId = text(branchIdValue);
      const currentIndex = Math.max(0, branchIds.indexOf(branchId));
      const nextIndex = Math.min(branchIds.length - 1, Math.max(0, currentIndex + Math.sign(Number(delta) || 0)));
      return branchIds[nextIndex] || null;
    },
    position(branchIdValue) {
      const index = branchIds.indexOf(text(branchIdValue));
      return Object.freeze({ index, count: branchIds.length });
    },
    status(branchIdValue) {
      const snapshot = snapshots.get(text(branchIdValue));
      return snapshot?.session?.state || 'NOT_OPENED';
    },
    get(branchIdValue) {
      return snapshots.get(text(branchIdValue)) || null;
    },
    entries() {
      return Object.freeze(branchIds
        .filter((branchId) => snapshots.has(branchId))
        .map((branchId) => Object.freeze({ branchId, snapshot: snapshots.get(branchId) })));
    },
    savedCount() { return snapshots.size; },
    ids() { return branchIds; },
  });
}
