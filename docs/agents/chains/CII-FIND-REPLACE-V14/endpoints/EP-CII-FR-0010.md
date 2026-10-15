# EP-CII-FR-0010 — FORCMNT documented schema, retained oracle required

CHAIN_ID: CII-FIND-REPLACE-V14
LEG: PR1073-FORCMNT-QUALIFICATION-EVIDENCE
PR: #1073
BRANCH: `chore/cii-force-qualification-evidence-v14`
BASE_MAIN: `9abc191ed3846bece9637722d3a8c6d5be46f4d4`
STATE: `DOCUMENTED_SCHEMA_RETAINED_ORACLE_PENDING`
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

## Predecessor outcome

The explicit Preview -> Apply-to-new-copy -> Download leg was merged through replacement PR #1072 at merge commit:

```text
9abc191ed3846bece9637722d3a8c6d5be46f4d4
```

PR #1071 remains closed/unmerged only because the connector could not mark a Draft PR ready for review; replacement PR #1072 used the identical guarded head and was merged under explicit owner authority.

## Current qualification result

Documented CAESAR II v14 authority now establishes:

```text
ELEMENT item 6 / row12 slot -> FORCMNT pointer
FORCMNT specification       -> 55 values / 10 rows
FORCMNT auxiliary           -> 2 specs / 20 rows
semantic fields             -> NODE_NUM + vector FX/FY/FZ/MX/MY/MZ
join                         -> element FORCMNT_PTR == force FORCMNT_PTR
```

Independent repository v14 authority agrees on the pointer slot and 20-row physical block count, while explicitly keeping nonzero FORCMNT unqualified.

## Falsifier result

`parser/sections/forces.js` is not acceptable mutation authority. It reads arbitrary one-line node/load rows and collapses rows by magnitude; this conflicts with the documented fixed 20-row neutral-file auxiliary structure.

No Find & Replace code may derive mutable FORCE spans from that parser.

## Retained-real gap

No retained CII inspected in the connected repositories currently proves a nonzero FORCMNT block together with its ELEMENT pointer, exact node/vector payload, unused second-spec behavior, and adjacent ownership falsifiers.

Therefore:

```text
FORCE_INTAKE             = BLOCKED
FORCE_RESOLVER           = BLOCKED
FORCE_MUTABLE_SPANS      = 0
FORCMNT_SCHEMA           = DOCUMENTED
FORCMNT_RETAINED_ORACLE  = NOT_QUALIFIED
FORCE_MUTATION_AUTHORITY = NONE
```

## Protected invariants

- immutable TARGET0;
- byte-custody validation unchanged;
- explicit Apply-to-new-copy gate remains merged behavior;
- direct source overwrite remains disabled;
- Writer1/Writer2 remain outside authority;
- FORCE remains fail-closed;
- no parser/converter/workflow/benchmark/oracle mutation in this leg;
- merge remains owner-only.

## Validation truth

```text
Official v14 schema inspection        PASS_SOURCE_AUTHORITY
Repository pointer/block inspection  PASS_SOURCE_AUTHORITY
One-line parser mutation hypothesis  FALSIFIED
Retained nonzero FORCMNT oracle      NOT_QUALIFIED
Exact-checkout authored suite        NOT_RUN_ENVIRONMENT
Post-merge GitHub workflows          NONE
```

No documentation-only or NOT_RUN evidence is promoted to FORCE PASS.

## Exact next action

Obtain a retained CAESAR II v14 `.CII` with nonzero FORCMNT and preserve exact bytes. Prove, in order:

1. CONTROL FORCMNT count > 0;
2. exact ELEMENT item-6 pointer(s);
3. pointer-to-20-row block identity;
4. both 10-row specification layouts;
5. `NODE_NUM` + nine force/moment vectors;
6. unused specification sentinel behavior;
7. adjacent element/block negative ownership cases;
8. TARGET0-relative preimage and independent postimage validation.

Only then may FORCE intake or resolver mutation authority change.
