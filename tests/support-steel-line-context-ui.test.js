import assert from 'node:assert/strict';
import { buildSupportSteelRelationshipBundle } from '../tabs/support-steel-relationship-builder/support-steel-relationship-engine.js';
import {
  supportSteelHierarchyToText,
  supportSteelRelationshipsToCsv,
} from '../tabs/support-steel-relationship-builder/support-steel-relationship-export.js';
import {
  renderSupportSteelEvidence,
  renderSupportSteelTree,
} from '../tabs/support-steel-relationship-builder/support-steel-relationship-view.js';
import {
  SUPPORT_STEEL_SAMPLE_STEEL,
  SUPPORT_STEEL_SAMPLE_SUPPORT,
} from '../tabs/support-steel-relationship-builder/support-steel-relationship-samples.js';

const bundle = buildSupportSteelRelationshipBundle({
  supportInput: SUPPORT_STEEL_SAMPLE_SUPPORT,
  steelInput: SUPPORT_STEEL_SAMPLE_STEEL,
});
const relationship = bundle.relationships.find((row) => row.supportFamilyId === '/PS-14259');
const tree = renderSupportSteelTree(bundle);
const evidence = renderSupportSteelEvidence(bundle, relationship.relationshipId);
const csv = supportSteelRelationshipsToCsv(bundle);
const hierarchy = supportSteelHierarchyToText(bundle);

assert.match(tree, /Normalized line and carrier context/);
assert.match(tree, /Primary line/);
assert.match(tree, /Context quality/);
assert.match(tree, /OWNER fallback/);
assert.match(tree, /ASIM-1836-4&quot;-P9001002/);
assert.match(tree, /ASIM-1836-6&quot;-P9001001/);
assert.match(evidence, /Support family and line context/);
assert.match(evidence, /Primary branch/);
assert.match(evidence, /All full line tags/);
assert.match(evidence, /Pipe owner/);
assert.match(evidence, /Context evidence/);
assert.match(evidence, /Context cardinality/);
assert.match(evidence, /MULTIPLE_FULL_LINE_TAGS/);
assert.match(csv, /branchNode,branchIds,fullLineTag,fullLineTags,lineFamily,lineFamilies,pipeOwner/);
assert.match(csv, /lineContextQuality,ownerFallbackUsed,lineContextConflicts/);
assert.match(csv, /MULTIPLE_BRANCH_NODES/);
assert.match(csv, /MULTIPLE_LINE_FAMILIES/);
assert.match(hierarchy, /primary branch:/);
assert.match(hierarchy, /full line tags:/);
assert.match(hierarchy, /line context: MEDIUM · OWNER fallback NO/);
assert.match(hierarchy, /context cardinality: MULTIPLE_FULL_LINE_TAGS, MULTIPLE_LINE_FAMILIES, MULTIPLE_BRANCH_NODES/);

console.log('support-steel-line-context-ui tests passed');
