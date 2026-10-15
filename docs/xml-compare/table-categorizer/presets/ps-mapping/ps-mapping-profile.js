import {
  PS_MAPPING_COORDINATE_LOOKUP_SAMPLE,
  PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE,
  PS_MAPPING_TABLE_2_MODEL_SAMPLE,
  PS_MAPPING_TABLE_2_SAMPLE,
  PS_MAPPING_TABLE_2_SHADOW_PROFILE,
} from '../../table-categorized-xml-pilot-profiles.js';

export const PS_MAPPING_PRESET_SCHEMA = 'table-categorizer-ps-mapping-preset/v1';

export function createPsMappingPreset() {
  return Object.freeze({
    schema: PS_MAPPING_PRESET_SCHEMA,
    profile: PS_MAPPING_TABLE_2_SHADOW_PROFILE,
    coordinateLookupProfile: PS_MAPPING_TABLE_2_COORDINATE_LOOKUP_PROFILE,
    samples: Object.freeze({
      table2: PS_MAPPING_TABLE_2_SAMPLE,
      table2Model: PS_MAPPING_TABLE_2_MODEL_SAMPLE,
      coordinateLookup: PS_MAPPING_COORDINATE_LOOKUP_SAMPLE,
    }),
  });
}
