import assert from 'node:assert/strict';
import fs from 'node:fs';
import {
  PIPELINE_CAESAR_STANDARD_SENTINEL,
  caesar14BendAttributeEntries,
  caesar14ElementAttributeEntries,
  caesar14ModelAttributeEntries,
  caesar14RootAttributeEntries,
  formatCaesar14Number,
  resolvePipelineCaesarWriterProfile,
} from '../tabs/pipeline-3d-model/pipeline-3d-model-caesar14-writer-profile.js';

const joined = (entries) => entries.map(([name, value]) => `${name}="${value}"`).join(' ');

assert.equal(formatCaesar14Number(12), '12.000000');
assert.equal(formatCaesar14Number(-0), '0.000000');
assert.equal(formatCaesar14Number(null), PIPELINE_CAESAR_STANDARD_SENTINEL);
assert.equal(formatCaesar14Number(undefined, 'ZERO'), '0.000000');
assert.equal(formatCaesar14Number(undefined, 'SENTINEL'), '-1.010100');
assert.equal(formatCaesar14Number(undefined, 'OMITTED'), null);
const caesar14Profile = resolvePipelineCaesarWriterProfile('14.00');
assert.equal(caesar14Profile.mode, 'CAESAR_14');
assert.deepEqual(caesar14Profile.rootAttributeOrder, ['xmlns', 'VERSION', 'XML_TYPE']);
assert.ok(caesar14Profile.elementAttributeOrder.includes('PRESSURE1'));
assert.ok(!caesar14Profile.elementAttributeOrder.includes('PRESSURE_C1'));
assert.equal(resolvePipelineCaesarWriterProfile('11.00').mode, 'LEGACY');
assert.deepEqual(caesar14BendAttributeEntries({ radiusMm: 150 }), [
  ['RADIUS', '150.000000'], ['NUM_MITER', '0.000000'],
]);

const plan = {
  namespace: 'COADE', version: '14.00', xmlType: 'Input',
  metadata: { jobName: 'TRI-1B', timeText: '2026/07/27 13:30:00', issueNo: '', northX: -1, northY: 0, northZ: 0 },
  counts: { numElt: 1, numNoz: 0, noHgrs: 0, numBend: 0, numRigid: 0, numExpJnt: 0,
    numRest: 0, numForcMnt: 0, numUnfLoad: 0, numWind: 0, numEleOff: 0, numAllow: 0, numISect: 0 },
};
const element = {
  id: 'E1', fromNode: 100, toNode: 110, deltaX: 600, deltaY: 0, deltaZ: -25.5,
  line: 'PL-1', fromX: 0, fromY: 0, fromZ: 0, toX: 600, toY: 0, toZ: -25.5,
  properties: { materialNumber: 106 },
  emittedProperties: {
    diameter: 168.274994, wallThickness: 10.9728, insulationThickness: null,
    corrosionAllowance: 1, temperatures: [325, 302.5, 5], pressures: [11600],
    hydroPressure: 22035, materialNumber: null, name: '',
  },
  emittedMechanicalProperties: {
    modulus: 202705856, hotModuli: [181538944, 184007264, 203742576],
    poissons: 0.292, pipeDensity: 0.007833, materialName: 'A106 Grade B',
  },
};

assert.equal(joined(caesar14RootAttributeEntries(plan)),
  'xmlns="COADE" VERSION="14.00" XML_TYPE="Input"');
assert.equal(joined(caesar14ModelAttributeEntries(plan)),
  'xmlns="" JOBNAME="TRI-1B" TIME="2026/07/27 13:30:00" ISSUE_NO="" NUMELT="1" NUMNOZ="0" NOHGRS="0" NUMBEND="0" NUMRIGID="0" NUMEXPJNT="0" NUMREST="0" NUMFORCMNT="0" NUMUNFLOAD="0" NUMWIND="0" NUMELEOFF="0" NUMALLOW="0" NUMISECT="0" NORTH_Z="0" NORTH_Y="0" NORTH_X="-1"');

const attributes = joined(caesar14ElementAttributeEntries(element));
assert.ok(attributes.startsWith('FROM_NODE="100.000000" TO_NODE="110.000000" DELTA_X="600.000000"'));
assert.match(attributes, /INSUL_THICK="-1\.010100"/);
assert.match(attributes, /TEMP_EXP_C1="325\.000000"/);
assert.match(attributes, /TEMP_EXP_C4="-1\.010100"/);
assert.match(attributes, /PRESSURE1="11600\.000000"/);
assert.match(attributes, /PRESSURE9="-1\.010100"/);
assert.match(attributes, /MODULUS="202705856\.000000"/);
assert.match(attributes, /HOT_MOD1="181538944\.000000"/);
assert.match(attributes, /HOT_MOD4="-1\.010100"/);
assert.match(attributes, /POISSONS="0\.292000"/);
assert.match(attributes, /PIPE_DENSITY="0\.007833"/);
assert.match(attributes, /MATERIAL_NUM="106\.000000"/);
assert.doesNotMatch(attributes, /PRESSURE_C1=/);
assert.match(attributes, /MATERIAL_NAME="A106 Grade B"/);
assert.doesNotMatch(attributes, /\bID=|\bLINE=|FROM_X=|TO_X=/);
assert.equal(attributes, joined(caesar14ElementAttributeEntries(structuredClone(element))));

const inherited = structuredClone(element);
inherited.emittedProperties = {
  diameter: null, wallThickness: null, insulationThickness: null,
  corrosionAllowance: null, temperatures: Array(9).fill(null), pressures: Array(9).fill(null),
  hydroPressure: null, materialNumber: null,
};
const inheritedAttributes = joined(caesar14ElementAttributeEntries(inherited));
assert.match(inheritedAttributes, /DIAMETER="-1\.010100"/);
assert.match(inheritedAttributes, /MODULUS="202705856\.000000"/);
assert.match(inheritedAttributes, /MATERIAL_NUM="106\.000000"/);
assert.match(inheritedAttributes, /MATERIAL_NAME="A106 Grade B"/);

const writerSource = fs.readFileSync(new URL(
  '../tabs/pipeline-3d-model/pipeline-3d-model-xml-builder.js', import.meta.url), 'utf8');
assert.match(writerSource, /resolvePipelineCaesarWriterProfile/);
assert.match(writerSource, /caesar14ElementAttributeEntries/);
assert.match(writerSource, /profile\.mode === 'CAESAR_14'/);

console.log('pipeline-3d-model CAESAR 14 writer profile: PASS');
