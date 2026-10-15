/**
 * psi-transfer-apply.js — apply APPROVED TransferPlan.v1 rows to a target
 * AVEVA PSI PipeStressExport XML document.
 *
 * The plan's target objects are annotated topology edges; each edge knows the
 * PSI <NodeNumber>s it came from, so approved property rows are written as
 * element children on those <Node> blocks and approved RESTRAINT packets are
 * appended as <Restraint> blocks. The original text is never mutated — a
 * modified serialized copy is returned together with a rollback ledger.
 */

import { parseXml, serializeXml, XmlNode } from '../core/simple-xml.js';
import { APPROVAL_STATUS } from '../contracts/contracts.js';

/** Transferable property key → PSI element tag. */
const PROPERTY_TAGS = Object.freeze({
  NAME: 'NodeName',
  PIPINGCLASS: 'PipingClass',
  RATING: 'Rating',
  BOREMM: 'BoreMm',
  MATERIALCODE: 'MaterialCode',
  ELEMENTLENGTHMM: 'ElementLengthMm',
  OUTSIDEDIAMETER: 'OutsideDiameter',
  WALLTHICKNESS: 'WallThickness',
  CORROSIONALLOWANCE: 'CorrosionAllowance',
  INSULATIONTHICKNESS: 'InsulationThickness',
});

function childText(node, tag) {
  return node.childrenNamed(tag)[0]?.textContent?.trim() ?? '';
}

function setChildText(node, tag, value) {
  let child = node.childrenNamed(tag)[0];
  if (!child) child = node.appendChild(new XmlNode(tag));
  child.selfClosing = false;
  child.children = [];
  child.text = String(value);
  return child;
}

function appendRestraint(node, attrs) {
  const restraint = node.appendChild(new XmlNode('Restraint'));
  setChildText(restraint, 'Type', attrs.TYPE ?? '');
  setChildText(restraint, 'Stiffness', attrs.STIFFNESS ?? '0');
  setChildText(restraint, 'Gap', attrs.GAP ?? '0');
  setChildText(restraint, 'Friction', attrs.FRICTION ?? '0');
}

function restraintSignature(node) {
  return node.childrenNamed('Restraint')
    .map((r) => childText(r, 'Type'))
    .sort()
    .join('+');
}

/**
 * @param {string} targetXmlText  original PSI XML of the target revision
 * @param {object} plan           TransferPlan.v1 with approvals applied
 * @param {object} targetTopo     annotated target topology (edges carry nodeNumbers)
 * @returns {{ xmlText: string, applied: number, skipped: Array, rollbackRows: Array }}
 */
export function applyTransferPlanToPsi(targetXmlText, plan, targetTopo) {
  const { root, documentElement } = parseXml(targetXmlText);
  if (documentElement.name !== 'PipeStressExport') {
    throw new Error('apply: target is not a PipeStressExport document');
  }

  const nodesByNumber = new Map();
  for (const node of documentElement.descendantsNamed('Node')) {
    const number = childText(node, 'NodeNumber');
    if (!number || number === '-1') continue;
    if (!nodesByNumber.has(number)) nodesByNumber.set(number, []);
    nodesByNumber.get(number).push(node);
  }

  const edgeById = new Map((targetTopo?.edges ?? []).map((edge) => [edge.id, edge]));
  const rollbackRows = [];
  const skipped = [];
  let applied = 0;

  for (const row of plan.rows.filter((r) => r.approval === APPROVAL_STATUS.APPROVED)) {
    const edge = edgeById.get(row.targetObjectId);
    const numbers = edge?.nodeNumbers ?? [];
    const xmlNodes = numbers.flatMap((n) => nodesByNumber.get(n) ?? []);
    if (!xmlNodes.length) {
      skipped.push({ rowId: row.rowId, reason: `no PSI <Node> found for ${row.targetObjectId} (${numbers.join(',') || 'no node numbers'})` });
      continue;
    }

    if (row.kind === 'packet') {
      let attrs = {};
      try { attrs = JSON.parse(row.newValue || '{}'); } catch { /* leave empty */ }
      const host = xmlNodes[0];
      const before = restraintSignature(host);
      if ((attrs.TYPE ?? '') && before.split('+').includes(attrs.TYPE)) {
        skipped.push({ rowId: row.rowId, reason: `restraint ${attrs.TYPE} already present on node ${numbers[0]}` });
        continue;
      }
      appendRestraint(host, attrs);
      rollbackRows.push({ rowId: row.rowId, nodeNumber: numbers[0], property: row.property, before, after: restraintSignature(host) });
      applied += 1;
      continue;
    }

    const tag = PROPERTY_TAGS[String(row.property).toUpperCase()];
    if (!tag) {
      skipped.push({ rowId: row.rowId, reason: `property ${row.property} has no PSI tag mapping` });
      continue;
    }
    for (const xmlNode of xmlNodes) {
      const before = childText(xmlNode, tag);
      if (String(before) === String(row.newValue)) continue;
      setChildText(xmlNode, tag, row.newValue);
      rollbackRows.push({ rowId: row.rowId, nodeNumber: childText(xmlNode, 'NodeNumber'), property: tag, before, after: String(row.newValue) });
      applied += 1;
    }
  }

  return { xmlText: serializeXml(root, { declaration: false }), applied, skipped, rollbackRows };
}
