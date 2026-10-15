# PR1081 CSV/manual synchronization exact-source execution

PR: `#1081`
Branch: `feature/cii-find-replace-finish-v14`
Product material head: `43761321967387130988590bc61877a79b632c37`
Base main: `bfe3abbb67060c1212001f2e9d967c229a057640`

## Bounded defect

The editable manual grid and CSV are intended to coexist in one preview. Before this patch, `onCsvChange()` rebuilt `session.rows` from CSV only. If manual rows had already been synchronized and the grid was clean, loading/reloading CSV could leave those manual values visible while silently removing them from Preview/Validate custody.

Dirty manual grids were already fail-closed, so the patch preserves that boundary rather than auto-admitting unsynchronized edits.

## Patch

`tabs/cii-workspace/cii-workspace-find-replace-ui.js`

```text
clean manual grid
→ snapshot synchronized manual inputs
→ parse/rebuild CSV preview
→ restore synchronized manual rows
→ render combined CSV + manual preview

manual grid dirty
→ do not auto-restore dirty values
→ existing Update Preview gate remains mandatory
```

Regression coverage was added to `tests/cii-workspace-find-replace-ui-registration.test.js`.

No FORCE/FORCMNT, TARGET0 overwrite, Writer1/Writer2, validator, executor, output custody, parser/converter, benchmark/oracle, or workflow authority changed.

## Exact source custody

The local execution closure used these exact Git blobs:

```text
tabs/cii-workspace/cii-workspace-find-replace.js
  7e2cff19726c904e8ad240302ea5d1acc4d1ee3f

tabs/cii-workspace/cii-workspace-find-replace-ui.js
  c90723e2b64ff382e22efb8c440c485b0f1506fb

tabs/cii-workspace/cii-workspace-tab.js
  d612a9e8914d2543a14a2e9912ee4a811fb1e75d

tests/cii-workspace-find-replace-finish.test.js
  2ecd535e87ff6c49761f092d5186838b76346dcc

tests/cii-workspace-find-replace-ui-registration.test.js
  89a1acd39ff8756f5acf75a93dd3c5f450bda79c
```

GitHub returned the modified UI/test content blob SHAs exactly as `c90723e...` and `89a1acd...` when the remote writes were accepted.

## Execution

```text
node --check tabs/cii-workspace/cii-workspace-find-replace-ui.js

node --test \
  tests/cii-workspace-find-replace-finish.test.js \
  tests/cii-workspace-find-replace-ui-registration.test.js
```

Observed result:

```text
tests       10
pass        10
fail        0
cancelled   0
skipped     0
todo        0
```

## Validation boundary

This execution validates the exact static UI/release closure including the new CSV/manual synchronization regression. It does not promote the following gates:

```text
SOURCE 3 retained-real authored runtime    NOT_RUN
Full repository suite                      NOT_RUN
Native-v14 archived fixture runtime        NOT_RUN
External CAESAR acceptance                 NOT_RUN
```

Those states remain `NOT_RUN`.