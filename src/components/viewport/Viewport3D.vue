<template>
  <div
    class="viewport-container"
    ref="containerRef"
    :class="{ fullscreen }"
    @mousedown="onViewportMouseDown"
    @mouseup="onViewportMouseUp"
    @mousemove="onViewportMouseMove"
  >
    <canvas ref="canvasRef" class="viewport-canvas" tabindex="0"></canvas>

    <!-- View Gizmo (top-right) -->
    <div class="view-gizmo" @mousedown.stop @mouseup.stop>
      <div class="view-gizmo-label">{{ currentViewLabel }}</div>
      <q-btn flat dense size="xs" icon="visibility"
        @click="toggleProjection"
        :title="isPerspective ? 'Switch to Orthographic' : 'Switch to Perspective'" />
      <q-btn flat dense size="xs" icon="crop_free" title="Fit All" @click="fitAll" />
      <q-btn flat dense size="xs" icon="grid_on" :title="gridVisible ? 'Hide Grid' : 'Show Grid'" @click="toggleGrid" />
      <q-btn flat dense size="xs" icon="webAsset" title="Toggle Wireframe" @click="toggleWireframe" />
    </div>

    <!-- Edit Mode Indicator (bottom-left) -->
    <div class="viewport-mode-badge" :class="modeBadgeClass" style="pointer-events: none;">
      {{ modeBadgeLabel }}
    </div>

    <!-- Object list overlay (top-left) -->
    <div class="viewport-object-list" :class="{ collapsed: objectListCollapsed }">
      <div class="object-list-header" @click.stop="objectListCollapsed = !objectListCollapsed">
        <q-icon :name="objectListCollapsed ? 'chevron_right' : 'expand_more'" size="12px" />
        <span v-if="!objectListCollapsed">{{ sceneStore.objectCount }} objects</span>
      </div>
      <div v-show="!objectListCollapsed" v-for="obj in sceneStore.objects" :key="obj.id"
        class="viewport-object-item"
        :class="{
          selected: selectionManager.state.selectedObjectIds.includes(obj.id),
          hovered: selectionManager.state.hoveredObjectId === obj.id
        }"
        @click.stop="selectObject(obj.id)"
        @mouseenter.stop="selectionManager.setHoveredObject(obj.id)"
        @mouseleave.stop="selectionManager.setHoveredObject(null)"
      >
        <q-icon :name="getObjectIcon(obj)" size="14px" :color="getObjectColor(obj)" />
        <span>{{ obj.name }}</span>
        <q-icon
          v-if="!obj.visible"
          name="visibility_off"
          size="12px"
          class="obj-hidden-icon"
          @click.stop.prevent="sceneStore.toggleVisibility(obj.id)"
        />
      </div>
    </div>

    <!-- Selection Info (bottom-right) -->
    <div class="selection-info" v-if="selectionManager.hasSelection">
      <span>
        <q-icon name="select_all" size="14px" />
        {{ editorStore.selectionCount }} selected
      </span>
    </div>
  </div>
</template>

<script setup>
/**
 * 3D 视口组件 (Babylon.js)
 * 职责：渲染 Babylon.js 场景、鼠标交互拾取、Gizmo 数据同步
 */
import { ref, onMounted, onUnmounted, watch, computed, nextTick } from 'vue'
import { useEditorStore, EDIT_MODES, TRANSFORM_MODES, APP_MODES } from '../../stores/editorStore'
import { useSceneStore } from '../../stores/sceneStore'
import sceneManager from '../../core/scene/SceneManager.js'
import viewportEditor from '../../core/editing/ViewportEditor.js'
import selectionManager from '../../core/editing/SelectionManager.js'
import { useViewportSync } from '../../composables/useViewportSync.js'

const props = defineProps({ fullscreen: { type: Boolean, default: false } })

const editorStore = useEditorStore()
const sceneStore = useSceneStore()

const containerRef = ref(null)
const canvasRef = ref(null)

// ---- State ----
const gridVisible = ref(true)
const wireframeMode = ref(false)
const _initialized = ref(false)
const objectListCollapsed = ref(false)

// 点击/拖拽区分状态
const _mouseDownPos = { x: 0, y: 0 }
let _mouseDownTime = 0
const CLICK_THRESHOLD = 5  // 像素
let _lastHoverRaycast = 0  // mousemove raycast 节流时间戳

// ---- ViewportSync composable (mesh sync, transform attach, watchers) ----
const { objectMeshes, syncObjects, attachTransformToSelection, getVisibleMeshes, getMeshById } = useViewportSync()

// ---- Computed ----
const isPerspective = computed(() => sceneManager.isPerspective)
const currentViewLabel = computed(() => sceneManager.isPerspective ? 'Perspective' : 'Orthographic')

const modeBadgeLabel = computed(() => {
  const map = {
    [EDIT_MODES.OBJECT]: 'OBJ',
    [EDIT_MODES.PROCEDURAL_VERTEX]: 'VTX',
    [EDIT_MODES.PROCEDURAL_EDGE]: 'EDGE',
    [EDIT_MODES.PROCEDURAL_FACE]: 'FACE',
    [EDIT_MODES.INDEPENDENT]: 'IND'
  }
  return map[editorStore.editMode] || 'OBJ'
})

const modeBadgeClass = computed(() => {
  const map = {
    [EDIT_MODES.OBJECT]: 'badge-object',
    [EDIT_MODES.PROCEDURAL_VERTEX]: 'badge-procedural',
    [EDIT_MODES.PROCEDURAL_EDGE]: 'badge-procedural',
    [EDIT_MODES.PROCEDURAL_FACE]: 'badge-procedural',
    [EDIT_MODES.INDEPENDENT]: 'badge-independent'
  }
  return map[editorStore.editMode] || 'badge-object'
})

// ---- Helpers ----
function getObjectIcon(obj) {
  const map = { display_panel: 'dashboard', light: 'lightbulb' }
  return map[obj.type] || 'view_in_ar'
}

function getObjectColor(obj) {
  if (!obj.visible) return 'grey-6'
  const typeColors = { display_panel: 'teal-4', light: 'yellow-4' }
  return typeColors[obj.type] || 'blue-4'
}

// ---- Mouse Interaction ----
function onViewportMouseDown(e) {
  if (editorStore.appMode !== 'design') return
  if (e.button !== 0) return

  // Gizmo 正在拖拽时不执行选择逻辑
  const gm = sceneManager.gizmoManager
  if (gm) {
    const isDragging = (gizmo) => {
      try { return gizmo?.dragBehavior?.dragging === true } catch { return false }
    }
    const anyGizmoActive =
      isDragging(gm.gizmos?.positionGizmo) ||
      isDragging(gm.gizmos?.rotationGizmo) ||
      isDragging(gm.gizmos?.scaleGizmo)
    if (anyGizmoActive) return
  }

  _mouseDownPos.x = e.clientX
  _mouseDownPos.y = e.clientY
  _mouseDownTime = Date.now()
}

function onViewportMouseUp(e) {
  if (editorStore.appMode !== 'design') return
  if (e.button !== 0) return

  // 判断是否为点击
  const dx = e.clientX - _mouseDownPos.x
  const dy = e.clientY - _mouseDownPos.y
  const dist = Math.sqrt(dx * dx + dy * dy)
  const elapsed = Date.now() - _mouseDownTime

  if (dist > CLICK_THRESHOLD || elapsed > 500) return

  const meshes = getVisibleMeshes()
  const hits = viewportEditor.raycast(e.clientX, e.clientY, meshes)
  const isMultiSelect = e.shiftKey || e.ctrlKey || e.metaKey

  if (hits.length > 0 && hits[0].objectId) {
    const hit = hits[0]
    const objId = hit.objectId

    if (editorStore.editMode === EDIT_MODES.OBJECT) {
      // ---- 物体模式：选中物体 ----
      if (isMultiSelect) {
        if (selectionManager.state.selectedObjectIds.includes(objId)) {
          selectionManager.removeFromSelection('object', [objId])
        } else {
          selectionManager.addToSelection('object', [objId])
        }
      } else {
        selectionManager.selectObjects([objId])
      }
      attachTransformToSelection()
    } else {
      // ---- 编辑模式（点/线/面）：先确保物体被选中，再选中子元素 ----
      if (!selectionManager.state.selectedObjectIds.includes(objId)) {
        selectionManager.selectObjects([objId])
      }
      _handleSubElementSelection(hit, isMultiSelect)
    }
  } else if (!isMultiSelect) {
    selectionManager.clearSelection()
    viewportEditor.detachTransform()
  }
}

/** 处理子元素（点/线/面）选择 */
function _handleSubElementSelection(hit, isMultiSelect) {
  const mode = editorStore.editMode
  const mesh = hit.object

  if (mode === EDIT_MODES.PROCEDURAL_FACE) {
    const faceIdx = hit.faceId
    if (faceIdx < 0) return
    if (isMultiSelect) {
      if (selectionManager.state.selectedFaces.includes(faceIdx)) {
        selectionManager.removeFromSelection('face', [faceIdx])
      } else {
        selectionManager.addToSelection('face', [faceIdx])
      }
    } else {
      selectionManager.selectFaces([faceIdx])
    }
  } else if (mode === EDIT_MODES.PROCEDURAL_VERTEX) {
    const vertIdx = _getClosestVertexFromHit(mesh, hit)
    if (vertIdx < 0) return
    if (isMultiSelect) {
      if (selectionManager.state.selectedVertices.includes(vertIdx)) {
        selectionManager.removeFromSelection('vertex', [vertIdx])
      } else {
        selectionManager.addToSelection('vertex', [vertIdx])
      }
    } else {
      selectionManager.selectVertices([vertIdx])
    }
  } else if (mode === EDIT_MODES.PROCEDURAL_EDGE) {
    const edgeIdx = _getClosestEdgeFromHit(mesh, hit)
    if (edgeIdx < 0) return
    if (isMultiSelect) {
      if (selectionManager.state.selectedEdges.includes(edgeIdx)) {
        selectionManager.removeFromSelection('edge', [edgeIdx])
      } else {
        selectionManager.addToSelection('edge', [edgeIdx])
      }
    } else {
      selectionManager.selectEdges([edgeIdx])
    }
  }
}

/** 利用重心坐标找到命中三角形中最近的顶点索引 */
function _getClosestVertexFromHit(mesh, hit) {
  const indices = mesh.getIndices()
  if (!indices || hit.faceId < 0) return -1
  const triStart = hit.faceId * 3
  if (triStart + 2 >= indices.length) return -1
  const i0 = indices[triStart]
  const i1 = indices[triStart + 1]
  const i2 = indices[triStart + 2]
  // 重心坐标: w0 = 1 - bu - bv, w1 = bu, w2 = bv
  const w0 = 1 - (hit.bu || 0) - (hit.bv || 0)
  const w1 = hit.bu || 0
  const w2 = hit.bv || 0
  if (w0 >= w1 && w0 >= w2) return i0
  if (w1 >= w0 && w1 >= w2) return i1
  return i2
}

/** 利用重心坐标找到命中三角形中最近的边索引 */
function _getClosestEdgeFromHit(mesh, hit) {
  const indices = mesh.getIndices()
  if (!indices || hit.faceId < 0) return -1
  const triStart = hit.faceId * 3
  if (triStart + 2 >= indices.length) return -1
  // 三角形的三条边: edge0(i0-i1), edge1(i1-i2), edge2(i2-i0)
  // 重心坐标 w0 = 1-bu-bv, w1 = bu, w2 = bv
  // 离边 i0-i1 最近时 w2 最小，离 i1-i2 最近时 w0 最小，离 i2-i0 最近时 w1 最小
  const w0 = 1 - (hit.bu || 0) - (hit.bv || 0)
  const w1 = hit.bu || 0
  const w2 = hit.bv || 0
  // 将边映射到全局边索引（简单方式：使用 faceId * 3 + localEdgeIndex）
  // 因为 Babylon.js 没有全局边索引，使用 faceId 编码局部边
  if (w2 <= w0 && w2 <= w1) return hit.faceId * 3     // edge i0-i1
  if (w0 <= w1 && w0 <= w2) return hit.faceId * 3 + 1 // edge i1-i2
  return hit.faceId * 3 + 2                            // edge i2-i0
}

function onViewportMouseMove(e) {
  if (editorStore.appMode !== 'design') return

  // 节流
  const now = Date.now()
  if (now - _lastHoverRaycast < 16) return
  _lastHoverRaycast = now

  const meshes = getVisibleMeshes()
  const hits = viewportEditor.raycast(e.clientX, e.clientY, meshes)
  if (canvasRef.value) {
    canvasRef.value.style.cursor = hits.length > 0 ? 'pointer' : 'default'
  }
  if (hits.length > 0) {
    selectionManager.setHoveredObject(hits[0].objectId)
  } else {
    selectionManager.setHoveredObject(null)
  }
}

function selectObject(id) {
  selectionManager.selectObjects([id])
  attachTransformToSelection()
}

function toggleProjection() { sceneManager.toggleProjection() }
function fitAll() { sceneManager.setViewPreset('perspective') }

function toggleGrid() {
  gridVisible.value = !gridVisible.value
  sceneManager.setGridVisible(gridVisible.value)
}

function toggleWireframe() {
  wireframeMode.value = !wireframeMode.value
  sceneManager.setWireframeMode(wireframeMode.value)
}

// ---- Sync: sceneStore data → Babylon.js mesh transforms ----
const DEG2RAD = Math.PI / 180
const RAD2DEG = 180 / Math.PI

watch(
  () => sceneStore.objects.map(o => ({ id: o.id, position: { ...o.position }, rotation: { ...o.rotation }, scale: { ...o.scale }, visible: o.visible })),
  () => {
    for (const obj of sceneStore.objects) {
      const mesh = getMeshById(obj.id)
      if (mesh) {
        mesh.position.set(obj.position.x, obj.position.y, obj.position.z)
        mesh.rotation.set(obj.rotation.x * DEG2RAD, obj.rotation.y * DEG2RAD, obj.rotation.z * DEG2RAD)
        mesh.scaling.set(obj.scale.x, obj.scale.y, obj.scale.z)
        mesh.isVisible = obj.visible
      }
    }
  },
  { deep: true }
)

// ---- Sync: Gizmo drag → sceneStore data ----
// Babylon.js GizmoManager 拖拽时通过 Observable 回调同步
function setupGizmoDragSync() {
  const gm = sceneManager.gizmoManager
  if (!gm) return

  // 使用 scene.onBeforeRenderObservable 检测 Gizmo 拖拽中的 mesh 变化
  const observer = sceneManager.scene.onBeforeRenderObservable.add(() => {
    const attachedMesh = viewportEditor.attachedMesh
    if (!attachedMesh || !attachedMesh.metadata?.objectId) return

    const objId = attachedMesh.metadata.objectId
    const obj = sceneStore.objects.find(o => o.id === objId)
    if (!obj) return

    // 检查是否有变化（避免频繁无意义更新）
    const pos = attachedMesh.position
    const rot = attachedMesh.rotation
    const scl = attachedMesh.scaling
    const needsUpdate =
      Math.abs(pos.x - obj.position.x) > 0.001 ||
      Math.abs(pos.y - obj.position.y) > 0.001 ||
      Math.abs(pos.z - obj.position.z) > 0.001 ||
      Math.abs(rot.x * RAD2DEG - obj.rotation.x) > 0.01 ||
      Math.abs(rot.y * RAD2DEG - obj.rotation.y) > 0.01 ||
      Math.abs(rot.z * RAD2DEG - obj.rotation.z) > 0.01 ||
      Math.abs(scl.x - obj.scale.x) > 0.001 ||
      Math.abs(scl.y - obj.scale.y) > 0.001 ||
      Math.abs(scl.z - obj.scale.z) > 0.001

    if (needsUpdate) {
      sceneStore.updateObject(objId, {
        position: { x: pos.x, y: pos.y, z: pos.z },
        rotation: {
          x: parseFloat((rot.x * RAD2DEG).toFixed(2)),
          y: parseFloat((rot.y * RAD2DEG).toFixed(2)),
          z: parseFloat((rot.z * RAD2DEG).toFixed(2))
        },
        scale: { x: scl.x, y: scl.y, z: scl.z }
      })
    }
  })

  return observer
}

// ---- Lifecycle ----
let _gizmoObserver = null

onMounted(() => {
  nextTick(() => {
    if (containerRef.value && canvasRef.value) {
      if (!_initialized.value) {
        sceneManager.initWithContainer(containerRef.value, canvasRef.value)
        viewportEditor.initWithContainer(containerRef.value, canvasRef.value)
        _initialized.value = true

        // 设置 Gizmo 拖拽同步
        _gizmoObserver = setupGizmoDragSync()
      }
    }
  })
})

onUnmounted(() => {
  if (_gizmoObserver && sceneManager.scene) {
    sceneManager.scene.onBeforeRenderObservable.remove(_gizmoObserver)
  }
})
</script>

<style scoped>
.viewport-container {
  flex: 1;
  position: relative;
  overflow: hidden;
  background: #0d0d1a;
}
.viewport-canvas { width: 100%; height: 100%; display: block; outline: none; }

.view-gizmo {
  position: absolute; top: 8px; right: 8px;
  display: flex; align-items: center; gap: 4px;
  padding: 3px 8px;
  background: rgba(20, 20, 40, 0.7); border-radius: 4px;
  backdrop-filter: blur(4px);
}
.view-gizmo-label { font-size: 11px; color: var(--editor-text-secondary); margin-right: 4px; }

.viewport-mode-badge {
  position: absolute; bottom: 10px; left: 10px;
  padding: 2px 8px; border-radius: 3px;
  font-size: 10px; font-weight: 700; letter-spacing: 0.5px;
  backdrop-filter: blur(4px);
}
.badge-object { background: rgba(51, 154, 240, 0.25); color: #339af0; border: 1px solid rgba(51, 154, 240, 0.4); }
.badge-procedural { background: rgba(252, 196, 25, 0.25); color: #fcc419; border: 1px solid rgba(252, 196, 25, 0.4); }
.badge-independent { background: rgba(81, 207, 102, 0.25); color: #51cf66; border: 1px solid rgba(81, 207, 102, 0.4); }

.viewport-object-list {
  position: absolute; top: 8px; left: 8px;
  display: flex; flex-direction: column; gap: 2px;
  max-height: 200px; overflow-y: auto;
  background: rgba(20, 20, 40, 0.65); border-radius: 4px;
  backdrop-filter: blur(4px);
  padding: 2px;
}
.viewport-object-list.collapsed {
  width: auto; min-height: 0;
}
.object-list-header {
  display: flex; align-items: center; gap: 4px;
  padding: 3px 6px; cursor: pointer;
  font-size: 10px; color: var(--editor-text-muted);
  border-radius: 3px; transition: background 0.1s;
}
.object-list-header:hover { background: rgba(40, 40, 80, 0.8); }
.viewport-object-item {
  display: flex; align-items: center; gap: 6px;
  padding: 3px 8px;
  background: rgba(20, 20, 40, 0.65); border-radius: 3px;
  font-size: 11px; color: var(--editor-text-secondary);
  cursor: pointer; transition: all 0.1s; backdrop-filter: blur(4px);
}
.viewport-object-item:hover { background: rgba(40, 40, 80, 0.8); color: var(--editor-text-primary); }
.viewport-object-item.selected { background: rgba(83, 82, 237, 0.3); color: var(--editor-accent-light); border-left: 2px solid var(--editor-accent); }
.obj-hidden-icon { opacity: 0.4; cursor: pointer; }
.obj-hidden-icon:hover { opacity: 1; }

.selection-info {
  position: absolute; bottom: 10px; right: 10px;
  display: flex; gap: 12px; padding: 4px 10px;
  background: rgba(20, 20, 40, 0.85); border-radius: 4px;
  font-size: 11px; color: var(--editor-text-secondary);
  pointer-events: none; backdrop-filter: blur(4px);
}
.selection-info span { display: flex; align-items: center; gap: 4px; }
</style>
