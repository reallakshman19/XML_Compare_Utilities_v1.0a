import { categorizedInputXmlToInputXml } from '../CategorizedInputXmlConverter.js';

const clean = (value) => String(value ?? '').trim();

export function sourceEvidenceFileName(name = 'categorized.xml') {
  const base = clean(name || 'categorized.xml').replace(/\.(xml|txt)$/i, '');
  return `${base}_source_evidence.input.xml`;
}

export function pipingElementCount(text = '') {
  return (String(text ?? '').match(/<PIPINGELEMENT\b/gi) || []).length;
}

export function buildSourceEvidenceArtifact({ content = '', filename = 'categorized.xml' } = {}) {
  const text = categorizedInputXmlToInputXml(content);
  return Object.freeze({
    id: 'source-inputxml',
    role: 'source-evidence-reconstruction',
    filename: sourceEvidenceFileName(filename),
    mediaType: 'application/xml',
    text,
    pipingElementCount: pipingElementCount(text),
  });
}

export const _test = Object.freeze({ clean });
