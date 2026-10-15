# Canonicalization and hashing — Document Evidence v1

Machine evidence uses deterministic canonical JSON. Implementations must follow RFC 8785 JSON Canonicalization Scheme (JCS) semantics: I-JSON data, UTF-16 code-unit property ordering, ECMAScript-compatible finite IEEE-754 number serialization, JSON string escaping, and UTF-8 output with no insignificant whitespace.

## Hash form

```text
sha256:<64 lowercase hex characters>
```

For a schema-bearing object whose identity is `X.v1`:

```text
contentHash = SHA-256(UTF8("X.v1\0") || JCS(canonicalObjectWithoutSelfHash))
```

A self-hash field is excluded only from the hash of the object that contains that field. Referenced source, surface, transform, provider and observation hashes remain included.

Internal helper identities that do not carry a `schema` field are JCS-hashed without a schema prefix and are not portable contract-object hashes. Cross-repository contracts must use schema-bearing identities.

## JCS input restrictions

- object keys are strings and are sorted by UTF-16 code units;
- strings containing lone Unicode surrogates are rejected;
- `NaN` and infinities are rejected;
- integer-valued JSON numbers must stay within the IEEE-754 safe integer domain (`±9007199254740991`); larger exact integers must be represented as strings by their schema;
- `-0` serializes as `0`;
- number notation follows ECMAScript thresholds, including fixed notation for `1e-6` and `1e20`, and exponent notation for `1e-7` and `1e21`.

## Included semantic inputs

Canonical machine evidence includes every value capable of changing meaning or reproducibility, including:

- immutable source hash and source size;
- selected page/region identity;
- surface identity and dimensions;
- provider name/version/model and profile hash;
- render profile and font-resolution evidence where applicable;
- preprocessing operations and transform hashes;
- exact raw observed text and provider confidence;
- geometry and provider coordinate convention;
- machine diagnostics and evidence decisions;
- raw-provider payload hash/reference when retained.

Provider differences are never normalized away merely because two providers return the same text.

## Excluded execution noise

Deterministic machine evidence excludes values that describe execution but not meaning:

- queue/job UUID generated only for orchestration;
- worker hostname;
- temporary file path;
- request arrival timestamp;
- elapsed runtime;
- retry scheduling timestamp.

If any such field is required operationally, store it in a non-canonical execution receipt rather than `MachineEvidenceEnvelope`.

## Human correction identity

Reviewer corrections are a separate append-only artifact class. `CorrectionEvent` may contain reviewer identity, review timestamp and reason, and those values are included in the correction event hash.

A reviewed/effective text view must include a `correctionSetHash`; it must not change the underlying deterministic `MachineEvidenceEnvelope` hash.

## Evidence bundles

ZIP bytes are not the primary semantic identity. A deterministic bundle must use:

- canonical manifest JSON;
- lexicographically sorted entry names;
- normalized timestamps;
- normalized permission/external attributes;
- fixed compression policy/version where byte-identical ZIP output is claimed;
- SHA-256 per entry.

Semantic bundle identity is the canonical manifest hash. Bitwise ZIP equality is an additional artifact-determinism claim only when the complete ZIP writer profile is pinned.
