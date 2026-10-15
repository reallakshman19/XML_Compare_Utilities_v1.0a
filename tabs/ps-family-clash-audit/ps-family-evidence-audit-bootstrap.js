import { installPsFamilyClashAuditTile } from './ps-family-clash-audit-tab.js?v=20260716-ps-family-evidence-graph-1';
import './ps-family-offline-validation-addon.js?v=20260716-ps-family-offline-validation-1';
import './ps-family-native-audit-pipeline-addon.js?v=20260717-startup-parse-hotfix-1';
import './ps-family-restraint-function-addon.js?v=20260717-startup-parse-hotfix-1';

const ROOT_SELECTOR = '.psnm-root';
const LAUNCHER_SELECTOR = '[data-psfa-open="1"]';
const VERSION = 'restraint-function-v1';
let observer = null;

export function mountPsFamilyEvidenceAudit() {
  const doc = globalThis.document;
  if (!doc) return 0;
  let mounted = 0;
  for (const root of doc.querySelectorAll(ROOT_SELECTOR)) {
    const launcher = root.querySelector(LAUNCHER_SELECTOR);
    if (launcher?.dataset.psfaVersion === VERSION) continue;
    launcher?.remove();
    const deck = root.querySelector('[data-psnm-utility-launcher-deck]') || root;
    installPsFamilyClashAuditTile(deck, {});
    const current = root.querySelector(LAUNCHER_SELECTOR);
    if (current) {
      current.dataset.psfaVersion = VERSION;
      mounted += 1;
    }
  }
  return mounted;
}

export function installPsFamilyEvidenceAuditBootstrap() {
  const doc = globalThis.document;
  if (!doc || observer) return () => {};
  mountPsFamilyEvidenceAudit();
  observer = new MutationObserver(() => mountPsFamilyEvidenceAudit());
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => { observer?.disconnect(); observer = null; };
}

installPsFamilyEvidenceAuditBootstrap();