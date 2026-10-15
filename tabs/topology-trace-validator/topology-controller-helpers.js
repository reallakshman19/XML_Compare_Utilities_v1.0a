import { cleanText, objectRecord, asArray, semanticHash } from './topology-validator-values.js';
import { enrichInputXmlDocument } from '../xml-cii-2019-standalone/xml-cii-inputxml-enrichment.js';

export function artifactHash(kind, artifact) {
  if (kind === 'inputXml') return semanticHash(objectRecord(artifact).rawText);
  return semanticHash(objectRecord(artifact).raw);
}

export function escapeHtml(value) {
  return cleanText(value).replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
}

export function escapeAttribute(value) {
  return escapeHtml(value);
}

export function shortText(value, length) {
  const text = cleanText(value);
  return text.length > length ? `${text.slice(0, length - 1)}…` : text;
}

export function emptyNavigation() {
  return Object.freeze({ fit: () => {}, zoomIn: () => {}, zoomOut: () => {}, destroy: () => {} });
}

/**
 * Build a side-load line for one XML element using the best available payload.
 * Primary: enrichedAttributes set by the Master File Enrichment Workbench.
 * Fallback: raw PDMS attributes and the component's real source identity.
 * This guarantees export works even when the Workbench was not run.
 * @param {Record<string,unknown>} element - InputXML element record.
 * @param {Record<string,unknown>} component - Managed source component and optional enrichment.
 * @returns {string[]}
 */
function buildSideLoadLines(element, component) {
  const enriched = objectRecord(component.enrichedAttributes);
  const attrs = objectRecord(component.attributes);
  const lines = [];
  const from = cleanText(element.fromNode);
  const to   = cleanText(element.toNode);
  if (!from && !to) return lines;
  lines.push(`ELEMENT ${from}->${to}`);

  // Piping class — workbench wins, then raw SPRE
  const pipingClass = cleanText(enriched.pipingClass || attrs.SPRE || attrs.PIPCLASS || '');
  if (pipingClass) lines.push(`<PipingClass>${pipingClass}</PipingClass>`);

  // Rating — workbench wins, then raw RATING/SPRE
  const rating = cleanText(enriched.pressureRating || attrs.RATING || attrs.SPRE || '');
  if (rating) lines.push(`<Rating>${rating}</Rating>`);

  const diameter = finiteOrNull(enriched.pipeOdMm ?? attrs.OD ?? attrs.DIAMETER);
  const rawWall = finiteOrNull(attrs.WTHK ?? attrs.WTXX ?? attrs.WALL_THICK);
  const enrichedWall = finiteOrNull(enriched.wallThicknessMm);
  const wall = rawWall ?? (diameter && enrichedWall && enrichedWall * 2 < diameter ? enrichedWall : null);
  const insulation = finiteOrNull(attrs.INSU ?? enriched.insulationThicknessMm);
  const corrosion = finiteOrNull(attrs.CORRA ?? attrs.CORR ?? enriched.corrosionAllowanceMm);
  const lineId = cleanText(enriched.lineNo || component.sourceBranch || attrs.OWNER || '');
  const materialNumber = finiteOrNull(enriched.materialCode ?? attrs.MESC);
  const materialName = cleanText(enriched.material || attrs.MTXX || attrs.MESC || '');
  const materialDensity = densityForInputXml(enriched.materialDensityKgM3 ?? attrs.MDEN);
  const insulationDensity = densityForInputXml(enriched.insulationDensityKgM3 ?? attrs.IDEN);
  const fluidDensity = densityForInputXml(enriched.fluidDensityOpeKgM3 ?? attrs.FDENSITY ?? attrs.FLDEN);
  pushAttribute(lines, 'LINE_ID', lineId);
  pushAttribute(lines, 'NAME', component.name);
  pushAttribute(lines, 'DIAMETER', diameter);
  pushAttribute(lines, 'WALL_THICK', wall);
  pushAttribute(lines, 'INSUL_THICK', insulation);
  pushAttribute(lines, 'CORR_ALLOW', corrosion);
  pushAttribute(lines, 'MATERIAL_NUM', materialNumber);
  pushAttribute(lines, 'MATERIAL_NAME', materialName);
  pushAttribute(lines, 'PIPE_DENSITY', materialDensity);
  pushAttribute(lines, 'INSUL_DENSITY', insulationDensity);
  pushAttribute(lines, 'FLUID_DENSITY', fluidDensity);

  // Design temperature — workbench wins, then raw ITEMTEMP1/TEMP
  const tempC = enriched.designTemperatureC ?? finiteOrNull(attrs.ITEMTEMP1 ?? attrs.TEMP1 ?? attrs.TEMP);
  if (tempC !== null && tempC !== undefined) lines.push(`TEMP_EXP_C1=${tempC}`);

  // Design pressure — workbench wins, then raw ITEMPRES1/PRES
  const pressure = finiteOrNull(enriched.designPressureMpa ?? enriched.designPressure ?? attrs.ITEMPRES1 ?? attrs.PRES1 ?? attrs.PRES);
  pushAttribute(lines, 'PRESSURE1', pressure);
  pushAttribute(lines, 'HYDRO_PRESSURE', finiteOrNull(enriched.hydroPressure ?? attrs.HPRES));

  // DTXR — workbench wins, then raw DTXR, then the real source identity.
  const dtxrPos = cleanText(enriched.dtxrPos || attrs.DTXR || component.name || component.type);
  if (dtxrPos) lines.push(`<DTXR_POS>${dtxrPos}</DTXR_POS>`);

  const dtxrPs = cleanText(enriched.dtxrPs || attrs.ISPE || attrs.SPRE || '');
  if (dtxrPs) lines.push(`<DTXR_PS>${dtxrPs}</DTXR_PS>`);

  return lines;
}

/** Add one non-empty CAESAR attribute assignment to a side-load block. */
function pushAttribute(lines, name, value) {
  if (value === null || value === undefined || cleanText(value) === '') return;
  lines.push(`${name}=${value}`);
}

/** Convert kg/m3 master density to the CAESAR InputXML kg/mm3 basis. */
function densityForInputXml(value) {
  const density = finiteOrNull(value);
  return density === null ? null : density / 1_000_000;
}

/** Reject mixed-source or structurally incomplete artifact sets before export. */
function assertExportArtifactCoherence(artifacts) {
  const sourceComponents = asArray(objectRecord(artifacts.source).components).map(objectRecord);
  const ledgerRecords = asArray(objectRecord(artifacts.ledger).records).map(objectRecord);
  const componentRecords = ledgerRecords.filter((record) => cleanText(record.sourceType).toUpperCase() !== 'BRANCH');
  if (sourceComponents.length !== componentRecords.length) {
    throw new Error(`Source/ledger mismatch: ${sourceComponents.length} source components versus ${componentRecords.length} ledger components.`);
  }
  const typeMismatch = sourceComponents.findIndex((component, index) => (
    cleanText(component.type).toUpperCase() !== cleanText(componentRecords[index].sourceType).toUpperCase()
  ));
  if (typeMismatch >= 0) {
    throw new Error(`Source/ledger mismatch at component ${typeMismatch + 1}: ${sourceComponents[typeMismatch].type} versus ${componentRecords[typeMismatch].sourceType}.`);
  }
  const supportGaps = componentRecords.filter((record) => (
    cleanText(record.sourceType).toUpperCase() === 'SUPPORT'
    && (!asArray(record.inputXmlElementIds).length || !asArray(record.inputXmlChildIds).some((id) => cleanText(id).startsWith('RESTRAINT:')))
  ));
  if (supportGaps.length) console.warn(`${supportGaps.length} support ledger record(s) lack native RESTRAINT projection.`);
  const rigidTypes = new Set(['FLAN', 'GASK', 'VALV', 'INST']);
  const rigidGaps = componentRecords.filter((record) => (
    rigidTypes.has(cleanText(record.sourceType).toUpperCase())
    && !asArray(record.inputXmlChildIds).some((id) => cleanText(id).startsWith('RIGID:'))
  ));
  if (rigidGaps.length) throw new Error(`${rigidGaps.length} rigid source record(s) lack native RIGID projection.`);
  const canonicalNodes = asArray(objectRecord(artifacts.canonical).nodes).map(objectRecord);
  const inputNodeIds = canonicalNodes.flatMap((node) => asArray(node.inputXmlNodeIds).map(cleanText).filter(Boolean));
  if (new Set(inputNodeIds).size !== inputNodeIds.length) throw new Error('Canonical topology contains duplicate InputXML node IDs.');
}

/** Parse a finite number from a raw attribute string, or return null. */
function finiteOrNull(v) {
  if (v === null || v === undefined || v === '') return null;
  const match = String(v).replace(/,/g, '').match(/[+-]?(?:\d+(?:\.\d*)?|\.\d+)/);
  if (!match) return null;
  const n = Number(match[0]);
  return Number.isFinite(n) ? n : null;
}

/**
 * Build the InputXML enrichment request without browser-only download effects.
 * @param {Record<string,unknown>} artifacts - Parsed source, ledger, canonical, and InputXML artifacts.
 * @returns {Record<string,unknown>} Enrichment engine request with routed element side-load text.
 */
export function buildTopologyInputXmlEnrichmentJob(artifacts, selectedBranches = null) {
  if (!artifacts.source || !artifacts.ledger || !artifacts.inputXml) {
    throw new Error('Source JSON, Trace Ledger, and InputXML must be loaded to download enriched InputXML.');
  }
  if (!artifacts.canonical) throw new Error('Canonical Topology must be loaded to verify native InputXML export.');
  assertExportArtifactCoherence(artifacts);

  const source     = objectRecord(artifacts.source);
  const components = asArray(source.components).map(objectRecord)
    .filter((c) => !selectedBranches || selectedBranches.size === 0 || selectedBranches.has(cleanText(c.sourceBranch)));
  const records    = asArray(objectRecord(artifacts.ledger).records).map(objectRecord);

  // Option A — Ledger is the routing index. Same mapping that proves 100% PASS,
  // so every validated component will reach its XML element(s).
  const ledgerByEntityId = new Map();
  for (const rec of records) {
    const eid = cleanText(rec.sourceEntityId);
    if (!eid) continue;
    if (!ledgerByEntityId.has(eid)) ledgerByEntityId.set(eid, []);
    ledgerByEntityId.get(eid).push(rec);
  }

  const elementById = new Map(
    asArray(objectRecord(artifacts.inputXml).elements)
      .map(objectRecord)
      .map(el => [cleanText(el.id), el])
  );

  const lines = [];
  let routed = 0;

  for (const component of components) {
    const eid = cleanText(component.sourceEntityId);
    const ledgerMatches = ledgerByEntityId.get(eid) ?? [];

    // Collect unique XML element IDs from Ledger (Option A navigation)
    const xmlEids = [...new Set(
      ledgerMatches.flatMap(r => asArray(r.inputXmlElementIds).map(cleanText)).filter(Boolean)
    )];
    if (!xmlEids.length) continue;

    // Option B — primary payload: enrichedAttributes from Workbench (may be empty)
    const enriched = objectRecord(component.enrichedAttributes);
    // Fallback payload: raw PDMS attributes always present in StagedJSON
    const attrs    = objectRecord(component.attributes);

    // Skip only if there is genuinely nothing to write
    const hasWorkbenchPayload = Object.keys(enriched).length > 0;
    const hasRawPayload = !!(attrs.SPRE || attrs.DTXR || attrs.RATING || attrs.ISPE ||
                             attrs.ITEMTEMP1 || attrs.ITEMPRES1 || attrs.PIPCLASS);
    if (!hasWorkbenchPayload && !hasRawPayload) continue;

    for (const xmlEid of xmlEids) {
      const element = elementById.get(xmlEid);
      if (!element) continue;
      const elementLines = buildSideLoadLines(element, component);
      if (elementLines.length > 1) { // must have at least ELEMENT + 1 field
        lines.push(...elementLines);
        routed++;
      }
    }
  }

  if (!lines.length) {
    throw new Error(
      `Export produced no enriched lines. ${routed} element(s) routed via Ledger. ` +
      'Ensure source attributes (SPRE, DTXR, RATING, ISPE, ITEMTEMP1, ITEMPRES1) are present, ' +
      'or run the Master File Enrichment Workbench first.'
    );
  }

  const job = {
    sourceText:          String(objectRecord(artifacts.inputXml).rawText),
    sourceName:          'TopologyValidator',
    elementSideLoadText: lines.join('\n'),
    supportConfigJson:   '{}',
    options:             {
      inputXmlOutputMode: 'document',
      inputXmlRestraintPolicy: 'preserve-existing-restraints',
      normalizePressureCaseNames: true,
    },
  };

  return job;
}

/** Build, enrich, and download the validated topology InputXML document. */
export function downloadEnrichedInputXml(artifacts, selectedBranches = null) {
  const job = buildTopologyInputXmlEnrichmentJob(artifacts, selectedBranches);

  const result = enrichInputXmlDocument(job);
  if (!result.ok) throw new Error(result.error || 'Enrichment failed.');

  const blob = new Blob([result.enrichedText], { type: 'text/xml' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = result.enrichedName || 'TopologyValidator_enriched.input.xml';
  a.click();
  URL.revokeObjectURL(url);
}
