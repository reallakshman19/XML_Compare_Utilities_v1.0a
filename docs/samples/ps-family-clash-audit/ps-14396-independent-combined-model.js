const branch = '/ASIM-1885-4-P8810288/B1';

export const PS_14396_INDEPENDENT_COMBINED_MODEL = Object.freeze([
  {
    name: branch,
    type: 'BRANCH',
    attributes: { NAME: branch, FULL_LINE_TAG: 'ASIM-1885-4-P8810288' },
    children: [
      {
        name: '/PIPE-14396-A',
        type: 'PIPE',
        attributes: {
          NAME: '/PIPE-14396-A',
          CARRIER_ID: '/PIPE-14396-A',
          AXIS_START: { x: 0, y: 10, z: 70 },
          AXIS_END: { x: 100, y: 10, z: 70 },
          OUTSIDE_DIAMETER: 100,
        },
        children: [
          member('/PS-14396.4', 0, 20, 'PIPE SHOE'),
          member('/PS-14396.8', 20, 40, 'BRACKET'),
          member('/PS-14396.9', 40, 60, 'BRACKET'),
          member('/PS-14396.10', 60, 80, 'WEAR PLATE'),
        ],
      },
      {
        name: '/PIPE-14396-B',
        type: 'PIPE',
        attributes: {
          NAME: '/PIPE-14396-B',
          CARRIER_ID: '/PIPE-14396-B',
          AXIS_START: { x: 100, y: 10, z: 70 },
          AXIS_END: { x: 200, y: 10, z: 70 },
          OUTSIDE_DIAMETER: 100,
        },
      },
    ],
  },
  {
    name: '/PS-14396',
    type: 'STEEL_GROUP',
    attributes: { NAME: '/PS-14396', DESCRIPTION: 'INDEPENDENT STRUCTURAL STEEL FIXTURE' },
    children: [{
      name: '/PS-14396/BEAM-01',
      type: 'SCTN',
      attributes: {
        NAME: '/PS-14396/BEAM-01',
        DTXR: 'STEEL SECTION',
        BOUNDS: { min: { x: 40, y: 0, z: -10 }, max: { x: 80, y: 20, z: 0 } },
      },
    }],
  },
]);

function member(name, minX, maxX, role) {
  return {
    name,
    type: 'ATTA',
    attributes: {
      NAME: name,
      OWNER: branch,
      STEEL_REF: '/PS-14396',
      DTXR: role,
      BOUNDS: { min: { x: minX, y: 0, z: 0 }, max: { x: maxX, y: 20, z: 20 } },
    },
  };
}
