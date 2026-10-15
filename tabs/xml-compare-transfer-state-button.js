export const TRANSFER_STATE_BUTTON_SELECTOR = '[data-xml-compare-transfer-state-action]';

const clean = (value) => String(value ?? '').trim();

export function transferStateActionFromButton(button = null) {
  const type = clean(button?.dataset?.xmlCompareTransferStateAction);
  const scope = clean(button?.dataset?.xmlCompareTransferScope) || 'node';
  return Object.freeze({ type, scope });
}

export function selectedTransferBlocksFromState(state = {}, detail = {}) {
  const blocks = state.aim?.transferBlocks;
  if (Array.isArray(blocks) && blocks.length) return blocks;
  return Array.isArray(detail.selectedBlocks) && detail.selectedBlocks.length ? detail.selectedBlocks : undefined;
}

export const _test = Object.freeze({ clean });
