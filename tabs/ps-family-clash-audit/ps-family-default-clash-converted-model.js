import {
  CONTROL_CLASH_CONVERSION_MODE,
  PS_FAMILY_DEFAULT_CLASH_CONVERSION_SCHEMA,
  STRICT_CLASH_CONVERSION_MODE,
  convertPsFamilyClashXmlToCombinedModel as convertRawModel,
} from './ps-family-default-clash-json-converter.js';

export {
  CONTROL_CLASH_CONVERSION_MODE,
  PS_FAMILY_DEFAULT_CLASH_CONVERSION_SCHEMA,
  STRICT_CLASH_CONVERSION_MODE,
};

export function convertPsFamilyClashXmlToCombinedModel(input = {}, options = {}) {
  const model = convertRawModel(input, options);
  return {
    ...model,
    objects: (model.objects || []).map(normalizeStructuralGroup),
  };
}

function normalizeStructuralGroup(object = {}) {
  if (object.type !== 'STEEL_GROUP' || !(object.children || []).length) return object;
  const children = object.children || [];
  const geometrySource = children.find((row) => hasGeometry(row.attributes)) || children[0];
  const childAttributes = geometrySource?.attributes || {};
  return {
    ...object,
    attributes: {
      ...(object.attributes || {}),
      ...(childAttributes.POS ? { POS: childAttributes.POS } : {}),
      ...(childAttributes.AXIS_START ? { AXIS_START: childAttributes.AXIS_START } : {}),
      ...(childAttributes.AXIS_END ? { AXIS_END: childAttributes.AXIS_END } : {}),
      ...(childAttributes.BOUNDS ? { BOUNDS: childAttributes.BOUNDS } : {}),
      SOURCE_STRUCTURE_CLASH_IDS: childAttributes.SOURCE_STRUCTURE_CLASH_IDS || [],
      SOURCE_STRUCTURAL_ITEMS: children
        .map((row) => row.attributes?.NAME || row.name)
        .filter(Boolean),
      CLASH_POINT_ONLY: Boolean(childAttributes.CLASH_POINT_ONLY),
      CLASH_DERIVED_GEOMETRY: Boolean(childAttributes.CLASH_DERIVED_GEOMETRY),
      NAME: object.attributes?.NAME || object.name,
    },
    children: [],
  };
}

function hasGeometry(attributes = {}) {
  return Boolean(attributes.BOUNDS || (attributes.AXIS_START && attributes.AXIS_END));
}
