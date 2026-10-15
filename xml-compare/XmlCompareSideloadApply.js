import {
  formatCoordinate,
  solveElementCoordinates,
} from './XmlCompareCoordinateSideload.js';
import {
  createSideloadDiagnostic,
  normalizeSideloadDiagnostic,
  summarizeSideloadDiagnostics,
} from './XmlCompareSideloadDiagnostics.js';
import {
  applyGlobalCoordinateAttributes,
  attrValue,
  mutateXmlAttribute,
} from './XmlCompareSideloadMutation.js';
import {
  normalizeNode,
  normalizeScalar,
  numberValue,
  pairKey,
  parseSideloadRows,
  splitSideloadLine,
  tagKeys,
} from './XmlCompareSideloadTableParser.js';

const clean = (value) => String(value ?? '').trim();

export function tagMatchForRestraint(openTag, index) {
  const row = {
    node: attrValue(openTag, 'NODE'),
    type: attrValue(openTag, 'TYPE'),
    stiffness: attrValue(openTag, 'STIFFNESS'),
    gap: attrValue(openTag, 'GAP'),
    mu: attrValue(openTag, 'MU'),
    cnode: attrValue(openTag, 'CNODE'),
  };
  const keys = tagKeys(row);
  if (index.tagExact.has(keys.exact)) {
    return Object.freeze({ candidate: index.tagExact.get(keys.exact), tier: 'exact' });
  }
  if (index.tagNodeType.has(keys.nodeType)) {
    return Object.freeze({ candidate: index.tagNodeType.get(keys.nodeType), tier: 'node-type' });
  }
  if (index.tagNode.has(keys.node)) {
    return Object.freeze({ candidate: index.tagNode.get(keys.node), tier: 'unique-node' });
  }
  return Object.freeze({
    candidate: null,
    tier: index.ambiguousTagNodes.has(keys.node) ? 'ambiguous-node' : 'unmatched',
    node: keys.node,
  });
}

export function pipingElementOpenTags(xml = '') {
  return [...String(xml || '').matchAll(/<PIPINGELEMENT\b[^>]*>/gi)].map((match, index) => ({
    index,
    openTag: match[0],
    fromNode: attrValue(match[0], 'FROM_NODE'),
    toNode: attrValue(match[0], 'TO_NODE'),
    DELTA_X: attrValue(match[0], 'DELTA_X'),
    DELTA_Y: attrValue(match[0], 'DELTA_Y'),
    DELTA_Z: attrValue(match[0], 'DELTA_Z'),
  }));
}

export function solveFromSideloadIndex(xml, index) {
  if (!index.nodeCoordinates.size) return null;
  return solveElementCoordinates({
    elements: pipingElementOpenTags(xml),
    originCoordinates: index.nodeCoordinates,
    toleranceMm: 1,
  });
}

function elementLabel(fromNode, toNode) {
  return `${normalizeNode(fromNode)}->${normalizeNode(toNode)}`;
}

function applyCandidateAttribute(openTag, name, candidate, metadata) {
  if (!candidate) return Object.freeze({ openTag, diagnostics: [], consumed: [] });
  const result = mutateXmlAttribute(openTag, name, candidate.value, {
    ...metadata,
    sourceRow: candidate.row.sourceRow,
  });
  return Object.freeze({
    openTag: result.openTag,
    diagnostics: [result.diagnostic],
    consumed: [candidate.row.rowId],
  });
}

function applyNames(openTag, names, element) {
  if (!names) {
    return Object.freeze({ openTag, diagnostics: [], consumed: [], applied: 0 });
  }
  let nextTag = openTag;
  const diagnostics = [];
  for (const [name, value] of [['FROM_NAME', names.fromName], ['TO_NAME', names.toName]]) {
    const result = mutateXmlAttribute(nextTag, name, value, {
      sourceField: 'nodeNameText',
      sourceRow: names.row.sourceRow,
      element,
    });
    nextTag = result.openTag;
    diagnostics.push(result.diagnostic);
  }
  return Object.freeze({
    openTag: nextTag,
    diagnostics,
    consumed: [names.row.rowId],
    applied: 1,
  });
}

export function applyElementSideload(openTag, index, coordinate) {
  const fromNode = normalizeNode(attrValue(openTag, 'FROM_NODE'));
  const toNode = normalizeNode(attrValue(openTag, 'TO_NODE'));
  const key = pairKey(fromNode, toNode);
  const element = elementLabel(fromNode, toNode);
  const line = applyCandidateAttribute(openTag, 'LINE_ID', index.lineIds.get(key), {
    sourceField: 'lineIdText',
    element,
  });
  const names = applyNames(line.openTag, index.nodeNames.get(key), element);
  let nextTag = names.openTag;
  const diagnostics = [...line.diagnostics, ...names.diagnostics];
  if (coordinate?.status === 'SOLVED') {
    const result = applyGlobalCoordinateAttributes(nextTag, coordinate, {
      element,
      format: formatCoordinate,
    });
    nextTag = result.openTag;
    diagnostics.push(...result.diagnostics);
  }
  return Object.freeze({
    openTag: nextTag,
    diagnostics,
    consumed: [...line.consumed, ...names.consumed],
    lineApplied: line.consumed.length,
    namesApplied: names.applied,
    coordinatesApplied: coordinate?.status === 'SOLVED' ? 1 : 0,
  });
}

export function applyRestraintSideload(openTag, index) {
  const match = tagMatchForRestraint(openTag, index);
  const element = `RESTRAINT:${normalizeNode(attrValue(openTag, 'NODE'))}`;
  if (!match.candidate) {
    if (match.tier !== 'ambiguous-node') {
      return Object.freeze({ openTag, diagnostics: [], consumed: [], tagsApplied: 0 });
    }
    return Object.freeze({
      openTag,
      consumed: [],
      tagsApplied: 0,
      diagnostics: [createSideloadDiagnostic({
        severity: 'WARNING',
        code: 'SIDELOAD_AMBIGUOUS_TAG',
        message: `Restraint ${element} could not use unique-node fallback.`,
        stage: 'restraint-match',
        sourceField: 'restraintTagText',
        element,
        action: 'skipped',
        context: { node: match.node },
      })],
    });
  }
  const result = mutateXmlAttribute(openTag, 'TAG', match.candidate.value, {
    sourceField: 'restraintTagText',
    sourceRow: match.candidate.row.sourceRow,
    element,
    context: { matchTier: match.tier },
  });
  return Object.freeze({
    openTag: result.openTag,
    diagnostics: [result.diagnostic],
    consumed: [match.candidate.row.rowId],
    tagsApplied: 1,
  });
}

function unmatchedDiagnostics(index, consumed) {
  const records = [];
  const groups = [
    [index.lineIdRows, 'SIDELOAD_PAIR_NOT_FOUND', 'lineIdText', 'LINE_ID row matched no PIPINGELEMENT.'],
    [index.nodeNameRows, 'SIDELOAD_NAME_PAIR_NOT_FOUND', 'nodeNameText', 'Name row matched no PIPINGELEMENT.'],
    [index.tagRows, 'SIDELOAD_TAG_NOT_APPLIED', 'restraintTagText', 'Restraint tag row matched no RESTRAINT.'],
  ];
  for (const [rows, code, sourceField, message] of groups) {
    for (const row of rows) {
      if (consumed.has(row.rowId)) continue;
      records.push(createSideloadDiagnostic({
        severity: 'WARNING',
        code,
        message,
        stage: 'apply-summary',
        sourceField,
        sourceRow: row.sourceRow,
        action: 'unmatched',
        context: { rowId: row.rowId },
      }));
    }
  }
  return records;
}

function buildReport(index, counts, diagnostics, coordinateResult, schema) {
  const records = diagnostics.map(normalizeSideloadDiagnostic);
  return Object.freeze({
    schema,
    ...index.stats,
    ...counts,
    coordinateNodesResolved: coordinateResult?.summary?.solvedNodeCount || index.nodeCoordinates.size,
    coordinateDiagnostics: records.filter((record) => record.stage === 'coordinate-solve').length,
    diagnostics: Object.freeze(records),
    diagnosticSummary: summarizeSideloadDiagnostics(records),
  });
}

function applyElementTags(output, index, coordinateResult, diagnostics, consumed, counts) {
  let elementIndex = 0;
  return output.replace(/<PIPINGELEMENT\b[^>]*>/gi, (openTag) => {
    const coordinate = coordinateResult?.elementCoordinates?.[elementIndex++];
    const result = applyElementSideload(openTag, index, coordinate);
    result.consumed.forEach((rowId) => consumed.add(rowId));
    diagnostics.push(...result.diagnostics);
    counts.lineIdsApplied += result.lineApplied;
    counts.nodeNamesApplied += result.namesApplied;
    counts.coordinatesApplied += result.coordinatesApplied;
    return result.openTag;
  });
}

function applyRestraintTags(output, index, diagnostics, consumed, counts) {
  return output.replace(/<RESTRAINT\b[^>]*>/gi, (openTag) => {
    const result = applyRestraintSideload(openTag, index);
    result.consumed.forEach((rowId) => consumed.add(rowId));
    diagnostics.push(...result.diagnostics);
    counts.tagsApplied += result.tagsApplied;
    return result.openTag;
  });
}

function initialApplyDiagnostics(index, coordinateResult) {
  const records = [...index.diagnostics];
  if (coordinateResult) {
    records.push(...coordinateResult.diagnostics.map(normalizeSideloadDiagnostic));
  }
  return records;
}

export function applyXmlCompareSideloadWithIndex(xmlText, index, schema) {
  const coordinateResult = solveFromSideloadIndex(xmlText, index);
  const diagnostics = initialApplyDiagnostics(index, coordinateResult);
  const consumed = new Set();
  const counts = {
    lineIdsApplied: 0, nodeNamesApplied: 0,
    tagsApplied: 0, coordinatesApplied: 0,
  };
  const elementsApplied = applyElementTags(
    String(xmlText ?? ''), index, coordinateResult,
    diagnostics, consumed, counts,
  );
  const output = applyRestraintTags(
    elementsApplied, index, diagnostics, consumed, counts,
  );
  diagnostics.push(...unmatchedDiagnostics(index, consumed));
  return Object.freeze({
    schema,
    xmlText: output,
    report: buildReport(index, counts, diagnostics, coordinateResult, schema),
  });
}

export const compatibilityTestExports = Object.freeze({
  clean,
  normalizeNode,
  normalizeScalar,
  numberValue,
  pairKey,
  splitLine: splitSideloadLine,
  tableRows: parseSideloadRows,
  attrValue,
  tagKeys,
  tagForRestraint: tagMatchForRestraint,
  pipingElementOpenTags,
  solveFromIndex: solveFromSideloadIndex,
  applyElementSideload,
  applyRestraintSideload,
});
