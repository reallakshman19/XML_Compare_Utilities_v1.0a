import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { parseSupportReportClashXml } from '../tabs/support-steel-relationship-builder/support-report-clash-safety.js';
import {
  buildSupportReportTypicalityAudit,
  extractStructuralFamilyFeatures,
} from '../tabs/support-steel-relationship-builder/support-report-typicality.js';

const typicalSource = parseSupportReportClashXml(readFileSync('benchmarks/11168.xml', 'utf8'));
const nonTypicalControl = parseSupportReportClashXml(readFileSync('benchmarks/SupportreportXML-PS-12120.xml', 'utf8'));

test('PS-12120 real benchmark is a non-typical control for PS-11168', () => {
  const [left] = extractStructuralFamilyFeatures(typicalSource);
  const [right] = extractStructuralFamilyFeatures(nonTypicalControl);
  assert.equal(left.familyId, 'PS-11168');
  assert.equal(right.familyId, 'PS-12120');
  assert.notEqual(left.rawClashPointCount, right.rawClashPointCount);
  assert.notDeepEqual(left.normalizedPipeClassPopulation, right.normalizedPipeClassPopulation);

  const audit = buildSupportReportTypicalityAudit(typicalSource, nonTypicalControl);
  assert.equal(audit.familyComparisons.length, 1);
  assert.equal(audit.familyComparisons[0].result, 'NOT_TYPICAL');
  assert.equal(audit.matches[0].result, 'NO_MATCH');
  assert.notEqual(audit.matches[0].reasonCode, 'TYPICAL_ACCEPTED');
  assert.ok(audit.familyComparisons[0].signals.some((signal) => signal.result === 'FAIL'));
});
