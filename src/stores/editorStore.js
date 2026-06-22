/**
 * 编辑器状态 Store
 * 纯 UI 层状态，核心逻辑委托给 core/ 模块
 */
import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import { EDITOR_EVENTS, MODE_EVENTS, SELECTION_EVENTS } from '../core/eventBus.js'
import emitter from '../core/eventBus.js'
import selectionManager from '../core/editing/SelectionManager.js'
import undoRedoManager from '../core/undo/UndoRedoManager.js'

export const EDIT_MODES = {
  OBJECT: 'object',
  PROCEDURAL_VERTEX: 'procedural_vertex',
  PROCEDURAL_EDGE: 'procedural_edge',
  PROCEDURAL_FACE: 'procedural_face',
  INDEPENDENT: 'independent'
}

export const TRANSFORM_MODES = {
  TRANSLATE: 'translate',
  ROTATE: 'rotate',
  SCALE: 'scale'
}

export const APP_MODES = {
  DESIGN: 'design',
  PREVIEW: 'preview',
  PUBLISH: 'publish'
}

export const useEditorStore = defineStore('editor', () => {
  // 编辑模式
  const editMode = ref(EDIT_MODES.OBJECT)
  const appMode = ref(APP_MODES.DESIGN)
  const transformMode = ref(TRANSFORM_MODES.TRANSLATE)
  const transformSpace = ref('local')

  // 面板 UI 状态（替代 window.__editorUIState）
  const showRightPanel = ref(true)
  const showBottomPanel = ref(true)
  const activeBottomTab = ref('nodes')  // 'nodes' | 'timeline' | 'material'
  const autoTriangulate = ref(true)

  // 从 SelectionManager 同步的响应式引用
  const hasSelection = computed(() => selectionManager.hasSelection)
  const selectionCount = computed(() => selectionManager.getSelectionCount(editMode.value))
  const hoveredObjectId = computed(() => selectionManager.hoveredObjectId)

  // 设置编辑模式
  function setEditMode(mode) {
    editMode.value = mode
    selectionManager.clearSelection()
    emitter.emit(MODE_EVENTS.EDIT_MODE_CHANGED, { mode })
  }

  // 设置应用模式
  function setAppMode(mode) {
    appMode.value = mode
    emitter.emit(MODE_EVENTS.APP_MODE_CHANGED, { mode })
  }

  // 设置变换模式
  function setTransformMode(mode) {
    transformMode.value = mode
    emitter.emit(MODE_EVENTS.TRANSFORM_MODE_CHANGED, { mode })
  }

  // 切换坐标系
  function toggleTransformSpace() {
    transformSpace.value = transformSpace.value === 'local' ? 'world' : 'local'
    emitter.emit(MODE_EVENTS.TRANSFORM_SPACE_CHANGED, { space: transformSpace.value })
  }

  // 切换面板显隐
  function toggleRightPanel() {
    showRightPanel.value = !showRightPanel.value
  }
  function toggleBottomPanel() {
    showBottomPanel.value = !showBottomPanel.value
  }

  // 选择操作（委托给 SelectionManager）
  function selectObjects(ids) { selectionManager.selectObjects(ids) }
  function selectVertices(indices) { selectionManager.selectVertices(indices) }
  function selectEdges(indices) { selectionManager.selectEdges(indices) }
  function selectFaces(indices) { selectionManager.selectFaces(indices) }
  function addToSelection(type, items) { selectionManager.addToSelection(type, items) }
  function removeFromSelection(type, items) { selectionManager.removeFromSelection(type, items) }
  function invertSelection(type, allItems) { selectionManager.invertSelection(type, allItems) }
  function clearSelection() { selectionManager.clearSelection() }
  function setHoveredObject(id) { selectionManager.setHoveredObject(id) }

  // 撤销/重做（委托给 UndoRedoManager）
  function undo() { undoRedoManager.undo() }
  function redo() { undoRedoManager.redo() }
  const canUndo = computed(() => undoRedoManager.canUndo)
  const canRedo = computed(() => undoRedoManager.canRedo)

  // 快捷键映射
  function handleEditModeKey(key) {
    const modeMap = {
      '1': EDIT_MODES.PROCEDURAL_VERTEX,
      '2': EDIT_MODES.PROCEDURAL_EDGE,
      '3': EDIT_MODES.PROCEDURAL_FACE,
      '4': EDIT_MODES.OBJECT,
      '5': EDIT_MODES.INDEPENDENT
    }
    if (modeMap[key]) { setEditMode(modeMap[key]); return }

    const transformMap = {
      't': TRANSFORM_MODES.TRANSLATE, 'T': TRANSFORM_MODES.TRANSLATE,
      'r': TRANSFORM_MODES.ROTATE, 'R': TRANSFORM_MODES.ROTATE,
      's': TRANSFORM_MODES.SCALE, 'S': TRANSFORM_MODES.SCALE
    }
    if (transformMap[key]) { setTransformMode(transformMap[key]); return }
  }

  return {
    editMode, appMode, transformMode, transformSpace,
    showRightPanel, showBottomPanel, activeBottomTab, autoTriangulate,
    hasSelection, selectionCount, hoveredObjectId,
    canUndo, canRedo,
    setEditMode, setAppMode, setTransformMode, toggleTransformSpace,
    toggleRightPanel, toggleBottomPanel,
    selectObjects, selectVertices, selectEdges, selectFaces,
    addToSelection, removeFromSelection, invertSelection, clearSelection, setHoveredObject,
    undo, redo, handleEditModeKey
  }
})
