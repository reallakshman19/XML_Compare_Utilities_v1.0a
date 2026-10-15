/** Deterministic NOT_RUN/RUNNING/PASS/FAIL/STALE topology parity state. */
import { cleanText, deepFreeze, objectRecord } from './topology-validator-values.js';

export const TOPOLOGY_PARITY_STATUSES = Object.freeze(['NOT_RUN', 'RUNNING', 'PASS', 'FAIL', 'STALE']);

function hashEvidence(artifacts) {
  const canonical = objectRecord(artifacts.canonical);
  const ledger = objectRecord(artifacts.ledger);
  const scene = objectRecord(artifacts.scene);
  const parsed = objectRecord(artifacts.parsed);
  const report = objectRecord(artifacts.report);
  return deepFreeze({
    canonicalTopologyHash: cleanText(canonical.canonicalTopologyHashSha256 || canonical.canonicalTopologyHash),
    ledgerCanonicalTopologyHash: cleanText(ledger.canonicalTopologyHash),
    topologyTraceLedgerHash: cleanText(ledger.topologyTraceLedgerHash),
    sceneCanonicalTopologyHash: cleanText(scene.canonicalTopologyHash),
    svgSceneHash: cleanText(scene.svgSceneHash),
    parsedCanonicalTopologyHash: cleanText(parsed.canonicalTopologyHashSha256 || parsed.canonicalTopologyHash),
    inputXmlHash: cleanText(parsed.inputXmlHashSha256 || parsed.inputXmlHash),
    parsedInputXmlTopologyHash: cleanText(parsed.parsedInputXmlTopologyHashSha256 || parsed.parsedInputXmlTopologyHash),
    reportCanonicalTopologyHash: cleanText(report.canonicalTopologyHashSha256 || report.canonicalTopologyHash),
    reportTopologyTraceLedgerHash: cleanText(report.topologyTraceLedgerHash),
    reportSvgSceneHash: cleanText(report.svgSceneHash),
    reportInputXmlHash: cleanText(report.inputXmlHashSha256 || report.inputXmlHash),
    reportParsedInputXmlTopologyHash: cleanText(report.parsedInputXmlTopologyHashSha256 || report.parsedInputXmlTopologyHash),
  });
}

function staleReasons(evidence) {
  const reasons = [];
  const requireEqual = (label, left, right) => {
    if (!left || !right || left !== right) reasons.push({ label, expected: left, actual: right });
  };
  requireEqual('ledger canonical topology hash', evidence.canonicalTopologyHash, evidence.ledgerCanonicalTopologyHash);
  requireEqual('scene canonical topology hash', evidence.canonicalTopologyHash, evidence.sceneCanonicalTopologyHash);
  requireEqual('parsed InputXML canonical topology hash', evidence.canonicalTopologyHash, evidence.parsedCanonicalTopologyHash);
  requireEqual('report canonical topology hash', evidence.canonicalTopologyHash, evidence.reportCanonicalTopologyHash);
  requireEqual('report ledger hash', evidence.topologyTraceLedgerHash, evidence.reportTopologyTraceLedgerHash);
  requireEqual('report scene hash', evidence.svgSceneHash, evidence.reportSvgSceneHash);
  requireEqual('report InputXML hash', evidence.inputXmlHash, evidence.reportInputXmlHash);
  requireEqual('report parsed InputXML topology hash', evidence.parsedInputXmlTopologyHash, evidence.reportParsedInputXmlTopologyHash);
  return reasons;
}

export function buildTopologyParityState(artifacts, options = {}) {
  if (options.running === true) return deepFreeze({ status: 'RUNNING', stale: false, reasons: [], evidence: hashEvidence(artifacts) });
  const required = ['canonical', 'ledger', 'scene', 'parsed', 'report'];
  const missing = required.filter((key) => !artifacts[key]);
  const evidence = hashEvidence(artifacts);
  if (missing.length) return deepFreeze({ status: 'NOT_RUN', stale: false, missing, reasons: [], evidence });
  const reasons = staleReasons(evidence);
  if (reasons.length) return deepFreeze({ status: 'STALE', stale: true, missing: [], reasons, evidence });
  const report = objectRecord(artifacts.report);
  const reportPass = report.schema === 'TopologyParityReport.v2'
    ? cleanText(report.status) === 'PASS'
    : report.ok === true && cleanText(report.status) === 'PASS';
  const status = reportPass ? 'PASS' : 'FAIL';
  return deepFreeze({ status, stale: false, missing: [], reasons: [], evidence });
}

export const _test = Object.freeze({ hashEvidence, staleReasons });
