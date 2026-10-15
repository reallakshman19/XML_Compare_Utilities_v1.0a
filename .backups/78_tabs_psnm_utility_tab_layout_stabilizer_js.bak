export const PSNM_UTILITY_LAYOUT_STABILIZER_SCHEMA = 'psnm-utility-layout-stabilizer/v1';

const STYLE_ID = 'psnm-utility-layout-stabilizer-style';
const LAUNCHER_SELECTORS = Object.freeze([
  '[data-psfa-open="1"]',
  '[data-psmap-action="open"]',
  '[data-p3d-open="1"]',
  '[data-ixw-open="1"]',
  '[data-nti-open="1"]',
]);

export function utilityLayoutCss() {
  return `
.psnm-utility-launcher-deck{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin:0 0 12px;padding:10px;border:1px solid rgba(125,211,252,.20);border-radius:14px;background:rgba(2,6,23,.28)}
.psnm-utility-launcher-deck:empty{display:none}.psnm-utility-launcher-card{min-width:0}.psnm-utility-launcher-card>.psmap-card,.psnm-utility-launcher-card button.psmap-card{width:100%;height:100%;box-sizing:border-box}.psnm-utility-launcher-card button.psmap-card{appearance:none;text-align:left}
.psnm-root{min-width:0}.psnm-root .psmap-card,.psnm-root .psnm-card,.psnm-root .psnm-phase-d-card{min-width:0}.psnm-root textarea,.psnm-root input,.psnm-root select{max-width:100%;box-sizing:border-box}.psnm-root .psmap-grid-2{grid-template-columns:repeat(auto-fit,minmax(220px,1fr))}.psnm-root .psmap-actions{align-items:center}.psnm-root .psmap-table-wrap,.psnm-root .psmap-tablewrap{max-width:100%;overflow:auto}
[data-psmap-modal]{max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow:hidden}[data-psmap-modal] .psmap-body{min-height:0;overflow:auto}[data-psmap-modal] .psmap-tabs{display:flex;flex-wrap:wrap;gap:4px}[data-psmap-modal] .psmap-table-wrap,[data-psmap-modal] .psmap-tablewrap{max-width:100%;overflow:auto}
@media(max-width:900px){.psnm-utility-launcher-deck{grid-template-columns:1fr;padding:8px}.psnm-root .psmap-grid-2{grid-template-columns:1fr}[data-psmap-modal]{max-width:calc(100vw - 12px);max-height:calc(100vh - 12px)}}
`;
}

function ensureStyle(doc = globalThis.document) {
  if (!doc || doc.getElementById(STYLE_ID)) return null;
  const style = doc.createElement('style');
  style.id = STYLE_ID;
  style.textContent = utilityLayoutCss();
  doc.head?.appendChild(style);
  return style;
}

function directChildOf(root, node) {
  let current = node;
  while (current?.parentElement && current.parentElement !== root) current = current.parentElement;
  return current?.parentElement === root ? current : null;
}

function launcherChildNodes(root) {
  const result = [];
  for (const selector of LAUNCHER_SELECTORS) {
    for (const button of root.querySelectorAll(selector)) {
      if (button.closest('[data-psnm-utility-launcher-deck]')) continue;
      if (button.closest('[role="dialog"], [data-psmap-modal], .ps-family-clash-audit-backdrop')) continue;
      const child = directChildOf(root, button);
      if (child && !result.includes(child)) result.push(child);
    }
  }
  return result;
}

function ensureDeck(root) {
  let deck = root.querySelector(':scope > [data-psnm-utility-launcher-deck]');
  if (deck) return deck;
  deck = root.ownerDocument.createElement('div');
  deck.className = 'psnm-utility-launcher-deck';
  deck.dataset.psnmUtilityLauncherDeck = '1';
  deck.setAttribute('aria-label', 'Utility launchers');
  root.prepend(deck);
  return deck;
}

function syncLauncherDeck(root) {
  const deck = ensureDeck(root);
  for (const child of launcherChildNodes(root)) {
    if (child === deck || child.contains(deck)) continue;
    child.classList.add('psnm-utility-launcher-card');
    deck.appendChild(child);
  }
}

export function installPsnmUtilityLayoutStabilizer(container) {
  const doc = container?.ownerDocument || globalThis.document;
  ensureStyle(doc);
  const root = container?.querySelector?.('.psnm-root') || container;
  if (!root) return null;
  syncLauncherDeck(root);
  const observer = new MutationObserver(() => syncLauncherDeck(root));
  observer.observe(root, { childList: true, subtree: true });
  return () => observer.disconnect();
}

export const _test = Object.freeze({ utilityLayoutCss, directChildOf });
