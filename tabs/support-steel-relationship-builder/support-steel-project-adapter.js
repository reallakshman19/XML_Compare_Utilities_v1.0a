/** Support/Steel adapter retaining the relationship engine and all native exporters. */

import { buildSingleDocumentMigration } from '../../contracts/project-migration-contract.js';
import { supportCarrierAttachmentToCsv, supportCarrierResolutionToCsv } from './support-carrier-resolution-export.js';
import { supportCarrierTopologyToCsv } from './support-carrier-topology-export.js';
import { supportCarrierToStructurePathsToCsv } from './support-carrier-to-structure-path-export.js';
import { SUPPORT_STEEL_RELATIONSHIP_SCHEMA } from './support-steel-relationship-contracts.js';
import {
  supportMemberChainToCsv, supportSteelBundleToJson,
  supportSteelHierarchyToText, supportSteelRelationshipsToCsv,
} from './support-steel-relationship-export.js';

export const SUPPORT_STEEL_PROJECT_ID = 'support-steel-relationship-builder';

const FORMATS = Object.freeze({
  json: Object.freeze({ fileId: 'support-steel-json', name: 'support-steel-relationship-bundle.json', mime: 'application/json', role: 'RELATIONSHIP_BUNDLE', sourceSchema: SUPPORT_STEEL_RELATIONSHIP_SCHEMA, writer: supportSteelBundleToJson }),
  csv: Object.freeze({ fileId: 'support-steel-csv', name: 'support-steel-relationships.csv', mime: 'text/csv', role: 'RELATIONSHIP_TABLE', sourceSchema: 'SupportSteelRelationships.csv.v1', writer: supportSteelRelationshipsToCsv }),
  tree: Object.freeze({ fileId: 'support-steel-tree', name: 'support-steel-relationship-hierarchy.txt', mime: 'text/plain', role: 'HIERARCHY', sourceSchema: 'SupportSteelHierarchy.text.v1', writer: supportSteelHierarchyToText }),
  chain: Object.freeze({ fileId: 'support-member-chain', name: 'support-member-chain.csv', mime: 'text/csv', role: 'MEMBER_CHAIN', sourceSchema: 'SupportMemberChain.csv.v1', writer: supportMemberChainToCsv }),
  carrier: Object.freeze({ fileId: 'support-carrier-resolution', name: 'support-carrier-resolutions.csv', mime: 'text/csv', role: 'CARRIER_RESOLUTION', sourceSchema: 'SupportCarrierResolution.csv.v1', writer: supportCarrierResolutionToCsv }),
  attachment: Object.freeze({ fileId: 'support-carrier-attachment', name: 'support-carrier-attachments.csv', mime: 'text/csv', role: 'CARRIER_ATTACHMENT', sourceSchema: 'SupportCarrierAttachment.csv.v1', writer: supportCarrierAttachmentToCsv }),
  topology: Object.freeze({ fileId: 'support-carrier-topology', name: 'support-carrier-topology.csv', mime: 'text/csv', role: 'CARRIER_TOPOLOGY', sourceSchema: 'SupportCarrierTopology.csv.v1', writer: supportCarrierTopologyToCsv }),
  structurePath: Object.freeze({ fileId: 'support-carrier-structure-path', name: 'support-carrier-structure-paths.csv', mime: 'text/csv', role: 'CARRIER_STRUCTURE_PATH', sourceSchema: 'SupportCarrierStructurePath.csv.v1', writer: supportCarrierToStructurePathsToCsv }),
});

/** Return the exact text already used by the selected native export view. */
export function supportSteelArtifactText(bundle, key) {
  const format = FORMATS[key];
  if (!format) throw new Error(`Unknown Support/Steel export format: ${key}`);
  return format.writer(bundle);
}

/** Produce every established Support/Steel download without altering bytes. */
export function supportSteelProjectArtifacts(bundle) {
  return Object.freeze(Object.entries(FORMATS).map(([key, format]) => Object.freeze({
    fileId: format.fileId, name: format.name, mime: format.mime,
    role: format.role, sourceSchema: format.sourceSchema,
    text: supportSteelArtifactText(bundle, key),
  })));
}

function sourceText(input) {
  const combinedSourceText = String(input.combinedSourceText ?? '').trim();
  if (combinedSourceText) return combinedSourceText;
  return JSON.stringify({ supportSourceText: input.supportSourceText, steelSourceText: input.steelSourceText });
}

function calculations(bundle) {
  const summary = bundle.summary || {};
  return {
    supportFamilies: summary.supportFamilyCount || 0,
    relationships: bundle.relationships?.length || 0,
    resolved: summary.resolvedCount || 0,
    ambiguous: summary.ambiguousCount || 0,
    unresolved: summary.unresolvedCount || 0,
    supportChainEdges: summary.supportChainEdgeCount || 0,
  };
}

/** Publish the native evidence bundle and all exact exporters to the platform. */
export async function buildSupportSteelProjectMigration(input) {
  if (input.bundle?.schema !== SUPPORT_STEEL_RELATIONSHIP_SCHEMA) {
    throw new TypeError(`Support/Steel bundle must use ${SUPPORT_STEEL_RELATIONSHIP_SCHEMA}.`);
  }
  const counts = calculations(input.bundle);
  return buildSingleDocumentMigration({
    projectId: SUPPORT_STEEL_PROJECT_ID, sourceName: input.sourceName,
    sourceText: sourceText(input), sourceSchema: SUPPORT_STEEL_RELATIONSHIP_SCHEMA,
    rootShape: 'support+steel', unit: 'MM', verticalAxis: 'Z', coordinateFrame: 'GLOBAL',
    stats: { branchCount: counts.supportFamilies, componentCount: counts.relationships, scanned: counts.relationships, matched: counts.resolved, filtered: 0 },
    scope: { wildcard: '', selectedIds: [] }, createdAt: input.createdAt, cryptoRef: input.cryptoRef,
    writerId: 'supportSteelProjectArtifacts', outputs: supportSteelProjectArtifacts(input.bundle),
    hierarchy: { supportFamilies: input.bundle.supportFamilies || [], memberChain: input.bundle.supportMemberChain || null },
    calculations: counts, gate: { status: 'READY', blockers: [] },
  });
}

export const supportSteelProjectAdapter = Object.freeze({
  projectId: SUPPORT_STEEL_PROJECT_ID, sourceSchema: SUPPORT_STEEL_RELATIONSHIP_SCHEMA,
  writerId: 'supportSteelProjectArtifacts', buildMigration: buildSupportSteelProjectMigration,
});
