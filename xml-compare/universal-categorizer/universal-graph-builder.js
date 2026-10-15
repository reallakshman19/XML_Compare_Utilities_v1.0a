import { createLinewiseUniversalPreset, normalizeUniversalCategorizerProfile } from './universal-xml-categorizer-contracts.js';
import { createLinewiseUniversalAttachmentPreviewModel, createLinewiseUniversalTargetPreviewRows, createUniversalAttachmentPreview } from './universal-attachment-preview.js';
import { createLinewiseUniversalSourcePreviewInputs, createUniversalSourceRegistry, findForbiddenUxc001Changes } from './universal-source-registry.js';

export const UNIVERSAL_GRAPH_BUILDER_SCHEMA = 'universal-graph-builder/v1-shadow';
export const UNIVERSAL_CATEGORIZED_GRAPH_SCHEMA = 'CategorizedGraph.v1-preview-shadow';
export const UNIVERSAL_GRAPH_XML_EXPORT_STATUS = 'disabled-until-graph-preview-is-deterministic';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();

export function createUniversalCategorizedGraphPreview(input = {}) {
  const profile = normalizeUniversalCategorizerProfile(input.profile || input.profileInput || createLinewiseUniversalPreset());
  const registry = input.registry?.schema === 'universal-source-registry/v1-shadow'
    ? input.registry
    : createUniversalSourceRegistry(profile, input.sourceInputs || input.sources || {});
  const targetRows = normalizeGraphTargetRows(input.targetRows || input.targets || []);
  const levels = createGraphLevelCatalog(profile);
  const nodes = createGraphNodes(profile, targetRows);
  const nodeMap = Object.fromEntries(nodes.map((node) => [node.nodeId, node]));
  const attachmentPreview = createUniversalAttachmentPreview({ profile, registry, targetRows });
  const graphDiagnostics = [];

  attachBlockShells(nodes, profile.blockDefinitions);
  executeSideloadAttachments(nodes, attachmentPreview.rules, graphDiagnostics);

  const diagnostics = freeze([
    ...validateLevelDefinitions(profile),
    ...validateTargetRowsAgainstLevels(profile, targetRows),
    ...(registry.diagnostics || []),
    ...(attachmentPreview.diagnostics || []),
    ...graphDiagnostics,
  ]);

  return freeze({
    schema: UNIVERSAL_CATEGORIZED_GRAPH_SCHEMA,
    builderSchema: UNIVERSAL_GRAPH_BUILDER_SCHEMA,
    profileId: profile.profileId,
    exportStatus: UNIVERSAL_GRAPH_XML_EXPORT_STATUS,
    xmlExportEnabled: false,
    sources: freeze(registry.sources.map((source) => freeze({ sourceId: source.sourceId, role: source.role, rowCount: source.rowCount, status: source.status }))),
    levels,
    nodes: freeze(nodes.map(freezeGraphNode)),
    nodeMap: freeze(Object.fromEntries(Object.entries(nodeMap).map(([key, node]) => [key, freezeGraphNode(node)]))),
    attachmentPreview,
    summary: summarizeGraph(nodes, levels, diagnostics),
    diagnostics,
  });
}

export function createLinewiseUniversalCategorizedGraphPreview(profile = createLinewiseUniversalPreset()) {
  const normalizedProfile = normalizeUniversalCategorizerProfile(profile || createLinewiseUniversalPreset());
  const sourceInputs = createLinewiseUniversalSourcePreviewInputs();
  const targetRows = createLinewiseUniversalTargetPreviewRows();
  const registry = createUniversalSourceRegistry(normalizedProfile, sourceInputs);
  return createUniversalCategorizedGraphPreview({ profile: normalizedProfile, registry, targetRows });
}

export function createGraphLevelCatalog(profileInput = createLinewiseUniversalPreset()) {
  const profile = normalizeUniversalCategorizerProfile(profileInput || createLinewiseUniversalPreset());
  const levelMap = Object.fromEntries(profile.levelDefinitions.map((level, index) => [level.levelId, freeze({
    levelId: level.levelId,
    displayName: level.displayName,
    children: level.children,
    ordinal: index,
  })]));
  const referencedChildren = new Set(profile.levelDefinitions.flatMap((level) => level.children || []));
  return freeze({
    roots: freeze(profile.levelDefinitions.filter((level) => !referencedChildren.has(level.levelId)).map((level) => level.levelId)),
    items: freeze(profile.levelDefinitions.map((level) => levelMap[level.levelId])),
    levelMap: freeze(levelMap),
  });
}

export function createGraphNodes(profileInput = createLinewiseUniversalPreset(), targetRows = []) {
  const profile = normalizeUniversalCategorizerProfile(profileInput || createLinewiseUniversalPreset());
  return freeze(normalizeGraphTargetRows(targetRows).map((row, index) => {
    const levelId = text(row.levelId || row.targetLevelId);
    const keyField = inferTargetKeyForLevel(profile, levelId, row);
    const key = keyField ? text(row[keyField]) : text(row.nodeKey || row.key || row.id, String(index + 1));
    return {
      schema: 'UniversalGraphNode.v1-preview-shadow',
      nodeId: makeNodeId(levelId, key, index),
      levelId,
      key,
      keyField,
      label: text(row.label, `${levelId || 'node'} ${key || index + 1}`),
      parentId: text(row.parentId),
      source: freeze({ kind: 'target-preview-row', rowIndex: index }),
      row,
      blocks: {},
      diagnostics: [],
    };
  }));
}

export function normalizeGraphTargetRows(rows = []) {
  return freeze(arr(rows).map((row) => {
    if (!row || typeof row !== 'object') return freeze({});
    return freeze(Object.fromEntries(Object.entries(row).map(([key, value]) => [text(key), value])));
  }));
}

export function findForbiddenUxc002Changes(paths = []) {
  return findForbiddenUxc001Changes(paths);
}

function attachBlockShells(nodes, blockDefinitions = []) {
  for (const node of nodes) {
    for (const block of arr(blockDefinitions)) {
      if (block.attachToLevelId !== node.levelId) continue;
      ensureNodeBlock(node, block.blockName, 'block-definition', block);
    }
  }
}

function executeSideloadAttachments(nodes, rulePreviews = [], graphDiagnostics = []) {
  const index = createNodeIndex(nodes);
  for (const rule of arr(rulePreviews)) {
    for (const match of arr(rule.matchedRows)) {
      const node = findNodeForMatch(index, rule.targetLevelId, match.targetKey, match.targetRow);
      if (!node) {
        graphDiagnostics.push(diagnostic('warn', 'UXC_GRAPH_MATCHED_NODE_NOT_FOUND', rule.ruleId, `Attachment rule "${rule.ruleId}" matched target key "${match.targetKey}" but no graph node was found.`));
        continue;
      }
      const block = ensureNodeBlock(node, rule.targetBlock.blockName, 'sideload-attachment', { ruleId: rule.ruleId, attachToLevelId: rule.targetLevelId });
      const fields = materializeAttachmentFields(rule, match.sourceRow);
      block.fields = freeze({ ...block.fields, ...fields });
      block.attachments = freeze([...(block.attachments || []), freeze({
        ruleId: rule.ruleId,
        sourceId: rule.sourceId,
        sourceKey: match.sourceKey,
        targetKey: match.targetKey,
        mode: rule.mode,
      })]);
      node.diagnostics = freeze([...(node.diagnostics || []), ...((rule.diagnostics || []).filter((item) => item.code === 'UXC_ATTACHMENT_BLOCK_LEVEL_MISMATCH'))]);
    }
  }
}

function materializeAttachmentFields(rule, sourceRow = {}) {
  const bindings = arr(rule.fieldBindings || []);
  if (bindings.length) {
    return freeze(Object.fromEntries(bindings.map((binding) => [text(binding.targetField || binding.outputName || binding.sourceField), sourceRow?.[binding.sourceField]]).filter(([key]) => key)));
  }
  return freeze(Object.fromEntries(Object.entries(sourceRow || {}).map(([key, value]) => [text(key), value]).filter(([key]) => key)));
}

function createNodeIndex(nodes = []) {
  const byLevelAndKey = {};
  for (const node of arr(nodes)) {
    const indexKey = `${node.levelId}::${node.key}`;
    if (!byLevelAndKey[indexKey]) byLevelAndKey[indexKey] = [];
    byLevelAndKey[indexKey].push(node);
  }
  return freeze({ byLevelAndKey: freeze(byLevelAndKey) });
}

function findNodeForMatch(index, levelId, targetKey, targetRow = {}) {
  const direct = index.byLevelAndKey?.[`${levelId}::${targetKey}`]?.[0];
  if (direct) return direct;
  const rowNodeId = text(targetRow.nodeId);
  if (rowNodeId) {
    return Object.values(index.byLevelAndKey || {}).flat().find((node) => node.nodeId === rowNodeId) || null;
  }
  return null;
}

function ensureNodeBlock(node, blockName, source, definition = {}) {
  const normalizedBlockName = text(blockName, 'UnnamedBlock');
  if (!node.blocks[normalizedBlockName]) {
    node.blocks[normalizedBlockName] = {
      schema: 'UniversalGraphBlock.v1-preview-shadow',
      blockName: normalizedBlockName,
      attachToLevelId: text(definition.attachToLevelId, node.levelId),
      createMode: text(definition.createMode, source === 'block-definition' ? 'when-fields-present' : 'created-by-attachment'),
      source,
      fields: freeze({}),
      attachments: freeze([]),
    };
  }
  return node.blocks[normalizedBlockName];
}

function inferTargetKeyForLevel(profile, levelId, row = {}) {
  const attachment = profile.sideloadAttachments.find((rule) => rule.attachToLevelId === levelId && text(row?.[rule.targetKey]));
  if (attachment) return attachment.targetKey;
  const candidates = ['nodeNumber', 'elementKey', 'lineId', 'documentId', 'key', 'id'];
  return candidates.find((candidate) => text(row?.[candidate])) || '';
}

function makeNodeId(levelId, key, index) {
  return `${text(levelId, 'level')}:${text(key, String(index + 1))}`;
}

function validateLevelDefinitions(profile) {
  const ids = profile.levelDefinitions.map((level) => level.levelId).filter(Boolean);
  const diagnostics = [];
  for (const level of profile.levelDefinitions) {
    for (const child of level.children || []) {
      if (!ids.includes(child)) diagnostics.push(diagnostic('error', 'UXC_GRAPH_CHILD_LEVEL_NOT_FOUND', level.levelId, `Level "${level.levelId}" references missing child level "${child}".`));
    }
  }
  return freeze(diagnostics);
}

function validateTargetRowsAgainstLevels(profile, targetRows) {
  const ids = new Set(profile.levelDefinitions.map((level) => level.levelId));
  return freeze(normalizeGraphTargetRows(targetRows).flatMap((row, index) => {
    const levelId = text(row.levelId || row.targetLevelId);
    if (!levelId || ids.has(levelId)) return [];
    return [diagnostic('warn', 'UXC_GRAPH_TARGET_LEVEL_NOT_DEFINED', levelId, `Target row ${index} references undefined level "${levelId}".`)];
  }));
}

function summarizeGraph(nodes, levels, diagnostics) {
  const blockCount = nodes.reduce((sum, node) => sum + Object.keys(node.blocks || {}).length, 0);
  const attachmentCount = nodes.reduce((sum, node) => sum + Object.values(node.blocks || {}).reduce((inner, block) => inner + (block.attachments?.length || 0), 0), 0);
  return freeze({
    levels: levels.items.length,
    rootLevels: levels.roots.length,
    nodes: nodes.length,
    blocks: blockCount,
    sideloadAttachments: attachmentCount,
    diagnostics: diagnostics.length,
    xmlExportEnabled: false,
  });
}

function freezeGraphNode(node) {
  return freeze({
    ...node,
    source: freeze(node.source || {}),
    row: freeze(node.row || {}),
    blocks: freeze(Object.fromEntries(Object.entries(node.blocks || {}).map(([name, block]) => [name, freezeGraphBlock(block)]))),
    diagnostics: freeze(node.diagnostics || []),
  });
}

function freezeGraphBlock(block) {
  return freeze({
    ...block,
    fields: freeze(block.fields || {}),
    attachments: freeze(block.attachments || []),
  });
}

function diagnostic(severity, code, subjectId, message) {
  return freeze({ severity, code, subjectId, message });
}

export const _test = freeze({
  attachBlockShells,
  executeSideloadAttachments,
  materializeAttachmentFields,
  createNodeIndex,
  inferTargetKeyForLevel,
  makeNodeId,
  summarizeGraph,
});
