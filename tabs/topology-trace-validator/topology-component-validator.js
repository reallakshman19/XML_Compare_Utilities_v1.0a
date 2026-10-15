/**
 * Functionality: independently validates component-aware lineage policies.
 * Inputs are normalized read models, a numeric tolerance, and a finding
 * callback. Outputs are coverage metrics only. Fallback: component InputXML
 * checks are NOT_EVALUATED until component projection lineage is present.
 */

import {
  COMPONENT_CATEGORIES,
  FINAL_DISPOSITIONS,
  GEOMETRY_TOLERANCE_MM,
  PROJECTION_CARDINALITIES,
  asArray,
  cleanText,
  componentCategory,
  objectRecord,
  uniqueText,
} from './topology-validator-values.js';

const INLINE_CATEGORIES = Object.freeze(['VALVE', 'FLANGE', 'GASK', 'INST', 'REDUCER']);

/** @param {unknown} left @param {unknown} right @returns {boolean} */
function equalFiniteNumber(left, right) {
  const leftNumber = Number(left), rightNumber = Number(right);
  return Number.isFinite(leftNumber) && Number.isFinite(rightNumber) && Math.abs(leftNumber - rightNumber) < 1e-9;
}

/** @param {Record<string, unknown>} source @param {Record<string, unknown>[]} records @returns {Record<string, unknown>[]} */
function recordsForSource(source, records) {
  const id = cleanText(source.sourceEntityId), path = cleanText(source.sourcePath);
  return records.filter((record) => id ? cleanText(record.sourceEntityId) === id : cleanText(record.sourcePath) === path);
}

/** @param {Record<string, unknown>} record @returns {string} */
function dispositionBucket(record) {
  const disposition = cleanText(record.disposition);
  if (disposition === 'BLOCK_AMBIGUOUS') return 'blocked';
  if (disposition === 'DEFER_SUPPORT') return 'deferred';
  if (asArray(record.junctionIds).length) return 'junction';
  if (asArray(record.pointFeatureIds).length) return 'point';
  if (asArray(record.canonicalEdgeIds).length) return 'edge';
  return 'unmapped';
}

/** @param {Record<string, unknown>} source @param {Record<string, unknown>} record @param {Map<string,Record<string,unknown>>} edgeById @param {(code:string,message:string,context:Record<string,unknown>)=>void} fail @returns {void} */
function validateEdgeLineage(source, record, edgeById, fail) {
  const category = componentCategory(source.type), sourceId = cleanText(source.sourceEntityId);
  for (const edgeId of uniqueText(asArray(record.canonicalEdgeIds))) {
    const edge = objectRecord(edgeById.get(edgeId));
    if (!asArray(edge.sourceEntityIds).map(cleanText).includes(sourceId)) fail('COMPONENT_EDGE_ANCESTRY_MISSING', `${category} ${source.sourcePath} is not retained in canonical edge ${edgeId}.`, {});
    const edgeTypes = asArray(edge.sourceTypes).map(componentCategory);
    if (!edgeTypes.includes(category)) fail('COMPONENT_EDGE_TYPE_LINEAGE_MISSING', `Canonical edge ${edgeId} does not retain source type ${category}.`, {});
    if (category !== 'PIPE' && edgeTypes.length === 1 && edgeTypes[0] === 'PIPE') fail('COMPONENT_RETYPE_TO_PIPE', `${category} ${source.sourcePath} was retyped as generic PIPE on ${edgeId}.`, {});
    if (category === 'REDUCER' && (edge.inferredDiameter === true || cleanText(edge.diameterAuthority) === 'GUESSED')) fail('REDUCER_DIAMETER_GUESSED', `Reducer edge ${edgeId} contains guessed diameter data.`, {});
  }
}

/** @param {Record<string, unknown>} source @param {Record<string, unknown>} record @param {(code:string,message:string,context:Record<string,unknown>)=>void} fail @returns {void} */
function validatePrimaryPolicy(source, record, fail) {
  const category = componentCategory(source.type), geometry = cleanText(source.geometryClassification), disposition = cleanText(record.disposition);
  if (category === 'SUPPORT') {
    if (disposition === 'DEFER_SUPPORT') {
      if (asArray(record.canonicalEdgeIds).length || asArray(record.inputXmlElementIds).length) fail('SUPPORT_EMITTED_AS_ROUTE', `Deferred support ${source.sourcePath} participates in route projection.`, {});
      return;
    }
    if (disposition !== 'EMIT_SUPPORT_ATTACHMENT') fail('SUPPORT_ATTACHMENT_MISSING', `Support ${source.sourcePath} must use EMIT_SUPPORT_ATTACHMENT.`, {});
    if (!asArray(record.canonicalNodeIds).length || !asArray(record.inputXmlElementIds).length) fail('SUPPORT_NODE_PROJECTION_MISSING', `Support ${source.sourcePath} lacks a canonical node or InputXML element.`, {});
    if (!asArray(record.inputXmlChildIds).some((id) => cleanText(id).startsWith('RESTRAINT:'))) fail('SUPPORT_RESTRAINT_PROJECTION_MISSING', `Support ${source.sourcePath} lacks native RESTRAINT lineage.`, {});
    return;
  }
  if (category === 'TEE' || category === 'OLET') {
    const allowed = category === 'TEE' ? ['EMIT_TEE_JUNCTION', 'SPLIT_HEADER_AT_JUNCTION'] : ['EMIT_OLET_JUNCTION', 'SPLIT_HEADER_AT_JUNCTION'];
    if (!allowed.includes(disposition)) fail(`${category}_JUNCTION_DISPOSITION_INVALID`, `${category} ${source.sourcePath} is not represented as its canonical junction type.`, {});
    if (!asArray(record.junctionIds).length) fail(`${category}_JUNCTION_MISSING`, `${category} ${source.sourcePath} has no canonical junction ID.`, {});
    return;
  }
  if (geometry === 'UNKNOWN') {
    if (disposition !== 'BLOCK_AMBIGUOUS') fail('COMPONENT_GEOMETRY_UNKNOWN', `${category} ${source.sourcePath} has no complete geometry and must be blocked explicitly.`, {});
    return;
  }
  if (geometry === 'POINT') {
    if (!['EMIT_POINT_FEATURE', 'BLOCK_AMBIGUOUS'].includes(disposition)) fail('ZERO_LENGTH_COMPONENT_ELEMENT', `${category} ${source.sourcePath} is point/zero-length but is not a point feature or blocked.`, {});
    return;
  }
  if (category === 'PIPE' && !['EMIT_ROUTE_EDGE', 'SPLIT_HEADER_AT_JUNCTION'].includes(disposition)) fail('PIPE_DISPOSITION_INVALID', `PIPE ${source.sourcePath} does not emit an explicit route edge mapping.`, {});
  if (category === 'ELBO/BEND') {
    if (disposition !== 'EMIT_BEND_EDGE_SET') fail('BEND_DISPOSITION_INVALID', `Bend ${source.sourcePath} does not emit an explicit edge set.`, {});
    const positions = objectRecord(source.positions), start = objectRecord(positions.APOS), bend = objectRecord(positions.POS), end = objectRecord(positions.LPOS);
    const firstArm = Math.hypot(Number(bend.x) - Number(start.x), Number(bend.y) - Number(start.y), Number(bend.z) - Number(start.z));
    const secondArm = Math.hypot(Number(end.x) - Number(bend.x), Number(end.y) - Number(bend.y), Number(end.z) - Number(bend.z));
    if (firstArm > GEOMETRY_TOLERANCE_MM && secondArm > GEOMETRY_TOLERANCE_MM && asArray(record.canonicalEdgeIds).length < 2 && objectRecord(record.evidence).singleEdgeJustification !== true) fail('BEND_ARM_MAPPING_MISSING', `Bend ${source.sourcePath} has two finite arms but fewer than two canonical edges and no diagnostic.`, {});
  }
  if (INLINE_CATEGORIES.includes(category) && !['EMIT_INLINE_COMPONENT_EDGE', 'MERGE_IN_CII_PROJECTION'].includes(disposition)) fail('INLINE_COMPONENT_DISPOSITION_INVALID', `${category} ${source.sourcePath} does not emit a dedicated component edge.`, {});
}

/** @param {Record<string, unknown>} source @param {Record<string, unknown>} record @param {Record<string, unknown>} canonical @param {(code:string,message:string,context:Record<string,unknown>)=>void} fail @returns {void} */
function validateJunctionPolicy(source, record, canonical, fail) {
  const category = componentCategory(source.type);
  if (!['TEE', 'OLET'].includes(category)) return;
  const edges = asArray(canonical.edges).map(objectRecord), degrees = {};
  for (const edge of edges) for (const nodeId of [edge.fromNodeId, edge.toNodeId].map(cleanText).filter(Boolean)) degrees[nodeId] = (degrees[nodeId] ?? 0) + 1;
  const junctionById = new Map(asArray(canonical.junctions).map((row) => [cleanText(objectRecord(row).id), objectRecord(row)]));
  for (const junctionId of asArray(record.junctionIds).map(cleanText)) {
    const junction = objectRecord(junctionById.get(junctionId)), nodeId = cleanText(junction.nodeId);
    if (componentCategory(junction.kind) !== category) fail('JUNCTION_TYPE_MISMATCH', `${category} ${source.sourcePath} maps to non-${category} junction ${junctionId}.`, {});
    if (!asArray(junction.sourceEntityIds).map(cleanText).includes(cleanText(source.sourceEntityId))) fail('JUNCTION_SOURCE_ANCESTRY_MISSING', `${category} ${source.sourcePath} is not retained in junction ${junctionId} ancestry.`, {});
    if ((degrees[nodeId] ?? 0) < 3 && !asArray(record.boundaryIds).length) fail(`${category}_JUNCTION_CONNECTIVITY_INCOMPLETE`, `${category} junction ${junctionId} has degree ${degrees[nodeId] ?? 0}; expected run-in, run-out, and branch connectivity.`, {});
  }
  const cref = cleanText(objectRecord(source.references).CREF), evidence = objectRecord(record.evidence);
  const evidenceCref = cleanText(evidence.sourceCref ?? evidence.CREF ?? evidence.cref);
  if (cref && evidenceCref !== cref) fail(`${category}_CREF_LINEAGE_MISSING`, `${category} ${source.sourcePath} does not preserve CREF ${cref} in ledger evidence.`, {});
}

/** @param {Record<string, unknown>} inputXml @param {Record<string, unknown>[]} componentPairs @param {Map<string,Record<string,unknown>>} edgeById @param {number} toleranceMm @param {(code:string,message:string,context:Record<string,unknown>)=>void} addFinding @returns {Record<string, unknown>} */
function validateComponentProjection(inputXml, componentPairs, edgeById, toleranceMm, addFinding) {
  if (!inputXml) return { status: 'NOT_EVALUATED', mappedFinite: 'NOT_EVALUATED', invalidZeroLength: 'NOT_EVALUATED' };
  const projectedPairs = componentPairs.filter(({ record }) => cleanText(record.sourceType) && asArray(record.inputXmlElementIds).length);
  if (!projectedPairs.length) return { status: 'NOT_EVALUATED', mappedFinite: 'NOT_EVALUATED', invalidZeroLength: 'NOT_EVALUATED' };
  const elements = asArray(inputXml.elements).map(objectRecord), elementById = new Map(elements.map((row) => [cleanText(row.id), row]));
  let mappedFinite = 0, finiteTotal = 0, invalidZeroLength = 0;
  for (const pair of componentPairs) {
    const source = objectRecord(pair.source), record = objectRecord(pair.record), category = componentCategory(source.type);
    if (cleanText(source.geometryClassification) !== 'FINITE' || ['TEE', 'OLET', 'SUPPORT'].includes(category)) continue;
    finiteTotal += 1;
    const ids = uniqueText([...asArray(record.inputXmlElementIds), ...asArray(record.canonicalEdgeIds).flatMap((id) => asArray(objectRecord(edgeById.get(cleanText(id))).inputXmlElementIds))]);
    if (ids.length && ids.every((id) => elementById.has(id))) mappedFinite += 1;
    else addFinding('COMPONENT_INPUTXML_MAPPING_MISSING', `${category} ${source.sourcePath} lacks complete InputXML projection.`, { sourcePath: cleanText(source.sourcePath), sourceEntityIds: [cleanText(source.sourceEntityId)], details: { sourceType: category } });
    for (const id of ids) {
      const element = objectRecord(elementById.get(id)), projectedType = componentCategory(element.sourceType);
      if (projectedType && projectedType !== category && !objectRecord(record.evidence).reclassification) addFinding('INPUTXML_COMPONENT_RETYPE_UNEXPLAINED', `InputXML element ${id} is typed ${projectedType}, not ${category}, without ledger evidence.`, { sourcePath: cleanText(source.sourcePath), inputXmlElementIds: [id], details: { sourceType: category } });
      const enriched = objectRecord(source.enrichedAttributes);
      const attributes = objectRecord(element.attributes);
      const actualTemperature = attributes.TEMP_EXP_C1 ?? attributes.TEMP1;
      if (enriched.designTemperatureC !== undefined && !equalFiniteNumber(actualTemperature, enriched.designTemperatureC)) {
        addFinding('INPUTXML_ENRICHED_TEMP_MISMATCH', `InputXML element ${id} TEMP_EXP_C1 (${actualTemperature}) does not match enriched designTemperatureC (${enriched.designTemperatureC}).`, { sourcePath: cleanText(source.sourcePath), inputXmlElementIds: [id] });
      }
      const expectedPressure = enriched.designPressureMpa ?? enriched.designPressureBarg;
      if (expectedPressure !== undefined && expectedPressure !== null && Number.isFinite(Number(expectedPressure)) && !equalFiniteNumber(attributes.PRESSURE1, expectedPressure)) {
        addFinding('INPUTXML_ENRICHED_PRESSURE_MISMATCH', `InputXML element ${id} PRESSURE1 (${attributes.PRESSURE1}) does not match enriched design pressure (${expectedPressure}).`, { sourcePath: cleanText(source.sourcePath), inputXmlElementIds: [id] });
      }
    }
  }
  for (const element of elements) {
    const delta = objectRecord(element.delta);
    if ([delta.x, delta.y, delta.z].every((value) => typeof value === 'number') && Math.hypot(Number(delta.x), Number(delta.y), Number(delta.z)) <= toleranceMm) {
      invalidZeroLength += 1;
      addFinding('INVALID_ZERO_LENGTH_INPUTXML_ELEMENT', `InputXML element ${element.id || element.viewKey} is zero-length within ${toleranceMm} mm.`, { inputXmlElementIds: [cleanText(element.id)] });
    }
  }
  return { status: 'EVALUATED', mappedFinite, finiteTotal, invalidZeroLength };
}

/** @param {Record<string, unknown>} input @param {number} toleranceMm @param {(code:string,message:string,context:Record<string,unknown>)=>void} addFinding @returns {Readonly<Record<string, unknown>>} */
export function validateComponentLineage(input, toleranceMm, addFinding) {
  const source = objectRecord(input.source), canonical = objectRecord(input.canonical), ledger = objectRecord(input.ledger);
  const records = asArray(ledger.records).map(objectRecord), edgeById = new Map(asArray(canonical.edges).map((row) => [cleanText(objectRecord(row).id), objectRecord(row)]));
  const coverage = Object.fromEntries(COMPONENT_CATEGORIES.map((category) => [category, { total: 0, accounted: 0, edge: 0, point: 0, junction: 0, blocked: 0, deferred: 0, failures: 0 }]));
  const pairs = [], instruments = { inline: 0, point: 0, blocked: 0 };
  let silentlyAbsorbed = 0;
  const components = asArray(source.components).map(objectRecord).filter((row) => row.isRouteComponent === true || componentCategory(row.type) === 'SUPPORT');
  for (const component of components) {
    const category = componentCategory(component.type), card = coverage[category], matches = recordsForSource(component, records);
    if (!card) continue;
    card.total += 1;
    const fail = (code, message, context) => {
      card.failures += 1;
      if (['COMPONENT_RETYPE_TO_PIPE', 'COMPONENT_EDGE_TYPE_LINEAGE_MISSING', 'INLINE_COMPONENT_DISPOSITION_INVALID'].includes(code)) silentlyAbsorbed += 1;
      addFinding(code, message, { ...context, sourcePath: cleanText(component.sourcePath), sourceEntityIds: [cleanText(component.sourceEntityId)], details: { ...objectRecord(context.details), sourceType: category } });
    };
    if (!cleanText(component.sourceEntityId) || matches.length !== 1 || !FINAL_DISPOSITIONS.includes(cleanText(matches[0]?.disposition))) continue;
    const record = matches[0], bucket = dispositionBucket(record);
    card.accounted += 1;
    if (Object.hasOwn(card, bucket)) card[bucket] += 1;
    pairs.push({ source: component, record });
    if (Object.values(objectRecord(record.declaredFields)).some((value) => value !== true)) fail('COMPONENT_LEDGER_CONTRACT_INCOMPLETE', `${component.sourcePath} ledger record omits component benchmark fields.`, {});
    if (!PROJECTION_CARDINALITIES.includes(cleanText(record.projectionCardinality))) fail('COMPONENT_CARDINALITY_INVALID', `${component.sourcePath} has invalid projection cardinality.`, {});
    if (componentCategory(record.sourceType) !== category) fail('LEDGER_SOURCE_TYPE_MISMATCH', `${component.sourcePath} source type ${category} is not retained by ledger record ${record.recordId}.`, {});
    if (cleanText(component.ref) && cleanText(record.sourceRef) !== cleanText(component.ref)) fail('LEDGER_SOURCE_REF_MISMATCH', `${component.sourcePath} source REF is not retained by ledger record ${record.recordId}.`, {});
    validatePrimaryPolicy(component, record, fail);
    if (asArray(record.canonicalEdgeIds).length) validateEdgeLineage(component, record, edgeById, fail);
    validateJunctionPolicy(component, record, canonical, fail);
    if (category === 'INST') {
      if (cleanText(record.disposition) === 'BLOCK_AMBIGUOUS') instruments.blocked += 1;
      else if (cleanText(component.geometryClassification) === 'FINITE') instruments.inline += 1;
      else instruments.point += 1;
    }
  }
  for (const card of Object.values(coverage)) {
    card.percentage = card.total ? (card.accounted / card.total) * 100 : 100;
    card.result = card.accounted === card.total && card.failures === 0 ? 'PASS' : card.accounted === card.total ? 'WARNING' : 'FAIL';
  }
  const projection = validateComponentProjection(input.inputXml ? objectRecord(input.inputXml) : null, pairs, edgeById, toleranceMm, addFinding);
  const routeTotal = components.filter((row) => row.isRouteComponent === true).length;
  const routeAccounted = pairs.filter(({ source: row }) => objectRecord(row).isRouteComponent === true).length;
  return Object.freeze({
    coverage, routeTotal, routeAccounted, routeWithoutDisposition: routeTotal - routeAccounted,
    conflictingDispositions: components.filter((row) => recordsForSource(row, records).length > 1).length,
    silentlyDropped: components.filter((row) => recordsForSource(row, records).length === 0).length,
    silentlyAbsorbed,
    instruments, componentInputXmlStatus: projection.status, componentProjection: projection,
  });
}

export const _test = Object.freeze({ dispositionBucket, recordsForSource, validatePrimaryPolicy });
