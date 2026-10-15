# CII Writer 1C Phase 2A — SIF/TEE Field Qualification

## Final Phase-2A verdict

```text
CANONICAL_V11_VERDICT: READY_FOR_CANONICAL_V11_SELECTED_SIF_FIELDS
SELECTED_POSITIONS: r0f2, r0f3, r5f2, r5f3
SELECTED_FIELDS: In-Plane SIF (ii), Out-Plane SIF (io)
CURRENT_PRODUCT_SIF_WRITER: NOT_IMPLEMENTED
CURRENT_PRODUCT_ENABLED_SIF_POSITIONS: 0
```

`writable=YES` in the qualification map means **approved candidate for a future Phase-2B Writer1C implementation**, not that PR1006 enables mutation.

## Direct Version-11 neutral authority

The canonical benchmark `Benchmark/CIICompare/BM_CII_TARGET1.CII` advertises neutral version `11.0000`.

A vendor-authored CAESAR II User's Guide, Version 2019 (11.0), April 2019, mirrored on PDFCoffee, contains the neutral-file appendix. Under **External Interfaces → CAESAR II Neutral File → Auxiliary Element Data**, page 1187 directly states for `#$ SIF&TEES`:

```text
FORTRAN format        (2X, 6G13.6)
items per tee         30
tees per auxiliary    2
lines per tee         5
lines per auxiliary   10
item 3                In-Plane SIF (ii)
item 4                Out-Plane SIF (io)
```

The same section names items 1 through 26 and leaves the remaining four item meanings unstated. Items 27..30 therefore remain unresolved.

Because six values are written per line, direct fixed-position arithmetic gives:

```text
slot1 item3 -> row0 field2 -> columns [28,41) -> ii
slot1 item4 -> row0 field3 -> columns [41,54) -> io
slot2 item3 -> row5 field2 -> columns [28,41) -> ii
slot2 item4 -> row5 field3 -> columns [41,54) -> io
```

No cross-edition assumption is required for these four canonical V11 positions.

## Version-12 corroboration and edition guard

Official Hexagon Version-12 neutral documentation independently gives the same selected mapping for item3/item4 and the same 30-item / 10-row shape.

Later official documentation demonstrates edition drift:

```text
V11/V12: 30 items per tee, 5 rows per tee, 10 rows total
V14/V15: 42 items per tee, 7 rows per tee, 14 rows total

V11/V12 item15 = Torsion SIF
V11/V12 item16 = Axial SIF
V14/V15 item15 = Axial SIF
V14/V15 item16 = Torsion SIF
```

Therefore Phase2B must still gate on exact neutral edition and block shape; later-edition semantics must never be backported by field number.

## Initial Phase-2B writer domain

Even though the four V11 positions are now semantically qualified, the first production slice must remain narrower:

```text
TARGET preimage        finite explicit >= 1.0
proposed value         finite explicit >= 1.0
Type                   unchanged
piping-code context    unchanged and authoritatively custodied
SIF pointer            existing nonzero and unchanged
SIF block              same physical 10-row block
CONTROL/cardinality    unchanged
zero/blank/9999.99     blocked
```

Why `>=1.0`: the V11 product guide states that user-defined SIFs cannot be less than 1.0.

## Product state remains fail-closed

PR1006 does **not** change production Writer or transfer policy. Existing blockers remain appropriate until a separate Phase2B implementation adds the required mutation authority.

PR1006 adds no:

- `cii-workspace-writer1c-sif.js`;
- SIF Writer policy token;
- raw 10-row payload COPY;
- pointer allocation/reindex;
- CONTROL/cardinality mutation;
- Type/code-context mutation;
- protected converter change;
- workflow change.

## Phase-2B implementation gates still required

1. Runtime neutral-edition and exact 10-row SIF block-shape gate.
2. Authoritative piping-code context custody and unchanged-Type proof.
3. Positive explicit nonzero ii/io transaction fixture; canonical benchmark values are zero and cannot qualify the mutation domain by themselves.
4. Exact byte-span/preimage custody for only the selected 13-byte fields.
5. Shared-pointer/shared-block claim arbitration before mutation.
6. One original TARGET byte stream and one canonical mutation plan.
7. Independently derived `S_auth`; Writer-reported spans remain testimony only.
8. Falsifiers for unauthorized byte drift, pointer drift, row/cardinality drift, edition mismatch, Type/code-context drift and semantic overreach.
9. Reparse proving only intended ii/io semantic deltas.

CREATE/DELETE/reindex and CONTROL/cardinality changes remain Writer2.

## Qualification truth

```text
canonical TARGET1 version header                  PASS_REMOTE_SOURCE_INSPECTION (11.0000)
V11 vendor-authored neutral appendix              PASS_VENDOR_AUTHORED_MIRROR
V11 #$ SIF&TEES shape/item3/item4                 PASS_DIRECT_SOURCE
V11 product ii/io domain                          PASS_DIRECT_SOURCE
V12 selected-position corroboration               PASS
edition-drift falsifier                           PASS
V11/V12 items27..30 meanings                      UNRESOLVED
exact local three-file census                     NOT_RUN
production SIF Writer                             NOT_IMPLEMENTED
```

## Engineering rule

```text
A fixed field is mutation-qualified only when:
physical position + edition + engineering meaning/domain + byte custody + explicit operation authority
are all proven.
```
