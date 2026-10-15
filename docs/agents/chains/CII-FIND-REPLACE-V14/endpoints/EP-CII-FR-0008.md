# EP-CII-FR-0008 — Explicit Apply-to-new-copy gate

CHAIN_ID: CII-FIND-REPLACE-V14
LEG: PR1071-EXPLICIT-APPLY-TO-NEW-COPY
PR: #1071
BRANCH: `feature/cii-find-replace-apply-copy-v14`
BASE_MAIN: `511d186926b67a71efa8163e85497f489ef3a3ed`
PRODUCT_CHECKPOINT_HEAD: `ff3639503728d2246746b343d3e9c5c803e1ed79`
PR_HANDOVER_HEAD_BEFORE_CHAIN_RECONCILIATION: `bda9de830b31ecaaae0d79b3c6854ed622544721`
STATE: READY_FOR_EXACT_CHECKOUT_VALIDATION
MERGE_AUTHORITY: OWNER_ONLY
MERGE_AUTHORIZED: FALSE

## Delivered capability

The v14 Find & Replace UI now implements the owner-requested explicit sequence:

```text
Preview / review
  -> Validate TARGET0-relative claims + TARGET1
  -> Apply to New Copy
  -> Download Modified CII
```

`Apply to New Copy` is a release gate only. It does not write to, replace, or overwrite TARGET0. The session records the independently validated TARGET1 hash/receipt, and final download independently revalidates the candidate and requires that exact release.

## Authority statement

```text
direct mutation canApply         = false
new-copy release canApplyToNewCopy = qualified && !released
download canDownload             = released
TARGET0 overwrite                = prohibited
Writer1 / Writer2                = not invoked
FORCE / FORCMNT                  = not qualified
```

No workflow, parser, converter, writer, benchmark, oracle, tolerance, deployment, or FORCE authority changed in this leg.

## Focused evidence

STATUS: PASS
OBSERVATION: isolated Node delta harness executed the changed session/output behavior.
RESULT: 10/10 PASS.
LIMITATION: document-scope validation/SHA dependencies were locally equivalent harness implementations, not a complete authenticated repository checkout. This evidence is intentionally narrower than authored full-repository execution.

Key proved behaviors:
- qualified preview cannot download before explicit Apply;
- Apply records a validated new-copy target hash/receipt;
- final download requires that release and revalidates TARGET0/TARGET1;
- forged TARGET0 hash is blocked;
- target reload invalidates release;
- direct `canApply` remains false;
- FORCE/unsupported manual blocks remain blocked.

Static source inspection also confirms the UI is gated by `canApplyToNewCopy` and `canDownload`, and adds no Writer/file-system import.

## Existing evidence retained

- Node Name authored focused test: 4/4 PASS from prior merged leg.
- merged non-benchmark Find & Replace surface: 33/33 PASS from prior validation checkpoint.
- retained-real `SOURCE 3.CII`: NOT_RUN in current substrate.
- full repository suite: NOT_RUN.
- native-v14 archive runtime: NOT_RUN.
- external CAESAR acceptance: NOT_RUN.
- FORCE/FORCMNT ownership qualification: NOT_QUALIFIED.

## Retained fixture custody

`Benchmark/CIICompare/SOURCE 3.CII` remains authoritative at:

```text
size     393008 bytes
Git blob 20c0c37014004fb9de46e3e4d01f0c62535495d5
```

Current connector access can inspect byte-preserving ranges and metadata but cannot materialize the full private retained file into the local Node runtime. Therefore its authored test remains NOT_RUN, not PASS or FAIL.

## Protected invariants

- immutable TARGET0;
- TARGET0-relative claim custody;
- same-length output for current generic replacement authority;
- independent postimage validation;
- unchanged bytes outside qualified claims;
- Node Name fixed-field ownership remains unchanged;
- FORCE fail-closed;
- no Writer1/Writer2 routing;
- no direct source overwrite;
- merge Owner-only.

## Exact next action

From a complete authenticated checkout of PR #1071 head, execute unchanged:

```bash
node --test tests/cii-workspace-find-replace-session.test.js \
  tests/cii-workspace-find-replace-output.test.js \
  tests/cii-workspace-find-replace-ui-registration.test.js \
  tests/cii-workspace-find-replace-foundation.test.js
```

If clean, run the existing non-benchmark Find & Replace test group. Then execute `tests/cii-workspace-find-replace-retained-real.test.js` against exact `SOURCE 3.CII` and require Git blob `20c0c37014004fb9de46e3e4d01f0c62535495d5` before promotion.

Classification:

```text
materialization/runtime stop before authored assertions -> NOT_RUN
authored assertion/product exception                  -> FAIL
clean authored completion                             -> candidate PASS
```

Do not reopen FORCE or direct overwrite authority as part of this continuation.
