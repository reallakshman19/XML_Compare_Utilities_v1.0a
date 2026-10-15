import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

const policy = read('tabs/sequential-sketcher/policy/sequential-external-boundary-policy.js');
assert.match(policy, /SequentialExternalBoundaryPolicy\.v1/);
assert.match(policy, /AVEVA_1885_NC_EXTERNAL_BOUNDARY/);
assert.match(policy, /CONTROLLED_DASH_NOZZLE_REFERENCE/);
assert.match(policy, /CONTROLLED_NAMED_CONNECTION_REFERENCE/);
assert.match(policy, /DIRECTIONAL_EQUIPMENT_PORT/);
assert.match(policy, /EQUIPMENT_REFERENCE_SHAPE/);
assert.match(policy, /EXTERNAL_REFERENCE_CLASSIFIED/);
assert.match(policy, /EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED/);
assert.match(policy, /CONTROLLED_NOZZLE_SUFFIX/);
assert.match(policy, /CONTROLLED_CONNECTION_SUFFIX/);
assert.match(policy, /PHYSICAL_BOUNDARY_ROLE_NOT_PROVEN/);
assert.match(policy, /policyFingerprint/);
assert.match(policy, /validateSequentialExternalBoundaryPolicy/);

const tolerancePolicy = read('tabs/sequential-sketcher/policy/sequential-construction-tolerance-policy.js');
assert.match(tolerancePolicy, /SequentialConstructionTolerancePolicy\.v1/);
assert.match(tolerancePolicy, /branchEndpointMm/);
assert.match(tolerancePolicy, /referenceBoundaryMm/);
assert.match(tolerancePolicy, /fittingPortMm/);
assert.match(tolerancePolicy, /transformNoiseMm/);
assert.match(tolerancePolicy, /maximumMm:\s*25/);
assert.match(tolerancePolicy, /resolveSequentialConstructionTolerances/);
assert.match(tolerancePolicy, /policyFingerprint/);

const classifier = read('tabs/sequential-sketcher/construction/sequential-boundary-reference-classifier.js');
assert.match(classifier, /SEQUENTIAL_EXTERNAL_BOUNDARY_POLICY/);
assert.match(classifier, /matchSequentialExternalBoundaryPolicy/);
assert.match(classifier, /policySchema/);
assert.match(classifier, /policyId/);
assert.match(classifier, /policyRevision/);
assert.match(classifier, /policyFingerprint/);
assert.doesNotMatch(classifier, /new RegExp|EQUIPMENT_REFERENCE_SHAPE|CONTROLLED_NOZZLE_SUFFIX/,
  'classifier must consume the versioned policy rather than own suffix rules');
assert.doesNotMatch(classifier, /substring|includes\([^)]*target|startsWith\([^)]*target/);

const engine = read('tabs/sequential-sketcher/construction/sequential-source-boundary-engine.js');
assert.match(engine, /EXTERNAL_BOUNDARY_ACTIVE_ENDPOINT_MISSING/);
assert.match(engine, /EXTERNAL_BOUNDARY_POSITION_MISSING/);
assert.match(engine, /EXTERNAL_BOUNDARY_POSITION_MISMATCH/);
assert.match(engine, /resolveSequentialConstructionTolerances/);
assert.match(engine, /REFERENCE_BOUNDARY_EQUIVALENCE/);
assert.match(engine, /tolerancePolicyFingerprint/);
assert.match(engine, /SOURCE_PHYSICAL_BOUNDARY_EVIDENCE/);
assert.match(engine, /USER_MANUAL/);
assert.match(engine, /patternId/);
assert.match(engine, /policyFingerprint/);
assert.doesNotMatch(engine, /sj-pipe-support|buildPipeSupportProjectionBundle/);

const boundaryResolver = read('tabs/sequential-sketcher/construction/sequential-boundary-resolver.js');
assert.match(boundaryResolver, /resolveSequentialConstructionTolerances/);
assert.match(boundaryResolver, /referenceBoundaryEquivalenceMm/);
assert.match(boundaryResolver, /branchEndpointEquivalenceMm/);
assert.match(boundaryResolver, /REFERENCE_BOUNDARY_EQUIVALENCE/);
assert.match(boundaryResolver, /BRANCH_ENDPOINT_EQUIVALENCE/);
assert.match(boundaryResolver, /automaticRepairMm/);
assert.doesNotMatch(boundaryResolver, /autoRepairToleranceMm\s*=\s*25/,
  'repair limit must come from the versioned tolerance policy');

const connectionResolver = read('tabs/sequential-sketcher/construction/sequential-connection-resolver.js');
assert.match(connectionResolver, /resolveSequentialConstructionTolerances/);
assert.match(connectionResolver, /FITTING_PORT_EQUIVALENCE/);
assert.match(connectionResolver, /fittingPortMm/);
assert.match(connectionResolver, /transformNoiseMm/);
assert.match(connectionResolver, /automaticRepairMm/);
assert.doesNotMatch(connectionResolver, /exactToleranceMm\s*=\s*1|autoRepairToleranceMm\s*=\s*25/,
  'component connection gates must consume the versioned tolerance policy');

const gatedEngine = read('tabs/sequential-sketcher/construction/sequential-gated-construction-engine.js');
assert.match(gatedEngine, /transformNoiseMm/);
assert.match(gatedEngine, /branchEndpointToleranceMm/);
assert.match(gatedEngine, /referenceBoundaryToleranceMm/);
assert.match(gatedEngine, /tolerancePolicyFingerprint/);
assert.doesNotMatch(gatedEngine, /<=\s*1e-6/,
  'branch-start ambiguity must use transform-noise policy');

const constructionEngine = read('tabs/sequential-sketcher/construction/sequential-construction-engine.js');
assert.match(constructionEngine, /FITTING_PORT_EQUIVALENCE/);
assert.match(constructionEngine, /fittingPortToleranceMm/);
assert.match(constructionEngine, /transformNoiseMm/);
assert.match(constructionEngine, /tolerancePolicyFingerprint/);
assert.doesNotMatch(constructionEngine, /candidate\.gapMm\s*>\s*Number\(options\.exactToleranceMm/,
  'manual repair detection must use fitting-port tolerance');
assert.doesNotMatch(constructionEngine, /<=\s*1e-6/,
  'core branch-start ambiguity must use transform-noise policy');

const transactions = read('tabs/sequential-sketcher/construction/sequential-construction-transactions.js');
assert.match(transactions, /SequentialConstructionTransaction\.v1/);
assert.match(transactions, /beforeSnapshot/);
assert.match(transactions, /afterSnapshot/);
assert.match(transactions, /beforeFingerprint/);
assert.match(transactions, /afterFingerprint/);
assert.match(transactions, /externalBoundaryPolicyFingerprint/);
assert.match(transactions, /tolerancePolicyFingerprint/);
assert.match(transactions, /DECISION_DEFERRED/);
assert.match(transactions, /TRANSACTION_UNDONE/);
assert.doesNotMatch(transactions, /MARK_EXTERNAL_BOUNDARY|MARK_TERMINAL|bulk|acceptAll/i,
  'transaction storage must not introduce acceptance policy or bulk resolution');
assert.doesNotMatch(transactions, /sj-pipe-support|buildPipeSupportProjectionBundle/);

const supervisedActions = read('tabs/sequential-sketcher/construction/sequential-supervised-decision-actions.js');
assert.match(supervisedActions, /MANUAL_EVIDENCE_REQUIRED/);
assert.match(supervisedActions, /MANUAL_PORT_PAIR_NOT_CANDIDATE/);
assert.match(supervisedActions, /approvalProvenance:\s*'USER_MANUAL'/);
assert.match(supervisedActions, /selectedFromPortId/);
assert.match(supervisedActions, /selectedToPortId/);
assert.match(supervisedActions, /resultingConstructionFingerprint/);
assert.match(supervisedActions, /REVERSAL_REFERENCED_HEAD_REQUIRES_REVIEW/);
assert.match(supervisedActions, /SequentialComponentTraversalOverride\.v1/);
assert.match(supervisedActions, /reversibleComponentEntryPorts/);
assert.doesNotMatch(supervisedActions, /candidates\[0\]|acceptAll|autoAccept/i,
  'manual actions must require a selected candidate or explicit reversible entry');
assert.doesNotMatch(supervisedActions, /sj-pipe-support|buildPipeSupportProjectionBundle/);

const runtime = read('tabs/sequential-sketcher/construction/sequential-construction-runtime.js');
assert.match(runtime, /recordSequentialConstructionTransaction/);
assert.match(runtime, /RUN_UNTIL_BLOCKED/);
assert.match(runtime, /UNDO_LAST_TRANSACTION/);
assert.match(runtime, /currentDecisionRequest\?\.state === 'DEFERRED'/);
assert.doesNotMatch(runtime, /sj-pipe-support|buildPipeSupportProjectionBundle/);

const reviewQueue = read('tabs/sequential-sketcher/review/sequential-blocked-review-queue.js');
assert.match(reviewQueue, /SequentialBlockedBranchReviewQueue\.v1/);
assert.match(reviewQueue, /buildSequentialBlockedReviewQueue/);
assert.match(reviewQueue, /refreshSequentialBlockedReviewQueue/);
assert.match(reviewQueue, /filterSequentialBlockedReviewQueue/);
assert.match(reviewQueue, /adjacentSequentialReviewRow/);
assert.match(reviewQueue, /UNRESOLVED/);
assert.match(reviewQueue, /DEFERRED/);
assert.match(reviewQueue, /MANUALLY_RESOLVED/);
assert.match(reviewQueue, /candidateId/);
assert.match(reviewQueue, /fromPortId/);
assert.match(reviewQueue, /toPortId/);
assert.match(reviewQueue, /missingEvidenceClass/);
assert.match(reviewQueue, /expectedContinuationCategory/);
assert.match(reviewQueue, /constructionFingerprint/);
assert.doesNotMatch(reviewQueue, /applyConstructionDecision|DECISION_ACTIONS|acceptAll|bulkAccept/i,
  'review queue analysis must not import decision mutation or bulk-acceptance APIs');
assert.doesNotMatch(reviewQueue, /sj-pipe-support|buildPipeSupportProjectionBundle/);

const reviewExport = read('tabs/sequential-sketcher/review/sequential-review-queue-export.js');
assert.match(reviewExport, /SequentialDecisionRegister\.v1/);
assert.match(reviewExport, /unresolvedRows/);
assert.match(reviewExport, /manualRows/);
assert.match(reviewExport, /candidatePortPairs/);
assert.match(reviewExport, /previousConstructionFingerprint/);
assert.match(reviewExport, /resultingConstructionFingerprint/);
assert.match(reviewExport, /unresolvedCsv/);
assert.match(reviewExport, /manualCsv/);
assert.match(reviewExport, /registerJson/);
assert.doesNotMatch(reviewExport, /applyConstructionDecision|acceptAll|bulkAccept/i);

const reviewController = read('tabs/sequential-sketcher/review/sequential-review-queue-controller.js');
assert.match(reviewController, /data-ssk-review-build/);
assert.match(reviewController, /buildSequentialBlockedReviewQueue/);
assert.match(reviewController, /filterSequentialBlockedReviewQueue/);
assert.match(reviewController, /createSequentialDecisionRegisterExports/);
assert.match(reviewController, /if \(branchRegistry\.get\(snapshot\.branchId\)\) continue/,
  'analysis must preserve existing branch workspaces');
assert.match(reviewController, /options\.openBranch\?\.\(row\.branchId\)/);
assert.doesNotMatch(reviewController, /applyConstructionDecision|DECISION_ACTIONS|acceptAll|bulkAccept/i);
assert.doesNotMatch(reviewController, /sj-pipe-support|buildPipeSupportProjectionBundle/);

const workspaceRegistry = read('tabs/sequential-sketcher/sequential-branch-workspace-state.js');
assert.match(workspaceRegistry, /get\(branchIdValue\)/);
assert.match(workspaceRegistry, /entries\(\)/);

const fingerprint = read('tabs/sequential-sketcher/construction/sequential-session-fingerprint.js');
assert.match(fingerprint, /policySchema/);
assert.match(fingerprint, /policyId/);
assert.match(fingerprint, /policyRevision/);
assert.match(fingerprint, /policyDialect/);
assert.match(fingerprint, /policyFingerprint/);
assert.match(fingerprint, /toleranceEvidenceType/);
assert.match(fingerprint, /tolerancePolicyId/);
assert.match(fingerprint, /tolerancePolicyFingerprint/);
assert.match(fingerprint, /openDecision/);
assert.match(fingerprint, /deferredDecisionIds/);
assert.match(fingerprint, /componentTraversalOverrides/);
assert.match(fingerprint, /approvalProvenance/);

const acceptance = read('tabs/sequential-sketcher/construction/sequential-construction-acceptance.js');
assert.match(acceptance, /EXTERNAL_PHYSICAL_BOUNDARY_CONFIRMED/);
assert.match(acceptance, /POSITION_CONFIRMED/);
assert.match(acceptance, /confidence/);
assert.match(acceptance, /basis/);
assert.match(acceptance, /positionGapMm/);

const adapter = read('tabs/sequential-sketcher/integration/sequential-carrier-evidence-adapter.js');
assert.match(adapter, /ConfirmedSequentialConstruction\.v1/);
assert.match(adapter, /ANALYTICAL_GEOMETRY_COMPLETE/);
assert.match(adapter, /ANALYTICAL_GEOMETRY_PARTIAL/);
assert.match(adapter, /DISPLAY_GEOMETRY_ONLY/);
assert.match(adapter, /MASS_PROPERTIES_COMPLETE/);
assert.match(adapter, /MASS_PROPERTIES_INCOMPLETE/);
assert.match(adapter, /supportProjectionConsumed:\s*false/);
assert.doesNotMatch(adapter, /sequential-construction-runtime|advanceConstruction|applyConstructionDecision/);

console.log('sequential sketcher review correction gates passed');
