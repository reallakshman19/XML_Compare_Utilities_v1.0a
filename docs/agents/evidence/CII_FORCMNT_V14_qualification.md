# CII v14 FORCMNT qualification evidence

CHAIN: `CII-FIND-REPLACE-V14`
BASE_MAIN: `9abc191ed3846bece9637722d3a8c6d5be46f4d4`
STATE: `DOCUMENTED_SCHEMA_RETAINED_ORACLE_PENDING`
MUTATION_AUTHORITY: `NONE`

## Purpose

Record the strongest currently available CAESAR II v14 FORCE/FORCMNT authority without promoting unverified structure into CII file mutation authority.

## Established authority

### Element pointer ownership

Hexagon CAESAR II v14 Basic Element Data documents the 15 integer auxiliary pointers carried by each element. Pointer item 6 is the **Force/Moment Auxiliary field**. A zero pointer means no force/moment auxiliary is associated with that element.

The repository's independent v14 merger encodes the same placement in ELEMENT integer row 12:

```text
BEND, RIGID, EXPJT, RESTRANT, DISPLMNT, FORCMNT
```

Therefore the ELEMENT-to-FORCMNT pointer slot is independently established.

### Physical block size

Hexagon CAESAR II v14 Auxiliary Element Data documents each force/moment specification as 55 numeric values written with `(2X, 6G13.6)` across ten physical lines, with **two specifications per force/moment auxiliary block**.

Therefore:

```text
FORCMNT specification = 10 physical rows
FORCMNT auxiliary     = 20 physical rows
```

Repository v14/v11 section-rule authorities independently use 20 rows per FORCMNT block.

### Semantic record schema

Hexagon CAESAR II v14 Forces/Moments export documentation identifies the force/moment relation as:

```text
FORCMNT_PTR
FORCMNT_NUM
NODE_NUM
VECTOR_NUM
FX
FY
FZ
MX
MY
MZ
```

and explicitly joins force/moment records to elements through:

```text
INPUT_BASIC_ELEMENT_DATA.FORCMNT_PTR = INPUT_FORCMNT.FORCMNT_PTR
```

The 55-value neutral specification is structurally consistent with one node identifier plus nine six-component force/moment vectors:

```text
1 + 9 * 6 = 55
```

This arithmetic consistency is supporting evidence only; it is not used as a substitute for a retained neutral-file oracle.

## Falsified authority

`parser/sections/forces.js` models FORCMNT as arbitrary one-line rows:

```text
node fx fy fz mx my mz load_case_index
```

and merges rows by node/magnitude. That reader does not preserve the documented fixed 20-row auxiliary structure and therefore is **not mutation authority** for CII Find & Replace.

No Find & Replace implementation may derive FORCE byte ownership from that parser.

## Missing retained-real gate

No inspected retained `.CII` currently proves all of the following together:

1. CONTROL has nonzero FORCMNT count.
2. At least one ELEMENT has a nonzero item-6 FORCMNT pointer.
3. The pointed 20-row FORCMNT block is physically present.
4. The two 10-row specifications can be mapped to their node/vector payload without ambiguity.
5. Sentinel/unused-spec behavior is observable from real CAESAR II output.
6. Adjacent blocks/elements provide falsifiers for accidental global ownership.

Without that retained-real oracle, the documented schema remains insufficient for mutation authority under this chain's fail-closed standard.

## Current decision

```text
FORCE intake               BLOCKED
FORCE scope resolver       BLOCKED
FORCMNT physical shape     QUALIFIED_DOCUMENTATION
FORCMNT pointer slot       QUALIFIED_DOCUMENTATION
FORCMNT semantic schema    QUALIFIED_DOCUMENTATION
retained-real conformance  NOT_QUALIFIED
FORCE mutation authority   NONE
```

The UI must continue to show FORCE as qualification-pending and the resolver must continue returning zero mutable spans.

## Exact next qualification action

Obtain a retained CAESAR II v14 `.CII` with nonzero FORCMNT and preserve exact bytes. Before enabling any FORCE mutation:

1. verify CONTROL FORCMNT count;
2. resolve every nonzero ELEMENT item-6 pointer;
3. prove `pointer -> 20-row block` identity;
4. decode both 10-row specifications against `NODE_NUM` + nine `FX/FY/FZ/MX/MY/MZ` vectors;
5. characterize unused second-spec sentinel behavior;
6. add retained-real positive and adjacent-negative tests;
7. run preimage/postimage byte-custody validation;
8. only then change FORCE intake/resolver authority.

Until those steps pass, no `NOT_RUN` or documentation-only result is promoted to FORCE PASS.
