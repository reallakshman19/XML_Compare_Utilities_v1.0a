# CAESAR GRE bend qualification fixture request

Create every fixture in one documented CAESAR II version/build and unit file. Preserve and SHA-256 hash the native job, original InputXML, imported job, re-exported InputXML, unit file, screenshots, and operator log. Bind the package to the generating repository commit.

| ID | Required case |
|---|---|
| F1 | ISO 14692-2005, 90-degree bend, no user curvature nodes |
| F2 | ISO 14692-2017, 90-degree bend, no user curvature nodes |
| F3 | Project GRE code and edition, non-90-degree bend |
| F4 | Project GRE code and edition, explicit midpoint curvature node |
| F5 | Project GRE code and edition, fitting thickness different from pipe |
| F6 | P3D tangency-separated topology import attempt |
| F7 | CAESAR-native consecutive entering/leaving-element control |

Record every import warning and error verbatim. An accepted import must be warning-free. Re-export comparisons must contain structured evidence for bend ownership, connectivity, semantic node roles, radius, fitting thickness, TYPE numeric and lexical values, NUM_MITER numeric and lexical values, curvature-node roles, NUMELT, NUMBEND, units, code/edition, and laminate. Do not edit or normalize XML between steps.

## F6/F7 decisive execution order

1. Record the exact CAESAR version, build, unit-file identity, operator, machine, and session start.
2. Hash the native job, unit file, original InputXML, screenshots, and operator log before import.
3. Execute F6 first in a clean job. Capture every warning or error verbatim and do not dismiss a diagnostic without recording its identifier and disposition.
4. When F6 is accepted without warnings, save and hash the imported job, re-export without editing, hash the re-export, and complete the semantic comparison ledger.
5. When F6 is rejected, preserve the rejected imported job or failure package, record the exact rejection evidence, and classify round trip as not applicable. Do not modify F6 to make it import.
6. Execute F7 as the CAESAR-native consecutive-element control using the same build and unit file.
7. Compare F6 and F7 using entering-element ownership, entering-to/leaving-from continuity, tangency roles, inactive-corner exclusion, curvature-node roles, radius, fitting thickness, TYPE, NUM_MITER, NUMELT, and NUMBEND.

Only these outcomes are permitted:

```text
F6 accepted and semantically round-trips
→ F6_ACCEPTED_DIRECT

F6 rejected and F7 accepted and semantically round-trips
→ F6_REJECTED_F7_ACCEPTED

Any other result
→ UNRESOLVED / STILL_BLOCKED
```
