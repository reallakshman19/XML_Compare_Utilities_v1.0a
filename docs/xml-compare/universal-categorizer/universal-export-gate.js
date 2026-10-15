import { createUniversalGraphProof, UNIVERSAL_GRAPH_PROOF_SCHEMA } from './universal-graph-proof.js';
import { UNIVERSAL_GRAPH_XML_EXPORT_STATUS } from './universal-graph-builder.js';

export const UNIVERSAL_EXPORT_GATE_SCHEMA = 'universal-export-gate/v1-shadow';
export const UNIVERSAL_XML_EXPORT_GATE_STATUS = 'blocked-shadow-graph-only';

const freeze = (value) => Object.freeze(value);

export function evaluateUniversalXmlExportGate(input = {}) {
  const proof = input.proof?.schema === UNIVERSAL_GRAPH_PROOF_SCHEMA ? input.proof : createUniversalGraphProof(input);
  const diagnostics = [
    diagnostic('error', 'UXC_XML_EXPORT_DISABLED', proof.profileId, 'Universal XML export is disabled until deterministic graph parity is approved.'),
    ...(proof.exportStatus === UNIVERSAL_GRAPH_XML_EXPORT_STATUS ? [] : [diagnostic('error', 'UXC_XML_EXPORT_GRAPH_STATUS_UNSAFE', proof.profileId, 'Graph export status is not the approved disabled gate state.')]),
    ...(proof.xmlExportEnabled === false ? [] : [diagnostic('error', 'UXC_XML_EXPORT_FLAG_UNSAFE', proof.profileId, 'Graph proof indicates XML export is enabled, which is forbidden in shadow mode.')]),
  ];

  return freeze({
    schema: UNIVERSAL_EXPORT_GATE_SCHEMA,
    profileId: proof.profileId,
    status: UNIVERSAL_XML_EXPORT_GATE_STATUS,
    allowed: false,
    blocked: true,
    xml: null,
    output: null,
    fileName: '',
    reason: 'Graph preview is deterministic-proof only; XML serializer/exporter is not implemented or approved.',
    graphSignature: proof.signature,
    proof,
    diagnostics: freeze(diagnostics),
  });
}

export function assertUniversalXmlExportBlocked(input = {}) {
  const gate = evaluateUniversalXmlExportGate(input);
  if (gate.allowed || gate.xml || gate.output) {
    throw new Error('Universal XML export gate failed closed-state assertion.');
  }
  return gate;
}

function diagnostic(severity, code, subjectId, message) {
  return freeze({ severity, code, subjectId, message });
}

export const _test = freeze({ diagnostic });
