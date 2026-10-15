import { freezeJsonValue } from '../../core/engineering-scene/index.js';

export const SEQUENTIAL_ENGINEERING_SVG_PRODUCTION_ADOPTION_DECISION_SCHEMA =
  'SequentialEngineeringSvgProductionAdoptionDecision.v1';

const OWNER_ROWS = [
  ['Source records and indexes', 'Sequential workspace source inspection', 'tabs/sequential-sketcher/source/sequential-evidence-model.js', 'buildSequentialEvidenceModel / indexSequentialEvidence', '218-250', 'Frozen source evidence plus a frozen wrapper containing mutable branch/component/port Maps.', 'tests/sequential-engineering-svg-production-readiness.test.js', 'HIGH', 'Keep live Maps private or publish a separately authorized immutable index projection.'],
  ['Construction session', 'Sequential construction runtime and workspace', 'tabs/sequential-sketcher/construction/sequential-construction-runtime.js', 'advanceConstruction / applyConstructionDecision / runConstructionUntilBlocked', '69-143', 'Only runtime results replace model.session.', 'tests/sequential-construction-engine.test.js', 'HIGH', 'Emit a reasoned owner event after each accepted runtime result.'],
  ['Confirmed construction', 'Sequential acceptance boundary', 'tabs/sequential-sketcher/construction/sequential-construction-acceptance.js', 'createConfirmedSequentialConstruction', '97-176', 'ROUTE_COMPLETE plus accepted evidence creates the fingerprinted projection.', 'tests/sequential-construction-acceptance.test.js', 'HIGH', 'Expose only the accepted object matching the current session.'],
  ['Candidates', 'Connection resolver and open decision request', 'tabs/sequential-sketcher/construction/sequential-connection-resolver.js', 'buildConnectionCandidates / resolveNextConnection', '117-190;236-298', 'Candidate IDs derive from the active and target port IDs.', 'tests/sequential-construction-engine.test.js', 'HIGH', 'Consume currentDecisionRequest candidates; never reconstruct them.'],
  ['Candidate selection', 'Sequential workspace branch snapshot', 'tabs/sequential-sketcher/sequential-sketcher-workspace.js', 'onClick / branchSnapshot', '90-101;331-338', 'selectedCandidateId is preview state persisted per branch.', 'tests/sequential-sketcher-branch-switch-ui.test.js', 'HIGH', 'Keep candidate preview separate from engineering-scene selection.'],
  ['Candidate confirmation and rejection', 'Sequential workspace decision dispatcher', 'tabs/sequential-sketcher/sequential-sketcher-workspace.js', 'decide / onClick', '278-288;339-360', 'Explicit controls dispatch CONNECT, MANUAL_CONNECT, REVERSE and REJECT actions.', 'tests/sequential-supervised-transactions.test.js', 'HIGH', 'Retain all writes outside Shared Engineering SVG.'],
  ['Active exit port', 'SequentialConstructionSession.v1', 'tabs/sequential-sketcher/construction/sequential-session-fingerprint.js', 'sequentialSessionFingerprint', '121-170', 'activeExitPortId participates in the authoritative session fingerprint.', 'tests/sequential-engineering-svg-authority.test.js', 'HIGH', 'Read it from the current session only.'],
  ['Continuity repair', 'Sequential connection resolver and runtime', 'tabs/sequential-sketcher/construction/sequential-connection-resolver.js', 'resolveNextConnection', '236-298', 'Exact and unique repairable evidence controls AUTO_REPAIRED_SMALL_GAP.', 'tests/sequential-construction-tolerance-policy.test.js', 'HIGH', 'Shared SVG may display repair evidence but cannot run repair.'],
  ['Rejected candidates', 'Session rejection ledger plus decision evidence', 'tabs/sequential-sketcher/sequential-engineering-svg-authority.js', 'rejectedCandidateEvidence', '53-65', 'Rejected IDs are reconciled to recorded decision candidates.', 'tests/sequential-engineering-svg-parity.test.js', 'HIGH', 'Preserve rejected evidence in snapshots and scenes.'],
  ['Support projection', 'Confirmed construction support projector', 'tabs/sequential-sketcher/support/sequential-confirmed-support-projection.js', 'buildConfirmedConstructionSupportProjection', '90-139', 'Projection carries the confirmed construction fingerprint.', 'tests/sequential-confirmed-support-projection.test.js', 'HIGH', 'Reject absent or stale support evidence when a projection is supplied.'],
  ['Current projection mode', 'Sequential workspace presentation state', 'tabs/sequential-sketcher/sequential-sketcher-workspace.js', 'model.mode / onClick', '51-62;331-335', 'Projection changes repaint without replacing session state.', 'tests/sequential-engineering-svg-shadow-parity.test.js', 'HIGH', 'Bridge projection as presentation metadata, not a domain revision.'],
  ['Current SVG fit', 'Active renderer', 'tabs/sequential-sketcher/canvas/sequential-construction-svg.js', 'allPlantPoints / renderSequentialConstructionCanvas', '33-42;121-153', 'Existing fit includes confirmed, candidate and support points.', 'tests/sequential-sketcher-ui-static.test.js', 'HIGH', 'Retain renderer-local fit; do not pretend both fit policies are identical.'],
  ['Pointer interaction', 'Sequential workspace delegated click handler', 'tabs/sequential-sketcher/sequential-sketcher-workspace.js', 'onClick', '331-370', 'Clicks select candidates or dispatch supervised actions.', 'tests/sequential-sketcher-ui-static.test.js', 'HIGH', 'Only the existing interaction surface may execute decisions.'],
  ['Keyboard interaction', 'Sequential workspace delegated key handler', 'tabs/sequential-sketcher/sequential-sketcher-workspace.js', 'onKeyDown', '372-381', 'Ctrl/Cmd+Z undoes and Alt+Arrow switches branch.', 'tests/sequential-sketcher-branch-switch-ui.test.js', 'HIGH', 'Do not duplicate these shortcuts on the read-only preview.'],
  ['Inspector', 'Existing construction inspector', 'tabs/sequential-sketcher/canvas/sequential-construction-svg.js', 'renderConstructionInspector', '181-199', 'Inspector owns candidate preview and decision controls.', 'tests/sequential-sketcher-ui-static.test.js', 'HIGH', 'Keep the inspector reachable and decision-authoritative.'],
  ['Branch workspace state', 'Sequential branch workspace registry', 'tabs/sequential-sketcher/sequential-branch-workspace-state.js', 'createSequentialBranchWorkspaceRegistry', '17-92', 'Per-branch snapshots retain session, accepted/support evidence and candidate preview.', 'tests/sequential-sketcher-branch-switch-ui.test.js', 'HIGH', 'Bridge the opened branch snapshot and invalidate unavailable selections.'],
  ['Revision tokens', 'Sequential Engineering SVG authority classifier', 'tabs/sequential-sketcher/sequential-engineering-svg-authority.js', 'classifySequentialEngineeringSvgAuthority', '84-135', 'Revision combines session, accepted construction and support fingerprints.', 'tests/sequential-engineering-svg-authority.test.js', 'HIGH', 'Use this domain revision without a local counter.'],
  ['Renderer teardown', 'Sequential tab, workspace and shadow composition', 'tabs/sequential-sketcher/sequential-sketcher-tab.js', 'installSequentialSketcherTile / close', '26-80', 'Controllers and workspace are destroyed before the overlay is removed.', 'tests/sequential-engineering-svg-shadow-ownership.test.js', 'HIGH', 'Future switching must destroy the inactive renderer and its subscriptions.'],
];

function ownerRow(values) {
  const [concern, owner, file, exportedSymbol, sourceLines, codeFragment,
    provingTest, confidence, adoptionAction] = values;
  return { concern, owner, file, exportedSymbol, sourceLines, codeFragment,
    provingTest, confidence, adoptionAction };
}

const LIFECYCLE = [
  ['workspaceOpen', 'No session until source/branch action.', 1, 'none', 'all cleared', 'open only', 'tab close'],
  ['sourceInspection', 'New evidence and indexes; session cleared.', 1, 'publish source-inspected after bridge exists', 'all cleared', 'inspect source', 'workspace'],
  ['branchOpen', 'Registry snapshot for selected branch.', 1, 'publish branch-opened', 'restore candidate; clear stale scene/review', 'open only', 'workspace'],
  ['constructionAdvance', 'Runtime result replaces session.', 1, 'publish construction-advanced', 'candidate and scene selections reconciled', 'advance/run', 'workspace'],
  ['decisionRequired', 'Open decision request and candidates.', 1, 'publish decision-required', 'candidate preview may survive by ID', 'preview only in shared view', 'workspace'],
  ['decisionApplied', 'Recorded supervised transaction.', 1, 'publish decision-applied', 'clear candidate and stale scene selection', 'existing inspector action only', 'workspace'],
  ['routeComplete', 'Accepted construction becomes available.', 1, 'publish route-complete', 'reconcile to confirmed entities', 'acceptance/support build', 'workspace'],
  ['supportProjectionRefresh', 'Fingerprint-matched support projection.', 1, 'publish support-refreshed', 'drop stale support IDs', 'support projection only', 'workspace'],
  ['branchSwitch', 'Save old and open target registry snapshot.', 1, 'publish branch-opened', 'restore branch candidate; clear other selections', 'branch open only', 'workspace'],
  ['sourceReload', 'All evidence and workspaces replaced.', 1, 'publish source-reloaded', 'clear all', 'source load only', 'workspace'],
  ['viewerSwitch', 'Domain state unchanged.', 1, 'presentation event only', 'explicit mapping or clear', 'no domain mutation', 'viewer switch owner'],
  ['workspaceClose', 'Last owner state remains external only.', 0, 'unsubscribe all', 'clear all', 'close only', 'tab close'],
  ['workspaceRemount', 'Re-read one immutable current snapshot.', 1, 'one subscription', 'restore only valid IDs', 'none', 'viewer switch owner'],
  ['sharedMountFailure', 'Existing domain state unchanged.', 1, 'dispose failed bridge', 'preserve construction selection', 'fallback to existing SVG', 'shared preview owner'],
];

function lifecycleRow(values) {
  const [event, authoritativeDomainState, activeRendererCount, subscriptions,
    selectedIdentities, permittedMutations, disposalOwner] = values;
  return { event, authoritativeDomainState, activeRendererCount, subscriptions,
    selectedIdentities, permittedMutations, disposalOwner };
}

export function createSequentialEngineeringSvgProductionAdoptionDecision(evaluatedMainSha) {
  const sha = String(evaluatedMainSha ?? '').trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new TypeError('evaluatedMainSha must be a 40-character lowercase commit SHA.');
  return freezeJsonValue({
    schema: SEQUENTIAL_ENGINEERING_SVG_PRODUCTION_ADOPTION_DECISION_SCHEMA,
    evaluatedMainSha: sha,
    status: 'REVIEW_REQUIRED',
    recommendedArchitecture: {
      option: 'A',
      id: 'EXISTING_DEFAULT_OPTIONAL_READ_ONLY_PREVIEW',
      defaultRenderer: 'existing-interactive-sequential-svg',
      previewRenderer: 'shared-engineering-svg-read-only',
      visibleSurfaceRule: 'ONE_ACTIVE_VISUAL_SURFACE',
      inspectorRule: 'EXISTING_DECISION_INSPECTOR_REMAINS_REACHABLE_AND_AUTHORITATIVE',
    },
    authoritativeOwners: OWNER_ROWS.map(ownerRow),
    interactionOwnership: [
      { interaction: 'candidate-preview', owner: 'sequential-workspace', mutation: false },
      { interaction: 'candidate-decision', owner: 'sequential-workspace-and-construction-runtime', mutation: true },
      { interaction: 'engineering-scene-selection', owner: 'shared-read-only-shell', mutation: false },
      { interaction: 'review-queue-selection', owner: 'sequential-review-queue-controller', mutation: false, mayOpenBranch: true },
      { interaction: 'projection-and-fit', owner: 'active-renderer', mutation: false },
    ],
    requiredStateBridge: [
      'Publish one immutable snapshot containing session, evidenceModel, matched confirmedConstruction, matched supportProjection, visibleProjection and selection identities.',
      'Keep mutable owner Maps private behind read-only lookups or publish a separately authorized immutable index projection.',
      'Use classifySequentialEngineeringSvgAuthority to validate and derive the revision; never add an adapter-local counter.',
      'Emit reasoned owner events after source inspection/reload, branch open, runtime result, decision application, support refresh, restoration and viewer projection changes.',
      'Return a deterministic unsubscribe function and emit no DOM or global events.',
      'Reject stale confirmed or support evidence and never reconstruct construction, candidates or repair state.',
    ],
    indexBoundary: {
      currentOwnerShape: 'FROZEN_WRAPPER_WITH_MUTABLE_MAPS',
      directMapPublicationAllowed: false,
      allowedFutureDesigns: ['OWNER_PRIVATE_READ_ONLY_LOOKUPS', 'IMMUTABLE_INDEX_PROJECTION'],
      prohibitedOperationsForConsumers: ['set', 'delete', 'clear'],
    },
    selectionContract: {
      constructionCandidateSelection: { identity: 'candidateId', owner: 'sequential-workspace', effect: 'preview-only' },
      engineeringSceneSelection: { identity: 'EngineeringScene entity ID', owner: 'shared-read-only-shell', effect: 'properties-only' },
      reviewQueueSelection: { identity: 'reviewId', owner: 'sequential-review-queue-controller', effect: 'may-open-branch' },
      inspectorSelection: { identity: 'candidateId', owner: 'existing-construction-inspector', effect: 'preview-and-explicit-decision-controls' },
      mappingRule: 'Map candidate scene entities only through domainRef.candidateId; never coordinates, array index or display order.',
      prohibitedSharedClickEffects: ['confirm-candidate', 'reject-candidate', 'advance-construction', 'run-repair', 'select-branch', 'change-active-port'],
    },
    lifecycleContract: LIFECYCLE.map(lifecycleRow),
    accessibilityContract: {
      activeSurfaceCount: 1,
      inactiveSurface: 'hidden-and-non-focusable',
      decisionControls: 'existing inspector remains keyboard reachable',
      focusTransfer: 'restore a stable mapped identity or move focus to the viewer switch control',
      announcements: 'announce viewer mode and shared-mount fallback without changing domain state',
    },
    failureContract: {
      sharedMountFailure: 'Destroy partial shared shell and bridge, keep domain state and existing renderer available.',
      invalidSnapshot: 'Fail closed and keep existing renderer authoritative.',
      staleSupport: 'Reject shared publication; never hide the existing decision surface.',
      selectionMappingFailure: 'Clear only engineering-scene selection and retain construction candidate selection.',
      subscriptionFailure: 'Dispose shared preview and return to the existing renderer.',
      mutableIndexExposure: 'Reject a bridge design that exposes live mutable Maps as immutable owner state.',
    },
    projectionContract: {
      sharedProjectionIsPresentationOnly: true,
      projectionChangesConstructionRevision: false,
      existingFitIncludes: ['confirmed', 'candidates', 'supports'],
      sharedFitIncludes: ['confirmed', 'repairs', 'supports'],
      independentFitStateAllowed: true,
      switchMustNotRerunConstruction: true,
    },
    allowedProductionFiles: [],
    forbiddenProductionFiles: [
      'tabs/sequential-sketcher/construction/**',
      'tabs/sequential-sketcher/continuity/**',
      'tabs/sequential-sketcher/review/**',
      'tabs/sequential-sketcher/support/**',
      'tabs/sequential-sketcher/canvas/sequential-construction-svg.js',
      'tabs/sequential-sketcher/sequential-engineering-svg-adapter.js',
      'tabs/sequential-sketcher/sequential-engineering-svg-scene.js',
      'tabs/sequential-sketcher/sequential-engineering-svg-properties.js',
      'tabs/sequential-sketcher/sequential-engineering-svg-shadow-workspace.js',
      'core/**', 'package.json', 'package-lock.json',
    ],
    blockers: [
      { code: 'PRODUCTION_OWNER_SUBSCRIPTION_MISSING', detail: 'The shipped workspace has getModel() but no immutable, reasoned getState/subscribeState bridge.' },
      { code: 'BACKEND_SELECTION_MAPPING_NOT_IMPLEMENTED', detail: 'Candidate, scene, review and inspector selections are not yet reconciled across viewer switching.' },
      { code: 'CONTINUITY_CANVAS_LIFECYCLE_UNBOUNDED', detail: 'The continuation controller can replace the same canvas with constructed-network SVG without a production viewer-switch contract.' },
      { code: 'PRODUCTION_INDEX_IMMUTABILITY_UNDEFINED', detail: 'indexSequentialEvidence freezes the wrapper but exposes mutable Map instances; the production bridge must keep them private or define an immutable projection.' },
    ],
    reviewItems: [
      { code: 'SEQUENTIAL_PACKAGE_SCRIPT_MISSING', detail: 'package.json has no test:sequential-sketcher script; this gate runs focused tests directly because package changes are forbidden.' },
      { code: 'FIT_POLICY_DIFFERENCE', detail: 'The current renderer fits candidates while Shared Engineering SVG excludes candidates and active port from fit.' },
      { code: 'BRIDGE_FILE_OWNERSHIP_REQUIRED', detail: 'A future Work Pack must authorize the minimum workspace/bridge files before implementation.' },
    ],
    requiredTestsForImplementation: [
      'default existing renderer and explicit optional preview',
      'one active focusable visual surface',
      'reasoned immutable owner events for every domain transition',
      'consumer cannot set, delete or clear owner indexes',
      'candidate ID mapping and no write on shared selection',
      'decision inspector remains reachable in preview mode',
      'branch/source reload selection invalidation',
      'fingerprint-stale support failure and recovery',
      'projection and independent fit-state preservation',
      'constructed-network canvas conflict handling',
      'mount failure fallback and complete listener disposal',
      'Chromium keyboard, pointer, accessibility and lifecycle cases',
      'full repository regressions',
    ],
    proposedNextMission: null,
  });
}
