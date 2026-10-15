# PR1071 — exact-checkout Find & Replace execution capsule

CHAIN_ID: CII-FIND-REPLACE-V14
PR: #1071
QUALIFICATION_BASIS_HEAD: a1b5de0e82a53e5b2e82f253fecafd45d9b4d714
PURPOSE: execute the authored PR1071 focused tests, current non-benchmark Find & Replace group, and retained-real gate from one exact authenticated checkout
MUTATION_AUTHORITY: NONE
MERGE_AUTHORITY: OWNER_ONLY

## Required identities

```text
HEAD                                              a1b5de0e82a53e5b2e82f253fecafd45d9b4d714
session test                                      7ee0f9f86c8f555077e96aa670ff8ae6786fb105
output test                                       c86c075657941c81ea1198a357a9931f27c93670
UI registration test                              10c24332a8ccf7f49a3de49cc104956919dabd16
foundation/direct-mutation-boundary test           f6f2a50aac9483c7f4cfa51f8be3a6fe05acb02a
retained-real test                                6bdb9909df2a942d89c7f8f5a6cfb6dc643f6f02
Benchmark/CIICompare/SOURCE 3.CII                 20c0c37014004fb9de46e3e4d01f0c62535495d5
SOURCE 3.CII byte length                          393008
```

The source fixture identity is a hard precondition. Do not run the retained-real test against a normalized, re-encoded, excerpted, or manually reconstructed CII file.

## One-shot command sequence

```bash
set -u

REPO_URL="https://github.com/reallaksh19/XML_Compare_Utilities.git"
BASIS="a1b5de0e82a53e5b2e82f253fecafd45d9b4d714"
ROOT="XML_Compare_Utilities-pr1071-exact"
META="pr1071.execution.txt"
FOCUSED_OUT="pr1071.focused.stdout.txt"
FOCUSED_ERR="pr1071.focused.stderr.txt"
GROUP_OUT="pr1071.group.stdout.txt"
GROUP_ERR="pr1071.group.stderr.txt"
RETAINED_OUT="pr1071.retained.stdout.txt"
RETAINED_ERR="pr1071.retained.stderr.txt"

rm -rf "$ROOT"
git clone "$REPO_URL" "$ROOT"
cd "$ROOT"
git checkout --detach "$BASIS"

SESSION_TEST="tests/cii-workspace-find-replace-session.test.js"
OUTPUT_TEST="tests/cii-workspace-find-replace-output.test.js"
UI_TEST="tests/cii-workspace-find-replace-ui-registration.test.js"
FOUNDATION_TEST="tests/cii-workspace-find-replace-foundation.test.js"
RETAINED_TEST="tests/cii-workspace-find-replace-retained-real.test.js"
SOURCE3="Benchmark/CIICompare/SOURCE 3.CII"

{
  echo "basis_expected=$BASIS"
  echo "head_actual=$(git rev-parse HEAD)"
  echo "node=$(node --version)"
  echo "git=$(git --version)"
  echo "session_test_expected=7ee0f9f86c8f555077e96aa670ff8ae6786fb105"
  echo "session_test_actual=$(git hash-object "$SESSION_TEST")"
  echo "output_test_expected=c86c075657941c81ea1198a357a9931f27c93670"
  echo "output_test_actual=$(git hash-object "$OUTPUT_TEST")"
  echo "ui_test_expected=10c24332a8ccf7f49a3de49cc104956919dabd16"
  echo "ui_test_actual=$(git hash-object "$UI_TEST")"
  echo "foundation_test_expected=f6f2a50aac9483c7f4cfa51f8be3a6fe05acb02a"
  echo "foundation_test_actual=$(git hash-object "$FOUNDATION_TEST")"
  echo "retained_test_expected=6bdb9909df2a942d89c7f8f5a6cfb6dc643f6f02"
  echo "retained_test_actual=$(git hash-object "$RETAINED_TEST")"
  echo "source3_expected=20c0c37014004fb9de46e3e4d01f0c62535495d5"
  echo "source3_actual=$(git hash-object "$SOURCE3")"
  echo "source3_size_expected=393008"
  echo "source3_size_actual=$(wc -c < "$SOURCE3" | tr -d ' ')"
  echo "pre_status_begin"
  git status --porcelain=v1
  echo "pre_status_end"
} > "$META"

[ "$(git rev-parse HEAD)" = "$BASIS" ] || { echo PRECONDITION_FAIL_HEAD >> "$META"; exit 90; }
[ "$(git hash-object "$SESSION_TEST")" = "7ee0f9f86c8f555077e96aa670ff8ae6786fb105" ] || { echo PRECONDITION_FAIL_SESSION_TEST >> "$META"; exit 91; }
[ "$(git hash-object "$OUTPUT_TEST")" = "c86c075657941c81ea1198a357a9931f27c93670" ] || { echo PRECONDITION_FAIL_OUTPUT_TEST >> "$META"; exit 92; }
[ "$(git hash-object "$UI_TEST")" = "10c24332a8ccf7f49a3de49cc104956919dabd16" ] || { echo PRECONDITION_FAIL_UI_TEST >> "$META"; exit 93; }
[ "$(git hash-object "$FOUNDATION_TEST")" = "f6f2a50aac9483c7f4cfa51f8be3a6fe05acb02a" ] || { echo PRECONDITION_FAIL_FOUNDATION_TEST >> "$META"; exit 94; }
[ "$(git hash-object "$RETAINED_TEST")" = "6bdb9909df2a942d89c7f8f5a6cfb6dc643f6f02" ] || { echo PRECONDITION_FAIL_RETAINED_TEST >> "$META"; exit 95; }
[ "$(git hash-object "$SOURCE3")" = "20c0c37014004fb9de46e3e4d01f0c62535495d5" ] || { echo PRECONDITION_FAIL_SOURCE3_BLOB >> "$META"; exit 96; }
[ "$(wc -c < "$SOURCE3" | tr -d ' ')" = "393008" ] || { echo PRECONDITION_FAIL_SOURCE3_SIZE >> "$META"; exit 97; }
[ -z "$(git status --porcelain=v1)" ] || { echo PRECONDITION_FAIL_DIRTY_WORKTREE >> "$META"; exit 98; }

set +e
node --test "$SESSION_TEST" "$OUTPUT_TEST" "$UI_TEST" "$FOUNDATION_TEST" >"$FOCUSED_OUT" 2>"$FOCUSED_ERR"
FOCUSED_STATUS=$?
set -e
{
  echo "focused_exit=$FOCUSED_STATUS"
} >> "$META"
if [ "$FOCUSED_STATUS" -ne 0 ]; then
  cat "$META"
  printf '%s\n' '--- focused stdout ---'
  cat "$FOCUSED_OUT"
  printf '%s\n' '--- focused stderr ---' >&2
  cat "$FOCUSED_ERR" >&2
  exit "$FOCUSED_STATUS"
fi

mapfile -t FIND_REPLACE_GROUP < <(
  find tests -maxdepth 1 -type f -name 'cii-workspace-find-replace-*.test.js' \
    ! -name 'cii-workspace-find-replace-retained-real.test.js' \
    ! -name '*benchmark*' \
    -print | sort
)
[ "${#FIND_REPLACE_GROUP[@]}" -gt 0 ] || { echo PRECONDITION_FAIL_EMPTY_FIND_REPLACE_GROUP >> "$META"; exit 99; }

set +e
node --test "${FIND_REPLACE_GROUP[@]}" >"$GROUP_OUT" 2>"$GROUP_ERR"
GROUP_STATUS=$?
set -e
{
  echo "group_test_count=${#FIND_REPLACE_GROUP[@]}"
  echo "group_exit=$GROUP_STATUS"
} >> "$META"
if [ "$GROUP_STATUS" -ne 0 ]; then
  cat "$META"
  printf '%s\n' '--- group stdout ---'
  cat "$GROUP_OUT"
  printf '%s\n' '--- group stderr ---' >&2
  cat "$GROUP_ERR" >&2
  exit "$GROUP_STATUS"
fi

set +e
node --test "$RETAINED_TEST" >"$RETAINED_OUT" 2>"$RETAINED_ERR"
RETAINED_STATUS=$?
set -e
{
  echo "retained_exit=$RETAINED_STATUS"
  echo "post_status_begin"
  git status --porcelain=v1
  echo "post_status_end"
} >> "$META"

cat "$META"
printf '%s\n' '--- focused stdout ---'
cat "$FOCUSED_OUT"
printf '%s\n' '--- group stdout ---'
cat "$GROUP_OUT"
printf '%s\n' '--- retained stdout ---'
cat "$RETAINED_OUT"
printf '%s\n' '--- focused stderr ---' >&2
cat "$FOCUSED_ERR" >&2
printf '%s\n' '--- group stderr ---' >&2
cat "$GROUP_ERR" >&2
printf '%s\n' '--- retained stderr ---' >&2
cat "$RETAINED_ERR" >&2

exit "$RETAINED_STATUS"
```

## Classification

```text
clone/checkout/materialization failure before authored assertions -> NOT_RUN / environment
identity or size precondition failure                           -> NOT_RUN / wrong substrate or wrong tree
first authored assertion or product exception                  -> FAIL
focused + non-benchmark group + retained-real exit 0            -> candidate PASS for these gates
```

A candidate PASS is not full-suite, native-v14, or external-CAESAR acceptance. Those remain separate gates.

## Failure isolation

If authored execution starts and fails, preserve the first raw failure before changing code. Isolate in this order:

1. PR1071 session state transition / release invalidation;
2. output candidate validation / release-hash gate;
3. UI Apply/download static registration;
4. unchanged direct `canApply === false` transaction boundary;
5. existing non-benchmark Find & Replace regression surface;
6. retained element/displacement/NODENAME physical custody;
7. retained postimage exact-byte validation.

Do not patch benchmarks, FORCE authority, Writer1/Writer2, parsers, converters, workflows, or direct-overwrite behavior to obtain a green result.

## Current substrate result

The connected GitHub API proves the exact identities above, including `SOURCE 3.CII` size and blob SHA, but the execution container cannot resolve GitHub network/DNS and the connector truncates the 393008-byte blob rather than materializing it. No GitHub check/status exists on the PR head. Therefore exact-checkout execution in the current substrate is **NOT_RUN / environment**, not PASS or FAIL.
