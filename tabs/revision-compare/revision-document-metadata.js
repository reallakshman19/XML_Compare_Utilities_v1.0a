/** Pure staged-document metadata extraction for trusted revision preflight. */

import { cleanText, deepFreeze } from './revision-contract-utils.js';

const SEQUENTIAL_SKETCHER_SOURCE_PROFILE = deepFreeze({
  authority: 'BOUNDED_PRODUCT_COMPATIBILITY_PROFILE',
  profileId: 'sequential-sketcher-source-array/mm-plant-z/v1',
  stagedSchema: 'sequential-sketcher-source-array/v1',
  fields: {
    unit: 'MM',
    coordinateFrame: 'PLANT',
    verticalAxis: 'Z',
  },
  explanation: 'Sequential Sketcher source arrays use millimetres in the PLANT frame with Z vertical.',
});

function record(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function declared(values) {
  for (const value of values) {
    const result = cleanText(value);
    if (result) return result;
  }
  return 'UNKNOWN';
}

function itemType(value) {
  const source = record(value);
  const attributes = record(source.attributes);
  return cleanText(source.type || source.TYPE || attributes.TYPE).toUpperCase();
}

function componentList(branch) {
  if (Array.isArray(branch?.children)) return branch.children;
  if (Array.isArray(branch?.components)) return branch.components;
  return [];
}

function finiteObjectPoint(value) {
  const source = record(value);
  return ['x', 'y', 'z'].every((key) => Object.hasOwn(source, key)
    && Number.isFinite(Number(source[key])));
}

function hasAny(source, keys) {
  return keys.some((key) => Object.hasOwn(source, key));
}

function branchHasSequentialEvidence(branch) {
  const attributes = record(branch?.attributes);
  const children = componentList(branch);
  const branchGeometry = ['HPOS', 'TPOS'].some((key) => finiteObjectPoint(attributes[key]));
  const childGeometry = children.some((child) => {
    const childAttributes = record(child?.attributes);
    return ['APOS', 'LPOS', 'BPOS', 'POS'].some((key) => finiteObjectPoint(childAttributes[key]));
  });
  const branchSemantics = hasAny(attributes, ['HREF', 'TREF', 'HBOR', 'TBOR']);
  const childSemantics = children.some((child) => hasAny(
    record(child?.attributes), ['CREF', 'LBORE', 'ROUTE_TIER', 'AUTO_GENERATED_PIPE'],
  ));
  return (branchGeometry || childGeometry) && (branchSemantics || childSemantics);
}

function inferredProfile(document) {
  if (!Array.isArray(document) || !document.length) return null;
  if (!document.every((item) => itemType(item) === 'BRANCH')) return null;
  return document.some(branchHasSequentialEvidence) ? SEQUENTIAL_SKETCHER_SOURCE_PROFILE : null;
}

export function stagedDocumentMetadata(document) {
  const root = record(document);
  const metadata = record(root.metadata);
  const coordinates = record(root.coordinateSystem);
  const profile = inferredProfile(document);
  return deepFreeze({
    stagedSchema: declared([
      root.stagedSchema, metadata.stagedSchema, root.schema, metadata.schema, profile?.stagedSchema,
    ]),
    unit: declared([root.unit, root.units, metadata.unit, metadata.units, profile?.fields.unit]),
    verticalAxis: declared([
      root.verticalAxis, root.upAxis, metadata.verticalAxis, coordinates.upAxis, profile?.fields.verticalAxis,
    ]),
    coordinateFrame: declared([
      root.coordinateFrame, root.frame, metadata.coordinateFrame, coordinates.name, profile?.fields.coordinateFrame,
    ]),
    profile,
  });
}
