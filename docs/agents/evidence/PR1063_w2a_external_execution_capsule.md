# PR1063 — exact W2 A external execution capsule

CHAIN_ID: CII-WRITER2-RUNTIME-QUALIFICATION
MATERIAL_BASIS: a9018c131be736606e44fd0379545d233238f33e
W2A_TEST_BLOB: 9922377ddeda86fc9167d65f33c97095346e79fa
PURPOSE: execute unchanged W2 A in an environment with exact repository checkout access
MUTATION_AUTHORITY: NONE

## Required preconditions

- exact Git checkout access to `reallaksh19/XML_Compare_Utilities`;
- Node capable of running the repository's ES-module test;
- no stubs, import rewrites, sparse/manual source reconstruction, generated replacement entrypoint or workflow mutation;
- no local modifications before the test.

## One-shot command sequence

```bash
set -u

REPO_URL="https://github.com/reallaksh19/XML_Compare_Utilities.git"
BASIS="a9018c131be736606e44fd0379545d233238f33e"
TEST="tests/cii-workspace-writer2-restraint-product-routing.test.js"
TEST_BLOB="9922377ddeda86fc9167d65f33c97095346e79fa"
OUT="w2a.stdout.txt"
ERR="w2a.stderr.txt"
META="w2a.execution.txt"

rm -rf XML_Compare_Utilities-w2a

git clone "$REPO_URL" XML_Compare_Utilities-w2a
cd XML_Compare_Utilities-w2a

git checkout --detach "$BASIS"

{
  echo "basis_expected=$BASIS"
  echo "head_actual=$(git rev-parse HEAD)"
  echo "tree_actual=$(git rev-parse HEAD^{tree})"
  echo "test_blob_expected=$TEST_BLOB"
  echo "test_blob_actual=$(git hash-object "$TEST")"
  echo "node=$(node --version)"
  echo "git=$(git --version)"
  echo "pre_status_begin"
  git status --porcelain=v1
  echo "pre_status_end"
} > "$META"

if [ "$(git rev-parse HEAD)" != "$BASIS" ]; then
  echo "PRECONDITION_FAIL_HEAD" >> "$META"
  exit 90
fi
if [ "$(git hash-object "$TEST")" != "$TEST_BLOB" ]; then
  echo "PRECONDITION_FAIL_TEST_BLOB" >> "$META"
  exit 91
fi
if [ -n "$(git status --porcelain=v1)" ]; then
  echo "PRECONDITION_FAIL_DIRTY_WORKTREE" >> "$META"
  exit 92
fi

set +e
node "$TEST" >"$OUT" 2>"$ERR"
STATUS=$?
set -e

{
  echo "node_exit=$STATUS"
  echo "post_status_begin"
  git status --porcelain=v1
  echo "post_status_end"
} >> "$META"

cat "$META"
printf '%s\n' '--- stdout ---'
cat "$OUT"
printf '%s\n' '--- stderr ---' >&2
cat "$ERR" >&2

exit "$STATUS"
```

## Required identities

```text
HEAD      a9018c131be736606e44fd0379545d233238f33e
root tree 27eb6c81b8b69742e781720b2450714df7c7f74e
W2 A blob 9922377ddeda86fc9167d65f33c97095346e79fa
```

## Classification

```text
checkout/network failure before repository materialization  -> NOT_RUN / environment
module/runtime environment stop before authored W2 A code   -> NOT_RUN / environment
first reached authored assertion or product exception       -> FAIL
exit 0 with expected completion message and clean worktree  -> candidate PASS
```

Expected clean completion message from the unchanged entrypoint:

```text
Writer2 W2.13 synthetic RESTRAINT product routing qualification passed.
```

A zero exit code must not be promoted if the preconditions fail, the test blob differs, or the worktree is contaminated.

## Authored failure isolation order

If the unchanged test reaches authored code and fails, preserve the raw first failure before modifying anything. Isolate the first wrong boundary in this order:

1. `applyCiiWriter2CompositePlanContract()` / first `routedPlan.status === PREVIEW_READY` assertion;
2. `ciiWriter2CompositeReadiness()`;
3. `applyCiiWriter2CompositeWithRestraintDelete()` direct composite;
4. direct `validateCiiWriter2ProductRoundTrip()`;
5. public `applyCiiWorkspaceTargetWriter2()` target re-intake/hash gate;
6. RESTRAINT selection inside `applyLowLevelWriter()`;
7. public postimage canonical re-intake;
8. public product validation;
9. exact equality between public result and direct composite;
10. negative cases: CREATE blocker, forged policy, missing component testimony, forged schema, stale target hash, non-RESTRAINT public path.

Only the production boundary owning the first divergence becomes a candidate for a surgical repair, and only after valid engineering-critical takeover verification.

## After W2 A candidate PASS

Do not jump gates. Execute the retained-real public benchmarks unchanged in order:

```text
BM-W2-01 NODENAME CREATE
BM-W2-02 SIF DELETE
BM-W2-03 HANGER DELETE-ALL
BM-W2-04 RESTRAINT DELETE COMPACTION
```

Only their own public runtime results may advance their states. Focused PR #1062 PASS evidence remains narrower and does not replace these gates.