<template>
  <div class="property-section">
    <div class="section-title" @click="collapsed = !collapsed">
      <q-icon :name="collapsed ? 'chevron_right' : 'expand_more'" size="16px" />
      <span>Object</span>
    </div>
    <div v-show="!collapsed" class="section-body">
      <div class="prop-row">
        <label>Name</label>
        <q-input
          :model-value="obj.name"
          dense
          outlined
          dark
          class="prop-input"
          @update:model-value="emit('update', { prop: 'name', value: $event })"
        />
      </div>
      <div class="prop-row">
        <label>Type</label>
        <span class="prop-value">{{ obj.type }}</span>
      </div>
      <div class="prop-row">
        <label>Visible</label>
        <q-toggle
          :model-value="obj.visible"
          dense
          dark
          @update:model-value="emit('update', { prop: 'visible', value: $event })"
        />
      </div>
      <div class="prop-row">
        <label>Locked</label>
        <q-toggle
          :model-value="obj.locked"
          dense
          dark
          @update:model-value="emit('update', { prop: 'locked', value: $event })"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const props = defineProps({
  obj: {
    type: Object,
    required: true
  }
})

const emit = defineEmits(['update'])

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
</style>