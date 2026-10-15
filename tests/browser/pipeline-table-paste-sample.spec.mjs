import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-table-paste-sample-fixture.html';
const PLACEHOLDER_TABLE_1 = [
  'at point X= Y= Z=\t392.755\t-173.688\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t695.086\t-152.301\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t860.335\t-140.566\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t1117.081\t-122.414\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t1295.369\t-90.301\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t1381.772\t-214.552\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t1427.714\t-222.807\t0\t0\t0\t0\t0',
  'at point X= Y= Z=\t1450.082\t-254.974\t0\t0\t0\t0\t0',
].join('\n');

async function open(page) {
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  await page.goto(FIXTURE);
  await page.waitForFunction(() => document.body.dataset.pipelineTablePasteSampleReady === '1');
  return errors;
}

async function loadSample(page) {
  await page.locator('[data-p3d="new-multisheet"]').click();
  await expect(page.locator('[data-p3d-table-paste-status="table2"]')).toContainText('Transferred 10 row(s)');
  await expect(page.locator('[data-p3d-table-paste-status="table3"]')).toContainText('4 H-length, 2 Z, and 4 marker');
}

function coordinateRows(text) {
  return text.split(/\r?\n/).slice(1).filter(Boolean).map((line) => {
    const [, node, x, y, z, name] = line.split('\t');
    return { node: Number(node), x: Number(x), y: Number(y), z: Number(z), name };
  });
}

function xyzRows(text) {
  return coordinateRows(text).map(({ x, y, z }) => ({ x, y, z }));
}

const TABLE3_MARKER_LABELS = Object.freeze([
  'HL 0.0', 'HL 14.7', '1.5M START', '1.5M END',
  'A/G START', 'A/G END', 'PMS-001', 'PMS-004',
]);

function expectMarkersExcludedFromXml(xml, labels = TABLE3_MARKER_LABELS) {
  for (const label of labels) expect(xml).not.toContain(label);
}

test.describe('Pipeline Table Paste multi-sheet sample', () => {
  test('P3D-PASTE-B01 sample button loads paste data and propagates all raw previews', async ({ page }) => {
    const errors = await open(page);
    await expect(page.locator('[data-p3d-raw-text-group="table2"]')).not.toHaveAttribute('open', '');
    await expect(page.locator('[data-p3d-raw-text-group="table3"]')).not.toHaveAttribute('open', '');
    const warningLog = page.locator('[data-p3d-warning-log]');
    await expect(warningLog).not.toHaveAttribute('open', '');
    expect(await warningLog.evaluate((element) => element.parentElement?.lastElementChild === element)).toBe(true);
    await expect(warningLog).toContainText('Warning Log (0)');
    await loadSample(page);
    await expect(page.locator('[data-p3d-table-paste="table2"]')).toHaveValue(/13\+621\.6/);
    await expect(page.locator('[data-p3d-table-paste="table2"]')).toHaveValue(/Handle = 271f6/);
    await expect(page.locator('[data-p3d-table-paste="table3"]')).toHaveValue(/Handle = 2b298/);
    await expect(page.locator('[data-p3d-table-paste="table3"]')).toHaveValue(/Handle = 288c0/);
    await expect(page.locator('[data-p3d-split="table2a-raw"]')).toHaveValue(/1451\.141\t-715\.825 → -650\.258\t65\.567\t13\+621\.6\t240\.17/);
    await expect(page.locator('[data-p3d-split-preview="table2a-raw"] [data-p3d-split-cell="0:0"]')).toHaveValue('1451.141');
    await expect(page.locator('[data-p3d-split-preview="table2a-raw"] [data-p3d-split-cell="0:3"]')).toHaveValue('13+621.6');
    await expect(page.locator('[data-p3d-split="table3a-raw"]')).toHaveValue(/1430\.577\t1445\.249\t1437\.913\t14\.7/);
    await expect(page.locator('[data-p3d-split-preview="table3a-raw"] [data-p3d-split-cell="0:0"]')).toHaveValue('1430.577');
    await expect(page.locator('[data-p3d-split-preview="table3a-raw"] [data-p3d-split-cell="0:3"]')).toHaveValue('14.7');
    await expect(page.locator('[data-p3d-split-preview="table3b-raw"] [data-p3d-split-cell="0:3"]')).toHaveValue('1.5M');
    await expect(page.locator('[data-p3d-split-preview="table3c-raw"] [data-p3d-split-cell="0:0"]')).toHaveValue('1459.416');
    await expect(page.locator('[data-p3d-split-preview="table3c-raw"] [data-p3d-split-cell="0:1"]')).toHaveValue('PMS-001');
    await expect(page.locator('[data-p3d-split-preview="table3c-raw"] [data-p3d-split-cell="3:1"]')).toHaveValue('PMS-004');
    await expect(page.locator('[data-p3d="table2x-output"]')).toContainText('13+621.6');
    await expect(page.locator('[data-p3d="table3x-output"]')).toContainText('HLength Text');
    expect(errors).toEqual([]);
  });

  test('P3D-PROP-B01 Table 3 remains review-only while Table 2 controls XML geometry', async ({ page }) => {
    const errors = await open(page);
    await loadSample(page);
    await page.locator('[data-p3d="run"]').click();

    const table3x = page.locator('[data-p3d="table3x-output"]');
    for (const value of ['1430.577', '0.0', '14.7', '46.7', '21.2', '20.9', '1.5M', 'A/G', 'PMS-001', 'PMS-004']) {
      await expect(table3x).toContainText(value);
    }

    const coordinate = await page.locator('[data-p3d="coordinate-output"]').textContent();
    const rows = coordinateRows(coordinate || '');
    const pms1 = rows.find((row) => row.name.includes('PMS-001'));
    const pms4 = rows.find((row) => row.name.includes('PMS-004'));
    expect(pms1?.z).toBeGreaterThan(240000);
    expect(pms1?.z).toBeLessThan(242000);
    expect(pms4?.z).toBeGreaterThan(240000);
    expect(pms4?.z).toBeLessThan(242000);
    for (const value of TABLE3_MARKER_LABELS) expect(coordinate).toContain(value);
    expect(coordinate).not.toMatch(/GRADE END|GRADE START/);
    const zByXy = new Map();
    for (const row of rows) {
      const key = `${row.x}|${row.y}`;
      if (zByXy.has(key)) expect(row.z).toBe(zByXy.get(key));
      else zByXy.set(key, row.z);
    }
    expect(coordinate).toContain('Sheet 1 Pt 1');
    expect(coordinate).not.toContain('T1-001');
    expect(coordinate).not.toContain('at point X= Y= Z=');
    expect(coordinate).not.toContain('8573374\t-10498846');

    const xml = await page.locator('[data-p3d="xml-output"]').textContent();
    expect(xml).toContain('Sheet 1 Pt 1');
    expectMarkersExcludedFromXml(xml);
    expect(xml).not.toMatch(/GRADE END|GRADE START/);
    expect(xml).not.toContain('at point X= Y= Z=');
    const deltas = [...String(xml).matchAll(/DELTA_X="(-?[\d.]+)"[^>]*DELTA_Y="(-?[\d.]+)"[^>]*DELTA_Z="(-?[\d.]+)"/g)]
      .map((match) => Math.hypot(Number(match[1]), Number(match[2]), Number(match[3])));
    expect(Math.max(...deltas)).toBeLessThan(600000);

    const warningLog = page.locator('[data-p3d-warning-log]');
    await expect(warningLog).toContainText('Warning Log (1)');
    await warningLog.evaluate((element) => { element.open = true; });
    await expect(warningLog).toContainText('grade_profile_extrapolated');
    expect(errors).toEqual([]);
  });

  test('P3D-PROP-B02 Table 3 edits preserve XML; Table 2 edits change elevation', async ({ page }) => {
    const errors = await open(page);
    await loadSample(page);
    await page.locator('[data-p3d="run"]').click();
    const baseline = await page.locator('[data-p3d="coordinate-output"]').textContent();
    const baselineXyz = xyzRows(baseline || '');
    const baselineXml = await page.locator('[data-p3d="xml-output"]').textContent();

    await page.locator('[data-p3d-raw-text-group="table3"]').evaluate((element) => { element.open = true; });
    const markerCell = page.locator('[data-p3d-split-preview="table3c-raw"] [data-p3d-split-cell="0:1"]');
    await markerCell.fill('PMS-001A');
    await expect(page.locator('[data-p3d-split="table3c-raw"]')).toHaveValue(/PMS-001A/);

    const depthCell = page.locator('[data-p3d-split-preview="table3b-raw"] [data-p3d-split-cell="0:3"]');
    await depthCell.fill('2.0M');
    await expect(page.locator('[data-p3d-split="table3b-raw"]')).toHaveValue(/2\.0M/);
    await expect(page.locator('[data-p3d="table3x-output"]')).toContainText('2.0M');

    await page.locator('[data-p3d="run"]').click();
    const markerOnly = await page.locator('[data-p3d="coordinate-output"]').textContent();
    expect(markerOnly).toContain('PMS-001A');
    expect(markerOnly).toContain('2.0M START');
    expect(xyzRows(markerOnly || '')).toEqual(baselineXyz);
    const markerOnlyXml = await page.locator('[data-p3d="xml-output"]').textContent();
    expect(markerOnlyXml).toEqual(baselineXml);
    expectMarkersExcludedFromXml(markerOnlyXml, ['PMS-001A', '2.0M START']);

    await page.locator('[data-p3d-raw-text-group="table2"]').evaluate((element) => { element.open = true; });
    const elevationCell = page.locator('[data-p3d-split-preview="table2a-raw"] [data-p3d-split-cell="0:4"]');
    await elevationCell.fill('241.17');
    await page.locator('[data-p3d="run"]').click();
    const table2Changed = await page.locator('[data-p3d="coordinate-output"]').textContent();
    expect(xyzRows(table2Changed || '')).not.toEqual(baselineXyz);
    expect(await page.locator('[data-p3d="xml-output"]').textContent()).not.toEqual(baselineXml);
    expect(errors).toEqual([]);
  });

  test('P3D-PROP-B03 AutoCAD placeholder Table 1 names become deterministic T1 names', async ({ page }) => {
    const errors = await open(page);
    await loadSample(page);
    await page.locator('[data-p3d="table1"]').fill(PLACEHOLDER_TABLE_1);
    await page.locator('[data-p3d="run"]').click();
    await expect(page.locator('[data-p3d="table1-output"]')).toContainText('T1-001');
    await expect(page.locator('[data-p3d="table1-output"]')).not.toContainText('at point X= Y= Z=');
    await expect(page.locator('[data-p3d="coordinate-output"]')).toContainText('T1-001');
    await expect(page.locator('[data-p3d="coordinate-output"]')).not.toContainText('at point X= Y= Z=');
    await expect(page.locator('[data-p3d="xml-output"]')).toContainText('T1-001');
    await expect(page.locator('[data-p3d="xml-output"]')).not.toContainText('at point X= Y= Z=');
    expect(errors).toEqual([]);
  });

  test('P3D-WARN-B01 out-of-domain marker evidence warns without entering XML or blocking downloads', async ({ page }) => {
    const errors = await open(page);
    await loadSample(page);
    const raw = page.locator('[data-p3d-split="table3c-raw"]');
    await raw.evaluate((element) => {
      element.value += '\n2000.000\tPMS-OUTSIDE';
      element.dispatchEvent(new Event('input', { bubbles: true }));
    });

    const warningLog = page.locator('[data-p3d-warning-log]');
    await expect(warningLog).not.toHaveAttribute('open', '');
    await expect(warningLog).toContainText('Warning Log (2)');
    await warningLog.evaluate((element) => { element.open = true; });
    await expect(warningLog).toContainText('grade_profile_extrapolated');
    await expect(warningLog).toContainText('table3_h_clamped');
    await expect(warningLog).toContainText('was clamped for output');
    await expect(page.locator('[data-p3d="coordinate-output"]')).toContainText('PMS-OUTSIDE');
    await expect(page.locator('[data-p3d="xml-output"]')).not.toContainText('PMS-OUTSIDE');

    const coordinateDownload = page.waitForEvent('download');
    await page.locator('[data-p3d="download-coordinate"]').click();
    expect((await coordinateDownload).suggestedFilename()).toBe('pipeline-coordinate-tab.tsv');
    const xmlDownload = page.waitForEvent('download');
    await page.locator('[data-p3d="download-xml"]').click();
    expect((await xmlDownload).suggestedFilename()).toBe('pipeline-3d-model.xml');
    expect(errors).toEqual([]);
  });
});
