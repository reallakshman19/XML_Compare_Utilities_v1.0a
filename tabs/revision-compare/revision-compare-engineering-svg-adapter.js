/** Overlay-mode EngineeringSvgAdapter.v1 wrapper around the existing Revision Compare projection. */
import { createEngineeringPropertySet } from '../../core/engineering-scene/index.js';
import { createEngineeringSvgAdapter } from '../../core/engineering-svg/engineering-svg-adapter.js';
import { createEngineeringSvgPropertyProvider } from '../../core/engineering-svg/engineering-svg-property-provider.js';
import { classifyRevisionChangedProperty } from './revision-compare-property-evidence.js';
import { createRevisionCompareEngineeringSvgScene } from './revision-compare-engineering-svg-scene.js';

export const REVISION_COMPARE_ENGINEERING_SVG_ADAPTER_SCHEMA = 'RevisionCompareEngineeringSvgAdapter.v1';

function requiredFunction(value, label) {
  if (typeof value !== 'function') throw new TypeError(`${label} must be a function.`);
  return value;
}

function buildScene(getAudit) {
  const audit = getAudit();
  const projection = createRevisionCompareEngineeringSvgScene({
    models: { source: audit.visualModels.revA, target: audit.visualModels.revB },
    statusByObjectId: audit.visualModels.statusByObjectId,
  });
  return projection.scene;
}

function differenceOwnersByObjectId(audit) {
  const owners = new Map();
  for (const row of audit.differenceRows ?? []) {
    const objectIds = [row.visualRefs?.sourceObjectId, row.visualRefs?.targetObjectId].filter(Boolean);
    for (const objectId of objectIds) owners.set(objectId, row.differenceId);
  }
  return owners;
}

function rowsByDifferenceId(audit) {
  const rows = new Map();
  for (const row of audit.differenceRows ?? []) rows.set(row.differenceId, row);
  return rows;
}

function supportedFields(row) {
  return (row?.changedProperties ?? [])
    .map(classifyRevisionChangedProperty)
    .filter((item) => item.supported)
    .map((item) => item.field);
}

function propertyProviderFor(getAudit) {
  return createEngineeringSvgPropertyProvider({
    getPropertySets({ selectedIds, revision }) {
      const scene = buildScene(getAudit);
      if (JSON.stringify(revision.value) !== JSON.stringify(scene.revision.value)) {
        throw new TypeError('Revision Compare adapter property request uses a stale scene revision.');
      }
      const audit = getAudit();
      const objectOwners = differenceOwnersByObjectId(audit);
      const rows = rowsByDifferenceId(audit);
      const differenceIds = new Set(selectedIds.map((id) => objectOwners.get(id)).filter(Boolean));
      const ownerIdsByDifference = new Map();
      for (const [objectId, differenceId] of objectOwners) {
        if (!selectedIds.includes(objectId)) continue;
        if (!ownerIdsByDifference.has(differenceId)) ownerIdsByDifference.set(differenceId, []);
        ownerIdsByDifference.get(differenceId).push(objectId);
      }
      const sets = [];
      differenceIds.forEach((differenceId) => {
        const fields = supportedFields(rows.get(differenceId));
        if (!fields.length) return;
        sets.push(createEngineeringPropertySet({
          id: `revision-compare-adapter-properties:${differenceId}`,
          revision: scene.revision,
          ownerIds: ownerIdsByDifference.get(differenceId) ?? [],
          fields,
          metadata: { source: 'RevisionDifferenceRow.v1.changedProperties', differenceId },
        }));
      });
      return sets;
    },
  });
}

export function createRevisionCompareEngineeringSvgAdapter(options = {}) {
  const getAudit = requiredFunction(options.getAudit, 'Revision Compare engineering SVG getAudit');
  const subscribeAudit = requiredFunction(options.subscribeAudit, 'Revision Compare engineering SVG subscribeAudit');
  const adapterId = String(options.adapterId || 'revision-compare-overlay').trim();
  if (!adapterId) throw new TypeError('Revision Compare engineering SVG adapterId is required.');

  const adapter = createEngineeringSvgAdapter({
    descriptor: {
      adapterId,
      domainType: 'REVISION_COMPARE',
      accessMode: 'read-only',
      projections: ['ISO', 'XY', 'XZ', 'YZ'],
      capabilities: { selection: true, properties: true, editing: false, overlay: true },
      metadata: { owner: 'revision-compare' },
    },
    getScene: () => buildScene(getAudit),
    subscribeScene(listener) {
      const unsubscribe = subscribeAudit((event) => {
        listener({ scene: buildScene(getAudit), reason: String(event?.reason || 'revision-compare-audit-update') });
      });
      if (typeof unsubscribe !== 'function') {
        throw new TypeError('Revision Compare engineering SVG subscribeAudit must return an unsubscribe function.');
      }
      return unsubscribe;
    },
    propertyProvider: propertyProviderFor(getAudit),
  });

  return Object.freeze({
    schema: REVISION_COMPARE_ENGINEERING_SVG_ADAPTER_SCHEMA,
    adapter,
  });
}
