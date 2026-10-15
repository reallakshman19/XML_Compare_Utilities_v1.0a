/** Phase 6 adapter retaining the Topology Editor's native source and export contracts. */

import { PROJECT_MIGRATION_SCHEMA } from '../../contracts/project-migration-contract.js';
import { buildTopologyExportPlan, createTopologyPlatformContext } from './topology-platform-adapter.js';

export const TOPOLOGY_PROJECT_ID = 'topology-editor';

/** Publish existing topology context and exact native outputs as migration evidence. */
export async function buildTopologyProjectMigration(input) {
  const context = await createTopologyPlatformContext({
    sourceText: input.sourceText, sourceName: input.sourceName,
    sourceBranches: input.sourceBranches, verticalAxis: input.verticalAxis,
    createdAt: input.createdAt, cryptoRef: input.cryptoRef,
  });
  const exportPlan = await buildTopologyExportPlan({
    context, draft: input.draft, commandJournal: input.commandJournal,
    built: input.built, outputs: input.outputs, createdAt: input.createdAt,
    cryptoRef: input.cryptoRef,
  });
  return Object.freeze({
    schema: PROJECT_MIGRATION_SCHEMA, projectId: TOPOLOGY_PROJECT_ID,
    nativeSourceSchema: 'TopologyEditSource.v1', nativeWriterId: 'topologyArtifactOutputs',
    document: context.document, session: context.session, exportPlan,
    outputs: Object.freeze(input.outputs.map((output) => Object.freeze({ ...output }))),
  });
}

export const topologyProjectAdapter = Object.freeze({
  projectId: TOPOLOGY_PROJECT_ID,
  sourceSchema: 'TopologyEditSource.v1',
  writerId: 'topologyArtifactOutputs',
  buildMigration: buildTopologyProjectMigration,
});
