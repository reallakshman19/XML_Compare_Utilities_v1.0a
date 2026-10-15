/**
 * transfer-apply.js — apply APPROVED TransferPlan.v1 rows to the target XML
 * (Phase 7). Structured tree edit via simple-xml — never regex patching.
 *
 * Guarantees:
 *  - only rows with approval === APPROVED are applied
 *  - geometry attributes (FROM_NODE/TO_NODE/DELTA_*) are verified untouched
 *  - every applied change gets a before/after RollbackLedger.v1 row
 *  - "apply" means producing a downloadable modified copy; the original
 *    text is never mutated
 */

import { parseXml, serializeXml, XmlNode } from '../core/simple-xml.js';
import { CONTRACT_VERSIONS, APPROVAL_STATUS, GEOMETRY_PROTECTED_FIELDS } from '../contracts/contracts.js';
import { detectSchema, XML_SCHEMA_KINDS } from '../adapters/inputxml-adapter.js';

function elementNodes(documentElement, schema) {
  return schema === XML_SCHEMA_KINDS.INPUT_XML
    ? documentElement.descendantsNamed('PIPINGELEMENT')
    : documentElement.descendantsNamed('Element');
}

function geometrySnapshot(node) {
  return GEOMETRY_PROTECTED_FIELDS.map((field) => `${field}=${node.getAttribute(field) ?? ''}`).join('|');
}

export function applyTransferPlan(targetXmlText, plan) {
  const schema = detectSchema(targetXmlText);
  if (schema === XML_SCHEMA_KINDS.UNKNOWN) throw new Error('apply: target XML schema not recognized');
  const { root, documentElement } = parseXml(targetXmlText);
  const elements = elementNodes(documentElement, schema);

  const geometryBefore = elements.map(geometrySnapshot);
  const rollbackRows = [];
  const skipped = [];
  let applied = 0;

  const approvedRows = plan.rows.filter((r) => r.approval === APPROVAL_STATUS.APPROVED);
  for (const row of approvedRows) {
    const node = Number.isInteger(row.targetRawIndex) ? elements[row.targetRawIndex] : null;
    if (!node) {
      skipped.push({ rowId: row.rowId, reason: `target element index ${row.targetRawIndex} not found` });
      continue;
    }
    const property = String(row.property).toUpperCase();
    if (GEOMETRY_PROTECTED_FIELDS.includes(property) && !plan.config?.allowGeometryTransfer) {
      skipped.push({ rowId: row.rowId, reason: 'geometry field blocked at apply gate' });
      continue;
    }
    if (row.kind === 'packet') {
      const kind = property.replace(/^PACKET:/, '');
      const packet = new XmlNode(kind);
      packet.selfClosing = true;
      let attrs = {};
      try { attrs = JSON.parse(row.newValue || '{}'); } catch { attrs = {}; }
      for (const [key, value] of Object.entries(attrs)) packet.setAttribute(key, value);
      node.appendChild(packet);
      rollbackRows.push({
        transferRowId: row.rowId,
        targetObjectId: row.targetObjectId,
        targetRawIndex: row.targetRawIndex,
        property: row.property,
        valueBefore: '',
        valueAfter: row.newValue,
        action: 'PACKET_ADDED',
      });
      applied += 1;
    } else {
      const before = node.getAttribute(row.property);
      node.setAttribute(row.property, row.newValue);
      rollbackRows.push({
        transferRowId: row.rowId,
        targetObjectId: row.targetObjectId,
        targetRawIndex: row.targetRawIndex,
        property: row.property,
        valueBefore: before ?? '',
        valueAfter: row.newValue,
        action: before === null ? 'ATTRIBUTE_CREATED' : 'ATTRIBUTE_UPDATED',
      });
      applied += 1;
    }
  }

  // Geometry preservation gate — hard invariant, checked after every apply.
  const geometryAfter = elements.map(geometrySnapshot);
  const geometryViolations = [];
  geometryBefore.forEach((before, index) => {
    if (before !== geometryAfter[index]) geometryViolations.push({ elementIndex: index, before, after: geometryAfter[index] });
  });
  if (geometryViolations.length && !plan.config?.allowGeometryTransfer) {
    throw new Error(`apply: geometry preservation violated on ${geometryViolations.length} element(s) — output rejected`);
  }

  return {
    outputXml: serializeXml(root, { declaration: /^\s*<\?xml/i.test(targetXmlText) }),
    rollbackLedger: {
      contract: CONTRACT_VERSIONS.RollbackLedger,
      generatedAt: new Date().toISOString(),
      rows: rollbackRows,
    },
    appliedCount: applied,
    skippedRows: skipped,
    geometryViolations,
  };
}
