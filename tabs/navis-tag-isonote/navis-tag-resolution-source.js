import { normalizeConfig, normalizeReference, supportRoot, text } from './navis-tag-isonote-contracts.js';

function uniqueText(values) {
  const seen = new Set();
  const output = [];
  for (const value of values || []) {
    const normalized = text(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    output.push(normalized);
  }
  return output;
}

function coordinateKey(entry, index) {
  const point = entry?.position;
  if (![point?.x, point?.y, point?.z].every((value) => Number.isFinite(Number(value)))) {
    return `NO_POSITION:${entry?.nodeId || entry?.identity || index}`;
  }
  return [point.x, point.y, point.z].map((value) => Number(value).toFixed(6)).join('|');
}

function groupStagedEntriesByCoordinate(entries = []) {
  const groups = new Map();
  entries.forEach((entry, index) => {
    if (!text(entry?.identity)) return;
    const key = coordinateKey(entry, index);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(entry);
  });
  return [...groups.entries()].map(([key, members]) => ({ key, members }));
}

function stagedEntriesToResolutionRecord(group, index) {
  const members = group?.members || [];
  const entry = members[0] || {};
  const groupedIdentityRaws = uniqueText(members.map((item) => item?.identityRaw || item?.identity));
  const groupedIdentities = uniqueText(members.map((item) => item?.identity));
  const groupedReferencesRaw = uniqueText(members.map((item) => item?.referenceRaw || item?.reference));
  const groupedReferences = uniqueText(members.map((item) => item?.reference || normalizeReference(item?.referenceRaw)));
  const groupedSupportRoots = uniqueText(members.map((item) => item?.supportRoot || supportRoot(item?.identity)));
  const groupedNodeIds = uniqueText(members.map((item) => item?.nodeId));
  const groupedJsonPaths = uniqueText(members.map((item) => item?.jsonPath));
  const identity = groupedIdentities[0] || text(entry?.identity);
  const identityRaw = groupedIdentityRaws.join('|') || text(entry?.identityRaw || identity);
  const referenceRaw = groupedReferencesRaw.join('|');
  const reference = groupedReferences.join('|');
  const inputPipe = text(entry?.resolvedPipe || entry?.resolvedBranch);
  const identityColumn = uniqueText(members.map((item) => item?.identityPath || 'STAGED_JSON_IDENTITY')).join('|');
  const referenceColumn = uniqueText(members.map((item) => item?.referencePath)).join('|');
  const pipeColumn = uniqueText(members.map((item) => item?.resolvedPipePath || item?.resolvedBranchPath)).join('|');

  return {
    rowId: `STAGED-${index + 1}`,
    rowIndex: index + 1,
    rawRow: {
      'Name of the element': identityRaw,
      'Reference of the element': referenceRaw,
      PIPE: inputPipe,
      POS: entry?.positionRaw ?? '',
      'Grouped Identity Count': members.length,
      'Grouped Canonical Identities': groupedIdentities.join('|'),
      'Grouped JSON Node IDs': groupedNodeIds.join('|'),
      'Grouped JSON Paths': groupedJsonPaths.join('|'),
      'Staged JSON Source File': entry?.sourceFile || '',
      'Staged JSON Path': entry?.jsonPath || '',
    },
    identityRaw,
    identity,
    supportRoot: groupedSupportRoots.length === 1 ? groupedSupportRoots[0] : (entry?.supportRoot || supportRoot(identity)),
    identityColumn,
    identityValues: groupedIdentityRaws.map((value, memberIndex) => ({
      column: members[memberIndex]?.identityPath || identityColumn,
      value,
    })),
    inputReferenceRaw: referenceRaw,
    inputReference: reference,
    inputReferenceColumn: referenceColumn,
    // The staged position is intentionally kept on the selected identity-trace entry.
    // Leaving the synthetic table position empty preserves correct source attribution.
    position: null,
    positionRaw: '',
    positionColumn: '',
    inputPipe,
    inputPipeColumn: pipeColumn,
    existingIsometricNotes: '',
    sourceKind: 'STAGED_JSON',
    stagedNodeId: entry?.nodeId || '',
    stagedSourceFile: entry?.sourceFile || '',
    stagedJsonPath: entry?.jsonPath || '',
    coordinateGroupKey: group?.key || '',
    groupMemberCount: members.length,
    groupedIdentityRaws,
    groupedIdentities,
    groupedReferencesRaw,
    groupedReferences,
    groupedSupportRoots,
    groupedNodeIds,
    groupedJsonPaths,
  };
}

export function buildResolutionSupportRecords(tableBuild, stagedIndex, inputConfig = {}) {
  const config = normalizeConfig({ ...(tableBuild?.config || {}), ...(stagedIndex?.config || {}), ...inputConfig });
  const tableRecords = tableBuild?.records || [];

  if (tableRecords.length || config.supportCoordinateSource === 'table-only') {
    return {
      ...(tableBuild || {}),
      config,
      sourceKind: 'SUPPORT_TABLE',
      summary: {
        ...(tableBuild?.summary || {}),
        resolutionRowCount: tableRecords.length,
        resolutionSource: 'SUPPORT_TABLE',
      },
    };
  }

  const sourceEntries = (stagedIndex?.entries || []).filter((entry) => text(entry?.identity));
  const groups = groupStagedEntriesByCoordinate(sourceEntries);
  const records = groups.map(stagedEntriesToResolutionRecord);
  const diagnostics = [...(tableBuild?.diagnostics || [])];
  const multiIdentityGroupCount = records.filter((record) => record.groupMemberCount > 1).length;

  if (records.length) {
    diagnostics.push({
      severity: 'INFO',
      code: 'STAGED_JSON_RESOLUTION_ROWS_SYNTHESIZED',
      message: `${records.length} coordinate-grouped resolution rows were created from ${sourceEntries.length} refined staged JSON identities because no support table was provided.`,
      context: {
        resolutionRowCount: records.length,
        sourceIdentityCount: sourceEntries.length,
        multiIdentityCoordinateGroupCount: multiIdentityGroupCount,
      },
    });
  }

  return {
    config,
    headers: [
      'Name of the element',
      'Reference of the element',
      'PIPE',
      'POS',
      'Grouped Identity Count',
      'Grouped Canonical Identities',
      'Grouped JSON Node IDs',
      'Grouped JSON Paths',
      'Staged JSON Source File',
      'Staged JSON Path',
    ],
    records,
    diagnostics,
    sourceKind: 'STAGED_JSON',
    summary: {
      rowCount: records.length,
      resolutionRowCount: records.length,
      resolutionSource: 'STAGED_JSON',
      identityCount: sourceEntries.length,
      coordinateGroupCount: records.length,
      multiIdentityCoordinateGroupCount: multiIdentityGroupCount,
      referenceCount: sourceEntries.filter((entry) => entry.reference).length,
      positionedRowCount: groups.filter((group) => group.members[0]?.position).length,
      pipeCount: records.filter((row) => row.inputPipe).length,
      tableRowCount: tableRecords.length,
    },
  };
}

export const _test = Object.freeze({ coordinateKey, groupStagedEntriesByCoordinate, stagedEntriesToResolutionRecord });
