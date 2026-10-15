import { PS_14396_INDEPENDENT_COMBINED_MODEL } from './ps-14396-independent-combined-model.js';

export const PS_FAMILY_INDEPENDENT_TRUTH_FIXTURES = Object.freeze([
  positiveFixture(),
  brokenChainFixture(),
  ambiguousSteelFixture(),
  topologyGapFixture(),
]);

function positiveFixture() {
  const model = baselineModel();
  return fixture('POSITIVE_COMPLETE_PATH', model, {
    chainEdgeKeys: [
      pair('/PS-14396.4', '/PS-14396.8'),
      pair('/PS-14396.8', '/PS-14396.9'),
      pair('/PS-14396.9', '/PS-14396.10'),
    ],
    terminalKeys: [terminal('/PS-14396.9', '/PS-14396'), terminal('/PS-14396.10', '/PS-14396')],
    completeFamilyIds: ['/PS-14396'],
    ambiguousFamilyIds: [],
    topologyConnectionCount: 1,
    requiredPathExceptionCodes: [],
  });
}

function brokenChainFixture() {
  const model = baselineModel();
  const pipeA = find(model, '/PIPE-14396-A');
  const pipeB = find(model, '/PIPE-14396-B');
  pipeA.attributes.AXIS_END = { x: 20, y: 10, z: 70 };
  pipeB.attributes.AXIS_START = { x: 20, y: 10, z: 70 };
  setBounds(find(model, '/PS-14396.8'), 35, 55, 0, 20, 0, 20);
  setBounds(find(model, '/PS-14396/BEAM-01'), 58, 80, 0, 20, -10, 0);
  return fixture('BROKEN_ATTACHMENT_TO_TERMINAL_CHAIN', model, {
    chainEdgeKeys: [pair('/PS-14396.8', '/PS-14396.9'), pair('/PS-14396.9', '/PS-14396.10')],
    terminalKeys: [terminal('/PS-14396.9', '/PS-14396'), terminal('/PS-14396.10', '/PS-14396')],
    completeFamilyIds: [],
    ambiguousFamilyIds: [],
    topologyConnectionCount: 1,
    requiredPathExceptionCodes: ['SUPPORT_CHAIN_TO_STRUCTURE_INCOMPLETE'],
  });
}

function ambiguousSteelFixture() {
  const model = baselineModel();
  const branch = model.find((row) => row.type === 'BRANCH');
  branch.children[0].children.forEach((member, index) => {
    member.attributes.STEEL_REF = index < 2 ? '/PS-14396' : '/SL-14396-ALT';
  });
  const alternate = clone(model.find((row) => row.attributes?.NAME === '/PS-14396'));
  alternate.name = '/SL-14396-ALT';
  alternate.attributes.NAME = '/SL-14396-ALT';
  alternate.children[0].name = '/SL-14396-ALT/BEAM-01';
  alternate.children[0].attributes.NAME = '/SL-14396-ALT/BEAM-01';
  model.push(alternate);
  return fixture('AMBIGUOUS_EXPLICIT_STEEL', model, {
    chainEdgeKeys: [
      pair('/PS-14396.4', '/PS-14396.8'),
      pair('/PS-14396.8', '/PS-14396.9'),
      pair('/PS-14396.9', '/PS-14396.10'),
    ],
    terminalKeys: [],
    completeFamilyIds: [],
    ambiguousFamilyIds: ['/PS-14396'],
    topologyConnectionCount: 1,
    requiredPathExceptionCodes: ['STRUCTURAL_TERMINAL_MISSING'],
  });
}

function topologyGapFixture() {
  const model = baselineModel();
  const pipeB = find(model, '/PIPE-14396-B');
  pipeB.attributes.AXIS_START = { x: 108, y: 10, z: 70 };
  pipeB.attributes.AXIS_END = { x: 208, y: 10, z: 70 };
  return fixture('DISCONNECTED_CARRIER_TOPOLOGY', model, {
    chainEdgeKeys: [
      pair('/PS-14396.4', '/PS-14396.8'),
      pair('/PS-14396.8', '/PS-14396.9'),
      pair('/PS-14396.9', '/PS-14396.10'),
    ],
    terminalKeys: [terminal('/PS-14396.9', '/PS-14396'), terminal('/PS-14396.10', '/PS-14396')],
    completeFamilyIds: [],
    ambiguousFamilyIds: [],
    topologyConnectionCount: 0,
    requiredPathExceptionCodes: ['CARRIER_TOPOLOGY_PATH_REVIEW_REQUIRED'],
  });
}

function baselineModel() {
  const model = clone(PS_14396_INDEPENDENT_COMBINED_MODEL);
  setBounds(find(model, '/PS-14396/BEAM-01'), 43, 80, 0, 20, -10, 0);
  find(model, '/PS-14396.4').attributes.CMPSUPTYPE = 'REST';
  return model;
}

function fixture(fixtureId, combinedModel, expected) {
  return {
    fixtureId,
    sourceClass: 'INDEPENDENT_MODEL_TRUTH',
    combinedModel,
    config: {
      projectionToleranceMm: 25,
      memberContactToleranceMm: 2,
      memberCandidateToleranceMm: 25,
      carrierContactToleranceMm: 2,
      carrierCandidateToleranceMm: 25,
      carrierTopologyExactToleranceMm: 0.5,
      carrierTopologySmallGapToleranceMm: 5,
    },
    expected,
  };
}

function find(rows, name) {
  const target = String(name).toUpperCase();
  const queue = [...rows];
  while (queue.length) {
    const row = queue.shift();
    if (String(row?.attributes?.NAME || row?.name || '').toUpperCase() === target) return row;
    queue.push(...(row?.children || []));
  }
  throw new Error(`Fixture object not found: ${name}`);
}
function setBounds(row, minX, maxX, minY, maxY, minZ, maxZ) {
  row.attributes.BOUNDS = {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}
function pair(left, right) { return [id(left), id(right)].sort().join('::'); }
function terminal(member, steel) { return `${id(member)}::${id(steel)}`; }
function id(value) { const text = String(value || '').replace(/^\/+/, '').toUpperCase(); return text ? `/${text}` : ''; }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
