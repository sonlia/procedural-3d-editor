<template>
  <div class="left-toolbar" :class="{ collapsed: collapsed }">
    <div class="toolbar-scroll">
      <!-- Selection & Transform Tools -->
      <div class="tool-btn-group-label">Selection</div>
      <div class="tool-btn-group">
        <div
          v-for="tool in selectionTools"
          :key="tool.mode"
          class="tool-btn"
          :class="{ active: editorStore.editMode === tool.mode }"
          @click="editorStore.setEditMode(tool.mode)"
          :title="`${tool.label} [${tool.key}]`"
        >
          <q-icon :name="tool.icon" size="18px" />
        </div>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Transform Gizmo Tools -->
      <div class="tool-btn-group-label">Transform</div>
      <div class="tool-btn-group">
        <div
          v-for="tool in transformTools"
          :key="tool.mode"
          class="tool-btn"
          :class="{ active: editorStore.transformMode === tool.mode }"
          @click="editorStore.setTransformMode(tool.mode)"
          :title="`${tool.label} [${tool.key}]`"
        >
          <q-icon :name="tool.icon" size="18px" :color="tool.color" />
        </div>
      </div>

      <div class="toolbar-divider"></div>

      <!-- Modeling Tools (visible in procedural/independent modes) -->
      <template v-if="isEditingMode">
        <div class="tool-btn-group-label">Modeling</div>
        <div class="tool-btn-group">
          <div
            v-for="tool in modelingTools"
            :key="tool.name"
            class="tool-btn"
            :class="{ active: activeModelingTool === tool.name }"
            @click="setModelingTool(tool.name)"
            :title="tool.label"
          >
            <q-icon :name="tool.icon" size="18px" />
          </div>
        </div>

        <div class="toolbar-divider"></div>
      </template>

      <!-- Display Panel Tools -->
      <div class="tool-btn-group-label">Display</div>
      <div class="tool-btn-group">
        <div
          class="tool-btn"
          :class="{ active: false }"
          title="Add Value Card"
          @click="addPanel('value_card')"
        >
          <q-icon name="dashboard" size="18px" color="green-4" />
        </div>
        <div
          class="tool-btn"
          :class="{ active: false }"
          title="Add Text Label"
          @click="addPanel('text_label')"
        >
          <q-icon name="label" size="18px" color="teal-4" />
        </div>
        <div
          class="tool-btn"
          :class="{ active: false }"
          title="Add Chart"
          @click="addPanel('chart')"
        >
          <q-icon name="show_chart" size="18px" color="purple-4" />
        </div>
        <div
          class="tool-btn"
          :class="{ active: false }"
          title="Add Status Indicator"
          @click="addPanel('status')"
        >
          <q-icon name="indicator" size="18px" color="red-4" />
        </div>
      </div>
    </div>

    <!-- Collapse Toggle -->
    <div class="toolbar-toggle" @click="collapsed = !collapsed">
      <q-icon :name="collapsed ? 'chevron_right' : 'chevron_left'" size="14px" />
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useEditorStore, EDIT_MODES } from '../../stores/editorStore'
import { useSceneStore } from '../../stores/sceneStore'
import { MESH_EVENTS } from '../../core/eventBus.js'
import emitter from '../../core/eventBus.js'

const editorStore = useEditorStore()
const sceneStore = useSceneStore()
const collapsed = ref(false)
const activeModelingTool = ref(null)

const isEditingMode = computed(() => {
  return [EDIT_MODES.PROCEDURAL_VERTEX, EDIT_MODES.PROCEDURAL_EDGE,
    EDIT_MODES.PROCEDURAL_FACE, EDIT_MODES.INDEPENDENT].includes(editorStore.editMode)
})

const selectionTools = [
  { mode: EDIT_MODES.PROCEDURAL_VERTEX, label: 'Vertex Select', icon: 'grain', key: '1' },
  { mode: EDIT_MODES.PROCEDURAL_EDGE, label: 'Edge Select', icon: 'horizontal_rule', key: '2' },
  { mode: EDIT_MODES.PROCEDURAL_FACE, label: 'Face Select', icon: 'crop_square', key: '3' },
  { mode: EDIT_MODES.OBJECT, label: 'Object Select', icon: 'select_all', key: '4' },
  { mode: EDIT_MODES.INDEPENDENT, label: 'Independent Edit', icon: 'touch_app', key: '5' }
]

const transformTools = [
  { mode: 'translate', label: 'Move', icon: 'open_with', key: 'T', color: 'blue-4' },
  { mode: 'rotate', label: 'Rotate', icon: '360', key: 'R', color: 'yellow-5' },
  { mode: 'scale', label: 'Scale', icon: 'zoom_out_map', key: 'S', color: 'green-4' }
]

const modelingTools = [
  { name: 'extrude', label: 'Extrude', icon: 'arrow_upward' },
  { name: 'inset', label: 'Inset', icon: 'content_cut' },
  { name: 'bevel', label: 'Bevel', icon: 'rounded_corner' },
  { name: 'loop_cut', label: 'Loop Cut', icon: 'horizontal_rule' },
  { name: 'knife', label: 'Knife', icon: 'content_cut' },
  { name: 'bridge', label: 'Bridge', icon: 'timeline' },
  { name: 'boolean', label: 'Boolean', icon: 'join_inner' },
  { name: 'weld', label: 'Weld', icon: 'merge_type' },
  { name: 'triangulate', label: 'Triangulate [Ctrl+T]', icon: 'change_history' },
  { name: 'separate', label: 'Separate [P]', icon: 'call_split' }
]

function setModelingTool(toolName) {
  activeModelingTool.value = toolName
  emitter.emit(MESH_EVENTS.MODELING_TOOL_CHANGED, { tool: toolName })
}

function addPanel(type) {
  const nameMap = {
    value_card: 'Value Card',
    text_label: 'Text Label',
    chart: 'Chart Panel',
    status: 'Status Indicator'
  }
  sceneStore.addObject({
    name: nameMap[type] || type,
    type: 'display_panel',
    position: { x: 0, y: 1, z: 0 },
    metadata: { panelType: type }
  })
}
</script>

<style scoped>
.left-toolbar {
  width: 52px;
  min-width: 52px;
  background: var(--editor-bg-toolbar);
  border-right: 1px solid var(--editor-border);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  transition: width 0.2s ease;
  position: relative;
}

.left-toolbar.collapsed {
  width: 20px;
  min-width: 20px;
}

.toolbar-scroll {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 4px 0;
}

.toolbar-divider {
  height: 1px;
  background: var(--editor-border);
  margin: 6px 8px;
}

.toolbar-toggle {
  position: absolute;
  top: 50%;
  right: -1px;
  transform: translateY(-50%);
  width: 12px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--editor-bg-panel);
  border: 1px solid var(--editor-border);
  border-radius: 0 4px 4px 0;
  cursor: pointer;
  color: var(--editor-text-muted);
  transition: all 0.15s;
  z-index: 10;
}

.toolbar-toggle:hover {
  color: var(--editor-text-primary);
  background: var(--editor-bg-hover);
}

.tool-btn-group {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 2px 6px;
}

.tool-btn-group-label {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  color: var(--editor-text-muted);
  padding: 6px 0 2px;
  text-align: center;
  user-select: none;
}
.tool-btn {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  cursor: pointer;
  transition: background 0.1s, box-shadow 0.1s;
  color: var(--editor-text-secondary);
}
.tool-btn:hover {
  background: var(--editor-bg-hover);
  color: var(--editor-text-primary);
}
.tool-btn.active {
  background: rgba(83, 82, 237, 0.25);
  color: var(--editor-accent-light);
  box-shadow: inset 0 0 0 1px rgba(83, 82, 237, 0.5);
}
</style>
