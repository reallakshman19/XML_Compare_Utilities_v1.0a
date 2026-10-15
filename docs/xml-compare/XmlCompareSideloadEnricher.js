import { formatCoordinate } from './XmlCompareCoordinateSideload.js';
import { applyXmlCompareSideloadWithIndex, compatibilityTestExports, tagMatchForRestraint } from './XmlCompareSideloadApply.js';
import { applyGlobalCoordinateAttributes, mutateXmlAttribute } from './XmlCompareSideloadMutation.js';
import {
  buildXmlCompareSideloadIndex,
  normalizeSideloadTables,
  popupFieldValue,
} from './XmlCompareSideloadIndex.js';

export const XML_COMPARE_SIDELOAD_ENRICHER_SCHEMA = 'xml-compare-sideload-enricher/v3';

const clean = (value) => String(value ?? '').trim();

export { buildXmlCompareSideloadIndex };

export function applyXmlCompareSideload(xmlText = '', tables = {}) {
  const index = buildXmlCompareSideloadIndex(tables);
  return applyXmlCompareSideloadWithIndex(
    String(xmlText ?? ''),
    index,
    XML_COMPARE_SIDELOAD_ENRICHER_SCHEMA,
  );
}

export function buildXmlCompareSideloadFileName(fileName = 'sideload.xml') {
  return (clean(fileName) || 'sideload.xml').replace(/(\.txt|\.xml)?$/i, '_sideloaded.xml');
}

function setAttr(openTag, name, value) {
  return mutateXmlAttribute(openTag, name, value).openTag;
}

function tagForRestraint(openTag, index) {
  return tagMatchForRestraint(openTag, index).candidate?.value || '';
}

function applyGlobalAttrs(openTag, fromPoint, toPoint, basisNode) {
  return applyGlobalCoordinateAttributes(openTag, {
    from: fromPoint,
    to: toPoint,
    basisNode,
  }, {
    format: formatCoordinate,
  }).openTag;
}

export const _test = Object.freeze({
  ...compatibilityTestExports,
  clean,
  setAttr,
  tagForRestraint,
  applyGlobalAttrs,
  normalizeTables: normalizeSideloadTables,
  popupFieldValue,
});
