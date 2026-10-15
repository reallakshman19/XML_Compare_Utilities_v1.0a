import {
  supportRestraintAssessmentsToCsv,
  supportRestraintDirectionsToCsv,
  supportRestraintExceptionsToCsv,
  supportRestraintFamiliesToCsv,
} from '../support-steel-relationship-builder/support-restraint-function-export.js';
import { saveZipTextFiles } from './ps-family-clash-audit-save.js';

const POPUP_SELECTOR = '[data-psfa-popup="1"]';
const mounted = new WeakSet();
let observer = null;

export function installPsFamilyRestraintFunctionAddon() {
  const doc = globalThis.document;
  if (!doc || observer) return () => {};
  mountAll(doc);
  observer = new MutationObserver(() => mountAll(doc));
  observer.observe(doc.documentElement, { childList: true, subtree: true });
  return () => { observer?.disconnect(); observer = null; };
}

function mountAll(doc) {
  for (const popup of doc.querySelectorAll(POPUP_SELECTOR)) mount(popup);
}

function mount(popup) {
  if (mounted.has(popup)) return;
  const actions = popup.querySelector('.psfa-native-export-actions');
  if (!actions) return;
  mounted.add(popup);
  for (const key of ['native-restraint-direction-tolerance', 'native-vertical-pipe-threshold']) {
    popup.querySelector(`[data-psfa="${key}"]`)?.closest('label')?.remove();
  }
  const button = popup.ownerDocument.createElement('button');
  button.type = 'button';
  button.dataset.psfa = 'native-download-restraint-package';
  button.textContent = 'Download Restraint Evidence';
  actions.appendChild(button);
  button.addEventListener('click', () => download(popup));
}

function download(popup) {
  const text = popup.querySelector('[data-psfa="bundle"]')?.value || '';
  if (!text.trim()) return;
  let bundle;
  try { bundle = JSON.parse(text); } catch { return; }
  const restraint = bundle.supportRestraintFunction || {};
  saveZipTextFiles('support-restraint-function-evidence.zip', [
    { name: 'restraint-function.json', text: `${JSON.stringify(restraint, null, 2)}\n` },
    { name: 'restraint-assessments.csv', text: supportRestraintAssessmentsToCsv(bundle) },
    { name: 'restraint-directions.csv', text: supportRestraintDirectionsToCsv(bundle) },
    { name: 'restraint-exceptions.csv', text: supportRestraintExceptionsToCsv(bundle) },
    { name: 'restraint-families.csv', text: supportRestraintFamiliesToCsv(bundle) },
  ]);
}

installPsFamilyRestraintFunctionAddon();
