# PR1082 Workreport — CII Writer2 multi-source NODENAME transfer

## Delivery container

- PR: `#1082`
- Branch: `agent/cii-writer2-multisource-nodename-transfer`
- Current main: `af73cada60031984182155f3fa362261b97379ec`
- Current branch reconciliation head before this report: `2ff76f54188ff34905db1804b92c39884f718a17`
- Canonical chain: `agents/chains/CII-WRITER2-MULTISOURCE-NODENAME/ACTIVE.md`
- Merge authority: Owner-only; `MERGE_AUTHORIZED=FALSE`.

## Mission

Deliver phase-qualified support for three independent CII V14 sources S1/S2/S3 against one untouched target T in **CII Writer 2 — V11 / V14**. Preserve source-member identity through base anchors/correspondence, form a single original-target transfer scope, APPLY only explicitly approved Writer2 NODENAME cardinality operations, and EXCLUDE unrelated changes.

Writer2 same-cardinality NODENAME overwrite remains unqualified and must not be broadened.

## Live input reconciliation

After the initial pre-work checkpoint, Owner added the four exact inputs to current main in commit `af73cada60031984182155f3fa362261b97379ec`.

Their Git blob IDs exactly match the locally computed Git blob IDs of the uploaded bytes:

```text
Benchmark/S1.CII  73c49165b9d33a8c776ef76f480efec3a90e0c93
Benchmark/S2.CII  a04622553720cb41a6fc2a4b85d8290eac7a3b0a
Benchmark/S3.CII  a20b1ab87dd4e854cf2f453f8fd206be4b566b42
Benchmark/T.CII   96b4a4b12bf66bcb0264c56e7767a857c4cc11e6
```

Pinned SHA-256 remains:

```text
S1  9a9cb14db4c13f5aac41cc74a60e7e528722eb5003d09f07192762ab6bfb1a2b
S2  7ec48b76b65eedfd5ecc9c8e8feca1a45dd8c83721a68b53aa0db3363e6d27fd
S3  c2143b31c482158ac5514d2709406c14a9179e656277c654e932bb845d090caa
T   abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060
```

This main drift is input-custody strengthening inside the already specified Owner task. The branch merged the exact input commit as a second parent without changing those blobs.

## Owner acceptance oracle

Expected post-base-selection NODE NAME CHANGES: `329` rows.
Normalized `source_names<TAB>target_name` acceptance-list SHA-256:

`0d941b97833ad55e9ef634c8a1935b233d57cf8ab6c07ba3fb7e7bef410e037e`

The expected list is Owner acceptance evidence and must never be regenerated from product output.

## Applicable authority

- Common: `engineering-pr-delivery-v2@e3ace4802a022f565f95b4af7f01a203df82dbcd`.
- Writer2 roadmap: `ciibenchmarkroadmap.md@7d061341a8c038316752007a3d4ed02b7ea66b58`, read-only.
- Existing Writer2 V11/V14 frozen bridge remains the sole V14 Writer2 projection path.
- `3D_Converters` V14 merge/profile is structural reference only. T has non-zero FORCMNT=6, ALLOWBLS=8 and FLANGES=16, outside current V14 merge-qualified constructs.
- Open draft PR #1064 retains separate public-runtime qualification authority; do not modify its legacy chain/runners/oracles/tolerances.

## Phase plan

1. P1 source-set custody + focused real-input benchmark.
2. P2 per-source base anchors/correspondence + 329-row known-outcome benchmark.
3. P3 combined transfer plan + exact APPLY/EXCLUDE allowlist.
4. P4 existing Writer2 scope/apply through frozen V11↔V14 bridge.
5. P5 retained-real end-to-end validation and unrelated-byte/pointer/count guards.

## Current state / blocker

No product, test, Writer2, converter, workflow or benchmark-oracle file has been changed in PR #1082 yet. Current branch work is pre-work/relay plus the exact current-main benchmark input ancestry.

The Owner requested coding but did not use one of the three exact progression commands required by the pinned protocol. `WRITE_AUTHORITY` therefore remains `READ_ONLY` for the first material batch.

## Exact next action

Freeze successor pre-work endpoint on `main@af73cada...` with the now-repository-resident exact inputs. On exact Owner `proceed next`, implement P1 only, run its focused real-input benchmark, record material receipt + endpoint, and stop before P2 pending the next progression command.
