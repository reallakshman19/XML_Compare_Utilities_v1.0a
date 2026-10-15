# 1884 vs 1885 typicality benchmark

Purpose: execute the merged Support Report typicality engine against every XML payload contained in `benchmarks/1884.zip` and `benchmarks/1885.zip`.

This benchmark is observational unless a relationship is independently known. It must not force unknown support-family pairs into positive/negative labels.

The runner records:
- canonical family inventories;
- structural gate results and residuals;
- accepted/rejected family correspondence;
- location assignment result, ambiguity class, and matching mode;
- 3D/2D/1D dimensional evidence;
- SUPPORT TYPE result;
- repeated member-suffix evidence;
- PREV NAME fuzzy evidence;
- unmatched/ambiguous location counts;
- the active provisional profile ID.

The machine-readable result is uploaded as the `typicality-1884-vs-1885` workflow artifact.
