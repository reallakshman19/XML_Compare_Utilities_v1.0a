# CII Writer 2 W2.1 — V11 SIF/TEE CREATE construction qualification

## Final verdict

```text
VERDICT: NOT_READY_FOR_WRITER2_SIF_CREATE_IMPLEMENTATION
NEUTRAL_EDITION: 11.0
PHYSICAL_SCHEMA: QUALIFIED_30_ITEMS_PER_TEE_2_TEES_10_ROWS
COMPLETE_CREATE_PAYLOAD_SEMANTICS: NOT_QUALIFIED
PRODUCTION_CREATE_AUTHORITY: BLOCKED
```

This qualification does **not** authorize a production SIF/TEE CREATE writer. The existing blocker remains correct:

```text
WRITER_2_SIF_CREATE_PAYLOAD_SEMANTICS_UNQUALIFIED_ITEMS_27_30
```

The blocker name understates the full CREATE gap: items 27..30 are unresolved, and several earlier positions/default encodings are also insufficiently specified for synthesis.

## 1. Grounding

```text
repository = reallaksh19/XML_Compare_Utilities
issue      = #1032
PR         = #1033
base main  = e5d3420f78794e465b4b8c7f858c3fc53baf3039
mode       = QUALIFICATION_ONLY
```

Merged Writer2 already owns existing V11 SIF block DELETE, block compaction and pointer reindex. W2.1 asks a different question: can Writer2 construct a **new** legal V11 10-row auxiliary block without inventing any engineering/default/sentinel semantics?

## 2. Direct V11 physical authority

Vendor-authored CAESAR II User's Guide Version 2019 (11.0), April 2019, External Interfaces -> CAESAR II Neutral File -> Auxiliary Element Data, p.1187 directly establishes:

```text
section                #$ SIF&TEES
FORTRAN format         (2X, 6G13.6)
items per tee          30
tees per auxiliary     2
rows per tee           5
rows per auxiliary     10
SIF array              N4 x 60
```

Therefore physical item position is deterministic:

```text
tee slot 1: rows 0..4, items 1..30
tee slot 2: rows 5..9, items 1..30
field starts: 0,15,28,41,54,67
field widths: 15,13,13,13,13,13
```

The V11 neutral appendix directly names items 1..18 and 23..26. It identifies positions 19..22 only collectively as code-specific and states that items 3,4,11,13..22 are for IGE/TD/12 in that neutral mapping. It does not name items 27..30.

## 3. Existing-field UPDATE authority is not CREATE authority

The merged Writer1C SIF work source-qualified selected existing V11 fields:

```text
slot1 item3 -> row0 field2 -> In-Plane SIF (ii)
slot1 item4 -> row0 field3 -> Out-Plane SIF (io)
slot2 item3 -> row5 field2 -> In-Plane SIF (ii)
slot2 item4 -> row5 field3 -> Out-Plane SIF (io)
```

That authority permits a narrow in-place update because the existing 10-row record supplies every other byte. CREATE has no such preimage. Writer2 must synthesize all 60 numeric positions, so every emitted value or deliberate default requires source-qualified construction semantics.

## 4. What V11 product documentation adds

The V11 Piping Input -> SIFs & Tees documentation directly establishes important engineering semantics, including:

- node ownership is an SIF application node and is usually an intersection/joint;
- Type controls component/intersection interpretation and is piping-code dependent;
- user-defined in-plane/out-plane SIFs cannot be below 1.0;
- if ii/io are omitted, CAESAR II performs code calculations rather than treating omission as an explicit SIF value;
- Axial Index defaults to 1.0 when not specified;
- Pressure SIF defaults to 1.0 when not specified;
- analogous default rules exist for other selected index/SIF values;
- Weld ID `0` or blank means As Welded and `1` means Finished/Ground Flush in its applicable code/component domains;
- component Type determines which geometry inputs are applicable.

These are engineering/UI defaults. They do **not** by themselves establish the exact numeric neutral-file token that must be emitted to represent an omitted/unspecified input in every V11 SIF field.

CREATE must distinguish:

```text
explicit engineering value 1.0
software-calculated default 1.0
zero meaning not applicable
zero meaning explicit value
blank / omission
9999.99 sentinel
unused/reserved field
```

A Writer cannot collapse these states without a direct neutral encoding rule.

## 5. Unresolved CREATE authority

### 5.1 Items 19..22

V11 neutral documentation only states `19-22` and that items 13..22 are code-specific for IGE/TD/12 in the listed mapping. A complete per-item engineering meaning, domain and construction/default rule is not established for the general Writer2 CREATE contract.

Classification:

```text
POSITION: DIRECT
GENERAL_CREATE_SEMANTICS: UNRESOLVED_PER_CODE
CREATE_WRITABLE: NO
```

### 5.2 Items 23..24

V11 names them as code-related Note options but does not directly state the exact raw V11 neutral encoding for selected / cleared / not specified.

Later V14 documentation explicitly uses `1`, `0`, and `9999.99`, but W2.1 does not backport that later-edition rule to V11 without direct equivalence proof.

Classification:

```text
POSITION: DIRECT
MEANING_CLASS: DIRECT_CODE_NOTE_OPTION
V11_RAW_DEFAULT_SENTINEL_ENCODING: UNRESOLVED
CREATE_WRITABLE: NO
```

### 5.3 Items 27..30

V11 and official V12 both use the 30-item/tee shape but do not name items 27..30.

Version 14 names item27 as B31J Surface Node and 28..30 as B31J unused positions, but Version 13 release documentation states B31J support was introduced in Version 13. Therefore the V14 meaning is edition drift, not V11 authority.

Classification:

```text
V11_ITEM_27: UNRESOLVED
V11_ITEM_28: UNRESOLVED
V11_ITEM_29: UNRESOLVED
V11_ITEM_30: UNRESOLVED
CREATE_WRITABLE: NO
```

### 5.4 Unused second tee slot

The physical schema always reserves two 30-item tee slots. Repository converters often zero-fill unused data, and later V14 documentation states unspecified/unused values are filled with `0.0` for the 42-item schema.

Neither observation qualifies the V11 unused-second-slot representation for production CREATE.

```text
V11_UNUSED_SECOND_SLOT_ENCODING: UNRESOLVED
```

### 5.5 General unspecified/default encoding

V11 product documentation often says what CAESAR calculates when a box is left unspecified. The V11 neutral appendix does not provide one universal statement that all unspecified SIF fields are encoded as zero, blank, 9999.99, or explicit calculated values.

```text
V11_GENERAL_UNSPECIFIED_FIELD_ENCODING: UNRESOLVED
```

## 6. Edition guard

Edition-scoped physical custody is mandatory.

```text
V11/V12: 30 items per tee; 5 rows per tee; 10 rows per auxiliary
V14:     42 items per tee; 7 rows per tee; 14 rows per auxiliary
```

Official Version 13 release notes state that ASME B31J support was added in Version 13. V14 consequently adds B31J data such as Surface Node at item27 and changes/extends the neutral record.

Required future gate:

```text
neutral edition == 11
AND exact SIF block shape == 10 rows
AND V11 construction dataset semanticHash matches qualified dataset
```

No field-number semantics may be borrowed from V14/V15.

## 7. Repository census observations

Repository files provide useful physical observations but not missing semantics.

Confirmed Version-11 real/interface sources include:

```text
Benchmark/CIICompare/BM_CII_SOURCE.CII   SIF blocks = 9
Benchmark/CIICompare/BM_CII_TARGET1.CII  SIF blocks = 9
Benchmark/CIICompare/BM_CII_TARGET2.CII  SIF blocks = 9
Benchmark/CIICompare/SOURCE 3.CII        SIF blocks = 14
Benchmark/CIICompare/TARGET 3-1.CII      SIF blocks = 14
```

`SOURCE 3.CII` and `TARGET 3-1.CII` explicitly identify themselves as CAESAR II Neutral file interface Version 11.00 files. The BM files identify CAESAR II/CADWorx/PIPE interface generation and advertise neutral 11.0000.

Converter-derived V11 files with zero SIF count are not evidence for CREATE defaults. A converter-profile BM file with nine blocks is classified as converter-derived because its repository path and generation custody are known.

Even if every observed item27..30 value were zero, the conclusion would remain:

```text
OBSERVED_ZERO != AUTHORITATIVE_RESERVED_ZERO_DEFAULT
```

## 8. Future allocation policy

The existing Writer2 DELETE machinery proves that the ELEMENT SIF pointer is a 1-based block index and that pointer reindexing is a structural Writer2 concern.

For W2.2, the safest initial structural policy is **append-only block allocation**:

```text
newBlockIndex = oldControlSifBlockCount + 1
append exactly one qualified 10-row block
CONTROL SIF block count += 1
rewrite only requesting ELEMENT pointer from 0 -> newBlockIndex
existing nonzero SIF pointers remain unchanged
```

This is an architecture recommendation, not neutral semantic authority. W2.2 may use it only after proving that append order is compatible with parser/consumer semantics and that shared ownership/request cardinality is exact.

Append-only allocation deliberately avoids unnecessary reindexing and reduces the physical authorization set.

## 9. Required W2.2 handoff data before implementation

W2.2 must not start from this NOT_READY dataset. It requires additional source authority resolving at minimum:

```text
V11 items19..22 complete per-code meaning/default construction rules
V11 items23..24 exact neutral selected/cleared/unspecified encoding
V11 items27..30 meaning or authoritative reserved representation
V11 unused second-tee-slot encoding
V11 exact neutral representation of omitted/defaulted SIF/index values
supported initial Type + piping-code domain
complete source-to-60-position construction rule for that domain
```

A narrow CREATE domain is acceptable if every emitted position is fully source-qualified. For example, a single Type/code combination may be qualified before a generic all-code CREATE writer.

## 10. Required future one-TARGET0 transaction

Once construction semantics are qualified:

```text
TARGET0 exact bytes
  -> canonical BOUND operation scope
  -> exact TARGET element + pointer preimage custody
  -> source-qualified V11 CREATE payload dataset
  -> deterministic append/allocation plan
  -> CONTROL count replacement
  -> ELEMENT pointer replacement
  -> SIF&TEES 10-row append
  -> original-coordinate overlap arbitration with sibling Writer2 claims
  -> one final mutation pass
  -> re-intake
  -> independent complete expected postimage
  -> exact byte equality
```

Writer-reported claims remain testimony. They must never define validator authority.

## 11. Final engineering decision

A parseable synthetic 10-row block is not sufficient. A production CREATE writer would currently have to guess at least one V11 semantic/default/sentinel rule.

Therefore:

```text
NOT_READY_FOR_WRITER2_SIF_CREATE_IMPLEMENTATION
```

The current production blocker must remain fail-closed until a successor source-qualification event resolves a complete, edition-scoped CREATE dataset.

## Source locators

- CAESAR II User's Guide Version 2019 (11.0), April 2019, vendor-authored mirror: `https://pdfcoffee.com/users-guide-6-pdf-free.html`; External Interfaces -> CAESAR II Neutral File -> Auxiliary Element Data, p.1187; Piping Input -> SIFs & Tees, pp.142-156; Input Export Options, pp.1219-1220.
- Hexagon CAESAR II User's Guide Version 12, Auxiliary Element Data: `https://docs.hexagonppm.com/r/en-US/CAESAR-II-Users-Guide/Version-12/1216040`.
- Hexagon CAESAR II User's Guide Version 13, What's New / B31J introduction: `https://docs.hexagonppm.com/r/en-US/CAESAR-II-Users-Guide/Version-13/1281525`.
- Hexagon CAESAR II User's Guide Version 14, Auxiliary Element Data: `https://docs.hexagonppm.com/r/en-US/CAESAR-II-Users-Guide/Version-14/1471418`.
- Repository prior qualification: `docs/cii-writer1c-sif-field-qualification.md`, `docs/cii-writer1c-sif-field-map.csv`, `docs/cii-writer1c-sif-source-ledger.csv`.
