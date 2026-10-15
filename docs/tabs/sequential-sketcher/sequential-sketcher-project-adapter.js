/** Sequential Sketcher adapter with an explicit completion/export gate. */

import { buildSingleDocumentMigration } from '../../contracts/project-migration-contract.js';
import { SEQUENTIAL_SKETCH_SCHEMA } from './sequential-sketcher-contract.js';
import { parseStagedJson } from './sequential-sketcher-source.js';

export const SEQUENTIAL_SKETCHER_PROJECT_ID = 'sequential-sketcher';
export const SEQUENTIAL_PROJECT_EXPORT_SCHEMA = 'SequentialProjectExport.v2';

const SEQUENTIAL_STAGED_SCHEMA = 'sequential-sketcher-source-array/v1';
const SEQUENTIAL_SOURCE_UNIT = 'MM';
const SEQUENTIAL_COORDINATE_FRAME = 'PLANT';
const SEQUENTIAL_VERTICAL_AXIS = 'Z';

function exportPayload(input) {
  return Object.freeze({
    schema: SEQUENTIAL_PROJECT_EXPORT_SCHEMA,
    stagedSchema: SEQUENTIAL_STAGED_SCHEMA,
    sourceSchema: SEQUENTIAL_SKETCH_SCHEMA,
    unit: SEQUENTIAL_SOURCE_UNIT,
    coordinateFrame: SEQUENTIAL_COORDINATE_FRAME,
    verticalAxis: SEQUENTIAL_VERTICAL_AXIS,
    branches: Object.freeze(parseStagedJson(input.sourceText)),
    constructionSession: input.session,
    confirmedConstruction: input.confirmedConstruction,
    supportProjection: input.supportProjection,
  });
}

/** Serialize route evidence and the source-compatible metadata envelope; readiness is enforced by ExportPlan. */
export function sequentialProjectArtifacts(input) {
  const text = `${JSON.stringify(exportPayload(input), null, 2)}\n`;
  return Object.freeze([Object.freeze({
    fileId: 'sequential-project-json', name: 'sequential-sketcher-project.json',
    mime: 'application/json', role: 'CONFIRMED_CONSTRUCTION',
    sourceSchema: SEQUENTIAL_PROJECT_EXPORT_SCHEMA, text,
  })]);
}

function sequentialBlockers(input) {
  const blockers = [];
  if (input.session?.state !== 'ROUTE_COMPLETE') blockers.push(`Construction state is ${input.session?.state || 'NOT_STARTED'}; ROUTE_COMPLETE is required.`);
  if (!input.confirmedConstruction) blockers.push('Confirmed construction evidence is unavailable.');
  if (!input.supportProjection) blockers.push('Support projection evidence is unavailable.');
  return blockers;
}

function sequentialCalculations(input) {
  return {
    confirmedComponents: input.confirmedConstruction?.audit?.confirmedComponentCount || 0,
    committedConnections: input.confirmedConstruction?.audit?.committedConnectionCount || 0,
    repairs: input.confirmedConstruction?.audit?.repairCount || 0,
    supportGlyphs: input.supportProjection?.supportGlyphs?.length || 0,
    unresolvedSupportFamilies: input.supportProjection?.unresolvedSupportFamilies?.length || 0,
  };
}

/** Build platform evidence from the native supervised-construction state. */
export async function buildSequentialProjectMigration(input) {
  const calculations = sequentialCalculations(input);
  const blockers = sequentialBlockers(input);
  return buildSingleDocumentMigration({
    projectId: SEQUENTIAL_SKETCHER_PROJECT_ID, sourceName: input.sourceName,
    sourceText: input.sourceText, sourceSchema: SEQUENTIAL_SKETCH_SCHEMA,
    rootShape: 'branches', unit: SEQUENTIAL_SOURCE_UNIT, verticalAxis: SEQUENTIAL_VERTICAL_AXIS,
    coordinateFrame: SEQUENTIAL_COORDINATE_FRAME,
    stats: { branchCount: input.evidence?.branches?.length || 0, componentCount: input.evidence?.components?.length || 0, scanned: input.evidence?.branches?.length || 0, matched: calculations.confirmedComponents, filtered: 0 },
    scope: { wildcard: '', selectedIds: input.session?.rootBranchId ? [input.session.rootBranchId] : [] },
    createdAt: input.createdAt, cryptoRef: input.cryptoRef,
    writerId: 'sequentialProjectArtifacts', outputs: sequentialProjectArtifacts(input),
    hierarchy: { rootBranchId: input.session?.rootBranchId || null, branchIds: input.confirmedConstruction?.branchIds || [], constructionState: input.session?.state || 'NOT_STARTED' },
    calculations, gate: { status: blockers.length ? 'BLOCKED' : 'READY', blockers },
  });
}

export const sequentialSketcherProjectAdapter = Object.freeze({
  projectId: SEQUENTIAL_SKETCHER_PROJECT_ID, sourceSchema: SEQUENTIAL_SKETCH_SCHEMA,
  writerId: 'sequentialProjectArtifacts', buildMigration: buildSequentialProjectMigration,
});
