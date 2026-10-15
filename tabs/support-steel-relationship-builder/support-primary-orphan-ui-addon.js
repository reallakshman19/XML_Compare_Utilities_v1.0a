import {
  normalizeSupportPrimaryOrphanRecoveryConfig,
  setSupportPrimaryOrphanRecoveryRuntimeConfig,
  SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS,
} from './support-primary-orphan-recovery.js?v=20260929-support-primary-orphan-split-1';

const POPUP_SELECTOR = '[data-ssrb-popup="1"]';
const PANEL_SELECTOR = '[data-ssrb-panel="support-report"]';
const mounted = new WeakSet();
let observer = null;
let activeBuildPopup = null;

export function installSupportPrimaryOrphanUiAddon() {
  const doc = globalThis.document;
  if (!doc || observer) return () => {};
  mountAll(doc);
  observer = new MutationObserver(() => mountAll(doc));
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => {
    observer?.disconnect();
    observer = null;
    releaseBuildLease(activeBuildPopup);
  };
}

function mountAll(doc) {
  for (const popup of doc.querySelectorAll(POPUP_SELECTOR)) mount(popup);
}

function mount(popup) {
  if (mounted.has(popup) && popup.querySelector('[data-ssr-orphan-config]')) return;
  const panel = popup.querySelector(PANEL_SELECTOR);
  if (!panel) return;
  const existing = popup.querySelector('[data-ssr-orphan-config]');
  if (existing) {
    mounted.add(popup);
    if (!activeBuildPopup) syncRuntimeConfig(popup);
    return;
  }

  const card = popup.ownerDocument.createElement('details');
  card.className = 'ssrb-card';
  card.dataset.ssrOrphanConfig = '1';
  card.open = true;
  card.innerHTML = renderOrphanRecoveryConfigCard();
  const typicality = panel.querySelector('[data-ssr-typical-config]');
  if (typicality) typicality.before(card);
  else panel.querySelector('.ssrb-build-grid')?.before(card);

  mounted.add(popup);
  if (!activeBuildPopup) syncRuntimeConfig(popup);
  for (const node of popup.querySelectorAll('[data-ssr-orphan-setting]')) {
    const eventName = node.type === 'checkbox' ? 'change' : 'input';
    node.addEventListener(eventName, () => {
      if (isBuildBusy(popup) || (activeBuildPopup && activeBuildPopup !== popup)) return;
      syncRuntimeConfig(popup);
      invalidateVisibleReport(popup);
    });
  }
  const build = popup.querySelector('[data-ssr-build]');
  if (build) {
    build.addEventListener('click', (event) => acquireBuildLease(popup, event), { capture: true });
    const busyObserver = new MutationObserver(() => syncBusyState(popup));
    busyObserver.observe(build, { attributes: true, attributeFilter: ['aria-busy', 'disabled'] });
  }
  syncBusyState(popup);

  const hasReadyReport = [...popup.querySelectorAll('[data-ssr-download], [data-ssr-download-xlsx]')]
    .some((node) => !node.disabled);
  if (hasReadyReport) invalidateVisibleReport(popup);
}

export function renderOrphanRecoveryConfigCard() {
  const d = SUPPORT_PRIMARY_ORPHAN_RECOVERY_DEFAULTS;
  return `<summary><b>Conservative orphan recovery</b> ${infoIcon('Second-pass recovery for unresolved/provisional primary-support groups. Normal bore-axis grouping tolerances are not widened.')}</summary><p>Runs after normal grouping and explicit relationship reconciliation. Missing evidence for an enabled gate fails closed.</p><div class="ssrb-input-grid"><div class="ssrb-source-card"><b>Recovery window</b>${checkControl('enabled', 'Enable orphan resolver', d.enabled, 'Turn the second-pass recovery layer on or off.')} ${numberControl('axialMultiplier', 'Axial tolerance multiplier', d.axialMultiplier, 'Multiplier on the normal 4 × Bore axial threshold.')} ${numberControl('lateralMultiplier', 'Lateral tolerance multiplier', d.lateralMultiplier, 'Multiplier on the normal 0.5 × Bore + 25 mm lateral threshold.')}</div><div class="ssrb-source-card"><b>Compatibility gates</b>${checkControl('requireSameFamily', 'Same PS/SL family', d.requireSameFamily, 'Require exact normalized secondary PS/SL family identity.')} ${checkControl('requireSamePipe', 'Same PIPE', d.requireSamePipe, 'Require exact full line tag / PIPE identity.')} ${checkControl('requireSameBore', 'Same Bore', d.requireSameBore, 'Require equal derived nominal bore.')}<div style="margin-top:.6rem"><b>Require unique target:</b> Always on ${infoIcon('This safety rule is fixed. Multiple qualifying target identities remain ORPHAN_AMBIGUOUS and are not merged.')}</div><div><b>Branch override:</b> guarded ${infoIcon('Different branch/traversal nodes may be overridden only when Same Family, Same PIPE and Same Bore are all enabled and pass, and the target is unique.')}</div></div></div>`;
}

export function readOrphanRecoveryConfig(popup) {
  const values = {};
  for (const node of popup?.querySelectorAll?.('[data-ssr-orphan-setting]') || []) {
    const key = node.dataset.ssrOrphanSetting;
    values[key] = node.type === 'checkbox' ? Boolean(node.checked) : Number(node.value);
  }
  return normalizeSupportPrimaryOrphanRecoveryConfig(values);
}

function syncRuntimeConfig(popup) {
  return setSupportPrimaryOrphanRecoveryRuntimeConfig(readOrphanRecoveryConfig(popup));
}

function acquireBuildLease(popup, event) {
  if (activeBuildPopup && activeBuildPopup !== popup) {
    event?.preventDefault?.();
    event?.stopImmediatePropagation?.();
    return false;
  }
  activeBuildPopup = popup;
  syncRuntimeConfig(popup);
  setOtherPopupLockedState(popup, true);
  return true;
}

function releaseBuildLease(popup) {
  if (!popup || activeBuildPopup !== popup) return;
  activeBuildPopup = null;
  setOtherPopupLockedState(popup, false);
}

function setOtherPopupLockedState(ownerPopup, locked) {
  const doc = ownerPopup?.ownerDocument || globalThis.document;
  for (const popup of doc?.querySelectorAll?.(POPUP_SELECTOR) || []) {
    if (popup === ownerPopup) continue;
    const build = popup.querySelector('[data-ssr-build]');
    if (build) build.disabled = locked || build.getAttribute('aria-busy') === 'true';
    for (const node of popup.querySelectorAll('[data-ssr-orphan-setting]')) {
      node.disabled = locked || isBuildBusy(popup);
    }
  }
}

function syncBusyState(popup) {
  const busy = isBuildBusy(popup);
  const lockedByOtherPopup = Boolean(activeBuildPopup && activeBuildPopup !== popup);
  for (const node of popup.querySelectorAll('[data-ssr-orphan-setting]')) node.disabled = busy || lockedByOtherPopup;
  if (!busy && activeBuildPopup === popup) releaseBuildLease(popup);
}

function isBuildBusy(popup) {
  return popup.querySelector('[data-ssr-build]')?.getAttribute('aria-busy') === 'true';
}

function invalidateVisibleReport(popup) {
  const runState = popup.querySelector('[data-ssr-run-state]');
  if (runState) runState.innerHTML = '<b>Inputs changed</b><span>Orphan recovery configuration changed; rebuild the Support Report.</span>';
  for (const node of popup.querySelectorAll('[data-ssr-copy], [data-ssr-download], [data-ssr-download-xlsx], [data-ssr-download-trace], [data-ssr-download-debug]')) {
    node.disabled = true;
    node.setAttribute('aria-disabled', 'true');
  }
  const host = popup.querySelector('[data-ssr-results]');
  if (host) host.innerHTML = '<div class="ssrb-empty"><b>Support Report needs rebuild</b><br>Orphan recovery configuration changed.</div>';
}

function checkControl(key, label, checked, help) {
  return `<label style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.5rem;align-items:center;margin:.45rem 0"><span>${h(label)} ${infoIcon(help)}</span><input type="checkbox" data-ssr-orphan-setting="${h(key)}"${checked ? ' checked' : ''}></label>`;
}

function numberControl(key, label, value, help) {
  return `<label style="display:grid;grid-template-columns:minmax(0,1fr) auto;gap:.5rem;align-items:center;margin:.45rem 0"><span>${h(label)} ${infoIcon(help)}</span><input type="number" min="0" step="0.1" value="${h(value)}" data-ssr-orphan-setting="${h(key)}" style="width:7rem"></label>`;
}

function infoIcon(help) {
  return `<span role="img" aria-label="Information: ${h(help)}" title="${h(help)}" style="cursor:help;text-decoration:underline dotted">(i)</span>`;
}
function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
}

export const _test = Object.freeze({
  renderOrphanRecoveryConfigCard,
  readOrphanRecoveryConfig,
  acquireBuildLease,
  releaseBuildLease,
});

installSupportPrimaryOrphanUiAddon();