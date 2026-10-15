import { sha256CiiByteString } from './cii-workspace-byte-sha256.js';
import { resolveFindReplaceScope } from './cii-workspace-find-replace-scope-resolver.js';
import { parseFortranNumber } from '../../parser/fixed-field.js';
import { fieldAwareClaimPlan } from './cii-workspace-find-replace-v14-field-claims.js';

/*
 * CII v14 Find & Replace independent validation helpers.
 * Claims are TARGET0-relative. U2 field-aware scopes prevent cross-field and
 * protected Element identity/pointer mutation before claims reach execution.
 */

function byteLength(value) {
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) if (text.charCodeAt(index) > 0xff) return null;
  return text.length;
}

function asciiLength(value) {
  const text = String(value ?? '');
  for (let index = 0; index < text.length; index += 1) if (text.charCodeAt(index) > 0x7f) return null;
  return text.length;
}

function blockToken(value) { return String(value || '').trim().toUpperCase().replace(/[\s_-]+/g, ''); }

function isNodeNameOperation(operation) {
  return String(operation?.scope || '').trim().toUpperCase() === 'BLOCK' && blockToken(operation?.block) === 'NODENAME';
}

function logicalNodeName(value) {
  const text = String(value ?? '');
  const trimmed = text.trim();
  return trimmed || text;
}

function literalMatchesWithinSpans(target0, needle, spans) {
  const matches = [];
  if (!needle) return matches;
  for (const span of spans || []) {
    const start = Number(span?.start); const end = Number(span?.end);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end < start || end > target0.length) continue;
    const body = target0.slice(start, end);
    let offset = 0;
    while (offset <= body.length - needle.length) {
      const found = body.indexOf(needle, offset);
      if (found < 0) break;
      matches.push(start + found);
      offset = found + needle.length;
    }
  }
  return matches;
}

function nodeNameClaimPlan(target0, findText, replaceText, spans, sequence, scopeResolution) {
  const matches = []; const blockers = []; const claims = [];
  const replacementLength = asciiLength(replaceText);
  const logicalFind = logicalNodeName(findText);
  for (const span of spans || []) {
    const start = Number(span?.start); const end = Number(span?.end);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > target0.length) continue;
    const before = target0.slice(start, end);
    if (before.trim() !== logicalFind) continue;
    matches.push(span);
    const width = end - start;
    if (span?.fieldWidth != null && Number(span.fieldWidth) !== width) blockers.push(`NODENAME_FIELD_WIDTH_MISMATCH:${span.fieldIdentity || 'UNKNOWN'}:${span.fieldWidth}:${width}`);
    if (span?.ownerAmbiguous || (span?.ownerNodeIds || []).length !== 1) blockers.push(`NODENAME_FIELD_OWNER_AMBIGUOUS:${span?.pointer ?? '?'}:${span?.fieldEnd || 'UNKNOWN'}`);
    if (replacementLength != null && replacementLength > width) blockers.push(`NODENAME_REPLACEMENT_TOO_WIDE:${replacementLength}:${width}:${span?.fieldIdentity || 'UNKNOWN'}`);
    if (!blockers.length) {
      claims.push(Object.freeze({
        operationIndex: sequence, start, end, before, after: replaceText.padEnd(width, ' '),
        scope: scopeResolution.scope, block: 'NODENAME', authority: scopeResolution.authority || null,
        fieldIdentity: span?.fieldIdentity || null, nodeId: span?.ownerNodeIds?.[0] || null,
      }));
    }
  }
  return { matches, blockers, claims };
}

function smartDocumentNodeNamePlan(target0, operation, findText, replaceText, sequence) {
  const resolution = resolveFindReplaceScope(target0, operation, {
    fieldAwareMutation: true,
    smartFixedWidth: 'NODENAME',
  });
  if (resolution?.status !== 'PASS') return null;
  const plan = nodeNameClaimPlan(target0, findText, replaceText, resolution.spans, sequence, resolution);
  if (!plan.matches.length) return null;
  const blockers = [...plan.blockers];
  if (asciiLength(findText) == null || asciiLength(replaceText) == null) blockers.unshift('NODENAME_ASCII_TEXT_REQUIRED');
  return Object.freeze({
    resolution,
    matches: Object.freeze([...plan.matches]),
    claims: Object.freeze([...plan.claims]),
    blockers: Object.freeze([...new Set(blockers)]),
  });
}

function sameNumericValue(left, right) {
  const a = parseFortranNumber(left); const b = parseFortranNumber(right);
  return Number.isFinite(a) && Number.isFinite(b) && Object.is(a, b);
}

function serializeNumericLogicalValue(valueInput, width) {
  const raw = String(valueInput ?? '').trim();
  const parsed = parseFortranNumber(raw);
  if (!Number.isFinite(parsed)) return { status: 'BLOCKED', blocker: 'SMART_NUMERIC_REPLACEMENT_REQUIRED' };
  if (raw.length > width) return { status: 'BLOCKED', blocker: `SMART_NUMERIC_REPLACEMENT_TOO_WIDE:${raw.length}:${width}` };
  return { status: 'PASS', value: raw.padStart(width, ' ') };
}

function smartDocumentQualifiedFieldPlan(target0, operation, findText, replaceText, sequence) {
  const resolution = resolveFindReplaceScope(target0, operation, {
    fieldAwareMutation: true,
    smartFixedWidth: 'QUALIFIED_FIELDS',
  });
  if (resolution?.status !== 'PASS') return null;
  const matched = [];
  const logicalFind = logicalNodeName(findText);
  for (const span of resolution.spans || []) {
    if (span.smartKind === 'NODENAME') {
      if (String(span.semanticValue ?? '').trim() === logicalFind) matched.push(span);
      continue;
    }
    if (span.smartKind === 'NUMERIC' && sameNumericValue(span.semanticValue, findText)) matched.push(span);
  }
  if (!matched.length) return null;

  const groups = new Map();
  for (const span of matched) {
    const group = String(span.smartGroup || `${span.block || span.section || 'UNKNOWN'}:${span.fieldIdentity || 'UNKNOWN'}`);
    const list = groups.get(group) || [];
    list.push(span); groups.set(group, list);
  }
  if (groups.size !== 1) {
    return Object.freeze({
      resolution, matches: Object.freeze(matched), claims: Object.freeze([]),
      blockers: Object.freeze([`SMART_FIELD_AMBIGUOUS:${groups.size}:${[...groups.keys()].join('|')}`]),
      semanticMode: 'AUTO_CII_FIXED_WIDTH', block: 'AMBIGUOUS',
    });
  }

  const [group, spans] = [...groups.entries()][0];
  if (group === 'NODENAME') {
    const plan = nodeNameClaimPlan(target0, findText, replaceText, spans, sequence, resolution);
    const blockers = [...plan.blockers];
    if (asciiLength(findText) == null || asciiLength(replaceText) == null) blockers.unshift('NODENAME_ASCII_TEXT_REQUIRED');
    return Object.freeze({
      resolution, matches: Object.freeze([...plan.matches]), claims: Object.freeze([...plan.claims]),
      blockers: Object.freeze([...new Set(blockers)]), semanticMode: 'AUTO_NODENAME_FIXED_WIDTH', block: 'NODENAME',
    });
  }

  const claims = []; const blockers = [];
  for (const span of spans) {
    const start = Number(span.start); const end = Number(span.end); const width = end - start;
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start < 0 || end <= start || end > target0.length) {
      blockers.push(`SMART_FIELD_RANGE_INVALID:${span.fieldIdentity || 'UNKNOWN'}`); continue;
    }
    const serialized = serializeNumericLogicalValue(replaceText, width);
    if (serialized.status !== 'PASS') { blockers.push(`${serialized.blocker}:${span.fieldIdentity || 'UNKNOWN'}`); continue; }
    const before = target0.slice(start, end);
    claims.push(Object.freeze({
      operationIndex: sequence, start, end, before, after: serialized.value,
      scope: 'DOCUMENT', block: span.block || span.section || null,
      authority: resolution.authority || null, fieldIdentity: span.fieldIdentity || null,
      fieldKind: 'NUMERIC', semanticGroup: group,
    }));
  }
  return Object.freeze({
    resolution, matches: Object.freeze(spans), claims: Object.freeze(claims),
    blockers: Object.freeze([...new Set(blockers)]), semanticMode: 'AUTO_CII_NUMERIC_FIXED_WIDTH',
    block: spans[0]?.block || spans[0]?.section || null,
  });
}

function overlapBlockers(claims) {
  const blockers = [];
  const ordered = [...claims].sort((a, b) => a.start - b.start || a.end - b.end || a.operationIndex - b.operationIndex);
  for (let index = 1; index < ordered.length; index += 1) {
    const previous = ordered[index - 1]; const current = ordered[index];
    if (current.start < previous.end) blockers.push(`OVERLAPPING_CLAIMS:${previous.operationIndex}:${current.operationIndex}:${current.start}`);
  }
  return blockers;
}

export function validateFindReplacePreimage(target0Input, operations = [], options = {}) {
  const target0 = String(target0Input ?? '');
  const requireEqualByteLength = options.requireEqualByteLength !== false;
  const blockers = []; const claims = []; const summaries = [];
  const sourceByteLength = byteLength(target0);
  if (sourceByteLength == null) blockers.push('TARGET0_CONTAINS_NON_BYTE_CODE_UNIT');

  (operations || []).forEach((operation, operationIndex) => {
    const sequence = operation?.sequence ?? operationIndex + 1;
    const status = String(operation?.status || 'PROPOSED').toUpperCase();
    if (status === 'REJECTED') return;
    if (status === 'BLOCKED') { blockers.push(`OPERATION_BLOCKED:${sequence}`); return; }
    if (!['PROPOSED', 'APPROVED'].includes(status)) { blockers.push(`OPERATION_STATUS_UNSUPPORTED:${sequence}:${status}`); return; }

    const findText = String(operation?.findText ?? operation?.before ?? '');
    const replaceText = String(operation?.replaceText ?? operation?.after ?? '');
    const nodeName = isNodeNameOperation(operation);
    const scopeToken = String(operation?.scope || 'DOCUMENT').trim().toUpperCase();
    const fieldScoped = scopeToken === 'ELEMENT' || (scopeToken === 'BLOCK' && !nodeName);
    const findBytes = byteLength(findText); const replaceBytes = byteLength(replaceText);
    const unequalFixedWidth = requireEqualByteLength && findBytes != null && replaceBytes != null && findBytes !== replaceBytes;
    const operationBlockers = [];
    if (!findText) operationBlockers.push('FIND_TEXT_REQUIRED');
    if (findText.includes('\r') || findText.includes('\n') || replaceText.includes('\r') || replaceText.includes('\n')) operationBlockers.push('LINE_ENDING_TEXT_NOT_SUPPORTED');

    let smartDocument = null;
    if (!nodeName && scopeToken === 'DOCUMENT' && unequalFixedWidth && findBytes != null && replaceBytes != null) {
      smartDocument = smartDocumentQualifiedFieldPlan(target0, operation, findText, replaceText, sequence);
    }

    if (nodeName) {
      if (asciiLength(findText) == null || asciiLength(replaceText) == null) operationBlockers.push('NODENAME_ASCII_TEXT_REQUIRED');
    } else {
      if (findBytes == null || replaceBytes == null) operationBlockers.push('NON_BYTE_TEXT_NOT_SUPPORTED');
      if (unequalFixedWidth && !smartDocument) operationBlockers.push(`FIXED_WIDTH_LENGTH_MISMATCH:${findBytes}:${replaceBytes}`);
      if (fieldScoped && (asciiLength(findText) == null || asciiLength(replaceText) == null)) operationBlockers.push('CII_FIELD_ASCII_TEXT_REQUIRED');
    }

    const scopeResolution = smartDocument?.resolution || resolveFindReplaceScope(target0, operation, { fieldAwareMutation: true });
    if (scopeResolution?.status !== 'PASS') for (const blocker of scopeResolution?.blockers || ['SCOPE_RESOLUTION_FAILED']) operationBlockers.push(blocker);

    let matches = []; let preparedClaims = [];
    if (!operationBlockers.length && smartDocument) {
      matches = [...smartDocument.matches]; operationBlockers.push(...smartDocument.blockers); preparedClaims = [...smartDocument.claims];
    } else if (!operationBlockers.length && nodeName) {
      const plan = nodeNameClaimPlan(target0, findText, replaceText, scopeResolution.spans, sequence, scopeResolution);
      matches = plan.matches; operationBlockers.push(...plan.blockers); preparedClaims = plan.claims;
    } else if (!operationBlockers.length && scopeResolution?.fieldAware) {
      const plan = fieldAwareClaimPlan(target0, findText, replaceText, scopeResolution.spans, sequence, scopeResolution);
      matches = plan.matches; operationBlockers.push(...plan.blockers); preparedClaims = plan.claims;
    } else if (!operationBlockers.length) matches = literalMatchesWithinSpans(target0, findText, scopeResolution.spans);

    if (!operationBlockers.length && matches.length === 0) operationBlockers.push('NO_MATCHES_IN_SCOPE');
    if (operation?.expectedMatches != null && matches.length !== Number(operation.expectedMatches)) operationBlockers.push(`MATCH_COUNT_MISMATCH:${operation.expectedMatches}:${matches.length}`);
    for (const blocker of operationBlockers) blockers.push(`OPERATION:${sequence}:${blocker}`);
    if (!operationBlockers.length) {
      if (nodeName || scopeResolution?.fieldAware) claims.push(...preparedClaims);
      else for (const start of matches) claims.push(Object.freeze({ operationIndex: sequence, start, end: start + findText.length, before: findText, after: replaceText, scope: scopeResolution.scope, block: scopeResolution.block || null, authority: scopeResolution.authority || null }));
    }
    summaries.push(Object.freeze({
      sequence, status: operationBlockers.length ? 'BLOCKED' : 'VALID', scope: scopeToken,
      block: smartDocument ? smartDocument.block : operation?.block || null,
      semanticMode: smartDocument ? smartDocument.semanticMode : null,
      matchCount: matches.length, scopeAuthority: scopeResolution?.authority || null,
      scopeEvidence: scopeResolution?.evidence || null, blockers: Object.freeze(operationBlockers),
    }));
  });

  blockers.push(...overlapBlockers(claims));
  return Object.freeze({
    status: blockers.length ? 'FAIL' : 'PASS', sourceHash: sourceByteLength == null ? null : sha256CiiByteString(target0),
    sourceLength: target0.length, claims: Object.freeze(claims), operationSummaries: Object.freeze(summaries), blockers: Object.freeze(blockers),
  });
}

function expectedByteAt(target0, claim, index) {
  if (!claim || index < claim.start || index >= claim.end) return target0[index];
  return claim.after[index - claim.start];
}

export function validateFindReplacePostimage(target0Input, target1Input, preimageValidation) {
  const target0 = String(target0Input ?? ''); const target1 = String(target1Input ?? '');
  const blockers = [];
  if (preimageValidation?.status !== 'PASS') blockers.push('PREIMAGE_VALIDATION_NOT_PASS');
  if (target0.length !== target1.length) blockers.push(`POSTIMAGE_LENGTH_CHANGED:${target0.length}:${target1.length}`);
  if (preimageValidation?.sourceHash && sha256CiiByteString(target0) !== preimageValidation.sourceHash) blockers.push('TARGET0_HASH_CHANGED');
  const claims = [...(preimageValidation?.claims || [])].sort((a, b) => a.start - b.start);
  let claimIndex = 0; const unexpected = []; const limit = Math.min(target0.length, target1.length);
  for (let index = 0; index < limit; index += 1) {
    while (claimIndex < claims.length && index >= claims[claimIndex].end) claimIndex += 1;
    const claim = claims[claimIndex]; const expected = expectedByteAt(target0, claim, index);
    if (target1[index] !== expected) {
      unexpected.push(Object.freeze({ index, expected, actual: target1[index] }));
      if (unexpected.length >= 20) break;
    }
  }
  if (unexpected.length) blockers.push(`UNEXPECTED_POSTIMAGE_BYTES:${unexpected.length}`);
  return Object.freeze({ status: blockers.length ? 'FAIL' : 'PASS', blockers: Object.freeze(blockers), unexpected: Object.freeze(unexpected) });
}

export const _test = Object.freeze({ byteLength, asciiLength, isNodeNameOperation, logicalNodeName, literalMatchesWithinSpans, nodeNameClaimPlan, sameNumericValue, serializeNumericLogicalValue, overlapBlockers });