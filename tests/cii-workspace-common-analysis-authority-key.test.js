import assert from 'node:assert/strict';
import { webcrypto } from 'node:crypto';
import {
  ANALYSIS_OPTION_KEYS,
  CII_COMMON_ANALYSIS_OPTION_DEFAULTS,
  canonicalCiiCommonAnalysisAuthorityPreimage,
  ciiCommonAnalysisAuthorityKey,
  ciiCommonAnalysisOptions,
} from '../tabs/cii-workspace/cii-workspace-common-analysis-key.js';

const cryptoRef = globalThis.crypto || webcrypto;
const hex = (char) => char.repeat(64);

function source(sourceId, char, overrides = {}) {
  return {
    sourceId,
    fileName: `${sourceId.toLowerCase()}.cii`,
    originalVersion: 14,
    normalizedVersion: 11,
    originalSha256: hex(char),
    normalizedSha256: hex(char === 'f' ? 'e' : String((parseInt(char, 16) + 1) % 16).toString(16)),
    baselineCanonicalSha256: hex(char === 'e' ? 'd' : String((parseInt(char, 16) + 2) % 16).toString(16)),
    ...overrides,
  };
}
function session(overrides = {}) {
  const members = overrides.members || [
    source('SRC_A', '2', {
      originalSha256: hex('2'),
      normalizedSha256: hex('3'),
      baselineCanonicalSha256: hex('4'),
    }),
    source('SRC_B', '5', {
      originalVersion: 11,
      normalizedVersion: 11,
      originalSha256: hex('5'),
      normalizedSha256: hex('5'),
      baselineCanonicalSha256: hex('5'),
    }),
  ];
  const target = {
    fileName: 'target.cii',
    originalVersion: 14,
    normalizedVersion: 11,
    originalSha256: hex('6'),
    normalizedSha256: hex('7'),
    baselineCanonicalSha256: hex('8'),
    ...(overrides.target || {}),
  };
  return {
    schema: 'CIIWorkspacePreparedSourceSetSession.v1',
    status: 'PREPARED',
    sourceSetSha256: overrides.sourceSetSha256 || hex('1'),
    members,
    target,
    versionBridge: {
      conversionSource: {
        repository: 'example/converter',
        commit: overrides.converterCommit || 'deadbeef',
        policy: 'FROZEN',
      },
    },
  };
}

const methodA = {
  method: 'METHOD_A_SPATIAL',
  baseId: 'A-1',
  anchorPairs: [
    { sourceNodeId: '30', targetNodeId: '300' },
    { sourceNodeId: '10', targetNodeId: '100' },
    { sourceNodeId: '20', targetNodeId: '200' },
  ],
  probePoints: [{ x: 5, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }],
};
const methodB = {
  method: 'METHOD_B_NETWORK',
  baseId: 'B-1',
  anchorPairs: [{ sourceNodeId: '40', targetNodeId: '400' }],
};

const baseArgs = {
  preparedSession: session(),
  sourceId: 'SRC_A',
  input: { baseLoops: [methodA, methodB] },
  options: {
    writerVersion: '2',
    baseAnchorDisplayLimit: 5,
    methodAPhysicalCandidateLimit: 10,
    instrumentation: { record() {} },
    cryptoRef,
    diameterToleranceRatio: 0.10,
    wallToleranceRatio: 0.10,
  },
};

const basePreimage = canonicalCiiCommonAnalysisAuthorityPreimage(baseArgs);
const baseKey = await ciiCommonAnalysisAuthorityKey(baseArgs, cryptoRef);
assert.match(baseKey, /^cii-common-analysis-v1:[0-9a-f]{64}$/);

// Explicit Method-A + Method-B loop order, pair order and probe order are canonical.
const reordered = {
  ...baseArgs,
  input: {
    baseLoops: [
      { ...methodB },
      {
        ...methodA,
        anchorPairs: [...methodA.anchorPairs].reverse(),
        probePoints: [...methodA.probePoints].reverse(),
      },
    ],
  },
};
assert.equal(canonicalCiiCommonAnalysisAuthorityPreimage(reordered), basePreimage);
assert.equal(await ciiCommonAnalysisAuthorityKey(reordered, cryptoRef), baseKey);

// Method aliases normalize without changing authority.
const aliases = {
  ...baseArgs,
  input: {
    baseLoops: [
      { ...methodA, method: 'A' },
      { ...methodB, method: 'B' },
    ],
  },
};
assert.equal(await ciiCommonAnalysisAuthorityKey(aliases, cryptoRef), baseKey);

// Base identity itself is material because it appears in common-analysis evidence.
const renamedBase = {
  ...baseArgs,
  input: { baseLoops: [{ ...methodA, baseId: 'A-RENAMED' }, methodB] },
};
assert.notEqual(await ciiCommonAnalysisAuthorityKey(renamedBase, cryptoRef), baseKey);

// Unlabeled explicit loops fail closed rather than using order-derived IDs.
assert.throws(
  () => canonicalCiiCommonAnalysisAuthorityPreimage({
    ...baseArgs,
    input: { baseLoops: [{ ...methodA, baseId: undefined }] },
  }),
  /LOOP_BASE_ID_REQUIRED/,
);

// Writer/review/transfer/display/discovery/oracle-only changes are excluded.
const excludedOnly = {
  ...baseArgs,
  input: {
    ...baseArgs.input,
    review: { reviewedCorrespondenceIds: ['x'], rejectedCorrespondenceIds: ['y'] },
    transferScope: { selectedOperationIds: ['op-1'] },
    texpected: [{ node: 'oracle-only' }],
    benchmark: 'BM-IGNORED',
  },
  options: {
    ...baseArgs.options,
    writerVersion: '1C',
    allowNodeNameOverwrite: true,
    baseAnchorDisplayLimit: 99,
    methodAPhysicalCandidateLimit: 24,
    baseAnchorSuggestionLimit: 1,
    minimumAutomaticConfidence: 'HIGH',
    instrumentation: { record() { throw new Error('must not be read'); } },
    cryptoRef: null,
    texpectedRows: ['oracle-only'],
    bm001ExpectedRows: ['oracle-only-2'],
    diameterToleranceRatio: 0.77,
    wallToleranceRatio: 0.66,
  },
};
assert.equal(await ciiCommonAnalysisAuthorityKey(excludedOnly, cryptoRef), baseKey);

// Omitted semantic defaults and explicit current defaults are identical.
const explicitDefaults = {
  ...baseArgs,
  options: {
    ...baseArgs.options,
    limit: 12,
    candidateLimit: 8,
    winnerGap: 8,
    candidatePassingScore: 45,
    highConfidenceScore: 82,
    spatialToleranceMm: 100,
    networkLocalLengthToleranceMm: 250,
    networkPassingScore: 55,
    networkStrongScore: 70,
    diameterRelativeTolerance: 0.10,
    wallRelativeTolerance: 0.10,
    identityWeight: 50,
    diameterWeight: 30,
    wallWeight: 30,
    propagation: false,
    lengthToleranceMm: 6,
    gapPenalty: -28,
    minPathScore: 45,
    pathLengthToleranceMm: 25,
    diameterToleranceMm: 2,
    wallToleranceMm: 1,
    subdivisionMinStraightness: 0.995,
    subdivisionStraightnessTolerance: 0.01,
    minAnchorPathScore: 45,
    maxAnchorPathLengthDivergence: 0.20,
    rerouteAutoScore: 75,
    sourceOdMm: null,
    odToleranceFactor: 2,
    nonCollinearSinTolerance: 1e-4,
    registrationProbePoints: [],
    runCollinearAngleDeg: 0.5,
    axisLabelSnapDeg: 2,
    independentAxisAngleDeg: 15,
    maxRunElements: 256,
    maxPropagationNodePairs: 10000,
    maxPropagationFrontierDegree: 6,
    maxFrontierAssignments: 720,
    frontierWinnerGap: 8,
    engineeringGeometryToleranceMm: 0.01,
    engineeringNumericTolerance: 1e-9,
    engineeringMassTolerance: 1e-9,
  },
};
assert.equal(await ciiCommonAnalysisAuthorityKey(explicitDefaults, cryptoRef), baseKey);

// coordinateToleranceMm is a semantic alias for spatialToleranceMm.
assert.equal(
  await ciiCommonAnalysisAuthorityKey({
    ...baseArgs,
    options: { ...baseArgs.options, coordinateToleranceMm: 100 },
  }, cryptoRef),
  baseKey,
);

// Every traced common-analysis option has a value in the normalized contract.
const normalizedDefaults = ciiCommonAnalysisOptions({});
assert.equal(normalizedDefaults.optionContract, 2);
for (const key of ANALYSIS_OPTION_KEYS) {
  assert(Object.hasOwn(normalizedDefaults, key), `missing normalized semantic option: ${key}`);
}
assert.equal(normalizedDefaults.landmarkLimit, CII_COMMON_ANALYSIS_OPTION_DEFAULTS.landmarkLimit);

// Representative changes from every semantic group change the key.
const changes = [
  ['limit', 13],
  ['candidateLimit', 9],
  ['winnerGap', 9],
  ['candidatePassingScore', 46],
  ['highConfidenceScore', 83],
  ['spatialToleranceMm', 101],
  ['networkLocalLengthToleranceMm', 251],
  ['networkPassingScore', 56],
  ['networkStrongScore', 71],
  ['diameterRelativeTolerance', 0.11],
  ['wallRelativeTolerance', 0.11],
  ['identityWeight', 51],
  ['diameterWeight', 31],
  ['wallWeight', 31],
  ['propagation', true],
  ['lengthToleranceMm', 7],
  ['gapPenalty', -27],
  ['minPathScore', 46],
  ['pathLengthToleranceMm', 26],
  ['diameterToleranceMm', 3],
  ['wallToleranceMm', 2],
  ['subdivisionMinStraightness', 0.994],
  ['subdivisionStraightnessTolerance', 0.02],
  ['minAnchorPathScore', 46],
  ['maxAnchorPathLengthDivergence', 0.21],
  ['rerouteAutoScore', 76],
  ['sourceOdMm', 219],
  ['odToleranceFactor', 3],
  ['nonCollinearSinTolerance', 2e-4],
  ['registrationProbePoints', [{ x: 1, y: 2, z: 3 }]],
  ['runCollinearAngleDeg', 0.6],
  ['axisLabelSnapDeg', 3],
  ['independentAxisAngleDeg', 16],
  ['maxRunElements', 257],
  ['maxPropagationNodePairs', 10001],
  ['maxPropagationFrontierDegree', 7],
  ['maxFrontierAssignments', 721],
  ['frontierWinnerGap', 9],
  ['engineeringGeometryToleranceMm', 0.02],
  ['engineeringNumericTolerance', 2e-9],
  ['engineeringMassTolerance', 2e-9],
];
for (const [key, value] of changes) {
  const changed = {
    ...baseArgs,
    options: { ...baseArgs.options, [key]: value },
  };
  assert.notEqual(
    await ciiCommonAnalysisAuthorityKey(changed, cryptoRef),
    baseKey,
    `semantic option must invalidate key: ${key}`,
  );
}

// Unknown serializable options conservatively invalidate the key.
assert.notEqual(
  await ciiCommonAnalysisAuthorityKey({
    ...baseArgs,
    options: { ...baseArgs.options, futureAnalysisPolicy: { threshold: 1 } },
  }, cryptoRef),
  baseKey,
);

// A changed anchor pair changes authority.
const changedAnchor = {
  ...baseArgs,
  input: {
    baseLoops: [
      {
        ...methodA,
        anchorPairs: [
          { sourceNodeId: '10', targetNodeId: '100' },
          { sourceNodeId: '20', targetNodeId: '200' },
          { sourceNodeId: '30', targetNodeId: '301' },
        ],
      },
      methodB,
    ],
  },
};
assert.notEqual(await ciiCommonAnalysisAuthorityKey(changedAnchor, cryptoRef), baseKey);

// Current sourceSetSha256 is order-sensitive and deliberately NOT direct cache authority.
assert.equal(
  await ciiCommonAnalysisAuthorityKey({
    ...baseArgs,
    preparedSession: session({ sourceSetSha256: hex('9') }),
  }, cryptoRef),
  baseKey,
);

// Same prepared members in a different presentation order, even with a
// different current sourceSetSha256, produce the same cache key.
const reorderedSession = session();
reorderedSession.members = [...reorderedSession.members].reverse();
reorderedSession.sourceSetSha256 = hex('a');
assert.equal(
  await ciiCommonAnalysisAuthorityKey({ ...baseArgs, preparedSession: reorderedSession }, cryptoRef),
  baseKey,
);

// Actual prepared custody changes invalidate the entire session key.
const changedSelectedMember = session();
changedSelectedMember.members[0] = {
  ...changedSelectedMember.members[0],
  normalizedSha256: hex('9'),
};
assert.notEqual(
  await ciiCommonAnalysisAuthorityKey({ ...baseArgs, preparedSession: changedSelectedMember }, cryptoRef),
  baseKey,
);
const changedOtherMember = session();
changedOtherMember.members[1] = {
  ...changedOtherMember.members[1],
  normalizedSha256: hex('a'),
};
assert.notEqual(
  await ciiCommonAnalysisAuthorityKey({ ...baseArgs, preparedSession: changedOtherMember }, cryptoRef),
  baseKey,
);
assert.notEqual(
  await ciiCommonAnalysisAuthorityKey({
    ...baseArgs,
    preparedSession: session({ target: { normalizedSha256: hex('b') } }),
  }, cryptoRef),
  baseKey,
);
assert.notEqual(
  await ciiCommonAnalysisAuthorityKey({
    ...baseArgs,
    preparedSession: session({ converterCommit: 'cafebabe' }),
  }, cryptoRef),
  baseKey,
);
assert.notEqual(
  await ciiCommonAnalysisAuthorityKey({ ...baseArgs, sourceId: 'SRC_B' }, cryptoRef),
  baseKey,
);

// Independent USER_LOCKED manual seeds are order invariant.
const manual1 = {
  preparedSession: session(),
  sourceId: 'SRC_A',
  input: {
    anchorPairMode: 'INDEPENDENT_SEEDS',
    anchorPairs: [
      { sourceNodeId: '7', targetNodeId: '70' },
      { sourceNodeId: '5', targetNodeId: '50' },
      { sourceNodeId: '6', targetNodeId: '60' },
    ],
  },
  options: {},
};
const manual2 = {
  ...manual1,
  input: { ...manual1.input, anchorPairs: [...manual1.input.anchorPairs].reverse() },
  options: { writerVersion: '1C', baseAnchorDisplayLimit: 1 },
};
assert.equal(
  await ciiCommonAnalysisAuthorityKey(manual1, cryptoRef),
  await ciiCommonAnalysisAuthorityKey(manual2, cryptoRef),
);

// Independent manual seeds and legacy anchors are distinct authority modes.
const legacy = {
  ...manual1,
  input: { anchorPairs: manual1.input.anchorPairs },
};
assert.notEqual(
  await ciiCommonAnalysisAuthorityKey(manual1, cryptoRef),
  await ciiCommonAnalysisAuthorityKey(legacy, cryptoRef),
);

// Empty explicit base-loop authority is distinct from empty legacy authority.
const emptyLoops = { preparedSession: session(), sourceId: 'SRC_A', input: { baseLoops: [] }, options: {} };
const emptyLegacy = { preparedSession: session(), sourceId: 'SRC_A', input: {}, options: {} };
assert.notEqual(
  await ciiCommonAnalysisAuthorityKey(emptyLoops, cryptoRef),
  await ciiCommonAnalysisAuthorityKey(emptyLegacy, cryptoRef),
);

// Custody failures are fail closed.
const badSourceHash = session();
badSourceHash.members[0] = { ...badSourceHash.members[0], normalizedSha256: 'bad' };
assert.throws(
  () => canonicalCiiCommonAnalysisAuthorityPreimage({
    ...baseArgs,
    preparedSession: badSourceHash,
  }),
  /SOURCE_NORMALIZED_SHA256_REQUIRED/,
);
assert.throws(
  () => canonicalCiiCommonAnalysisAuthorityPreimage({ ...baseArgs, sourceId: 'MISSING' }),
  /SOURCE_MEMBER_REQUIRED/,
);
const missingConversion = session();
missingConversion.versionBridge.conversionSource = null;
assert.throws(
  () => canonicalCiiCommonAnalysisAuthorityPreimage({
    ...baseArgs,
    preparedSession: missingConversion,
  }),
  /CONVERSION_SOURCE_REQUIRED/,
);

console.log('CII deterministic common-analysis authority key checks: PASS');
