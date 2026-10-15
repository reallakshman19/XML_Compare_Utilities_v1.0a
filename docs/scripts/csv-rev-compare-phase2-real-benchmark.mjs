import fs from 'node:fs';
import { runSupportLocationChangeBenchmark } from '../tabs/csv-rev-compare/support-revision-phase2-benchmark.js';

const [earlierPath, laterPath, outputPath] = process.argv.slice(2);
if (!earlierPath || !laterPath) {
  console.error('usage: node scripts/csv-rev-compare-phase2-real-benchmark.mjs R2.csv R3.csv [output.json]');
  process.exit(2);
}

const result = runSupportLocationChangeBenchmark(
  fs.readFileSync(earlierPath, 'utf8'),
  fs.readFileSync(laterPath, 'utf8'),
);
const summary = {
  schema: result.schema,
  bucket: result.bucket,
  compareStage: result.compareStage,
  compareOk: result.compareOk,
  metrics: result.metrics,
  phase1Guard: result.phase1Guard,
  coordinateFrame: result.compareResult?.lineage?.coordinateFrame || null,
  expectedItems: result.expected,
  detectedItems: result.detected,
};
const json = JSON.stringify(summary, null, 2);
console.log(json);
if (outputPath) fs.writeFileSync(outputPath, `${json}\n`, 'utf8');
if (result.compareStage === 'CONVERSION_BLOCKED') process.exit(3);
if (!result.compareOk) process.exit(4);
if (result.phase1Guard.metrics.falsePositives || result.phase1Guard.metrics.falseNegatives) process.exit(5);
if (result.metrics.falsePositives || result.metrics.falseNegatives) process.exit(6);
