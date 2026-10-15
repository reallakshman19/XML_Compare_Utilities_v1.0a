import assert from 'node:assert/strict';
import fs from 'node:fs';

const source = fs.readFileSync(new URL('../tabs/pipeline-3d-model/pipeline-3d-model-section-aware-bend-resolution.js', import.meta.url), 'utf8');
assert.match(source, /one canonical geometry route is required/i);
assert.match(source, /canonicalAnalysisSectionPlan/);
assert.match(source, /sectionSettingsById/);
assert.match(source, /buildPipelineSectionProfileRoutingPlan/);
assert.match(source, /PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED/);
assert.doesNotMatch(source, /Math\.random|Date\(|performance\.now/);
console.log('pipeline-3d-model section-aware bend static: PASS');
