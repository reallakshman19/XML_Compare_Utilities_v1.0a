/** Presentation-only viewer backend vocabulary for Revision Compare. */
export const REVISION_COMPARE_VIEWER_BACKEND = Object.freeze({
  WEBGL: 'WEBGL',
  SVG: 'SVG',
});

export function normalizeRevisionCompareViewerBackend(value) {
  return value === REVISION_COMPARE_VIEWER_BACKEND.SVG
    ? REVISION_COMPARE_VIEWER_BACKEND.SVG
    : REVISION_COMPARE_VIEWER_BACKEND.WEBGL;
}

export function revisionCompareViewerBackendLabel(value) {
  return normalizeRevisionCompareViewerBackend(value) === REVISION_COMPARE_VIEWER_BACKEND.SVG
    ? 'Engineering SVG'
    : '3D (WebGL)';
}

export function isRevisionCompareSvgBackend(value) {
  return normalizeRevisionCompareViewerBackend(value) === REVISION_COMPARE_VIEWER_BACKEND.SVG;
}
