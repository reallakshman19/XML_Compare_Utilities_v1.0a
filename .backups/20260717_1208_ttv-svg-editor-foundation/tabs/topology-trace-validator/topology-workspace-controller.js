/** Composes the legacy evidence validator and the dedicated parity controller. */

const TRACE_KINDS = new Set(['source', 'canonical', 'ledger', 'inputXml']);
const PARITY_KINDS = new Set(['canonical', 'ledger', 'scene', 'parsed', 'report', 'ciiProjection']);

export function createTopologyWorkspaceController(traceController, parityController) {
  async function loadArtifact(kind, text, fileName) {
    const results = {};
    if (TRACE_KINDS.has(kind)) results.trace = await traceController.loadArtifact(kind, text, fileName);
    if (PARITY_KINDS.has(kind)) results.parity = await parityController.loadArtifact(kind, text, fileName);
    if (!TRACE_KINDS.has(kind) && !PARITY_KINDS.has(kind)) throw new RangeError(`Unknown topology workspace artifact: ${kind}`);
    return Object.freeze(results);
  }

  async function loadFile(kind, file) {
    if (!file || typeof file.text !== 'function') throw new TypeError(`A file is required for ${kind}.`);
    return loadArtifact(kind, await file.text(), file.name);
  }

  function validate() {
    const trace = traceController.validate();
    const parity = parityController.validate();
    return Object.freeze({ trace, parity });
  }

  function evidence() {
    return Object.freeze({ trace: traceController.evidence(), parity: parityController.evidence() });
  }

  function destroy() {
    traceController.destroy();
    parityController.destroy();
  }

  return Object.freeze({
    loadArtifact,
    loadFile,
    validate,
    evidence,
    destroy,
    render: traceController.render,
    select: traceController.select,
    focusSearchResult: traceController.focusSearchResult,
    setMode: traceController.setMode,
    setProjection: traceController.setProjection,
    setFilters: traceController.setFilters,
    setSearch: traceController.setSearch,
    setVisibility: traceController.setVisibility,
    setBottomTab: traceController.setBottomTab,
    fitView: traceController.fitView,
    zoomView: traceController.zoomView,
    assertNoMutation: traceController.assertNoMutation,
    downloadEnrichedInputXml: traceController.downloadEnrichedInputXml,
    parity: parityController,
  });
}

export const _test = Object.freeze({ TRACE_KINDS, PARITY_KINDS });
