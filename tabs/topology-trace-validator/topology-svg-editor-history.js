/** Snapshot command history shared by numeric and pointer-based draft edits. */
export class TopologySvgEditorCommand {
  constructor(model, description, mutate) {
    if (!model?.snapshot || !model?.restore) throw new TypeError('A snapshot-capable editor model is required.');
    if (typeof mutate !== 'function') throw new TypeError('Editor command mutation must be a function.');
    this.model = model; this.description = description || 'Topology draft edit'; this.mutate = mutate;
    this.before = null; this.after = null;
  }
  execute() {
    if (this.after) return this.model.restore(this.after, `redo:${this.description}`);
    this.before = this.model.snapshot(); this.mutate(this.model); this.after = this.model.snapshot();
  }
  undo() {
    if (!this.before) throw new Error('Editor command has not been executed.');
    this.model.restore(this.before, `undo:${this.description}`);
  }
}

export class TopologySvgEditorHistory extends EventTarget {
  constructor(limit = 100) { super(); this.limit = Math.max(1, Number(limit) || 100); this.undoStack = []; this.redoStack = []; }
  get canUndo() { return this.undoStack.length > 0; }
  get canRedo() { return this.redoStack.length > 0; }
  execute(command) {
    command.execute(); this.undoStack.push(command); if (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack = []; this.emit('execute', command); return true;
  }
  undo() { const command = this.undoStack.pop(); if (!command) return false; command.undo(); this.redoStack.push(command); this.emit('undo', command); return true; }
  redo() { const command = this.redoStack.pop(); if (!command) return false; command.execute(); this.undoStack.push(command); this.emit('redo', command); return true; }
  clear() { this.undoStack = []; this.redoStack = []; this.emit('clear', null); }
  emit(action, command) {
    this.dispatchEvent(new CustomEvent('historyChanged', { detail: { action, description: command?.description ?? '', canUndo: this.canUndo, canRedo: this.canRedo } }));
  }
}

export function moveTopologySupportCommand(model, objectKey, position) {
  return new TopologySvgEditorCommand(model, `Move support ${objectKey}`, (draft) => draft.moveSupport(objectKey, position));
}
