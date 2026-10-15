import {
  ENGINEERING_SVG_ADAPTER_BRIDGE_SCHEMA,
  ENGINEERING_SVG_ADAPTER_DEPENDENCIES_SCHEMA,
} from './engineering-svg-adapter-bridge.js';
import {
  ENGINEERING_SVG_SHELL_ACCESS_MODE,
  createEngineeringSvgWorkspaceShell,
} from './engineering-svg-workspace-shell.js';

export * from './engineering-svg-property-inspector-view.js';
export * from './engineering-svg-workspace-shell.js';

export function createEngineeringSvgWorkspaceShellFromAdapterBridge(options = {}) {
  const bridge = options.bridge;
  if (bridge?.schema !== ENGINEERING_SVG_ADAPTER_BRIDGE_SCHEMA || typeof bridge.getDependencies !== 'function') {
    throw new TypeError('Engineering SVG shell adapter mount requires EngineeringSvgAdapterBridge.v1.');
  }
  const dependencies = bridge.getDependencies();
  if (dependencies?.schema !== ENGINEERING_SVG_ADAPTER_DEPENDENCIES_SCHEMA) {
    throw new TypeError('Engineering SVG adapter bridge returned invalid dependencies.');
  }
  const descriptorMode = dependencies.descriptor?.accessMode;
  if (!Object.values(ENGINEERING_SVG_SHELL_ACCESS_MODE).includes(descriptorMode)) {
    throw new TypeError('Engineering SVG adapter descriptor has an unsupported access mode.');
  }
  if (options.accessMode != null && options.accessMode !== descriptorMode) {
    throw new TypeError('Engineering SVG shell access mode must match the adapter descriptor.');
  }
  return createEngineeringSvgWorkspaceShell({
    ...options,
    bridge: undefined,
    accessMode: descriptorMode,
    sceneSource: dependencies.sceneSource,
    propertyProvider: dependencies.propertyProvider,
    commandGateway: dependencies.commandGateway,
  });
}
