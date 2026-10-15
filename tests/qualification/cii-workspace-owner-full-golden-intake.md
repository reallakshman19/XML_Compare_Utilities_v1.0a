# CIIW69 REC-04 — Full Owner lexical PS↔SL golden intake contract

**Status:** TEST-ONLY INTAKE IMPLEMENTED; **AUTHENTIC COMPLETE OWNER GOLDEN NOT RECEIVED**. This is a technical evidence protocol, never an Owner attestation, product identity rule, Writer1C/Writer2 scope, merge approval, or v3.6 TASK_EVIDENCE.

Parent: Issue #69. PR #68 remains OPEN/unmerged. Owner PH0–PH7 independent acceptance remains 0/8. The 36 known-positive TEXPECTED changes and the frozen BM-001 329-row authority are partial benchmarks **not** the complete Owner PS↔SL list.

## Required genuine Owner submission

1. Preserve the **entire original raw UTF-8 relation text**, including exact order, duplicate relations, zero padding, unusual suffixes and punctuation. Do not silently “correct” `SL-263..5`, `SL-265..4` or `SL-275-A.8`, and do not deduplicate repeated `PS02687.1` relations. Keep the untouched original for independent archival/hash comparison.
2. Supply **independently attested SHA-256** and **total nonblank lexical relation count**. The checksum must be computed on the original bytes, not a normalized/rewritten string. Record its actual Owner GitHub issue/comment provenance and explicit original-completeness declaration; a checksum self-declared by a test file does not authenticate an Owner.
3. For physical reconciliation, each relation needs an explicit SOURCE member (S1/S2/S3). If the original text omits it, preserve that untouched text; the test classifies a missing member as **AMBIGUOUS**, never silently chooses one. A member-qualified representation may be accepted only after independently confirming line-by-line parity with the untouched original, without rewriting its labels. The strict test intake accepts either `S1<TAB>SOURCE_LABEL<TAB>TARGET_LABEL`, or `S1: SOURCE_LABEL → TARGET_LABEL` with `→`/`->`/`=>`. A raw `SOURCE_LABEL → TARGET_LABEL` is preserved but lacks member provenance. Any other formatting fails explicitly and requires parser adjudication, not silent dropping.
4. Manifest JSON (provided by the authentic Owner evidence source, separately verified):

```json
{
  "schema": "CiiOwnerLexicalRelationGolden.v1",
  "ownerEvidenceRef": "https://github.com/OWNER/REPOSITORY/issues/ISSUE#issuecomment-COMMENT",
  "rawSha256": "64-hex SHA-256 of the original text bytes",
  "relationCount": 0,
  "sourceSetSha256": "5390166aab9504880bd4514af865c914ba8a41ce2922e7d473311d62b10723a3",
  "targetOriginalSha256": "abfa3ffc9281fe75d4170b2d885d554cb1f120dadedae7c7ab609548b63cc060"
}
```

The sample `relationCount: 0` and descriptive checksum are **placeholders** and intentionally invalid. Never turn this example into fixture evidence.

## Reproduce

With the authentic original golden and manifest available:

```sh
node tests/cii-workspace-owner-golden-retained-gate.mjs \
  --golden /path/to/owner-original-raw.txt \
  --manifest /path/to/owner-golden-manifest.json
```

The runner must also have the exact-head `test-results/cii-method-a-qualification/source-target-census.json` produced by the retained S1/S2/S3/T benchmark. It verifies the original S1/S2/S3/T file hashes, enumerates all 150 physical SOURCE node endpoints independently from neutral-file 15-row ELEMENTS, verifies exact raw name custody, and enumerates all physical TARGET nodes from original `Benchmark/T.CII`.

Without a supplied golden, running the command with **no arguments** exports `test-results/cii-method-a-qualification/owner-golden-readiness.json` containing `BLOCKED_AUTHENTIC_OWNER_GOLDEN_MISSING`. This negative readiness check is an intentionally passing CI **control**, **not** full-golden qualification. Supplying invalid bytes, declared hash, cardinality, reference, or target/source custody fails closed with a nonzero status.

## Per-row disposition

- **MATCHED:** unique physical SOURCE and TARGET candidates and an actual independently BOUND SOURCE→TARGET identity in the read-only census. This does **not** imply HIGH or Owner acceptance.
- **REVIEWABLE:** uniquely located lexical candidate pair, but no admitted physical identity (or a contradictory physical binding).
- **AMBIGUOUS:** repeated SOURCE/TARGET labels, missing SOURCE-member provenance, duplicate relation rows, or one SOURCE label with different expected TARGET labels; preserve every raw row and possible physical identity.
- **MISSING:** exact lexical SOURCE and/or TARGET name not present in original physical fixtures.
- **INVALID:** malformed, empty or untrimmed relation fields, invalid SOURCE member, or broken relation grammar.

Unusual punctuation and suffixes are separately flagged for Owner adjudication without correction, even when a physically BOUND relationship coincidentally exists. The row inventory, physical candidate IDs, observed identity/binding/confidence, raw line, original line number, source-member provenance, anomaly flags and independent input hashes are exported.

**Acceptance remains BLOCKED** even if every candidate classifies MATCHED: byte SHA and internal row count prove fidelity to a supplied file, not completeness of Owner intent or approval. The full original Owner text, authoritative source reference, attested cardinality and work-specific v3.6 authorization are separate Owner obligations. No production matcher or Writer2 imports these test-only files.
