# PR1081 — universal field-aware U2 exact-source execution

PR: `#1081`
Branch: `feature/cii-find-replace-finish-v14`
U2 product material head: `09c7c1aab70fab5d918065d11b557050205b97f0`
Pre-U2 product material head: `4f9e79fc899fd5e89c33267480208e25f8d627da`

## Owner-authorized U2 boundary

The Owner issued `proceed next` from `EP-CII-FR-0021`, whose exact next action was bounded U2 field-aware mutation authority.

U2 changes only:

```text
NEW     tabs/cii-workspace/cii-workspace-find-replace-v14-field-authority.js
NEW     tabs/cii-workspace/cii-workspace-find-replace-v14-field-claims.js
MODIFY  tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js
MODIFY  tabs/cii-workspace/cii-workspace-find-replace-validator.js
MODIFY  tests/cii-workspace-find-replace-scope-resolver.test.js
NEW     tests/cii-workspace-find-replace-v14-field-authority.test.js
```

U2 does not expand UI/CSV intake, does not change Node Name production logic, does not enable FORCE/FORCMNT, and does not change executor/output, Writer1/Writer2, parser/converter, benchmark/oracle, workflow or merge authority.

## Remote Git blob closure

The exact committed branch blobs were re-fetched after promotion and matched the source set used for execution:

```text
cii-workspace-find-replace-v14-field-authority.js   6626346a5d2b98603bd7235ceb24bc5bb0f028cb
cii-workspace-find-replace-v14-field-claims.js      b76cb034dfd6e6c4859c65d87b050d94abe8f896
cii-workspace-find-replace-scope-resolver.js        e5294be666d235c85c69fe97a181db9fbc893fbe
cii-workspace-find-replace-validator.js             ce4c31b01ce522d8d0c39fd0cfafa698328b337a
cii-workspace-find-replace-scope-resolver.test.js   748381089868f80f0be78ce9fefa4ba4af40648f
cii-workspace-find-replace-v14-field-authority.test.js
                                                    4c5e163628335568cb030db9d33b4e4d5c25b143
```

Unchanged executed dependencies were also reconstructed from their authoritative branch blobs, including fixed-field parsing, SHA-256, Node Name scope and the U1 auxiliary authority module.

## Executed validation

```text
node --check tabs/cii-workspace/cii-workspace-find-replace-v14-field-authority.js
node --check tabs/cii-workspace/cii-workspace-find-replace-v14-field-claims.js
node --check tabs/cii-workspace/cii-workspace-find-replace-scope-resolver.js
node --check tabs/cii-workspace/cii-workspace-find-replace-validator.js

node --test \
  tests/cii-workspace-find-replace-validator.test.js \
  tests/cii-workspace-find-replace-scope-resolver.test.js \
  tests/cii-workspace-find-replace-v14-field-authority.test.js
```

Observed:

```text
19 PASS
0 FAIL
0 SKIP
```

## Proven U2 properties

The focused suite proves:

1. Element field-aware mutation protects the selected element's FROM and TO fields.
2. All 15 IEL auxiliary pointer fields are outside Element mutation spans.
3. Element numeric fields and Element Name/Line Number text payloads produce field-bound claims.
4. Length prefixes/control columns for text rows are not writable spans.
5. A numeric replacement is blocked if the complete resulting fixed field no longer parses as finite numeric data.
6. A literal spanning adjacent fixed numeric fields cannot create a claim.
7. Generic auxiliary validation first retains U1 exact element/pointer/CONTROL/cardinality/unique-owner authority.
8. Shared auxiliary pointers remain fail-closed.
9. BEND, RIGID, EXPJT, UNIFORM, WIND, OFFSETS, ALLOWBLS, SIF&TEES, REDUCERS and EQUIPMNT numeric fields produce field-aware claims.
10. RESTRANT length-prefixed Tag text is exposed without its length prefix.
11. FLANGES A40 Class text is exposed while a meaningful blank physical row remains preserved.
12. Existing Displacement behavior remains supported through the shared ownership layer.
13. Existing Node Name routing remains specialized; no Node Name production source was changed.
14. FORCE/FORCMNT remains blocked.
15. line-ending bytes remain outside authorized field spans and line-ending search/replace remains blocked.
16. field-scoped mutation requires ASCII text.
17. default/raw generic auxiliary resolver calls preserve U1 read-only behavior; generic mutation spans are exposed only through the validator's explicit field-aware mutation path.

## Authority basis

The field model follows CAESAR II v14 neutral-file structure already grounded for U0/U1:

- ELEMENTS nine fixed numeric rows followed by Element Name, Line Number, Line Color/Visibility and three IEL pointer rows;
- numeric fields are Fortran-style fixed-width values;
- length-prefixed Element/RESTRANT text payloads keep their length/control columns outside mutation authority;
- FLANGES includes fixed-width A40 text and may contain meaningful blank physical rows.

U2 does not change U1 pointer/cardinality authority.

## Recovery note

The ignored local worklog records that the first mandatory local backups for three reconstructed existing files were behavior-equivalent rather than byte-exact branch preimages. Those backups are not represented as exact restore evidence. The exact old branch Git blob SHAs are recorded in that worklog and remain the recovery authority for those pre-U2 versions.

## Validation truth

```text
U2 exact-source focused field runtime                 PASS 19/19
U1 exact-source focused resolver runtime              PASS 17/17
PR1081 prior exact-source UI/static closure            PASS 10/10
Merged non-benchmark Find & Replace                    PASS 33/33
Merged focused Node Name                               PASS 4/4
SOURCE 3 retained-real authored runtime                NOT_RUN
Full repository suite                                  NOT_RUN
Native-v14 archived fixture runtime                    NOT_RUN
External CAESAR acceptance                             NOT_RUN
```

No `NOT_RUN` state is promoted to PASS.
