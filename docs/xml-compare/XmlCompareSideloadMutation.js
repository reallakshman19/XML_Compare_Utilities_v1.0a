import { createSideloadDiagnostic } from './XmlCompareSideloadDiagnostics.js';

const clean = (value) => String(value ?? '').trim();

export function xmlAttributeEscape(value) {
  return clean(value)
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

export function attrValue(openTag, name) {
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)')`, 'i');
  const match = String(openTag).match(pattern);
  return match ? clean(match[1] ?? match[2] ?? '') : '';
}

function writeAttribute(openTag, name, value) {
  const encoded = xmlAttributeEscape(value);
  const pattern = new RegExp(`\\s${name}\\s*=\\s*(?:"[^"]*"|'[^']*')`, 'i');
  if (pattern.test(openTag)) return openTag.replace(pattern, ` ${name}="${encoded}"`);
  const selfClosing = /\/>$/.test(openTag);
  const head = openTag.replace(/\s*\/?>$/, '');
  return `${head} ${name}="${encoded}"${selfClosing ? '/>' : '>'}`;
}

function mutationCode(action) {
  if (action === 'added') return 'SIDELOAD_ATTRIBUTE_ADDED';
  if (action === 'replaced') return 'SIDELOAD_ATTRIBUTE_REPLACED';
  return 'SIDELOAD_ATTRIBUTE_UNCHANGED';
}

function skippedMutation(openTag, name, metadata) {
  return Object.freeze({
    openTag,
    applied: false,
    diagnostic: createSideloadDiagnostic({
      severity: 'WARNING', code: 'SIDELOAD_FIELD_EMPTY',
      message: `${name} was not written because the source value is empty.`,
      stage: 'xml-mutation', sourceField: metadata.sourceField,
      outputField: name, sourceRow: metadata.sourceRow,
      element: metadata.element, action: 'skipped', context: metadata.context,
    }),
  });
}

export function mutateXmlAttribute(openTag, name, value, metadata = {}) {
  const nextValue = clean(value);
  if (!nextValue) return skippedMutation(openTag, name, metadata);
  const previousValue = attrValue(openTag, name);
  const action = previousValue
    ? (previousValue === nextValue ? 'unchanged' : 'replaced')
    : 'added';
  const nextTag = action === 'unchanged' ? openTag : writeAttribute(openTag, name, nextValue);
  const diagnostic = createSideloadDiagnostic({
    severity: 'INFO', code: mutationCode(action),
    message: `${name} ${action} by sideload enrichment.`,
    stage: 'xml-mutation', sourceField: metadata.sourceField,
    outputField: name, sourceRow: metadata.sourceRow,
    element: metadata.element, action,
    context: { previousValue, nextValue, ...(metadata.context || {}) },
  });
  return Object.freeze({ openTag: nextTag, applied: true, action, diagnostic });
}

export function applyGlobalCoordinateAttributes(openTag, coordinate, metadata = {}) {
  const fields = [
    ['FROM_GLOBAL_X', coordinate?.from?.x],
    ['FROM_GLOBAL_Y', coordinate?.from?.y],
    ['FROM_GLOBAL_Z', coordinate?.from?.z],
    ['TO_GLOBAL_X', coordinate?.to?.x],
    ['TO_GLOBAL_Y', coordinate?.to?.y],
    ['TO_GLOBAL_Z', coordinate?.to?.z],
    ['GLOBAL_COORD_BASIS_NODE', coordinate?.basisNode],
  ];
  let nextTag = openTag;
  const diagnostics = [];
  for (const [name, value] of fields) {
    const nextValue = name === 'GLOBAL_COORD_BASIS_NODE'
      ? clean(value)
      : metadata.format(value);
    const result = mutateXmlAttribute(nextTag, name, nextValue, {
      ...metadata,
      sourceField: 'coordinateText',
      context: { basisNode: coordinate?.basisNode },
    });
    nextTag = result.openTag;
    diagnostics.push(result.diagnostic);
  }
  return Object.freeze({ openTag: nextTag, diagnostics: Object.freeze(diagnostics) });
}

export const _test = Object.freeze({ clean, writeAttribute, mutationCode });
