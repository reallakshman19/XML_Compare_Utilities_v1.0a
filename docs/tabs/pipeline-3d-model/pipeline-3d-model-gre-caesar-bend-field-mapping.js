import {
  PIPELINE_GRE_CAESAR_BEND_FIELD_MAPPING_SCHEMA,
  PIPELINE_GRE_CAESAR_FIELD_CASES,
  PIPELINE_GRE_CAESAR_FIELD_DISPOSITIONS,
  clonePipelineGreCaesarQualificationValue as clone,
  createPipelineGreCaesarBendFieldMappingRecord,
  createPipelineGreCaesarDiagnostic as diagnostic,
  safePipelineGreCaesarQualificationInput as safe,
} from './pipeline-3d-model-gre-caesar-qualification-contracts.js';

export { PIPELINE_GRE_CAESAR_BEND_FIELD_MAPPING_SCHEMA };

const text = (value) => typeof value === 'string' ? value.trim() : '';
const finite = (value) => typeof value === 'number' && Number.isFinite(value);
const same = (left, right) => JSON.stringify(left) === JSON.stringify(right);

function acceptedRoundTrip(fixture) {
  return fixture?.ready === true && fixture.importEvidence?.result === 'ACCEPTED'
    && fixture.importEvidence?.cleanImport === true
    && fixture.roundTripEvidence?.semanticEquivalent === true;
}

function fixtureSelection(source, errors) {
  const fixtures = Array.isArray(source.fixtures) ? source.fixtures : [];
  const wanted = Array.isArray(source.fixtureIds) ? source.fixtureIds.map(text).filter(Boolean) : [];
  const unique = [...new Set(wanted)];
  if (!unique.length || unique.length !== wanted.length) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_FIXTURE_REQUIRED', { mappingId: text(source.mappingId) }));
  const byId = Object.fromEntries(fixtures.map((item) => [item.fixtureId, item]));
  const selected = unique.map((id) => byId[id]).filter(Boolean);
  if (selected.length !== unique.length || selected.some((item) => !acceptedRoundTrip(item)
    || !PIPELINE_GRE_CAESAR_FIELD_CASES.includes(item.fixtureCaseId))) errors.push(
    diagnostic('PIPELINE_GRE_CAESAR_FIXTURE_UNAUTHENTICATED', { mappingId: text(source.mappingId) }));
  return selected;
}

function identityValid(source, fixtures, errors) {
  const fields = ['caesarVersion', 'caesarBuild', 'unitFileId', 'unitFileSha256',
    'pipingCodeId', 'pipingCodeName', 'pipingCodeEdition', 'laminateClassification'];
  fields.forEach((field) => {
    if (!text(source[field]) || fixtures.some((fixture) => fixture[field] !== text(source[field]))) errors.push(
      diagnostic(field === 'caesarVersion' ? 'PIPELINE_GRE_CAESAR_VERSION_UNRESOLVED'
        : field === 'caesarBuild' ? 'PIPELINE_GRE_CAESAR_BUILD_UNRESOLVED'
          : field.startsWith('unitFile') ? 'PIPELINE_GRE_CAESAR_UNIT_FILE_UNRESOLVED'
            : field === 'pipingCodeId' ? 'PIPELINE_GRE_CAESAR_CODE_ID_UNRESOLVED'
              : field === 'pipingCodeEdition' ? 'PIPELINE_GRE_CAESAR_CODE_EDITION_UNRESOLVED'
                : field === 'laminateClassification' ? 'PIPELINE_GRE_CAESAR_LAMINATE_UNRESOLVED'
                  : 'PIPELINE_GRE_CAESAR_FIXTURE_CONFLICT', { mappingId: text(source.mappingId), field }));
  });
}

const allBends = (fixtures) => fixtures.flatMap((fixture) => fixture.bendRecords || []);

function numericDisposition(source, bends, prefix, blocker, errors) {
  const disposition = source[`${prefix}Disposition`], value = source[`${prefix}Value`];
  const lexical = text(source[`${prefix}LexicalValue`]);
  const presentField = prefix === 'bendType' ? 'typeAttributePresent' : 'numMiterAttributePresent';
  const valueField = prefix === 'bendType' ? 'typeValue' : 'numMiterValue';
  const lexicalField = prefix === 'bendType' ? 'typeLexicalValue' : 'numMiterLexicalValue';
  let valid = false;
  if (disposition === 'EMIT_NUMERIC') valid = finite(value) && lexical && Number(lexical) === value
    && bends.every((bend) => bend[presentField] === true && bend[valueField] === value
      && bend[lexicalField] === lexical);
  if (disposition === 'OMIT_ATTRIBUTE') valid = value == null && !lexical
    && bends.every((bend) => bend[presentField] === false);
  if (disposition === 'PRESERVE_QUALIFIED_SENTINEL') valid = finite(value) && value < 0
    && lexical && Number(lexical) === value && bends.every((bend) => bend[presentField] === true
      && bend[valueField] === value && bend[lexicalField] === lexical);
  if (!valid) errors.push(diagnostic(blocker, { mappingId: text(source.mappingId), disposition }));
  if (['EMIT_NUMERIC', 'PRESERVE_QUALIFIED_SENTINEL'].includes(disposition) && !lexical) errors.push(
    diagnostic('PIPELINE_GRE_CAESAR_LEXICAL_VALUE_UNRESOLVED', { mappingId: text(source.mappingId), prefix }));
}

function curvatureValid(source, bends, errors) {
  const disposition = source.curvatureNodeDisposition;
  const roles = Array.isArray(source.curvatureNodeRoles) ? source.curvatureNodeRoles.map(text) : [];
  const bendRoles = bends.map((bend) => (bend.curvatureNodes || []).map((node) => node.role));
  let valid = false;
  if (disposition === 'NO_CURVATURE_NODES_REQUIRED') valid = roles.length === 0
    && bendRoles.every((value) => value.length === 0);
  if (disposition === 'EXACT_CURVATURE_ROLES_REQUIRED') valid = roles.length > 0
    && bendRoles.every((value) => same(value, roles));
  if (disposition === 'OPTIONAL_QUALIFIED_CURVATURE_ROLES') valid = bendRoles.every((value) =>
    same(value, roles) || value.length === 0);
  if (!valid || source.overallTurnAngleDisposition !== 'OVERALL_ANGLE_EVIDENCE_ONLY') errors.push(
    diagnostic('PIPELINE_GRE_CAESAR_CURVATURE_NODE_POLICY_UNRESOLVED', {
      mappingId: text(source.mappingId), disposition }));
}

export function createPipelineGreCaesarBendFieldMapping(input = {}) {
  const safeValue = safe(input), source = safeValue.source, errors = [...safeValue.diagnostics];
  const fixtures = fixtureSelection(source, errors), bends = allBends(fixtures);
  if (!fixtures.length || fixtures.some((item) => !acceptedRoundTrip(item))) errors.push(
    diagnostic('PIPELINE_GRE_CAESAR_BEND_TYPE_UNRESOLVED', { mappingId: text(source.mappingId) }),
    diagnostic('PIPELINE_GRE_CAESAR_NUM_MITER_UNRESOLVED', { mappingId: text(source.mappingId) }),
    diagnostic('PIPELINE_GRE_CAESAR_CURVATURE_NODE_POLICY_UNRESOLVED', { mappingId: text(source.mappingId) }));
  if (!text(source.mappingId) || !text(source.sourceAuthority)
    || !Array.isArray(source.sourceReferences) || source.sourceReferences.some((item) => !text(item))) errors.push(
    diagnostic('PIPELINE_GRE_CAESAR_FIXTURE_UNAUTHENTICATED', { mappingId: text(source.mappingId) }));
  identityValid(source, fixtures, errors);
  numericDisposition(source, bends, 'bendType', 'PIPELINE_GRE_CAESAR_BEND_TYPE_UNRESOLVED', errors);
  numericDisposition(source, bends, 'numMiter', 'PIPELINE_GRE_CAESAR_NUM_MITER_UNRESOLVED', errors);
  curvatureValid(source, bends, errors);
  if (source.fittingThicknessDisposition !== 'EMIT_AUTHENTICATED_VALUE'
    || source.radiusDisposition !== 'EMIT_AUTHENTICATED_VALUE') errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_FIXTURE_CONFLICT', { mappingId: text(source.mappingId), field: 'RADIUS_OR_THICKNESS' }));
  if (![source.bendTypeDisposition, source.numMiterDisposition, source.curvatureNodeDisposition,
    source.overallTurnAngleDisposition, source.fittingThicknessDisposition, source.radiusDisposition]
    .every((item) => PIPELINE_GRE_CAESAR_FIELD_DISPOSITIONS.includes(item))) errors.push(diagnostic(
    'PIPELINE_GRE_CAESAR_FIXTURE_CONFLICT', { mappingId: text(source.mappingId), field: 'DISPOSITION' }));
  return createPipelineGreCaesarBendFieldMappingRecord({ mappingId: text(source.mappingId),
    caesarVersion: text(source.caesarVersion), caesarBuild: text(source.caesarBuild),
    unitFileId: text(source.unitFileId), unitFileSha256: text(source.unitFileSha256),
    pipingCodeId: text(source.pipingCodeId), pipingCodeName: text(source.pipingCodeName),
    pipingCodeEdition: text(source.pipingCodeEdition), laminateClassification: text(source.laminateClassification),
    bendTypeDisposition: text(source.bendTypeDisposition),
    bendTypeCode: Object.hasOwn(source, 'bendTypeValue') ? source.bendTypeValue : null,
    bendTypeLexicalValue: text(source.bendTypeLexicalValue), bendTypeMeaning: text(source.bendTypeMeaning),
    numMiterDisposition: text(source.numMiterDisposition),
    numMiterValue: Object.hasOwn(source, 'numMiterValue') ? source.numMiterValue : null,
    numMiterLexicalValue: text(source.numMiterLexicalValue), numMiterMeaning: text(source.numMiterMeaning),
    curvatureNodeDisposition: text(source.curvatureNodeDisposition),
    curvatureNodeRoles: clone(source.curvatureNodeRoles || []),
    overallTurnAngleDisposition: text(source.overallTurnAngleDisposition),
    fittingThicknessDisposition: text(source.fittingThicknessDisposition),
    radiusDisposition: text(source.radiusDisposition), sourceAuthority: text(source.sourceAuthority),
    sourceReferences: clone(source.sourceReferences || []), fixtureIds: clone(source.fixtureIds || []),
  }, errors);
}

export function buildPipelineGreCaesarBendFieldMatrixTsv(mappings) {
  const header = ['MappingId', 'CaesarVersion', 'CaesarBuild', 'PipingCodeId', 'CodeEdition', 'Laminate',
    'TypeDisposition', 'TypeCode', 'TypeLexical', 'NumMiterDisposition', 'NumMiterValue',
    'NumMiterLexical', 'CurvatureRoleDisposition', 'Ready', 'Blockers'];
  const rows = [...mappings].sort((a, b) => a.mappingId < b.mappingId ? -1 : a.mappingId > b.mappingId ? 1 : 0)
    .map((item) => [item.mappingId, item.caesarVersion, item.caesarBuild, item.pipingCodeId,
      item.pipingCodeEdition, item.laminateClassification, item.bendTypeDisposition, item.bendTypeCode,
      item.bendTypeLexicalValue, item.numMiterDisposition, item.numMiterValue,
      item.numMiterLexicalValue, item.curvatureNodeDisposition, item.ready,
      (item.blockerCodes || []).join('|')]);
  return [header, ...rows].map((row) => row.map((value) => value ?? '').join('\t')).join('\n');
}
