<template>
  <div class="property-section">
    <div class="section-title" @click="collapsed = !collapsed">
      <q-icon :name="collapsed ? 'chevron_right' : 'expand_more'" size="16px" />
      <span>Transform</span>
    </div>
    <div v-show="!collapsed" class="section-body">
      <!-- Position -->
      <div class="prop-group-label">Position</div>
      <div class="prop-row-vec">
        <label class="vec-label x-label">X</label>
        <q-input
          :model-value="position.x"
          type="number"
          dense
          outlined
          dark
          class="prop-input-vec"
          step="0.1"
          @update:model-value="emit('update-transform', { group: 'position', axis: 'x', value: Number($event) })"
        />
        <label class="vec-label y-label">Y</label>
        <q-input
          :model-value="position.y"
          type="number"
          dense
          outlined
          dark
          class="prop-input-vec"
          step="0.1"
          @update:model-value="emit('update-transform', { group: 'position', axis: 'y', value: Number($event) })"
        />
        <label class="vec-label z-label">Z</label>
        <q-input
          :model-value="position.z"
          type="number"
          dense
          outlined
          dark
          class="prop-input-vec"
          step="0.1"
          @update:model-value="emit('update-transform', { group: 'position', axis: 'z', value: Number($event) })"
        />
      </div>

      <!-- Rotation -->
      <div class="prop-group-label">Rotation (deg)</div>
      <div class="prop-row-vec">
        <label class="vec-label x-label">X</label>
        <q-input
          :model-value="rotation.x"
          type="number"
          dense
          outlined
          dark
          class="prop-input-vec"
          step="1"
          @update:model-value="emit('update-transform', { group: 'rotation', axis: 'x', value: Number($event) })"
        />
        <label class="vec-label y-label">Y</label>
        <q-input
          :model-value="rotation.y"
          type="number"
          dense
          outlined
          dark
          class="prop-input-vec"
          step="1"
          @update:model-value="emit('update-transform', { group: 'rotation', axis: 'y', value: Number($event) })"
        />
        <label class="vec-label z-label">Z</label>
        <q-input
          :model-value="rotation.z"
          type="number"
          dense
          outlined
          dark
          class="prop-input-vec"
          step="1"
          @update:model-value="emit('update-transform', { group: 'rotation', axis: 'z', value: Number($event) })"
        />
      </div>

      <!-- Scale -->
      <div class="prop-group-label">Scale</div>
      <div class="prop-row-vec">
        <label class="vec-label x-label">X</label>
        <q-input
          :model-value="scale.x"
          type="number"
          dense
          outlined
          dark
          class="prop-input-vec"
          step="0.1"
          @update:model-value="emit('update-transform', { group: 'scale', axis: 'x', value: Number($event) })"
        />
        <label class="vec-label y-label">Y</label>
        <q-input
          :model-value="scale.y"
          type="number"
          dense
          outlined
          dark
          class="prop-input-vec"
          step="0.1"
          @update:model-value="emit('update-transform', { group: 'scale', axis: 'y', value: Number($event) })"
        />
        <label class="vec-label z-label">Z</label>
        <q-input
          :model-value="scale.z"
          type="number"
          dense
          outlined
          dark
          class="prop-input-vec"
          step="0.1"
          @update:model-value="emit('update-transform', { group: 'scale', axis: 'z', value: Number($event) })"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

defineProps({
  position: {
    type: Object,
    required: true
  },
  rotation: {
    type: Object,
    required: true
  },
  scale: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update-transform'])

const collapsed = ref(false)
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

.prop-group-label {
  font-size: 10px;
  color: var(--editor-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.3px;
  margin: 8px 0 4px;
}

.prop-row-vec {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-bottom: 4px;
  flex-wrap: wrap;
}

.vec-label {
  width: 14px;
  height: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  font-size: 10px;
  font-weight: 700;
  flex-shrink: 0;
}

.x-label {
  background: rgba(255, 100, 100, 0.3);
  color: #ff6b6b;
}

.y-label {
  background: rgba(100, 255, 100, 0.3);
  color: #51cf66;
}

.z-label {
  background: rgba(100, 100, 255, 0.3);
  color: #339af0;
}

.prop-input-vec {
  width: 60px;
  min-width: 50px;
}

.prop-input-vec :deep(.q-field__control) {
  height: 22px;
  min-height: 22px;
}

.prop-input-vec :deep(.q-field__native) {
  font-size: 10px;
  padding: 0 4px;
}
</style>