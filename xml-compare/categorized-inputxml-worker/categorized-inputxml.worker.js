import { installCategorizedInputXmlWorkerRuntime } from './worker-runtime.js';

export const categorizedInputXmlWorkerRuntime = installCategorizedInputXmlWorkerRuntime({
  scope: globalThis,
});
