# SSK-TS-3H-Q — Browser-qualified supervised command lifecycle

## Control status

```text
Corrective authority: Issue #727
Functional browser implementation: merged PR #706
Implementation merge: 193446815924042d5286a4661d2ca4d25312b0ec
Production changes in PR #706: 0
Wrong-agent normalization PR #711: closed / unmerged / non-authoritative
```

`SSK-TS-3H` belongs exclusively to the exact support-point move draft preview delivered by PR #708. `SSK-TS-3H-Q` is the test-only browser-qualification companion for the existing supervised construction-command lifecycle.

This correction changes only mission naming, browser case labels, and static references. It does not change production commands, targets, controllers, scenes, support movement, markup, CSS, persistence, transactions, journals, construction runtime, browser behavior, fixture behavior, or Playwright admission.

## Qualification boundary

The dedicated fixture imports the production:

```text
createSequentialDraftEditCommandPanel()
projectSequentialReversalCandidates()
```

It supplies deterministic immutable current-state evidence and a recording gateway. The gateway records requests produced by the production panel and returns deterministic prepared and acceptance evidence for browser assertions; it grants no authority.

Primary lifecycle proof uses visible DOM interactions:

```text
select fixture authority
→ fill actor / reason / evidence controls
→ click a supervised command
→ inspect prepared review evidence
→ click Cancel or Accept
```

The browser specification does not directly call panel preparation or acceptance methods and does not invoke a gateway execution path.

## Covered authority classes

### Candidate

Selection alone is non-publishing. Actor, reason, and evidence are mandatory. Prepared evidence retains exact target, issued-time, authority, outcome, prepared-ID, and transaction identities. Cancellation clears prepared evidence without publication.

### Candidate-bound manual connection

The command uses only the indexed port pair already carried by the selected current candidate. No visible free-form port field exists.

### Boundary decision

A zero-candidate boundary fixture proves exact decision identity, decision reason, and certified target evidence.

### Component reversal

The fixture derives the native reversal candidate through `projectSequentialReversalCandidates()` and retains exact decision, candidate, component, entry-port, target, predicted outcome, prepared authority, and transaction evidence.

Selection remains non-publishing. Publication occurs only after a separate visible acceptance action.

## Failure and lifecycle containment

Browser proof covers missing actor, missing reason, missing evidence, stale acceptance, authority refresh, panel closure, single-shot acceptance, and zero publication after cancellation or stale rejection.

Existing SSK-TS-1B browser coverage continues to qualify renderer exit, source reload, contained viewer failure, and controller destruction. Current support-move and support-adjustment safeguards remain unchanged.

## Visible-surface containment

The fixture exposes exactly the existing twelve supervised construction command types and no candidate, component, connection, entry-port, from-port, or to-port authority input.

## Validation status

```text
Source and scope inspection: available
Browser fixture: present
Browser specification: present
Playwright admission: present
Static containment: present
Exact-head Playwright execution: not available in the connector environment
```

No browser, Node, aggregate, or CI pass is claimed without exact-head execution evidence.

## Deferred work

SSK-TS-3H-Q authorizes no new command type, automatic preparation or acceptance, arbitrary component or port selection, geometry or topology editing, default-renderer change, or SVG retirement.
