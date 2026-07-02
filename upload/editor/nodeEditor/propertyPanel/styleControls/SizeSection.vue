<template>
  <div class="size-section">
    <!-- Section header -->
    <div class="section-header row items-center no-wrap">
      <span class="section-label">尺寸</span>
      <q-space />
      <q-btn
        v-if="hasAnySize"
        flat dense dark round
        icon="close"
        @click="clearAll"
      >
        <q-tooltip>清除尺寸</q-tooltip>
      </q-btn>
    </div>

    <div class="section-content">
      <!-- Width -->
      <div class="q-mb-md">
        <div class="row items-center q-mb-xs">
          <span class="control-label">宽度</span>
        </div>
        <div class="row items-center q-gutter-xs flex-wrap">
          <q-btn
            flat dense dark
            label="auto"
            :color="widthMode === 'auto' ? 'primary' : undefined"
            class="size-btn"
            @click="setPresetWidth(undefined)"
          />
          <q-btn
            flat dense dark
            label="100%"
            :color="widthMode === 'full' ? 'primary' : undefined"
            class="size-btn"
            @click="setPresetWidth('full-width')"
          />
          <q-btn
            flat dense dark
            label="100vw"
            :color="widthMode === 'window' ? 'primary' : undefined"
            class="size-btn"
            @click="setPresetWidth('window-width')"
          />
          <q-separator dark vertical class="q-mx-xs" />
          <q-input
            :model-value="widthCustom.num"
            @update:model-value="v => setCustomWidth(v, widthCustom.unit)"
            type="number"
            dense dark borderless
            placeholder="数值"
            class="num-input"
            :input-class="widthMode === 'custom' ? 'text-primary' : ''"
          />
          <q-select
            :model-value="widthCustom.unit"
            @update:model-value="v => setCustomWidth(widthCustom.num, v)"
            :options="unitOptions"
            dense dark borderless
            options-dense
            class="unit-select"
            popup-content-class="bg-dark"
          />
        </div>
      </div>

      <q-separator dark class="q-my-xs" />

      <!-- Height -->
      <div class="q-mb-md">
        <div class="row items-center q-mb-xs">
          <span class="control-label">高度</span>
        </div>
        <div class="row items-center q-gutter-xs flex-wrap">
          <q-btn
            flat dense dark
            label="auto"
            :color="heightMode === 'auto' ? 'primary' : undefined"
            class="size-btn"
            @click="setPresetHeight(undefined)"
          />
          <q-btn
            flat dense dark
            label="100%"
            :color="heightMode === 'full' ? 'primary' : undefined"
            class="size-btn"
            @click="setPresetHeight('full-height')"
          />
          <q-btn
            flat dense dark
            label="100vh"
            :color="heightMode === 'window' ? 'primary' : undefined"
            class="size-btn"
            @click="setPresetHeight('window-height')"
          />
          <q-separator dark vertical class="q-mx-xs" />
          <q-input
            :model-value="heightCustom.num"
            @update:model-value="v => setCustomHeight(v, heightCustom.unit)"
            type="number"
            dense dark borderless
            placeholder="数值"
            class="num-input"
            :input-class="heightMode === 'custom' ? 'text-primary' : ''"
          />
          <q-select
            :model-value="heightCustom.unit"
            @update:model-value="v => setCustomHeight(heightCustom.num, v)"
            :options="unitOptions"
            dense dark borderless
            options-dense
            class="unit-select"
            popup-content-class="bg-dark"
          />
        </div>
      </div>

      <q-separator dark class="q-my-xs" />

      <!-- Fit shortcut -->
      <div class="q-mb-md">
        <q-btn
          flat dense dark
          :label="isFit ? '取消铺满' : '宽高铺满 (fit)'"
          :color="isFit ? 'primary' : undefined"
          class="fit-btn"
          :icon="isFit ? 'check_box' : 'fit_screen'"
          @click="toggleFit"
        />
      </div>

      <!-- Info hint -->
      <div class="text-caption text-grey-6 row items-center no-wrap">
        <q-icon name="info" class="q-mr-xs" />
        需要 min/max 尺寸？请使用 CSS 编辑器
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'

const styleData = inject('styleData')

// === 单位选项 ===
const unitOptions = ['px', 'rem', 'em', 'vh', 'vw', '%']

// === 解析 inline 数值 ===
function parseSize(str) {
  if (!str) return { num: '', unit: 'px' }
  const m = String(str).match(/^([-\d.]+)\s*([a-z%]+)?$/i)
  if (m) return { num: m[1], unit: m[2] || 'px' }
  return { num: '', unit: 'px' }
}

// === Width ===
const widthCustom = computed(() => parseSize(styleData.getInlineStyle('width')))
const widthPreset = computed(() => styleData.getValue('sizeWidth'))

const widthMode = computed(() => {
  if (widthCustom.value.num !== '') return 'custom'
  if (widthPreset.value === 'full-width') return 'full'
  if (widthPreset.value === 'window-width') return 'window'
  return 'auto'
})

function setPresetWidth(preset) {
  styleData.setInlineStyle('width', undefined)
  styleData.setValue('sizeWidth', preset)
}

function setCustomWidth(num, unit) {
  const u = unit || 'px'
  if (num === '' || num === null || num === undefined) {
    styleData.setInlineStyle('width', undefined)
    return
  }
  styleData.setValue('sizeWidth', undefined)
  styleData.setInlineStyle('width', `${num}${u}`)
}

// === Height ===
const heightCustom = computed(() => parseSize(styleData.getInlineStyle('height')))
const heightPreset = computed(() => styleData.getValue('sizeHeight'))

const heightMode = computed(() => {
  if (heightCustom.value.num !== '') return 'custom'
  if (heightPreset.value === 'full-height') return 'full'
  if (heightPreset.value === 'window-height') return 'window'
  return 'auto'
})

function setPresetHeight(preset) {
  styleData.setInlineStyle('height', undefined)
  styleData.setValue('sizeHeight', preset)
}

function setCustomHeight(num, unit) {
  const u = unit || 'px'
  if (num === '' || num === null || num === undefined) {
    styleData.setInlineStyle('height', undefined)
    return
  }
  styleData.setValue('sizeHeight', undefined)
  styleData.setInlineStyle('height', `${num}${u}`)
}

// === Fit ===
const isFit = computed(() => {
  return widthPreset.value === 'full-width'
    && heightPreset.value === 'full-height'
    && widthMode.value === 'full'
    && heightMode.value === 'full'
})

function toggleFit() {
  if (isFit.value) {
    setPresetWidth(undefined)
    setPresetHeight(undefined)
  } else {
    setPresetWidth('full-width')
    setPresetHeight('full-height')
  }
}

// === Clear all ===
const hasAnySize = computed(() => {
  return styleData.sectionHasValue('size')
    || widthCustom.value.num !== ''
    || heightCustom.value.num !== ''
})

function clearAll() {
  styleData.clearSection('size')
  styleData.setInlineStyle('width', undefined)
  styleData.setInlineStyle('height', undefined)
}
</script>

<style scoped>
.size-section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.section-label {
  user-select: none;
}

.control-label {
  font-size: 0.8em;
  color: rgba(255, 255, 255, 0.7);
  user-select: none;
}

.size-btn {
  min-width: 0;
  min-height: 24px;
  padding: 2px 8px;
  font-size: 0.74em;
  text-transform: none;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.fit-btn {
  font-size: 0.78em;
  text-transform: none;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}

.num-input {
  width: 60px;
  min-width: 60px;
}

:deep(.num-input .q-field__control) {
  min-height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
  padding: 0 4px;
}

:deep(.num-input .q-field__native) {
  font-size: 0.74em;
  color: rgba(255, 255, 255, 0.9);
  min-height: 24px;
  padding: 0;
  text-align: center;
}

.unit-select {
  min-width: 54px;
  max-width: 60px;
}

:deep(.unit-select .q-field__native) {
  font-size: 0.72em;
  color: rgba(255, 255, 255, 0.8);
  padding: 0 4px;
  min-height: 24px;
}

:deep(.unit-select .q-field__control) {
  min-height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}
</style>
