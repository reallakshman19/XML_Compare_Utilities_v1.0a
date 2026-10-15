# PR1250 work report — retained Writer2 session persistence

## Mission

Implement Slice 8 for #1239 after audit: preserve the important retained Writer2 review session across reinspection / close+reopen without persisting CII bytes or allowing restored state to become matching / mutation authority.

## Stack / live basis

- Issue: `reallaksh19/XML_Compare_Utilities#1239`
- Base dependency: draft PR #1249 / branch `fix/cii-writer2-blocker-causality-1239`
- Stack base SHA: `b13da2c55d998ce25705677f93b9d93648bde6a1`
- Branch: `fix/cii-writer2-session-persistence-1239`
- PR: #1250
- Merge authority: OWNER_ONLY / NOT_GRANTED

## Audit-first findings

1. Important retained Writer2 state is held in the retained Writer2 state owner:
   - `selectedBySource`;
   - `manualBySource`;
   - `manualDraftBySource`;
   - `reviewDecisions`;
   - review filter state;
   - bound-scope intent.
2. Reinspection clears the in-memory state and previously lost the user session.
3. Persisting raw CII bytes, geometry, correspondence rows, transfer plans or Writer output is unnecessary and unsafe.
4. Anchor/session state can be keyed by exact `sourceSetSha256 + originalTargetSha256` custody.
5. Review decisions need a second fail-closed gate: the rebuilt `correspondenceIdentity` must match exactly and the correspondence ID must still exist.
6. Automatic selection keys can become stale across implementation changes and therefore must be revalidated against the current inspected suggestions.
7. A bound Writer2 scope must never be restored as authority. Only a non-authoritative `BOUND_EXPECTED_NODENAME` intent marker may survive; the exact scope must be rebound from the rebuilt preview.
8. Browser storage discovery/read/write can fail or throw and therefore must fail closed without breaking Writer2.

## Overlap / anti-duplication audit

A concurrent implementation on this branch introduced a separate DOM-driven persistence shell that replayed existing UI controls. That overlapped the retained Writer2 state owner and would have produced two restorers / two localStorage writers.

Disposition:
- the duplicate DOM runtime shell was removed;
- its next-step-shell mount was fully reverted to the exact #1249 base bytes;
- the useful close/reopen browser falsifier was retained;
- persistence is now owned only by the retained Writer2 state owner, which already owns the authoritative in-memory Maps and preview identity.

This removes DOM-as-state-authority and prevents double restore / double write behavior.

## Architecture

### Pure persistence model

`tabs/cii-workspace/cii-workspace-multisource-session-persistence.js`

Schema:
`CIIWorkspaceWriter2Session.v1`

Key:
`cii-writer2-session-v1:<sourceSetSha256>:<originalTargetSha256>`

Persisted data only:
- qualified automatic selection keys by SOURCE;
- exact reviewed/manual anchor pairs by SOURCE;
- manual editor drafts;
- review filters (`confidence`, bounded search text, changed-only);
- correspondence identity;
- normalized review decisions (`LOCK|ACCEPT|REJECT`);
- advisory scope intent (`BOUND_EXPECTED_NODENAME`) only.

Explicitly not persisted:
- SOURCE / TARGET CII bytes;
- parsed documents;
- geometry or matching candidates;
- correspondence rows as identity authority;
- transfer plans;
- bound scope objects / operation selections;
- Writer output or modified TARGET bytes.

Fail-closed rules:
- custody mismatch => no restore;
- corrupt JSON => no restore;
- browser storage unavailable / quota failure => Writer2 continues without persistence;
- stale automatic selection keys are discarded and reported;
- manual authority suppresses automatic authority for the same SOURCE;
- correspondence identity mismatch => no saved review decision restore;
- missing correspondence ID => saved decision dropped;
- unknown filter / scope-intent token => normalized to safe defaults / null.

### Retained Writer2 state-owner integration

`tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js`

The state owner itself performs persistence because it owns the Maps and preview identity. No external persistence layer writes private state.

Restore sequence:
1. inspect exact retained source/target custody;
2. compute persistence custody from the real inspection;
3. load the exact hash-bound session;
4. revalidate automatic selection keys against current qualified suggestions;
5. restore manual authority / drafts / filters;
6. rebuild correspondence normally;
7. restore review decisions only when the rebuilt `correspondenceIdentity` matches exactly;
8. compute pending review state from the normal review model;
9. never auto-bind a previous Writer2 scope; prior scope intent is advisory text only.

Invalidation rules:
- changing anchor authority invalidates persisted correspondence decisions and scope intent;
- editing a manual draft alone does not invalidate a still-valid saved review;
- changing a review decision or bulk acceptance persists the current exact correspondence identity;
- filters persist independently;
- applying review decisions persists the newly authoritative review baseline;
- binding exact Writer2 scope records advisory intent only.

Generic review-only mode is not changed by this slice.

## Files in the stacked diff

1. `tabs/cii-workspace/cii-workspace-multisource-session-persistence.js`
2. `tabs/cii-workspace/cii-workspace-multisource-writer2-ui.js`
3. `tests/cii-workspace-multisource-session-persistence.test.js`
4. `tests/browser/cii-writer2-multisource-session-persistence.spec.mjs`
5. `tests/browser/cii-writer2-session-persistence.spec.mjs`
6. `agents/PR1250_workreport.md`

No next-step/navigation shell remains changed relative to #1249.

## Falsifiers / tests authored

### Deterministic persistence contract

- custody key requires source-set + original target hashes;
- wrong target custody cannot restore;
- corrupt JSON returns no session;
- blocked browser storage returns no storage instead of breaking Writer2;
- storage write failure is a no-op failure, not a Writer2 blocker;
- manual pairs restore duplicate-safe;
- manual authority suppresses automatic selection;
- stale automatic selection keys are explicit and remain non-authoritative;
- invalid review decisions are dropped;
- correspondence-identity mismatch drops saved review decisions;
- missing correspondence IDs are dropped;
- filter values are normalized and search text is bounded;
- unknown scope intent cannot become restored authority.

### Retained close/reopen browser lifecycle

- inspect exact S1/S2/S3/T;
- lock S1 `3910 ↔ 875` via the real manual editor;
- build correspondence;
- set a real pending ACCEPT decision;
- close Writer2;
- reopen, reselect exact retained files and inspect;
- confirm S1 manual authority restored and automatic S1 authority suppressed;
- rebuild correspondence;
- confirm the same correspondence decision restores only after exact correspondence rebuild;
- confirm localStorage contains schema state only.

### Retained full-page reload + filter lifecycle

- build retained S1/S2/S3/T correspondence;
- set a pending S1 REJECT decision;
- persist review search/filter state;
- reload the page;
- reselect / re-inspect exact retained custody;
- confirm hash-bound session recovery;
- rebuild correspondence;
- confirm the S1 decision restores as pending only at exact correspondence identity;
- confirm Apply-to-Transfer-Preview remains required.

## Protected invariants

- no CII bytes persisted;
- no correspondence matching change;
- no anchor qualification / propagation change;
- no second persistence runtime / no DOM state authority;
- no Writer mutation authority change;
- no transfer-scope binding contract change;
- no automatic restoration of bound Writer2 scope;
- no benchmark / geometry / Method-A change;
- generic review-only route unchanged;
- stale custody / selection / correspondence data fails closed;
- owner-only merge remains in force.

## Validation truth

- architecture/source audit: PASS;
- overlapping-runtime audit: FAIL FOUND -> FIXED by removing duplicate DOM persistence shell;
- stacked diff scope: PASS — six files only;
- deterministic session-persistence test: AUTHORED / NOT_RUN in connector-only execution context;
- retained close/reopen browser lifecycle: AUTHORED / NOT_RUN;
- retained reload/filter browser lifecycle: AUTHORED / NOT_RUN;
- retained automatic S1/S2/S3 benchmark on this exact head: NOT_RUN;
- V11/V14 output qualification on this exact head: NOT_RUN;
- exact-head provider status/workflow evidence: pending final-head query;
- merge: NOT AUTHORIZED.

## MATERIAL_FRONTIER

Retained Writer2 session persistence only.

## SEMANTIC_EVIDENCE_FRONTIER

Persistence can recover prior user/session intent only under exact custody and exact rebuilt correspondence identity. It never creates matching authority, review authority, transfer-scope authority or Writer mutation authority.

## EXACT_NEXT_ACTION

1. query the final exact branch / PR head;
2. query commit statuses and PR workflow runs for that head;
3. reconcile PR #1250 description to this report;
4. publish exact-head TASK_EVIDENCE on #1239;
5. proceed only to final stack qualification / reconciliation; do not merge and do not invent executable PASS evidence.
