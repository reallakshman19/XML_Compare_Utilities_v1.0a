/**
 * Reads producer-owned topology parity artifacts without repairing identities or
 * reconstructing topology. Inputs are parsed JSON values; outputs are immutable
 * read models retaining every producer field.
 */

import { asArray, cleanText, deepFreeze, objectRecord, strictPoint } from './topology-validator-values.js';

function requireSchema(value, expected) {
  const record = objectRecord(value);
  if (cleanText(record.schema) !== expected) throw new TypeError(`Expected ${expected}; received ${cleanText(record.schema) || '(missing schema)'}.`);
  return record;
}

function requireText(record, field, schema) {
  const value = cleanText(record[field]);
  if (!value) throw new TypeError(`${schema}.${field} is required.`);
  return value;
}

function requireHashText(record, legacyField, shaField, schema) {
  const field = cleanText(record[shaField]) ? shaField : legacyField;
  return requireText(record, field, schema);
}

function validateScene(scene) {
  requireText(scene, 'canonicalTopologyHash', scene.schema);
  requireText(scene, 'svgSceneHash', scene.schema);
  for (const node of asArray(scene.nodes).map(objectRecord)) {
    requireText(node, 'canonicalNodeId', 'TopologySvgScene.v1 node');
    if (!strictPoint(node.position)) throw new TypeError(`TopologySvgScene node ${node.id || node.canonicalNodeId} has invalid world coordinates.`);
  }
  for (const edge of asArray(scene.edges).map(objectRecord)) {
    requireText(edge, 'canonicalEdgeId', 'TopologySvgScene.v1 edge');
    requireText(edge, 'fromCanonicalNodeId', 'TopologySvgScene.v1 edge');
    requireText(edge, 'toCanonicalNodeId', 'TopologySvgScene.v1 edge');
    if (!strictPoint(edge.fromPosition) || !strictPoint(edge.toPosition)) throw new TypeError(`TopologySvgScene edge ${edge.id || edge.canonicalEdgeId} has invalid world geometry.`);
  }
}

function validateParsed(parsed) {
  requireHashText(parsed, 'inputXmlHash', 'inputXmlHashSha256', parsed.schema);
  requireHashText(parsed, 'parsedInputXmlTopologyHash', 'parsedInputXmlTopologyHashSha256', parsed.schema);
  const hashAnchoredShape = Boolean(cleanText(parsed.inputXmlHashSha256));
  for (const element of asArray(parsed.elements).map(objectRecord)) {
    requireText(element, 'id', 'ParsedInputXmlTopology.v1 element');
    if (!hashAnchoredShape) {
      requireText(element, 'canonicalEdgeId', 'ParsedInputXmlTopology.v1 element');
      requireText(element, 'fromCanonicalNodeId', 'ParsedInputXmlTopology.v1 element');
      requireText(element, 'toCanonicalNodeId', 'ParsedInputXmlTopology.v1 element');
    } else {
      requireText(element, 'fromNodeId', 'ParsedInputXmlTopology.v1 element');
      requireText(element, 'toNodeId', 'ParsedInputXmlTopology.v1 element');
    }
  }
}

function validateReport(report) {
  requireHashText(report, 'canonicalTopologyHash', 'canonicalTopologyHashSha256', report.schema);
  requireHashText(report, 'inputXmlHash', 'inputXmlHashSha256', report.schema);
  requireText(report, 'svgSceneHash', report.schema);
  requireHashText(report, 'topologyParityReportHash', 'topologyParityReportHashSha256', report.schema);
  const allowed = report.schema === 'TopologyParityReport.v2' ? ['PASS', 'BLOCKED'] : ['PASS', 'FAIL'];
  if (!allowed.includes(cleanText(report.status))) throw new TypeError(`${report.schema} status is invalid: ${report.status}.`);
  if (report.schema === 'TopologyParityReport.v1' && typeof report.ok !== 'boolean') throw new TypeError('TopologyParityReport.v1.ok must be boolean.');
  if (!Number.isInteger(Number(objectRecord(report.summary).topologyMismatchCount))) throw new TypeError(`${report.schema}.summary.topologyMismatchCount is required.`);
}

export function readTopologySvgScene(value) {
  const scene = requireSchema(value, 'TopologySvgScene.v1');
  validateScene(scene);
  return deepFreeze(scene);
}

export function readParsedInputXmlTopology(value) {
  const parsed = requireSchema(value, 'ParsedInputXmlTopology.v1');
  validateParsed(parsed);
  return deepFreeze(parsed);
}

export function readTopologyParityReport(value) {
  const schema = cleanText(objectRecord(value).schema);
  const report = requireSchema(value, schema === 'TopologyParityReport.v2' ? schema : 'TopologyParityReport.v1');
  validateReport(report);
  return deepFreeze(report);
}

export function topologyEvidenceClassification(value) {
  const schema = cleanText(objectRecord(value).schema);
  return schema === 'TopologyParityReport.v2' ? 'RELEASE_EVIDENCE_V2' : 'LEGACY_UNVERIFIED';
}

export const _test = Object.freeze({ requireSchema, requireText, requireHashText, validateScene, validateParsed, validateReport });
