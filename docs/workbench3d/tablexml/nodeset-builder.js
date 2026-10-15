/**
 * nodeset-builder.js — parsed table + NodeSetMapping.v1 → NodeSet model + XML.
 *
 * Schema nodeset/v1 is comparison-only. It is not CAESAR II InputXML.
 */

import { encodeXmlAttribute } from '../core/simple-xml.js';
import { extractNumber, splitList, supportKindOf, combinedRules, UNIT_SCALES, boreToNb } from './text-to-number.js';
import { extractPoints, resolveGroups, mergeGroupedRows } from './grouping-resolver.js';
import { detectLoadCaseGroups, buildLoadProps } from './load-cases.js';
import { buildMeasureProps } from './measures.js';
import { classifyRemarks } from '../compare/remarks-classifier.js';
import {
  TABLEXML_DIAGNOSTICS_SCHEMA,
  createTableXmlDiagnostics,
  addTableXmlDiagnostic,
  finalizeTableXmlDiagnostics,
} from './tablexml-diagnostics.js';

export const NODESET_SCHEMA = 'nodeset/v1';
export const NODESET_PURPOSE = 'comparison-only';

function columnValue(row, col) {
  return String(row.rawByColumnId?.[col.columnId] ?? '').trim();
}

/** Distinct revision values in table order (when a revision column is mapped). */
export function discoverRevisions(source, mapping) {
  const revCol = (mapping?.columns ?? []).find((c) => c.role === 'revision');
  if (!revCol) return [];
  const seen = [];
  for (const row of source?.rows ?? []) {
    const value = String(row.rawByColumnId?.[revCol.columnId] ?? '').trim();
    if (value && !seen.includes(value)) seen.push(value);
  }
  return seen;
}

/**
 * Build the comparison-only NodeSet model from a parsed source + mapping.
 * Applies grouping (when enabled) before field extraction.
 * @param {object} options { revisionFilter?: string, side?: string }
 */
export function buildNodeSetModel(source, mapping, customRules = [], name = '', options = {}) {
  const rules = combinedRules(customRules);
  const sourceName = source?.sourceName || name || 'table';
  const diagnosticDocument = createTableXmlDiagnostics({ sourceName, buildName: name, side: options.side });
  const diag = (record) => addTableXmlDiagnostic(diagnosticDocument, record);
  const byRole = (role) => mapping.columns.filter((c) => c.role === role);
  const idCol = byRole('node-id')[0] ?? null;
  const tagCols = byRole('tag');
  const boreCol = byRole('bore')[0] ?? null;
  const supportCols = byRole('support-types');
  const propCols = byRole('prop');
  const childCol = byRole('child-list')[0] ?? null;
  const childRefCol = byRole('child-ref')[0] ?? null;
  const revCol = byRole('revision')[0] ?? null;
  const remarksCol = byRole('remarks')[0] ?? null;
  const loadCases = detectLoadCaseGroups(byRole('load'));
  const measureCols = byRole('measure');
  const hasCoord = byRole('coord-combined').length + byRole('coord-e').length + byRole('coord-n').length + byRole('coord-u').length > 0;
  const exploded = mapping.grain === 'exploded' && childCol;

  const ignoredColumns = mapping.columns.filter((column) => column.role === 'ignore');
  for (const column of ignoredColumns) {
    const nonEmptyCount = (source?.rows ?? []).filter((row) => columnValue(row, column)).length;
    if (nonEmptyCount) {
      diag({
        severity: 'INFO', code: 'TABLEXML_COLUMN_IGNORED',
        message: `Ignored column "${column.header}" contains ${nonEmptyCount} non-empty value(s).`,
        stage: 'map-columns', action: 'omit-column', sourceColumnId: column.columnId, count: nonEmptyCount,
      });
    }
  }

  // 0. revision filter
  let baseRows = source.rows;
  if (options.revisionFilter !== undefined && options.revisionFilter !== null && revCol) {
    const wanted = String(options.revisionFilter).trim();
    baseRows = source.rows.filter((row) => columnValue(row, revCol) === wanted);
    diag({
      severity: baseRows.length ? 'INFO' : 'ERROR',
      code: baseRows.length ? 'TABLEXML_REVISION_FILTER_APPLIED' : 'TABLEXML_REVISION_FILTER_EMPTY',
      message: `Revision filter "${wanted}": ${baseRows.length} of ${source.rows.length} row(s).`,
      stage: 'filter-revision', action: 'filter', sourceColumnId: revCol.columnId, count: baseRows.length,
      context: { revision: wanted, sourceRows: source.rows.length },
    });
  }
  const baseSource = { rows: baseRows };

  // 1. group duplicate-coordinate rows when enabled (explosion replaces grouping)
  let workingRows = baseRows;
  if (mapping.grouping?.enabled && !exploded) {
    const groups = resolveGroups(baseSource, mapping, customRules);
    const rowById = new Map(baseRows.map((r) => [r.rowId, r]));
    workingRows = groups.clusters.map((cluster) => {
      const rows = cluster.rowIds.map((id) => rowById.get(id)).filter(Boolean);
      return rows.length > 1 ? mergeGroupedRows(rows, mapping) : rows[0];
    });
    diag({
      severity: 'INFO', code: 'TABLEXML_ROWS_GROUPED',
      message: `Grouping reduced ${baseRows.length} row(s) to ${workingRows.length} node candidate(s).`,
      stage: 'group-rows', action: 'merge-coordinate-clusters', count: baseRows.length - workingRows.length,
      context: { sourceRows: baseRows.length, workingRows: workingRows.length, duplicateClusters: groups.duplicateClusters },
    });
    for (const item of groups.diagnostics) {
      diag({
        severity: 'WARNING', code: 'TABLEXML_GROUPING_CONFLICT', message: item.message,
        stage: 'group-rows', action: 'merge-conflict', sourceRowId: item.rowId,
      });
    }
  }

  // 2. extract coordinates. Coordinate-less non-spatial tables retain the
  // historical synthetic layout, but it is explicitly comparison-only.
  const workingSource = { rows: workingRows };
  let points;
  const coordinateMode = hasCoord ? 'source' : 'synthetic-comparison';
  if (hasCoord) {
    points = extractPoints(workingSource, mapping, customRules);
  } else {
    const cols = Math.max(1, Math.ceil(Math.sqrt(workingRows.length)));
    points = workingRows.map((row, i) => ({
      rowId: row.rowId,
      row,
      point: { e: (i % cols) * 1000, n: Math.floor(i / cols) * 1000, u: 0 },
      issues: [],
    }));
    diag({
      severity: 'WARNING', code: 'TABLEXML_SYNTHETIC_COORDINATES',
      message: `No coordinate columns were mapped; ${workingRows.length} node(s) use a synthetic comparison grid.`,
      stage: 'resolve-coordinate', action: 'generate-comparison-layout', count: workingRows.length,
      context: { spacingMm: 1000, purpose: NODESET_PURPOSE },
    });
  }

  const nodes = [];
  const seenIds = new Set();
  const uniqueIdFor = (id, sourceRowId) => {
    let uniqueId = id;
    let suffix = 2;
    while (seenIds.has(uniqueId)) uniqueId = `${id}#${suffix++}`;
    seenIds.add(uniqueId);
    if (uniqueId !== id) {
      diag({
        severity: 'WARNING', code: 'TABLEXML_NODE_ID_DUPLICATE_SUFFIXED',
        message: `Duplicate node id "${id}" was emitted as "${uniqueId}".`,
        stage: 'emit-node', action: 'suffix-duplicate-id', sourceRowId, outputField: 'Node/@id', nodeId: uniqueId,
        context: { sourceId: id, emittedId: uniqueId },
      });
    }
    return uniqueId;
  };

  const pushNode = (row, point, { id, supports, extraProps = [], sourceRowId = '' }) => {
    let bore = null;
    if (boreCol) {
      const raw = columnValue(row, boreCol).split(mapping.grouping?.separator ?? '|')[0];
      if (raw) {
        const result = extractNumber(raw, rules);
        if (result.ok) {
          const scaled = result.unit ? result.value : result.value * (UNIT_SCALES[boreCol.unit] ?? 1);
          bore = result.unit === 'in' ? boreToNb(scaled, 'in') : scaled;
          diag({
            severity: 'INFO', code: 'TABLEXML_BORE_READ', message: `Bore value was read from "${boreCol.header}".`,
            stage: 'resolve-bore', action: 'use-source', sourceRowId, sourceColumnId: boreCol.columnId,
            outputField: 'Node/@bore', context: { raw, value: bore, ruleId: result.ruleId, columnUnit: boreCol.unit || '' },
          });
        } else {
          diag({
            severity: 'WARNING', code: 'TABLEXML_BORE_OMITTED',
            message: `Bore text "${raw}" could not be parsed and was omitted.`,
            stage: 'resolve-bore', action: 'omit-unparsed', sourceRowId, sourceColumnId: boreCol.columnId,
            outputField: 'Node/@bore', context: { raw },
          });
        }
      }
    }

    const props = [...extraProps];
    for (const col of tagCols.slice(1)) {
      const value = columnValue(row, col);
      if (value) props.push({ name: col.propName || col.header, value });
    }
    for (const col of propCols) {
      const value = columnValue(row, col);
      if (value) props.push({ name: col.propName || col.header, value });
    }
    const emittedId = uniqueIdFor(id, sourceRowId);
    nodes.push({
      id: emittedId,
      e: Number(point.e.toFixed(3)),
      n: Number(point.n.toFixed(3)),
      u: Number(point.u.toFixed(3)),
      bore,
      tag: tagCols[0] ? columnValue(row, tagCols[0]) : '',
      props,
      supports,
    });
    diag({
      severity: 'OK', code: 'TABLEXML_NODE_EMITTED', message: `Node "${emittedId}" was emitted.`,
      stage: 'emit-node', action: 'emit', sourceRowId, outputField: 'Node', nodeId: emittedId,
      context: { coordinateMode, supportCount: supports.length, propertyCount: props.length },
    });
  };

  points.forEach((entry, index) => {
    if (!entry.point) {
      diag({
        severity: 'WARNING', code: 'TABLEXML_ROW_SKIPPED',
        message: `${entry.rowId}: skipped — ${entry.issues.join('; ') || 'no usable coordinate'}`,
        stage: 'resolve-coordinate', action: 'skip-row', sourceRowId: entry.rowId,
        context: { issues: entry.issues ?? [] },
      });
      return;
    }
    const row = entry.row ?? workingRows[index];
    const sourceRowId = entry.rowId || row?.rowId || '';
    const rowId = idCol ? columnValue(row, idCol) : '';

    const rowProps = [];
    if (remarksCol) {
      const remarks = columnValue(row, remarksCol);
      if (remarks) {
        rowProps.push({ name: 'REMARKS', value: remarks });
        const flags = classifyRemarks(remarks);
        if (flags.length) rowProps.push({ name: 'FLAGS', value: flags.join('|') });
      }
    }
    if (revCol) {
      const rev = columnValue(row, revCol);
      if (rev) rowProps.push({ name: 'REVISION', value: rev });
    }
    for (const [key, value] of Object.entries(buildLoadProps(row, loadCases, rules))) {
      rowProps.push({ name: key, value: String(value) });
    }
    for (const [key, value] of Object.entries(buildMeasureProps(row, measureCols, rules))) {
      rowProps.push({ name: key, value: String(value) });
    }

    if (exploded) {
      const children = splitList(columnValue(row, childCol), /[,;|]\s*/);
      const types = supportCols[0] ? splitList(columnValue(row, supportCols[0]), /[,;|]\s*/) : [];
      const refs = childRefCol ? splitList(columnValue(row, childRefCol), /[,;|]\s*/) : [];
      if (!children.length) {
        diag({
          severity: 'WARNING', code: 'TABLEXML_EXPLODED_ROW_SKIPPED',
          message: `${sourceRowId}: empty child support list.`,
          stage: 'explode-row', action: 'skip-row', sourceRowId, sourceColumnId: childCol.columnId,
        });
        return;
      }
      if (types.length !== children.length) {
        diag({
          severity: 'WARNING', code: 'TABLEXML_EXPLODED_TYPE_COUNT_MISMATCH',
          message: `${sourceRowId}: ${children.length} child id(s) and ${types.length} support type(s); values were zipped by index.`,
          stage: 'explode-row', action: 'zip-by-index', sourceRowId,
          context: { children: children.length, types: types.length, droppedTypes: Math.max(0, types.length - children.length), missingTypes: Math.max(0, children.length - types.length) },
        });
      }
      if (refs.length !== children.length) {
        diag({
          severity: 'WARNING', code: 'TABLEXML_EXPLODED_REF_COUNT_MISMATCH',
          message: `${sourceRowId}: ${children.length} child id(s) and ${refs.length} reference(s); values were zipped by index.`,
          stage: 'explode-row', action: 'zip-by-index', sourceRowId,
          context: { children: children.length, refs: refs.length, droppedRefs: Math.max(0, refs.length - children.length), missingRefs: Math.max(0, children.length - refs.length) },
        });
      }
      children.forEach((child, childIndex) => {
        const type = types[childIndex] ?? '';
        const extraProps = [...rowProps];
        if (rowId) extraProps.push({ name: 'PARENT', value: rowId });
        if (refs[childIndex]) extraProps.push({ name: 'REF', value: refs[childIndex] });
        pushNode(row, entry.point, {
          id: child.replace(/^\//, ''),
          supports: type ? [{ kind: supportKindOf(type), detail: type }] : [],
          extraProps,
          sourceRowId,
        });
      });
      return;
    }

    const supports = [];
    for (const col of supportCols) {
      for (const item of splitList(columnValue(row, col), /[,;|]\s*/)) {
        supports.push({ kind: supportKindOf(item), detail: item });
      }
    }
    if (supports.length) {
      diag({
        severity: 'INFO', code: 'TABLEXML_SUPPORTS_READ',
        message: `${supports.length} support value(s) were read for ${sourceRowId || `row ${index + 1}`}.`,
        stage: 'resolve-support', action: 'use-source', sourceRowId, count: supports.length,
      });
    }
    const nodeId = rowId || `N${index + 1}`;
    if (!rowId) {
      diag({
        severity: 'WARNING', code: 'TABLEXML_NODE_ID_GENERATED',
        message: `No node id was available; generated "${nodeId}".`,
        stage: 'resolve-id', action: 'generate-id', sourceRowId, outputField: 'Node/@id', nodeId,
      });
    }
    pushNode(row, entry.point, { id: nodeId, supports, extraProps: rowProps, sourceRowId });
  });

  if (exploded) {
    diag({
      severity: 'INFO', code: 'TABLEXML_ROWS_EXPLODED',
      message: `Exploded ${points.filter((point) => point.point).length} row(s) to ${nodes.length} support-point node(s).`,
      stage: 'explode-row', action: 'explode', count: nodes.length,
    });
  }
  if (!nodes.length) {
    diag({
      severity: 'ERROR', code: 'TABLEXML_ZERO_NODES',
      message: 'No nodes were produced; check coordinate, revision and grain mappings.',
      stage: 'finalize', action: 'block-output',
    });
  }

  const outputName = `${name || sourceName || 'table'}-nodeset.xml`;
  if (nodes.length) {
    diag({
      severity: 'OK', code: 'TABLEXML_NODESET_READY',
      message: `Comparison-only NodeSet is ready with ${nodes.length} node(s).`,
      stage: 'finalize', action: 'ready', count: nodes.length,
    });
  }
  finalizeTableXmlDiagnostics(diagnosticDocument, {
    outputReady: nodes.length > 0,
    outputName,
    sourceRowCount: source.rows.length,
    workingRowCount: workingRows.length,
    emittedNodeCount: nodes.length,
    coordinateMode,
    ignoredColumnCount: ignoredColumns.length,
  });

  return {
    schema: NODESET_SCHEMA,
    name: name || source.sourceName || 'table',
    unit: 'mm',
    purpose: NODESET_PURPOSE,
    coordinateMode,
    diagnosticsSchema: TABLEXML_DIAGNOSTICS_SCHEMA,
    nodes,
    diagnostics: diagnosticDocument.records,
    diagnosticDocument,
  };
}

export function serializeNodeSetXml(model) {
  const lines = ['<?xml version="1.0" encoding="UTF-8"?>'];
  const rootAttrs = [
    `schema="${NODESET_SCHEMA}"`,
    `name="${encodeXmlAttribute(model.name)}"`,
    `unit="${encodeXmlAttribute(model.unit || 'mm')}"`,
    `purpose="${encodeXmlAttribute(model.purpose || NODESET_PURPOSE)}"`,
    `coordinateMode="${encodeXmlAttribute(model.coordinateMode || 'source')}"`,
    `diagnosticsSchema="${encodeXmlAttribute(model.diagnosticsSchema || TABLEXML_DIAGNOSTICS_SCHEMA)}"`,
  ];
  lines.push(`<NodeSet ${rootAttrs.join(' ')}>`);
  for (const node of model.nodes) {
    const attrs = [`id="${encodeXmlAttribute(node.id)}"`, `e="${node.e}"`, `n="${node.n}"`, `u="${node.u}"`];
    if (node.bore !== null && node.bore !== undefined && Number.isFinite(node.bore)) attrs.push(`bore="${node.bore}"`);
    if (node.tag) attrs.push(`tag="${encodeXmlAttribute(node.tag)}"`);
    const children = [
      ...node.props.map((p) => `    <Prop name="${encodeXmlAttribute(p.name)}" value="${encodeXmlAttribute(p.value)}"/>`),
      ...node.supports.map((s) => `    <Support kind="${encodeXmlAttribute(s.kind)}" detail="${encodeXmlAttribute(s.detail)}"/>`),
    ];
    if (children.length) {
      lines.push(`  <Node ${attrs.join(' ')}>`);
      lines.push(...children);
      lines.push('  </Node>');
    } else {
      lines.push(`  <Node ${attrs.join(' ')}/>`);
    }
  }
  lines.push('</NodeSet>');
  return lines.join('\n');
}
