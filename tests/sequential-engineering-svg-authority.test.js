import assert from 'node:assert/strict';
import { sequentialSessionFingerprint } from '../tabs/sequential-sketcher/construction/sequential-session-fingerprint.js';
import { classifySequentialEngineeringSvgAuthority } from '../tabs/sequential-sketcher/sequential-engineering-svg-authority.js';
import {
  adapterState,
  blockedSequentialFixture,
  confirmedSupportSequentialFixture,
  rejectedSequentialFixture,
} from './helpers/sequential-engineering-svg-fixture.js';

function json(value) { return JSON.stringify(value); }

const blocked = blockedSequentialFixture();
const beforeSession = json(blocked.session);
const beforeEvidence = json(blocked.evidenceModel);
const authority = classifySequentialEngineeringSvgAuthority(adapterState(blocked));

assert.equal(authority.schema, 'SequentialEngineeringSvgAuthority.v1');
assert.equal(authority.state, 'USER_DECISION_REQUIRED');
assert.equal(authority.confirmedComponents.length, 1);
assert(authority.candidates.length >= 2);
assert.equal(authority.activePort.portId, blocked.session.activeExitPortId);
assert.deepEqual(authority.activePort.resolvedPosition, blocked.indexes.ports.get(blocked.session.activeExitPortId).sourcePosition);
assert.equal(authority.revision.value.sessionFingerprint, sequentialSessionFingerprint(blocked.session));
assert.equal(authority.revision.value.confirmedConstructionFingerprint, null);
assert.equal(json(blocked.session), beforeSession, 'authority audit must not mutate construction');
assert.equal(json(blocked.evidenceModel), beforeEvidence, 'authority audit must not mutate source evidence');

const replay = classifySequentialEngineeringSvgAuthority(adapterState(blockedSequentialFixture()));
assert.deepEqual(authority.candidates.map((row) => row.candidateId), replay.candidates.map((row) => row.candidateId));
assert(authority.candidates.every((row) => row.candidateId.startsWith('CAND-')));
assert(authority.candidates.every((row) => row.fromPosition && row.toPosition));

const rejected = rejectedSequentialFixture();
const rejectedAuthority = classifySequentialEngineeringSvgAuthority(adapterState(rejected));
assert.deepEqual(rejectedAuthority.session.rejectedCandidateIds, [rejected.rejectedCandidate.candidateId]);
assert.equal(rejectedAuthority.rejectedCandidates.length, 1);
assert.equal(rejectedAuthority.rejectedCandidates[0].candidateId, rejected.rejectedCandidate.candidateId);
assert.equal(rejectedAuthority.rejectedCandidates[0].decision.resolution.action, 'REJECT_CANDIDATE');
assert.equal(rejectedAuthority.rejectedCandidateIdsMissingEvidence.length, 0);

const accepted = confirmedSupportSequentialFixture();
const acceptedAuthority = classifySequentialEngineeringSvgAuthority(adapterState(accepted));
assert.equal(acceptedAuthority.confirmedConstructionFingerprint, accepted.confirmedConstruction.constructionFingerprint);
assert.equal(acceptedAuthority.supportConstructionFingerprint, accepted.confirmedConstruction.constructionFingerprint);
assert.equal(acceptedAuthority.supports.length, 1);
assert.equal(acceptedAuthority.supports[0].glyph.carrierId, accepted.confirmedConstruction.components[0].componentId);
assert.deepEqual(acceptedAuthority.supports[0].glyph.centerlinePointGlobal, { x: 250, y: 0, z: 0 });
assert(acceptedAuthority.architecturalOmissions.some((row) => row.category === 'network'));
assert(acceptedAuthority.architecturalOmissions.some((row) => row.category === 'restraint'));
assert(acceptedAuthority.architecturalOmissions.some((row) => row.category === 'analyticalSupportAttachment'));

assert.throws(() => classifySequentialEngineeringSvgAuthority({
  ...adapterState(accepted),
  supportProjection: { ...accepted.supportProjection, constructionFingerprint: 'stale' },
}), /not fingerprint-matched/);

console.log('Sequential engineering SVG authority audit: ok');
