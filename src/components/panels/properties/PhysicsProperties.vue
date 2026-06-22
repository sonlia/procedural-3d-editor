<template>
  <div v-if="selectedObject" class="property-section">
    <div class="section-title" @click="collapsed = !collapsed">
      <q-icon :name="collapsed ? 'chevron_right' : 'expand_more'" size="16px" />
      <span>Physics</span>
    </div>
    <div v-show="!collapsed" class="section-body">
      <div class="prop-row">
        <label>Enable Physics</label>
        <q-toggle
          :model-value="selectedObject.physicsEnabled"
          dense
          dark
          @update:model-value="updatePhysicsProp('physicsEnabled', $event)"
        />
      </div>
      <template v-if="selectedObject.physicsEnabled">
        <div class="prop-row">
          <label>Body Type</label>
          <q-select
            :model-value="bodyType"
            dense
            outlined
            dark
            class="prop-input"
            :options="bodyTypeOptions"
            emit-value
            map-options
            @update:model-value="updatePhysicsProp('bodyType', $event)"
          />
        </div>
        <div class="prop-row">
          <label>Mass</label>
          <q-input
            :model-value="mass"
            type="number"
            dense
            outlined
            dark
            class="prop-input"
            step="0.1"
            @update:model-value="updatePhysicsProp('mass', Number($event))"
          />
        </div>
      </template>
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

const bodyTypeOptions = [
  { label: 'Static', value: 'static' },
  { label: 'Dynamic', value: 'dynamic' },
  { label: 'Kinematic', value: 'kinematic' }
]

const bodyType = computed(() => {
  return selectedObject.value?.metadata?.bodyType || 'dynamic'
})

const mass = computed(() => {
  return selectedObject.value?.metadata?.mass ?? 1.0
})

function updatePhysicsProp(prop, value) {
  if (!selectedObject.value) return
  if (prop === 'physicsEnabled') {
    sceneStore.updateObject(selectedObject.value.id, { physicsEnabled: value })
  } else {
    sceneStore.updateObject(selectedObject.value.id, {
      metadata: { ...selectedObject.value.metadata, [prop]: value }
    })
  }
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
</style>