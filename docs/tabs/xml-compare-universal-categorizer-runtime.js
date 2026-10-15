import {
  UNIVERSAL_XML_CATEGORIZER_BUTTON_ATTR,
  UNIVERSAL_XML_CATEGORIZER_POPUP_ATTR,
} from '../xml-compare/universal-categorizer/universal-xml-categorizer-shell.js';
import {
  createUniversalViewportContext,
  readUniversalViewportContext,
} from '../xml-compare/universal-categorizer/universal-viewport-context.js';
import { mountUniversalViewportLifecycle } from '../xml-compare/universal-categorizer/universal-viewport-lifecycle.js';

export const XML_COMPARE_UNIVERSAL_CATEGORIZER_RUNTIME_SCHEMA = 'xml-compare-universal-categorizer-runtime/v2';

const INSTALLERS = new WeakMap();
const LIFECYCLES = new WeakMap();

export function openUniversalXmlCategorizer(options = {}) {
  const doc = options.document || globalThis.document;
  if (!doc?.body) return null;
  closeUniversalXmlCategorizer(doc);
  const context = options.context || readUniversalViewportContext(doc)
    || createUniversalViewportContext({});
  const lifecycle = mountUniversalViewportLifecycle({
    document: doc,
    context,
    storage: options.storage,
  });
  LIFECYCLES.set(doc, lifecycle);
  return lifecycle;
}

export function closeUniversalXmlCategorizer(doc = globalThis.document) {
  const lifecycle = LIFECYCLES.get(doc);
  if (lifecycle) {
    LIFECYCLES.delete(doc);
    return lifecycle.destroy();
  }
  const popup = doc?.querySelector?.(`[${UNIVERSAL_XML_CATEGORIZER_POPUP_ATTR}]`);
  popup?.remove?.();
  return Boolean(popup);
}

export function getUniversalXmlCategorizerLifecycle(doc = globalThis.document) {
  return LIFECYCLES.get(doc) || null;
}

export function universalXmlCategorizerActionFromTarget(target) {
  if (!target?.closest) return '';
  if (target.closest(`[${UNIVERSAL_XML_CATEGORIZER_BUTTON_ATTR}]`)) return 'open';
  if (target.closest('[data-universal-categorizer-close]')) return 'close';
  if (target.matches?.(`[${UNIVERSAL_XML_CATEGORIZER_POPUP_ATTR}]`)) return 'close';
  return '';
}

export function installUniversalXmlCategorizerRuntime(doc = globalThis.document) {
  if (!doc?.addEventListener) return null;
  if (INSTALLERS.has(doc)) return INSTALLERS.get(doc);
  const onClick = (event) => {
    const action = universalXmlCategorizerActionFromTarget(event.target);
    if (action === 'open') openUniversalXmlCategorizer({ document: doc });
    if (action === 'close') closeUniversalXmlCategorizer(doc);
  };
  doc.addEventListener('click', onClick, true);
  const installer = Object.freeze({
    schema: XML_COMPARE_UNIVERSAL_CATEGORIZER_RUNTIME_SCHEMA,
    destroy() {
      doc.removeEventListener('click', onClick, true);
      closeUniversalXmlCategorizer(doc);
      INSTALLERS.delete(doc);
      return true;
    },
  });
  INSTALLERS.set(doc, installer);
  return installer;
}

