# CII FORCMNT retained-oracle scan

Chain: `CII-FIND-REPLACE-V14`
Post-merge base main: `c80aa9b4f670e90b831d65a9f16c775a50096271`
Scope: evidence only; no FORCE/FORCMNT mutation authority.

## Qualification question

Can existing retained or public evidence prove the complete FORCE/FORCMNT ownership chain required before enabling Find & Replace FORCE scope?

Required oracle:

1. CAESAR II v14 target.
2. CONTROL FORCMNT count > 0.
3. Exact ELEMENT FORCMNT pointer > 0.
4. Pointer resolves to one exact 20-physical-row FORCMNT block.
5. Both 10-row specifications can be independently reconstructed.
6. Node/vector fields and unused-spec behavior are observable.
7. Adjacent element/block falsifiers prove that no unrelated byte range is writable.

## Retained specimens inspected

### XML_Compare_Utilities / SOURCE 3.CII

- path: `Benchmark/CIICompare/SOURCE 3.CII`
- Git blob: `20c0c37014004fb9de46e3e4d01f0c62535495d5`
- version: 11
- CONTROL row 2: `37 20 0 132 1 0`
- FORCMNT count: **0**
- result: useful for NODENAME/DISPLMNT retained evidence, not a FORCMNT oracle.

### 3D_Converters / RMS-BLOW-1.cii

- path: `Benchmarks/XML to CII 2019/Sample 1.1/RMS-BLOW-1.cii`
- Git blob: `dfa2b2721c64a0b0d38784fc7975be885ae817e7`
- version: 11
- CONTROL row 2: `11 11 0 18 0 0`
- FORCMNT count: **0**

### 3D_Converters / 1001-P - COPY[BenchMark].CII

- path: `Benchmarks/INPUT XML to CII 2019/1001/1001-P - COPY[BenchMark].CII`
- Git blob: `6ee776c62632cf4058a9373abd966987d7eaf0cf`
- version: 11
- CONTROL row 2: `6 6 0 2 3 0`
- FORCMNT count: **0**

### 3D_Converters / AML-78 benchmark

- path: `Benchmarks/INPUT XML to CII 2019/7/AML-78-SYS_007_08-03-2024[BENCHMARK}.CII`
- Git blob: `8bec33bf0d0244510a1931fc85644ef437ea9f2d`
- version: 11
- CONTROL row 2: `26 27 0 26 2 0`
- FORCMNT count: **0**

### 3D_Converters / INLET-SEPARATOR workflow CII

- path: `Benchmarks/INPUT XML to CII 2019/INLET SEP/INLET-SEPARATOR-SKID-C2_INPUT_inputxml_to_cii2019_workflow.cii`
- Git blob: `0ea75ecb413465dadb033661968b156762e37a15`
- version: 11 profile
- CONTROL row 2: `11 9 0 5 0 0`
- FORCMNT count: **0**

### 3D_Converters / older B7410250 benchmark

- path: `Benchmarks/XML to CII 2014/B7410250/SYS-30-B7410250 [CII BENCHMARK].cii`
- Git blob: `a18e20ac2a0acb845a3e1ccfc171a4f94a491b28`
- legacy version 4.5 profile
- CONTROL row 2: `14 7 0 3 0 0`
- FORCMNT count: **0**

## Repository-wide result

Search over retained `.cii` files with `#$ FORCMNT` found many files whose section is present structurally, but section presence is not qualification evidence. The inspected retained candidates above all carry CONTROL FORCMNT=0.

No retained textual v14 `.CII` with nonzero FORCMNT was found in the connected repositories. The known v14 archive remains unavailable as a directly executable retained nonzero FORCE oracle.

## External documentation/search result — 2026-09-02

Official CAESAR II v15 documentation independently confirms the logical join and exported semantics:

- `INPUT_BASIC_ELEMENT_DATA.FORCMNT_PTR = INPUT_FORCMNT.FORCMNT_PTR`;
- FORCE/MOMENT data exports `FORCMNT_NUM`, `NODE_NUM`, `VECTOR_NUM`, `FX`, `FY`, `FZ`, `MX`, `MY`, `MZ`.

Official documentation pages inspected:

- `https://docs.hexagonppm.com/r/en-US/CAESAR-II-Users-Guide/15/425681`
- `https://hexagonppm.fluidtopics.net/r/en-US/CAESAR-II-Users-Guide/15/425675`

Neutral-file documentation also confirms that one force/moment specification occupies ten neutral-file lines and one auxiliary contains two specifications, i.e. twenty physical rows total.

Public web/GitHub search for a textual `.CII` combining `Neutral file interface Ver 14.00` with a nonzero FORCMNT payload did not produce a qualifying specimen. Documentation is therefore schema evidence only, not byte-custody authority.

## Authority conclusion

FORCMNT structure is partially documented:

- ELEMENT auxiliary pointer relation is documented;
- CONTROL cardinality and repository v14 fixed-field authority remain documented;
- v14 physical cardinality is 20 rows per FORCMNT auxiliary;
- force/moment semantics include node/vector identity and FX/FY/FZ/MX/MY/MZ components.

But **no nonzero v14 physical oracle has been obtained**. Therefore:

```text
FORCE intake                         BLOCKED
FORCE mutable spans                  0
FORCMNT documented structure         PARTIAL_PASS
retained/public nonzero v14 ownership NOT_QUALIFIED
FORCE mutation authority             NONE
```

Do not infer FORCE mutation ownership from `parser/sections/forces.js`; that reader collapses the fixed-format physical representation and is not byte-mutation authority.

## Exact next action

Acquire or retain one CAESAR II v14 CII with CONTROL FORCMNT > 0 and at least one positive ELEMENT FORCMNT pointer. Preserve exact bytes/blob hash, then prove pointer-to-20-row ownership, both 10-row specs, node/vector semantics, unused-spec behavior and adjacent falsifiers before any FORCE product change.
