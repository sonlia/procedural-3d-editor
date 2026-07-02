<template>
  <div v-if="selectedLeafIds.length === 0" class="ai-empty">
    <q-icon name="ads_click" size="sm" />
    <span class="text-caption">选中一个区域以编辑其配置</span>
  </div>

  <div v-else-if="selectedLeafIds.length >= 2" class="ai-multi">
    <div class="ai-header">
      <span class="ai-title">已选 {{ selectedLeafIds.length }} 个区域</span>
      <q-space />
      <q-btn flat dense dark round size="sm" icon="close" class="ai-multi-clear"
        @click="emit('update:selectedLeafIds', [])">
        <q-tooltip>清空选区</q-tooltip>
      </q-btn>
    </div>
    <q-btn
      dense dark no-caps unelevated
      :color="mergeable ? 'primary' : 'grey-7'"
      :disable="!mergeable"
      icon="call_merge"
      label="合并为一个区域"
      class="full-width q-mt-sm"
      @click="doMerge"
    >
      <q-tooltip v-if="!mergeable">所选区域不构成矩形,无法合并</q-tooltip>
    </q-btn>
  </div>

  <div v-else class="area-inspector">
    <!-- 标题 -->
    <div class="ai-header">
      <span class="ai-title">区域 · {{ currentLeafId.slice(0, 10) }}</span>
      <q-space />
      <span class="ai-mode-tag">FLEX</span>
    </div>

    <!-- ===== 占父级 layout 中的尺寸（flexTree leaf.size） ===== -->
    <div class="ai-section-label">尺寸 / 占比</div>
    <div class="row no-wrap items-center q-gutter-xs q-mb-sm">
      <q-btn-group flat>
        <q-btn v-for="m in sizeModes" :key="m.value" flat dense dark no-caps :label="m.label"
          class="ai-mode-btn"
          :color="currentSize?.mode === m.value ? 'primary' : 'grey-7'"
          @click="setSizeMode(m.value)" />
      </q-btn-group>
    </div>
    <div v-if="currentSize?.mode === 'col'" class="row items-center q-gutter-sm q-mb-md">
      <q-slider :model-value="currentSize.value || 6" @update:model-value="setSizeValue"
        :min="1" :max="12" :step="1" dark color="primary" class="col" snap />
      <div class="ai-size-display">col-{{ currentSize.value || 6 }} / 12</div>
    </div>
    <div v-else-if="currentSize?.mode === 'px'" class="q-mb-md">
      <q-input :model-value="currentSize.value" @update:model-value="v => setSizeValue(Number(v) || 0)"
        dense dark borderless type="number" suffix="px" input-class="text-caption" />
    </div>
    <div v-else-if="currentSize?.mode === 'percent'" class="q-mb-md">
      <q-input :model-value="currentSize.value" @update:model-value="v => setSizeValue(Number(v) || 0)"
        dense dark borderless type="number" suffix="%" input-class="text-caption" />
    </div>
    <div v-else-if="currentSize?.mode === 'grow'" class="text-caption text-grey-6 q-mb-md">撑满父级剩余空间</div>
    <div v-else-if="currentSize?.mode === 'shrink'" class="text-caption text-grey-6 q-mb-md">按内容尺寸,不参与剩余分配</div>

    <q-separator dark class="q-my-sm" />

    <!-- ===== 作为父级 layout 的子项 (Flex Item) ===== -->
    <div class="ai-section-label">作为父级中的子项 · Flex Item</div>

    <!-- 对齐 + 顺序 -->
    <div class="row q-gutter-sm q-mb-sm">
      <div class="col">
        <div class="ai-control-label q-mb-xs">独立对齐</div>
        <q-btn-group flat class="full-width">
          <q-btn
            v-for="opt in selfAlignOpts" :key="opt.value"
            flat dense dark no-caps
            :label="opt.label"
            class="flex-1"
            :color="leafGet('selfAlign') === opt.value ? 'primary' : 'grey-7'"
            @click="leafToggle('selfAlign', opt.value)"
          />
        </q-btn-group>
      </div>
      <div class="col">
        <div class="ai-control-label q-mb-xs">顺序</div>
        <q-btn-group flat class="full-width">
          <q-btn
            v-for="opt in orderOpts" :key="opt.value"
            flat dense dark no-caps
            :label="opt.label"
            class="flex-1"
            :color="leafGet('order') === opt.value ? 'primary' : 'grey-7'"
            @click="leafToggle('order', opt.value)"
          />
        </q-btn-group>
      </div>
    </div>

    <q-separator dark class="q-my-sm" />

    <!-- ===== 容器尺寸 ===== -->
    <div class="ai-section-label">容器尺寸 · Size</div>

    <!-- 快捷宽 -->
    <div class="q-mb-xs">
      <div class="ai-control-label q-mb-xs">快捷宽</div>
      <q-btn-group flat class="full-width">
        <q-btn
          v-for="opt in sizeWidthOpts" :key="opt.value"
          flat dense dark no-caps
          :label="opt.label"
          class="flex-1"
          :color="leafGet('sizeWidth') === opt.value ? 'primary' : 'grey-7'"
          @click="leafToggle('sizeWidth', opt.value)"
        />
      </q-btn-group>
    </div>

    <!-- 快捷高 -->
    <div class="q-mb-xs">
      <div class="ai-control-label q-mb-xs">快捷高</div>
      <q-btn-group flat class="full-width">
        <q-btn
          v-for="opt in sizeHeightOpts" :key="opt.value"
          flat dense dark no-caps
          :label="opt.label"
          class="flex-1"
          :color="leafGet('sizeHeight') === opt.value ? 'primary' : 'grey-7'"
          @click="leafToggle('sizeHeight', opt.value)"
        />
      </q-btn-group>
    </div>

    <!-- 数值宽高 -->
    <div class="row q-gutter-sm q-mb-xs">
      <q-input
        :model-value="leafGetField('width')"
        @update:model-value="v => leafSetField('width', v)"
        label="宽" dense dark borderless class="col"
        input-class="text-caption" placeholder="200 / 100% / 40vh" />
      <q-input
        :model-value="leafGetField('height')"
        @update:model-value="v => leafSetField('height', v)"
        label="高" dense dark borderless class="col"
        input-class="text-caption" placeholder="200 / 100% / 40vh" />
    </div>

    <!-- 最小尺寸 -->
    <div class="row q-gutter-sm q-mb-xs">
      <q-input
        :model-value="leafGetField('minWidth')"
        @update:model-value="v => leafSetField('minWidth', v)"
        label="最小宽" dense dark borderless class="col"
        input-class="text-caption" placeholder="100" />
      <q-input
        :model-value="leafGetField('minHeight')"
        @update:model-value="v => leafSetField('minHeight', v)"
        label="最小高" dense dark borderless class="col"
        input-class="text-caption" placeholder="100" />
    </div>

    <!-- 最大尺寸 -->
    <div class="row q-gutter-sm q-mb-sm">
      <q-input
        :model-value="leafGetField('maxWidth')"
        @update:model-value="v => leafSetField('maxWidth', v)"
        label="最大宽" dense dark borderless class="col"
        input-class="text-caption" placeholder="100%" />
      <q-input
        :model-value="leafGetField('maxHeight')"
        @update:model-value="v => leafSetField('maxHeight', v)"
        label="最大高" dense dark borderless class="col"
        input-class="text-caption" placeholder="100%" />
    </div>

    <q-separator dark class="q-my-sm" />

    <!-- ===== 溢出 ===== -->
    <div class="ai-section-label">溢出 · Overflow</div>
    <div class="row q-gutter-xs q-mb-sm">
      <q-btn
        v-for="opt in overflowOpts" :key="opt.key"
        flat dense dark no-caps
        :label="opt.label"
        class="ai-pill-btn"
        :color="leafGet(opt.key) === opt.value ? 'primary' : 'grey-7'"
        @click="leafToggle(opt.key, opt.value)"
      >
        <q-tooltip>{{ opt.tip }}</q-tooltip>
      </q-btn>
    </div>

    <q-separator dark class="q-my-sm" />

    <!-- ===== 作为容器 (Flex Container) ===== -->
    <div class="ai-section-label">作为容器 · Flex Container</div>

    <!-- 方向 + 换行 -->
    <div class="row items-center q-mb-sm">
      <q-btn-group flat>
        <q-btn
          v-for="d in flexDirOptions" :key="d.value"
          :icon="d.icon" flat dense dark
          class="ai-ctrl-btn"
          :color="leafGet('flexDirection') === d.value ? 'primary' : 'grey-7'"
          @click="leafSet('flexDirection', d.value)"
        >
          <q-tooltip>{{ d.label }}</q-tooltip>
        </q-btn>
      </q-btn-group>
      <q-space />
      <q-btn-group flat>
        <q-btn
          v-for="w in wrapOptions" :key="w.value"
          :icon="w.icon" flat dense dark
          class="ai-ctrl-btn"
          :color="leafGet('flexWrap') === w.value ? 'primary' : 'grey-7'"
          @click="leafToggle('flexWrap', w.value)"
        >
          <q-tooltip>{{ w.label }}</q-tooltip>
        </q-btn>
      </q-btn-group>
    </div>

    <q-separator dark class="q-my-xs" />

    <!-- 对齐 9 宫格 -->
    <div class="ai-control-label q-mb-xs">对齐</div>
    <div class="align-area q-mb-sm">
      <div class="alignment-grid">
        <q-btn
          v-for="(cell, idx) in gridCells" :key="idx"
          flat dense dark
          :icon="cell.icon"
          class="grid-cell"
          :color="isGridCellActive(cell.row, cell.col) ? 'primary' : 'grey-7'"
          @click="onGridCellClick(cell.row, cell.col)"
        >
          <q-tooltip>{{ cell.label }}</q-tooltip>
        </q-btn>
      </div>

      <div class="align-extras">
        <q-btn
          v-for="item in distributeOpts" :key="item.value"
          flat dense dark
          class="extra-btn"
          :color="leafGet('justifyContent') === item.value ? 'primary' : 'grey-7'"
          @click="leafToggle('justifyContent', item.value)"
        >
          <span class="extra-label">{{ item.short }}</span>
          <q-tooltip>{{ item.label }}</q-tooltip>
        </q-btn>
        <q-separator dark vertical class="q-mx-xs" />
        <q-btn
          v-for="item in crossExtras" :key="item.value"
          flat dense dark
          class="extra-btn"
          :color="leafGet('alignItems') === item.value ? 'primary' : 'grey-7'"
          @click="leafToggle('alignItems', item.value)"
        >
          <span class="extra-label">{{ item.short }}</span>
          <q-tooltip>{{ item.label }}</q-tooltip>
        </q-btn>
      </div>
    </div>

    <!-- 多行对齐 -->
    <template v-if="leafGet('flexWrap')">
      <div class="ai-control-label q-mb-xs">多行对齐</div>
      <div class="multiline-align q-mb-sm">
        <q-btn
          v-for="item in contentAlignOpts" :key="item.value"
          flat dense dark
          class="extra-btn"
          :color="leafGet('alignContent') === item.value ? 'primary' : 'grey-7'"
          @click="leafToggle('alignContent', item.value)"
        >
          <q-icon v-if="item.icon" :name="item.icon" size="xs" />
          <span v-else class="extra-label">{{ item.short }}</span>
          <q-tooltip>{{ item.label }}</q-tooltip>
        </q-btn>
      </div>
    </template>

    <!-- 间隙 -->
    <div class="ai-control-label q-mb-xs">间隙</div>
    <div class="q-mb-sm" style="display:flex; flex-direction:column; gap:4px">
      <q-btn-group flat>
        <q-btn
          v-for="s in gutterSizes" :key="s.value"
          flat dense dark no-caps
          :label="s.label"
          :color="currentGutterSize === s.value ? 'primary' : 'grey-7'"
          @click="setGutter(s.value)"
        />
      </q-btn-group>
    </div>
  </div>
</template>

<script setup>
import { computed, inject } from 'vue'
import {
  findLeafPath,
  getLeafById,
  setNodeSizeMode,
  setNodeSizeValue,
  canMergeLeaves,
  mergeLeaves,
} from './flexTreeOps.js'

const props = defineProps({
  selectedLeafIds: { type: Array, default: () => [] },
})
const emit = defineEmits(['update:selectedLeafIds'])

const layoutNode = inject('layoutNode')

// 单选时的 leaf id(数组长度===1);其余情况为 null,UI 走多选/空选分支
const currentLeafId = computed(() =>
  props.selectedLeafIds.length === 1 ? props.selectedLeafIds[0] : null,
)

const sizeModes = [
  { value: 'grow', label: 'grow' },
  { value: 'shrink', label: 'shrink' },
  { value: 'col', label: 'col' },
  { value: 'px', label: 'px' },
  { value: 'percent', label: '%' },
]

// ===== flexTree leaf 尺寸 =====
const flexTree = computed({
  get: () => layoutNode.value?.properties?.flexTree,
  set: (v) => {
    if (layoutNode.value?.properties) {
      layoutNode.value.properties.flexTree = v
    }
  },
})

const currentLeaf = computed(() => {
  if (!currentLeafId.value || !flexTree.value) return null
  return getLeafById(flexTree.value, currentLeafId.value)
})

const currentSize = computed(() => currentLeaf.value?.size)

function setSizeMode(mode) {
  if (!currentLeafId.value) return
  const path = findLeafPath(flexTree.value, currentLeafId.value)
  if (!path) return
  flexTree.value = setNodeSizeMode(flexTree.value, path, mode)
}

function setSizeValue(v) {
  if (!currentLeafId.value) return
  const path = findLeafPath(flexTree.value, currentLeafId.value)
  if (!path) return
  flexTree.value = setNodeSizeValue(flexTree.value, path, v)
}

// ===== 多选合并 =====
const mergeable = computed(() => {
  if (props.selectedLeafIds.length < 2) return false
  return !!canMergeLeaves(flexTree.value, props.selectedLeafIds)
})

function doMerge() {
  if (!mergeable.value) return
  const result = mergeLeaves(flexTree.value, props.selectedLeafIds)
  if (!result) return
  flexTree.value = result.tree
  emit('update:selectedLeafIds', [result.newLeafId])
}

// ===== leaf.styleClass 直接读写（数据存于 flexTree 内） =====
function ensureLeafStyleClass() {
  const leaf = currentLeaf.value
  if (!leaf) return null
  if (!leaf.styleClass) leaf.styleClass = {}
  return leaf.styleClass
}
function leafGet(key) {
  return currentLeaf.value?.styleClass?.[key]
}
function leafSet(key, value) {
  const sc = ensureLeafStyleClass()
  if (!sc) return
  sc[key] = (value === '' || value === null || value === undefined) ? undefined : value
}
function leafToggle(key, value) {
  if (leafGet(key) === value) leafSet(key, undefined)
  else leafSet(key, value)
}

// ===== Flex Item 配置 =====
const selfAlignOpts = [
  { label: 'start', value: 'self-start' },
  { label: 'center', value: 'self-center' },
  { label: 'end', value: 'self-end' },
]
const orderOpts = [
  { label: '最前', value: 'order-first' },
  { label: '最后', value: 'order-last' },
]

// ===== 容器尺寸 =====
const sizeWidthOpts = [
  { label: 'full', value: 'full-width' },
  { label: 'window', value: 'window-width' },
]
const sizeHeightOpts = [
  { label: 'full', value: 'full-height' },
  { label: 'window', value: 'window-height' },
]

// leaf 顶层字段(width/height/min*/max*)读写
function leafGetField(key) {
  return currentLeaf.value?.[key] ?? ''
}
function leafSetField(key, value) {
  const leaf = currentLeaf.value
  if (!leaf) return
  leaf[key] = (value === '' || value === null || value === undefined) ? undefined : value
}

// ===== 溢出 =====
const overflowOpts = [
  { key: 'scrollAll', value: 'scroll', label: '双轴滚动', tip: 'overflow: auto (Quasar .scroll)' },
  { key: 'scrollX', value: 'scroll-x', label: 'X 滚动', tip: 'overflow-x: auto' },
  { key: 'scrollY', value: 'scroll-y', label: 'Y 滚动', tip: 'overflow-y: auto' },
  { key: 'hideScrollbar', value: 'hide-scrollbar', label: '隐藏滚动条', tip: '滚动条不可见但仍可滚动' },
]

// ===== 间隙(参照 ContainerSection) =====
// leaf 内部默认是 flex 容器(业务约定),不会出现 col-*/offset- 子项,
// 所以 prefix 固定 q-gutter-。q-col-gutter- 只兼容读取旧数据。
const GUTTER_PREFIX = 'q-gutter-'
const LEGACY_PREFIXES = ['q-col-gutter-', 'q-gutter-']

const gutterSizes = [
  { value: 'none', label: '无' },
  { value: 'xs', label: 'xs' },
  { value: 'sm', label: 'sm' },
  { value: 'md', label: 'md' },
  { value: 'lg', label: 'lg' },
  { value: 'xl', label: 'xl' },
]
const currentGutterSize = computed(() => {
  const val = leafGet('gutter')
  if (!val) return null
  for (const prefix of LEGACY_PREFIXES) {
    if (val.startsWith(prefix)) return val.slice(prefix.length)
  }
  return null
})
function setGutter(size) {
  if (currentGutterSize.value === size) {
    leafSet('gutter', undefined)
    return
  }
  leafSet('gutter', `${GUTTER_PREFIX}${size}`)
}

// ===== Flex Container 配置 =====
const flexDirOptions = [
  { value: 'row', icon: 'east', label: '水平 (row)' },
  { value: 'column', icon: 'south', label: '垂直 (column)' },
  { value: 'row reverse', icon: 'west', label: '反向水平 (row-reverse)' },
  { value: 'column reverse', icon: 'north', label: '反向垂直 (column-reverse)' },
]
const wrapOptions = [
  { value: 'wrap', icon: 'wrap_text', label: '换行 (wrap)' },
  { value: 'no-wrap', icon: 'notes', label: '不换行 (no-wrap)' },
  { value: 'reverse-wrap', icon: 'settings_backup_restore', label: '反向换行 (reverse-wrap)' },
]

// 9 宫格对齐
const mainMap = ['start', 'center', 'end']
const crossMap = ['start', 'center', 'end']
const gridCells = [
  { row: 0, col: 0, icon: 'north_west', label: '左上' },
  { row: 0, col: 1, icon: 'north', label: '上中' },
  { row: 0, col: 2, icon: 'north_east', label: '右上' },
  { row: 1, col: 0, icon: 'west', label: '左中' },
  { row: 1, col: 1, icon: 'fiber_manual_record', label: '居中' },
  { row: 1, col: 2, icon: 'east', label: '右中' },
  { row: 2, col: 0, icon: 'south_west', label: '左下' },
  { row: 2, col: 1, icon: 'south', label: '下中' },
  { row: 2, col: 2, icon: 'south_east', label: '右下' },
]
function getClassesFromGrid(gridRow, gridCol) {
  const flexDir = leafGet('flexDirection') || 'row'
  const isRow = flexDir.startsWith('row')
  const mainIdx = isRow ? gridCol : gridRow
  const crossIdx = isRow ? gridRow : gridCol
  return {
    justify: `justify-${mainMap[mainIdx]}`,
    items: `items-${crossMap[crossIdx]}`,
  }
}
function isGridCellActive(gridRow, gridCol) {
  const { justify, items } = getClassesFromGrid(gridRow, gridCol)
  return leafGet('justifyContent') === justify && leafGet('alignItems') === items
}
function onGridCellClick(gridRow, gridCol) {
  if (isGridCellActive(gridRow, gridCol)) {
    leafSet('justifyContent', undefined)
    leafSet('alignItems', undefined)
  } else {
    const { justify, items } = getClassesFromGrid(gridRow, gridCol)
    leafSet('justifyContent', justify)
    leafSet('alignItems', items)
  }
}

// 分布 + 交叉轴
const distributeOpts = [
  { value: 'justify-between', short: '两端', label: '两端分布 (space-between)' },
  { value: 'justify-around', short: '环绕', label: '环绕分布 (space-around)' },
  { value: 'justify-evenly', short: '等分', label: '等分分布 (space-evenly)' },
]
const crossExtras = [
  { value: 'items-stretch', short: '拉伸', label: '交叉轴拉伸 (stretch)' },
  { value: 'items-baseline', short: '基线', label: '基线对齐 (baseline)' },
]

// 多行对齐
const contentAlignOpts = [
  { value: 'content-start', icon: 'vertical_align_top', label: '顶部对齐' },
  { value: 'content-center', icon: 'vertical_align_center', label: '居中对齐' },
  { value: 'content-end', icon: 'vertical_align_bottom', label: '底部对齐' },
  { value: 'content-between', short: '两端', label: '两端对齐' },
  { value: 'content-stretch', short: '拉伸', label: '拉伸填充' },
]
</script>

<style scoped>
.ai-empty {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 12px;
  color: rgba(255, 255, 255, 0.4);
  justify-content: center;
}
.area-inspector {
  padding: 6px 4px;
}
.ai-multi {
  padding: 6px 4px;
}
.ai-multi-clear :deep(.q-icon) {
  font-size: 16px;
}
.ai-header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 2px 0 6px;
}
.ai-title {
  font-size: 0.85em;
  color: rgba(255, 255, 255, 0.85);
  font-weight: 500;
}
.ai-mode-tag {
  font-size: 0.65em;
  text-transform: uppercase;
  background: rgba(64, 158, 255, 0.15);
  padding: 2px 6px;
  border-radius: 3px;
  color: rgba(64, 158, 255, 0.85);
}
.ai-section-label {
  font-size: 0.7em;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  margin: 8px 0 4px;
  letter-spacing: 0.5px;
}
.ai-mode-btn {
  min-height: 26px;
  font-size: 0.7em;
  padding: 0 8px;
}
.ai-size-display {
  font-size: 0.75em;
  color: rgba(255, 255, 255, 0.7);
  white-space: nowrap;
  min-width: 70px;
  text-align: right;
}
.ai-control-label {
  font-size: 0.7em;
  color: rgba(255, 255, 255, 0.55);
}
.ai-pill-btn {
  min-width: 0;
  min-height: 24px;
  padding: 2px 8px;
  font-size: 0.72em;
  text-transform: none;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}
.ai-col-select {
  min-width: 72px;
  max-width: 80px;
}
:deep(.ai-col-select .q-field__native) {
  font-size: 0.72em;
  color: rgba(255, 255, 255, 0.9);
  padding: 0 4px;
  min-height: 24px;
}
:deep(.ai-col-select .q-field__control) {
  min-height: 24px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 3px;
}
.ai-check :deep(.q-checkbox__label) {
  font-size: 0.76em;
  color: rgba(255, 255, 255, 0.85);
}
.ai-ctrl-btn {
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  min-height: 28px !important;
  padding: 0 !important;
}
.align-area {
  display: flex;
  gap: 8px;
  align-items: flex-start;
}
.alignment-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 2px;
  flex-shrink: 0;
}
.grid-cell {
  width: 26px !important;
  height: 26px !important;
  min-width: 26px !important;
  min-height: 26px !important;
  padding: 0 !important;
}
.align-extras {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  align-items: flex-start;
  align-content: flex-start;
}
.extra-btn {
  height: 26px !important;
  min-height: 26px !important;
  padding: 0 4px !important;
}
.extra-label {
  font-size: 0.68em;
  line-height: 1;
}
.multiline-align {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}
:deep(.q-btn-group .q-btn) {
  font-size: 0.7em;
  min-height: 26px;
  padding: 2px 6px;
}
</style>
