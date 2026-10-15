# Frozen CAESAR II v11 <-> v14 converter source

This directory is a byte-identical vendor copy of the CAESAR II neutral-file v11 <-> v14 conversion engine from:

```text
repository: reallaksh19/3D_Converters
commit: ca8d391ac5f829f53bebb3c37adf0547c34a67b4
```

The upstream repository is not modified by XML_Compare_Utilities. The Python files below are not adapted locally; their Git blob SHA must remain identical to the pinned upstream blob.

| File | Upstream/expected Git blob SHA |
|---|---|
| `cii_v11_v14.py` | `6152f28c0c43b4d70029f360d993da5794310c8a` |
| `cii_v11_v14_format.py` | `56f59fb7e095a887fc84e8a008a5f40acbadaec5` |
| `cii_v11_v14_records.py` | `1a1f7bdd78a4b1479dd474fd9cc61a2b9adef235` |
| `cii_v11_v14_sif.py` | `88c1d80bdb7bd2d5197a56c5be60ac2057c02367` |
| `cii_v11_v14_validate.py` | `8e6896e8b61ac3c90d579139d39b29a6ace1637c` |
| `cii2019_section_rules.py` | `efa894afd241f8ac0b74f6a6e0ecfaedc3d6d76e` |

## Isolation rule

XML_Compare_Utilities already contains `converters/scripts/cii2019_section_rules.py`, but that file is not byte-identical to the pinned 3D_Converters dependency. The version bridge loads this frozen directory as an isolated Python module root so `cii_v11_v14_validate.py` resolves the pinned upstream rules, never the local XML copy.

## Adaptation boundary

Only target-repository integration code outside the frozen Python files may be adapted. The six `.py` files in this directory must not be edited to fit the CII Workspace.

PR #1055 is a **Writer2-only** V14 bridge. It does not authorize V14 Writer1A/B/C existing-field edits.

Writer2 integration is fail-closed:

```text
V11 target
  -> existing qualified CII Workspace Writer2 directly

V14 target
  -> preserve ORIGINAL native V14 bytes and SHA custody
  -> lossless upstream V14->V11 normalization, allow_lossy=false
  -> existing V11 Writer2 + independent V11 postimage validation
  -> upstream V11->V14 canonical baseline/modified representations as differential evidence
  -> XML-side W2.31 exact Writer2 CONTROL/ELEMENT field authority guard
  -> XML-side Writer2 cardinality/change projection onto ORIGINAL V14 bytes
  -> upstream V14->V11 proof of projected V14 output
  -> require exact equality with validated V11 Writer2 postimage
```

W2.31 field coordinates and cardinality/pointer correlation are XML-side Writer2 policy derived from existing V11 writer/custody modules. They are not additions to or modifications of the frozen converter.

The canonical V14 conversion result is not broad final-output authority. The former XML-side requirement that untouched `V14->V11->V14` be byte-identical to original V14 was retired after the exact pinned benchmark proved target-dialect formatting is not cross-version byte-reversible.

No `allow_lossy` conversion is permitted in the PR #1055 Writer2 bridge. A source/target that cannot be represented without converter loss events remains outside bridged authority. The bridge does not fill V11 SIF/HANGER/RESTRAINT CREATE gaps and does not authorize Writer3 topology mutation.
