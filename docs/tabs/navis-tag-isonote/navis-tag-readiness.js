import { NAVIS_TAG_READINESS_SCHEMA, normalizeConfig } from './navis-tag-isonote-contracts.js';
import { builtInBoreToOdProfileSummary, hasBuiltInBoreToOdProfile } from './navis-tag-bore-od-master.js';

function record(severity, code, message, context = {}) {
  return { severity, code, message, context };
}

function requiresJson(config, tableRecords) {
  if (config.supportCoordinateSource === 'json-only' || config.supportCoordinateSource === 'prefer-json-fallback-table') return true;
  if (config.supportCoordinateSource === 'table-only') return false;
  if (!(tableRecords || []).length) return true;
  return (tableRecords || []).some((row) => !row.position);
}

function tablePositionMappingStatus(config, headers = []) {
  if (config.tablePositionMode === 'separate') {
    const columns = [config.tableEastingColumn, config.tableNorthingColumn, config.tableElevationColumn];
    const missingConfigured = columns.some((column) => !column);
    const missingHeaders = columns.filter(Boolean).filter((column) => !headers.includes(column));
    return {
      valid: !missingConfigured && !missingHeaders.length,
      code: missingConfigured ? 'TABLE_SEPARATE_POSITION_COLUMNS_INCOMPLETE' : missingHeaders.length ? 'TABLE_SEPARATE_POSITION_COLUMNS_NOT_FOUND' : '',
      message: missingConfigured
        ? 'Separate table coordinate mode requires configured Easting, Northing and Elevation columns.'
        : missingHeaders.length
          ? `Configured separate table coordinate columns are not present: ${missingHeaders.join(', ')}.`
          : '',
    };
  }
  const valid = Boolean(config.tablePositionColumn && headers.includes(config.tablePositionColumn));
  return {
    valid,
    code: valid ? '' : 'TABLE_SINGLE_POSITION_COLUMN_NOT_FOUND',
    message: valid ? '' : `Configured table position column "${config.tablePositionColumn || '(blank)'}" is not present.`,
  };
}

export function buildNavisTagIsonoteReadiness(input = {}) {
  const config = normalizeConfig(input.config || {});
  const tableBuild = input.tableBuild || null;
  const resolutionBuild = input.resolutionBuild || tableBuild;
  const tableImport = input.tableImport || null;
  const tree = input.tree || null;
  const stagedIndex = input.stagedIndex || null;
  const identityTrace = input.identityTrace || null;
  const navisParse = input.navisParse || null;

  const records = tableBuild?.records || [];
  const resolutionRecords = resolutionBuild?.records || [];
  const resolutionSource = resolutionBuild?.sourceKind || (records.length ? 'SUPPORT_TABLE' : '');
  const headers = tableBuild?.headers || [];
  const blockers = [];
  const warnings = [];
  const tableModeRequired = config.supportCoordinateSource === 'table-only';
  const usingStagedRows = resolutionSource === 'STAGED_JSON' && resolutionRecords.length > 0;

  if (!records.length && tableModeRequired) {
    if (tableImport?.kind === 'workbook') {
      const selected = tableImport.selectedSheetName || '(none)';
      blockers.push(record('ERROR', 'WORKBOOK_SUPPORT_TABLE_ROWS_MISSING', `Workbook was loaded, but selected worksheet "${selected}" produced no support-table data rows. Review the selected worksheet, header row and table identity columns.`, {
        selectedSheetName: tableImport.selectedSheetName || '',
        headerRowNumber: tableImport.headerRowNumber || 0,
        candidateDataRowCount: tableImport.candidateDataRowCount || 0,
        selectionMode: tableImport.selectionMode || '',
      }));
    } else {
      blockers.push(record('ERROR', 'TABLE_ROWS_MISSING', 'Table-only coordinate mode is selected, but no support-table rows are available.'));
    }
  } else if (!records.length && tableImport?.kind === 'workbook' && usingStagedRows) {
    warnings.push(record('WARN', 'WORKBOOK_SUPPORT_TABLE_ROWS_MISSING_USING_STAGED_JSON', 'The loaded workbook produced no support-table rows. Resolution will continue using staged JSON support identities and coordinates.', {
      selectedSheetName: tableImport.selectedSheetName || '',
      headerRowNumber: tableImport.headerRowNumber || 0,
      resolutionRowCount: resolutionRecords.length,
    }));
  }

  if (!resolutionRecords.length && !tableModeRequired) {
    blockers.push(record('ERROR', 'RESOLUTION_ROWS_MISSING', 'No support rows are available from either the support table or the staged JSON identity index.'));
  }

  const identityRows = records.filter((row) => row.identity);
  if (records.length && !identityRows.length) blockers.push(record('ERROR', 'TABLE_IDENTITY_MAPPING_INVALID', `Configured table identity columns produce no support identities. Available headers: ${headers.join(', ') || '(none)'}.`, {
    configuredIdentityColumns: config.tableIdentityColumns,
    availableHeaders: headers,
    selectedSheetName: tableImport?.selectedSheetName || '',
  }));
  else if (identityRows.length < records.length) warnings.push(record('WARN', 'TABLE_IDENTITIES_PARTIAL', `${records.length - identityRows.length} table rows have no configured identity.`));

  const tablePositionMapping = tablePositionMappingStatus(config, headers);
  if ((records.length || tableModeRequired) && !tablePositionMapping.valid) {
    const item = record(tableModeRequired ? 'ERROR' : 'WARN', tablePositionMapping.code, tablePositionMapping.message);
    (tableModeRequired ? blockers : warnings).push(item);
  }

  const jsonRequired = requiresJson(config, records);
  if (jsonRequired && !tree?.summary?.nodeCount) blockers.push(record('ERROR', 'STAGED_JSON_REQUIRED', 'The selected coordinate mode requires staged JSON hierarchy evidence.'));
  if (tree?.summary?.nodeCount && !stagedIndex?.entries?.length) {
    const item = record(jsonRequired ? 'ERROR' : 'WARN', 'STAGED_IDENTITY_INDEX_EMPTY', 'The staged hierarchy was parsed, but configured JSON identity paths produced no support index entries.');
    (jsonRequired ? blockers : warnings).push(item);
  }
  if (stagedIndex?.entries?.length && !stagedIndex.entries.some((entry) => entry.position)) {
    const item = record(jsonRequired ? 'ERROR' : 'WARN', 'STAGED_POSITION_INDEX_EMPTY', 'Configured JSON proximity paths produced no staged support coordinates.');
    (jsonRequired ? blockers : warnings).push(item);
  }

  if (tree?.summary?.nodeCount && !tree.summary.branchResolvedNodeCount) warnings.push(record('WARN', 'STAGED_BRANCH_ANCESTOR_UNRESOLVED', 'No staged hierarchy node has a resolved branch ancestor.'));
  if (tree?.summary?.nodeCount && !tree.summary.pipeResolvedNodeCount) warnings.push(record('WARN', 'STAGED_PIPE_ANCESTOR_UNRESOLVED', 'No staged hierarchy node has a resolved pipe ancestor.'));
  if (tree?.summary?.nodeCount && !tree.summary.zoneResolvedNodeCount) warnings.push(record('WARN', 'STAGED_ZONE_ANCESTOR_UNRESOLVED', 'No staged hierarchy node has a resolved zone ancestor.'));

  const customLookupEntryCount = Object.keys(config.boreToOdLookup || {}).length;
  const builtInProfile = builtInBoreToOdProfileSummary(config.boreToOdLookupName);
  const builtInProfileAvailable = hasBuiltInBoreToOdProfile(config.boreToOdLookupName);
  if (config.boreToOdLookupEnabled && !customLookupEntryCount && !builtInProfileAvailable) {
    blockers.push(record('ERROR', 'BORE_TO_OD_LOOKUP_PROFILE_INVALID', `Bore-to-OD lookup is enabled, but profile "${config.boreToOdLookupName || '(blank)'}" is not a known built-in profile and no custom lookup entries are configured.`, {
      requestedProfile: config.boreToOdLookupName || '',
      customLookupEntryCount,
    }));
  }

  const validTags = navisParse?.tags?.filter((tag) => tag.position && tag.commentBody) || [];
  if (!validTags.length) blockers.push(record('ERROR', 'NAVIS_VALID_TAGS_MISSING', 'No Navis tag has both a comment body and usable 3D position.'));

  if (tableModeRequired && records.length && !records.some((row) => row.position)) {
    blockers.push(record('ERROR', 'TABLE_POSITION_MAPPING_INVALID', 'Table-only mode is selected, but no table row has a parsed position.'));
  }

  if (identityTrace?.rows?.length) {
    const positionReady = identityTrace.rows.filter((row) => row.position || row.tableRecord?.position).length;
    if (!positionReady && config.supportCoordinateSource !== 'table-only') {
      blockers.push(record('ERROR', 'IDENTITY_POSITION_UNRESOLVED', 'Identity trace contains no row with a usable table or staged coordinate.'));
    }
    if (identityTrace.summary?.ambiguousCount) warnings.push(record('WARN', 'IDENTITY_AMBIGUITIES_PRESENT', `${identityTrace.summary.ambiguousCount} identities require review.`));
  }

  const status = blockers.length ? 'BLOCKED' : warnings.length ? 'READY_WITH_WARNINGS' : 'READY';
  return {
    schema: NAVIS_TAG_READINESS_SCHEMA,
    status,
    canBuild: Boolean(resolutionRecords.length || input.hasSourceText),
    canResolve: blockers.length === 0,
    blockers,
    warnings,
    summary: {
      tableRowCount: records.length,
      resolutionRowCount: resolutionRecords.length,
      resolutionSource,
      usingStagedResolutionRows: usingStagedRows,
      tableIdentityCount: identityRows.length,
      tableSourceKind: tableImport?.kind || '',
      workbookSheetCount: tableImport?.sheetCount || 0,
      selectedSheetName: tableImport?.selectedSheetName || '',
      selectedSheetHeaderRow: tableImport?.headerRowNumber || 0,
      selectedSheetCandidateDataRows: tableImport?.candidateDataRowCount || 0,
      workbookSelectionMode: tableImport?.selectionMode || '',
      tablePositionMode: config.tablePositionMode,
      tablePositionMappingValid: tablePositionMapping.valid,
      stagedJsonRequired: jsonRequired,
      hierarchyNodeCount: tree?.summary?.nodeCount || 0,
      stagedIndexCount: stagedIndex?.entries?.length || 0,
      branchResolvedNodeCount: tree?.summary?.branchResolvedNodeCount || 0,
      pipeResolvedNodeCount: tree?.summary?.pipeResolvedNodeCount || 0,
      zoneResolvedNodeCount: tree?.summary?.zoneResolvedNodeCount || 0,
      identityResolvedCount: identityTrace?.summary?.resolvedCount || 0,
      identityAmbiguousCount: identityTrace?.summary?.ambiguousCount || 0,
      navisTagCount: navisParse?.summary?.tagCount || 0,
      validNavisTagCount: validTags.length,
      boreToOdLookupEnabled: config.boreToOdLookupEnabled,
      boreToOdLookupEntryCount: customLookupEntryCount,
      boreToOdBuiltInProfileAvailable: builtInProfileAvailable,
      boreToOdBuiltInProfile: builtInProfile,
    },
  };
}
