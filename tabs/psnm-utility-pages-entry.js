const BUILD_TOKEN = 'standalone-20260903-ciiw-ms-compare-action-refresh-1';
let retrySequence = 0;

function h(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));
}

function actualModuleUrl(forceFresh = false) {
  const url = new URL('./psnm-utility-tab.js', import.meta.url);
  url.searchParams.set('v', BUILD_TOKEN);
  if (forceFresh) url.searchParams.set('retry', `${Date.now()}-${retrySequence += 1}`);
  return url.href;
}

async function importActualModule(forceFresh = false) {
  if (forceFresh) return import(actualModuleUrl(true));
  try { return await import(actualModuleUrl()); }
  catch (firstError) {
    try { return await import(actualModuleUrl(true)); }
    catch (retryError) {
      throw new AggregateError([firstError, retryError], 'Utilities module failed after a cache-bypass retry.');
    }
  }
}

function renderEntryError(container, error, retry) {
  container.innerHTML = `<section class="tab-error" data-psnm-pages-entry-error="1">
<h2>Could not load Utilities</h2>
<p>The Utilities entry was fetched twice, including one cache-bypass attempt.</p>
<pre>${h(error?.message || error)}</pre>
<button type="button" data-psnm-pages-entry-retry="1">Retry Utilities</button>
</section>`;
  container.querySelector('[data-psnm-pages-entry-retry="1"]')?.addEventListener('click', retry, { once: true });
}

export function renderPSNM_UtilityTab(container, ctx = {}) {
  let disposed = false;
  let innerDestroy = null;
  let generation = 0;

  const mount = async (forceFresh = false) => {
    const current = generation += 1;
    innerDestroy?.();
    innerDestroy = null;
    container.innerHTML = '<div class="tab-loading">Loading Utilities...</div>';
    try {
      const module = await importActualModule(forceFresh);
      if (disposed || current !== generation) return;
      container.innerHTML = '';
      innerDestroy = module.renderPSNM_UtilityTab(container, ctx);
    } catch (error) {
      if (disposed || current !== generation) return;
      renderEntryError(container, error, () => mount(true));
    }
  };

  mount();
  return () => {
    disposed = true;
    generation += 1;
    innerDestroy?.();
    container.innerHTML = '';
  };
}

export default renderPSNM_UtilityTab;
export const _test = Object.freeze({ actualModuleUrl });
