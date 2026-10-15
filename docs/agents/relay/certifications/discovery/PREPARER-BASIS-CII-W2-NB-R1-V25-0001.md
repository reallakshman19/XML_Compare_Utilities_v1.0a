# Preparer discovery basis — EP-CII-W2-NB-R1-V25-0001

Status: NON_CERTIFYING_PREPARER_EVIDENCE
Prepared by: chatgpt:gpt-5.6-sol:v25-preparer-2026-09-17
Route: SERIAL:EP-CII-W2-NB-R1-V25-0001
Roadmap revision: RM-0002
Material source basis: production modules unchanged from main 3ee90ca25368f69d42f44cbe967d5bbc81972f77

This file is supporting evidence only. It is not a DISC receipt, QUAL receipt, takeover certification, or material-write authorization. The QSET preparer cannot independently certify its own qualification.

## Repository-state reconstruction

- `agents/relay/REPO_STATE.yaml` routes to `EP-CII-W2-NB-R1-V25-0001` / `WP-ARCH-001` on `RM-0002`.
- Execution is ACTIVE with `can_continue: true` and `material_authority: READ_ONLY`.
- Production implementation remains unapplied; retained benchmark evidence remains NOT_RUN due pre-runner infrastructure failure.

## DSTEP-03 — first REPLACE-loss boundary

Current production flow is:

1. `createCiiWorkspacePreview()` constructs `rawTransferPlan` with `createCiiTransferPreview(...)`.
2. For Writer2, core replaces the public `transferPlan` with `applyCiiWriter2CompositePlanContract(rawTransferPlan)`.
3. Writer2 NodeName routing reads source/target names. A nonblank source and different nonblank target is rewritten to `action: BLOCKED`, `status: BLOCKED`, blocker `WRITER_2_NODENAME_OVERWRITE_USE_WRITER_1C`, and Writer2 relocation policy authority.
4. `cii-workspace-multisource-preview.js` later aggregates `preview.transferPlan.operations`, not the pre-contract `rawTransferPlan`.
5. Therefore downstream multisource selection/arbitration cannot recover the original Writer1C COPY/REPLACE intent because that intent has already been destructively contracted.

Architecture consequence: do not broaden Writer2 overwrite authority. Preserve a qualified pre-Writer2 NodeName intent/plan for multisource mixed orchestration while keeping the ordinary Writer2 contracted plan unchanged for direct Writer2 callers.

## DSTEP-04 — source-subgraph propagation boundary

`cii-workspace-propagation.js` currently contains three independent full-target-claim assumptions:

1. `frontierAssignment()` blocks when `sourceEdges.length !== targetEdges.length`.
2. A source leaf terminates only when both source and target frontiers are empty, so a source leaf opposite target-only continuation is sent to the equality blocker.
3. Final status adds `TARGET_COMPONENT_NOT_FULLY_CLAIMED` for unmatched target component edges.

The assignment enumerator already maintains a `used` target-index set, so injectivity is independently enforced. The qualified contract is complete injective SOURCE mapping into a TARGET subset: extra TARGET-only edges do not block; any unmatched SOURCE edge, unsupported source candidate, target custody collision, or unresolved equal-quality assignment still fails closed.

## Writer authority contract

- Same-cardinality nonblank NodeName REPLACE remains Writer1C exact-span authority.
- NodeName CREATE/DELETE remains Writer2 relocation/count-pointer authority.
- Direct Writer2 must continue to reject nonblank-to-different-nonblank overwrite.
- The mixed transaction successor must use one original TARGET custody chain: `TARGET0 -> Writer1C REPLACE -> re-intake -> rebind/revalidate structural operations -> Writer2 CREATE/DELETE -> independent byte oracle`.
- Pure REPLACE should not be forced through broad V14 structural projection; structural cardinality changes remain on the existing version bridge.

## Independent byte-oracle contract for successor qualification

The oracle must not import production splice, relocation, or projector helpers.

For pure REPLACE:
- derive the authorized NODENAME physical field span from the fixed-format contract and selected target row;
- require exact preimage bytes before mutation;
- require equal-width/canonical field postimage;
- require every byte outside the authorized span to be identical, including line endings;
- require CONTROL counts and ELEMENT pointers to remain byte-identical.

For CREATE/DELETE:
- derive allowed closure independently from before/after physical layout: affected NODENAME physical rows, CONTROL.NONAM I13 field, and affected ELEMENT NodeName pointer I13 fields;
- validate final count/pointers against final physical postimage, not production metadata;
- require all unrelated sections and bytes outside the independently derived closure to remain byte-identical.

## Required negative/falsifier checks

- Extra TARGET-only branch with unique injective matches for all SOURCE edges: must qualify.
- Missing valid target support for any SOURCE edge: must fail.
- Symmetric/equal assignments without required winner gap: must remain unresolved.
- Direct Writer2 nonblank replacement: must remain blocked with Writer1C-use authority signal.
- Two sources proposing different nonblank values for the same physical target: mixed arbitration must conflict/fail closed.
- Stale Writer1C preimage after TARGET0 changes: apply must fail until re-intake/rebind.

## Certification boundary

Independent candidate must reconstruct these facts from repository state and source, answer QSET `QSET-CII-W2-NB-R1-V25-0001`, obtain independent Q1–Q5 PASS, and publish DISC/QUAL/TC bound to the exact EP digest and live Git basis. This preparer evidence may be used as a navigation aid but must not substitute for independent reconstruction.
