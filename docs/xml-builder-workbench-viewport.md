# XML Builder Workbench Viewport

The XML Builder preview consumes the domain-neutral Workbench Viewport without changing XML Compare records, the loaded-preview bundle, `CategorizedGraph.v1-preview-shadow` or `universal-preview-model/v1-shadow`.

## Data authority

- XML Compare workspace records remain source authority.
- `universal-loaded-preview-bundle/v1-shadow` remains the loaded-preview boundary.
- `CategorizedGraph.v1-preview-shadow` and `universal-preview-model/v1-shadow` remain Tree/Pivot authority.
- Search results, filters, virtual windows, named views, selection and viewport transforms are view-only projections.
- Tree and Pivot authoritative arrays are never replaced by viewport operations.

## Modes

- **Tree** — hierarchy depth and deterministic projected-row coordinates.
- **Pivot** — deterministic column and projected-row coordinates.
- **Side by Side** — linked selection with independent horizontal scaling.
- **Diagnostics** — read-only context, storage and preview diagnostics.

Loaded contexts are labelled **Loaded preview**. When no usable loaded target identity exists, the existing sample model is visibly labelled **Sample preview**. Export and editing remain locked.

## Large previews

Tree and Pivot use fixed-height virtual rows with bounded overscan. The DOM contains only the visible window rather than the complete collection. Search and structured filters produce immutable projections that reference the authoritative rows in their original order.

Literal search is case-insensitive and requires every whitespace-delimited token to match. Tree can be filtered by level. Pivot can be filtered by level, block and source. A selected identity remains authoritative when hidden by the current projection, and the inspector reports that hidden state.

## Named views

Named views are scoped to the XML Builder context fingerprint. They save only mode, search text, filters, Tree/Pivot transforms, scroll anchors and selected identities. They do not store source rows, graph nodes, mappings, recipe data or export state. Current-view and named-view persistence use separate versioned keys.

## Lifecycle

One per-document lifecycle owns the popup, two hosts, two virtual controllers, search/filter listeners, named-view handlers, scroll/keyboard listeners and cleanup. Reopening destroys the previous lifecycle before mounting a replacement. No body-wide observer, unmanaged animation frame or cross-document popup singleton is used.

## Validation

Focused tests certify literal search, deterministic projections, 10,000/20,000-row virtual-window bounds, named-view isolation/corruption handling, authoritative collection identity and lifecycle guards. Chromium acceptance certifies bounded DOM rows, virtual navigation and reveal, search/filter behavior, hidden selection, named-view CRUD, context isolation, persistence, read-only diagnostics and all XMLB-VP-001 scenarios.
