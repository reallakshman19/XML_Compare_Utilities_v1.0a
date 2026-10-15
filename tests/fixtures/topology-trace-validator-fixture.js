/**
 * Functionality: deterministic component-aware chain used by validator tests
 * and browser smoke evidence. Inputs: none. Output: frozen artifact literals.
 * Fallback: none; this is explicitly [SIMULATED] contract data, not 1885_NC.
 */

const deferredEngineering = Object.freeze(['OD', 'WALL', 'MATERIAL', 'TEMPERATURE', 'PRESSURE', 'INSULATION']);

/** @param {Record<string, unknown>} input @returns {Readonly<Record<string, unknown>>} */
function ledgerRecord(input) {
  return Object.freeze({
    canonicalNodeIds: [], canonicalEdgeIds: [], pointFeatureIds: [], junctionIds: [], boundaryIds: [],
    affectedEdgeIds: [], branchEdgeIds: [], affectedSourceEntityIds: [], inputXmlElementIds: [], inputXmlChildIds: [],
    deferredProperties: [], ...input,
  });
}

export const topologySourceFixture = Object.freeze([
  {
    name: '/B1', type: 'BRANCH', attributes: { NAME: '/B1', REF: 'BRANCH-B1', SOURCE_ENTITY_ID: 'SRC-B1' },
    children: [
      { name: 'PIPE P1', type: 'PIPE', attributes: { NAME: 'P1', REF: 'PIPE-1', SOURCE_ENTITY_ID: 'SRC-PIPE-1', APOS: { x: 0, y: 0, z: 0 }, LPOS: { x: 10, y: 0, z: 0 }, APORT_ID: 'P-0', LPORT_ID: 'P-10' } },
      { name: 'VALVE V1', type: 'VALV', attributes: { NAME: 'V1', REF: 'VALVE-1', SOURCE_ENTITY_ID: 'SRC-VALVE', APOS: { x: 10, y: 0, z: 0 }, LPOS: { x: 12, y: 0, z: 0 }, POS: { x: 11, y: 0, z: 0 }, APORT_ID: 'V-A', LPORT_ID: 'V-L', PORT_ID: 'V-P' } },
      { name: 'FLANGE F1', type: 'FLAN', attributes: { NAME: 'F1', REF: 'FLANGE-1', SOURCE_ENTITY_ID: 'SRC-FLANGE', APOS: { x: 12, y: 0, z: 0 }, LPOS: { x: 13, y: 0, z: 0 }, POS: { x: 12.5, y: 0, z: 0 }, APORT_ID: 'F-A', LPORT_ID: 'F-L', PORT_ID: 'F-P' } },
      { name: 'GASKET G1', type: 'GASK', attributes: { NAME: 'G1', REF: 'GASK-1', SOURCE_ENTITY_ID: 'SRC-GASK', APOS: { x: 13, y: 0, z: 0 }, LPOS: { x: 14, y: 0, z: 0 }, POS: { x: 13.5, y: 0, z: 0 }, APORT_ID: 'G-A', LPORT_ID: 'G-L', PORT_ID: 'G-P' } },
      { name: 'INSTRUMENT I1', type: 'INST', attributes: { NAME: 'I1', REF: 'INST-1', SOURCE_ENTITY_ID: 'SRC-INST-INLINE', APOS: { x: 14, y: 0, z: 0 }, LPOS: { x: 16, y: 0, z: 0 }, POS: { x: 15, y: 0, z: 0 }, APORT_ID: 'I-A', LPORT_ID: 'I-L', PORT_ID: 'I-P' } },
      { name: 'REDUCER R1', type: 'REDU', attributes: { NAME: 'R1', REF: 'REDU-1', SOURCE_ENTITY_ID: 'SRC-REDUCER', APOS: { x: 16, y: 0, z: 0 }, LPOS: { x: 18, y: 0, z: 0 }, POS: { x: 17, y: 0, z: 0 }, APORT_ID: 'R-A', LPORT_ID: 'R-L', PORT_ID: 'R-P' } },
      { name: 'ELBOW E1', type: 'ELBO', attributes: { NAME: 'E1', REF: 'ELBO-1', SOURCE_ENTITY_ID: 'SRC-BEND', APOS: { x: 18, y: 0, z: 0 }, LPOS: { x: 20, y: 2, z: 0 }, POS: { x: 20, y: 0, z: 0 }, APORT_ID: 'B-A', LPORT_ID: 'B-L', PORT_ID: 'B-P' } },
      { name: 'TEE T1', type: 'TEE', attributes: { NAME: 'T1', REF: 'TEE-1', SOURCE_ENTITY_ID: 'SRC-TEE', APOS: { x: 20, y: 0, z: 0 }, LPOS: { x: 20, y: 2, z: 0 }, POS: { x: 20, y: 2, z: 0 }, APORT_ID: 'T-A', LPORT_ID: 'T-L', PORT_ID: 'T-P', CREF: '/B2' } },
      { name: 'OLET O1', type: 'OLET', attributes: { NAME: 'O1', REF: 'OLET-1', SOURCE_ENTITY_ID: 'SRC-OLET', APOS: { x: 5, y: 0, z: 0 }, LPOS: { x: 5, y: 0, z: 0 }, POS: { x: 5, y: 0, z: 0 }, APORT_ID: 'O-A', LPORT_ID: 'O-L', PORT_ID: 'O-P', CREF: '/B3' } },
      { name: 'PIPE P2', type: 'PIPE', attributes: { NAME: 'P2', REF: 'PIPE-2', SOURCE_ENTITY_ID: 'SRC-PIPE-2', APOS: { x: 20, y: 2, z: 0 }, LPOS: { x: 22, y: 2, z: 0 }, APORT_ID: 'P2-A', LPORT_ID: 'P2-L' } },
      { name: 'POINT INSTRUMENT I2', type: 'INST', attributes: { NAME: 'I2', REF: 'INST-2', SOURCE_ENTITY_ID: 'SRC-INST-POINT', APOS: { x: 22, y: 2, z: 0 }, LPOS: { x: 22, y: 2, z: 0 }, POS: { x: 22, y: 2, z: 0 }, APORT_ID: 'IP-A', LPORT_ID: 'IP-L', PORT_ID: 'IP-P' } },
      { name: 'SUPPORT S1', type: 'SUPPORT', attributes: { NAME: 'S1', REF: 'SUPPORT-1', SOURCE_ENTITY_ID: 'SRC-SUPPORT', POS: { x: 15, y: 0, z: 0 }, PORT_ID: 'S-P' } },
    ],
  },
  { name: '/B2', type: 'BRANCH', attributes: { NAME: '/B2', REF: 'BRANCH-B2', SOURCE_ENTITY_ID: 'SRC-B2', HREF: 'TEE-1' }, children: [
    { name: 'PIPE TEE BRANCH', type: 'PIPE', attributes: { NAME: 'PT', REF: 'PIPE-T', SOURCE_ENTITY_ID: 'SRC-PIPE-TEE', APOS: { x: 20, y: 2, z: 0 }, LPOS: { x: 20, y: 4, z: 0 }, APORT_ID: 'PT-A', LPORT_ID: 'PT-L' } },
  ] },
  { name: '/B3', type: 'BRANCH', attributes: { NAME: '/B3', REF: 'BRANCH-B3', SOURCE_ENTITY_ID: 'SRC-B3', HREF: 'OLET-1', TREF: '/EXTERNAL' }, children: [
    { name: 'PIPE OLET BRANCH', type: 'PIPE', attributes: { NAME: 'PO', REF: 'PIPE-O', SOURCE_ENTITY_ID: 'SRC-PIPE-OLET', APOS: { x: 5, y: 0, z: 0 }, LPOS: { x: 5, y: -2, z: 0 }, APORT_ID: 'PO-A', LPORT_ID: 'PO-L' } },
  ] },
]);

export const canonicalTopologyFixture = Object.freeze({
  schema: 'CanonicalTopology.v1',
  nodes: [
    ['N0', 0, 0, ['P-0'], '0'], ['NO', 5, 0, ['O-P'], '5'], ['N1', 10, 0, ['P-10', 'V-A'], '10'], ['N2', 12, 0, ['V-L', 'F-A'], '12'],
    ['N3', 13, 0, ['F-L', 'G-A'], null], ['N4', 14, 0, ['G-L', 'I-A'], '14'], ['N5', 16, 0, ['I-L', 'R-A'], '16'], ['N6', 18, 0, ['R-L', 'B-A'], '18'],
    ['N7', 20, 0, ['B-P'], '20'], ['NT', 20, 2, ['B-L', 'T-L', 'PT-A', 'P2-A'], '22'], ['N9', 22, 2, ['P2-L', 'IP-P'], '24'],
    ['NBT', 20, 4, ['PT-L'], '26'], ['NBO', 5, -2, ['PO-L'], '28'],
  ].map(([id, x, y, sourcePortIds, inputNode]) => ({ id, position: { x, y, z: 0 }, sourcePortIds, inputXmlNodeIds: [inputNode] })),
  edges: [
    ['E-P1A', 'N0', 'NO', 'SRC-PIPE-1', 'PIPE', 'PE-P1A'], ['E-P1B', 'NO', 'N1', 'SRC-PIPE-1', 'PIPE', 'PE-P1B'],
    ['E-VALVE', 'N1', 'N2', 'SRC-VALVE', 'VALVE', 'PE-VALVE'], ['E-FLANGE', 'N2', 'N3', 'SRC-FLANGE', 'FLANGE', 'PE-ASSEMBLY'],
    ['E-GASK', 'N3', 'N4', 'SRC-GASK', 'GASK', 'PE-ASSEMBLY'], ['E-INST', 'N4', 'N5', 'SRC-INST-INLINE', 'INST', 'PE-INST'],
    ['E-REDU', 'N5', 'N6', 'SRC-REDUCER', 'REDUCER', 'PE-REDU'], ['E-BEND-A', 'N6', 'N7', 'SRC-BEND', 'ELBO/BEND', 'PE-BEND-A'],
    ['E-BEND-B', 'N7', 'NT', 'SRC-BEND', 'ELBO/BEND', 'PE-BEND-B'], ['E-RUN', 'NT', 'N9', 'SRC-PIPE-2', 'PIPE', 'PE-RUN'],
    ['E-TEE-BR', 'NT', 'NBT', 'SRC-PIPE-TEE', 'PIPE', 'PE-TEE-BR'], ['E-OLET-BR', 'NO', 'NBO', 'SRC-PIPE-OLET', 'PIPE', 'PE-OLET-BR'],
  ].map(([id, fromNodeId, toNodeId, sourceId, sourceType, inputId]) => ({ id, fromNodeId, toNodeId, sourceEntityIds: [sourceId], sourceTypes: [sourceType], inputXmlElementIds: [inputId] })),
  pointFeatures: [{ id: 'PF-INST', position: { x: 22, y: 2, z: 0 }, sourceEntityIds: ['SRC-INST-POINT'], sourceTypes: ['INST'] }],
  junctions: [
    { id: 'J-TEE', kind: 'TEE', nodeId: 'NT', expectedDegree: 3, position: { x: 20, y: 2, z: 0 }, sourceEntityIds: ['SRC-TEE', 'SRC-B1', 'SRC-B2'] },
    { id: 'J-OLET', kind: 'OLET', nodeId: 'NO', expectedDegree: 3, position: { x: 5, y: 0, z: 0 }, sourceEntityIds: ['SRC-OLET'] },
  ],
  boundaries: [{ id: 'BND-EXT', position: { x: 5, y: -2, z: 0 }, sourceEntityIds: ['SRC-B3'], relationship: 'TREF:/EXTERNAL' }],
});

const componentRecords = [
  ledgerRecord({ id: 'L-PIPE-1', sourceEntityId: 'SRC-PIPE-1', sourcePath: '$[0].children[0]', sourceType: 'PIPE', sourceRef: 'PIPE-1', primaryDisposition: 'EMIT_ROUTE_EDGE', canonicalNodeIds: ['N0', 'NO', 'N1'], canonicalEdgeIds: ['E-P1A', 'E-P1B'], affectedSourceEntityIds: ['SRC-OLET'], inputXmlElementIds: ['PE-P1A', 'PE-P1B'], inputXmlChildIds: ['CH-P1A', 'CH-P1B'], projectionCardinality: 'ONE_TO_MANY', deferredProperties: deferredEngineering, lossClassification: 'LOSSLESS_SPLIT', operation: 'emit-route-edge-set', evidence: { splitAuthority: 'J-OLET' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-VALVE', sourceEntityId: 'SRC-VALVE', sourcePath: '$[0].children[1]', sourceType: 'VALV', sourceRef: 'VALVE-1', primaryDisposition: 'EMIT_INLINE_COMPONENT_EDGE', canonicalNodeIds: ['N1', 'N2'], canonicalEdgeIds: ['E-VALVE'], inputXmlElementIds: ['PE-VALVE'], inputXmlChildIds: ['CH-VALVE'], projectionCardinality: 'ONE_TO_ONE', deferredProperties: [...deferredEngineering, 'RIGID', 'WEIGHT'], lossClassification: 'LOSSLESS_TOPOLOGY', operation: 'emit-inline-component', evidence: { geometryAuthority: 'APOS_LPOS' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-FLANGE', sourceEntityId: 'SRC-FLANGE', sourcePath: '$[0].children[2]', sourceType: 'FLAN', sourceRef: 'FLANGE-1', primaryDisposition: 'MERGE_IN_CII_PROJECTION', canonicalNodeIds: ['N2', 'N3'], canonicalEdgeIds: ['E-FLANGE'], inputXmlElementIds: ['PE-ASSEMBLY'], inputXmlChildIds: ['CH-ASSEMBLY'], projectionCardinality: 'MANY_TO_ONE', deferredProperties: [...deferredEngineering, 'RIGID', 'WEIGHT'], lossClassification: 'EXPLICIT_CII_MERGE', operation: 'merge-flange-gasket-projection', evidence: { geometryAuthority: 'APOS_LPOS', mergeReason: 'ASSEMBLY_POLICY' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-GASK', sourceEntityId: 'SRC-GASK', sourcePath: '$[0].children[3]', sourceType: 'GASK', sourceRef: 'GASK-1', primaryDisposition: 'MERGE_IN_CII_PROJECTION', canonicalNodeIds: ['N3', 'N4'], canonicalEdgeIds: ['E-GASK'], inputXmlElementIds: ['PE-ASSEMBLY'], inputXmlChildIds: ['CH-ASSEMBLY'], projectionCardinality: 'MANY_TO_ONE', deferredProperties: [...deferredEngineering, 'RIGID_MERGE_POLICY'], lossClassification: 'EXPLICIT_CII_MERGE', operation: 'merge-flange-gasket-projection', evidence: { geometryAuthority: 'APOS_LPOS', mergeReason: 'ASSEMBLY_POLICY' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-INST-I', sourceEntityId: 'SRC-INST-INLINE', sourcePath: '$[0].children[4]', sourceType: 'INST', sourceRef: 'INST-1', primaryDisposition: 'EMIT_INLINE_COMPONENT_EDGE', canonicalNodeIds: ['N4', 'N5'], canonicalEdgeIds: ['E-INST'], inputXmlElementIds: ['PE-INST'], inputXmlChildIds: ['CH-INST'], projectionCardinality: 'ONE_TO_ONE', deferredProperties: [...deferredEngineering, 'RIGID', 'WEIGHT', 'INSTRUMENT_SEMANTICS'], lossClassification: 'LOSSLESS_TOPOLOGY', operation: 'emit-inline-component', evidence: { geometryAuthority: 'APOS_LPOS' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-REDU', sourceEntityId: 'SRC-REDUCER', sourcePath: '$[0].children[5]', sourceType: 'REDU', sourceRef: 'REDU-1', primaryDisposition: 'EMIT_INLINE_COMPONENT_EDGE', canonicalNodeIds: ['N5', 'N6'], canonicalEdgeIds: ['E-REDU'], inputXmlElementIds: ['PE-REDU'], inputXmlChildIds: ['CH-REDU'], projectionCardinality: 'ONE_TO_ONE', deferredProperties: [...deferredEngineering, 'DIAMETER_TRANSITION'], lossClassification: 'LOSSLESS_TOPOLOGY', operation: 'emit-transition-edge', evidence: { geometryAuthority: 'APOS_LPOS', diameterAuthority: 'DEFERRED' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-BEND', sourceEntityId: 'SRC-BEND', sourcePath: '$[0].children[6]', sourceType: 'ELBO', sourceRef: 'ELBO-1', primaryDisposition: 'EMIT_BEND_EDGE_SET', canonicalNodeIds: ['N6', 'N7', 'NT'], canonicalEdgeIds: ['E-BEND-A', 'E-BEND-B'], inputXmlElementIds: ['PE-BEND-A', 'PE-BEND-B'], inputXmlChildIds: ['CH-BEND-A', 'CH-BEND-B'], projectionCardinality: 'ONE_TO_MANY', deferredProperties: [...deferredEngineering, 'BEND_ENGINEERING_PROPERTIES'], lossClassification: 'LOSSLESS_MULTI_EDGE', operation: 'emit-bend-edge-set', evidence: { bendPointAuthority: 'POS' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-TEE', sourceEntityId: 'SRC-TEE', sourcePath: '$[0].children[7]', sourceType: 'TEE', sourceRef: 'TEE-1', primaryDisposition: 'EMIT_TEE_JUNCTION', canonicalNodeIds: ['NT'], junctionIds: ['J-TEE'], affectedSourceEntityIds: ['SRC-PIPE-2', 'SRC-PIPE-TEE', 'SRC-BEND'], projectionCardinality: 'JUNCTION_ONLY', deferredProperties: ['SIF_VALUES'], lossClassification: 'JUNCTION_ONLY', operation: 'emit-tee-junction', evidence: { CREF: '/B2', branchRelationship: 'CREF' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-OLET', sourceEntityId: 'SRC-OLET', sourcePath: '$[0].children[8]', sourceType: 'OLET', sourceRef: 'OLET-1', primaryDisposition: 'SPLIT_HEADER_AT_JUNCTION', canonicalNodeIds: ['NO'], junctionIds: ['J-OLET'], affectedEdgeIds: ['E-P1A', 'E-P1B'], branchEdgeIds: ['E-OLET-BR'], affectedSourceEntityIds: ['SRC-PIPE-1', 'SRC-PIPE-OLET'], projectionCardinality: 'ONE_TO_MANY', deferredProperties: ['SIF_VALUES'], lossClassification: 'JUNCTION_HEADER_SPLIT', operation: 'split-header-at-olet', evidence: { sourceCref: '/B3', splitAuthority: 'CREF_AND_POSITION' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-PIPE-2', sourceEntityId: 'SRC-PIPE-2', sourcePath: '$[0].children[9]', sourceType: 'PIPE', sourceRef: 'PIPE-2', primaryDisposition: 'EMIT_ROUTE_EDGE', canonicalNodeIds: ['NT', 'N9'], canonicalEdgeIds: ['E-RUN'], inputXmlElementIds: ['PE-RUN'], inputXmlChildIds: ['CH-RUN'], projectionCardinality: 'ONE_TO_ONE', deferredProperties: deferredEngineering, lossClassification: 'LOSSLESS_TOPOLOGY', operation: 'emit-route-edge', evidence: { geometryAuthority: 'APOS_LPOS' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-INST-P', sourceEntityId: 'SRC-INST-POINT', sourcePath: '$[0].children[10]', sourceType: 'INST', sourceRef: 'INST-2', primaryDisposition: 'EMIT_POINT_FEATURE', canonicalNodeIds: ['N9'], pointFeatureIds: ['PF-INST'], projectionCardinality: 'POINT_ONLY', deferredProperties: ['INSTRUMENT_SEMANTICS'], lossClassification: 'POINT_FEATURE_ONLY', operation: 'emit-point-feature', evidence: { geometryAuthority: 'ZERO_LENGTH' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-SUPPORT', sourceEntityId: 'SRC-SUPPORT', sourcePath: '$[0].children[11]', sourceType: 'SUPPORT', sourceRef: 'SUPPORT-1', primaryDisposition: 'DEFER_SUPPORT', projectionCardinality: 'DEFERRED', deferredProperties: ['RESTRAINT_GENERATION', 'SUPPORT_ATTACHMENT'], lossClassification: 'DEFERRED_TO_SUPPORT_PHASE', operation: 'defer-support', evidence: { exclusionAuthority: 'TOPOLOGY_PHASE_POLICY' }, status: 'DEFERRED' }),
  ledgerRecord({ id: 'L-PIPE-T', sourceEntityId: 'SRC-PIPE-TEE', sourcePath: '$[1].children[0]', sourceType: 'PIPE', sourceRef: 'PIPE-T', primaryDisposition: 'EMIT_ROUTE_EDGE', canonicalNodeIds: ['NT', 'NBT'], canonicalEdgeIds: ['E-TEE-BR'], inputXmlElementIds: ['PE-TEE-BR'], inputXmlChildIds: ['CH-TEE-BR'], projectionCardinality: 'ONE_TO_ONE', deferredProperties: deferredEngineering, lossClassification: 'LOSSLESS_TOPOLOGY', operation: 'emit-route-edge', evidence: { geometryAuthority: 'APOS_LPOS' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-PIPE-O', sourceEntityId: 'SRC-PIPE-OLET', sourcePath: '$[2].children[0]', sourceType: 'PIPE', sourceRef: 'PIPE-O', primaryDisposition: 'EMIT_ROUTE_EDGE', canonicalNodeIds: ['NO', 'NBO'], canonicalEdgeIds: ['E-OLET-BR'], inputXmlElementIds: ['PE-OLET-BR'], inputXmlChildIds: ['CH-OLET-BR'], projectionCardinality: 'ONE_TO_ONE', deferredProperties: deferredEngineering, lossClassification: 'LOSSLESS_TOPOLOGY', operation: 'emit-route-edge', evidence: { geometryAuthority: 'APOS_LPOS' }, status: 'ACCEPTED' }),
];

export const topologyTraceLedgerFixture = Object.freeze({ schema: 'TopologyTraceLedger.v1', records: Object.freeze([
  ledgerRecord({ id: 'L-B1', sourceEntityId: 'SRC-B1', sourcePath: '$[0]', sourceType: 'BRANCH', sourceRef: 'BRANCH-B1', primaryDisposition: 'EMIT_TEE_JUNCTION', canonicalNodeIds: ['NT'], junctionIds: ['J-TEE'], affectedSourceEntityIds: ['SRC-TEE'], projectionCardinality: 'JUNCTION_ONLY', deferredProperties: [], lossClassification: 'BRANCH_LINEAGE', operation: 'branch-to-junction', evidence: { relationship: 'OWNER' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-B2', sourceEntityId: 'SRC-B2', sourcePath: '$[1]', sourceType: 'BRANCH', sourceRef: 'BRANCH-B2', primaryDisposition: 'EMIT_TEE_JUNCTION', canonicalNodeIds: ['NT'], junctionIds: ['J-TEE'], affectedSourceEntityIds: ['SRC-TEE'], projectionCardinality: 'JUNCTION_ONLY', deferredProperties: [], lossClassification: 'BRANCH_LINEAGE', operation: 'branch-to-junction', evidence: { relationship: 'HREF' }, status: 'ACCEPTED' }),
  ledgerRecord({ id: 'L-B3', sourceEntityId: 'SRC-B3', sourcePath: '$[2]', sourceType: 'BRANCH', sourceRef: 'BRANCH-B3', primaryDisposition: 'EXTERNAL_BOUNDARY', boundaryIds: ['BND-EXT'], affectedSourceEntityIds: ['SRC-PIPE-OLET'], projectionCardinality: 'POINT_ONLY', deferredProperties: [], lossClassification: 'EXTERNAL_BOUNDARY', operation: 'emit-external-boundary', evidence: { relationship: 'TREF:/EXTERNAL' }, status: 'ACCEPTED' }),
  ...componentRecords,
] ) });

const inputRows = [
  ['PE-P1A', '0', '5', 5, 0, 'PIPE', 'CH-P1A'], ['PE-P1B', '5', '10', 5, 0, 'PIPE', 'CH-P1B'], ['PE-VALVE', '10', '12', 2, 0, 'VALVE', 'CH-VALVE'],
  ['PE-ASSEMBLY', '12', '14', 2, 0, '', 'CH-ASSEMBLY'], ['PE-INST', '14', '16', 2, 0, 'INST', 'CH-INST'],
  ['PE-REDU', '16', '18', 2, 0, 'REDUCER', 'CH-REDU'], ['PE-BEND-A', '18', '20', 2, 0, 'ELBO', 'CH-BEND-A'], ['PE-BEND-B', '20', '22', 0, 2, 'ELBO', 'CH-BEND-B'],
  ['PE-RUN', '22', '24', 2, 0, 'PIPE', 'CH-RUN'], ['PE-TEE-BR', '22', '26', 0, 2, 'PIPE', 'CH-TEE-BR'], ['PE-OLET-BR', '5', '28', 0, -2, 'PIPE', 'CH-OLET-BR'],
];

export const topologyInputXmlFixture = `<?xml version="1.0" encoding="UTF-8"?>
<CAESARII XML_TYPE="Input" VERSION="2019"><PIPINGMODEL>${inputRows.map(([id, from, to, dx, dy, sourceType, child]) => `
  <PIPINGELEMENT ID="${id}" FROM_NODE="${from}" TO_NODE="${to}" DELTA_X="${dx}" DELTA_Y="${dy}" DELTA_Z="0" SOURCE_TYPE="${sourceType}"><COMPONENT ID="${child}"/></PIPINGELEMENT>`).join('')}
</PIPINGMODEL></CAESARII>`;

export const topologyBrowserFixtureArtifacts = Object.freeze({ source: topologySourceFixture, canonical: canonicalTopologyFixture, ledger: topologyTraceLedgerFixture, inputXml: topologyInputXmlFixture });
