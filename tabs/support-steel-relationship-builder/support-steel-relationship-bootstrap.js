import { installSupportSteelRelationshipBuilderTile } from './support-steel-relationship-tab.js?v=20260717-startup-parse-hotfix-1';
import './support-restraint-function-addon.js?v=20260717-startup-parse-hotfix-1';
import './support-report-addon.js?v=20260915-support-primary-hardening-1&trace=20260910-support-report-json-trace-18&rca=20260910-bore-site-zone-19&typicalityui=20260911-config-visible-1&pos=20260911-support-report-pos-trace-20&debug=20260911-support-report-trace-export-21&location=20260915-support-report-bore-axis-occurrence-1&prev=20260911-prevname-semantic-22&datum=20260911-datum-metadata-23&perf=20260913-support-report-large-xml-1&orphan=20260915-support-primary-hardening-1&relationshipTopology=20260915-relationship-topology-1&axisTypicality=20260915-axis-typicality-1&referenceRelationship=20260915-reference-relationship-1&column22Publication=20260915-column22-publication-v1&traversalSafety=20260915-support-primary-traversal-safety-1&maintainability=20260929-support-primary-maintainability-1';
import './support-primary-orphan-ui-addon.js?v=20260929-support-primary-maintainability-1';

const ROOT_SELECTOR = '.psnm-root';
const LAUNCHER_VERSION = 'restraint-function-1';
const installedRoots = new WeakSet();
let observer = null;

export function mountSupportSteelRelationshipBuilder() {
  const doc = globalThis.document;
  if (!doc) return 0;
  let mounted = 0;
  for (const root of doc.querySelectorAll(ROOT_SELECTOR)) {
    const existing = root.querySelector('[data-ssrb-open="1"]');
    const current = existing?.dataset?.ssrbVersion === LAUNCHER_VERSION;
    if (installedRoots.has(root) && current) continue;
    if (existing && !current) existing.remove();
    if (!root.querySelector('[data-ssrb-open="1"]')) {
      const deck = root.querySelector('[data-psnm-utility-launcher-deck]') || root;
      installSupportSteelRelationshipBuilderTile(deck, {});
      const currentLauncher = root.querySelector('[data-ssrb-open="1"]');
      if (currentLauncher) currentLauncher.dataset.ssrbVersion = LAUNCHER_VERSION;
      mounted += 1;
    }
    installedRoots.add(root);
  }
  return mounted;
}

export function installSupportSteelRelationshipBootstrap() {
  const doc = globalThis.document;
  if (!doc || observer) return () => {};
  mountSupportSteelRelationshipBuilder();
  observer = new MutationObserver(() => mountSupportSteelRelationshipBuilder());
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => { observer?.disconnect(); observer = null; };
}

installSupportSteelRelationshipBootstrap();