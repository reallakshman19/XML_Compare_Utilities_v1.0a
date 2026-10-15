# Pipeline 3D Approved Catalog Qualification Evidence Verification

## Purpose

The TRI-2F-B verifier independently checks the JSON evidence contract emitted by the TRI-2F-A approved-catalog qualification harness.

It verifies structural and byte-level consistency. It does not prove that the recorded process actually ran, identify the actor who ran it, authenticate an external machine, or replace retained CI or laboratory evidence.

## Input contract

The evidence file must be the exact UTF-8 output of the TRI-2F-A CLI:

```text
JSON.stringify(result, null, 2) + one LF
```

The verifier rejects:

- malformed or invalid UTF-8;
- empty or oversized input;
- alternate whitespace or indentation;
- missing or additional final newlines;
- reordered object keys;
- duplicate-key JSON that would otherwise collapse during parsing;
- missing, reordered or additional schema fields.

This strict representation rule makes the evidence byte digest reproducible. It is separate from the unresolved production-registry digest policy in issue #752.

## Verification command

```bash
node scripts/verify-pipeline-approved-catalog-qualification-evidence.mjs \
  --evidence /tmp/pipeline-approved-catalog-qualification.json \
  --expected-baseline 0123456789abcdef0123456789abcdef01234567 \
  > /tmp/pipeline-approved-catalog-verification.json
```

PowerShell:

```powershell
node scripts/verify-pipeline-approved-catalog-qualification-evidence.mjs `
  --evidence "$env:TEMP\pipeline-approved-catalog-qualification.json" `
  --expected-baseline 0123456789abcdef0123456789abcdef01234567 |
  Tee-Object -FilePath "$env:TEMP\pipeline-approved-catalog-verification.json"
```

The expected baseline must be the exact 40-hex commit that was intended to be qualified.

## Verified conditions

A ready verification requires:

- exact TRI-2F-A evidence schema and harness version;
- `baselineCommit === repositoryHead === expectedBaseline`;
- `worktreeClean === true`;
- the exact six approved test IDs, paths and order;
- exactly one result per approved test;
- exact normalized command `['node', testPath]`;
- exit code zero, null signal and result ready true;
- nonnegative safe-integer duration;
- terminal `: PASS` stdout evidence;
- lowercase 64-hex stdout and stderr SHA-256 fields;
- exact TRI-2F-A truncation geometry when an excerpt is truncated;
- empty diagnostics and blocker arrays;
- aggregate ready true;
- no missing, unknown or additional top-level, plan or result fields.

## Output digest behavior

For a fully retained output excerpt, the verifier recomputes SHA-256 over its UTF-8 bytes and requires equality with the recorded hash.

For a truncated excerpt, the verifier requires the exact TRI-2F-A layout:

```text
2,032-character head
...[OUTPUT TRUNCATED]...
2,032-character tail
```

The complete output is not available in that case, so its recorded digest cannot be independently recomputed. The verification result reports:

- `recomputedOutputDigestCount`;
- `truncatedOutputDigestCount`.

A truncated excerpt is therefore contract-valid but not equivalent to an externally retained full log.

## Verification evidence

Output schema:

```text
PipelineApprovedCatalogQualificationEvidenceVerification.v1
```

The verification records:

- verifier version;
- normalized expected baseline;
- evidence schema and harness version;
- evidence byte length;
- SHA-256 of exact evidence bytes;
- SHA-256 of a normalized timing-free semantic projection;
- verified test count;
- recomputed and truncated output-digest counts;
- diagnostics, blocker codes and aggregate readiness.

The timing-free semantic projection excludes only `durationMs`. Different durations may change the exact evidence-byte digest while retaining the same semantic-projection digest.

## Exit behavior

- Exit code `0`: evidence satisfies the complete TRI-2F-B verification contract.
- Exit code `1`: file reading, canonical representation or semantic verification is blocked.

## Trust boundary

A ready result establishes evidence-contract consistency only. It does not provide:

- a digital signature;
- actor or machine identity;
- trusted timestamping;
- proof that commands actually executed;
- independent authentication of truncated stdout or stderr;
- browser or UI qualification;
- CAESAR desktop import qualification;
- production catalog approval;
- engineering release certification.

The following gates remain unresolved:

```text
APPROVED_PRODUCTION_REGISTRY_SOURCE_UNRESOLVED
REGISTRY_DIGEST_SCOPE_UNRESOLVED
```

Issue #752 remains the governing production-registry authority gate.
