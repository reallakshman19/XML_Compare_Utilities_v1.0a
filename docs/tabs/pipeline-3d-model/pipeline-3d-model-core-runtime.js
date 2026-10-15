import { buildGeometryAuthorityRoute } from './pipeline-3d-model-bend-route.js?v=20260721-bend-policy-v3-1';
import { resolvePipelineSectionAwareBends } from './pipeline-3d-model-section-aware-bend-resolution.js';
import { resolvePipelineAnalysisPropertyReseedPlan } from './pipeline-3d-model-analysis-property-reseed.js';
import { resolvePipelineAnalysisDiameterPlan } from './pipeline-3d-model-diameter-resolution.js';
import { resolvePipelineNormalFittingPlan } from './pipeline-3d-model-normal-fitting-resolution.js';
import { resolvePipelineB314RadiusPlan } from './pipeline-3d-model-b314-radius-resolution.js';
import { resolvePipelineGreVendorSeriesPlan } from './pipeline-3d-model-gre-vendor-series-resolution.js';
import {
  buildPipelineGreBendGeometryPlanJson,
  buildPipelineGreBendGeometryPlanTsv,
} from './pipeline-3d-model-gre-bend-geometry-contracts.js';
import { resolvePipelineGreBendGeometryPlan } from './pipeline-3d-model-gre-bend-geometry-plan.js';
import {
  buildPipelineGreBendElementLineageTsv,
  buildPipelineGreBendMaterializationPlanJson,
  buildPipelineGreBendMaterializedModelJson,
  buildPipelineGreBendNodeAllocationTsv,
} from './pipeline-3d-model-gre-bend-materialization-contracts.js';
import { resolvePipelineGreBendMaterializationPlan } from './pipeline-3d-model-gre-bend-materialization.js';
import { resolvePipelinePropertySectionPlan } from './pipeline-3d-model-property-sections.js?v=20260724-p3d-hard-051-1';
import { buildExplicitPipelineInputXmlDocumentPlan } from './pipeline-3d-model-explicit-inputxml.js';
import { buildInputXmlPipingModelXml } from './pipeline-3d-model-xml-builder.js?v=20260722-p3d-base-039-1';
import { buildPipelineCoreOrchestration } from './pipeline-3d-model-core-orchestrator.js';
import { withPipelineApprovedCatalogProductionInputs } from './pipeline-3d-model-approved-catalog-production-input.js';

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.values(value).forEach(freeze);
  return Object.freeze(value);
}
function artifact(fileId, name, sourceSchema, text, mime) {
  return freeze({ fileId, name, sourceSchema, mime, role: 'ENGINEERING_EVIDENCE', text });
}
function adoptGreBendGeometry(base, input) {
  const plan = resolvePipelineGreBendGeometryPlan({
    bendResolution: base.bendResolution,
    sectionProfileRoutingPlan: base.sectionProfileRoutingPlan,
    greVendorSeriesPlan: base.greVendorSeriesPlan,
    bendBreakApplications: input.greBendBreakApplications,
  });
  const artifacts = Object.freeze([...(base.artifacts || []),
    artifact('greBendGeometryPlan', 'pipeline-gre-bend-geometry-plan.json', plan.schema,
      buildPipelineGreBendGeometryPlanJson(plan), 'application/json'),
    artifact('greBendGeometryPlanTsv', 'pipeline-gre-bend-geometry-plan.tsv', plan.schema,
      buildPipelineGreBendGeometryPlanTsv(plan), 'text/tab-separated-values')]);
  const diagnostics = Object.freeze([...(base.diagnostics || []), ...plan.diagnostics]);
  const blockerCodes = Object.freeze([...new Set([...(base.blockerCodes || []), ...plan.blockerCodes])]);
  return freeze({ ...base, greBendGeometryPlan: plan, artifacts, diagnostics, blockerCodes,
    ready: base.ready === true && plan.ready === true });
}
function adoptGreBendMaterialization(base, input) {
  const plan = resolvePipelineGreBendMaterializationPlan({
    greBendGeometryPlan: base.greBendGeometryPlan,
    bendResolution: base.bendResolution,
    sectionProfileRoutingPlan: base.sectionProfileRoutingPlan,
    nodeAllocationPolicy: input.greBendNodeAllocationPolicy,
  });
  const evidence = [artifact('greBendMaterializationPlan',
    'pipeline-gre-bend-materialization-plan.json', plan.schema,
    buildPipelineGreBendMaterializationPlanJson(plan), 'application/json')];
  if (plan.materializedModel) evidence.push(artifact('greBendMaterializedModel',
    'pipeline-gre-bend-materialized-model.json', plan.materializedModel.schema,
    buildPipelineGreBendMaterializedModelJson(plan.materializedModel), 'application/json'));
  evidence.push(artifact('greBendElementLineage', 'pipeline-gre-bend-element-lineage.tsv', plan.schema,
    buildPipelineGreBendElementLineageTsv(plan), 'text/tab-separated-values'),
  artifact('greBendNodeAllocation', 'pipeline-gre-bend-node-allocation.tsv', plan.nodeAllocationPlan?.schema || plan.schema,
    buildPipelineGreBendNodeAllocationTsv(plan), 'text/tab-separated-values'));
  const artifacts = Object.freeze([...(base.artifacts || []), ...evidence]);
  const diagnostics = Object.freeze([...(base.diagnostics || []), ...plan.diagnostics]);
  const blockerCodes = Object.freeze([...new Set([...(base.blockerCodes || []), ...plan.blockerCodes])]);
  return freeze({ ...base, greBendMaterializationPlan: plan, artifacts, diagnostics, blockerCodes,
    ready: base.ready === true && plan.ready === true });
}

export const PIPELINE_CORE_RUNTIME_DEPENDENCIES = Object.freeze({
  buildGeometryRoute: buildGeometryAuthorityRoute,
  resolveSectionAwareBends: resolvePipelineSectionAwareBends,
  resolvePropertySectionPlan: resolvePipelinePropertySectionPlan,
  resolvePropertyReseedPlan: resolvePipelineAnalysisPropertyReseedPlan,
  resolveDiameterPlan: resolvePipelineAnalysisDiameterPlan,
  resolveNormalFittingPlan: resolvePipelineNormalFittingPlan,
  resolveB314RadiusPlan: resolvePipelineB314RadiusPlan,
  resolveGreVendorSeriesPlan: resolvePipelineGreVendorSeriesPlan,
  buildInputXmlDocumentPlan: buildExplicitPipelineInputXmlDocumentPlan,
  buildInputXmlXml: buildInputXmlPipingModelXml,
});

export function buildPipelineCoreRuntimeDependencies(input = {},
  dependencies = PIPELINE_CORE_RUNTIME_DEPENDENCIES) {
  const baseBuilder = dependencies.buildInputXmlDocumentPlan;
  return Object.freeze({
    ...dependencies,
    buildInputXmlDocumentPlan: (documentInput) => baseBuilder(
      withPipelineApprovedCatalogProductionInputs(documentInput, input)),
  });
}

export function buildPipelineCoreOutputs(input = {}) {
  const geometry = adoptGreBendGeometry(
    buildPipelineCoreOrchestration(input, buildPipelineCoreRuntimeDependencies(input)), input);
  return adoptGreBendMaterialization(geometry, input);
}
