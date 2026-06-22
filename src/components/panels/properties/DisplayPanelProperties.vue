<template>
  <div v-if="selectedObject && selectedObject.type === 'display_panel'" class="property-section">
    <div class="section-title" @click="collapsed = !collapsed">
      <q-icon :name="collapsed ? 'chevron_right' : 'expand_more'" size="16px" />
      <span>Display Panel</span>
    </div>
    <div v-show="!collapsed" class="section-body">
      <div class="prop-row">
        <label>Panel Type</label>
        <span class="prop-value">{{ selectedObject.metadata?.panelType || 'N/A' }}</span>
      </div>
      <div class="prop-row">
        <label>Billboard</label>
        <q-select
          :model-value="billboardMode"
          dense
          outlined
          dark
          class="prop-input"
          :options="billboardOptions"
          emit-value
          map-options
          @update:model-value="updatePanelProp('billboard', $event)"
        />
      </div>
      <div class="prop-row">
        <label>Opacity</label>
        <q-slider
          :model-value="panelOpacity"
          :min="0"
          :max="1"
          :step="0.05"
          dense
          dark
          color="blue-4"
          class="prop-slider"
          @update:model-value="updatePanelProp('opacity', $event)"
        />
        <span class="prop-value-narrow">{{ panelOpacity.toFixed(2) }}</span>
      </div>
      <div class="prop-row">
        <label>Show Distance</label>
        <q-input
          :model-value="showDistance"
          type="number"
          dense
          outlined
          dark
          class="prop-input"
          step="0.5"
          @update:model-value="updatePanelProp('showDistance', Number($event))"
        />
      </div>
      <div class="prop-row">
        <label>Background</label>
        <input
          type="color"
          :value="bgColor"
          class="color-picker"
          @input="updatePanelProp('bgColor', $event.target.value)"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useSceneStore } from '../../../stores/sceneStore'
import selectionManager from '../../../core/editing/SelectionManager.js'

const sceneStore = useSceneStore()

const selectedObject = computed(() => {
  const ids = selectionManager.state.selectedObjectIds
  if (ids.length === 0) return null
  return sceneStore.objects.find(o => o.id === ids[0]) || null
})

const collapsed = ref(false)

const billboardOptions = [
  { label: 'Face Camera', value: 'camera' },
  { label: 'Fixed', value: 'fixed' },
  { label: 'Follow Object', value: 'object' },
  { label: 'Y-Axis Lock', value: 'y_lock' }
]

const billboardMode = computed(() => {
  return selectedObject.value?.metadata?.billboard || 'camera'
})

const panelOpacity = computed(() => {
  return selectedObject.value?.metadata?.opacity ?? 0.85
})

const showDistance = computed(() => {
  return selectedObject.value?.metadata?.showDistance ?? 50
})

const bgColor = computed(() => {
  return selectedObject.value?.metadata?.bgColor || '#1a1a2e'
})

function updatePanelProp(prop, value) {
  if (!selectedObject.value) return
  sceneStore.updateObject(selectedObject.value.id, {
    metadata: { ...selectedObject.value.metadata, [prop]: value }
  })
}
</script>

<style scoped>
.property-section {
  border-bottom: 1px solid var(--editor-border);
}

.section-title {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 8px 12px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: var(--editor-text-secondary);
  cursor: pointer;
  transition: background 0.1s;
  user-select: none;
}

.section-title:hover {
  background: var(--editor-bg-hover);
}

.section-body {
  padding: 4px 12px 10px;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-bottom: 6px;
}

.prop-row label {
  min-width: 70px;
  font-size: 11px;
  color: var(--editor-text-secondary);
}

.prop-input {
  flex: 1;
}

.prop-input :deep(.q-field__control) {
  height: 26px;
  min-height: 26px;
}

.prop-input :deep(.q-field__native) {
  font-size: 11px;
  padding: 0 8px;
}

.prop-value {
  font-size: 11px;
  color: var(--editor-text-muted);
}

.prop-value-narrow {
  font-size: 10px;
  color: var(--editor-text-muted);
  min-width: 32px;
  text-align: right;
}

.prop-slider {
  flex: 1;
}

.color-picker {
  width: 32px;
  height: 22px;
  border: 1px solid var(--editor-border);
  border-radius: 3px;
  cursor: pointer;
  background: transparent;
  padding: 1px;
}
</style>