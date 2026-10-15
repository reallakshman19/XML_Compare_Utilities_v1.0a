# PR1108 Workreport — CII v14 padded Find recognition + scrollbar refresh

## Delivery container

- PR: `#1108`
- Branch: `fix/ciifr-padded-find-scroll-v14`
- Rebase basis: `main@0245adf3329433009900f446d14faa22c454b6e6`
- Product/test material head before this report: `d77f265dd702673b10479004afd79742f65b5eb2`
- Merge authority: Owner-only; not granted in the current instruction.

## Owner report

The live CII v14 Find & Replace editor showed:

```text
FIXED_WIDTH_LENGTH_MISMATCH:25:6
Row 1: this unequal-length change did not resolve to a qualified CII field.
```

The owner also requested a vertical scrollbar for the editor and asked to rebase first.

## RCA

The current smart fixed-width path correctly trims the qualified NODENAME field's semantic value but, before this patch, compared it against the editor Find text without trimming the editor side.

Therefore a copied physical Node Name such as a 25-byte right-padded field could be a valid qualified NODENAME and still miss smart recognition:

```text
qualified semantic value:  "PS02302.1"
editor/copy Find value:     "PS02302.1               "  (25 bytes)
replacement:                "SL-123"                  (6 bytes)
```

The smart plan returned no match, so the generic fixed-width guard correctly but misleadingly emitted `FIXED_WIDTH_LENGTH_MISMATCH:25:6`.

## Product repair

`tabs/cii-workspace/cii-workspace-find-replace-validator.js`

- preimage blob: `c03b66ac7181c1176b289f6e8c9176d3cdc96f56`
- current product blob: `ad5123cde5a7e3875e504c69cf4109b9dd6bc687`

Changes:

- add `logicalNodeName()` for qualified Node Name semantic matching;
- remove outer fixed-width padding only when a non-empty logical value remains;
- use that logical value both when building NODENAME claims and when selecting smart document NODENAME spans;
- preserve all-space padded Find input as fail-closed instead of treating blank Node Name fields as a wildcard;
- generic DOCUMENT literal matching remains exact;
- numeric smart-field parsing/ambiguity remains unchanged;
- no pointer/cardinality/field-authority widening.

## Vertical scroll / cache repair

The current stylesheet already contains the intended editor viewport:

```text
.ciifr-sheet-wrap
height: clamp(240px, 42vh, 390px)
overflow-y: scroll
scrollbar-gutter: stable
explicit Firefox/WebKit scrollbar styling
```

The live nested asset references were still pinned to September 3 tokens. PR1108 advances both Find & Replace nested assets together:

```text
cii-workspace-find-replace-ui.js?v=20260904-padded-find-scroll-1
cii-workspace-find-replace.css?v=20260904-padded-find-scroll-1
```

`tabs/cii-workspace/cii-workspace-tab.js`

- preimage blob: `5c036256d28f35c6086bada26daddbe2d45dece4`
- current blob: `caf3c0999aeabb42f4af4e3ae02fd6323d7dc6e9`

No workflow file is modified.

## Regression coverage

`tests/cii-workspace-find-replace-smart-fixed-width.test.js`

- preimage: `7ee7aed25b34f1b7d31483992480ef26eb59c3a0`
- current: `58a96c6178c488338b1e7f34bb6fd5d2d974dbf9`

Adds exact coverage for:

1. 25-byte padded `PS02302.1` Find -> 6-byte `SL-123` logical replacement;
2. expected `AUTO_NODENAME_FIXED_WIDTH` smart qualification and equal physical claim widths;
3. no `FIXED_WIDTH_LENGTH_MISMATCH` for that qualified case;
4. all-space 25-byte Find remains blocked with zero claims;
5. prior overflow and unknown-generic fail-closed cases remain.

`tests/cii-workspace-find-replace-scroll-export-ui.test.js`

- preimage: `c3abbd64c0e01cd3278673e757bdee74a3da2429`
- current: `ad396807a2f7137e6c1f50aaf3255c21464d2b7f`

Locks the real vertical-scroll CSS and new nested UI/CSS token.

`tests/cii-workspace-find-replace-export-cache-lineage.test.js`

- preimage: `f6b3b7a72811679daae95a607f49ecd3451f33c2`
- current: `fda58f8797ae268b84f78c1ad2334f69fa788309`

Preserves the existing global Pages/Utilities build contract and updates only the expected nested Find & Replace UI token.

## Validation truth

- branch exact base / rebase: **PASS** — branch created directly from current `main@0245adf3329433009900f446d14faa22c454b6e6`;
- overlap check: **PASS** — no open Find & Replace PR was found before branch creation;
- RCA source inspection: **PASS** — current-main comparison was `span.semanticValue.trim() === findText`, which rejects padded editor Find values;
- vertical-scroll source contract: **PASS / inspection** — current CSS has fixed height + `overflow-y: scroll` + stable gutter + scrollbar styling;
- padded 25->6 retained behavioral regression: **AUTHORED / NOT_RUN** in the current connector-only execution substrate;
- all-space fail-closed regression: **AUTHORED / NOT_RUN**;
- focused smart-field suite: **NOT_RUN**;
- browser runtime acceptance: **NOT_RUN**;
- full repository suite: **NOT_RUN**;
- PR-triggered workflow runs on product head: **NONE OBSERVED**.

No NOT_RUN result is promoted to PASS.

## Protected invariants

```text
TARGET0 overwrite                 DISABLED
Direct source mutation            DISABLED
Writer1/Writer2 invocation        NONE
FORCE/FORCMNT                     DE_SCOPED / FAIL-CLOSED
Node Name physical width          PRESERVED
Numeric smart-field authority     UNCHANGED
Apply-to-new-copy custody         UNCHANGED
Export hash/revalidation gate     UNCHANGED
```

## Connector-only backup limitation

No authenticated local checkout is available here, so repository-local `utils/backup.cjs` and `.agent-worklogs/` cannot be executed. Exact Git preimage/current blob SHAs and branch commits are the durable custody record.

## Exact next action

1. Reconcile PR #1108 live head/mergeability/reviews/checks.
2. If an authenticated/full checkout becomes available, run at minimum:

```text
node --test \
  tests/cii-workspace-find-replace-smart-fixed-width.test.js \
  tests/cii-workspace-find-replace-smart-fields-v2.test.js \
  tests/cii-workspace-find-replace-scroll-export-ui.test.js \
  tests/cii-workspace-find-replace-export-cache-lineage.test.js
```

3. Browser-check the editor with the reported 25-byte padded Find -> 6-byte replacement and a long pasted batch; confirm smart qualification and visible vertical scrolling.
4. Do not merge without explicit Owner authorization.
