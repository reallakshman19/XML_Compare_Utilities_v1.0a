export const SUPPORT_STEEL_SAMPLE_SUPPORT = Object.freeze([
  {
    name: '/ASIM-1836-6"-P9001001/B1',
    type: 'BRANCH',
    attributes: { NAME: '/ASIM-1836-6"-P9001001/B1' },
    children: [
      {
        name: 'SUPPORT PS-14259',
        type: 'ATTA',
        attributes: {
          NAME: '/PS-14259/DATUM',
          OWNER: '/ASIM-1836-6"-P9001001/B1',
          POS: { x: 437500, y: -1159000, z: 2100 },
          SUPPORT_TAG: 'PS-14259',
          STRUCTURE_REF: '/SL-4201',
          CMPSUPTYPE: 'REST',
        },
      },
      {
        name: 'SUPPORT PS-14259',
        type: 'ATTA',
        attributes: {
          NAME: '/PS-14259.1',
          OWNER: '/ASIM-1836-6"-P9001001/B1',
          POS: { x: 437500, y: -1159000, z: 2181 },
          BOUNDS: {
            min: { x: 437430, y: -1159075, z: 2106 },
            max: { x: 437570, y: -1158925, z: 2256 },
          },
          CMPSUPTYPE: 'SH-150',
          DTXR: 'PIPE SHOE SH-150',
        },
      },
      {
        name: 'SUPPORT PS-14259',
        type: 'ATTA',
        attributes: {
          NAME: '/PS-14259.2',
          OWNER: '/ASIM-1836-6"-P9001001/B1',
          POS: { x: 437500, y: -1159000, z: 2103 },
          BOUNDS: {
            min: { x: 437350, y: -1159080, z: 2100 },
            max: { x: 437650, y: -1158920, z: 2106 },
          },
          CMPSUPTYPE: 'W.PAD THK 6mm',
          DTXR: 'WEAR PLATE TYPE-421 PAD L 550mm',
        },
      },
    ],
  },
  {
    name: '/ASIM-1836-4"-P9001002/B3',
    type: 'BRANCH',
    attributes: { NAME: '/ASIM-1836-4"-P9001002/B3' },
    children: [
      {
        name: 'SUPPORT PS-14259',
        type: 'ATTA',
        attributes: {
          NAME: '/PS-14259/SREF',
          OWNER: '/ASIM-1836-4"-P9001002/B3',
          POS: { x: 437500, y: -1159000, z: 2100 },
          STEEL_REF: '/SL-4201',
          DTXR: 'STRUCTURAL REFERENCE',
        },
      },
      {
        name: 'SUPPORT PS-14260',
        type: 'ATTA',
        attributes: {
          NAME: '/PS-14260/DATUM',
          OWNER: '/ASIM-1836-4"-P9001002/B3',
          POS: { x: 438050, y: -1159500, z: 2100 },
          CMPSUPTYPE: 'REST',
        },
      },
    ],
  },
]);

export const SUPPORT_STEEL_SAMPLE_STEEL = Object.freeze([
  {
    name: '/SL-4201',
    type: 'STEEL_GROUP',
    attributes: {
      NAME: '/SL-4201',
      POS: { x: 437500, y: -1159000, z: 2100 },
      DESCRIPTION: 'PIPE SUPPORT STEEL GROUP',
    },
    children: [
      {
        name: '/SL-4201/BEAM-01',
        type: 'SCTN',
        attributes: {
          NAME: '/SL-4201/BEAM-01',
          POS: { x: 437500, y: -1159000, z: 2050 },
          AXIS_START: { x: 437250, y: -1159000, z: 2050 },
          AXIS_END: { x: 437750, y: -1159000, z: 2050 },
          BOUNDS: {
            min: { x: 437250, y: -1159050, z: 2000 },
            max: { x: 437750, y: -1158950, z: 2100 },
          },
          DTXR: 'STEEL SECTION',
        },
      },
    ],
  },
  {
    name: '/SL-4202',
    type: 'STEEL_GROUP',
    attributes: {
      NAME: '/SL-4202',
      POS: { x: 438000, y: -1159500, z: 2100 },
      DESCRIPTION: 'SECONDARY STEEL GROUP WITHOUT ANALYTICAL GEOMETRY',
    },
  },
]);

export const SUPPORT_STEEL_SAMPLE_COMBINED = Object.freeze([
  ...SUPPORT_STEEL_SAMPLE_SUPPORT,
  ...SUPPORT_STEEL_SAMPLE_STEEL,
]);

export function supportSteelSampleText(kind = 'combined') {
  const value = kind === 'support'
    ? SUPPORT_STEEL_SAMPLE_SUPPORT
    : kind === 'steel'
      ? SUPPORT_STEEL_SAMPLE_STEEL
      : SUPPORT_STEEL_SAMPLE_COMBINED;
  return JSON.stringify(value, null, 2);
}
