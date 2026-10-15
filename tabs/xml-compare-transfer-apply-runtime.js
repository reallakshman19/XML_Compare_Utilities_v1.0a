export const XML_COMPARE_TRANSFER_APPLY_RUNTIME_SCHEMA = 'xml-compare-transfer-apply-runtime/v5-inert-helpers';

const clean = (value) => String(value ?? '').trim();

export function selectedBlocksFromPane(pane = null) {
  const checkboxes = pane?.querySelectorAll?.('input[type="checkbox"][data-xml-compare-transfer-block-checkbox]');
  if (checkboxes && checkboxes.length > 0) {
    const selected = [];
    checkboxes.forEach((cb) => { if (cb.checked) selected.push(clean(cb.dataset.xmlCompareTransferBlockCheckbox)); });
    return selected;
  }
  const source = pane?.querySelector?.('[data-xml-compare-selected-transfer-blocks],select[multiple]');
  if (!source) return [];
  return Array.from(source.options || []).filter((option) => source.dataset?.xmlCompareSelectedTransferBlocks != null || option.selected).map((option) => clean(option.value || option.textContent)).filter(Boolean);
}

export function approvedPairIdsFromPane(pane = null) {
  const ids = [];
  pane?.querySelectorAll?.('[data-xml-compare-transfer-pair]').forEach((input) => {
    if (input.checked && clean(input.dataset.xmlCompareTransferPair)) ids.push(clean(input.dataset.xmlCompareTransferPair));
  });
  return Object.freeze([...new Set(ids)]);
}

export function installXmlCompareTransferApplyRuntime() {
  return false;
}

export const _test = Object.freeze({
  clean,
  selectedBlocksFromPane,
  approvedPairIdsFromPane,
  installXmlCompareTransferApplyRuntime,
});
