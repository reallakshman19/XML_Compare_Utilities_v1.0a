import { expect, test } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const fixturePath = process.env.ASIM_1835_SOURCE
  || 'C:/Users/reall/Downloads/ATTRIBUTE-AML_ASIM-1835_managed_stage_enriched_stage.json';

test('TTV-B02 — native enrichment preserves the real ASIM-1835 benchmark', async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(!existsSync(fixturePath), `Real fixture not found at ${fixturePath}.`);
  const producerUrl = new URL('../../../3D_Converters/tabs/model-converters/converters/component-topology/topology-artifact-exporter.js', import.meta.url).href;
  const producerScript = `
    import { readFileSync } from 'node:fs';
    const { buildComponentTopologyArtifacts } = await import(${JSON.stringify(producerUrl)});
    const source = readFileSync(process.argv[1], 'utf8');
    const built = await buildComponentTopologyArtifacts(source, {
      sourceName: 'ASIM-1835.json', jobName: 'ASIM-1835', toleranceMm: 0.1,
      supportProjectionToleranceMm: 50, enrichmentConfig: {},
    });
    process.stdout.write(built.topologyInputXml);
  `;
  const inputXml = execFileSync(process.execPath,
    ['--input-type=module', '--eval', producerScript, fixturePath],
    { encoding: 'utf8', maxBuffer: 100 * 1024 * 1024 });
  await page.goto('/tests/browser/topology-trace-validator-fixture.html');
  const enriched = await page.evaluate(async (sourceText) => {
    const module = await import('/tabs/xml-cii-2019-standalone/xml-cii-inputxml-enrichment.js');
    const result = module.enrichInputXmlDocument({
      sourceText, sourceName: 'ASIM-1835.xml', elementSideLoadText: '', supportConfigJson: '{}',
      options: { inputXmlOutputMode: 'document', inputXmlRestraintPolicy: 'preserve-existing-restraints' },
    });
    return result.enrichedText;
  }, inputXml);
  expect([...enriched.matchAll(/<PIPINGELEMENT\b/g)]).toHaveLength(4434);
  expect([...enriched.matchAll(/<RESTRAINT\b/g)]).toHaveLength(828);
  const rigids = [...enriched.matchAll(/<RIGID\b([^>]*)/g)];
  expect(rigids).toHaveLength(1606);
  expect(rigids.reduce((sum, match) => sum + Number(match[1].match(/SOURCE_BODY_COUNT="(\d+)"/)?.[1] || 1), 0)).toBe(1652);
  expect(enriched).toMatch(/<PIPINGMODEL\b[^>]*NUMELT="4434"[^>]*NUMRIGID="1606"[^>]*NUMREST="828"/);
  expect(enriched).not.toMatch(/\bPRESSURE_C\d+=/);
  const elementAttributes = [...enriched.matchAll(/<PIPINGELEMENT\b([^>]*)>/g)].map((match) => (
    Object.fromEntries([...match[1].matchAll(/([A-Z0-9_]+)="([^"]*)"/g)].map((attribute) => [attribute[1], attribute[2]]))
  ));
  expect(elementAttributes.every((row) => Number(row.DIAMETER) > 0 && Number(row.WALL_THICK) > 0)).toBe(true);
  expect(elementAttributes.every((row) => Number(row.TEMP_EXP_C1) !== -1.0101 && Number(row.PRESSURE1) !== -1.0101)).toBe(true);
  expect(elementAttributes.every((row) => Number(row.MATERIAL_NUM) > 0 && row.MATERIAL_NAME && row.LINE_ID)).toBe(true);
});
