const CATALOG_BLOCKER_TOKEN = 'APPROVED_CATALOG';

function text(value) {
  return String(value ?? '').trim();
}

function bindingCount(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

function blockerCodes(value) {
  return Array.isArray(value) ? value.map(text).filter(Boolean) : [];
}

function approvedCatalogBlockers(output) {
  const sources = [
    output?.orchestration?.blockerCodes,
    output?.exportQualification?.blockerCodes,
    output?.inputXmlDocumentPlan?.blockerCodes,
  ];
  return [...new Set(sources.flatMap(blockerCodes)
    .filter((code) => code.includes(CATALOG_BLOCKER_TOKEN)))];
}

function statusLabel(state, reference, count) {
  if (state === 'INACTIVE') return 'Approved catalog: inactive';
  const identity = reference || 'approved registry';
  const bindingLabel = `${count} binding${count === 1 ? '' : 's'}`;
  return `Approved catalog: ${identity} — ${state === 'READY' ? 'adopted' : 'blocked'} — ${bindingLabel}`;
}

export function resolvePipelineApprovedCatalogStatus(output = {}) {
  const diagnostics = output?.diagnostics || {};
  const active = diagnostics.approvedCatalogAdoptionActive === true;
  const ready = active && diagnostics.approvedCatalogAdoptionReady === true;
  const state = active ? (ready ? 'READY' : 'BLOCKED') : 'INACTIVE';
  const registryReference = text(diagnostics.approvedCatalogRegistryReference) || null;
  const count = bindingCount(diagnostics.approvedCatalogBindingCount);
  const blockers = Object.freeze(approvedCatalogBlockers(output));
  return Object.freeze({
    state,
    registryReference,
    bindingCount: count,
    blockerCodes: blockers,
    label: statusLabel(state, registryReference, count),
  });
}

function ensureStatusElement(dialog) {
  if (!dialog?.querySelector || !dialog?.ownerDocument) return null;
  let element = dialog.querySelector('[data-p3d-approved-catalog-status]');
  if (element) return element;
  element = dialog.ownerDocument.createElement('p');
  element.dataset.p3dApprovedCatalogStatus = 'true';
  element.className = 'p3d-approved-catalog-status';
  const anchor = dialog.querySelector('[data-p3d="xml-output"]');
  if (anchor?.parentElement) anchor.parentElement.insertBefore(element, anchor);
  else dialog.appendChild(element);
  return element;
}

export function renderPipelineApprovedCatalogStatus(dialog, output) {
  const status = resolvePipelineApprovedCatalogStatus(output);
  const element = ensureStatusElement(dialog);
  if (!element) return status;
  element.dataset.state = status.state;
  element.textContent = status.label;
  element.title = status.blockerCodes.join(', ');
  return status;
}
