import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { runPipelineCadReadinessBenchmark } from './lib/pipeline-cad-readiness-runner.mjs';

const outputPath = resolve(process.env.PIPELINE_CAD_READINESS_OUTPUT || 'artifacts/pipeline-cad-readiness.json');
const audit = await runPipelineCadReadinessBenchmark({
  sourceRevision: process.env.GITHUB_SHA || process.env.SOURCE_REVISION || 'local',
});
await mkdir(dirname(outputPath), { recursive: true });
await writeFile(outputPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
console.log(`Pipeline CAD readiness: ${audit.status}`);
console.log(`Scenarios: ${audit.summary.passedScenarioCount}/${audit.summary.requiredScenarioCount} passed`);
console.log(`Audit artifact: ${outputPath}`);
