import { PS_TYPICAL_V1_PROVISIONAL } from './support-report-typicality.js?v=20260911-support-report-typicality-rca-3';

export const SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL = deepFreeze({
  ...PS_TYPICAL_V1_PROVISIONAL,
  profileId: 'PS_TYPICAL_V1_PROVISIONAL',
  pipingLocation: {
    requireCompatiblePipeClass: true,
    geometryFingerprintToleranceMm: 50,
    ambiguityCostTolerance: 0.001,
    assignmentWeights: {
      supportTypeMember: 100000,
      memberMultiplicity: 10000,
      geometryMedianMm: 1,
      geometryMaxMm: 1,
    },
    structuredSequence: {
      linearityToleranceMm: 50,
      planarityToleranceMm: 50,
      geometry3dToleranceMm: 50,
      geometry2dToleranceMm: 50,
      stationFingerprintToleranceMm: 50,
      enforceMonotonic1D: true,
      evaluateReverse1D: true,
      refinementWeights: {
        geometry2dResidual: 1,
        station1dResidual: 1,
      },
      evidenceWeights: {
        memberOrdinalPattern: 1000,
        prevNamePattern: 100,
      },
      memberPatternScores: {
        exact: 1,
        partial: 0.4,
        none: 0,
      },
      prevNamePatternScores: {
        exact: 1,
        onePositionDifferent: 0.9,
        sameTrailing4: 0.8,
        sameTrailing3: 0.65,
        sameTrailing2: 0.45,
        sameTrailing1: 0.2,
        prefixOnly: 0.1,
        none: 0,
      },
    },
  },
});

export const SUPPORT_REPORT_TYPICALITY_UI_SETTINGS = deepFreeze([
  {
    section: 'Structural gates',
    path: 'structural.geometryEnvelopeToleranceMm',
    label: 'Envelope tolerance', type: 'number', unit: 'mm', min: 0, step: 1,
    help: 'Hard family-level geometry gate. Maximum allowed difference between bounding-envelope spans derived from canonical physical-location representatives. Default 25 mm. Lower values reject more aggressively.',
  },
  {
    section: 'Structural gates',
    path: 'structural.pairDistanceMedianToleranceMm',
    label: 'Pair-distance median tolerance', type: 'number', unit: 'mm', min: 0, step: 1,
    help: 'Hard family-level geometry gate. Median residual allowed between translation/rotation/order-invariant pair-distance spectra of canonical physical-location representatives. Default 10 mm.',
  },
  {
    section: 'Structural gates',
    path: 'structural.pairDistanceP95ToleranceMm',
    label: 'Pair-distance P95 tolerance', type: 'number', unit: 'mm', min: 0, step: 1,
    help: 'Advisory family-level diagnostic on canonical physical-location pair-distance spectra. Default 25 mm. Exceeding P95 is reported in the audit but does not reject a structurally eligible family by itself; median and maximum remain hard pair-distance gates.',
  },
  {
    section: 'Structural gates',
    path: 'structural.pairDistanceMaxToleranceMm',
    label: 'Pair-distance maximum tolerance', type: 'number', unit: 'mm', min: 0, step: 1,
    help: 'Hard family-level geometry gate. Largest allowed residual between canonical physical-location pair-distance spectra. Default 50 mm.',
  },
  {
    section: 'Location gates',
    path: 'pipingLocation.requireCompatiblePipeClass',
    label: 'Require compatible pipe class', type: 'checkbox',
    help: 'Hard candidate gate. When enabled, two physical support locations cannot be paired unless their normalized pipe classes match. Enabled by default.',
  },
  {
    section: 'Location gates',
    path: 'pipingLocation.geometryFingerprintToleranceMm',
    label: 'Location fingerprint tolerance', type: 'number', unit: 'mm', min: 0, step: 1,
    help: 'Location-level 3D neighbour-distance tolerance used by the existing arrangement gate. Default 50 mm. A candidate outside this tolerance remains visible for audit but is classified PARTIAL.',
  },
  {
    section: 'Ambiguity',
    path: 'pipingLocation.ambiguityCostTolerance',
    label: 'Alternate-assignment ambiguity margin', type: 'number', min: 0, step: 0.001,
    help: 'If another complete assignment is within this total-cost margin of the optimum, correspondence is treated as unresolved unless lower-dimensional structured-sequence evidence resolves it. Default 0.001 cost units.',
  },
  {
    section: 'Assignment weights',
    path: 'pipingLocation.assignmentWeights.supportTypeMember',
    label: 'SUPPORT TYPE difference weight', type: 'number', min: 0, step: 1000,
    help: 'Dominant engineering penalty for each missing/extra SUPPORT TYPE member. Default 100000. It intentionally outweighs member-name, PREV NAME and small geometry residual evidence.',
  },
  {
    section: 'Assignment weights',
    path: 'pipingLocation.assignmentWeights.memberMultiplicity',
    label: 'Primary-member multiplicity weight', type: 'number', min: 0, step: 1000,
    help: 'Penalty per difference in numeric primary-support member count. Default 10000.',
  },
  {
    section: 'Assignment weights',
    path: 'pipingLocation.assignmentWeights.geometryMedianMm',
    label: '3D geometry median residual weight', type: 'number', min: 0, step: 0.1,
    help: 'Cost multiplier applied to the median 3D neighbour-distance fingerprint residual in millimetres. Default 1.',
  },
  {
    section: 'Assignment weights',
    path: 'pipingLocation.assignmentWeights.geometryMaxMm',
    label: '3D geometry maximum residual weight', type: 'number', min: 0, step: 0.1,
    help: 'Cost multiplier applied to the maximum 3D neighbour-distance fingerprint residual in millimetres. Default 1.',
  },
  {
    section: 'Structured sequence geometry',
    path: 'pipingLocation.structuredSequence.linearityToleranceMm',
    label: '1D row linearity tolerance', type: 'number', unit: 'mm', min: 0, step: 1,
    help: 'Controls when a support family is sufficiently collinear to enable monotonic 1D row matching. Maximum orthogonal residual to the dominant row axis. Default 50 mm.',
  },
  {
    section: 'Structured sequence geometry',
    path: 'pipingLocation.structuredSequence.planarityToleranceMm',
    label: '2D planarity tolerance', type: 'number', unit: 'mm', min: 0, step: 1,
    help: 'Controls when a support family is sufficiently planar to enable 2D lattice refinement. Maximum residual normal to the derived plane. Default 50 mm.',
  },
  {
    section: 'Structured sequence geometry',
    path: 'pipingLocation.structuredSequence.geometry3dToleranceMm',
    label: '3D sequence fingerprint tolerance', type: 'number', unit: 'mm', min: 0, step: 1,
    help: 'Tolerance for structured-sequence 3D neighbour fingerprints. 3D is always evaluated first. Default 50 mm.',
  },
  {
    section: 'Structured sequence geometry',
    path: 'pipingLocation.structuredSequence.geometry2dToleranceMm',
    label: '2D sequence fingerprint tolerance', type: 'number', unit: 'mm', min: 0, step: 1,
    help: 'Tolerance for planar distance fingerprints used only after an unresolved higher-dimensional assignment and only when both families are planar. Default 50 mm.',
  },
  {
    section: 'Structured sequence geometry',
    path: 'pipingLocation.structuredSequence.stationFingerprintToleranceMm',
    label: '1D station fingerprint tolerance', type: 'number', unit: 'mm', min: 0, step: 1,
    help: 'Tolerance for dominant-axis station-spacing fingerprints used to resolve repetitive linear rows. Default 50 mm.',
  },
  {
    section: 'Structured sequence geometry',
    path: 'pipingLocation.structuredSequence.refinementWeights.geometry2dResidual',
    label: '2D refinement residual weight', type: 'number', min: 0, step: 0.1,
    help: 'Tie-break cost multiplier for 2D lattice residual after the 3D/global assignment remains ambiguous. Default 1. It is not added when 3D already yields a unique assignment.',
  },
  {
    section: 'Structured sequence geometry',
    path: 'pipingLocation.structuredSequence.refinementWeights.station1dResidual',
    label: '1D station refinement weight', type: 'number', min: 0, step: 0.1,
    help: 'Tie-break cost multiplier for 1D station-spacing residual in repetitive linear rows. Default 1.',
  },
  {
    section: 'Structured sequence geometry',
    path: 'pipingLocation.structuredSequence.enforceMonotonic1D',
    label: 'Enforce non-crossing 1D sequence', type: 'checkbox',
    help: 'When enabled, linear-row fallback uses monotonic sequence alignment so mappings cannot cross along the row. Enabled by default.',
  },
  {
    section: 'Structured sequence geometry',
    path: 'pipingLocation.structuredSequence.evaluateReverse1D',
    label: 'Evaluate reverse row direction', type: 'checkbox',
    help: 'When enabled, the monotonic 1D solver evaluates both forward and reversed reference-row orientation. Enabled by default.',
  },
  {
    section: 'Member-pattern evidence',
    path: 'pipingLocation.structuredSequence.evidenceWeights.memberOrdinalPattern',
    label: 'Repeated member suffix weight', type: 'number', min: 0, step: 100,
    help: 'Supporting/tie-break penalty weight for patterns such as .2/.4 repeating across the two XMLs. Default 1000. It is intentionally far below SUPPORT TYPE and does not establish physical identity.',
  },
  {
    section: 'Member-pattern evidence',
    path: 'pipingLocation.structuredSequence.memberPatternScores.exact',
    label: 'Exact suffix-pattern score', type: 'number', min: 0, max: 1, step: 0.05,
    help: 'Similarity assigned when sorted numeric member suffix multisets match exactly, e.g. [.2,.4] vs [.2,.4]. Default 1.0.',
  },
  {
    section: 'Member-pattern evidence',
    path: 'pipingLocation.structuredSequence.memberPatternScores.partial',
    label: 'Partial suffix-pattern score', type: 'number', min: 0, max: 1, step: 0.05,
    help: 'Maximum similarity for partial suffix overlap; multiplied by the overlap ratio. Default 0.4.',
  },
  {
    section: 'PREV NAME fuzzy evidence',
    path: 'pipingLocation.structuredSequence.evidenceWeights.prevNamePattern',
    label: 'PREV NAME pattern weight', type: 'number', min: 0, step: 10,
    help: 'Low-authority tie-break weight for PREV NAME similarity. Default 100. It cannot override the much larger SUPPORT TYPE penalty.',
  },
  {
    section: 'PREV NAME fuzzy evidence',
    path: 'pipingLocation.structuredSequence.prevNamePatternScores.exact',
    label: 'Exact PREV NAME score', type: 'number', min: 0, max: 1, step: 0.05,
    help: 'Similarity for exact normalized PREV NAME equality. Default 1.0.',
  },
  {
    section: 'PREV NAME fuzzy evidence',
    path: 'pipingLocation.structuredSequence.prevNamePatternScores.onePositionDifferent',
    label: 'One-position-different score', type: 'number', min: 0, max: 1, step: 0.05,
    help: 'Similarity when equal-length PREV NAME values differ at exactly one character position, e.g. PS02005 vs PS02015. Default 0.9.',
  },
  {
    section: 'PREV NAME fuzzy evidence',
    path: 'pipingLocation.structuredSequence.prevNamePatternScores.sameTrailing4',
    label: 'Same trailing 4 score', type: 'number', min: 0, max: 1, step: 0.05,
    help: 'Similarity when the final four normalized characters match. Default 0.8.',
  },
  {
    section: 'PREV NAME fuzzy evidence',
    path: 'pipingLocation.structuredSequence.prevNamePatternScores.sameTrailing3',
    label: 'Same trailing 3 score', type: 'number', min: 0, max: 1, step: 0.05,
    help: 'Similarity when the final three normalized characters match. Default 0.65.',
  },
  {
    section: 'PREV NAME fuzzy evidence',
    path: 'pipingLocation.structuredSequence.prevNamePatternScores.sameTrailing2',
    label: 'Same trailing 2 score', type: 'number', min: 0, max: 1, step: 0.05,
    help: 'Similarity when the final two normalized characters match. Default 0.45.',
  },
  {
    section: 'PREV NAME fuzzy evidence',
    path: 'pipingLocation.structuredSequence.prevNamePatternScores.sameTrailing1',
    label: 'Same trailing 1 score', type: 'number', min: 0, max: 1, step: 0.05,
    help: 'Very weak similarity when only the final normalized character matches. Default 0.2.',
  },
  {
    section: 'PREV NAME fuzzy evidence',
    path: 'pipingLocation.structuredSequence.prevNamePatternScores.prefixOnly',
    label: 'Prefix-only score', type: 'number', min: 0, max: 1, step: 0.05,
    help: 'Very weak similarity when only the alphabetic prefix matches. Default 0.1.',
  },
]);

export const SUPPORT_REPORT_TYPICALITY_FIXED_POLICIES = deepFreeze([
  {
    label: 'Dimensional resolution order', value: '3D → 2D → 1D',
    help: 'Active structured-sequence policy. Solve with full 3D/global evidence first. Only if correspondence remains ambiguous may planar 2D evidence refine it, followed by monotonic 1D row alignment. Lower dimensions never override a unique higher-dimensional solution.',
  },
  {
    label: 'SUPPORT TYPE authority', value: 'Dominant arrangement evidence',
    help: 'SUPPORT TYPE is intentionally given more assignment influence than member-name, PREV NAME and small geometric residuals. It is compared as an order-independent, duplicate-sensitive multiset and is never fabricated when missing.',
  },
  {
    label: 'Repeated member suffix evidence', value: 'Supporting weight only',
    help: 'Exact repeated patterns such as .2/.4 are supporting/tie-break evidence. Member suffixes are not physical identity and can never make an otherwise ineligible pair eligible.',
  },
  {
    label: 'PREV NAME fuzzy evidence', value: 'Tie-break only',
    help: 'Pattern/fuzzy similarity is lower-authority evidence. The audit retains the normalized pair, fuzzy class and wildcard mask. It cannot override pipe-class eligibility or SUPPORT TYPE engineering evidence.',
  },
  {
    label: 'Solver unmatched sentinel', value: '1,000,000,000 cost units',
    help: 'Fixed internal safety sentinel, not an engineering tuning parameter. A real candidate must be cheaper than this value to beat an explicit unmatched assignment. It is intentionally far above normal weighted residual costs.',
  },
  {
    label: 'Solver ineligible sentinel', value: '1,000,000,000,000 cost units',
    help: 'Fixed internal safety sentinel, not an engineering tuning parameter. Ineligible pairs are priced far above unmatched pairs so a square assignment matrix can never force an incompatible real match merely because row counts are equal.',
  },
  {
    label: 'Row order', value: 'Never used as identity',
    help: 'CSV/report/XML row ordinal is not a correspondence key. Assignment is based on engineering evidence and global structural consistency.',
  },
]);

export function mergeSupportReportTypicalityProfile(override = {}) {
  const base = SUPPORT_REPORT_TYPICALITY_PROFILE_V1_PROVISIONAL;
  return deepFreeze({
    ...base,
    ...override,
    profileId: override.profileId || base.profileId,
    structural: {
      ...base.structural,
      ...(override.structural || {}),
    },
    pipingLocation: {
      ...base.pipingLocation,
      ...(override.pipingLocation || {}),
      assignmentWeights: {
        ...base.pipingLocation.assignmentWeights,
        ...(override.pipingLocation?.assignmentWeights || {}),
      },
      structuredSequence: {
        ...base.pipingLocation.structuredSequence,
        ...(override.pipingLocation?.structuredSequence || {}),
        refinementWeights: {
          ...base.pipingLocation.structuredSequence.refinementWeights,
          ...(override.pipingLocation?.structuredSequence?.refinementWeights || {}),
        },
        evidenceWeights: {
          ...base.pipingLocation.structuredSequence.evidenceWeights,
          ...(override.pipingLocation?.structuredSequence?.evidenceWeights || {}),
        },
        memberPatternScores: {
          ...base.pipingLocation.structuredSequence.memberPatternScores,
          ...(override.pipingLocation?.structuredSequence?.memberPatternScores || {}),
        },
        prevNamePatternScores: {
          ...base.pipingLocation.structuredSequence.prevNamePatternScores,
          ...(override.pipingLocation?.structuredSequence?.prevNamePatternScores || {}),
        },
      },
    },
  });
}

export function profileValue(profile, path) {
  return String(path || '').split('.').reduce((value, key) => value?.[key], profile);
}

export function profileOverrideFromEntries(entries = []) {
  const result = {};
  for (const entry of entries) {
    if (!entry?.path) continue;
    setPath(result, entry.path, entry.value);
  }
  return result;
}

function setPath(target, path, value) {
  const keys = String(path).split('.');
  let cursor = target;
  for (let index = 0; index < keys.length - 1; index += 1) {
    const key = keys[index];
    if (!cursor[key] || typeof cursor[key] !== 'object') cursor[key] = {};
    cursor = cursor[key];
  }
  cursor[keys[keys.length - 1]] = value;
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const child of Object.values(value)) deepFreeze(child);
  return value;
}
