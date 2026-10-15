/**
 * Resolves producer-owned companion topology files after one managed source JSON
 * selection. This module never invokes a topology builder. Canonical and ledger
 * are required; InputXML, scene, parsed graph, parity report, and CII projection
 * evidence are optional for compatibility with older published workpacks.
 */

const COMPANION_KINDS = Object.freeze(['canonical', 'ledger', 'inputXml', 'scene', 'parsed', 'report', 'ciiProjection']);

export class TopologyCompanionLoadError extends Error {
  constructor(sourceFileName, attempts) {
    super(`No companion topology artifacts were found for ${sourceFileName}. Tried: ${attempts.join('; ')}`);
    this.name = 'TopologyCompanionLoadError';
    this.sourceFileName = sourceFileName;
    this.attempts = Object.freeze([...attempts]);
  }
}

export function topologyCompanionFileNames(sourceFileName) {
  const name = String(sourceFileName ?? '').trim();
  if (!/\.json$/i.test(name)) throw new TypeError(`Managed source filename must end with .json: ${name || '(empty)'}.`);
  const stem = name.replace(/\.json$/i, '');
  const names = {
    stem,
    canonical: `${stem}.canonical-topology.json`,
    ledger: `${stem}.topology-trace-ledger.json`,
    inputXml: `${stem}.topology.input.xml`,
    scene: `${stem}.topology-svg-scene.json`,
    parsed: `${stem}.parsed-inputxml-topology.json`,
    report: `${stem}.topology-parity-report.json`,
  };
  Object.defineProperty(names, 'ciiProjection', {
    value: `${stem}.inputxml-cii-projection-ledger.json`,
    enumerable: false,
    writable: false,
    configurable: false,
  });
  return Object.freeze(names);
}

export function topologyCompanionBaseUrls(sourceFileName, pageUrl) {
  const names = topologyCompanionFileNames(sourceFileName);
  const page = new URL(pageUrl);
  const encodedStem = encodeURIComponent(names.stem);
  const configured = page.searchParams.getAll('topologyArtifactBase').map((value) => normalizedBaseUrl(value, page.href));
  const siblingProducer = new URL(`../../../3D_Converters/Benchmarks/${encodedStem}/`, import.meta.url).href;
  const colocatedArtifacts = new URL(`../../topology-artifacts/${encodedStem}/`, import.meta.url).href;
  return Object.freeze([...new Set([...configured, siblingProducer, colocatedArtifacts])]);
}

export async function loadTopologyCompanionSet(sourceFileName, pageUrl, fetchImpl) {
  if (typeof fetchImpl !== 'function') throw new TypeError('A browser fetch function is required for companion artifact loading.');
  const names = topologyCompanionFileNames(sourceFileName), attempts = [];
  for (const baseUrl of topologyCompanionBaseUrls(sourceFileName, pageUrl)) {
    try {
      const canonical = await optionalText(new URL(names.canonical, baseUrl).href, fetchImpl);
      if (!canonical) continue; // If canonical is missing, assume no artifacts exist at this baseUrl to prevent 404 spam
      
      const optional = { canonical };
      for (const kind of ['ledger', 'inputXml', 'scene', 'parsed', 'report', 'ciiProjection']) {
        optional[kind] = await optionalText(new URL(names[kind], baseUrl).href, fetchImpl);
      }
      return Object.freeze({ baseUrl, names, ...optional });
    } catch (error) {
      attempts.push(`${baseUrl} (${error?.message || String(error)})`);
    }
  }
  
  const empty = {};
  for (const kind of COMPANION_KINDS) empty[kind] = null;
  return Object.freeze({ baseUrl: '', names, ...empty });
}

export async function loadTopologySourceFile(controller, file, pageUrl, fetchImpl) {
  if (!file || typeof file.text !== 'function') throw new TypeError('A managed source JSON File is required.');
  await controller.loadArtifact('source', await file.text(), file.name);
  const companions = await loadTopologyCompanionSet(file.name, pageUrl, fetchImpl);
  for (const kind of COMPANION_KINDS) {
    if (companions[kind] === null) continue;
    await controller.loadArtifact(kind, companions[kind], companions.names[kind]);
  }
  return Object.freeze({ companions, validation: controller.validate() });
}

function normalizedBaseUrl(value, pageUrl) {
  const url = new URL(value, pageUrl);
  if (!url.pathname.endsWith('/')) url.pathname = `${url.pathname}/`;
  return url.href;
}

async function requiredText(url, fetchImpl) {
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

async function optionalText(url, fetchImpl) {
  const response = await fetchImpl(url, { cache: 'no-store' });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`${url}: HTTP ${response.status}`);
  return response.text();
}

export const _test = Object.freeze({ normalizedBaseUrl, requiredText, optionalText, COMPANION_KINDS });
