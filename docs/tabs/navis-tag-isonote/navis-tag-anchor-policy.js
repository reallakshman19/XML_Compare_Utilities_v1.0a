export const NAVIS_ANCHOR_SLOT_COUNT = 5;

function value(input) {
  return String(input ?? '').trim();
}

export function anchorSlotKeys(slot) {
  const suffix = Number(slot) === 1 ? '' : String(slot);
  return Object.freeze({
    tagKey: `navisAnchorTagId${suffix}`,
    supportKey: `navisAnchorSupportIdentity${suffix}`,
  });
}

export function configuredAnchorSlots(config = {}, includeEmpty = false) {
  const rows = Array.from({ length: NAVIS_ANCHOR_SLOT_COUNT }, (_, index) => {
    const slot = index + 1;
    const keys = anchorSlotKeys(slot);
    const tagId = value(config[keys.tagKey]);
    const supportIdentity = value(config[keys.supportKey]);
    return Object.freeze({
      slot,
      priority: slot,
      role: 'EQUAL_AUTHORITY',
      tagId,
      supportIdentity,
      configured: Boolean(tagId || supportIdentity),
      complete: Boolean(tagId && supportIdentity),
      ...keys,
    });
  });
  return Object.freeze(includeEmpty ? rows : rows.filter((row) => row.configured));
}

export function anchorPriorityLabel(slot) {
  return `Anchor ${Number(slot)}`;
}
