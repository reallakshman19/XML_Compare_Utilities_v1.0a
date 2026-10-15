export const PIPELINE_ARTIFACT_MATERIALIZATION_ON_DOWNLOAD = 'ON_DOWNLOAD';

export function createPipelineOnDemandTextArtifact(metadata = {}, buildText) {
  if (typeof buildText !== 'function') {
    throw new TypeError('On-demand artifact requires a text builder.');
  }
  const source = metadata && typeof metadata === 'object' ? metadata : {};
  const identity = Object.fromEntries(Object.entries(source).filter(([key]) => key !== 'text'));
  let materialized = false;
  let value = '';
  return Object.freeze({
    ...identity,
    materialization: PIPELINE_ARTIFACT_MATERIALIZATION_ON_DOWNLOAD,
    get text() {
      if (!materialized) {
        const built = buildText();
        if (typeof built !== 'string') throw new TypeError('Artifact text builder must return a string.');
        value = built;
        materialized = true;
      }
      return value;
    },
  });
}
