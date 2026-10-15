/**
 * AttributeEditLedger.v1 — sidecar ledger for attribute-only fixes that the
 * pinned topology core's geometry command set cannot express (restraint
 * family normalization, zero-length policy tags, reference relink text).
 * Immutable: every mutation returns a new frozen ledger. Merged into the
 * staged JSON at export time by topology-staged-export.js.
 */

import { asArray, cleanText, objectRecord } from './topology-validator-values.js';
import { isIsoTimestamp } from '../../contracts/contract-values.js';

/** @returns {Readonly<Record<string, unknown>>} */
export function createAttributeEditLedger() {
  return Object.freeze({ schema: 'AttributeEditLedger.v1', edits: Object.freeze([]), redoEdits: Object.freeze([]), nextSequence: 1 });
}

/**
 * @param {Record<string, unknown>} ledger
 * @param {{ branchIndex:number, childIndex:number|null, sourcePath:string, field:string,
 *           before:unknown, after:unknown, reason:string, fixCode:string, origin:string }} edit
 */
export function appendAttributeEdit(ledger, edit) {
  if (ledger?.schema !== 'AttributeEditLedger.v1') throw new TypeError('Expected AttributeEditLedger.v1.');
  const field = cleanText(edit.field);
  if (!field) throw new TypeError('Attribute edit requires a field name.');
  if (!Number.isInteger(edit.branchIndex) || edit.branchIndex < 0) throw new TypeError('Attribute edit requires a branchIndex.');
  if (!isIsoTimestamp(edit.appliedAt)) throw new TypeError('Attribute edit requires an exact ISO appliedAt timestamp.');
  const origin = cleanText(edit.origin);
  if (!origin) throw new TypeError('Attribute edit requires an explicit origin.');
  const record = Object.freeze({
    id: `AE-${String(ledger.nextSequence).padStart(6, '0')}`,
    appliedAt: edit.appliedAt,
    branchIndex: edit.branchIndex,
    childIndex: Number.isInteger(edit.childIndex) ? edit.childIndex : null,
    sourcePath: cleanText(edit.sourcePath),
    field,
    before: edit.before ?? null,
    after: edit.after ?? null,
    reason: cleanText(edit.reason),
    fixCode: cleanText(edit.fixCode),
    origin,
  });
  return Object.freeze({
    ...ledger,
    edits: Object.freeze([...ledger.edits, record]),
    redoEdits: Object.freeze([]),
    nextSequence: ledger.nextSequence + 1,
  });
}

export function undoAttributeEdit(ledger) {
  if (!ledger.edits.length) return ledger;
  return Object.freeze({
    ...ledger,
    edits: Object.freeze(ledger.edits.slice(0, -1)),
    redoEdits: Object.freeze([...ledger.redoEdits, ledger.edits.at(-1)]),
  });
}

export function redoAttributeEdit(ledger) {
  if (!ledger.redoEdits.length) return ledger;
  return Object.freeze({
    ...ledger,
    edits: Object.freeze([...ledger.edits, ledger.redoEdits.at(-1)]),
    redoEdits: Object.freeze(ledger.redoEdits.slice(0, -1)),
  });
}

/** @returns {string} */
export function serializeAttributeLedger(ledger) {
  return `${JSON.stringify(ledger, null, 2)}\n`;
}

/**
 * Apply the ledger's field replacements to a staged document (root shapes:
 * array | {objects|hierarchy|branches}). Returns a deep copy; the input is
 * never mutated. Edits with childIndex null target the branch attributes.
 */
export function applyAttributeLedgerToStaged(stagedDoc, ledger) {
  if (ledger?.schema !== 'AttributeEditLedger.v1') throw new TypeError('Expected AttributeEditLedger.v1.');
  const copy = structuredClone(stagedDoc);
  const branches = Array.isArray(copy) ? copy : (copy.hierarchy ?? copy.branches ?? copy.objects ?? []);
  for (const edit of asArray(ledger.edits).map(objectRecord)) {
    const branch = branches[edit.branchIndex];
    if (!branch) continue;
    const target = edit.childIndex === null || edit.childIndex === undefined
      ? branch
      : asArray(branch.children)[edit.childIndex];
    if (!target) continue;
    if (!target.attributes || typeof target.attributes !== 'object') target.attributes = {};
    target.attributes[edit.field] = edit.after;
  }
  return copy;
}
