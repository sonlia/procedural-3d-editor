<template>
  <div class="appearance-section">
    <!-- Section Header -->
    <div class="section-header row items-center justify-between">
      <span>外观</span>
      <q-btn
        v-if="styleData.sectionHasValue('appearance')"
        flat dense dark round
        icon="close"
        size="xs"
        color="grey-6"
        @click="styleData.clearSection('appearance')"
      >
        <q-tooltip>清除外观设置</q-tooltip>
      </q-btn>
    </div>

    <div class="section-content">
      <!-- Colors -->
      <div class="row q-col-gutter-sm q-mb-md">
        <!-- 文字色 -->
        <div class="col-6">
          <div class="text-caption label-text q-mb-xs">文字色</div>
          <div class="row items-center q-gutter-xs">
            <div
              class="color-square"
              :style="{ backgroundColor: textColorDisplay }"
            >
              <q-menu anchor="bottom left" self="top left" dark>
                <q-card class="color-picker-popup" dark>
                  <q-card-section class="q-pa-sm">
                    <q-input
                      v-model="textColorSearch"
                      dense outlined dark
                      placeholder="搜索颜色..."
                      class="q-mb-xs"
                    >
                      <template #prepend>
                        <q-icon name="search" size="sm" />
                      </template>
                    </q-input>
                    <div class="color-grid">
                      <div
                        v-for="c in filteredTextColors"
                        :key="c"
                        :class="`bg-${c}`"
                        class="color-cell"
                        @click="selectTextColor(c)"
                      >
                        <q-tooltip>{{ c }}</q-tooltip>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </q-menu>
            </div>
            <q-input
              :model-value="textColorRaw"
              @update:model-value="onTextColorInput"
              dense outlined dark
              placeholder="text-blue-5"
              class="col color-input"
            />
          </div>
        </div>

        <!-- 背景色 -->
        <div class="col-6">
          <div class="text-caption label-text q-mb-xs">背景色</div>
          <div class="row items-center q-gutter-xs">
            <div
              class="color-square"
              :style="{ backgroundColor: bgColorDisplay }"
            >
              <q-menu anchor="bottom left" self="top left" dark>
                <q-card class="color-picker-popup" dark>
                  <q-card-section class="q-pa-sm">
                    <q-input
                      v-model="bgColorSearch"
                      dense outlined dark
                      placeholder="搜索颜色..."
                      class="q-mb-xs"
                    >
                      <template #prepend>
                        <q-icon name="search" size="sm" />
                      </template>
                    </q-input>
                    <div class="color-grid">
                      <div
                        v-for="c in filteredBgColors"
                        :key="c"
                        :class="`bg-${c}`"
                        class="color-cell"
                        @click="selectBgColor(c)"
                      >
                        <q-tooltip>{{ c }}</q-tooltip>
                      </div>
                    </div>
                  </q-card-section>
                </q-card>
              </q-menu>
            </div>
            <q-input
              :model-value="bgColorRaw"
              @update:model-value="onBgColorInput"
              dense outlined dark
              placeholder="bg-red-5"
              class="col color-input"
            />
          </div>
        </div>
      </div>

      <q-separator dark class="q-my-sm" />

      <!-- 字号 Font Size Slider -->
      <div class="row items-center q-mb-md">
        <div class="text-caption label-text slider-label">字号</div>
        <q-slider
          :model-value="fontSizeIndex"
          @update:model-value="onFontSizeChange"
          :min="0"
          :max="11"
          :step="1"
          snap
          label
          :label-value="fontSizeLabel"
          dark
          dense
          color="primary"
          class="col"
        />
        <q-btn
          v-if="styleData.getValue('fontSize') !== undefined"
          flat dense dark round
          icon="close"

          color="grey-5"
          class="q-ml-xs"
          @click="styleData.setValue('fontSize', undefined)"
        />
      </div>

      <!-- 阴影 Shadow Slider -->
      <div class="row items-center q-mb-md">
        <div class="text-caption label-text slider-label">阴影</div>
        <q-slider
          :model-value="shadowValue"
          @update:model-value="onShadowChange"
          :min="0"
          :max="24"
          :step="1"
          snap
          label
          dark
          dense
          color="amber"
          class="col"
        />
        <q-btn
          v-if="styleData.getValue('shadow') !== undefined"
          flat dense dark round
          icon="close"

          color="grey-5"
          class="q-ml-xs"
          @click="styleData.setValue('shadow', undefined)"
        />
      </div>

      <q-separator dark class="q-my-sm" />

      <!-- 粗细 Font Weight -->
      <div class="q-mb-md">
        <div class="text-caption label-text q-mb-xs">粗细</div>
        <q-btn-toggle
          :model-value="styleData.getValue('fontWeight')"
          @update:model-value="val => styleData.setValue('fontWeight', val || undefined)"
          clearable
          no-caps
          toggle-color="primary"
          flat
          dense
          dark
          :options="fontWeightOptions"
          class="compact-toggle"
        />
      </div>

      <!-- 文字对齐 Text Align -->
      <div class="q-mb-md">
        <div class="text-caption label-text q-mb-xs">文字对齐</div>
        <q-btn-group flat spread class="full-width">
          <q-btn
            v-for="opt in textAlignOptions"
            :key="opt.value"
            flat dense dark
            :icon="opt.icon"
            size="sm"
            :color="styleData.getValue('textAlign') === opt.value ? 'primary' : 'grey-5'"
            @click="styleData.toggleValue('textAlign', opt.value)"
          >
            <q-tooltip>{{ opt.label }}</q-tooltip>
          </q-btn>
        </q-btn-group>
      </div>

      <q-separator dark class="q-my-sm" />

      <!-- 文字样式 -->
      <div class="q-mb-md">
        <div class="text-caption label-text q-mb-xs">文字样式</div>
        <div class="row q-gutter-sm">
          <q-checkbox
            v-for="opt in textDecorationOptions"
            :key="opt.value"
            :model-value="(styleData.getValue('textDecoration') || []).includes(opt.value)"
            @update:model-value="styleData.toggleArrayValue('textDecoration', opt.value)"
            :label="opt.label"
            dense dark
            size="sm"
          />
        </div>
      </div>

      <!-- 溢出 Overflow -->
      <div>
        <div class="text-caption label-text q-mb-xs">溢出</div>
        <q-btn-toggle
          :model-value="styleData.getValue('overflow')"
          @update:model-value="val => styleData.setValue('overflow', val || undefined)"
          clearable
          no-caps
          spread
          toggle-color="primary"
          flat
          dense
          dark
          :options="overflowOptions"
          class="compact-toggle"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, inject } from 'vue'
import { FONT_SIZE_STEPS, FONT_SIZE_LABELS } from './useStyleData.js'
import { colors } from 'quasar'

const styleData = inject('styleData')

// === Color Palette ===
const colorList = [
  'red', 'pink', 'purple', 'deep-purple', 'indigo', 'blue', 'light-blue',
  'cyan', 'teal', 'green', 'light-green', 'lime', 'yellow', 'amber',
  'orange', 'deep-orange', 'brown', 'grey', 'blue-grey',
]
const shades = colorList.flatMap(c =>
  [c, ...Array.from({ length: 14 }, (_, i) => `${c}-${i + 1}`)]
)

const textColorSearch = ref('')
const bgColorSearch = ref('')

const filteredTextColors = computed(() => {
  if (!textColorSearch.value) return shades
  const q = textColorSearch.value.toLowerCase()
  return shades.filter(c => c.includes(q))
})

const filteredBgColors = computed(() => {
  if (!bgColorSearch.value) return shades
  const q = bgColorSearch.value.toLowerCase()
  return shades.filter(c => c.includes(q))
})

// Extract the pure color name from stored value
const extractColor = (val, prefix) => {
  if (!val) return ''
  return val.startsWith(prefix) ? val.slice(prefix.length) : val
}

const textColorRaw = computed(() => styleData.getValue('textColor') || '')
const bgColorRaw = computed(() => styleData.getValue('bgColor') || '')

const textColorDisplay = computed(() => {
  const name = extractColor(textColorRaw.value, 'text-')
  if (!name) return 'transparent'
  return quasarColorToCss(name)
})

const bgColorDisplay = computed(() => {
  const name = extractColor(bgColorRaw.value, 'bg-')
  if (!name) return 'transparent'
  return quasarColorToCss(name)
})

function quasarColorToCss(name) {
  try {
    return colors.getPaletteColor(name)
  } catch {
    return 'transparent'
  }
}

const selectTextColor = (c) => {
  styleData.setValue('textColor', `text-${c}`)
  textColorSearch.value = ''
}

const selectBgColor = (c) => {
  styleData.setValue('bgColor', `bg-${c}`)
  bgColorSearch.value = ''
}

const onTextColorInput = (val) => {
  styleData.setValue('textColor', val || undefined)
}

const onBgColorInput = (val) => {
  styleData.setValue('bgColor', val || undefined)
}

// === Font Size ===
const fontSizeIndex = computed(() => {
  const v = styleData.getValue('fontSize')
  if (!v) return 0
  const idx = FONT_SIZE_STEPS.indexOf(v)
  return idx >= 0 ? idx : 0
})

const fontSizeLabel = computed(() => {
  const v = styleData.getValue('fontSize')
  return v ? (FONT_SIZE_LABELS[v] || '') : '无'
})

const onFontSizeChange = (idx) => {
  styleData.setValue('fontSize', FONT_SIZE_STEPS[idx])
}

// === Shadow ===
const shadowValue = computed(() => {
  const v = styleData.getValue('shadow')
  if (!v) return 0
  const m = v.match(/^shadow-(\d+)$/)
  return m ? parseInt(m[1]) : 0
})

const onShadowChange = (val) => {
  styleData.setValue('shadow', val > 0 ? `shadow-${val}` : undefined)
}

// === Font Weight Options ===
const fontWeightOptions = [
  { label: 'thin', value: 'text-weight-thin' },
  { label: 'light', value: 'text-weight-light' },
  { label: 'regular', value: 'text-weight-regular' },
  { label: 'medium', value: 'text-weight-medium' },
  { label: 'bold', value: 'text-weight-bold' },
  { label: 'bolder', value: 'text-weight-bolder' },
]

// === Text Align ===
const textAlignOptions = [
  { label: '左', icon: 'format_align_left', value: 'text-left' },
  { label: '中', icon: 'format_align_center', value: 'text-center' },
  { label: '右', icon: 'format_align_right', value: 'text-right' },
  { label: '两端', icon: 'format_align_justify', value: 'text-justify' },
]

// === 文字样式 ===
const textDecorationOptions = [
  { label: '斜体', value: 'text-italic' },
  { label: '删除线', value: 'text-strike' },
  { label: '不换行', value: 'text-no-wrap' },
]

// === Overflow ===
const overflowOptions = [
  { label: '无', value: undefined },
  { label: '单行省略', value: 'ellipsis' },
  { label: '2行省略', value: 'ellipsis-2-lines' },
  { label: '3行省略', value: 'ellipsis-3-lines' },
]
</script>

<style scoped>
.appearance-section {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.label-text {
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.75em;
}

.slider-label {
  width: 40px;
  min-width: 40px;
  text-align: right;
  padding-left: 4px;
  padding-right: 8px;
}

/* Color square chip */
.color-square {
  width: 24px;
  height: 24px;
  min-width: 24px;
  border-radius: 4px;
  border: 1.5px solid rgba(255, 255, 255, 0.2);
  cursor: pointer;
  transition: border-color 0.15s;
}

.color-square:hover {
  border-color: rgba(255, 255, 255, 0.6);
}

/* Color input */
.color-input :deep(.q-field__control) {
  height: 24px;
  min-height: 24px;
}

.color-input :deep(.q-field__native) {
  padding: 2px 6px;
  min-height: 20px;
  font-size: 0.75rem;
}

/* Color picker popup */
.color-picker-popup {
  width: 280px;
  background-color: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, 24px);
  gap: 3px;
  max-height: 260px;
  overflow-y: auto;
  padding: 2px;
}

.color-cell {
  width: 24px;
  height: 24px;
  border-radius: 3px;
  cursor: pointer;
  border: 1px solid rgba(255, 255, 255, 0.12);
  transition: all 0.12s;
}

.color-cell:hover {
  border-color: rgba(255, 255, 255, 0.8);
  transform: scale(1.15);
  z-index: 1;
}

/* Compact toggle buttons */
.compact-toggle {
  width: 100%;
}

.compact-toggle :deep(.q-btn) {
  font-size: 0.68em;
  padding: 2px 3px;
  min-height: 24px;
}
</style>
