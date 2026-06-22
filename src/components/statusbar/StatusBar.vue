<template>
  <div class="status-bar">
    <!-- Left: Mode & Status -->
    <div class="status-left">
      <div class="status-item">
        <q-icon name="edit" size="12px" :color="modeColor" />
        <span>{{ modeLabel }}</span>
      </div>

      <q-separator vertical dark />

      <div class="status-item">
        <q-icon name="3d_rotation" size="12px" />
        <span>{{ sceneStore.objectCount }} objects</span>
      </div>

      <q-separator vertical dark />

      <div class="status-item">
        <q-icon name="account_tree" size="12px" />
        <span>{{ nodeStore.nodeCount }} nodes</span>
      </div>

      <q-separator vertical dark />

      <div class="status-item">
        <span class="kbd" style="margin-right: 2px;">FPS</span>
        <span :class="fpsClass">{{ fps }}</span>
      </div>
    </div>

    <!-- Center: Messages -->
    <div class="status-center">
      <span class="status-message">{{ statusMessage }}</span>
    </div>

    <!-- Right: Info -->
    <div class="status-right">
      <div class="status-item">
        <q-icon name="straighten" size="12px" />
        <span>{{ timelineStore.currentFrame }} / {{ timelineStore.endFrame }}</span>
      </div>

      <q-separator vertical dark />

      <div class="status-item" :class="timelineStore.isPlaying ? 'status-running' : 'status-idle'">
        <q-icon :name="timelineStore.isPlaying ? 'play_circle' : 'pause_circle'" size="12px" />
        <span>{{ timelineStore.isPlaying ? 'Playing' : 'Stopped' }}</span>
      </div>

      <q-separator vertical dark />

      <div class="status-item">
        <q-icon name="memory" size="12px" />
        <span>GPU Ready</span>
      </div>
    </div>
  </div>
</template>

<script setup>
/**
 * StatusBar - 底部状态栏
 * 显示编辑模式、物体/节点数量、FPS、帧号、播放状态
 */
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import { useEditorStore, EDIT_MODES } from '../../stores/editorStore'
import { useSceneStore } from '../../stores/sceneStore'
import { useNodeStore } from '../../stores/nodeStore'
import { useTimelineStore } from '../../stores/timelineStore'
import { VIEWPORT_EVENTS, SCENE_EVENTS, MODE_EVENTS, MESH_EVENTS, NODE_EVENTS, COMMAND_EVENTS } from '../../core/eventBus.js'
import emitter from '../../core/eventBus.js'

const editorStore = useEditorStore()
const sceneStore = useSceneStore()
const nodeStore = useNodeStore()
const timelineStore = useTimelineStore()

const fps = ref(60)
const statusMessage = ref('Ready')

// ---- 动态状态消息：基于事件总线更新 ----
function showStatus(msg, duration = 3000) {
  statusMessage.value = msg
  if (duration > 0) {
    clearTimeout(_statusTimer)
    _statusTimer = setTimeout(() => { statusMessage.value = 'Ready' }, duration)
  }
}
let _statusTimer = null

// ---- FPS: 基于 VIEWPORT_EVENTS.FRAME_READY 事件测量（准确反映渲染器帧率） ----
let fpsFrameCount = 0
let fpsLastTime = performance.now()
let fpsCleanup = null

function onFrameReady() {
  fpsFrameCount++
  const now = performance.now()
  const elapsed = now - fpsLastTime
  if (elapsed >= 1000) {
    fps.value = Math.round((fpsFrameCount * 1000) / elapsed)
    fpsFrameCount = 0
    fpsLastTime = now
  }
}

onMounted(() => {
  fpsLastTime = performance.now()
  fpsFrameCount = 0
  emitter.on(VIEWPORT_EVENTS.FRAME_READY, onFrameReady)

  // 监听事件，动态更新状态消息
  emitter.on(SCENE_EVENTS.OBJECT_ADDED, (e) => showStatus(`Added: ${e.name}`, 2500))
  emitter.on(SCENE_EVENTS.OBJECT_REMOVED, (e) => showStatus(`Removed: ${e.name}`, 2500))
  emitter.on(MODE_EVENTS.EDIT_MODE_CHANGED, (e) => showStatus(`Mode: ${e.mode}`, 2000))
  emitter.on(MODE_EVENTS.APP_MODE_CHANGED, (e) => showStatus(`App: ${e.mode} mode`, 2000))
  emitter.on(MESH_EVENTS.MODELING_TOOL_CHANGED, (e) => showStatus(`Tool: ${e.tool}`, 2000))
  emitter.on(NODE_EVENTS.NODE_REMOVED, () => showStatus('Node removed', 2000))
  emitter.on(NODE_EVENTS.NODE_ADDED, () => showStatus('Node added', 2000))
  emitter.on(COMMAND_EVENTS.UNDO_PERFORMED, () => showStatus('Undo', 1500))
  emitter.on(COMMAND_EVENTS.REDO_PERFORMED, () => showStatus('Redo', 1500))
})

onUnmounted(() => {
  emitter.off(VIEWPORT_EVENTS.FRAME_READY, onFrameReady)
  emitter.off(SCENE_EVENTS.OBJECT_ADDED)
  emitter.off(SCENE_EVENTS.OBJECT_REMOVED)
  emitter.off(MODE_EVENTS.EDIT_MODE_CHANGED)
  emitter.off(MODE_EVENTS.APP_MODE_CHANGED)
  emitter.off(MESH_EVENTS.MODELING_TOOL_CHANGED)
  emitter.off(NODE_EVENTS.NODE_REMOVED)
  emitter.off(NODE_EVENTS.NODE_ADDED)
  emitter.off(COMMAND_EVENTS.UNDO_PERFORMED)
  emitter.off(COMMAND_EVENTS.REDO_PERFORMED)
  clearTimeout(_statusTimer)
})

const modeLabel = computed(() => {
  switch (editorStore.editMode) {
    case EDIT_MODES.OBJECT: return 'Object'
    case EDIT_MODES.PROCEDURAL_VERTEX: return 'Vertex'
    case EDIT_MODES.PROCEDURAL_EDGE: return 'Edge'
    case EDIT_MODES.PROCEDURAL_FACE: return 'Face'
    case EDIT_MODES.INDEPENDENT: return 'Independent'
    default: return 'Object'
  }
})

const modeColor = computed(() => {
  switch (editorStore.editMode) {
    case EDIT_MODES.OBJECT: return 'blue-4'
    case EDIT_MODES.PROCEDURAL_VERTEX:
    case EDIT_MODES.PROCEDURAL_EDGE:
    case EDIT_MODES.PROCEDURAL_FACE: return 'yellow-5'
    case EDIT_MODES.INDEPENDENT: return 'green-4'
    default: return 'blue-4'
  }
})

const fpsClass = computed(() => {
  if (fps.value >= 50) return 'status-running'
  if (fps.value >= 30) return 'status-paused'
  return 'status-paused'
})
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  height: 24px;
  min-height: 24px;
  padding: 0 8px;
  background: var(--editor-bg-toolbar);
  border-top: 1px solid var(--editor-border);
  font-size: 10px;
  color: var(--editor-text-muted);
}

.status-left, .status-right {
  display: flex;
  align-items: center;
  gap: 8px;
}

.status-center {
  flex: 1;
  text-align: center;
}

.status-item {
  display: flex;
  align-items: center;
  gap: 4px;
}

.status-message {
  color: var(--editor-text-muted);
  font-size: 10px;
}

.status-running {
  color: var(--editor-success);
}

.status-paused {
  color: var(--editor-warn);
}

.status-idle {
  color: var(--editor-text-muted);
}
</style>
