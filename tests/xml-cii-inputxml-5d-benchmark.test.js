import assert from 'assert';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

class SimpleElement {
  constructor(name) {
    this.nodeName = name;
    this.localName = name;
    this._attributes = new Map();
    this.children = [];
    this.parentNode = null;
    this._textContent = '';
  }
  get attributes() { return Array.from(this._attributes.entries()).map(([name, value]) => ({ name, value })); }
  getAttribute(name) { return this._attributes.has(name) ? this._attributes.get(name) : null; }
  setAttribute(name, value) { this._attributes.set(name, String(value)); }
  hasAttribute(name) { return this._attributes.has(name); }
  appendChild(child) { child.parentNode = this; this.children.push(child); return child; }
  get textContent() { return this.children.length ? this.children.map((child) => child.textContent).join('') : this._textContent; }
  set textContent(value) { this.children = []; this._textContent = String(value ?? ''); }
}
class SimpleDocument {
  constructor(rootElement) { this.documentElement = rootElement; this.children = rootElement ? [rootElement] : []; }
  createElement(name) { return new SimpleElement(name); }
  getElementsByTagName(name) {
    const wanted = String(name).toUpperCase();
    const out = [];
    const visit = (node) => {
      if (String(node.localName || node.nodeName).toUpperCase() === wanted) out.push(node);
      for (const child of node.children || []) visit(child);
    };
    if (this.documentElement) visit(this.documentElement);
    return out;
  }
}
function decodeEntities(value) {
  return String(value).replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&gt;/g, '>').replace(/&lt;/g, '<').replace(/&amp;/g, '&');
}
function parseAttributes(attrText, element) {
  const pattern = /([A-Za-z_][\w:.-]*)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = pattern.exec(attrText))) element.setAttribute(match[1], decodeEntities(match[2]));
}
function parseXml(xmlText) {
  const tokenPattern = /<[^>]+>|[^<]+/g;
  const stack = [];
  let rootElement = null;
  let token;
  while ((token = tokenPattern.exec(String(xmlText).replace(/^\s*<\?xml[^>]*>\s*/i, '')))) {
    const part = token[0];
    if (!part.trim() || part.startsWith('<!--') || part.startsWith('<?')) continue;
    if (part.startsWith('</')) { stack.pop(); continue; }
    if (!part.startsWith('<')) { if (stack.length) stack[stack.length - 1]._textContent += decodeEntities(part); continue; }
    const selfClosing = /\/\>\s*$/.test(part);
    const body = part.slice(1, selfClosing ? -2 : -1).trim();
    const nameMatch = body.match(/^([^\s/>]+)/);
    if (!nameMatch) continue;
    const element = new SimpleElement(nameMatch[1]);
    parseAttributes(body.slice(nameMatch[1].length), element);
    if (!rootElement) rootElement = element;
    if (stack.length) stack[stack.length - 1].appendChild(element);
    if (!selfClosing) stack.push(element);
  }
  if (!rootElement) throw new Error('No root element parsed.');
  return new SimpleDocument(rootElement);
}

globalThis.DOMParser = class { parseFromString(text) { return parseXml(text); } };

const LENGTHS = [200, 150, 180, 220, 300, 250, 175, 210, 160, 190, 205, 230, 155, 240, 185, 260, 170, 215, 195, 225];
const PROPERTY_BY_ELEMENT = new Map([[5, 'RIGID'], [8, 'BEND'], [12, 'SIF'], [15, 'RESTRAINT']]);
function elementXml(fromNode, toNode, lengthMm, index, rev2 = false) {
  const isShort = index >= 100;
  const name = isShort ? `SHORT-${index}` : `E-${String(index).padStart(2, '0')}`;
  const tag = rev2 && index === 14 ? 'TAG-14-REV2-MISMATCH' : isShort ? `SHORT-${index}` : `TAG-${String(index).padStart(2, '0')}`;
  const attrs = [
    `FROM_NODE="${fromNode}"`,
    `TO_NODE="${toNode}"`,
    `DELTA_X="${Number(lengthMm).toFixed(3)}"`,
    'DELTA_Y="0.000"',
    'DELTA_Z="0.000"',
    'DIAMETER="219.100"',
    'WALL_THICK="8.180"',
    'LINE_ID="L-5D-BENCH"',
    `NAME="${name}"`,
    `TAG="${tag}"`,
  ].join(' ');
  const property = PROPERTY_BY_ELEMENT.get(index);
  if (property === 'RIGID') return `    <PIPINGELEMENT ${attrs}>\n      <RIGID NAME="VLV-05" COMPONENT_REF="VALVE-05"/>\n    </PIPINGELEMENT>`;
  if (property === 'BEND') return `    <PIPINGELEMENT ${attrs}>\n      <BEND NAME="ELB-08" RADIUS="305.000"/>\n    </PIPINGELEMENT>`;
  if (property === 'SIF') return `    <PIPINGELEMENT ${attrs}>\n      <SIF TYPE="3" NAME="SIF-12" COMPONENT_REF="TEE-12"/>\n    </PIPINGELEMENT>`;
  if (property === 'RESTRAINT') return `    <PIPINGELEMENT ${attrs}>\n      <RESTRAINT TYPE="9" NUM="1" NAME="GUIDE-15" COMPONENT_REF="SUP-15"/>\n    </PIPINGELEMENT>`;
  return `    <PIPINGELEMENT ${attrs}/>`;
}
function inputXmlRev1() {
  const nodes = Array.from({ length: 21 }, (_, index) => 10 + index * 10);
  const rows = LENGTHS.map((length, index) => elementXml(nodes[index], nodes[index + 1], length, index + 1));
  return `<?xml version="1.0"?>\n<CAESARII XML_TYPE="Input">\n  <PIPINGMODEL NAME="5D-BENCH-REV1">\n${rows.join('\n')}\n  </PIPINGMODEL>\n</CAESARII>`;
}
function inputXmlRev2() {
  const rows = [];
  let current = 1010;
  const shortInsertions = new Map([[5, 3.0], [12, 4.0], [18, 2.5]]);
  for (let index = 1; index <= LENGTHS.length; index += 1) {
    if (shortInsertions.has(index)) {
      const shortNode = current + 1;
      rows.push(elementXml(current, shortNode, shortInsertions.get(index), 100 + index, true));
      current = shortNode;
    }
    const next = 1010 + index * 10;
    rows.push(elementXml(current, next, LENGTHS[index - 1], index, true));
    current = next;
  }
  return `<?xml version="1.0"?>\n<CAESARII XML_TYPE="Input">\n  <PIPINGMODEL NAME="5D-BENCH-REV2">\n${rows.join('\n')}\n  </PIPINGMODEL>\n</CAESARII>`;
}
function summaryRow(label, result) {
  return {
    mode: label,
    rawRev1: result.summary.referenceRawElements,
    rawRev2: result.summary.targetRawElements,
    canonicalRev1: result.summary.referenceElements,
    canonicalRev2: result.summary.targetElements,
    consumedRev2: result.summary.consumedTargetElements,
    matchedPaths: result.summary.matchedPaths,
    matchedElements: result.summary.matchedElements,
    high: result.summary.highConfidenceElements,
    medium: result.summary.mediumConfidenceElements,
    evidenceConflicts: result.summary.evidenceConflictElements,
    transferPreview: result.summary.transferPreviewElements,
    conflicts: result.summary.conflictCount,
  };
}

(async () => {
  const { compareInputXmlTopology } = await import(pathToFileURL(path.join(root, 'tabs/model-converters/xml-cii-inputxml-compare-core.js')).href);
  const rev1 = inputXmlRev1();
  const rev2 = inputXmlRev2();
  const auditOnly = compareInputXmlTopology(rev1, rev2, {
    lengthToleranceMm: 6,
    shortElementToleranceMm: 6,
    minCandidateScore: 35,
    useDiameterRatioEvidence: true,
    useNameEvidence: true,
    useAnchorCoordinateEvidence: true,
    applySupplementalEvidenceScore: false,
    downgradeOnSupplementalConflict: false,
    upgradeWithCleanSupplementalEvidence: false,
    auditSupplementalEvidenceConflicts: true,
  });
  const strictEvidence = compareInputXmlTopology(rev1, rev2, {
    lengthToleranceMm: 6,
    shortElementToleranceMm: 6,
    minCandidateScore: 35,
    useDiameterRatioEvidence: true,
    useNameEvidence: true,
    useAnchorCoordinateEvidence: true,
    applySupplementalEvidenceScore: true,
    downgradeOnSupplementalConflict: true,
    upgradeWithCleanSupplementalEvidence: true,
    auditSupplementalEvidenceConflicts: true,
  });

  assert.strictEqual(auditOnly.mode, 'element-wise-canonical-path-aligned-configurable-evidence');
  assert.strictEqual(auditOnly.summary.referenceRawElements, 20, 'Rev-1 benchmark must contain 20 raw elements.');
  assert.strictEqual(auditOnly.summary.targetRawElements, 23, 'Rev-2 benchmark must contain 20 route elements plus three inserted short elements.');
  assert.strictEqual(auditOnly.summary.referenceElements, 20, 'Rev-1 canonical element count must remain 20.');
  assert.strictEqual(auditOnly.summary.targetElements, 20, 'Rev-2 canonical element count must reduce back to 20.');
  assert.strictEqual(auditOnly.summary.consumedTargetElements, 3, 'Rev-2 must consume three short elements at <=6mm.');
  assert(auditOnly.summary.matchedElements >= 18, `Expected at least 18 matched elements, got ${auditOnly.summary.matchedElements}.`);
  assert(auditOnly.summary.transferPreviewElements >= 18, `Expected at least 18 transfer-preview rows, got ${auditOnly.summary.transferPreviewElements}.`);
  assert(auditOnly.summary.evidenceConflictElements >= 1, 'Rev-2 intentionally changes one tag; evidence conflict must be audited.');
  assert(strictEvidence.summary.matchedElements >= 18, `Strict evidence must not kill route matching; got ${strictEvidence.summary.matchedElements}.`);
  assert(strictEvidence.summary.transferPreviewElements >= 15, `Strict evidence should still preserve most transfer previews; got ${strictEvidence.summary.transferPreviewElements}.`);

  const rows = [summaryRow('audit-only', auditOnly), summaryRow('strict-evidence', strictEvidence)];
  console.table(rows);
  console.log(JSON.stringify({ auditOnly: auditOnly.summary, strictEvidence: strictEvidence.summary }, null, 2));
  console.log('5D InputXML 20-element benchmark checks passed.');
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
