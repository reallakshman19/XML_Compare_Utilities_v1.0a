export const SEQUENTIAL_ENGINEERING_SVG_APPROVED_OMISSIONS = Object.freeze({
  network: 'DERIVED_NETWORK_NOT_TRACEABLE_TO_CONFIRMED_CONSTRUCTION',
  restraint: 'NO_STABLE_SEQUENTIAL_RESTRAINT_DIRECTION_OWNER',
  analyticalSupportAttachment: 'NO_SEQUENTIAL_CONSTRUCTION_FINGERPRINT_BRIDGE',
});

function countUnapprovedOmissions(parity, category) {
  return parity.omissions.filter((row) => row.category === category
    && !Object.hasOwn(SEQUENTIAL_ENGINEERING_SVG_APPROVED_OMISSIONS, category)).length;
}

function assertEmpty(values, label) {
  if (values?.length) {
    throw new Error(`Sequential Engineering SVG parity has ${label}: ${values.join(', ')}.`);
  }
}

function assertMappedCounts(parity) {
  const pairs = [
    ['repair', 'repairCount'],
    ['candidate', 'candidateCount'],
    ['reversalCandidate', 'reversalCandidateCount'],
    ['activePort', 'activePortCount'],
    ['support', 'supportCount'],
    ['rejectedCandidate', 'rejectedCandidateCount'],
  ];
  for (const [category, countKey] of pairs) {
    const mapped = parity.mappedCountByCategory?.[category] ?? 0;
    const omitted = countUnapprovedOmissions(parity, category);
    if (mapped + omitted !== parity[countKey]) {
      throw new Error(`Sequential Engineering SVG ${category} parity is inconsistent.`);
    }
  }
  if (parity.confirmedGeometryCount !== parity.mappedCountByCategory?.confirmed) {
    throw new Error('Sequential Engineering SVG confirmed geometry parity is inconsistent.');
  }
}

function approvedOmissions(parity) {
  return parity.omissions.filter((row) => (
    Object.hasOwn(SEQUENTIAL_ENGINEERING_SVG_APPROVED_OMISSIONS, row.category)
  ));
}

function assertApprovedOmissions(rows) {
  for (const [category, reason] of Object.entries(
    SEQUENTIAL_ENGINEERING_SVG_APPROVED_OMISSIONS,
  )) {
    const matches = rows.filter((row) => row.category === category && row.reason === reason);
    if (matches.length !== 1) {
      throw new Error(`Sequential Engineering SVG must preserve approved omission "${category}".`);
    }
  }
}

export function validateSequentialEngineeringSvgParity(parity) {
  if (parity?.schema !== 'SequentialEngineeringSvgParityReport.v1') {
    throw new TypeError('Sequential Engineering SVG requires SequentialEngineeringSvgParityReport.v1.');
  }
  const approved = approvedOmissions(parity);
  assertApprovedOmissions(approved);
  const unexplained = parity.omissions.filter((row) => !String(row?.category || '').trim()
    || !String(row?.reason || '').trim());
  if (unexplained.length) throw new Error('Sequential Engineering SVG contains an unexplained omission.');
  assertMappedCounts(parity);
  assertEmpty(parity.duplicateIds, 'duplicate entity IDs');
  assertEmpty(parity.invalidGeometry, 'invalid geometry');
  assertEmpty(parity.supportAttachmentsMissingCarrierEvidence, 'supports without carrier evidence');
  if (parity.propertySetCoverage?.eligible !== parity.propertySetCoverage?.mapped) {
    throw new Error('Sequential Engineering SVG property coverage is incomplete.');
  }
  if (parity.revisionConsistency?.supportMatchesConfirmed !== true) {
    throw new Error('Sequential Engineering SVG support evidence is stale.');
  }
  const domainOmissions = parity.omissions.filter((row) => (
    !Object.hasOwn(SEQUENTIAL_ENGINEERING_SVG_APPROVED_OMISSIONS, row.category)
  ));
  return Object.freeze({
    approvedOmissions: Object.freeze(approved),
    domainOmissions: Object.freeze(domainOmissions),
    unexplainedOmissions: Object.freeze(unexplained),
    diagnostics: Object.freeze({
      unresolvedPorts: parity.unresolvedPorts,
      disconnectedConfirmedGeometry: parity.disconnectedConfirmedGeometry,
      candidatesMissingContinuityEvidence: parity.candidatesMissingContinuityEvidence,
    }),
  });
}
