# Pipeline 3D Approved Catalog Registry Source Qualification

## Status

```text
UNRESOLVED_GATE
APPROVED_PRODUCTION_REGISTRY_SOURCE_UNRESOLVED
REGISTRY_DIGEST_SCOPE_UNRESOLVED
```

This document is the repository-controlled qualification contract for issue #752.
It does not authorize catalog values, a registry provider, mandatory enforcement, or engineering release.

## Governing ancestry

- TRI-2D-A merge: `2aa3b875dedbce8e595d3133f91169e40848b3d8`
- TRI-2D-B merge: `6ac567046037a468e2992de6bb3ff2937aa4f522`
- TRI-2E-A merge: `8a11124424b8374c34dc76712bc6ed6bcd7176a6`
- Qualification issue: #752

## 1. Required authority bundle

Implementation authority requires one immutable submission containing:

1. the exact production registry artifact or an approved authoritative retrieval contract;
2. the accountable engineering owner and formal approval reference;
3. the approved source/loading mode;
4. the approved digest model and exact digest scope;
5. the authorized piping-code and material-allowable namespaces;
6. compatibility, supersession, revocation, retention and failure policies.

Synthetic test entries, examples and fixtures are not production authority.

## 2. Registry input contract

The supplied or loaded object must have this top-level shape:

```json
{
  "source": {
    "registryId": "<stable nonblank id>",
    "title": "<approved title>",
    "revision": "<approved revision>",
    "approvalReference": "<formal approval reference>",
    "sha256": "<64 hexadecimal characters>",
    "caesarVersion": "14.00"
  },
  "pipingCodeEntries": [],
  "materialAllowableEntries": []
}
```

### Piping-code namespace

Every entry must already conform to `PipelinePipingCodeCatalogEntry.v1` and include an approved:

- stable `catalogEntryId`;
- code family and edition;
- CAESAR 14 piping-code value;
- source authority;
- source reference;
- revision and withdrawal rule.

### Material-allowable namespace

Every entry must already conform to `PipelineMaterialAllowableCatalogEntry.v1` and include approved:

- stable `catalogEntryId`;
- complete material identity;
- allowable evidence;
- temperature-case content and ownership;
- source authority and source reference;
- revision and withdrawal rule.

The implementation team must not infer, interpolate, complete or correct missing engineering values.

Entry IDs must be unique within each namespace. Reuse of the same text ID across the two namespaces is permitted only when explicitly approved as an intentional independent namespace identity.

## 3. Digest model decision

The existing registry object stores `source.sha256` inside the object. A digest over the complete serialized object including that field is self-referential and is not a usable identity contract without an additional rule.

The owner must approve exactly one model.

### DETACHED_ARTIFACT_DIGEST

- SHA-256 is stored in an external signed or formally approved manifest.
- The digest is computed over the exact artifact bytes before parsing.
- The verified digest is retained in runtime and migration evidence.

### DEFINED_PAYLOAD_DIGEST

- SHA-256 is computed over a precisely defined payload excluding the digest field.
- The exact byte serialization or canonicalization algorithm is part of the approval.
- Key order, encoding, newline, BOM and whitespace rules must be explicit.

### EXTERNAL_BLOB_REFERENCE_DIGEST

- `source.sha256` identifies a separate immutable source blob.
- The exact byte boundary and relationship between the blob and parsed registry are formally defined.

Until one model is approved, no implementation may:

- hash `JSON.stringify(...)` by convention;
- normalize whitespace, newlines, BOM or key order silently;
- treat an embedded fixture digest as proof of artifact identity;
- accept a registry before digest verification.

## 4. Source and loading policy

Authorize exactly one source mode, or define an explicit deterministic precedence rule:

- project-supplied immutable artifact;
- configuration-managed artifact;
- packaged application artifact;
- authenticated service-provided artifact.

The policy must define:

- source location or retrieval identifier;
- authentication and authorization boundary;
- exact-byte acquisition point;
- caching policy and cache identity;
- offline behavior;
- unavailable-source behavior;
- stale, revoked and superseded revision behavior;
- existing-project pinning or explicit upgrade behavior;
- prohibition of silent fallback to another registry.

Catalog-bearing authorities remain fail closed unless a different auditable rule is formally approved.

## 5. Approval record

The authority bundle must include nonblank values for:

```text
accountableEngineeringOwner:
approvalReference:
approvalDate:
effectiveDate:
registryId:
registryRevision:
digestModel:
expectedSha256:
sourceMode:
sourceLocationOrIdentifier:
supersedes:
revocationReference:
existingProjectCompatibilityRule:
auditRetentionRule:
```

Blank placeholders do not resolve the gate.

## 6. Qualification matrix

After the authority bundle is approved, the implementation work pack must prove:

1. exact authorized artifact or retrieval identity succeeds;
2. one-byte artifact tampering fails;
3. digest mismatch fails before registry adoption;
4. malformed JSON or non-plain input fails;
5. missing source identity fields fail;
6. non-CAESAR-14 registry fails;
7. duplicate IDs inside one namespace fail;
8. approved same-text IDs across separate namespaces remain isolated;
9. missing required authority entry fails;
10. inline authority and registry-entry mismatch fails;
11. wrong namespace, authority index, section or catalog ID fails;
12. partial or forged attached ancestry fails at the existing writer gate;
13. unavailable, stale, revoked or superseded source follows the approved policy;
14. repeated loading produces deterministic immutable evidence;
15. every catalog-bearing production caller and fixture uses the governed provider;
16. active catalog authorities without ready adoption are blocked;
17. legacy documents without active catalog-bearing authority remain compatible;
18. valid adoption leaves CAESAR InputXML bytes unchanged;
19. project-migration evidence retains registry, revision, approval and digest ancestry;
20. no silent default, inferred catalog selection or fallback path exists.

## 7. Implementation sequence after gate resolution

1. Record the exact `main` baseline and approved artifact identity.
2. Create a dedicated implementation issue and branch.
3. Implement only the approved provider or loader contract.
4. Verify digest and approval evidence before parsing and adoption.
5. Migrate all catalog-bearing production callers and fixtures.
6. Enable mandatory enforcement for active catalog-bearing authorities.
7. Run registry, adoption, writer and production-flow qualification tests.
8. Inspect exact changed-file scope and current-main overlap.
9. Open a draft PR with validation limitations stated explicitly.
10. Merge only after exact-head review using a squash merge and expected-head SHA guard.

## 8. Explicit exclusions

Until the authority bundle is accepted, this contract does not authorize:

- production catalog values;
- a registry loader or provider;
- a digest implementation;
- automatic code or material selection;
- interpolation or derating;
- UI catalog editing or selection;
- mandatory registry enforcement;
- CAESAR desktop qualification;
- engineering release certification.
