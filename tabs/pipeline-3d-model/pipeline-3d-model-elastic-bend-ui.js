import {
  createEmptyPipelineEngineeringConfigurationDraft,
} from './pipeline-3d-model-engineering-configuration-fields.js';
import {
  PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY,
  savePipelineEngineeringConfigurationDraft,
} from './pipeline-3d-model-engineering-configuration-storage.js';
import {
  installPipelineEngineeringConfigurationUi,
} from './pipeline-3d-model-engineering-configuration-ui.js';

function installPersistentClear(host) {
  if (!host?.addEventListener) return () => {};
  const controller = new AbortController();
  host.addEventListener('click', (event) => {
    const button = event.target?.closest?.('[data-p3d-config-action="clear"]');
    if (!button) return;
    savePipelineEngineeringConfigurationDraft(
      createEmptyPipelineEngineeringConfigurationDraft(
        PIPELINE_ENGINEERING_CONFIGURATION_STORAGE_KEY,
      ),
    );
  }, { capture: true, signal: controller.signal });
  return () => controller.abort();
}

export function installPipelineElasticBendSettingsUi(dialog) {
  const removePersistentClear = installPersistentClear(dialog);
  const removeConfigurationUi = installPipelineEngineeringConfigurationUi(dialog);
  return () => {
    removePersistentClear();
    removeConfigurationUi?.();
  };
}
