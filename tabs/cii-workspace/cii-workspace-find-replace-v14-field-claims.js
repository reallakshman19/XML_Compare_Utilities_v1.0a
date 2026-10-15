import { parseFortranNumber } from '../../parser/fixed-field.js';

function literalOffsets(body, needle) {
  const offsets = [];
  let offset = 0;
  while (needle && offset <= body.length - needle.length) {
    const found = body.indexOf(needle, offset);
    if (found < 0) break;
    offsets.push(found);
    offset = found + needle.length;
  }
  return offsets;
}

function numericPostimageBlocker(beforeField, offsets, findText, replaceText, fieldIdentity) {
  let afterField = beforeField;
  for (const offset of offsets) {
    afterField = `${afterField.slice(0, offset)}${replaceText}${afterField.slice(offset + findText.length)}`;
  }
  return Number.isFinite(parseFortranNumber(afterField))
    ? null
    : `NUMERIC_FIELD_POSTIMAGE_INVALID:${fieldIdentity || 'UNKNOWN'}`;
}

export function fieldAwareClaimPlan(target0, findText, replaceText, spans, sequence, scopeResolution) {
  const matches = [];
  const blockers = [];
  const claims = [];
  for (const span of spans || []) {
    const start = Number(span?.start); const end = Number(span?.end);
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)
      || start < 0 || end <= start || end > target0.length) continue;
    const beforeField = target0.slice(start, end);
    const offsets = literalOffsets(beforeField, findText);
    if (!offsets.length) continue;
    if (span.fieldKind === 'NUMERIC') {
      const blocker = numericPostimageBlocker(
        beforeField, offsets, findText, replaceText, span.fieldIdentity,
      );
      if (blocker) blockers.push(blocker);
    }
    for (const offset of offsets) {
      const matchStart = start + offset;
      matches.push(matchStart);
      claims.push(Object.freeze({
        operationIndex: sequence,
        start: matchStart,
        end: matchStart + findText.length,
        before: findText,
        after: replaceText,
        scope: scopeResolution.scope,
        block: scopeResolution.block || null,
        authority: scopeResolution.authority || null,
        fieldIdentity: span.fieldIdentity || null,
        fieldKind: span.fieldKind || null,
      }));
    }
  }
  return { matches, blockers, claims };
}

export const _test = Object.freeze({ literalOffsets, numericPostimageBlocker });
