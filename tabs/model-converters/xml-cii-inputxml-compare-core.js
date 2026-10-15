import { normalizeInputXmlElementGraph } from './xml-cii-inputxml-element-normalizer.js?v=20260709-5d-normalizer-1';
import { alignElementPaths } from './xml-cii-inputxml-path-aligner.js?v=20260709-5d-path-2';
import { supplementalEvidence, tightenedConfidence } from './xml-cii-inputxml-evidence-scorer.js?v=20260709-5d-evidence-2';

const DEFAULT_LENGTH_TOL_MM = 6;
const DEFAULT_SCORE_MARGIN = 10;

function text(value) { return value === undefined || value === null ? '' : String(value).trim(); }
function n(value) { const num = Number(value); return Number.isFinite(num) ? num : null; }
function boolOption(options, key, fallback = false) { return options?.[key] === undefined ? fallback : !!options[key]; }
function roundBucket(value, tolerance) { const num = Number(value); return Number.isFinite(num) && tolerance > 0 ? Math.round(num / tolerance) * tolerance : 0; }
function attr(element, name) { return text(element?.getAttribute?.(name)); }
function localName(node) { return text(node?.localName || node?.nodeName).replace(/^.*:/, '').toUpperCase(); }
function children(element, name) { return Array.from(element?.children || []).filter((child) => localName(child) === String(name).toUpperCase()); }
function edgeLength(edge) { return Math.hypot(Number(edge.dx || 0), Number(edge.dy || 0), Number(edge.dz || 0)); }
function hasChild(element, name) { return children(element, name).length > 0; }
function restraintTypes(element) { return children(element, 'RESTRAINT').map((restraint) => attr(restraint, 'TYPE')).filter(Boolean).sort(); }
function sifTypes(element) { return children(element, 'SIF').map((sif) => attr(sif, 'TYPE')).filter(Boolean).sort(); }
function unique(values) { return [...new Set((values || []).filter((value) => text(value)))]; }
function parseXml(xmlText) {
  const doc = new DOMParser().parseFromString(text(xmlText), 'application/xml');
  if (doc.getElementsByTagName?.('parsererror')?.length) throw new Error('InputXML parse failed.');
  return doc;
}
function findElements(doc) {
  const all = Array.from(doc.getElementsByTagName?.('PIPINGELEMENT') || []);
  if (all.length) return all;
  return Array.from(doc.getElementsByTagName?.('PipingElement') || []);
}
function ensureNode(nodes, id) {
  const key = text(id);
  if (!nodes.has(key)) nodes.set(key, { id: key, incident: [], inbound: [], outbound: [], flags: new Set(), childTypes: new Set() });
  return nodes.get(key);
}
function addNodeEvidence(node, edge, endKind) {
  node.incident.push(edge);
  if (endKind === 'from') node.outbound.push(edge);
  if (endKind === 'to') node.inbound.push(edge);
  for (const flag of edge.flags) node.flags.add(flag);
  for (const type of edge.restraintTypes) node.childTypes.add(`REST:${type}`);
  for (const type of edge.sifTypes) node.childTypes.add(`SIF:${type}`);
}
function nodeContext(node, options = {}) {
  const tol = Number(options.lengthToleranceMm || DEFAULT_LENGTH_TOL_MM);
  const lengths = node.incident.map((edge) => roundBucket(edge.lengthMm, tol)).sort((a, b) => a - b);
  const diameters = node.incident.map((edge) => edge.diameter == null ? '' : roundBucket(edge.diameter, tol)).filter((value) => value !== '').sort((a, b) => a - b);
  return {
    nodeId: node.id,
    degree: node.incident.length,
    inDegree: node.inbound.length,
    outDegree: node.outbound.length,
    lengths,
    diameters,
    flags: [...node.flags].sort(),
    childTypes: [...node.childTypes].sort(),
    signature: [`deg=${node.incident.length}`, `L=${lengths.join(',')}`, `D=${diameters.join(',')}`, `F=${[...node.flags].sort().join(',')}`, `C=${[...node.childTypes].sort().join(',')}`].join('|'),
  };
}
function propertyPacket(edge) {
  return {
    hasRigid: edge.flags.includes('RIGID'),
    hasBend: edge.flags.includes('BEND'),
    hasSif: edge.flags.includes('SIF'),
    hasRestraint: edge.flags.includes('RESTRAINT'),
    restraintTypes: edge.restraintTypes,
    sifTypes: edge.sifTypes,
    componentEvidence: unique([...edge.flags, ...edge.restraintTypes.map((type) => `REST:${type}`), ...edge.sifTypes.map((type) => `SIF:${type}`)]),
  };
}
export function parseInputXmlElementGraph(xmlText, options = {}) {
  const doc = parseXml(xmlText);
  const elements = findElements(doc);
  const nodes = new Map();
  const edges = [];
  elements.forEach((element, index) => {
    const from = attr(element, 'FROM_NODE');
    const to = attr(element, 'TO_NODE');
    if (!from || !to) return;
    const edge = {
      index: index + 1,
      elementId: `E${index + 1}:${from}->${to}`,
      from,
      to,
      dx: n(attr(element, 'DELTA_X')) || 0,
      dy: n(attr(element, 'DELTA_Y')) || 0,
      dz: n(attr(element, 'DELTA_Z')) || 0,
      diameter: n(attr(element, 'DIAMETER')),
      wall: n(attr(element, 'WALL_THICK')),
      lineId: attr(element, 'LINE_ID'),
      element,
      flags: [],
      restraintTypes: restraintTypes(element),
      sifTypes: sifTypes(element),
    };
    edge.lengthMm = edgeLength(edge);
    if (hasChild(element, 'RIGID')) edge.flags.push('RIGID');
    if (hasChild(element, 'BEND')) edge.flags.push('BEND');
    if (edge.sifTypes.length) edge.flags.push('SIF');
    if (edge.restraintTypes.length) edge.flags.push('RESTRAINT');
    edge.packet = propertyPacket(edge);
    edges.push(edge);
    const fromNode = ensureNode(nodes, from);
    const toNode = ensureNode(nodes, to);
    addNodeEvidence(fromNode, edge, 'from');
    addNodeEvidence(toNode, edge, 'to');
  });
  for (const edge of edges) {
    edge.fromContext = nodeContext(nodes.get(edge.from), options);
    edge.toContext = nodeContext(nodes.get(edge.to), options);
    edge.packetEvidence = propertyPacket(edge).componentEvidence;
    edge.signature = elementSignature(edge, options);
  }
  return { doc, nodes: [...nodes.values()], edges, edgeMap: new Map(edges.map((edge) => [edge.elementId, edge])), summary: { nodeCount: nodes.size, elementCount: edges.length } };
}
export const parseInputXmlGraph = parseInputXmlElementGraph;
export function elementSignature(edge, options = {}) {
  const tol = Number(options.lengthToleranceMm || DEFAULT_LENGTH_TOL_MM);
  return [
    `L=${roundBucket(edge.lengthMm, tol)}`,
    `D=${edge.diameter == null ? '' : roundBucket(edge.diameter, tol)}`,
    `W=${edge.wall == null ? '' : roundBucket(edge.wall, tol)}`,
    `CANON=${edge.normalizedFromTo || `${edge.from}->${edge.to}`}`,
    `PATH=${edge.pathId || ''}/${edge.pathIndex || ''}`,
    `FROM_CTX=${edge.fromContext?.degree ?? ''}/${(edge.fromContext?.lengths || []).join(',')}`,
    `TO_CTX=${edge.toContext?.degree ?? ''}/${(edge.toContext?.lengths || []).join(',')}`,
    `ANCHOR=${(edge.anchorFlags || []).join(',')}`,
    ...unique(edge.packetEvidence || edge.flags).sort(),
  ].join('|');
}
export const edgeSignature = elementSignature;
function overlapScore(aValues, bValues, weight) {
  const a = new Set(aValues || []);
  const b = new Set(bValues || []);
  if (!a.size && !b.size) return weight;
  let hit = 0;
  for (const value of a) if (b.has(value)) hit += 1;
  return weight * hit / Math.max(a.size, b.size, 1);
}
function numericScore(a, b, tolerance, weight) {
  if (a == null && b == null) return weight;
  if (a == null || b == null) return 0;
  const delta = Math.abs(Number(a) - Number(b));
  return weight * Math.max(0, 1 - delta / Math.max(tolerance, 1));
}
function contextScore(aCtx, bCtx, toleranceMm, weight) {
  if (!aCtx || !bCtx) return 0;
  let score = 0;
  score += aCtx.degree === bCtx.degree ? 0.35 : Math.max(0, 0.35 - Math.abs(aCtx.degree - bCtx.degree) * 0.15);
  score += overlapScore(aCtx.flags, bCtx.flags, 0.25);
  score += overlapScore(aCtx.childTypes, bCtx.childTypes, 0.2);
  const aLengths = aCtx.lengths || [];
  const bLengths = bCtx.lengths || [];
  let lengthHit = 0;
  const used = new Set();
  for (const av of aLengths) {
    let best = null;
    for (let i = 0; i < bLengths.length; i += 1) {
      if (used.has(i)) continue;
      const delta = Math.abs(av - bLengths[i]);
      if (!best || delta < best.delta) best = { index: i, delta };
    }
    if (best && best.delta <= toleranceMm * 2) { used.add(best.index); lengthHit += 1; }
  }
  score += 0.2 * lengthHit / Math.max(aLengths.length, bLengths.length, 1);
  return weight * Math.max(0, Math.min(1, score));
}
function endpointContextScore(refEdge, targetEdge, options = {}) {
  const toleranceMm = Number(options.lengthToleranceMm || DEFAULT_LENGTH_TOL_MM);
  const forward = contextScore(refEdge.fromContext, targetEdge.fromContext, toleranceMm, 8) + contextScore(refEdge.toContext, targetEdge.toContext, toleranceMm, 8);
  const reverse = contextScore(refEdge.fromContext, targetEdge.toContext, toleranceMm, 8) + contextScore(refEdge.toContext, targetEdge.fromContext, toleranceMm, 8);
  return Math.max(forward, reverse);
}
function stationScore(refEdge, targetEdge, weight) {
  const refLen = Number(refEdge.componentLengthMm || 0);
  const targetLen = Number(targetEdge.componentLengthMm || 0);
  if (!(refLen > 0) || !(targetLen > 0)) return 0;
  const refRatio = Number(refEdge.stationMidMm || 0) / refLen;
  const targetRatio = Number(targetEdge.stationMidMm || 0) / targetLen;
  return weight * Math.max(0, 1 - Math.abs(refRatio - targetRatio) * 4);
}
function pathStationScore(refEdge, targetEdge, weight) {
  const refPathLen = Number(refEdge.pathTotalVectorLengthMm || refEdge.componentLengthMm || 0);
  const targetPathLen = Number(targetEdge.pathTotalVectorLengthMm || targetEdge.componentLengthMm || 0);
  if (!(refPathLen > 0) || !(targetPathLen > 0)) return 0;
  const refRatio = Number(refEdge.pathStationMidMm || refEdge.stationMidMm || 0) / refPathLen;
  const targetRatio = Number(targetEdge.pathStationMidMm || targetEdge.stationMidMm || 0) / targetPathLen;
  return weight * Math.max(0, 1 - Math.abs(refRatio - targetRatio) * 4);
}
export function scoreElementMatch(refEdge, targetEdge, options = {}) {
  const toleranceMm = Number(options.lengthToleranceMm || DEFAULT_LENGTH_TOL_MM);
  const evidence = supplementalEvidence(refEdge, targetEdge, options);
  let score = 0;
  score += numericScore(refEdge.lengthMm, targetEdge.lengthMm, toleranceMm * 3, 22);
  score += numericScore(refEdge.diameter, targetEdge.diameter, Math.max(toleranceMm, 2), 9);
  score += numericScore(refEdge.wall, targetEdge.wall, Math.max(toleranceMm, 2), 4);
  score += overlapScore(refEdge.packetEvidence || refEdge.flags, targetEdge.packetEvidence || targetEdge.flags, 18);
  score += overlapScore(refEdge.anchorFlags || [], targetEdge.anchorFlags || [], 7);
  score += endpointContextScore(refEdge, targetEdge, options);
  score += stationScore(refEdge, targetEdge, 7);
  score += pathStationScore(refEdge, targetEdge, 5);
  if (boolOption(options, 'applySupplementalEvidenceScore', false)) score += evidence.score * 0.12;
  return Math.max(0, Math.min(100, score));
}
function confidence(score, bestGap, ambiguityCount, pathStatus = '') {
  if (pathStatus === 'AMBIGUOUS_PATH') return 'AMBIGUOUS';
  if (ambiguityCount > 1 && bestGap < DEFAULT_SCORE_MARGIN) return 'AMBIGUOUS';
  if (score >= 82 && bestGap >= DEFAULT_SCORE_MARGIN) return 'HIGH';
  if (score >= 65 && bestGap >= DEFAULT_SCORE_MARGIN) return 'MEDIUM';
  if (score >= 45) return 'LOW';
  return 'NO_MATCH';
}
function elementLabel(edge) { return `${edge.elementId} | ${edge.normalizedFromTo || `${edge.from}->${edge.to}`} | L=${edge.lengthMm.toFixed(3)} | ${(edge.packetEvidence || edge.flags || []).join('+') || 'PIPE'}`; }
function elementMappingRow(candidate, secondBest, ambiguityCount, conf, evidence) {
  const bestGap = candidate.score - (secondBest?.score || 0);
  return {
    referencePath: candidate.referencePath || candidate.refElement.pathId || '',
    targetPath: candidate.targetPath || candidate.targetElement.pathId || '',
    alignmentOp: candidate.alignmentOp || 'MATCH',
    referenceElement: elementLabel(candidate.refElement),
    targetElement: elementLabel(candidate.targetElement),
    referenceFromTo: candidate.refElement.normalizedFromTo || `${candidate.refElement.from}->${candidate.refElement.to}`,
    targetFromTo: candidate.targetElement.normalizedFromTo || `${candidate.targetElement.from}->${candidate.targetElement.to}`,
    referenceLengthMm: Number(candidate.refElement.lengthMm.toFixed(3)),
    targetLengthMm: Number(candidate.targetElement.lengthMm.toFixed(3)),
    lengthDeltaMm: Number(Math.abs(candidate.refElement.lengthMm - candidate.targetElement.lengthMm).toFixed(3)),
    referenceStationMm: Number((candidate.refElement.pathStationMidMm ?? candidate.refElement.stationMidMm ?? 0).toFixed(3)),
    targetStationMm: Number((candidate.targetElement.pathStationMidMm ?? candidate.targetElement.stationMidMm ?? 0).toFixed(3)),
    pathScore: Number((candidate.pathScore || 0).toFixed(1)),
    score: Number(candidate.score.toFixed(1)),
    evidenceScore: Number((evidence?.score || 0).toFixed(1)),
    diameterRatio: evidence?.diameterRatio ?? '',
    diameterStatus: evidence?.diameterStatus || '',
    nameStatus: evidence?.nameStatus || '',
    nameCommon: evidence?.nameCommon || '',
    anchorCoordDistance: evidence?.anchorCoordDistance ?? '',
    anchorCoordStatus: evidence?.anchorCoordStatus || '',
    evidenceFlags: (evidence?.conflictFlags || []).join(';'),
    nextBestScore: Number((secondBest?.score || 0).toFixed(1)),
    scoreGap: Number(bestGap.toFixed(1)),
    ambiguityCount,
    confidence: conf,
    reason: 'anchor-to-anchor path alignment + configurable diameter ratio/name/relative-anchor-coordinate evidence',
    referenceSignature: candidate.refElement.signature,
    targetSignature: candidate.targetElement.signature,
    transferAction: conf === 'HIGH' ? 'auto-preview-property-packet' : conf === 'MEDIUM' ? 'manual-review-property-packet' : 'no-transfer',
  };
}
function fallbackUnmatchedConflicts(reference, usedRef) {
  return reference.edges
    .filter((edge) => !usedRef.has(edge.elementId))
    .map((edge) => ({ referenceElement: elementLabel(edge), targetElement: '', issue: 'UNMATCHED_REFERENCE_ELEMENT', detail: 'no path-aligned target element passed score/ambiguity/evidence gate' }));
}
export function compareInputXmlTopology(referenceXmlText, targetXmlText, options = {}) {
  const normalizationOptions = { ...options, shortElementToleranceMm: Number(options.shortElementToleranceMm || options.lengthToleranceMm || DEFAULT_LENGTH_TOL_MM) };
  const reference = normalizeInputXmlElementGraph(parseInputXmlElementGraph(referenceXmlText, options), normalizationOptions);
  const target = normalizeInputXmlElementGraph(parseInputXmlElementGraph(targetXmlText, options), normalizationOptions);
  const pathAlignment = alignElementPaths(reference, target, { ...options, scoreElementMatch });
  for (const edge of [...reference.edges, ...target.edges]) edge.signature = elementSignature(edge, options);
  const minCandidateScore = Number(options.minCandidateScore || 35);
  const candidatesByRef = new Map();
  const allCandidates = [];
  for (const candidate of pathAlignment.alignedCandidates || []) {
    if (candidate.score < minCandidateScore) continue;
    if (!candidatesByRef.has(candidate.refElement.elementId)) candidatesByRef.set(candidate.refElement.elementId, []);
    candidatesByRef.get(candidate.refElement.elementId).push(candidate);
    allCandidates.push(candidate);
  }
  for (const list of candidatesByRef.values()) list.sort((a, b) => b.score - a.score);
  allCandidates.sort((a, b) => b.score - a.score);
  const usedRef = new Set();
  const usedTarget = new Set();
  const elementMappings = [];
  const conflictRows = [...(pathAlignment.pathConflicts || [])].map((row) => ({ referenceElement: row.referencePath || '', targetElement: row.targetPath || '', issue: row.issue, detail: row.detail }));
  for (const candidate of allCandidates) {
    if (usedRef.has(candidate.refElement.elementId) || usedTarget.has(candidate.targetElement.elementId)) continue;
    const refCandidates = candidatesByRef.get(candidate.refElement.elementId) || [];
    const secondBest = refCandidates.find((item) => item.targetElement.elementId !== candidate.targetElement.elementId);
    const bestGap = candidate.score - (secondBest?.score || 0);
    const ambiguityCount = refCandidates.filter((item) => Math.abs(item.score - candidate.score) < DEFAULT_SCORE_MARGIN).length;
    usedRef.add(candidate.refElement.elementId);
    usedTarget.add(candidate.targetElement.elementId);
    const evidence = supplementalEvidence(candidate.refElement, candidate.targetElement, options);
    const baseConf = confidence(candidate.score, bestGap, ambiguityCount, candidate.pathStatus || '');
    const conf = tightenedConfidence(baseConf, evidence, options);
    const row = elementMappingRow(candidate, secondBest, ambiguityCount, conf, evidence);
    elementMappings.push(row);
    if (boolOption(options, 'auditSupplementalEvidenceConflicts', true) && (evidence.conflictFlags || []).length) conflictRows.push({ referenceElement: row.referenceElement, targetElement: row.targetElement, issue: 'SUPPLEMENTAL_EVIDENCE_CONFLICT', detail: row.evidenceFlags });
    if (!['HIGH', 'MEDIUM'].includes(conf)) conflictRows.push({ referenceElement: row.referenceElement, targetElement: row.targetElement, issue: conf, detail: `score=${row.score}; evidence=${row.evidenceScore}; gap=${row.scoreGap}; ambiguity=${row.ambiguityCount}` });
  }
  conflictRows.push(...fallbackUnmatchedConflicts(reference, usedRef));
  const transferRows = elementMappings
    .filter((row) => row.confidence === 'HIGH' || row.confidence === 'MEDIUM')
    .map((row) => ({
      referencePath: row.referencePath,
      targetPath: row.targetPath,
      referenceElement: row.referenceElement,
      targetElement: row.targetElement,
      confidence: row.confidence,
      evidenceScore: row.evidenceScore,
      evidenceFlags: row.evidenceFlags,
      action: 'copy element child/property packet only; keep target FROM/TO and DELTA geometry',
      transferable: 'RIGID/BEND/SIF/RESTRAINT/Component metadata packet preview',
    }));
  return {
    ok: true,
    mode: 'element-wise-canonical-path-aligned-configurable-evidence',
    options: {
      lengthToleranceMm: Number(options.lengthToleranceMm || DEFAULT_LENGTH_TOL_MM),
      shortElementToleranceMm: normalizationOptions.shortElementToleranceMm,
      minCandidateScore,
      useDiameterRatioEvidence: boolOption(options, 'useDiameterRatioEvidence', true),
      useNameEvidence: boolOption(options, 'useNameEvidence', true),
      useAnchorCoordinateEvidence: boolOption(options, 'useAnchorCoordinateEvidence', true),
      applySupplementalEvidenceScore: boolOption(options, 'applySupplementalEvidenceScore', false),
      downgradeOnSupplementalConflict: boolOption(options, 'downgradeOnSupplementalConflict', false),
      upgradeWithCleanSupplementalEvidence: boolOption(options, 'upgradeWithCleanSupplementalEvidence', false),
      auditSupplementalEvidenceConflicts: boolOption(options, 'auditSupplementalEvidenceConflicts', true),
      diameterRatioTolerance: Number(options.diameterRatioTolerance || 0.02),
      anchorCoordinateTolerance: Number(options.anchorCoordinateTolerance || 0.03),
    },
    summary: {
      referenceRawElements: reference.normalization.rawElementCount,
      targetRawElements: target.normalization.rawElementCount,
      referenceElements: reference.summary.elementCount,
      targetElements: target.summary.elementCount,
      consumedReferenceElements: reference.normalization.consumedElementCount,
      consumedTargetElements: target.normalization.consumedElementCount,
      referenceAnchors: reference.normalization.anchorRows.length,
      targetAnchors: target.normalization.anchorRows.length,
      referencePaths: pathAlignment.summary.referencePathCount,
      targetPaths: pathAlignment.summary.targetPathCount,
      matchedPaths: pathAlignment.summary.matchedPathCount,
      ambiguousPaths: pathAlignment.summary.ambiguousPathCount,
      pathConflicts: pathAlignment.summary.pathConflictCount,
      alignedElementCandidates: pathAlignment.summary.alignedElementCandidateCount,
      matchedElements: elementMappings.length,
      highConfidenceElements: elementMappings.filter((row) => row.confidence === 'HIGH').length,
      mediumConfidenceElements: elementMappings.filter((row) => row.confidence === 'MEDIUM').length,
      ambiguousElements: elementMappings.filter((row) => row.confidence === 'AMBIGUOUS').length,
      evidenceConflictElements: elementMappings.filter((row) => row.evidenceFlags).length,
      transferPreviewElements: transferRows.length,
      conflictCount: conflictRows.length,
    },
    normalization: { reference: reference.normalization, target: target.normalization },
    paths: {
      referencePathRows: pathAlignment.referencePathRows,
      targetPathRows: pathAlignment.targetPathRows,
      pathMappings: pathAlignment.pathMappings,
      alignmentRows: pathAlignment.alignmentRows,
      pathConflicts: pathAlignment.pathConflicts,
    },
    elementMappings,
    transferRows,
    conflictRows,
  };
}
export function mappingRowsToCsv(rows) {
  if (!rows?.length) return '';
  const headers = Object.keys(rows[0]);
  const esc = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
  return [headers.join(','), ...rows.map((row) => headers.map((header) => esc(row[header])).join(','))].join('\n');
}
