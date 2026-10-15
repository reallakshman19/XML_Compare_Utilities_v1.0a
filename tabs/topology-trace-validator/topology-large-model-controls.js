/** DOM wiring for the explicit large-model threshold and Draft scope controls. */

import { readLargeModelThreshold, writeLargeModelThreshold } from './topology-edit-scope-model.js';

export function wireTopologyLargeModelControls(root, controller, listen, onError) {
  const input = root.querySelector('[data-ttv-large-model-threshold]');
  if (input) input.value = String(readLargeModelThreshold(root.ownerDocument.defaultView?.localStorage));
  listen(root.querySelector('[data-ttv-edit-load-branches]'), 'click', async () => {
    try { await controller.loadEditBranches(root); } catch (error) { onError(error); }
  });
  listen(input, 'change', (event) => {
    const threshold = writeLargeModelThreshold(root.ownerDocument.defaultView?.localStorage, event.target.value);
    event.target.value = String(threshold);
    const status = root.querySelector('[data-ttv-edit-status]');
    if (status) {
      status.textContent = `Large-model threshold set to ${threshold}; Load JSON branches controls only the interactive Draft view. Auto fix remains model-wide.`;
      status.setAttribute('data-status', 'ready');
    }
  });
}
