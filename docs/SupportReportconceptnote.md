# Support Report Builder — Concept Note and Evidence Architecture

**Document:** `docs/SupportReportconceptnote.md`  
**Issue:** `#1154`  
**Current architecture:** Support Report addon inside **Support / Steel Relationship Builder**  
**Primary inputs:** Navisworks Support Report clash XML + optional combined staged-model JSON  
**Output contract:** Owner 21-column A:U Support Report CSV/XLSX contract

## 1. Mission

Build an auditable Support Report from Navisworks line-to-secondary-support clash evidence and enrich it with native model evidence without fabricating engineering data.

The report must answer four separate questions:

1. Which pipe is supported by which secondary PS/SL family?
2. At how many distinct physical support locations does that pipe meet that secondary support?
3. Which primary-support members and native attributes are proven by the staged model?
4. What evidence and fallback basis produced each report value?

## 2. Authority model

Authority is deliberately split.

| Evidence | Authority | Not authority for |
|---|---|---|
| Navisworks clash XML | pipe ↔ secondary-family relationship, observed primary member token, branch/line path, clash/report location | complete native membership, engineering attributes |
| Combined staged-model JSON | current PS/SL member identity, native attributes, native position, ownership/line context, carrier evidence | expected workbook values; report-coordinate replacement without a separately qualified frame/base-anchor mapping |
| Owner XLSX benchmark | output schema and expected result for a qualified benchmark | staged-model engineering source |

No output workbook cell may be fed back into production as native source data.

## 3. Report row grain is location-aware

The row grain is:

```text
secondarySupportFamilyId + fullLineTag + reportLocationCluster
```

A pipe may therefore appear more than once under the same secondary family when Navisworks proves physically separate support locations.

### 3.1 Report-location clustering

`reportLocationCluster` is built from clash points in global millimeters.

Current default reporting tolerance:

```text
locationMergeToleranceMm = 50
```

This tolerance is **only a report-row clustering tolerance**. It is not the Support/Steel analytical member-contact, carrier-contact or topology tolerance.

Rows whose clash points are within the same 50 mm location component remain one report row. Distinct components produce distinct rows. Repeated contact points from the same concrete PS/SL member are also treated as one physical support location even when those individual contact points are more than 50 mm apart; this identity edge does not apply to family-only or unresolved tokens.

### 3.2 Real benchmark controls

**PS-12154 — same physical location:**

`/PS-12154.5` and `/PS-12154.2` occur on pipe `ASIM-1885-2"-D8810003-11441T3-PP-01`, on `/PS-12154-BAR-7`, with clash points approximately 38.4 mm apart. They remain one report row:

```text
/PS-12154.2, /PS-12154.5
```

No multiple-location remark is emitted.

**PS-12120 — multiple physical locations:**

Pipe `/ASIM-1885-2"-P8810365-31441C4-HT-01` appears at five materially distinct clash locations, including pairs separated by 300 mm and additional substantially separated locations. It must produce five report rows. Each split row carries exactly:

```text
Pipe supported at multiple locations
```

The complete PS-12120 benchmark contains 19 clash rows and resolves to 14 location-aware report rows across 9 pipes. `ASIM-1885-4"-W8810126-31441C4-01` is also a valid multi-location pipe and resolves to two report rows. This remark describes row splitting by physical location; it is not triggered merely because two primary-support members share one row.

## 4. Duplicate evidence versus multiple locations

These concepts must stay separate:

- repeated clash evidence for the same member/line/location is duplicate evidence and may be deduplicated;
- repeated contact points from the same concrete member remain one physical location even when the contact points themselves are spread beyond 50 mm;
- REST/GUIDE or other multiple primary members at the same report location belong in one member list;
- the same pipe at separate location clusters produces separate report rows.

For genuinely split multi-location rows, staged members are attributed only when they are directly observed/resolved for that location. Line-wide staged family membership is not broadcast into every split row. `PREV-NAME` may still resolve an observed old member to its authoritative current member. Single-location rows may retain family-line enrichment.

`TOTAL SUPPORT POINTS ON SECONDARY` follows the final location-aware report-row count for the secondary family.

## 5. Family-name mismatch and rename trace

A clash may prove a member token whose family does not match the secondary family, such as observed `/SL-147.1` under secondary `PS-068`.

The row is retained because the secondary-side clash evidence determines the report family relationship. The observed identity is never silently rewritten.

Preferred staged-model resolution order:

1. current member ID exact match;
2. explicit previous-name alias from the staged member (`PREV-NAME`, `PREV_NAME`, equivalent normalized key);
3. unresolved clash-only identity.

If a staged current member explicitly declares the observed old ID as its previous name, the current member becomes `PIPING PRIMARY SUPPORT`, the old identity is preserved in `PREV NAME`, and the JSON trace records `PREVIOUS_NAME_ALIAS`.

`PREV-NAME` is semantically typed for reporting and alias matching. Internal database-reference values beginning `=` are retained as raw trace/debug evidence but are not displayed as previous support names and cannot become rename aliases. Legitimate slash PS/SL names, legacy names such as `PS02689.1`, and `Copy-of-...` names remain eligible.

If no authoritative rename evidence exists, the observed member remains and the report carries a visible family-mismatch/rename-required remark. The application never invents the new PS number.

## 6. Staged JSON Trace

The Support Report dialog accepts an optional staged-model JSON source. It reuses the same combined staged-model source used by Support / Steel Relationship Builder; there is one source authority, not two independent model states.

### 6.1 Preferred mapping — active now

Direct PS/SL member identity is the preferred mapping key:

```text
/PS-068.2
/SL-147.1
```

The resolver uses existing Support/Steel hierarchy reading and line-context evidence. A direct ID with contradictory explicit line context is not silently accepted for enrichment.

### 6.2 Previous-name alias — active after explicit source proof

A staged current member may map an observed old clash identity through an explicit previous-name attribute. This is evidence-driven rename resolution, not heuristic renaming.

### 6.3 Coordinate/base-anchor mapping — later placeholder

A future method may correlate support identity through a base anchor and coordinates when names cannot be trusted. It is intentionally **inactive** in the current production path. No coordinate-based member identity substitution occurs until that method has its own authority definition, tolerance and benchmark qualification.

## 7. JSON trace evidence shown per PS/SL member

For each observed/resolved support member, the report evidence view should expose compact trace data:

- report family and pipe;
- observed clash member ID;
- resolved staged current member ID;
- mapping basis (`DIRECT_MEMBER_ID`, `PREVIOUS_NAME_ALIAS`, `FAMILY_LINE_ENRICHMENT`, unresolved/conflict basis);
- position basis (`NATIVE_MEMBER_POSITION` or unresolved for staged member evidence);
- native POS when available;
- owner branch/full line context;
- source path in the staged JSON hierarchy;
- curated raw attributes relevant to report fields;
- report-location grouping basis and per-row member-attribution basis;
- metadata-only DATUM source IDs/context, attribution basis and conflicts when that fallback is used.

Native staged POS is trace evidence only. Navisworks clash/report location remains the operational report-coordinate authority until coordinate-frame/base-anchor matching has separate qualification.

## 8. Field population from staged JSON

Requested fields and accepted authority direction:

| Report field | Preferred staged evidence |
|---|---|
| SIZE | carrier/pipe `BORE` first; approved alternate bore aliases only when no `BORE` evidence exists; line-name regex only when staged bore evidence is absent |
| SUPPORT TYPE | concrete support member attribute first; qualified family DATUM metadata fallback only under §8.2 |
| PIPING PRIMARY SUPPORT | resolved current concrete native member IDs only; DATUM is never identity |
| PIPING PRIMARY SUPPORT REFERENCE | concrete member reference first; qualified family DATUM metadata fallback only under §8.2 |
| PIPE SCHEDULE | authoritative carrier/pipe schedule attribute only |
| PIPE INSULATION THICKNESS | authoritative carrier/member insulation-thickness key; qualified DATUM `INSU`/explicit alias fallback only under §8.2 |
| PIPE INSULATION TYPE | authoritative insulation-type key only |
| PRIMARY SUPPORT DESCRIPTION | concrete member `DTXR` / approved description alias; qualified family DATUM fallback only under §8.2 |
| PREV NAME | explicit reportable previous-name attribute; DBREF-form `=...` tokens are trace-only |
| coordinates | Navisworks clash/report location; native staged POS is retained as trace evidence only |

### 8.1 SIZE / Bore authority

When staged JSON provides `Bore` / normalized `BORE`, that value is authoritative for report `SIZE`. It outranks `ABORE` and any nominal size parsed from the pipe name. Approved alternate staged bore aliases are consulted only when no `BORE` evidence exists anywhere in the selected authoritative carrier set.

If authoritative `BORE` values conflict, `SIZE` remains blank/conflict and the application does **not** fall back to `ABORE` or pipe-name regex. Pipe-name regex is strictly an XML-only/no-staged-bore fallback.

The system must **not** parse free-text DTXR or unrelated specification strings merely to manufacture pipe schedule or insulation type. Those fields stay blank/unresolved until an accepted source attribute is present.

### 8.2 Family DATUM is metadata-only authority

The Support/Steel source reader preserves `/PS-.../DATUM` and `/SL-.../DATUM` records as semantic role `DATUM`. That role is intentionally **not** a reportable primary-support identity.

A DATUM record may supply metadata only when all of these conditions hold:

1. no concrete native report member has been selected for the row;
2. the row has one physical report location (`locationCountOnPipe <= 1`);
3. the DATUM record is compatible with the report line/branch context;
4. the requested field resolves unambiguously across all compatible DATUM evidence.

The allowed metadata-only fallback fields are limited to:

- `SUPPORT TYPE`;
- `PIPING PRIMARY SUPPORT REFERENCE`;
- `PRIMARY SUPPORT DESCRIPTION`;
- `PIPE INSULATION THICKNESS` (`INSU` and the already governed explicit thickness aliases).

Concrete member attributes and existing carrier authority remain higher-precedence sources. DATUM never becomes `PIPING PRIMARY SUPPORT`, never participates in PREV-NAME rename matching, and never supplies coordinate identity. Multi-location rows deliberately disable DATUM fallback because a family-level DATUM cannot yet be attributed to one split physical location without a separately qualified mapping basis.

If compatible DATUM records disagree for a field, that field remains blank and provenance records an authoritative source conflict. Trace CSV and Debug JSON record the metadata attribution basis, DATUM source IDs/context and conflict evidence. A row enriched only through DATUM metadata remains partial with respect to concrete primary-member resolution.

## 9. Primary Support Site and Zone

Primary Site/Zone come from the primary pipe-side hierarchy or equivalent native ownership evidence. Native staged member `sourcePath` is preferred when it is available; clash primary path is the fallback. Conflicting native Site/Zone values remain blank/conflict and are not overwritten by clash fallback.

The path grammar is discipline-neutral:

```text
site: ...-CU-<discipline>
zone: immediate child ...-CU-<discipline>-<zone>
```

Therefore both of these families are valid:

```text
ASIM-1885-CU-PL
ASIM-1885-CU-PL-S

ASIM-1885-CU-PI
ASIM-1885-CU-PI-D
```

This corrects the previous PL-only projection that left PS-12154 Site/Zone blank despite CU-PI path evidence being present in the clash XML.

## 10. UI and export workflow

Inside **Support / Steel Relationship Builder → Support Report**:

1. Import/paste Support Report clash XML.
2. Optionally import the combined staged-model JSON from the Support Report panel. This writes to the same shared staged-model source used by the Input tab.
3. Build Support Report.
4. Review row table, completeness state, diagnostics and JSON trace evidence.
5. Export the Owner-contract Report CSV/XLSX, deterministic Trace CSV, or lossless Debug JSON.

The 21-column report artifact remains deliberately compact. Trace/debug sidecars carry the decision trail, including location grouping, member attribution, native POS, rejected PREV-NAME DBREF values and metadata-only DATUM attribution.

XML-only reports remain allowed but are labeled partial. Staged-model changes invalidate existing report/export state until rebuilt.

## 11. Provenance and fail-visible behavior

Every report row keeps field-level provenance. Key cases remain visible:

- native concrete member attribute;
- native membership;
- native position as trace evidence;
- native member hierarchy/path;
- authoritative family DATUM metadata attribute;
- authoritative carrier attribute;
- clash relationship/group derivation;
- clash member or coordinate fallback;
- source conflict;
- unresolved.

Location splitting, member attribution, rename resolution, DATUM metadata recovery and staged mapping add evidence; they do not weaken existing fail-closed parser/member/carrier rules.

## 12. Benchmark matrix

| Benchmark | Purpose |
|---|---|
| `SL-097 and PS-007.xlsx` + frozen XML fixture | Owner 21-column contract and 10-row golden parity target |
| `SupportreportXML-PS-068_PS-12154.xml` | family-name mismatch + same-location multiple-member control + CU-PI Site/Zone |
| `SupportreportXML-PS-12120.xml` | 19-clash → 14-row complete location-aware report; two multi-location pipe controls |
| `1885_NC.json` at Owner-provided 3D_Converters commit | real staged-model member/attribute/POS/Bore/DATUM evidence |

## 13. Remaining qualification boundary

The Support Report architecture can now be exercised with real repository benchmark XML and staged JSON evidence. Full cell-for-cell parity for any workbook remains benchmark-specific and must be proven from the corresponding authoritative staged source. Coordinate/base-anchor member identity remains intentionally inactive. External SheetJS/browser deployment checks remain separate delivery qualifications.

The final rule remains simple: **show evidence, preserve uncertainty, and never fill an engineering cell merely because a value looks plausible.**
