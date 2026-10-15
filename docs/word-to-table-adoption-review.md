# Word-to-Table adoption review

Status: **REFERENCE_ONLY / PENDING_INSPECTION**.

Issue #974 names a possible external “Word-to-Table” implementation as something to inspect before any reuse/adaptation claim. Connected GitHub repository discovery and code search did not identify one unique repository that can be proven to be the intended implementation. Similar public repository names are not sufficient evidence of identity.

Therefore DocumentEvidence.v1 makes no source, license, compatibility, test-coverage, coordinate, or failure-behavior claim about a Word-to-Table implementation and contains no copied/adapted code attributed to one.

Reuse may be reconsidered only when all of the following are bound to an immutable review record:

- exact repository URL and commit SHA;
- license text applying to that commit and relevant files;
- runtime/dependency requirements;
- table model and coordinate assumptions;
- handling of merged/nested cells, paragraphs, hyperlinks, images, fields, headers/footers and tracked revisions;
- deterministic or environment-dependent behavior;
- malformed-input and ambiguity behavior;
- executable tests demonstrating any behavior proposed for reuse.

Until then the existing XML_Compare_Utilities OOXML/table owners remain authoritative and no acceptance or qualification result depends on Word-to-Table.
