/**
 * 选择集管理系统 - SelectionManager
 * 统一管理视口中选中的点/线/面/物体/面板
 * 作为材质赋值、效果施加、变换编辑、面板绑定的统一输入
 */
import { reactive, computed } from 'vue'
import emitter, { SELECTION_EVENTS, MODE_EVENTS } from '../eventBus.js'

class SelectionManager {
  constructor() {
    this._state = reactive({
      // 物体级选择
      selectedObjectIds: [],
      // 子元素级选择
      selectedVertices: [],
      selectedEdges: [],
      selectedFaces: [],
      // 悬停
      hoveredObjectId: null
    })
  }

  /** 当前选中状态 (Vue reactive) */
  get state() { return this._state }

  get selectedObjectIds() { return this._state.selectedObjectIds }
  get selectedVertices() { return this._state.selectedVertices }
  get selectedEdges() { return this._state.selectedEdges }
  get selectedFaces() { return this._state.selectedFaces }
  get hoveredObjectId() { return this._state.hoveredObjectId }

  get hasSelection() {
    return this._state.selectedObjectIds.length > 0 ||
      this._state.selectedVertices.length > 0 ||
      this._state.selectedEdges.length > 0 ||
      this._state.selectedFaces.length > 0
  }

  /** 根据编辑模式返回当前选择数量 */
  getSelectionCount(editMode) {
    switch (editMode) {
      case 'procedural_vertex': return this._state.selectedVertices.length
      case 'procedural_edge': return this._state.selectedEdges.length
      case 'procedural_face': return this._state.selectedFaces.length
      default: return this._state.selectedObjectIds.length
    }
  }

  /** 获取统一选择集对象 */
  getSelectionSet() {
    return {
      objects: [...this._state.selectedObjectIds],
      vertices: [...this._state.selectedVertices],
      edges: [...this._state.selectedEdges],
      faces: [...this._state.selectedFaces],
      isEmpty: !this.hasSelection
    }
  }

  // ---- 物体选择 ----
  selectObjects(ids) {
    this._state.selectedObjectIds = [...ids]
    this._state.selectedVertices = []
    this._state.selectedEdges = []
    this._state.selectedFaces = []
    emitter.emit(SELECTION_EVENTS.OBJECT_SELECTED, { ids })
    emitter.emit(SELECTION_EVENTS.SELECTION_CHANGED, { type: 'object', ids })
  }

  // ---- 子元素选择 ----
  selectVertices(indices) {
    this._state.selectedVertices = [...indices]
    emitter.emit(SELECTION_EVENTS.VERTEX_SELECTED, { indices })
    emitter.emit(SELECTION_EVENTS.SELECTION_CHANGED, { type: 'vertex', indices })
  }

  selectEdges(indices) {
    this._state.selectedEdges = [...indices]
    emitter.emit(SELECTION_EVENTS.EDGE_SELECTED, { indices })
    emitter.emit(SELECTION_EVENTS.SELECTION_CHANGED, { type: 'edge', indices })
  }

  selectFaces(indices) {
    this._state.selectedFaces = [...indices]
    emitter.emit(SELECTION_EVENTS.FACE_SELECTED, { indices })
    emitter.emit(SELECTION_EVENTS.SELECTION_CHANGED, { type: 'face', indices })
  }

  // ---- 多选操作 ----
  addToSelection(type, items) {
    const field = this._getSelectionField(type)
    if (!field) return
    const current = [...this._state[field]]
    const merged = [...new Set([...current, ...items])]
    this._state[field] = merged
    emitter.emit(SELECTION_EVENTS.SELECTION_CHANGED, { type, items })
  }

  removeFromSelection(type, items) {
    const field = this._getSelectionField(type)
    if (!field) return
    this._state[field] = this._state[field].filter(id => !items.includes(id))
    emitter.emit(SELECTION_EVENTS.SELECTION_CHANGED, { type, items })
  }

  invertSelection(type, allItems) {
    const field = this._getSelectionField(type)
    if (!field) return
    this._state[field] = allItems.filter(id => !this._state[field].includes(id))
  }

  clearSelection() {
    this._state.selectedObjectIds = []
    this._state.selectedVertices = []
    this._state.selectedEdges = []
    this._state.selectedFaces = []
    this._state.hoveredObjectId = null
    emitter.emit(SELECTION_EVENTS.SELECTION_CLEARED)
  }

  // ---- 悬停 ----
  setHoveredObject(id) {
    this._state.hoveredObjectId = id
    emitter.emit(SELECTION_EVENTS.HOVER_CHANGED, { id })
  }

  // ---- 内部 ----
  _getSelectionField(type) {
    const map = {
      object: 'selectedObjectIds',
      vertex: 'selectedVertices',
      edge: 'selectedEdges',
      face: 'selectedFaces'
    }
    return map[type] || null
  }

  destroy() {
    this.clearSelection()
  }
}

const selectionManager = new SelectionManager()
export default selectionManager
export { SelectionManager }
