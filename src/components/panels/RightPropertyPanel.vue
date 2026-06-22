<template>
  <div class="right-panel">
    <div class="panel-header">
      <div class="panel-header-title">
        <q-icon name="tune" size="14px" />
        <span>{{ panelTitle }}</span>
      </div>
      <div class="panel-header-actions">
        <q-btn flat dense size="xs" icon="push_pin" @click="pinned = !pinned" :color="pinned ? 'blue-4' : 'grey-6'" />
      </div>
    </div>

    <div class="panel-content">
      <!-- No Selection State -->
      <div v-if="!hasContent" class="panel-empty">
        <q-icon name="select_all" size="32px" color="grey-7" />
        <p>Select an object or node to view properties</p>
        <div class="panel-empty-shortcuts">
          <div class="shortcut-item"><span class="kbd">1-5</span><span>Switch edit mode</span></div>
          <div class="shortcut-item"><span class="kbd">T / R / S</span><span>Move / Rotate / Scale</span></div>
          <div class="shortcut-item"><span class="kbd">Ctrl+A</span><span>Select all</span></div>
          <div class="shortcut-item"><span class="kbd">Del</span><span>Delete selected</span></div>
        </div>
      </div>

      <!-- Object Properties -->
      <ObjectProperties
        v-if="selectedObject"
        :obj="selectedObject"
        @update="onObjectUpdate"
      />

      <!-- Transform Properties -->
      <TransformProperties
        v-if="selectedObject"
        :position="selectedObject.position"
        :rotation="selectedObject.rotation"
        :scale="selectedObject.scale"
        @update-transform="onTransformUpdate"
      />

      <!-- Display Panel Properties -->
      <DisplayPanelProperties v-if="selectedObject && selectedObject.type === 'display_panel'" />

      <!-- Node Properties -->
      <div v-if="selectedNodeData" class="property-section">
        <div class="section-title" @click="sections.node = !sections.node">
          <q-icon :name="sections.node ? 'expand_more' : 'chevron_right'" size="16px" />
          <span>Node: {{ selectedNodeData.title }}</span>
        </div>
        <div v-show="sections.node" class="section-body">
          <div class="prop-row">
            <label>Type</label>
            <span class="prop-value">{{ selectedNodeData.typeId || selectedNodeData.type }}</span>
          </div>
          <div class="prop-row">
            <label>Category</label>
            <span class="prop-value">{{ selectedNodeData.category }}</span>
          </div>
          <div
            v-for="(value, key) in selectedNodeData.properties"
            :key="key"
            class="prop-row"
          >
            <label>{{ getPropertyControl(key, value).label || key }}</label>
            <!-- Slider control -->
            <q-slider
              v-if="getPropertyControl(key, value).control === 'slider'"
              :model-value="value"
              dense dark
              class="prop-input"
              :min="getPropertyControl(key, value).min"
              :max="getPropertyControl(key, value).max"
              :step="getPropertyControl(key, value).step || 0.01"
              @update:model-value="updateNodeProp(key, $event)"
            />
            <!-- Color control -->
            <q-input
              v-else-if="getPropertyControl(key, value).control === 'color'"
              :model-value="value"
              dense outlined dark
              class="prop-input"
              type="color"
              @update:model-value="updateNodeProp(key, $event)"
            />
            <!-- Select control -->
            <q-select
              v-else-if="getPropertyControl(key, value).control === 'select'"
              :model-value="value"
              dense outlined dark
              class="prop-input"
              :options="getPropertyControl(key, value).options || []"
              @update:model-value="updateNodeProp(key, $event)"
            />
            <!-- Default text input -->
            <q-input
              v-else
              :model-value="value"
              dense outlined dark
              class="prop-input"
              @update:model-value="updateNodeProp(key, $event)"
            />
          </div>
        </div>
      </div>

      <!-- Material Properties -->
      <MaterialProperties v-if="selectedObject && selectedObject.type === 'mesh'" />

      <!-- Physics Properties -->
      <PhysicsProperties v-if="selectedObject" />

      <!-- Environment Properties (always visible) -->
      <EnvironmentProperties />
    </div>
  </div>
</template>

<script setup>
/**
 * RightPropertyPanel - 右侧属性面板
 */
import { ref, reactive, computed } from 'vue'
import { useEditorStore } from '../../stores/editorStore'
import { useSceneStore } from '../../stores/sceneStore'
import { useNodeStore } from '../../stores/nodeStore'
import selectionManager from '../../core/editing/SelectionManager.js'
import nodeRegistry from '../../core/nodes/registry/NodeRegistry.js'
import ObjectProperties from './properties/ObjectProperties.vue'
import TransformProperties from './properties/TransformProperties.vue'
import MaterialProperties from './properties/MaterialProperties.vue'
import PhysicsProperties from './properties/PhysicsProperties.vue'
import DisplayPanelProperties from './properties/DisplayPanelProperties.vue'
import EnvironmentProperties from './properties/EnvironmentProperties.vue'

const editorStore = useEditorStore()
const sceneStore = useSceneStore()
const nodeStore = useNodeStore()

const pinned = ref(false)

const sections = reactive({
  node: true
})

const selectedObject = computed(() => {
  if (selectionManager.state.selectedObjectIds.length === 0) return null
  return sceneStore.objects.find(o => o.id === selectionManager.state.selectedObjectIds[0]) || null
})

const selectedNodeData = computed(() => {
  if (!nodeStore.selectedNodeId) return null
  return nodeStore.getSelectedNode()
})

// Get uiSchema for the selected node's type
const selectedNodeUiSchema = computed(() => {
  if (!selectedNodeData.value) return null
  const typeDef = nodeRegistry.getType(selectedNodeData.value.typeId || selectedNodeData.value.type)
  return typeDef?.uiSchema || null
})

function inferControl(key, value) {
  if (typeof value === 'number') {
    if (value >= 0 && value <= 1) return { control: 'slider', min: 0, max: 1, step: 0.01, label: key }
    return { control: 'slider', min: 0, max: Math.max(100, value * 2), step: 0.1, label: key }
  }
  if (typeof value === 'string' && value.match(/^#[0-9a-fA-F]{6}$/)) {
    return { control: 'color', label: key }
  }
  return { control: 'text', label: key }
}

function getPropertyControl(key, value) {
  if (selectedNodeUiSchema.value && selectedNodeUiSchema.value[key]) {
    return selectedNodeUiSchema.value[key]
  }
  return inferControl(key, value)
}

const hasContent = computed(() => selectedObject.value || selectedNodeData.value)

const panelTitle = computed(() => {
  if (selectedObject.value) return selectedObject.value.name
  if (selectedNodeData.value) return `Node: ${selectedNodeData.value.title}`
  return 'Properties'
})

function onObjectUpdate({ prop, value }) {
  if (selectedObject.value) {
    sceneStore.updateObject(selectedObject.value.id, { [prop]: value })
  }
}

function onTransformUpdate({ group, axis, value }) {
  if (!selectedObject.value) return
  sceneStore.updateObject(selectedObject.value.id, {
    [group]: { ...selectedObject.value[group], [axis]: value }
  })
}

function updateNodeProp(key, value) {
  if (nodeStore.selectedNodeId) {
    nodeStore.updateNodeProperty(nodeStore.selectedNodeId, key, value)
  }
}
</script>

<style scoped>
.right-panel {
  width: 280px; min-width: 200px; max-width: 400px;
  background: var(--editor-bg-panel);
  border-left: 1px solid var(--editor-border);
  display: flex; flex-direction: column; overflow: hidden;
}
.panel-header {
  display: flex; align-items: center; justify-content: space-between;
  padding: 6px 10px;
  background: var(--editor-bg-toolbar);
  border-bottom: 1px solid var(--editor-border);
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.5px;
  color: var(--editor-text-secondary);
}
.panel-header-title { display: flex; align-items: center; gap: 6px; }
.panel-content { flex: 1; overflow-y: auto; padding: 4px 0; }

/* Empty State */
.panel-empty {
  display: flex; flex-direction: column; align-items: center; justify-content: center;
  padding: 40px 20px; color: var(--editor-text-muted); text-align: center;
}
.panel-empty p { margin-top: 12px; font-size: 12px; }
.panel-empty-shortcuts { margin-top: 20px; display: flex; flex-direction: column; gap: 8px; }
.shortcut-item { display: flex; align-items: center; gap: 10px; font-size: 11px; color: var(--editor-text-muted); }

/* Shared Section Styles */
.property-section { border-bottom: 1px solid var(--editor-border); }
.section-title {
  display: flex; align-items: center; gap: 4px;
  padding: 8px 12px;
  font-size: 11px; font-weight: 600;
  text-transform: uppercase; letter-spacing: 0.3px;
  color: var(--editor-text-secondary);
  cursor: pointer; transition: background 0.1s;
}
.section-title:hover { background: var(--editor-bg-hover); }
.section-body { padding: 4px 12px 10px; }

.prop-row { display: flex; align-items: center; gap: 8px; margin-bottom: 6px; }
.prop-row label { min-width: 70px; font-size: 11px; color: var(--editor-text-secondary); }
.prop-input { flex: 1; }
.prop-input :deep(.q-field__control) { height: 26px; min-height: 26px; }
.prop-input :deep(.q-field__native) { font-size: 11px; padding: 0 8px; }
.prop-value { font-size: 11px; color: var(--editor-text-muted); }
</style>
