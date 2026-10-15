/** Acceptance-time revalidation, recomputation, complete comparison, and publication containment. */
import {
  SEQUENTIAL_COMMAND_REJECTION,
  SEQUENTIAL_PREPARED_COMMAND_SCHEMA,
  createSequentialCommandAcceptance,
  createSequentialPreparedCommand,
  sameSequentialContractValue,
} from './sequential-command-contracts.js';
import { deriveSequentialEditAuthority } from './sequential-edit-authority.js';
import { prepareSequentialCommand } from './sequential-command-preparation.js';

function rejection(prepared, currentAuthority, reasonCode, message, details = {}) {
  return createSequentialCommandAcceptance({
    accepted: false,
    reasonCode,
    message,
    expectedAuthorityId: prepared.expectedAuthority.authorityId,
    currentAuthorityId: currentAuthority?.authorityId || prepared.expectedAuthority.authorityId,
    preparedId: prepared.preparedId,
    publicationState: details.publicationState,
    containmentRequired: details.containmentRequired,
    publication: details.publication,
  });
}
function validPreparedIdentity(prepared) {
  const normalized = createSequentialPreparedCommand({
    envelope: prepared.envelope,
    nativeCommand: prepared.nativeCommand,
    expectedAuthority: prepared.expectedAuthority,
    scope: prepared.scope,
    targets: prepared.targets,
    candidate: prepared.candidate,
  });
  return sameSequentialContractValue(normalized, prepared);
}
function currentState(reader) {
  if (typeof reader !== 'function') throw new TypeError('Sequential acceptance requires readCurrentState().');
  const state = reader();
  if (!state || typeof state !== 'object') throw new TypeError('Sequential current state is unavailable.');
  return state;
}
function completePreparedResultMatches(prepared, recomputed) {
  return sameSequentialContractValue(recomputed.candidate, prepared.candidate)
    && sameSequentialContractValue(recomputed.targets, prepared.targets)
    && sameSequentialContractValue(recomputed.scope, prepared.scope);
}
function publicationEvidenceIsCommitted(publication, prepared, authority) {
  return publication?.schema === 'SequentialCommandPublication.v1'
    && publication.committed === true
    && publication.preparedId === prepared.preparedId
    && publication.expectedAuthorityId === authority.authorityId;
}
function candidateIsPublished(state, candidate) {
  return sameSequentialContractValue(state.session, candidate.session)
    && sameSequentialContractValue(state.confirmedConstruction, candidate.confirmedConstruction)
    && sameSequentialContractValue(state.supportProjection, candidate.supportProjection)
    && sameSequentialContractValue(state.journalState, candidate.journalState)
    && sameSequentialContractValue(state.branchRegistry?.entries?.(), candidate.branchEntries);
}
function classifyPublicationFailure(reader, beforeAuthority, publication = null) {
  try {
    const state = currentState(reader);
    const authority = deriveSequentialEditAuthority(state);
    const unchanged = sameSequentialContractValue(authority, beforeAuthority);
    return Object.freeze({
      currentAuthority: authority,
      publicationState: unchanged ? 'ABORTED' : 'PARTIAL_PUBLICATION',
      containmentRequired: !unchanged,
      publication,
    });
  } catch {
    return Object.freeze({
      currentAuthority: beforeAuthority,
      publicationState: 'PUBLICATION_STATE_UNKNOWN',
      containmentRequired: true,
      publication,
    });
  }
}
function rejectPublicationFailure(input, prepared, beforeAuthority, message, publication = null, code = null) {
  const details = classifyPublicationFailure(input.readCurrentState, beforeAuthority, publication);
  return rejection(
    prepared,
    details.currentAuthority,
    code || SEQUENTIAL_COMMAND_REJECTION.PUBLICATION_FAILED,
    message,
    details,
  );
}
function validatePublishedState(state, authority, prepared, publication) {
  if (!publicationEvidenceIsCommitted(publication, prepared, authority)) {
    return 'Sequential publication evidence does not prove a committed command.';
  }
  if (!candidateIsPublished(state, prepared.candidate)) {
    return 'Published Sequential owner state does not match the complete accepted candidate.';
  }
  const publishedAuthority = deriveSequentialEditAuthority(state);
  if (publishedAuthority.ownerRevisionFingerprint === authority.ownerRevisionFingerprint) {
    return 'Sequential owner revision did not advance with the committed candidate.';
  }
  return null;
}

export function acceptPreparedSequentialCommand(input = {}) {
  const prepared = input.prepared;
  if (prepared?.schema !== SEQUENTIAL_PREPARED_COMMAND_SCHEMA) {
    throw new TypeError(`Sequential prepared command must use ${SEQUENTIAL_PREPARED_COMMAND_SCHEMA}.`);
  }
  const firstState = currentState(input.readCurrentState);
  const firstAuthority = deriveSequentialEditAuthority(firstState);
  if (!validPreparedIdentity(prepared)) {
    return rejection(
      prepared,
      firstAuthority,
      SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_INVALID,
      'Prepared Sequential command identity does not match its complete contents.',
    );
  }
  if (!sameSequentialContractValue(firstAuthority, prepared.expectedAuthority)) {
    return rejection(
      prepared,
      firstAuthority,
      SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_STALE,
      'Prepared Sequential command is stale against current authority.',
    );
  }

  let recomputed;
  try {
    recomputed = prepareSequentialCommand({
      ...firstState,
      envelope: prepared.envelope,
      nativeCommand: prepared.nativeCommand,
      expectedAuthority: firstAuthority,
    });
  } catch (error) {
    return rejection(
      prepared,
      firstAuthority,
      error.code || SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_INVALID,
      error.message || String(error),
    );
  }
  if (!completePreparedResultMatches(prepared, recomputed)) {
    return rejection(
      prepared,
      firstAuthority,
      SEQUENTIAL_COMMAND_REJECTION.COMPLETE_RESULT_MISMATCH,
      'Acceptance recomputation differs from the complete prepared result.',
    );
  }

  const publishState = currentState(input.readCurrentState);
  const publishAuthority = deriveSequentialEditAuthority(publishState);
  if (!sameSequentialContractValue(publishAuthority, firstAuthority)) {
    return rejection(
      prepared,
      publishAuthority,
      SEQUENTIAL_COMMAND_REJECTION.PREPARED_COMMAND_STALE,
      'Sequential authority changed after acceptance recomputation.',
    );
  }
  if (typeof input.publishCandidate !== 'function') {
    throw new TypeError('Sequential acceptance requires publishCandidate().');
  }

  let publication;
  try {
    publication = input.publishCandidate({
      candidate: recomputed.candidate,
      expectedAuthority: publishAuthority,
      preparedId: prepared.preparedId,
      envelope: prepared.envelope,
    });
  } catch (error) {
    return rejectPublicationFailure(
      input,
      prepared,
      publishAuthority,
      error.message || String(error),
      null,
      error.code,
    );
  }
  try {
    const current = currentState(input.readCurrentState);
    const failure = validatePublishedState(current, publishAuthority, recomputed, publication);
    if (failure) return rejectPublicationFailure(input, prepared, publishAuthority, failure, publication);
    const currentAuthority = deriveSequentialEditAuthority(current);
    return createSequentialCommandAcceptance({
      accepted: true,
      message: 'Sequential command accepted and published as one complete candidate.',
      expectedAuthorityId: prepared.expectedAuthority.authorityId,
      currentAuthorityId: currentAuthority.authorityId,
      preparedId: prepared.preparedId,
      publication,
    });
  } catch (error) {
    return rejectPublicationFailure(
      input,
      prepared,
      publishAuthority,
      error.message || String(error),
      publication,
      error.code,
    );
  }
}
