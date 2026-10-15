import { createLinewiseUniversalPreset, normalizeUniversalCategorizerProfile } from './universal-xml-categorizer-contracts.js';
import { getUniversalRowKey, hasUniversalRowKey, parseUniversalKeyFields } from './universal-field-catalog.js';
import { createLinewiseUniversalSourcePreviewInputs, createUniversalSourceRegistry } from './universal-source-registry.js';

export const UNIVERSAL_ATTACHMENT_PREVIEW_SCHEMA = 'universal-attachment-preview/v1-shadow';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();

export function createUniversalAttachmentPreview(input = {}) {
  const profile = normalizeUniversalCategorizerProfile(input.profile || input.profileInput || createLinewiseUniversalPreset());
  const registry = input.registry?.schema === 'universal-source-registry/v1-shadow'
    ? input.registry
    : createUniversalSourceRegistry(profile, input.sourceInputs || input.sources || {});
  const targetRows = normalizeTargetRows(input.targetRows || input.targets || []);
  const rules = profile.sideloadAttachments.map((rule) => buildRulePreview(rule, profile, registry, targetRows));
  const ruleDiagnostics = rules.flatMap((rule) => rule.diagnostics || []);
  const matched = rules.reduce((sum, rule) => sum + rule.matchedCount, 0);
  const missingTargets = rules.reduce((sum, rule) => sum + rule.missingTargetRows.length, 0);
  const unmatchedSources = rules.reduce((sum, rule) => sum + rule.unmatchedSourceRows.length, 0);

  return freeze({
    schema: UNIVERSAL_ATTACHMENT_PREVIEW_SCHEMA,
    profileId: profile.profileId,
    sourceRegistry: registry,
    targetRows,
    rules: freeze(rules),
    totals: freeze({
      rules: rules.length,
      matched,
      missingTargets,
      unmatchedSources,
    }),
    diagnostics: freeze([...(registry.diagnostics || []), ...ruleDiagnostics]),
  });
}

export function createLinewiseUniversalAttachmentPreviewModel(profile = createLinewiseUniversalPreset()) {
  const normalizedProfile = normalizeUniversalCategorizerProfile(profile || createLinewiseUniversalPreset());
  const sourceInputs = createLinewiseUniversalSourcePreviewInputs();
  const targetRows = createLinewiseUniversalTargetPreviewRows();
  const registry = createUniversalSourceRegistry(normalizedProfile, sourceInputs);
  const preview = createUniversalAttachmentPreview({ profile: normalizedProfile, registry, targetRows });
  return freeze({
    schema: 'linewise-universal-attachment-preview/v1-shadow',
    profile: normalizedProfile,
    sourceInputs,
    targetRows,
    registry,
    preview,
  });
}

export function createLinewiseUniversalTargetPreviewRows() {
  return freeze([
    freeze({ levelId: 'element', elementKey: '10+20', label: 'Element 10-20' }),
    freeze({ levelId: 'node', nodeNumber: '10', label: 'Node 10' }),
    freeze({ levelId: 'node', nodeNumber: '20', label: 'Node 20' }),
  ]);
}

function buildRulePreview(rule, profile, registry, targetRows) {
  const source = registry.sourceMap?.[rule.sourceId] || null;
  const targetLevel = profile.levelDefinitions.find((level) => level.levelId === rule.attachToLevelId) || null;
  const exactTargetBlock = profile.blockDefinitions.find((block) => block.blockName === rule.blockName && (!block.attachToLevelId || block.attachToLevelId === rule.attachToLevelId)) || null;
  const namedTargetBlock = profile.blockDefinitions.find((block) => block.blockName === rule.blockName) || null;
  const targetBlock = exactTargetBlock || namedTargetBlock;
  const targetBlockLevelMatches = Boolean(targetBlock && (!targetBlock.attachToLevelId || targetBlock.attachToLevelId === rule.attachToLevelId));
  const sourceRows = source?.rows || [];
  const targetRowsForLevel = targetRows.filter((row) => row.levelId === rule.attachToLevelId || row.targetLevelId === rule.attachToLevelId);
  const targetIndex = indexTargetRows(targetRowsForLevel, rule.targetKey);
  const sourceKeyFields = parseUniversalKeyFields(rule.sourceKey);
  const matchedRows = [];
  const unmatchedSourceRows = [];
  const missingTargetRows = [];
  const validSourceKeys = new Set();

  sourceRows.forEach((row, sourceIndex) => {
    const key = getUniversalRowKey(row, rule.sourceKey);
    if (!hasUniversalRowKey(row, rule.sourceKey)) {
      unmatchedSourceRows.push(previewRow('missing-source-key', sourceIndex, key, row));
      return;
    }
    validSourceKeys.add(key);
    const matches = targetIndex[key] || [];
    if (!matches.length) {
      missingTargetRows.push(previewRow('missing-target-row', sourceIndex, key, row));
      return;
    }
    for (const match of matches) {
      matchedRows.push(freeze({
        sourceIndex,
        sourceKey: key,
        targetIndex: match.targetIndex,
        targetKey: match.targetKey,
        sourceRow: row,
        targetRow: match.row,
      }));
    }
  });

  const targetRowsWithoutSource = targetRowsForLevel
    .map((row, targetIndexValue) => ({ row, targetIndex: targetIndexValue, targetKey: text(row?.[rule.targetKey]) }))
    .filter((item) => item.targetKey && !validSourceKeys.has(item.targetKey))
    .map((item) => freeze({ reason: 'target-row-without-source', targetIndex: item.targetIndex, targetKey: item.targetKey, targetRow: item.row }));

  const diagnostics = [
    ...(!source ? [diagnostic('error', 'UXC_ATTACHMENT_SOURCE_NOT_FOUND', rule.ruleId, `Attachment rule "${rule.ruleId}" references missing source "${rule.sourceId}".`)] : []),
    ...(!targetLevel ? [diagnostic('error', 'UXC_ATTACHMENT_LEVEL_NOT_FOUND', rule.ruleId, `Attachment rule "${rule.ruleId}" references missing level "${rule.attachToLevelId}".`)] : []),
    ...(!targetBlock ? [diagnostic('error', 'UXC_ATTACHMENT_BLOCK_NOT_FOUND', rule.ruleId, `Attachment rule "${rule.ruleId}" references missing block "${rule.blockName}".`)] : []),
    ...(targetBlock && !targetBlockLevelMatches ? [diagnostic('warn', 'UXC_ATTACHMENT_BLOCK_LEVEL_MISMATCH', rule.ruleId, `Attachment rule "${rule.ruleId}" targets level "${rule.attachToLevelId}" but block "${rule.blockName}" is declared for level "${targetBlock.attachToLevelId}".`)] : []),
    ...(source && sourceKeyFields.some((field) => !source.columns.includes(field)) ? [diagnostic('error', 'UXC_ATTACHMENT_SOURCE_KEY_COLUMN_MISSING', rule.ruleId, `Attachment rule "${rule.ruleId}" source key is not fully present in source "${rule.sourceId}".`)] : []),
    ...(missingTargetRows.length ? [diagnostic('warn', 'UXC_ATTACHMENT_MISSING_TARGET_ROWS', rule.ruleId, `${missingTargetRows.length} source row(s) did not resolve to a target ${rule.attachToLevelId} row.`)] : []),
    ...(unmatchedSourceRows.length ? [diagnostic('warn', 'UXC_ATTACHMENT_UNMATCHED_SOURCE_ROWS', rule.ruleId, `${unmatchedSourceRows.length} source row(s) cannot produce the source key "${rule.sourceKey}".`)] : []),
  ];

  return freeze({
    schema: 'UniversalAttachmentRulePreview.v1-shadow',
    ruleId: rule.ruleId,
    mode: rule.mode,
    sourceId: rule.sourceId,
    sourceKey: rule.sourceKey,
    sourceKeyFields,
    targetKey: rule.targetKey,
    targetLevelId: rule.attachToLevelId,
    fieldBindings: rule.fieldBindings,
    targetLevel: freeze({
      levelId: rule.attachToLevelId,
      displayName: targetLevel?.displayName || '',
      resolved: Boolean(targetLevel),
    }),
    targetBlock: freeze({
      blockName: rule.blockName,
      attachToLevelId: targetBlock?.attachToLevelId || '',
      attachToLevelMatches: targetBlockLevelMatches,
      resolved: Boolean(targetBlock),
    }),
    sourceResolved: Boolean(source),
    matchedCount: matchedRows.length,
    matchedRows: freeze(matchedRows),
    unmatchedSourceRows: freeze(unmatchedSourceRows),
    missingTargetRows: freeze(missingTargetRows),
    targetRowsWithoutSource: freeze(targetRowsWithoutSource),
    diagnostics: freeze(diagnostics),
  });
}

function normalizeTargetRows(rows = []) {
  return freeze(arr(rows).map((row) => {
    if (!row || typeof row !== 'object') return freeze({});
    return freeze(Object.fromEntries(Object.entries(row).map(([key, value]) => [text(key), value])));
  }));
}

function indexTargetRows(rows = [], targetKey = '') {
  const index = {};
  arr(rows).forEach((row, targetIndex) => {
    const key = text(row?.[targetKey]);
    if (!key) return;
    if (!index[key]) index[key] = [];
    index[key].push(freeze({ targetIndex, targetKey: key, row }));
  });
  return freeze(Object.fromEntries(Object.entries(index).map(([key, values]) => [key, freeze(values)])));
}

function previewRow(reason, sourceIndex, sourceKey, sourceRow) {
  return freeze({ reason, sourceIndex, sourceKey, sourceRow });
}

function diagnostic(severity, code, ruleId, message) {
  return freeze({ severity, code, ruleId, message });
}

export const _test = freeze({ buildRulePreview, normalizeTargetRows, indexTargetRows, diagnostic });
