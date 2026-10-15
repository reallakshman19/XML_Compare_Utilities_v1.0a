# 1885 NC Sequential Sketcher evidence results

Pinned source:

```text
reallaksh19/3D_Converters
d5fda9c95fda9bba9b6b05171628ba16778a7667
Benchmarks/1885_NC/1885_NC.json
```

## Controlled physical-boundary rule

A missing reference is first classified diagnostically. It may be automatically accepted only when both semantic and positional evidence are present.

Controlled physical suffixes currently supported:

```text
/A-<six digits>-TP-<number>
/A-<six digits>-T-<number>
/A-<six digits>-NOZZLE-<identifier>
/A-<six digits>/(PURGE_CONNECTION|DRAIN_CONNECTION|VENT_CONNECTION|INLET|OUTLET|NOZZLE-*)
/S-<equipment number>/B/(INLET|OUTLET)
```

Generic equipment-shaped references such as `/A-123456/GENERAL`, `/A-123456/AREA/GROUP`, or `/A-123456-OWNER` are classified as `EXTERNAL_REFERENCE_CLASSIFIED` and remain `USER_DECISION_REQUIRED`.

Automatic confirmation additionally requires:

```text
active endpoint exists
branch head/tail position exists
distance(active endpoint, boundary position) <= exact boundary tolerance
```

Dedicated fail-closed reasons are emitted for missing endpoints, missing boundary positions, and position mismatches.

## Fixture matrix

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Indexed branches | 278 | 278 | 0 |
| Route complete | 82 | 90 | +8 |
| User decision required | 196 | 188 | -8 |
| Runtime failures | 0 | 0 | 0 |
| Automatic repairs | 0 | 0 | 0 |
| Confirmed physical-boundary classifications | 0 | 18 | +18 |
| Resolved support-family projections | 333 | 425 | +92 |
| Unresolved support-family projections | 0 | 0 | 0 |

All 18 fixture classifications have an endpoint-to-boundary gap of `0 mm`. The matrix therefore remains 90/188 after the classifier is narrowed and the position gate is applied.

Post-change blocked reasons:

```text
AMBIGUOUS_BRANCH_START                 6
CONTINUITY_NOT_PROVEN                  1
MULTIPLE_BOUNDARY_REFERENCE_PORTS      5
MULTIPLE_EXACT_CANDIDATES             20
REFERENCE_TARGET_MISSING              15
REFERENCE_TARGET_PORT_UNRESOLVED       3
UNEXPLAINED_TERMINAL                  138
```

Every changed root, controlled dialect, classification ID, position gap, next gate, and accepted fingerprint is pinned in `tests/fixtures/sequential-sketcher/1885-nc-outcome-delta.v1.json`.

## Reference normalization

Normalization remains syntax-only:

- backslash to slash;
- repeated slash collapse;
- root slash insertion;
- uppercase case fold.

Exact raw matches are evaluated before normalized matches. Exact branch/component collisions, duplicate aliases, and normalized collisions block. No substring, suffix-only target lookup, proximity, or deterministic-first resolution is used.

Reference totals remain:

```text
MISSING:MISSING               25
RESOLVED:BRANCH              390
RESOLVED:JUNCTION_COMPONENT  203
```

A physical-boundary classification does not convert an out-of-catalog reference into an in-catalog target.

## Fingerprint evidence

Boundary fingerprints include:

- classification identity and status;
- raw and normalized references;
- dialect;
- confidence;
- evidence basis;
- active port;
- boundary role;
- position status, gap, and tolerance.

Timestamps are excluded.

## Carrier adapter readiness

`SequentialCarrierEvidenceCatalog.v1` is generated only from `ConfirmedSequentialConstruction.v1`. Each carrier exposes:

```text
ANALYTICAL_GEOMETRY_COMPLETE
ANALYTICAL_GEOMETRY_PARTIAL
DISPLAY_GEOMETRY_ONLY

MASS_PROPERTIES_COMPLETE
MASS_PROPERTIES_INCOMPLETE
```

Connectivity acceptance therefore does not imply complete analytical geometry or mass eligibility. Physical mass counting remains disabled unless mass properties are explicitly complete.

## Unchanged constraints

- Strict S-line scope remains 1 complete and 20 blocked.
- Source coordinates remain immutable.
- Automatic repair count remains zero.
- No terminal is inferred from missing candidates.
- No COG or support-reaction calculation is introduced.
- Historical clash XML remains offline validation evidence only.
