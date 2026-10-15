const BUILD_TOKEN = 'standalone-20260903-ciiw-ms-compare-action-refresh-1';
let retrySequence = 0;

const LAYOUT_MODULE = './psnm-utility-tab-layout-stabilizer.js';

const PRELOAD_MODULES = Object.freeze([
  './psnm-utility/psnm-ui-p2-enhancements.js',
  './psnm-utility/psnm-phase4c-hardening.js',
  './psnm-utility/psnm-phase4d-persistence.js',
  './psnm-utility/psnm-context-actions.js',
  './psnm-utility/psnm-lite-persistence-transform-preview.js',
  './ps-mapping-utility/ps-mapping-mandatory-audit-shim.js',
]);

const INSTALLERS = Object.freeze([
  ['PSNM core utility', './psnm-utility-tab-coordinate-audit-ui.js', 'renderPSNM_UtilityTab', true],
  ['Axis auto-anchor', './psnm-utility/psnm-axis-auto-anchor-addon.js', 'installPsnmAxisAutoAnchorAddon', true],
  ['Anchor persistence', './psnm-utility/psnm-anchor-persistence-addon.js', 'installPsnmAnchorPersistenceAddon', true],
  ['PS mapping', './ps-mapping-utility-tab-support-prefix-ui.js', 'installPsMappingUtilityTile', true],
  ['Support steel relationship builder', './support-steel-relationship-builder/support-steel-relationship-tab.js', 'installSupportSteelRelationshipBuilderTile', true],
  ['PS family clash audit', './ps-family-clash-audit/ps-family-clash-audit-tab.js', 'installPsFamilyClashAuditTile', true],
  ['Pipeline 3D Model', './pipeline-3d-model/pipeline-3d-model-tab.js', 'installPipeline3dModelTile', true],
  ['Pipeline table paste', './pipeline-3d-model/pipeline-3d-model-table-paste-addon.js', 'installPipeline3dTablePasteAddon', false],
  ['Input XML workspace', './inputxml-workspace/inputxml-workspace-tab.js', 'installInputXmlWorkspaceTile', true],
  ['XML builder', './xml-builder/xml-builder-utility-tile.js', 'installXmlBuilderUtilityTile', true],
  ['Navis tag isonote', './navis-tag-isonote/navis-tag-isonote-tab.js', 'installNavisTagIsonoteUtilityTile', true],
  ['Topology trace validator', './topology-trace-validator/topology-trace-validator-tab.js', 'installTopologyTraceValidatorTile', true],
  ['Sequential sketcher', './sequential-sketcher/sequential-sketcher-tab.js', 'installSequentialSketcherTile', true],
  ['Revision compare', './revision-compare/revision-compare-tab.js', 'installRevisionCompareTile', true],
  ['CSV Rev Compare (XML Based)', './csv-rev-compare/csv-rev-compare-tab.js', 'installCsvRevCompareTile', true],
  ['CII Workspace', './cii-workspace/cii-workspace-tab.js', 'installCiiWorkspaceTile', true],
  ['PS mapping modal bridge', './ps-mapping-utility/ps-mapping-modal-bridge.js', 'installPsMappingModalBridge', true],
]);

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function moduleUrl(specifier, forceFresh = false) {
  const url = new URL(specifier, import.meta.url);
  url.searchParams.set('v', BUILD_TOKEN);
  if (forceFresh) url.searchParams.set('retry', `${Date.now()}-${retrySequence += 1}`);
  return url.href;
}

async function importWithRetry(specifier, forceFresh = false) {
  if (forceFresh) return import(moduleUrl(specifier, true));
  try { return await import(moduleUrl(specifier)); }
  catch (firstError) {
    try { return await import(moduleUrl(specifier, true)); }
    catch (retryError) {
      throw new AggregateError([firstError, retryError], `Module ${specifier} failed after a cache-bypass retry.`);
    }
  }
}

function destroyMounted(runtime) {
  while (runtime.destroyers.length) {
    const destroy = runtime.destroyers.pop();
    try { destroy?.(); } catch (error) { console.warn('Utilities cleanup failed', error); }
  }
}

function addDestroy(runtime, destroy) {
  if (typeof destroy !== 'function') return;
  if (runtime.disposed) destroy();
  else runtime.destroyers.push(destroy);
}

function failureMessage(reason) {
  return String(reason?.message || reason || 'Unknown module failure');
}

function renderWarnings(deckRoot, failures) {
  deckRoot.querySelector('[data-psnm-module-warning]')?.remove();
  if (!failures.length) return;
  const warning = document.createElement('section');
  warning.className = 'psmap-card';
  warning.setAttribute('data-psnm-module-warning', '1');
  warning.innerHTML = `<div class="psmap-card-head"><b>Utilities loaded with limited modules</b></div>
<div class="psmap-card-body"><p>${failures.length} optional module(s) could not be loaded. Other utilities remain available.</p>
<ul>${failures.map((failure) => `<li><b>${h(failure.label)}</b>: ${h(failure.message)}</li>`).join('')}</ul></div>`;
  deckRoot.prepend(warning);
}

function renderFatal(container, error, retry) {
  container.innerHTML = `<section class="tab-error" data-psnm-runtime-error="1">
<h2>Could not initialize Utilities</h2>
<p>The required Utilities shell was fetched twice, including one cache-bypass attempt.</p>
<pre>${h(error?.message || error)}</pre>
<button type="button" data-psnm-runtime-retry="1">Retry Utilities</button>
</section>`;
  container.querySelector('[data-psnm-runtime-retry="1"]')?.addEventListener('click', retry, { once: true });
}

async function loadOptionalModules(forceFresh) {
  const preloads = await Promise.allSettled(PRELOAD_MODULES.map((specifier) => importWithRetry(specifier, forceFresh)));
  const installers = await Promise.allSettled(INSTALLERS.map(async (descriptor) => ({
    descriptor,
    module: await importWithRetry(descriptor[1], forceFresh),
  })));
  return { preloads, installers };
}

function preloadFailures(results) {
  return results.flatMap((result, index) => result.status === 'rejected' ? [{
    label: `Enhancement ${PRELOAD_MODULES[index]}`,
    message: failureMessage(result.reason),
  }] : []);
}

function mountInstallers(deckRoot, ctx, runtime, results) {
  const failures = [];
  results.forEach((result, index) => {
    const descriptor = INSTALLERS[index];
    if (result.status === 'rejected') {
      failures.push({ label: descriptor[0], message: failureMessage(result.reason) });
      return;
    }
    try {
      const installer = result.value.module?.[descriptor[2]];
      if (typeof installer !== 'function') throw new Error(`Missing export ${descriptor[2]}`);
      const destroy = descriptor[3] ? installer(deckRoot, ctx) : installer(deckRoot);
      addDestroy(runtime, destroy);
    } catch (error) {
      failures.push({ label: descriptor[0], message: failureMessage(error) });
    }
  });
  return failures;
}

async function mountUtilities(container, ctx, runtime, generation, forceFresh) {
  const optionalPromise = loadOptionalModules(forceFresh);
  const layoutResult = await Promise.allSettled([importWithRetry(LAYOUT_MODULE, forceFresh)]);
  if (runtime.disposed || generation !== runtime.generation) return;

  container.innerHTML = '';
  const layoutModule = layoutResult[0].status === 'fulfilled' ? layoutResult[0].value : null;
  const layoutInstaller = layoutModule?.installPsnmUtilityLayoutStabilizer;
  const deckRoot = typeof layoutInstaller === 'function' ? layoutInstaller(container, ctx) : container;
  const failures = layoutResult[0].status === 'rejected' ? [{
    label: 'Utilities layout',
    message: failureMessage(layoutResult[0].reason),
  }] : [];

  const optional = await optionalPromise;
  if (runtime.disposed || generation !== runtime.generation) return;
  failures.push(
    ...preloadFailures(optional.preloads),
    ...mountInstallers(deckRoot, ctx, runtime, optional.installers),
  );
  renderWarnings(deckRoot, failures);
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  const runtime = { disposed: false, destroyers: [], generation: 0 };

  const start = (forceFresh = false) => {
    runtime.generation += 1;
    const generation = runtime.generation;
    destroyMounted(runtime);
    container.innerHTML = '<div class="tab-loading">Loading Utilities modules...</div>';
    mountUtilities(container, ctx, runtime, generation, forceFresh).catch((error) => {
      if (runtime.disposed || generation !== runtime.generation) return;
      renderFatal(container, error, () => start(true));
    });
  };

  start();
  return () => {
    runtime.disposed = true;
    runtime.generation += 1;
    destroyMounted(runtime);
    container.innerHTML = '';
  };
}

export default renderPSNM_UtilityTab;
export const _test = Object.freeze({ moduleUrl, preloadFailures });
