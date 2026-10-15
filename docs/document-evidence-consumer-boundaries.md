# Document Evidence Consumer Boundaries

## Shared platform authority

DocumentEvidence.v1 establishes only what an identified source/surface contains and how that evidence maps geometrically. The shared layer may render pages, retain native/OCR observations, reconcile extraction evidence, preserve generic geometry/path/cubic control points, validate transforms, produce overlays, and retain correction lineage.

`accepted` is extraction authority only; it is not downstream publication, benchmark, screening, or design authority.

## Domain consumer responsibility

A chart or other domain consumer owns interpretation, including choosing which text observations are labels, parsing units and values, classifying generic lines/paths, choosing calibration models, fitting residuals, sampling paths, assigning series identity, and deciding downstream authority.

A cubic path remains generic evidence. A consumer may evaluate

`B(t) = (1-t)^3 P0 + 3(1-t)^2 t C1 + 3(1-t)t^2 C2 + t^3 P3`

without the shared platform declaring that path to be a chart curve.

## Calibration lineage

Consumer outputs should retain source/page/surface identity, accepted label observations, geometry/path evidence hashes, calibration model and residuals, path segment/parameter for reconstructed points, correction hashes affecting labels, and the consumer profile/version.

For a linear axis a consumer may fit `v = a p + b`; for a logarithmic axis it may fit `ln(v) = a p + b` only for positive values. These are consumer interpretations, not DocumentEvidence decisions.

## Overlay round trip

Consumer-generated points or curves return to the shared UI as ordinary overlays in named document coordinates. The consumer performs any inverse domain calibration; the platform applies only the generic document-to-browser transform. Stale source/surface/transform identity blocks aligned display.
