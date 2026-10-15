import {
  parseSupportReportClashXml as parseClashEvidence,
} from './support-report-clash-evidence.js?v=20260911-support-report-typicality-rca-1&perf=20260913-support-report-large-xml-1';
import {
  groupSupportReportEvidenceByLocation,
} from './support-report-location-grouping.js?v=20260915-support-report-bore-axis-occurrence-1';
import { decodeXmlEntities } from '../ps-family-clash-audit/ps-family-token-utils.js';

const BRANCH_SUFFIX_RE = /\/B(?:RANCH)?[-_A-Z0-9.]*$/iu;
const PIPE_LINE_RE = /-\d+(?:\.\d+)?"-[A-Z]+-?\d[A-Z0-9]*(?:-|$)/iu;

export function groupSupportReportClashEvidence(rows = [], options = {}) {
  return groupSupportReportEvidenceByLocation(rows, options);
}

export function parseSupportReportClashXml(xmlText, options = {}) {
  const source = String(xmlText || '');
  const tests = extractClashTests(source);
  if (!tests.length) return regroup(parseClashEvidence(source, options), options);

  const sourceUnits = exchangeUnits(source) || options.sourceUnits || 'm';
  const rawClashes = [];
  const rows = [];
  const diagnostics = [];
  for (const test of tests) {
    const parsed = parseClashEvidence(test.body, { ...options, sourceUnits });
    for (const rawClash of parsed.rawClashes || []) {
      rawClashes.push(Object.freeze({
        ...rawClash,
        clashTestName: test.name,
        clashTestGuid: test.guid,
        clashTestIndex: test.index,
      }));
    }
    for (const parsedRow of parsed.rows || []) {
      const row = canonicalizePipeLine(parsedRow);
      rows.push(Object.freeze({
        ...row,
        clashTestName: test.name,
        clashTestGuid: test.guid,
        clashTestIndex: test.index,
      }));
    }
    for (const item of parsed.diagnostics || []) {
      diagnostics.push(Object.freeze({
        ...item,
        clashTestName: test.name,
        clashTestGuid: test.guid,
        clashTestIndex: test.index,
      }));
    }
  }
  const groups = groupSupportReportClashEvidence(rows, options);
  return Object.freeze({
    schema: rows[0]?.schema || parseClashEvidence('', options).schema,
    sourceUnits,
    clashTestCount: tests.length,
    rawClashCount: rawClashes.length,
    rowCount: rows.length,
    groupCount: groups.length,
    rawClashes,
    rows,
    groups,
    diagnostics,
  });
}

function regroup(parsed, options) {
  const rows = Object.freeze((parsed?.rows || []).map(canonicalizePipeLine));
  const groups = groupSupportReportClashEvidence(rows, options);
  return Object.freeze({ ...parsed, rowCount: rows.length, rows, groupCount: groups.length, groups });
}

function canonicalizePipeLine(row) {
  const canonical = canonicalPipeLineTag(row?.primaryPath, row?.branchNode, row?.fullLineTag);
  if (!canonical || canonical === row?.fullLineTag) return row;
  return Object.freeze({ ...row, fullLineTag: canonical });
}

function canonicalPipeLineTag(path = [], branchNode = '', fallback = '') {
  const nodes = (path || []).map(cleanNode).filter(Boolean);
  const branch = cleanNode(branchNode);
  let branchIndex = branch ? nodes.lastIndexOf(branch) : -1;
  if (branchIndex < 0) branchIndex = nodes.findIndex((node) => BRANCH_SUFFIX_RE.test(node));
  const ancestors = branchIndex >= 0 ? nodes.slice(0, branchIndex) : nodes;
  const canonical = [...ancestors].reverse().find((node) => PIPE_LINE_RE.test(node) && !BRANCH_SUFFIX_RE.test(node));
  return canonical || cleanNode(fallback);
}

function extractClashTests(source) {
  const tests = [];
  const regex = /<clashtest\b([^>]*)>([\s\S]*?)<\/clashtest>/gi;
  let match;
  while ((match = regex.exec(source))) {
    const attrs = parseAttributes(match[1]);
    tests.push(Object.freeze({
      index: tests.length,
      name: attrs.name || `ClashTest${tests.length + 1}`,
      guid: attrs.guid || '',
      body: match[2],
    }));
  }
  return tests;
}

function exchangeUnits(source) {
  const match = source.match(/<exchange\b([^>]*)>/i);
  return match ? parseAttributes(match[1]).units || '' : '';
}
function parseAttributes(raw) {
  const attrs = {};
  const regex = /([\w:-]+)\s*=\s*"([^"]*)"/g;
  let match;
  while ((match = regex.exec(String(raw || '')))) attrs[match[1]] = decodeXmlEntities(match[2]);
  return attrs;
}
function cleanNode(value) { return String(value || '').trim().replace(/^\/+/, ''); }

export const _test = Object.freeze({
  canonicalPipeLineTag,
  canonicalizePipeLine,
  extractClashTests,
  exchangeUnits,
  regroup,
});