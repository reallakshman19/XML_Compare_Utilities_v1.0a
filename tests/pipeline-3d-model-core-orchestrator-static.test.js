import assert from 'node:assert/strict'; import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'tabs/pipeline-3d-model/pipeline-3d-model-core-orchestrator.js'), 'utf8');
assert.ok(source.trimEnd().split(/\r?\n/).length < 300);
assert.doesNotMatch(source, /export\s+default|\bDate\b|Math\.random|performance\.now|localeCompare/);
for (const token of ['resolveAnalysisSectionPlan', 'resolveDiameterPlan', 'resolveNormalFittingPlan',
  'resolveB314RadiusPlan', 'resolveGreVendorSeriesPlan', 'profileAuthorityPlans',
  'PIPELINE_CONFIGURATION_INPUTXML_BLOCKED', 'pipeline-3d-model.xml']) assert.match(source, new RegExp(token));
console.log('pipeline-3d-model core orchestrator static: PASS');
