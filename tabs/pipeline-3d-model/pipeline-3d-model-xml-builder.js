import {
buildPipelineInputXmlDocumentPlan, PIPELINE_INPUTXML_DOCUMENT_SCHEMA, } from './pipeline-3d-model-inputxml-document.js?v=20260722-p3d-base-039-1'; import {
PIPELINE_INPUTXML_FITTING_AUTHORITY_SCHEMA, PIPELINE_INPUTXML_PROFILE_AUTHORITY_PLAN_SCHEMA, PIPELINE_INPUTXML_PROFILE_ELEMENT_AUTHORITY_SCHEMA,
PIPELINE_INPUTXML_PROFILE_SECTION_AUTHORITY_SCHEMA, } from './pipeline-3d-model-inputxml-profile-authority.js';
import { PIPELINE_PIPING_CODE_AUTHORITY_PLAN_SCHEMA } from './pipeline-3d-model-piping-code-authority.js';
import { PIPELINE_ALLOWABLE_VALUE_AUTHORITY_PLAN_SCHEMA } from './pipeline-3d-model-allowable-value-authority.js';
import { PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA } from './pipeline-3d-model-analysis-section-contracts.js'; import { PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA,
PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA, } from './pipeline-3d-model-diameter-contracts.js'; import { PIPELINE_BEND_RESOLUTION_SCHEMA, PIPELINE_NORMAL_FITTING_PLAN_SCHEMA,
} from './pipeline-3d-model-normal-fitting-contracts.js'; import { PIPELINE_B314_RADIUS_PLAN_SCHEMA } from './pipeline-3d-model-b314-radius-contracts.js';
import { PIPELINE_GRE_VENDOR_PLAN_SCHEMA } from './pipeline-3d-model-gre-vendor-series-contracts.js'; import { resolvePipelineIdentityContext, resolvePipelineNodeIdentity,
} from './pipeline-3d-model-identity.js?v=20260722-p3d-identity-1'; import { caesar14AllowableCaseAttributeEntries, caesar14AllowableStressAttributeEntries,
caesar14BendAttributeEntries, caesar14ElementAttributeEntries, caesar14ModelAttributeEntries, caesar14RestraintAttributeEntries,
caesar14RigidAttributeEntries, caesar14RootAttributeEntries, resolvePipelineCaesarWriterProfile, } from './pipeline-3d-model-caesar14-writer-profile.js';
import { resolvePipelineApprovedCatalogAttachedAuthentication } from './pipeline-3d-model-approved-catalog-attached-authentication.js';
const M_TO_MM = 1000; const NODE_NUMBER_START = 100; const NODE_NUMBER_STEP = 10;
const text = (value) => String(value ?? '').trim(); const plain = (value) => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right); function toMm(meters) { return Math.round(Number(meters || 0) * M_TO_MM * 1000) / 1000; }
export function buildCoordinateRows(combinedPoints, identityInput = {}) { const identity = resolvePipelineIdentityContext(identityInput);
return combinedPoints.map((point, index) => { const node = resolvePipelineNodeIdentity(point); return { branchName: identity.branchName, lineNo: identity.lineNo,
nodeNumber: NODE_NUMBER_START + index * NODE_NUMBER_STEP, x: toMm(point.x), y: toMm(point.y), z: toMm(point.z), nodeName: node.nodeName, nodeNameSource: node.nodeNameSource,
horizontal: point.horizontal, }; }); } export function coordinateRowsToTabText(rows) { const header = [ 'BranchName', 'LineNo', 'NodeNumber', 'X(mm)', 'Y(mm)', 'Z(mm)',
'NodeName', 'NodeNameSource', ].join('\t'); const lines = rows.map((row) => [ row.branchName, row.lineNo, row.nodeNumber, row.x, row.y, row.z, row.nodeName, row.nodeNameSource,
].join('\t')); return [header, ...lines].join('\n'); } function esc(value) { return String(value ?? '').replace(/[&<>"']/g, (ch) => ({
'&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;', }[ch])); } function attr(name, value) { return `${name}="${esc(value)}"`; }
function attrs(entries) { return entries.map(([name, value]) => attr(name, value)); }
function optionalAttr(values, name, value) { if (value === '' || value == null || !Number.isFinite(Number(value))) return; values.push(attr(name, Number(value))); }
function optionalTextAttr(values, name, value) { const valueText = String(value ?? '').trim(); if (valueText) values.push(attr(name, valueText)); }
function usableCurvatureNodes(bend) { const turnAngleDeg = Number(bend?.turnAngleDeg); return (bend?.curvatureNodes || []).filter((node) => {
const angle = Number(node?.angleDeg), nodeNumber = Number(node?.nodeNumber); return Number.isFinite(angle) && angle >= 0 && Number.isInteger(nodeNumber) && nodeNumber > 0
&& (!Number.isFinite(turnAngleDeg) || angle < turnAngleDeg - 1e-7); }).slice(0, 3); } function legacyBendXml(bend) { const radius = Number(bend?.radiusMm);
if (!Number.isFinite(radius) || radius <= 0) return ''; const values = [attr('RADIUS', radius)], typeCode = Number(bend?.bendTypeCode);
if (Number.isInteger(typeCode)) values.push(attr('TYPE', typeCode)); usableCurvatureNodes(bend).forEach((node, index) => { const slot = index + 1;
values.push(attr(`ANGLE${slot}`, Number(node.angleDeg))); values.push(attr(`NODE${slot}`, Number(node.nodeNumber))); }); values.push(attr('NUM_MITER', 0));
optionalAttr(values, 'FITTINGTHICKNESS', bend?.fittingThicknessMm); optionalAttr(values, 'KFACTOR', bend?.kfactor); return `<BEND ${values.join(' ')}/>`; }
function bendXml(bend, profile = resolvePipelineCaesarWriterProfile('')) { if (profile.mode !== 'CAESAR_14') return legacyBendXml(bend);
const values = caesar14BendAttributeEntries(bend, usableCurvatureNodes(bend)); return values.length ? `<BEND ${attrs(values).join(' ')}/>` : ''; }
function restraintXml(restraint, profile) { if (profile.mode !== 'CAESAR_14') return '';
return `<RESTRAINT ${attrs(caesar14RestraintAttributeEntries(restraint)).join(' ')}/>`; }
function rigidXml(rigid, profile) { if (profile.mode !== 'CAESAR_14' || !rigid) return '';
return `<RIGID ${attrs(caesar14RigidAttributeEntries(rigid)).join(' ')}/>`; }
function allowableCaseXml(caseItem, profile) { if (profile.mode !== 'CAESAR_14') return '';
return `<CASE ${attrs(caesar14AllowableCaseAttributeEntries(caseItem)).join(' ')}/>`; }
function allowableXml(allowable, profile) { if (profile.mode !== 'CAESAR_14' || !allowable) return '';
const cases = (allowable.cases || []).map((item) => allowableCaseXml(item, profile)).filter(Boolean);
return `<ALLOWABLESTRESS ${attrs(caesar14AllowableStressAttributeEntries(allowable)).join(' ')}>\n${cases.join('\n')}\n</ALLOWABLESTRESS>`; }
function propertyAttributes(properties) { const values = []; optionalAttr(values, 'DIAMETER', properties?.diameter); optionalAttr(values, 'WALL_THICK', properties?.wallThickness);
optionalAttr(values, 'INSUL_THICK', properties?.insulationThickness); optionalAttr(values, 'CORR_ALLOW', properties?.corrosionAllowance);
(properties?.temperatures || []).forEach((value, index) => optionalAttr(values, `TEMP_EXP_C${index + 1}`, value)); (properties?.pressures || []).forEach((value, index) =>
optionalAttr(values, `PRESSURE_C${index + 1}`, value)); optionalAttr(values, 'HYDRO_PRESSURE', properties?.hydroPressure);
optionalAttr(values, 'INSUL_DENSITY', properties?.insulationDensity); optionalAttr(values, 'FLUID_DENSITY', properties?.fluidDensity);
optionalAttr(values, 'MATERIAL_NUM', properties?.materialNumber); return values; } function pipingElementXml(element, profile) { const values = profile.mode === 'CAESAR_14'
? attrs(caesar14ElementAttributeEntries(element)) : [ attr('ID', element.id), attr('FROM_NODE', element.fromNode), attr('TO_NODE', element.toNode),
attr('DELTA_X', element.deltaX), attr('DELTA_Y', element.deltaY), attr('DELTA_Z', element.deltaZ), ...propertyAttributes(element.emittedProperties ?? element.properties), ];
if (profile.mode !== 'CAESAR_14') { optionalTextAttr(values, 'FROM_NAME', element.fromName); optionalTextAttr(values, 'TO_NAME', element.toName); values.push(attr('LINE', element.line));
values.push(attr('FROM_X', element.fromX), attr('FROM_Y', element.fromY), attr('FROM_Z', element.fromZ)); values.push(attr('TO_X', element.toX), attr('TO_Y', element.toY), attr('TO_Z', element.toZ)); }
const children = [rigidXml(element.rigid, profile), bendXml(element.bend, profile), ...(element.restraintSlots || []).map((item) => restraintXml(item, profile)), allowableXml(element.allowableStress, profile)].filter(Boolean);
if (!children.length) return `<PIPINGELEMENT ${values.join(' ')}/>`; return `<PIPINGELEMENT ${values.join(' ')}>\n${children.join('\n')}\n</PIPINGELEMENT>`; }
function modelAttributes(plan, profile = resolvePipelineCaesarWriterProfile('')) { if (profile.mode === 'CAESAR_14') return attrs(caesar14ModelAttributeEntries(plan));
const { metadata, counts } = plan, values = [attr('JOBNAME', metadata.jobName)]; optionalTextAttr(values, 'TIME', metadata.timeText);
optionalTextAttr(values, 'ISSUE_NO', metadata.issueNo); values.push( attr('NUMELT', counts.numElt), attr('NUMNOZ', counts.numNoz), attr('NOHGRS', counts.noHgrs),
attr('NUMBEND', counts.numBend), attr('NUMRIGID', counts.numRigid), attr('NUMEXPJNT', counts.numExpJnt), attr('NUMREST', counts.numRest),
attr('NUMFORCMNT', counts.numForcMnt), attr('NUMUNFLOAD', counts.numUnfLoad), attr('NUMWIND', counts.numWind), attr('NUMELEOFF', counts.numEleOff),
attr('NUMALLOW', counts.numAllow), attr('NUMISECT', counts.numISect), attr('NORTH_X', metadata.northX), attr('NORTH_Y', metadata.northY), attr('NORTH_Z', metadata.northZ), );
return values; } function resolvedPlan(input, coordinateRows, bendResolution) { if (input?.schema === PIPELINE_INPUTXML_DOCUMENT_SCHEMA) return input;
return buildPipelineInputXmlDocumentPlan({ exportContext: input, coordinateRows, bendResolution }); } function blocking(value) {
return (Array.isArray(value?.blockerCodes) && value.blockerCodes.length > 0) || (Array.isArray(value?.diagnostics)
&& value.diagnostics.some((item) => text(item?.severity) === 'BLOCKING')); } function exactSchemaReferences(plan, authority) { const references = {
analysisSectionPlanSchema: PIPELINE_ANALYSIS_SECTION_PLAN_SCHEMA, analysisDiameterPlanSchema: PIPELINE_ANALYSIS_DIAMETER_PLAN_SCHEMA,
normalFittingPlanSchema: PIPELINE_NORMAL_FITTING_PLAN_SCHEMA, b314RadiusPlanSchema: PIPELINE_B314_RADIUS_PLAN_SCHEMA, greVendorSeriesPlanSchema: PIPELINE_GRE_VENDOR_PLAN_SCHEMA,
bendResolutionSchema: PIPELINE_BEND_RESOLUTION_SCHEMA, propertySectionPlanSchema: PIPELINE_PROPERTY_SECTION_PLAN_SCHEMA, };
return Object.entries(references).every(([key, schema]) => plan[key] === schema && authority[key] === schema)
&& plan.profileAuthorityPlanSchema === PIPELINE_INPUTXML_PROFILE_AUTHORITY_PLAN_SCHEMA; } function bendMatchesAuthority(bend, fitting) { const expected = fitting?.bendGeometry;
if (!plain(bend) || !plain(expected)) return false; const scalarFields = ['incomingElementIndex', 'outgoingElementIndex', 'previousNode', 'cornerNode',
'nextNode', 'bendClass', 'status', 'turnAngleDeg', 'bendTypeCode', 'kfactor']; const conserved = text(bend.id) === expected.candidateId
&& scalarFields.every((key) => (bend[key] ?? null) === (expected[key === 'status' ? 'candidateStatus' : key] ?? null))
&& same(bend.curvatureNodes || [], expected.curvatureNodes || []); return conserved && Number(bend.radiusMm) === Number(fitting.governingRadiusMm)
&& (bend.fittingThicknessMm ?? null) === (fitting.fittingThicknessMm ?? null); } function authorityStructureValid(plan, authority) {
if (!plain(authority) || authority.schema !== PIPELINE_INPUTXML_PROFILE_AUTHORITY_PLAN_SCHEMA
|| authority.ready !== true || blocking(authority) || !exactSchemaReferences(plan, authority)) return false;
if (!Array.isArray(authority.sectionAuthorities) || !Array.isArray(authority.elementAuthorities) || !Array.isArray(authority.fittingAuthorities) || !Array.isArray(plan.elements)
|| authority.elementAuthorities.length !== plan.elements.length) return false; const sections = authority.sectionAuthorities, elements = authority.elementAuthorities;
const sectionIds = new Set(), elementIds = new Set(); const sectionValid = sections.every((section, index) => {
if (!plain(section) || section.schema !== PIPELINE_INPUTXML_PROFILE_SECTION_AUTHORITY_SCHEMA
|| section.ready !== true || blocking(section) || section.analysisSectionId !== `AS${index + 1}` || !Number.isInteger(section.startElementIndex) || section.startElementIndex < 0
|| (index === 0 ? section.startElementIndex !== 0 : section.startElementIndex <= sections[index - 1].startElementIndex) || sectionIds.has(section.analysisSectionId)) return false;
sectionIds.add(section.analysisSectionId); const owned = plan.elements.filter((element) => element.analysisSectionId === section.analysisSectionId);
return owned.length > 0 && owned[0].index === section.startElementIndex && owned.every((element) => element.profileId === section.profileId
&& element.resolvedMode === section.resolvedMode && element.caesarDiameterMm === section.caesarDiameterMm)
&& (section.profileId === 'gre') === plain(section.greVendorSeriesAuthority); }); const elementValid = elements.every((authorityItem, index) => {
const element = plan.elements[index], section = sections.filter((item) => item.startElementIndex <= index).at(-1);
if (!plain(authorityItem) || authorityItem.schema !== PIPELINE_INPUTXML_PROFILE_ELEMENT_AUTHORITY_SCHEMA
|| authorityItem.ready !== true || blocking(authorityItem) || authorityItem.elementIndex !== index
|| authorityItem.elementId !== `E${index + 1}` || elementIds.has(authorityItem.elementId) || !section || authorityItem.analysisSectionId !== section.analysisSectionId
|| authorityItem.profileId !== section.profileId || authorityItem.writerDisposition !== 'READY'
|| !same(element.profileAuthority, authorityItem) || element.id !== authorityItem.elementId
|| element.index !== authorityItem.elementIndex || element.caesarDiameterMm !== authorityItem.caesarDiameterMm
|| element.emittedProperties?.diameter !== authorityItem.caesarDiameterMm) return false; elementIds.add(authorityItem.elementId); return true; });
return sectionValid && elementValid; } function fittingStructureValid(plan, authority) {
const fittings = authority.fittingAuthorities, byCandidate = new Set(), byIncoming = new Set(); const represented = new Set(); const valid = fittings.every((fitting) => {
const element = plan.elements[fitting?.incomingElementIndex]; const elementAuthority = authority.elementAuthorities[fitting?.incomingElementIndex];
if (!plain(fitting) || fitting.schema !== PIPELINE_INPUTXML_FITTING_AUTHORITY_SCHEMA || fitting.ready !== true || blocking(fitting) || byCandidate.has(fitting.candidateId)
|| byIncoming.has(fitting.incomingElementIndex) || !element || !elementAuthority
|| fitting.incomingElementId !== element.id || fitting.outgoingElementIndex !== fitting.incomingElementIndex + 1
|| fitting.outgoingElementId !== `E${fitting.outgoingElementIndex + 1}` || fitting.analysisSectionId !== elementAuthority.analysisSectionId
|| fitting.profileId !== elementAuthority.profileId || elementAuthority.fittingCandidateId !== fitting.candidateId
|| elementAuthority.fittingAuthorityKind !== fitting.fittingAuthorityKind || elementAuthority.fittingPolicyId !== fitting.fittingPolicyId) return false;
byCandidate.add(fitting.candidateId); byIncoming.add(fitting.incomingElementIndex); represented.add(fitting.candidateId); return fitting.geometryDisposition === 'MATCHES_AUTHORITY'
&& fitting.writerDisposition === 'READY' && bendMatchesAuthority(element.bend, fitting); });
const elementCandidates = authority.elementAuthorities.map((item) => item.fittingCandidateId).filter(Boolean); const noUnexpectedBends = plan.elements.every((element, index) => {
const candidateId = authority.elementAuthorities[index]?.fittingCandidateId; return candidateId ? represented.has(candidateId) : element.bend == null; });
return valid && noUnexpectedBends && elementCandidates.length === fittings.length && new Set(elementCandidates).size === fittings.length; }
function restraintStructureValid(plan) { let restraintCount = 0; const valid = plan.elements.every((element) => {
const count = Number(element.restraintCount || 0), slots = element.restraintSlots; if (!count) return slots == null || (Array.isArray(slots) && slots.length === 0);
if (!Array.isArray(slots) || slots.length !== 6) return false; const real = slots.filter((item) => item?.placeholder !== true); restraintCount += real.length;
return real.length === count && slots.every((item, index) => item?.slot === index + 1 && (item.placeholder === true || item.node === element.toNode)); });
return valid && plan.counts.numRest === restraintCount; }
function rigidStructureValid(plan) { let rigidCount = 0; const valid = plan.elements.every((element) => {
const rigid = element.rigid; if (rigid == null) return true; rigidCount += 1;
return rigid.elementId === element.id && rigid.elementIndex === element.index && rigid.node === element.toNode
&& Number.isFinite(Number(rigid.weight)) && Number(rigid.weight) >= 0 && ['Flange', 'Flange Pair', 'Valve', 'Rigid'].includes(rigid.type); });
return valid && plan.counts.numRigid === rigidCount; }
function allowableStructureValid(plan) { let allowableCount = 0; const valid = plan.elements.every((element) => {
const allowable = element.allowableStress; if (allowable == null) return true; allowableCount += 1;
return allowable.elementId === element.id && allowable.elementIndex === element.index && allowable.node === element.toNode
&& plain(allowable.attributes) && Array.isArray(allowable.cases) && allowable.cases.length === 9
&& allowable.cases.every((item, index) => item?.num === index + 1 && plain(item.attributes)); });
return valid && plan.counts.numAllow === allowableCount; }
function pipingCodeAuthorityStructureValid(plan) { const required = plan.elements.filter((element) => element.allowableStress != null);
if (!required.length) return plan.pipingCodeAuthorityPlan == null && plan.pipingCodeAuthorityPlanSchema == null;
const authorityPlan = plan.pipingCodeAuthorityPlan; if (!plain(authorityPlan)
|| authorityPlan.schema !== PIPELINE_PIPING_CODE_AUTHORITY_PLAN_SCHEMA
|| plan.pipingCodeAuthorityPlanSchema !== PIPELINE_PIPING_CODE_AUTHORITY_PLAN_SCHEMA
|| authorityPlan.ready !== true || blocking(authorityPlan) || !Array.isArray(authorityPlan.authorities)
|| !Array.isArray(authorityPlan.elements) || authorityPlan.elements.length !== plan.elements.length) return false;
const requiredSections = new Set(required.map((element) => element.analysisSectionId));
if (authorityPlan.authorityCount !== authorityPlan.authorities.length
|| authorityPlan.requiredSectionCount !== requiredSections.size
|| authorityPlan.authorities.length !== requiredSections.size) return false;
const authorityBySection = new Map(authorityPlan.authorities.map((item) => [item.analysisSectionId, item]));
if (authorityBySection.size !== authorityPlan.authorities.length) return false;
return plan.elements.every((element, index) => { const binding = authorityPlan.elements[index];
if (!plain(binding) || binding.elementId !== element.id || binding.elementIndex !== element.index) return false;
if (element.allowableStress == null) return binding.allowableStress == null && binding.authority == null;
const authority = authorityBySection.get(element.analysisSectionId); const code = Number(authority?.caesarPipingCode);
return plain(authority) && Number.isInteger(code) && code > 0 && text(authority.sourceAuthority)
&& authority.analysisSectionId === element.analysisSectionId && authority.profileId === element.profileId
&& authority.resolvedMode === element.resolvedMode && binding.analysisSectionId === element.analysisSectionId
&& binding.profileId === element.profileId && binding.resolvedMode === element.resolvedMode
&& same(binding.authority, authority) && same(binding.allowableStress?.pipingCodeAuthority, authority)
&& Number(binding.allowableStress?.attributes?.PIPING_CODE) === code
&& same(element.allowableStress.pipingCodeAuthority, authority)
&& Number(element.allowableStress.attributes?.PIPING_CODE) === code; }); }
function positiveNumber(value) { const number = Number(value); return Number.isFinite(number) && number > 0 ? number : null; }
function materialIdentity(element) { return { materialNumber: positiveNumber(element?.properties?.materialNumber),
materialName: text(element?.mechanicalProperties?.materialName ?? element?.emittedMechanicalProperties?.materialName
?? element?.properties?.materialName ?? element?.emittedProperties?.materialName), }; }
function temperatureSlots(element) { const values = element?.properties?.temperatures ?? element?.emittedProperties?.temperatures ?? [];
return Array.from({ length: 9 }, (_, index) => Number.isFinite(Number(values?.[index])) ? Number(values[index]) : null); }
function authorityValueValid(evidence) { if (!plain(evidence) || !['VALUE', 'ZERO', 'SENTINEL'].includes(evidence.disposition)) return false;
if (evidence.disposition === 'SENTINEL') return evidence.value == null; if (evidence.disposition === 'ZERO') return Number(evidence.value) === 0;
return Number.isFinite(Number(evidence.value)) && Number(evidence.value) > 0; }
function authorityScalarMatches(value, evidence) { return evidence.value == null ? value == null : Number(value) === Number(evidence.value); }
function allowableValueAuthorityStructureValid(plan) { const required = plan.elements.filter((element) => element.allowableStress != null);
if (!required.length) return plan.allowableValueAuthorityPlan == null && plan.allowableValueAuthorityPlanSchema == null;
const authorityPlan = plan.allowableValueAuthorityPlan; if (!plain(authorityPlan)
|| authorityPlan.schema !== PIPELINE_ALLOWABLE_VALUE_AUTHORITY_PLAN_SCHEMA
|| plan.allowableValueAuthorityPlanSchema !== PIPELINE_ALLOWABLE_VALUE_AUTHORITY_PLAN_SCHEMA
|| authorityPlan.ready !== true || blocking(authorityPlan) || !Array.isArray(authorityPlan.authorities)
|| !Array.isArray(authorityPlan.elements) || authorityPlan.elements.length !== plan.elements.length) return false;
const requiredSections = new Set(required.map((element) => element.analysisSectionId));
if (authorityPlan.authorityCount !== authorityPlan.authorities.length
|| authorityPlan.requiredSectionCount !== requiredSections.size
|| authorityPlan.authorities.length !== requiredSections.size) return false;
const authorityBySection = new Map(authorityPlan.authorities.map((item) => [item.analysisSectionId, item]));
if (authorityBySection.size !== authorityPlan.authorities.length) return false;
return plan.elements.every((element, index) => { const binding = authorityPlan.elements[index];
if (!plain(binding) || binding.elementId !== element.id || binding.elementIndex !== element.index) return false;
if (element.allowableStress == null) return binding.allowableStress == null && binding.authority == null;
const authority = authorityBySection.get(element.analysisSectionId), material = materialIdentity(element);
if (!plain(authority) || authority.analysisSectionId !== element.analysisSectionId
|| authority.profileId !== element.profileId || authority.resolvedMode !== element.resolvedMode
|| material.materialNumber !== authority.materialNumber || material.materialName !== authority.materialName
|| !text(authority.sourceAuthority) || !plain(authority.values)
|| !['COLD_ALLOW', 'SY', 'SU'].every((field) => authorityValueValid(authority.values[field])
&& authorityScalarMatches(element.allowableStress.attributes?.[field], authority.values[field]))
|| binding.analysisSectionId !== element.analysisSectionId || !same(binding.authority, authority)
|| !same(binding.allowableStress, element.allowableStress)
|| !same(element.allowableStress.allowableValueAuthority, authority) || !Array.isArray(authority.cases)) return false;
const caseByNumber = new Map(authority.cases.map((item) => [item.num, item]));
if (caseByNumber.size !== authority.cases.length) return false;
return temperatureSlots(element).every((temperature, caseIndex) => { const num = caseIndex + 1;
const caseAuthority = caseByNumber.get(num), caseItem = element.allowableStress.cases?.[caseIndex];
if (temperature == null) return caseAuthority == null && caseItem?.allowableValueCaseAuthority == null
&& ['HOT_ALLOW', 'HOT_SY', 'HOT_SU'].every((field) => caseItem?.attributes?.[field] == null || caseItem.attributes[field] === '');
return plain(caseAuthority) && caseAuthority.num === num && caseAuthority.temperature === temperature
&& text(caseAuthority.sourceAuthority) && plain(caseAuthority.values)
&& ['HOT_ALLOW', 'HOT_SY', 'HOT_SU'].every((field) => authorityValueValid(caseAuthority.values[field])
&& authorityScalarMatches(caseItem?.attributes?.[field], caseAuthority.values[field]))
&& same(caseItem?.allowableValueCaseAuthority, caseAuthority); }); }); }
function countStructureValid(plan, authority) { if (!plain(plan.counts) || plan.counts.numElt !== plan.elements.length) return false;
const bendCount = plan.elements.filter((element) => element.bend != null).length; const fittingCount = authority.fittingAuthorities.filter((item) =>
item.geometryDisposition === 'MATCHES_AUTHORITY' && item.writerDisposition === 'READY').length;
const zeroFields = ['numNoz', 'noHgrs', 'numExpJnt', 'numForcMnt', 'numUnfLoad', 'numWind', 'numEleOff', 'numISect'];
return plan.counts.numBend === bendCount && bendCount === fittingCount && restraintStructureValid(plan) && rigidStructureValid(plan)
&& allowableStructureValid(plan) && pipingCodeAuthorityStructureValid(plan) && allowableValueAuthorityStructureValid(plan)
&& zeroFields.every((key) => plan.counts[key] === 0); } function profileWriterDiagnostic(plan) {
if (!plan.profileAuthorityPlan) return null; const authority = plan.profileAuthorityPlan; const documentState = plan.ready === true && Array.isArray(plan.diagnostics)
&& Array.isArray(plan.blockerCodes) && plan.diagnostics.length === 0 && plan.blockerCodes.length === 0; const valid = documentState && authorityStructureValid(plan, authority)
&& fittingStructureValid(plan, authority) && countStructureValid(plan, authority); return valid ? null : { code: 'PIPELINE_INPUTXML_WRITER_BLOCKED',
message: 'Profile-aware document authority does not match writer input.', details: {}, }; }
function approvedCatalogWriterDiagnostic(plan) { const authentication = resolvePipelineApprovedCatalogAttachedAuthentication(plan);
if (!authentication.active || authentication.ready) return null; return { code: 'PIPELINE_INPUTXML_WRITER_BLOCKED',
message: 'Attached approved-catalog ancestry does not match writer input.', details: { blockerCodes: authentication.blockerCodes }, }; }
function assertDocumentReady(plan) {
const writerDiagnostic = approvedCatalogWriterDiagnostic(plan) || profileWriterDiagnostic(plan); if (plan.ready && !writerDiagnostic) return;
const first = plan.ready && writerDiagnostic ? writerDiagnostic : plan.diagnostics?.[0] || writerDiagnostic;
const error = new Error(first?.message || 'Canonical InputXML document planning failed.'); error.code = first?.code || 'PIPELINE_INPUTXML_DOCUMENT_BLOCKED';
error.details = first?.details || {}; error.blockerCodes = [...new Set([...(plan.blockerCodes || []), ...(first?.details?.blockerCodes || [])])]; throw error; }
export function buildInputXmlPipingModelXml(input, coordinateRows = [], bendResolution = null) { const plan = resolvedPlan(input, coordinateRows, bendResolution);
assertDocumentReady(plan); const profile = resolvePipelineCaesarWriterProfile(plan.version); const rootAttrs = profile.mode === 'CAESAR_14'
? attrs(caesar14RootAttributeEntries(plan)) : [ attr('xmlns', plan.namespace), attr('xmlns:ext', plan.extensionNamespace), attr('VERSION', plan.version), attr('XML_TYPE', plan.xmlType), ];
const modelAttrs = modelAttributes(plan, profile); return [ '<?xml version="1.0" encoding="UTF-8"?>', `<CAESARII ${rootAttrs.join(' ')}>`, `<PIPINGMODEL ${modelAttrs.join(' ')}>`,
...plan.elements.map((element) => pipingElementXml(element, profile)), '</PIPINGMODEL>', '</CAESARII>', ].join('\n'); }
export const _internal = { toMm, bendXml, restraintXml, rigidXml, allowableCaseXml, allowableXml, usableCurvatureNodes, propertyAttributes, modelAttributes, profileWriterDiagnostic, approvedCatalogWriterDiagnostic, bendMatchesAuthority, restraintStructureValid, rigidStructureValid, allowableStructureValid, pipingCodeAuthorityStructureValid, allowableValueAuthorityStructureValid, };
