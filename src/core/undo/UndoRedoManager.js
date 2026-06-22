/**
 * 命令栈系统 - UndoRedo (Command Pattern)
 * 所有可逆操作封装为 Command 对象，支持撤销/重做
 */
import emitter, { COMMAND_EVENTS } from '../eventBus.js'

class UndoRedoManager {
  constructor() {
    this._undoStack = []
    this._redoStack = []
    this._maxSteps = 100
    this._batchDepth = 0
    this._currentBatch = null
  }

  get canUndo() { return this._undoStack.length > 0 }
  get canRedo() { return this._redoStack.length > 0 }
  get undoCount() { return this._undoStack.length }
  get redoCount() { return this._redoStack.length }

  /** 执行命令并压入 undo 栈 */
  execute(command) {
    if (!command || typeof command.execute !== 'function') {
      console.warn('[UndoRedo] Invalid command:', command)
      return
    }

    try {
      command.execute()
      this._undoStack.push(command)
      // 新命令清空 redo 栈
      this._redoStack = []
      this._trimStack()
      emitter.emit(COMMAND_EVENTS.COMMAND_EXECUTED, { command: command.name || 'unnamed' })
      emitter.emit(COMMAND_EVENTS.COMMAND_STACK_CHANGED)
    } catch (err) {
      console.error('[UndoRedo] Command execute failed:', err)
    }
  }

  /** 撤销 */
  undo() {
    if (this._undoStack.length === 0) return
    const command = this._undoStack.pop()
    try {
      command.undo()
      this._redoStack.push(command)
      emitter.emit(COMMAND_EVENTS.UNDO_PERFORMED, { command: command.name || 'unnamed' })
      emitter.emit(COMMAND_EVENTS.COMMAND_STACK_CHANGED)
    } catch (err) {
      console.error('[UndoRedo] Undo failed:', err)
      this._undoStack.push(command) // 放回
    }
  }

  /** 重做 */
  redo() {
    if (this._redoStack.length === 0) return
    const command = this._redoStack.pop()
    try {
      command.execute()
      this._undoStack.push(command)
      emitter.emit(COMMAND_EVENTS.REDO_PERFORMED, { command: command.name || 'unnamed' })
      emitter.emit(COMMAND_EVENTS.COMMAND_STACK_CHANGED)
    } catch (err) {
      console.error('[UndoRedo] Redo failed:', err)
      this._redoStack.push(command) // 放回
    }
  }

  /** 开始批量操作（多步合并为单条命令） */
  beginBatch(name = 'batch') {
    if (this._batchDepth === 0) {
      this._currentBatch = {
        name,
        execute: () => {},
        undo: () => {},
        _steps: []
      }
    }
    this._batchDepth++
  }

  /** 结束批量操作 */
  endBatch() {
    this._batchDepth--
    if (this._batchDepth <= 0 && this._currentBatch) {
      this._batchDepth = 0
      if (this._currentBatch._steps.length > 0) {
        this.execute(this._currentBatch)
      }
      this._currentBatch = null
    }
  }

  /** 在批量操作中添加子命令 */
  addBatchCommand(command) {
    if (this._currentBatch) {
      this._currentBatch._steps.push(command)
    } else {
      this.execute(command)
    }
  }

  /** 清空所有栈 */
  clear() {
    this._undoStack = []
    this._redoStack = []
    emitter.emit(COMMAND_EVENTS.COMMAND_STACK_CHANGED)
  }

  /** 设置最大步数 */
  setMaxSteps(n) {
    this._maxSteps = Math.max(1, n)
  }

  _trimStack() {
    while (this._undoStack.length > this._maxSteps) {
      this._undoStack.shift()
    }
  }
}

const undoRedoManager = new UndoRedoManager()
export default undoRedoManager
export { UndoRedoManager }
