import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../tabs/pipeline-3d-model/', import.meta.url));
const names = [
  'pipeline-3d-model-analysis-section-planner.js',
  'pipeline-3d-model-analysis-property-reseed.js',
];
const sources = Object.fromEntries(names.map((name) => [name, fs.readFileSync(path.join(root, name), 'utf8')]));

for (const [name, source] of Object.entries(sources)) {
  const lines = source.split(/\r?\n/).length;
  assert.ok(lines < 300, `${name} must remain below 300 lines, got ${lines}`);
  assert.doesNotMatch(source, /export\s+default/);
  assert.doesNotMatch(source, /localStorage|sessionStorage/);
  assert.doesNotMatch(source, /\?v=|cache[-_ ]?token/i);
  assert.doesNotMatch(source, /pipeline-3d-model-(tab|project-adapter|inputxml-document|xml-builder|canvas)/);
  assert.doesNotMatch(source, /pipeline-3d-model-(gre-|bend-)/);
  assert.doesNotMatch(source, /new\s+(Date|Map|Set)\b|performance\.now|Math\.random|localeCompare/);
  assert.doesNotMatch(source, /coordinateRows\s*\[[^\]]+\]\s*=|coordinateRows\.(push|pop|shift|unshift|splice|sort|reverse)\(/);
  assert.doesNotMatch(source, /geometryRows\s*\[[^\]]+\]\s*=|geometryRows\.(push|pop|shift|unshift|splice|sort|reverse)\(/);
}

const planner = sources[names[0]];
assert.match(planner, /PipelineAnalysisSectionResolution\.v1/);
assert.match(planner, /pipeline-3d-model-engineering-profile-registry\.js/);
assert.match(planner, /pipeline-3d-model-analysis-section-contracts\.js/);
assert.match(planner, /PIPELINE_ENGINEERING_PROFILE_REGISTRY\.profiles/);
assert.match(planner, /getPipelineEngineeringProfile/);
assert.match(planner, /createPipelineAnalysisSection\(/);
assert.match(planner, /createPipelineElementSectionResolution\(/);
assert.match(planner, /createPipelineAnalysisSectionPlan\(/);
assert.doesNotMatch(planner, /const\s+(PROFILES|LEGACY|PLAN_SCHEMA|SECTION_SCHEMA|ELEMENT_SCHEMA)\b/);
assert.doesNotMatch(planner, /['"]PipelineAnalysisSectionPlan\.v1['"]/);
assert.doesNotMatch(planner, /['"]PipelineAnalysisSection\.v1['"]/);
assert.doesNotMatch(planner, /['"]PipelineElementSectionResolution\.v1['"]/);
assert.match(planner, /PIPELINE_PROFILE_BOUNDARY_INTERSECTS_FITTING/);
assert.match(planner, /bendByIncomingElementIndex/);
assert.match(planner, /incomingElementIndex/);
assert.match(planner, /INFEASIBLE/);
assert.doesNotMatch(planner, /Number\(candidate\.radiusMm\)/);
assert.match(planner, /sectionDisposition: isStart \? 'SECTION_START' : 'INHERITED'/);
assert.match(planner, /buildPipelineAnalysisSectionResolutionJson/);
assert.match(planner, /buildPipelineAnalysisSectionLedgerText/);

const reseed = sources[names[1]];
assert.match(reseed, /PipelineAnalysisPropertyReseedPlan\.v1/);
assert.match(reseed, /PipelineAnalysisPropertyReseedResolution\.v1/);
assert.match(reseed, /ANALYSIS_SECTION_RESEED/);
assert.match(reseed, /emittedProperties: reseed \? propertyShape\(source\.properties\)/);
assert.match(reseed, /buildPipelineAnalysisPropertyReseedPlanJson/);
assert.match(reseed, /buildPipelineAnalysisPropertyReseedLedgerText/);

const allJs = fs.readdirSync(root).filter((name) => name.endsWith('.js'));
for (const name of allJs.filter((name) => !names.includes(name))) {
  const source = fs.readFileSync(path.join(root, name), 'utf8');
  assert.doesNotMatch(source, /pipeline-3d-model-analysis-section-planner\.js/);
  assert.doesNotMatch(source, /pipeline-3d-model-analysis-property-reseed\.js/);
}

console.log('Pipeline analysis-section planner static guards passed.');
