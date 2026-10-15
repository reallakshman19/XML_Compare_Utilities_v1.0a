export function createPipelineArtifactSession(buildArtifacts) {
  if (typeof buildArtifacts !== 'function') {
    throw new TypeError('Artifact session requires an artifact builder.');
  }
  let sourceOutput = null;
  let artifacts = null;
  function resolve(output) {
    if (artifacts && sourceOutput === output) return artifacts;
    const built = buildArtifacts(output);
    if (!Array.isArray(built)) throw new TypeError('Artifact builder must return an array.');
    sourceOutput = output;
    artifacts = built;
    return artifacts;
  }
  function reset() {
    sourceOutput = null;
    artifacts = null;
  }
  return Object.freeze({ resolve, reset });
}
