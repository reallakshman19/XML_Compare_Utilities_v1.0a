const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
}[character]));
const option = (value, label) => `<option value="${escapeHtml(value)}">${escapeHtml(label)}</option>`;
function selectField(fieldId, label, options) {
  return `<label>${escapeHtml(label)}<select data-p3d-config-field="${fieldId}">
<option value="">Select…</option>${options.map(([value, text]) => option(value, text)).join('')}</select>
<small data-p3d-config-status="${fieldId}">Missing</small></label>`;
}
function inputField(fieldId, label, type = 'text', unit = '', attributes = '') {
  return `<label>${escapeHtml(label)}<input type="${type}" data-p3d-config-field="${fieldId}"
${type === 'number' ? 'step="any"' : ''} ${attributes} autocomplete="off"><small data-p3d-config-status="${fieldId}">Missing${unit ? ` — ${escapeHtml(unit)}` : ''}</small></label>`;
}
function booleanField(fieldId, label) {
  return selectField(fieldId, label, [['true', 'True'], ['false', 'False']]);
}
function section(title, key, body) {
  return `<section class="p3d-config-section" data-p3d-config-section="${key}"><h4>${title}</h4>${body}</section>`;
}
function branchFields() {
  const base = [
    ['jobName', 'Job name'], ['issueNo', 'Issue number'], ['caesarVersion', 'CAESAR version'],
    ['branchName', 'Branch name'], ['lineNo', 'Line number'],
    ['outsideDiameterMm', 'Physical outside diameter (mm)', 'number'],
    ['wallThickness', 'Wall thickness (mm)', 'number'], ['materialNumber', 'Material number', 'number'],
    ['corrosionAllowance', 'Corrosion allowance (mm)', 'number'],
    ['insulationThickness', 'Insulation thickness (mm)', 'number'],
    ['insulationDensity', 'Insulation density', 'number'], ['fluidDensity', 'Fluid density', 'number'],
    ['hydroPressure', 'Hydro pressure', 'number'],
  ].map(([id, label, type]) => inputField(id, label, type || 'text')).join('');
  const cases = Array.from({ length: 9 }, (_, index) => `${inputField(`pressure${index + 1}`, `P${index + 1}`, 'number')}
${inputField(`temperature${index + 1}`, `T${index + 1} (°C)`, 'number')}`).join('');
  return `<div class="p3d-config-grid">${base}${cases}</div><div class="p3d-config-actions compact">
<button type="button" data-p3d-config-action="import-branch">Import visible branch block values</button></div>
<p class="p3d-config-note">Import is explicit and records BRANCH_INPUT_BLOCK provenance. Nominal/bore reference is never imported as physical OD.</p>`;
}
function profileSection() {
  return `<div data-p3d-config-sections></div>
<p class="p3d-config-note">Rows, identities, order and start indexes come only from the canonical analysis-section plan. They cannot be added, removed, reordered or moved here.</p>`;
}
function assignmentSection() {
  return `<p>Select exact later-section targets and exact branch fields, then confirm the reviewed source values.</p>
<div class="p3d-config-assignment-grid"><fieldset><legend>Target sections</legend><div data-p3d-config-assignment-targets></div></fieldset>
<fieldset><legend>Branch fields</legend><div data-p3d-config-assignment-fields></div></fieldset></div>
<label class="p3d-config-check"><input type="checkbox" data-p3d-config-assignment-confirm>
<span>I confirm the selected source values and targets</span></label>
<div class="p3d-config-actions compact"><button type="button" data-p3d-config-action="assign-properties">Assign selected branch fields to selected sections</button></div>
<div data-p3d-config-assignment-review aria-live="polite"></div>`;
}
function normalFields() {
  return `<div class="p3d-config-grid">${selectField('normalFittingPolicyId', 'Policy', [
    ['normal-standard-elbow', 'Standard elbow'], ['normal-explicit-radius-bend', 'Explicit-radius bend'],
  ])}${inputField('normalRadiusD', 'Radius (D)', 'number')}${inputField('normalRadiusMm', 'Radius (mm)', 'number')}</div>
<p class="p3d-config-note">Choose exactly one radius basis. No 1.5D value is inserted.</p>`;
}
function b314Fields() {
  return `<h5>Elastic criteria</h5><div class="p3d-config-grid">
${booleanField('b314ElasticFormulaEnabled', 'Enable formula criterion')}
${inputField('b314YoungsModulusMpa', 'Young’s modulus E (MPa)', 'number')}
${inputField('b314AllowableBendingStressMpa', 'Allowable bending stress Sb (MPa)', 'number')}
${booleanField('b314ElasticPracticalEnabled', 'Enable practical criterion')}
${inputField('b314PracticalRadiusD', 'Practical radius (D)', 'number')}</div>
<h5>Cold-field criteria</h5><div class="p3d-config-grid">
${selectField('b314ColdPolicyId', 'Policy', [
    ['b31.4-cold-field-size-band', 'B31.4 size-band'],
    ['b31.4-cold-field-project-radius-d', 'Explicit project radius D'],
  ])}${inputField('b314ProjectRadiusD', 'Project radius (D)', 'number')}
${booleanField('b314ProjectMinimumEnabled', 'Apply project minimum')}
${inputField('b314ProjectMinimumRadiusD', 'Project minimum (D)', 'number')}
${inputField('b314ProcedureMinimumRadiusD', 'Procedure minimum (D)', 'number')}
${booleanField('b314QualifiedAlternativeRequested', 'Request qualified 18D alternative')}
${inputField('b314QualificationEvidenceId', 'Qualification evidence ID')}</div>
<p class="p3d-config-note">Candidate classification remains read-only geometry evidence; policy applies only to B31.4-owned candidates.</p>`;
}
function greVendorFields() {
  return `<div class="p3d-config-grid">${inputField('greVendorId', 'Vendor ID')}
${inputField('greSeriesId', 'Series ID')}${inputField('greQualificationEvidenceId', 'Qualification evidence ID')}
${inputField('greRequirementReference', 'Requirement reference')}${inputField('greSourceAuthority', 'Source authority')}
${inputField('greSourceReference', 'Source reference')}${inputField('greVendorNominalBoreMm', 'GRE nominal bore (mm)', 'number')}</div>`;
}
function greBendFields() {
  return `<p><b>Policy:</b> gre-vendor-qualified-bend</p><div class="p3d-config-grid">
${inputField('greBendRadiusMm', 'Bend radius (mm)', 'number')}
${selectField('greBendBreakLengthBasis', 'Break-length basis', [
    ['NOMINAL_BORE_MULTIPLIER', 'Nominal-bore multiplier'], ['EXPLICIT_LENGTH', 'Explicit length'],
  ])}${inputField('greBendBreakMultiplierBore', 'Break multiplier × bore', 'number')}
${inputField('greBendBreakLengthMm', 'Explicit break length (mm)', 'number')}
<label>Derived break length (mm)<output data-p3d-derived-gre-break aria-live="polite">Not applicable</output>
<small data-p3d-derived-gre-break-status>Not applicable</small></label>
${inputField('greBendLocalThicknessMm', 'Local bend thickness (mm)', 'number')}</div>
<p class="p3d-config-note">Multiplier mode derives break length from GRE nominal bore. Derived values are read-only and labeled Source-derived.</p>`;
}
function geometryFields() {
  return `<div class="p3d-config-grid">${booleanField('bendScreeningEnabled', 'Enable bend processing')}
${booleanField('emitToInputXml', 'Request InputXML bend emission')}
${booleanField('screeningOnlyAcknowledged', 'Acknowledge external combined-load review')}
${booleanField('detectHorizontal', 'Detect horizontal turns')}${booleanField('detectVertical', 'Detect profile turns')}
${booleanField('detectCompound', 'Detect compound turns')}
${inputField('minimumPlanTurnAngleDeg', 'Minimum plan angle (deg)', 'number')}
${inputField('minimumProfileTurnAngleDeg', 'Minimum profile angle (deg)', 'number')}
${inputField('maximumTurnAngleDeg', 'Maximum turn angle (deg)', 'number')}
${selectField('shortElementAnglePolicy', 'Short-element policy', [
    ['include-all', 'Include all'], ['ignore-below-length', 'Ignore below explicit length'],
  ])}${inputField('minimumAngleElementLengthMm', 'Minimum qualifying length (mm)', 'number')}
${inputField('retainedStraightAllowanceMm', 'Retained straight allowance (mm)', 'number')}
${inputField('preferredStraightTangentMm', 'Preferred tangent (mm)', 'number')}
${booleanField('emitNearPointNode', 'Emit near-point node')}${booleanField('emitMidpointNode', 'Emit midpoint node')}
${selectField('bendTypeCode', 'Bend type', [['0', '0 — welded'], ['1', '1 — single flanged'], ['2', '2 — double flanged']])}</div>`;
}
export function engineeringConfigurationHtml() {
  return `<dialog class="p3d-engineering-config" data-p3d-engineering-config>
<header><div><h3>Engineering Configuration</h3><p>No engineering value is assumed. Missing evidence remains visible and blocking.</p></div>
<button type="button" data-p3d-config-action="close" aria-label="Close">×</button></header>
<div class="p3d-config-body">
${section('1. Configuration status', 'status', '<div data-p3d-config-summary aria-live="polite">Not validated</div>')}
${section('2. Branch and InputXML metadata', 'branch', branchFields())}
${section('3. Canonical analysis-section profiles', 'sections', profileSection())}
${section('4. Explicit section-property assignments', 'assignments', assignmentSection())}
${section('5. Diameter and property authority', 'diameter', '<div data-p3d-config-diameter-preview>Validate to inspect canonical diameter authority.</div>')}
${section('6. Normal fittings', 'normal', normalFields())}
${section('7. ASME B31.4 criteria', 'b314', b314Fields())}
${section('8. GRE vendor series', 'gre-vendor', greVendorFields())}
${section('9. GRE bend', 'gre-bend', greBendFields())}
${section('10. GRE tee', 'gre-tee', `<p><b>Policy:</b> gre-vendor-qualified-tee — explicit length</p><div class="p3d-config-grid">
${inputField('greTeeBreakLengthMm', 'Tee break length (mm)', 'number')}
${inputField('greTeeLocalThicknessMm', 'Local tee thickness (mm)', 'number')}</div>`)}
${section('11. Geometry and writer gates', 'gates', geometryFields())}
${section('12. Legacy migration review', 'legacy', '<div data-p3d-config-legacy></div>')}
${section('13. Evidence preview and export', 'evidence', '<pre data-p3d-config-preview></pre>')}
</div><footer class="p3d-config-actions">
<button type="button" data-p3d-config-action="save">Save draft</button>
<button type="button" data-p3d-config-action="validate">Validate</button>
<button type="button" data-p3d-config-action="apply" disabled>Apply and rebuild</button>
<button type="button" data-p3d-config-action="export-json">Export configuration JSON</button>
<button type="button" data-p3d-config-action="export-tsv">Export configuration TSV</button>
<button type="button" data-p3d-config-action="export-blockers">Export blocker report</button>
<button type="button" data-p3d-config-action="clear">Clear draft</button>
<button type="button" data-p3d-config-action="close">Close</button>
</footer></dialog>`;
}
export function analysisSectionRowHtml(section = {}, index = 0) {
  return `<div class="p3d-config-section-row" data-p3d-config-section-row="${index}">
<label>Analysis section ID<input value="${escapeHtml(section.analysisSectionId)}" readonly aria-readonly="true" data-p3d-canonical-section-id="${index}"><small>Canonical — read-only</small></label>
<label>Start element index<input value="${escapeHtml(section.startElementIndex)}" readonly aria-readonly="true" data-p3d-canonical-section-start="${index}"><small>Canonical — read-only</small></label>
${selectField(`section:${index}:profileId`, 'Profile', [
    ['normal-metallic', 'Normal metallic'], ['asme-b31.4', 'ASME B31.4'], ['gre', 'GRE'],
  ])}${inputField(`section:${index}:outsideDiameterMm`, 'Physical OD (mm)', 'number')}
${inputField(`section:${index}:nominalPipeSizeNps`, 'Canonical NPS', 'number')}
${inputField(`section:${index}:greVendorNominalBoreMm`, 'GRE nominal bore (mm)', 'number')}
<div class="p3d-config-boundary-evidence"><b>Boundary authority:</b> ${escapeHtml(section.boundaryAuthority || 'Missing')}<br>
<b>Source reference:</b> ${escapeHtml(section.boundarySourceReference || 'Missing')}<br>
<span data-p3d-config-section-status="${index}">Missing</span></div></div>`;
}
export const engineeringConfigurationEscapeHtml = escapeHtml;
