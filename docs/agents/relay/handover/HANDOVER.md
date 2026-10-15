# V2.5 terminal handover — #1224

## Terminal state

- Lifecycle: `TERMINAL`
- Material authority: `NONE`
- Active EP: none
- Last checkpoint: `CP-CII-W2-NB-R1-V25-0002`
- Roadmap: `ROADMAP-XMLCU-V25-1224@RM-0004`
- Progress basis: `PB-0004`
- Objective: `OBJ-CII-W2-NB-R1-1224`
- Terminal phase/work package: `PH-DELIVERY / WP-DELIVERY-001`
- PR `#1228`: `MERGED`
- Merge commit: `45f2a3ed7bbb186030e141a8313ccc04ddc997cb`
- Issue `#1224`: `CLOSED`

## Delivered product state

The merged implementation provides:

1. injective SOURCE-subgraph mapping into a larger TARGET while preserving missing-source-support and ambiguity fail-closed behavior;
2. Writer1C exact-span same-cardinality NodeName REPLACE without broadening direct Writer2 overwrite authority;
3. mixed Writer1C replacement -> re-intake -> Writer2 structural CREATE/DELETE relocation, with V14 structural projection applied to the replacement postimage;
4. retained known-positive representation of 35 REPLACE + 1 CREATE + 0 DELETE;
5. an independent retained byte oracle that limits changes to expected NodeName fields, required CONTROL.NONAM and independently derived affected ELEMENT pointer fields while checking unrelated bytes and CR/LF preservation.

## Evidence truth

Retained Node execution never ran:

- Actions run `35266182142`: no runner, zero steps.
- Actions run `35266754547`, attempt 1: no runner, zero steps.
- Actions run `35266754547`, attempt 2: no runner, zero steps.
- No byte-faithful checkout was available locally.

Therefore retained S1/S2/S3/T validation remains `NOT_RUN_ENVIRONMENT`; it is not recorded as PASS or FAIL.

Limited local evidence: a standalone Node predicate reproduction of current propagation/M2 logic passed the source-subgraph positive, missing-target-support negative, injectivity, insufficient-frontier and ambiguity cases. Static review confirmed Writer1C/Writer2 subset-scope decomposition and the tightened raw-byte oracle. This does not replace retained execution.

## Governance truth

`EP-CII-W2-NB-R1-V25-0001` required independent DISC/QUAL/TC before product mutation. The owner later instructed the active session to fix/proceed; implementation was performed and the missing certification was never fabricated. That deviation remains explicitly recorded.

The owner then instructed progression after the environment-blocked validation state was disclosed. PR #1228 was marked ready for review and merged under `OWNER_ONLY` authority. Terminal closure is therefore an owner-accepted environment exception, not a technical claim that the retained benchmark passed.

## Follow-up

No material work remains scheduled under issue #1224. If retained execution is required later, reopen it as a new owner-directed follow-up with a functioning runner or byte-faithful checkout and preserve the current merge/evidence history.
