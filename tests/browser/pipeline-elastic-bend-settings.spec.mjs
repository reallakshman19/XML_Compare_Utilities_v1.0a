import { expect, test } from '@playwright/test';

const FIXTURE = '/tests/browser/pipeline-table-paste-sample-fixture.html';
const selector = (fieldId) => `[data-p3d-config-field="${fieldId}"]`;
async function open(page, storage = null) {
  const errors = [];
  await page.addInitScript((stored) => {
    localStorage.clear();
    if (stored !== null) localStorage.setItem('pipeline-engineering-configuration-v1', stored);
  }, storage);
  page.on('pageerror', (error) => errors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
  await page.goto(FIXTURE);
  await page.waitForFunction(() => document.body.dataset.pipelineTablePasteSampleReady === '1');
  await expect(page.locator('[data-p3d-engineering-config-open]')).toHaveText('Engineering Configuration');
  return errors;
}
async function modal(page) {
  await page.locator('[data-p3d-engineering-config-open]').click();
  const dialog = page.locator('[data-p3d-engineering-config]');
  await expect(dialog).toBeVisible(); return dialog;
}
async function fill(dialog, fieldId, value) {
  await dialog.locator(selector(fieldId)).fill(String(value));
}
async function choose(dialog, fieldId, value) {
  await dialog.locator(selector(fieldId)).selectOption(String(value));
}
const setBoolean = (dialog, fieldId, value) => choose(dialog, fieldId, String(value));
async function configureBranch(dialog) {
  for (const [fieldId, value] of Object.entries({ jobName: 'P3D-HARD-051', issueNo: 'A',
    caesarVersion: '11.00', branchName: 'P3D-TEST', lineNo: 'P3D-TEST',
    outsideDiameterMm: 100, wallThickness: 6, materialNumber: 106,
    corrosionAllowance: 0, insulationThickness: 0, insulationDensity: 0,
    fluidDensity: 100, hydroPressure: 15, pressure1: 10, temperature1: 120 })) {
    await fill(dialog, fieldId, value);
  }
}
async function configureSection(dialog, index, profileId, extras = {}) {
  await choose(dialog, `section:${index}:profileId`, profileId);
  await fill(dialog, `section:${index}:outsideDiameterMm`, extras.outsideDiameterMm ?? 100);
  for (const [key, value] of Object.entries(extras)) {
    if (key !== 'outsideDiameterMm') await fill(dialog, `section:${index}:${key}`, value);
  }
}
async function configureGeometry(dialog) {
  for (const id of ['bendScreeningEnabled', 'emitToInputXml', 'screeningOnlyAcknowledged',
    'detectHorizontal', 'detectVertical', 'detectCompound', 'emitNearPointNode', 'emitMidpointNode']) {
    await setBoolean(dialog, id, true);
  }
  for (const [fieldId, value] of Object.entries({ minimumPlanTurnAngleDeg: 0.1,
    minimumProfileTurnAngleDeg: 0.1, maximumTurnAngleDeg: 179,
    minimumAngleElementLengthMm: 0, retainedStraightAllowanceMm: 0,
    preferredStraightTangentMm: 0 })) await fill(dialog, fieldId, value);
  await choose(dialog, 'shortElementAnglePolicy', 'include-all');
  await choose(dialog, 'bendTypeCode', '0');
}
async function validateReady(dialog) {
  await dialog.locator('[data-p3d-config-action="validate"]').click();
  await expect(dialog.locator('[data-p3d-config-summary]')).toContainText('Ready');
  await expect(dialog.locator('[data-p3d-config-action="apply"]')).toBeEnabled();
}
async function apply(dialog) {
  await dialog.locator('[data-p3d-config-action="save"]').click();
  await dialog.locator('[data-p3d-config-action="apply"]').click();
  await dialog.locator('[data-p3d-config-action="close"]').last().click();
}
function bendEvidence(xml) {
  return [...String(xml).matchAll(/<BEND RADIUS="([\d.]+)" TYPE="([\d.-]+)"[\s\S]*?NUM_MITER="([\d.-]+)"/g)]
    .map((match) => ({ radius: Number(match[1]), type: Number(match[2]), numMiter: Number(match[3]) }));
}

test.describe('Pipeline Engineering Configuration hardening', () => {
  test('P3D-HARD-B01 empty configuration is blocked without profile fallback', async ({ page }) => {
    const errors = await open(page); const dialog = await modal(page);
    await expect(dialog.locator('[data-p3d-config-summary]')).toContainText('Blocked');
    await expect(dialog.locator(selector('outsideDiameterMm'))).toHaveValue('');
    await expect(dialog.locator(selector('bendScreeningEnabled'))).toHaveValue('');
    await expect(dialog.locator('[data-p3d-config-action="apply"]')).toBeDisabled();
    await expect(dialog).not.toContainText('Normal — default');
    expect(errors).toEqual([]);
  });

  test('P3D-HARD-B02 canonical section identities and starts are read-only', async ({ page }) => {
    const errors = await open(page); await page.locator('[data-p3d="new-multisheet"]').click();
    const dialog = await modal(page); const rows = dialog.locator('[data-p3d-config-section-row]');
    await expect(rows).not.toHaveCount(0);
    await expect(rows.first().locator('[data-p3d-canonical-section-id="0"]')).toHaveAttribute('readonly', '');
    await expect(rows.first().locator('[data-p3d-canonical-section-start="0"]')).toHaveAttribute('readonly', '');
    await expect(dialog.locator('[data-p3d-config-action="add-section"]')).toHaveCount(0);
    await expect(dialog.locator('[data-p3d-config-action="remove-section"]')).toHaveCount(0);
    expect(errors).toEqual([]);
  });

  test('P3D-HARD-B03 corrupt storage is cleared persistently', async ({ page }) => {
    const errors = await open(page, '{bad'); let dialog = await modal(page);
    await expect(dialog.locator('[data-p3d-config-preview]')).toContainText('PIPELINE_CONFIGURATION_STORAGE_INVALID');
    await dialog.locator('[data-p3d-config-action="clear"]').click();
    await dialog.locator('[data-p3d-config-action="close"]').last().click();
    await page.reload();
    await page.waitForFunction(() => document.body.dataset.pipelineTablePasteSampleReady === '1');
    dialog = await modal(page);
    await expect(dialog.locator('[data-p3d-config-preview]')).not.toContainText('PIPELINE_CONFIGURATION_STORAGE_INVALID');
    await expect(dialog.locator('[data-p3d-config-action="apply"]')).toBeDisabled();
    expect(errors).toEqual([]);
  });

  test('P3D-HARD-B04 explicit Normal configuration emits deterministic artifacts', async ({ page }) => {
    const errors = await open(page); await page.locator('[data-p3d="new-multisheet"]').click();
    const dialog = await modal(page); await configureBranch(dialog);
    await configureSection(dialog, 0, 'normal-metallic'); await configureGeometry(dialog);
    await choose(dialog, 'normalFittingPolicyId', 'normal-standard-elbow');
    await fill(dialog, 'normalRadiusD', 1.5); await validateReady(dialog); await apply(dialog);
    await expect.poll(async () => page.locator('[data-p3d="xml-output"]').textContent()).toContain('<PIPINGELEMENT');
    const xml = await page.locator('[data-p3d="xml-output"]').textContent();
    expect(bendEvidence(xml).every((bend) => bend.radius > 0 && bend.type === 0 && bend.numMiter === 0)).toBe(true);
    await expect(page.locator('[data-p3d-core-artifacts]')).toContainText('pipeline-section-property-assignments.json');
    await expect(page.locator('[data-p3d-core-artifacts]')).toContainText('pipeline-section-profile-routing.json');
    await expect(page.locator('[data-p3d-core-artifacts]')).toContainText('pipeline-3d-model.xml');
    expect(errors).toEqual([]);
  });

  test('P3D-HARD-B05 explicit B31.4 false remains distinct from unset', async ({ page }) => {
    const errors = await open(page); await page.locator('[data-p3d="new-multisheet"]').click();
    const dialog = await modal(page); await configureBranch(dialog);
    await configureSection(dialog, 0, 'asme-b31.4', { nominalPipeSizeNps: 6 });
    await configureGeometry(dialog); await setBoolean(dialog, 'b314ElasticFormulaEnabled', true);
    await fill(dialog, 'b314YoungsModulusMpa', 207000);
    await fill(dialog, 'b314AllowableBendingStressMpa', 207);
    await setBoolean(dialog, 'b314ElasticPracticalEnabled', false);
    await choose(dialog, 'b314ColdPolicyId', 'b31.4-cold-field-project-radius-d');
    await fill(dialog, 'b314ProjectRadiusD', 40);
    await setBoolean(dialog, 'b314ProjectMinimumEnabled', false);
    await setBoolean(dialog, 'b314QualifiedAlternativeRequested', false);
    await expect(dialog.locator(selector('b314ElasticPracticalEnabled'))).toHaveValue('false');
    await validateReady(dialog); await apply(dialog);
    await expect.poll(async () => page.locator('[data-p3d="xml-output"]').textContent()).toContain('<PIPINGELEMENT');
    await expect(page.locator('[data-p3d-core-artifacts]')).toContainText('pipeline-b314-radius-plan.json');
    expect(errors).toEqual([]);
  });

  test('P3D-HARD-B06 GRE turn remains blocked without reconstructed geometry', async ({ page }) => {
    const errors = await open(page); await page.locator('[data-p3d="new-multisheet"]').click();
    const dialog = await modal(page); await configureBranch(dialog);
    await configureSection(dialog, 0, 'gre', { greVendorNominalBoreMm: 100 });
    await configureGeometry(dialog);
    for (const [fieldId, value] of Object.entries({ greVendorId: 'VENDOR-A',
      greSeriesId: 'SERIES-100', greQualificationEvidenceId: 'QUAL-1',
      greRequirementReference: 'REQ-1', greSourceAuthority: 'VENDOR',
      greSourceReference: 'CATALOG-1', greVendorNominalBoreMm: 100,
      greBendRadiusMm: 300, greBendBreakMultiplierBore: 1.5,
      greBendLocalThicknessMm: 12, greTeeBreakLengthMm: 250,
      greTeeLocalThicknessMm: 14 })) await fill(dialog, fieldId, value);
    await choose(dialog, 'greBendBreakLengthBasis', 'NOMINAL_BORE_MULTIPLIER');
    await expect(dialog.locator('[data-p3d-derived-gre-break]')).toHaveText('150');
    await validateReady(dialog); await apply(dialog);
    await expect(page.locator('[data-p3d="xml-output"]')).toHaveText('');
    await expect(page.locator('[data-p3d-core-artifacts]')).not.toContainText('pipeline-3d-model.xml');
    const warningLog = page.locator('[data-p3d-warning-log]');
    await warningLog.evaluate((element) => { element.open = true; });
    await expect(warningLog).toContainText('PIPELINE_INPUTXML_GRE_BEND_GEOMETRY_REQUIRED');
    expect(errors).toEqual([]);
  });
});
