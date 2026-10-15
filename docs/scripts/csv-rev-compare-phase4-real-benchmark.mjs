import fs from 'node:fs';
import { runTotalSupportPointChangeBenchmark } from '../tabs/csv-rev-compare/support-revision-phase4-benchmark.js';

const [earlierPath, laterPath, outputPath] = process.argv.slice(2);
if (!earlierPath || !laterPath) {
  console.error('Usage: node scripts/csv-rev-compare-phase4-real-benchmark.mjs <R2.csv> <R3.csv> [output.json]');
  process.exit(2);
}

const earlier = fs.readFileSync(earlierPath, 'utf8');
const later = fs.readFileSync(laterPath, 'utf8');
const result = runTotalSupportPointChangeBenchmark(earlier, later);
const report = {
  schema: result.schema,
  bucket: result.bucket,
  compareOk: result.compareOk,
  compareStage: result.compareStage,
  phase1Metrics: result.phase1Guard.metrics,
  phase2Metrics: result.phase2Guard.metrics,
  phase3Metrics: result.phase3Guard.metrics,
  phase4Metrics: result.metrics,
  phase4Expected: result.expected,
  phase4Detected: result.detected,
  phase4Unsupported: result.unsupported,
};
const json = JSON.stringify(report, null, 2);
console.log(json);
if (outputPath) fs.writeFileSync(outputPath, `${json}\n`, 'utf8');

if (!result.compareOk || result.compareStage === 'CONVERSION_BLOCKED') process.exit(3);
if (result.phase1Guard.metrics.falsePositives || result.phase1Guard.metrics.falseNegatives) process.exit(4);
if (result.phase2Guard.metrics.falsePositives || result.phase2Guard.metrics.falseNegatives) process.exit(5);
if (result.phase3Guard.metrics.falsePositives || result.phase3Guard.metrics.falseNegatives) process.exit(6);
if (result.metrics.falsePositives || result.metrics.falseNegatives) process.exit(7);
