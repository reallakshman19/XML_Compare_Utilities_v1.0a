# PS Family Clash Audit

`PS Family Clash Audit` is a Utilities-tab audit app for comparing Navis clash XML against an expected PS family register and an optional element-detail CSV.

The audit result is a downstream report. It does not mutate the Navis XML, the expected register, the element-detail CSV, or the XML Compare core workflow.

## Operator workflow

1. Open **Utilities**.
2. Click the **PS clash check** tile.
3. Use the **PS Family Clash Audit** popup that appears.
4. Load or paste the three inputs:
   - **Clash XML** from Navis clash detective.
   - **Expected PS CSV** containing the expected PS members.
   - **Element Detail CSV** containing line, support, gap, reference, and position evidence.
5. Choose **Source side**:
   - `Auto` detects the support/source side from the clash row.
   - `Left clash object` forces the left object as source.
   - `Right clash object` forces the right object as source.
6. Use **Source family** only when the source family must be forced. Leave it blank for auto-detection from the expected CSV.
7. Set **POS tolerance mm**. The default is `25` mm.
8. Click **Run Audit**.
9. Review the summary, switch report tabs, and export the required CSV or JSON outputs.
10. Click **Close** to remove the popup.

## Inputs

1. **Clash XML** exported from Navis clash detective.
2. **Expected PS list CSV** containing at least `Item Name` and optionally `PDMS DESC`.
3. **Element Detail CSV** containing richer engineering attributes:
   - `Name of the element`
   - `p1bore`
   - `pipe`
   - `RTEXT of detailing text`
   - `SUPPORT GAP`
   - `Reference of the element`
   - `Position`
   - `ISOMETRIC NOTES`

Files can be loaded with the browser file picker or pasted directly into the text areas. The audit engine always reads the visible text-area contents.

## Official sample fixtures

Sample files are available under `samples/ps-family-clash-audit/`:

- `sample-clash.xml`
- `sample-expected.csv`
- `sample-element-detail.csv`

The sample set proves a small end-to-end case with one found expected member, two missing expected members, one out-of-family clash row, Copy identity preservation, POSFamily output, and JSON/CSV export generation.

## Core rules

- `Copy-(n)-of-...` is preserved as exact member identity. It is not normalized to the original PS name.
- Leading slash is ignored for matching only; display text remains human-readable.
- Family root is used only for grouping, for example `Copy-(2)-of-PS-11147.9` belongs to root `PS-11147` but remains a distinct member.
- Line-family data such as `D8810311` and the full line/branch node are preserved in clash rows and exports.
- POSFamily is derived only from E/S/U position proximity. Line number, pipe tag, and bore do not decide POSFamily membership.
- POS tolerance is applied independently to E, S, and U.
- Default POSFamily tolerance is `±25 mm`.

## Source family override

When **Source family** is blank, the audit detects the family from the expected CSV. When entered manually, the value is trimmed and normalized to uppercase before being passed to the audit engine.

Use the override when the expected CSV is partial, mixed, or intentionally does not provide the source family root that should appear in reports and export filenames.

## Output report tabs

- **Coverage**: one row per expected member, with found/missing status and enrichment where available.
- **Clash Rows**: normalized clash observations from the XML, enriched with family and element-detail evidence.
- **Missing**: expected members not observed in the clash rows.
- **Out-of-Family**: rows where the against member does not belong to the configured source family.
- **Duplicates**: members observed more than once.
- **Line Families**: grouped line-family evidence retained from pipe/branch data.
- **POSFamilies**: position-cluster groups based on E/S/U tolerance only.
- **Source vs POSFamily**: source-family to POSFamily count summary.
- **Diagnostics**: warnings and validation messages produced during parsing or audit.

## Exports

The UI exposes exports for each major report:

- Coverage CSV
- Clash Rows CSV
- Missing CSV
- Out-of-Family CSV
- Duplicates CSV
- Line Families CSV
- POSFamilies CSV
- Source vs POSFamily CSV
- Diagnostics CSV
- Audit JSON

Export filenames include the source family where available.

## Benchmark and compliance gates

Run:

```bash
npm run test:ps-family
npm test
```

Current PS Family gates cover:

- Parser correctness
- PS-11147 audit correctness
- PS-12005 POSFamily correctness
- POS tolerance boundary
- Export availability
- Configurable source side, source family, and tolerance
- File-input configuration
- Report-tab rendering
- UI smoke
- Snapshot/export schema stability
- Medium-size performance
- Accessibility label coverage
- Official sample fixture reproducibility
- PS Family implementation compliance: scoped 300-line file budget and no default exports

## Benchmark baseline

Golden PS-11147 clash fixture:

- Expected family members: 17
- Clash rows: 11
- Unique found in-family members: 7
- Missing members: 10
- Out-of-family rows: 1
- Duplicate members: 3

Golden PS-12005 element-detail fixture:

- Element details: 3 rows
- POSFamily count: 1
- Source vs POSFamily count for `PS-12005`: 1
- Line family retained: `D8810242`
