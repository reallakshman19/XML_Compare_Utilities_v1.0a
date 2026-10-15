import { createLinewiseUniversalPreset, normalizeUniversalCategorizerProfile } from './universal-xml-categorizer-contracts.js';

export const UNIVERSAL_RECIPE_DESIGNER_MODEL_SCHEMA = 'universal-recipe-designer-model/v1-shadow';

const freeze = (value) => Object.freeze(value);
const arr = (value) => Array.isArray(value) ? value : [];
const text = (value, fallback = '') => String(value ?? fallback).trim();

export function createLinewiseUniversalRecipeDesignerModel(profile = createLinewiseUniversalPreset()) {
  return createUniversalRecipeDesignerModel(profile || createLinewiseUniversalPreset());
}

export function createUniversalRecipeDesignerModel(profileInput = {}) {
  const profile = normalizeUniversalCategorizerProfile(profileInput || createLinewiseUniversalPreset());
  const diagnostics = validateUniversalRecipeProfile(profile);
  const errorCount = diagnostics.filter((item) => item.severity === 'error').length;
  const warningCount = diagnostics.filter((item) => item.severity === 'warning').length;
  return freeze({
    schema: UNIVERSAL_RECIPE_DESIGNER_MODEL_SCHEMA,
    profileId: profile.profileId,
    status: errorCount ? 'blocked' : warningCount ? 'review' : 'ready',
    summary: freeze({
      levels: profile.levelDefinitions.length,
      blocks: profile.blockDefinitions.length,
      sources: profile.sources.length,
      attachments: profile.sideloadAttachments.length,
      errors: errorCount,
      warnings: warningCount,
    }),
    levels: freeze(profile.levelDefinitions.map((level, index) => freeze({
      ordinal: index + 1,
      levelId: level.levelId,
      displayName: level.displayName,
      children: freeze([...level.children]),
      root: isRootLevel(profile, level.levelId),
      editable: false,
      lockedReason: 'locked-shadow-mode',
    }))),
    blocks: freeze(profile.blockDefinitions.map((block, index) => freeze({
      ordinal: index + 1,
      blockName: block.blockName,
      attachToLevelId: block.attachToLevelId,
      createMode: block.createMode,
      editable: false,
      lockedReason: 'locked-shadow-mode',
    }))),
    sources: freeze(profile.sources.map((source, index) => freeze({
      ordinal: index + 1,
      sourceId: source.sourceId,
      displayName: source.displayName,
      role: source.role,
      sourceKind: source.sourceKind,
      requiredColumns: freeze([...source.requiredColumns]),
      editable: false,
      lockedReason: 'locked-shadow-mode',
    }))),
    attachments: freeze(profile.sideloadAttachments.map((rule, index) => freeze({
      ordinal: index + 1,
      ruleId: rule.ruleId,
      sourceId: rule.sourceId,
      attachToLevelId: rule.attachToLevelId,
      blockName: rule.blockName,
      sourceKey: rule.sourceKey,
      targetKey: rule.targetKey,
      mode: rule.mode,
      editable: false,
      lockedReason: 'locked-shadow-mode',
    }))),
    commands: designerCommands(),
    diagnostics,
  });
}

export function validateUniversalRecipeProfile(profileInput = {}) {
  const profile = normalizeUniversalCategorizerProfile(profileInput || createLinewiseUniversalPreset());
  const diagnostics = [];
  const levelIds = profile.levelDefinitions.map((level) => level.levelId).filter(Boolean);
  const sourceIds = new Set(profile.sources.map((source) => source.sourceId));
  const blockNames = profile.blockDefinitions.map((block) => block.blockName).filter(Boolean);
  const blockNameSet = new Set(blockNames);
  const levelIdSet = new Set(levelIds);

  duplicateValues(levelIds).forEach((levelId) => diagnostics.push(diagnostic('error', 'UXC_RECIPE_DUPLICATE_LEVEL_ID', levelId, `Duplicate level id: ${levelId}`)));
  duplicateValues(blockNames).forEach((blockName) => diagnostics.push(diagnostic('error', 'UXC_RECIPE_DUPLICATE_BLOCK_NAME', blockName, `Duplicate block name: ${blockName}`)));

  const referencedChildren = new Set();
  for (const level of profile.levelDefinitions) {
    for (const childId of level.children || []) {
      referencedChildren.add(childId);
      if (!levelIdSet.has(childId)) diagnostics.push(diagnostic('error', 'UXC_RECIPE_MISSING_CHILD_LEVEL', level.levelId, `Level ${level.levelId} references missing child level ${childId}.`));
    }
  }

  const roots = profile.levelDefinitions.filter((level) => !referencedChildren.has(level.levelId));
  if (!roots.length && profile.levelDefinitions.length) diagnostics.push(diagnostic('error', 'UXC_RECIPE_NO_ROOT_LEVEL', profile.profileId, 'Recipe hierarchy has no root level.'));
  if (!profile.levelDefinitions.length) diagnostics.push(diagnostic('error', 'UXC_RECIPE_NO_LEVELS', profile.profileId, 'Recipe must define at least one level.'));

  const cycle = findHierarchyCycle(profile);
  if (cycle.length) diagnostics.push(diagnostic('error', 'UXC_RECIPE_HIERARCHY_CYCLE', cycle.join(' -> '), `Hierarchy cycle detected: ${cycle.join(' -> ')}.`));

  for (const block of profile.blockDefinitions) {
    if (!levelIdSet.has(block.attachToLevelId)) diagnostics.push(diagnostic('error', 'UXC_RECIPE_BLOCK_LEVEL_MISSING', block.blockName, `Block ${block.blockName} attaches to missing level ${block.attachToLevelId}.`));
  }

  for (const rule of profile.sideloadAttachments) {
    if (!sourceIds.has(rule.sourceId)) diagnostics.push(diagnostic('error', 'UXC_RECIPE_ATTACHMENT_SOURCE_MISSING', rule.ruleId, `Attachment ${rule.ruleId} references missing source ${rule.sourceId}.`));
    if (!levelIdSet.has(rule.attachToLevelId)) diagnostics.push(diagnostic('error', 'UXC_RECIPE_ATTACHMENT_LEVEL_MISSING', rule.ruleId, `Attachment ${rule.ruleId} targets missing level ${rule.attachToLevelId}.`));
    if (rule.blockName && !blockNameSet.has(rule.blockName)) diagnostics.push(diagnostic('error', 'UXC_RECIPE_ATTACHMENT_BLOCK_MISSING', rule.ruleId, `Attachment ${rule.ruleId} targets missing block ${rule.blockName}.`));
    if (!rule.sourceKey) diagnostics.push(diagnostic('warning', 'UXC_RECIPE_ATTACHMENT_SOURCE_KEY_EMPTY', rule.ruleId, `Attachment ${rule.ruleId} has no source key.`));
    if (!rule.targetKey) diagnostics.push(diagnostic('warning', 'UXC_RECIPE_ATTACHMENT_TARGET_KEY_EMPTY', rule.ruleId, `Attachment ${rule.ruleId} has no target key.`));
  }

  return freeze(diagnostics.sort((a, b) => `${a.severity}:${a.code}:${a.subjectId}`.localeCompare(`${b.severity}:${b.code}:${b.subjectId}`)));
}

function designerCommands() {
  return freeze([
    command('add-level', 'Add level', 'Create a new hierarchy level draft.'),
    command('add-block', 'Add block', 'Create a block draft under a level.'),
    command('map-source-field', 'Map source field', 'Map source columns to graph/block fields.'),
    command('preview-pivot', 'Preview pivot', 'Preview pivot/table projection after graph approval.'),
    command('export-xml', 'Export XML', 'Export XML only after gate approval.'),
  ]);
}

function command(commandId, label, description) {
  return freeze({ commandId, label, description, enabled: false, locked: true, lockedReason: 'locked-shadow-mode' });
}

function duplicateValues(values = []) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].filter(([, count]) => count > 1).map(([value]) => value).sort();
}

function isRootLevel(profile, levelId) {
  const referencedChildren = new Set(profile.levelDefinitions.flatMap((level) => level.children || []));
  return !referencedChildren.has(levelId);
}

function findHierarchyCycle(profile) {
  const graph = new Map(profile.levelDefinitions.map((level) => [level.levelId, [...(level.children || [])]]));
  const visiting = new Set();
  const visited = new Set();
  const path = [];

  function visit(levelId) {
    if (visiting.has(levelId)) return [...path.slice(path.indexOf(levelId)), levelId];
    if (visited.has(levelId)) return [];
    visiting.add(levelId);
    path.push(levelId);
    for (const childId of graph.get(levelId) || []) {
      if (!graph.has(childId)) continue;
      const cycle = visit(childId);
      if (cycle.length) return cycle;
    }
    path.pop();
    visiting.delete(levelId);
    visited.add(levelId);
    return [];
  }

  for (const levelId of graph.keys()) {
    const cycle = visit(levelId);
    if (cycle.length) return cycle;
  }
  return [];
}

function diagnostic(severity, code, subjectId, message) {
  return freeze({ severity, code, subjectId: text(subjectId), message });
}

export const _test = freeze({ duplicateValues, isRootLevel, findHierarchyCycle, designerCommands, command, diagnostic });
