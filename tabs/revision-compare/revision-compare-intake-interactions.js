/** Direct drag-and-drop intake for the existing Revision Compare file inputs. */

const DROP_SLOT_SELECTOR = '[data-revc-drop-slot]';
const DROP_ACTIVE_CLASS = 'is-revc-drop-active';

function droppedFiles(dataTransfer) {
  return Array.from(dataTransfer?.files ?? []);
}

export function selectRevisionCompareDropFile(dataTransfer) {
  const files = droppedFiles(dataTransfer);
  if (files.length === 1) return Object.freeze({ file: files[0], error: null });
  const error = files.length > 1
    ? 'Drop one staged JSON file at a time.'
    : 'Drop exactly one staged JSON file.';
  return Object.freeze({ file: null, error });
}

export function revisionCompareDropSlot(target) {
  return target?.closest?.(DROP_SLOT_SELECTOR) ?? null;
}

export function revisionCompareDropInput(slot) {
  if (!slot || slot.dataset?.revcDropEnabled === 'false') return null;
  const input = slot.querySelector?.('[data-revc-file]') ?? null;
  return input && !input.disabled ? input : null;
}

function announce(root, message) {
  const live = root.querySelector?.('[data-revc-live]');
  if (live) live.textContent = message;
}

function activeSlots(root) {
  return root.querySelectorAll?.(`${DROP_SLOT_SELECTOR}.${DROP_ACTIVE_CLASS}`) ?? [];
}

function setActiveSlot(root, slot) {
  for (const current of activeSlots(root)) current.classList.remove(DROP_ACTIVE_CLASS);
  slot?.classList?.add(DROP_ACTIVE_CLASS);
}

function setDropEffect(dataTransfer, value) {
  if (dataTransfer) dataTransfer.dropEffect = value;
}

function assignDroppedFile(input, file) {
  const windowRef = input.ownerDocument?.defaultView;
  const DataTransferCtor = windowRef?.DataTransfer;
  const EventCtor = windowRef?.Event;
  if (!DataTransferCtor || !EventCtor) throw new Error('Direct file drop is unavailable in this browser. Use the file picker.');
  const transfer = new DataTransferCtor();
  transfer.items.add(file);
  input.files = transfer.files;
  input.dispatchEvent(new EventCtor('change', { bubbles: true }));
}

function slotLabel(slot) {
  return slot?.dataset?.revcDropLabel || 'revision slot';
}

function dragOver(root, event) {
  const slot = revisionCompareDropSlot(event.target);
  if (!slot) return;
  event.preventDefault();
  const input = revisionCompareDropInput(slot);
  setDropEffect(event.dataTransfer, input ? 'copy' : 'none');
  setActiveSlot(root, input ? slot : null);
}

function dragLeave(event) {
  const slot = revisionCompareDropSlot(event.target);
  if (!slot) return;
  if (!event.relatedTarget || !slot.contains?.(event.relatedTarget)) slot.classList.remove(DROP_ACTIVE_CLASS);
}

function dropFile(root, event) {
  const slot = revisionCompareDropSlot(event.target);
  if (!slot) return;
  event.preventDefault();
  event.stopPropagation?.();
  setActiveSlot(root, null);
  const input = revisionCompareDropInput(slot);
  if (!input) return announce(root, `${slotLabel(slot)} is not available for file drop.`);
  const selection = selectRevisionCompareDropFile(event.dataTransfer);
  if (selection.error) return announce(root, selection.error);
  try {
    assignDroppedFile(input, selection.file);
    announce(root, `Loading dropped file into ${slotLabel(slot)}.`);
  } catch (error) {
    announce(root, error.message);
  }
}

function trackedListener(root, type, handler) {
  root.addEventListener(type, handler);
  return () => root.removeEventListener(type, handler);
}

export function bindRevisionCompareIntakeInteractions(root) {
  if (!root?.addEventListener) throw new TypeError('Revision Compare intake root is required.');
  const cleanups = [
    trackedListener(root, 'dragenter', (event) => dragOver(root, event)),
    trackedListener(root, 'dragover', (event) => dragOver(root, event)),
    trackedListener(root, 'dragleave', dragLeave),
    trackedListener(root, 'drop', (event) => dropFile(root, event)),
    trackedListener(root, 'dragend', () => setActiveSlot(root, null)),
  ];
  return () => cleanups.splice(0).reverse().forEach((cleanup) => cleanup());
}
