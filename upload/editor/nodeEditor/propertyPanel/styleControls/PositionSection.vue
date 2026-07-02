<template>
  <div class="position-section">
    <!-- Section header -->
    <div class="section-header row items-center no-wrap">
      <span class="section-label">定位</span>
      <q-space />
      <q-btn
        v-if="styleData.sectionHasValue('position')"
        flat dense dark round
        icon="close"
        @click="styleData.clearSection('position')"
      >
        <q-tooltip>清除定位</q-tooltip>
      </q-btn>
    </div>

    <div class="section-content">
      <!-- Position type buttons -->
      <div class="q-mb-md">
        <q-btn-group flat class="position-type-group">
          <q-btn
            v-for="pt in positionTypes" :key="pt.value"
            flat dense dark size="sm"
            :icon="pt.icon"
            :color="positionType === pt.value ? 'primary' : undefined"
            @click="setPositionType(pt.value)"
          >
            <q-tooltip>{{ pt.label }}</q-tooltip>
          </q-btn>
        </q-btn-group>
        <div class="text-caption text-grey-6 q-mt-xs text-center">
          {{ currentTypeLabel }}
        </div>
      </div>

      <!-- Container position grid (absolute) -->
      <div v-if="positionType === 'container'" class="q-mb-md">
        <div class="position-grid">
          <q-btn
            v-for="pos in containerPositions" :key="pos.value"
            flat dense dark
            :color="styleData.getValue('position') === pos.value ? 'primary' : undefined"
            class="grid-btn"
            @click="styleData.setValue('position', pos.value)"
          >
            <q-tooltip>{{ pos.label }}</q-tooltip>
            <q-icon :name="pos.icon"  />
          </q-btn>
        </div>
      </div>

      <!-- Screen position (fixed) -->
      <div v-if="positionType === 'screen'" class="q-mb-md">
        <div class="row q-gutter-xs" style="flex-wrap: wrap;">
          <q-btn
            v-for="pos in screenPositions" :key="pos.value"
            flat dense dark
            :label="pos.label"
            :color="styleData.getValue('position') === pos.value ? 'primary' : undefined"
            class="screen-btn"
            @click="styleData.setValue('position', pos.value)"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import { CONTAINER_POSITIONS, SCREEN_POSITIONS } from './useStyleData.js'

const styleData = inject('styleData')

// Position type definitions
const positionTypes = [
  { value: 'flow', label: '文档流', icon: 'description' },
  { value: 'container', label: '容器内', icon: 'push_pin' },
  { value: 'screen', label: '屏幕上', icon: 'my_location' },
  { value: 'fullscreen', label: '全屏', icon: 'fullscreen' },
]

// Derive current position type from the stored value
const positionType = computed(() => {
  const val = styleData.getValue('position')
  if (!val) return 'flow'
  if (val === 'fullscreen') return 'fullscreen'
  if (CONTAINER_POSITIONS.has(val)) return 'container'
  if (SCREEN_POSITIONS.has(val)) return 'screen'
  return 'flow'
})

const currentTypeLabel = computed(() => {
  const found = positionTypes.find(pt => pt.value === positionType.value)
  return found ? found.label : ''
})

// Container positions (3x3 grid for absolute)
const containerPositions = [
  { value: 'absolute-top-left', label: '左上', icon: 'north_west' },
  { value: 'absolute-top', label: '上', icon: 'north' },
  { value: 'absolute-top-right', label: '右上', icon: 'north_east' },
  { value: 'absolute-left', label: '左', icon: 'west' },
  { value: 'absolute-center', label: '居中', icon: 'center_focus_strong' },
  { value: 'absolute-right', label: '右', icon: 'east' },
  { value: 'absolute-bottom-left', label: '左下', icon: 'south_west' },
  { value: 'absolute-bottom', label: '下', icon: 'south' },
  { value: 'absolute-bottom-right', label: '右下', icon: 'south_east' },
]

// Screen positions (fixed)
const screenPositions = [
  { value: 'fixed-top', label: '顶部' },
  { value: 'fixed-bottom', label: '底部' },
  { value: 'fixed-left', label: '左' },
  { value: 'fixed-right', label: '右' },
  { value: 'fixed-top-left', label: '左上' },
  { value: 'fixed-top-right', label: '右上' },
  { value: 'fixed-bottom-left', label: '左下' },
  { value: 'fixed-bottom-right', label: '右下' },
  { value: 'fixed-center', label: '居中' },
]

// Set position type
function setPositionType(type) {
  switch (type) {
    case 'flow':
      styleData.setValue('position', undefined)
      break
    case 'container':
      ensureParentRelative()
      styleData.setValue('position', 'absolute-center')
      break
    case 'screen':
      styleData.setValue('position', 'fixed-center')
      break
    case 'fullscreen':
      styleData.toggleValue('position', 'fullscreen')
      break
  }
}

// Auto-set parent to relative-position if needed
function ensureParentRelative() {
  const parentPos = styleData.parentStyleClass?.value?.position
  if (!parentPos || !parentPos.startsWith('relative')) {
    styleData.setParentValue('position', 'relative-position')
  }
}
</script>

<style scoped>
.position-section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.section-label {
  user-select: none;
}

.position-type-group {
  max-width: 200px;
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
}

.position-type-group .q-btn {
  min-height: 28px;
  font-size: 0.75em;
}

/* 3x3 position grid */
.position-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  max-width: 96px;
  margin: 0 auto;
}

.grid-btn {
  width: 24px;
  height: 24px;
  min-width: 24px;
  min-height: 24px;
  padding: 2px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.grid-btn :deep(.q-btn__content) {
  min-width: 0;
}

/* Screen position buttons */
.screen-btn {
  min-width: 0;
  padding: 2px 6px;
  font-size: 0.72em;
  text-transform: none;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}
</style>
