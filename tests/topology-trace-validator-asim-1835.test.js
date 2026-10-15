/**
 * Real cross-repository ASIM-1835 topology acceptance gate.
 * Builds native artifacts in 3D_Converters, then parses, binds, and validates
 * them through XML Compare Utilities. Missing local real data skips explicitly.
 */

import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import {
  readCanonicalTopology,
  readTopologyInputXml,
  readTopologyTraceLedger,
} from '../tabs/topology-trace-validator/topology-artifact-reader.js';
import { validateTopologyArtifacts } from '../tabs/topology-trace-validator/topology-independent-validator.js';
import { readManagedTopologySource } from '../tabs/topology-trace-validator/topology-source-reader.js';
import { bindProducerSourceIdentity } from '../tabs/topology-trace-validator/topology-source-identity.js';
import { buildTopologyInputXmlEnrichmentJob } from '../tabs/topology-trace-validator/topology-controller-helpers.js';
import { parseInputXmlElementSideLoad } from '../tabs/xml-cii-2019-standalone/xml-cii-inputxml-enrichment.js';

const fixturePath = process.env.ASIM_1835_SOURCE
  || 'C:/Users/reall/Downloads/ATTRIBUTE-AML_ASIM-1835_managed_stage_enriched_stage.json';
const exporterUrl = new URL('../../3D_Converters/tabs/model-converters/converters/component-topology/topology-artifact-exporter.js', import.meta.url);

if (!existsSync(fixturePath) || !existsSync(exporterUrl)) {
  const missing = [
    !existsSync(fixturePath) ? `fixture ${fixturePath}` : '',
    !existsSync(exporterUrl) ? `exporter ${exporterUrl.pathname}` : '',
  ].filter(Boolean).join(', ');
  console.log(`topology trace validator ASIM-1835 SKIPPED: missing ${missing}`);
} else {
  const { buildComponentTopologyArtifacts } = await import(exporterUrl.href);
  const sourceText = readFileSync(fixturePath, 'utf8');
  const parsed = JSON.parse(sourceText);
  const built = await buildComponentTopologyArtifacts(sourceText, {
    sourceName: 'ASIM-1835.json',
    jobName: 'ASIM-1835',
    toleranceMm: 0.1,
    supportProjectionToleranceMm: 50,
    enrichmentConfig: {},
  });
  const ledger = readTopologyTraceLedger(built.traceLedger);
  const source = bindProducerSourceIdentity(readManagedTopologySource(parsed), ledger);
  const canonical = readCanonicalTopology(built.canonicalTopology);
  const inputXml = readTopologyInputXml(built.topologyInputXml);
  const enrichmentJob = buildTopologyInputXmlEnrichmentJob({ source, ledger, canonical, inputXml });
  const sideLoadByElement = parseInputXmlElementSideLoad(enrichmentJob.elementSideLoadText);
  const validation = validateTopologyArtifacts({ source, ledger, canonical, inputXml }, 0.1);
  assert.equal(validation.metrics.issueCount, 0);
  assert.equal(validation.metrics.blockingIssueCount, 0);
  assert.equal(validation.gates.sourceDispositionCoverage, 100);
  assert.equal(validation.gates.canonicalNodeAncestry, 100);
  assert.equal(validation.gates.canonicalEdgeAncestry, 100);
  assert.equal(validation.gates.inputXmlElementAncestry, 100);
  assert.equal(built.metrics.engineering.supports, 663);
  assert.equal(built.metrics.engineering.restraints, 828);
  assert.equal(built.metrics.engineering.rigids, 1652);
  assert.equal(built.metrics.ledger.deferredSupports, 0);
  assert.equal(sideLoadByElement.size, 4434);
  assert.equal([...sideLoadByElement.values()].filter((sideLoad) => sideLoad.PipingClass).length, 4434);
  assert.equal([...sideLoadByElement.values()].filter((sideLoad) => sideLoad.DTXR_POS).length, 4434);
  console.log(`topology trace validator ASIM-1835 acceptance passed\n${JSON.stringify({ build: built.metrics, gates: validation.gates }, null, 2)}`);
}
