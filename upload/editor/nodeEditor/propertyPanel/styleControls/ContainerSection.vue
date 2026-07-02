<template>
  <div class="container-section">
    <!-- 顶部清除按钮（无大标题，由父级 SectionGroup 提供） -->
    <div v-if="styleData.sectionHasValue('container') || selectNode?.properties?.gridConfig" class="clear-row">
      <q-space />
      <q-btn icon="close" flat dense dark size="xs" color="grey-6" @click="clearLayout">
        <q-tooltip>清除布局设置</q-tooltip>
      </q-btn>
    </div>

    <div class="section-content">
      <!-- 排布 -->
      <div class="sub-group-label">排布</div>
      <div class="mode-tabs q-mb-sm">
        <q-btn v-for="m in layoutModes" :key="m.value" flat dense dark no-caps :label="m.label" class="mode-tab"
          :class="{ 'mode-tab--active': activeMode === m.value }" @click="onModeChange(m.value)" />
      </div>

      <!-- ===== Flex 模式 ===== -->
      <template v-if="activeMode === 'flex'">
        <!-- 方向 + 换行 -->
        <div class="row items-center q-mb-sm">
          <q-btn-group flat>
            <q-btn v-for="d in flexDirOptions" :key="d.value" :icon="d.icon" flat dense dark class="ctrl-btn"
              :color="styleData.getValue('flexDirection') === d.value ? 'primary' : 'grey-7'"
              @click="setDirection(d.value)">
              <q-tooltip>{{ d.label }}</q-tooltip>
            </q-btn>
          </q-btn-group>
          <q-space />
          <q-btn-group flat>
            <q-btn v-for="w in wrapOptions" :key="w.value" :icon="w.icon" flat dense dark class="ctrl-btn"
              :color="styleData.getValue('flexWrap') === w.value ? 'primary' : 'grey-7'"
              @click="styleData.toggleValue('flexWrap', w.value)">
              <q-tooltip>{{ w.label }}</q-tooltip>
            </q-btn>
          </q-btn-group>
        </div>

        <q-separator dark class="q-my-xs" />

        <!-- 对齐 -->
        <div class="sub-group-label">对齐</div>
        <div class="align-area q-mb-sm">
          <!-- 9 宫格 -->
          <div class="alignment-grid">
            <q-btn v-for="(cell, idx) in gridCells" :key="idx" flat dense dark :icon="cell.icon" class="grid-cell"
              :color="isGridCellActive(cell.row, cell.col) ? 'primary' : 'grey-7'"
              @click="onGridCellClick(cell.row, cell.col)">
              <q-tooltip>{{ cell.label }}</q-tooltip>
            </q-btn>
          </div>

          <!-- 分布 + 交叉轴特殊 -->
          <div class="align-extras">
            <q-btn v-for="item in distributeOpts" :key="item.value" flat dense dark class="extra-btn"
              :color="styleData.getValue('justifyContent') === item.value ? 'primary' : 'grey-7'"
              @click="styleData.toggleValue('justifyContent', item.value)">
              <span class="extra-label">{{ item.short }}</span>
              <q-tooltip>{{ item.label }}</q-tooltip>
            </q-btn>
            <q-separator dark vertical class="q-mx-xs" />
            <q-btn v-for="item in crossExtras" :key="item.value" flat dense dark class="extra-btn"
              :color="styleData.getValue('alignItems') === item.value ? 'primary' : 'grey-7'"
              @click="styleData.toggleValue('alignItems', item.value)">
              <span class="extra-label">{{ item.short }}</span>
              <q-tooltip>{{ item.label }}</q-tooltip>
            </q-btn>
          </div>
        </div>

        <!-- 多行对齐 -->
        <template v-if="styleData.getValue('flexWrap')">
          <div class="sub-group-label">多行对齐</div>
          <div class="multiline-align q-mb-sm">
            <q-btn v-for="item in contentAlignOpts" :key="item.value" flat dense dark class="extra-btn"
              :color="styleData.getValue('alignContent') === item.value ? 'primary' : 'grey-7'"
              @click="styleData.toggleValue('alignContent', item.value)">
              <q-icon v-if="item.icon" :name="item.icon" size="xs" />
              <span v-else class="extra-label">{{ item.short }}</span>
              <q-tooltip>{{ item.label }}</q-tooltip>
            </q-btn>
          </div>
        </template>

      </template>

      <!-- 间隙 -->
      <template v-if="activeMode !== 'grid'">
        <q-separator dark class="q-my-xs" />
        <div class="sub-group-label">间隙 (gutter)</div>
        <div class="q-mb-xs">
          <q-btn-group flat>
            <q-btn v-for="d in gutterDirections" :key="d.value" flat dense dark :label="d.label"
              :color="currentGutterDirection === d.value ? 'primary' : 'grey-7'" @click="setGutterDirection(d.value)">
              <q-tooltip>{{ d.tooltip }}</q-tooltip>
            </q-btn>
          </q-btn-group>
          <div style="display: inline;color: darkgray;">: </div>
          <q-btn-group flat>
            <q-btn v-for="s in gutterSizes" :key="s.value" flat dense dark :label="s.label"
              :color="currentGutterSize === s.value ? 'primary' : 'grey-7'" @click="setGutter(s.value)" />
          </q-btn-group>
        </div>

      </template>

      <!-- ===== Grid 模式 ===== -->
      <template v-if="activeMode === 'grid'">
        <!-- 尺寸模式 -->
        <div class="sub-group-label">容器尺寸</div>
        <div class="mode-tabs q-mb-sm">
          <q-btn v-for="m in gridSizeModes" :key="m.value" flat dense dark no-caps :label="m.label" class="mode-tab"
            :class="{ 'mode-tab--active': currentSizeMode === m.value }" @click="setGridProp('sizeMode', m.value)" />
        </div>

        <!-- 固定尺寸输入 -->
        <div v-if="currentSizeMode === 'fixed'" class="row q-gutter-sm q-mb-xs">
          <q-input :model-value="getGridProp('fixedWidth')" @update:model-value="v => setGridProp('fixedWidth', v)"
            label="宽度 (px)" dense dark borderless class="col" input-class="text-caption" type="number" />
          <q-input :model-value="getGridProp('fixedHeight')" @update:model-value="v => setGridProp('fixedHeight', v)"
            label="高度 (px)" dense dark borderless class="col" input-class="text-caption" type="number" />
        </div>

        <!-- 容器参数 -->
        <div class="row q-gutter-sm q-mb-xs">
          <q-input :model-value="getGridProp('margin')" @update:model-value="v => setGridProp('margin', v)"
            label="间距 [x,y]" dense dark borderless class="col" input-class="text-caption" placeholder="[10, 10]" />
        </div>

        <q-separator dark class="q-my-xs" />

        <!-- grid-layout-plus 交互预览 -->
        <div class="sub-group-label">布局预览 · 拖拽 / 缩放调整</div>
        <div v-if="gridChildren.length > 0 && glpComponents" class="grid-preview q-mb-sm">
          <component :is="glpComponents.GridLayout" :layout="gridLayoutData" :col-num="gridColNum" :row-height="20"
            :is-draggable="true" :is-resizable="true" :vertical-compact="true" :margin="[4, 4]"
            @layout-updated="onGridLayoutUpdated">
            <component :is="glpComponents.GridItem" v-for="item in gridLayoutData" :key="item.i" :x="item.x" :y="item.y"
              :w="item.w" :h="item.h" :i="item.i" :static="item.static" class="grid-preview-item">
              <span class="text-caption">{{ getChildName(item.i) }}</span>
              <q-btn dense flat round dark icon="close" size="6px" class="grid-cell-delete"
                @click.stop="removeGridCell(item.i)" />
            </component>
          </component>
        </div>
        <div v-else class="text-grey-6 text-caption q-pa-sm text-center">
          暂无格子
        </div>
        <q-btn dense flat dark no-caps icon="add" label="添加格子" color="primary" size="sm" class="full-width q-mt-xs"
          @click="addGridCell" />
      </template>
    </div>
  </div>

</template>

<script setup>
import { inject, ref, computed, shallowRef, watch } from 'vue'
import { useProjectStore } from 'src/stores/projectMange.js'
import { useDragEditorData } from 'src/components/editor/dragEditor/composables/useDragEditorData.js'
import { remove as removeDragNode } from 'src/components/editor/dragEditor/preview/previewUtils.js'
import { useStyleData } from './useStyleData.js'
import { getGraphInstance } from 'src/components/editor/nodeEditor/composables/useLitegraphEditor.js'

const props = defineProps({
  // 若提供 targetNodeId，则使用该 id 的 LiteGraph 节点作为编辑目标（用于 Layout 面板内嵌复用）
  // 否则回落到 inject 的 selectNode / styleData（默认场景，由父级 compStylePanel 提供）
  targetNodeId: { type: String, default: null },
})

const injectedStyleData = inject('styleData', null)
const injectedSelectNode = inject('selectNode', null)

// 用 ref 而非 computed 持有目标节点：ref 的 setter 会通过 toReactive 包装 LiteGraph 节点，
// 让 properties.styleClass 的写入触发响应式更新；computed 返回的原始对象不会被自动包装。
const localSelectNodeRef = ref(null)
watch(
  () => props.targetNodeId,
  (id) => {
    if (!id) {
      localSelectNodeRef.value = null
      return
    }
    const graph = getGraphInstance()
    localSelectNodeRef.value = graph?.getNodeById?.(id) || null
  },
  { immediate: true }
)

const localStyleData = props.targetNodeId ? useStyleData(localSelectNodeRef) : null

const selectNode = computed(() => {
  if (props.targetNodeId) return localSelectNodeRef.value
  return injectedSelectNode?.value ?? null
})
const styleData = props.targetNodeId ? localStyleData : injectedStyleData

const _project = useProjectStore()
const { findElementById, addToComponentSlot } = useDragEditorData()

// =====================
// 排布 - 模式
// =====================
const layoutModes = [
  { value: 'block', label: '块级布局' },
  { value: 'flex', label: '弹性布局' },
  { value: 'grid', label: '网格布局' },
]

const activeMode = computed(() => {
  if (selectNode.value?.properties?.gridConfig) return 'grid'
  // 兜底：旧 GridLayout 节点通过 meta.layoutType 识别
  if (selectNode.value?.nodeRawData?.meta?.layoutType === 'grid') return 'grid'
  if (styleData.getValue('flexDirection')) return 'flex'
  return 'block'
})

const onModeChange = (mode) => {
  if (mode === activeMode.value) return
  const props = selectNode.value?.properties
  if (!props) return

  // 清除 flex 属性
  styleData.clearSection('container')

  // 清除 grid 属性
  if (props.gridConfig) delete props.gridConfig
  if (props.gridLayout) delete props.gridLayout

  if (mode === 'flex') {
    styleData.setValue('flexDirection', 'row')
  } else if (mode === 'grid') {
    props.gridConfig = { colNum: 12, rowHeight: 30, margin: [10, 10], sizeMode: 'content' }
    // 为已有子节点创建默认 grid 条目
    const children = gridChildren.value
    const colNum = 12
    props.gridLayout = children.map((child, idx) => ({
      i: child.id,
      x: (idx * 6) % colNum,
      y: Math.floor((idx * 6) / colNum) * 2,
      w: 6, h: 2,
    }))
  }
  // block: 全部清除即可
}

const clearLayout = () => {
  styleData.clearSection('container')
  const props = selectNode.value?.properties
  if (props?.gridConfig) delete props.gridConfig
  if (props?.gridLayout) delete props.gridLayout
}

// =====================
// Flex 方向 + 换行
// =====================
const flexDirOptions = [
  { value: 'row', icon: 'east', label: '水平 (row)' },
  { value: 'column', icon: 'south', label: '垂直 (column)' },
  { value: 'row reverse', icon: 'west', label: '反向水平 (row-reverse)' },
  { value: 'column reverse', icon: 'north', label: '反向垂直 (column-reverse)' },
]

const setDirection = (dir) => {
  if (styleData.getValue('flexDirection') === dir) return
  styleData.setValue('flexDirection', dir)
}

const wrapOptions = [
  { value: 'wrap', icon: 'wrap_text', label: '换行 (wrap)' },
  { value: 'no-wrap', icon: 'notes', label: '不换行 (no-wrap)' },
  { value: 'reverse-wrap', icon: 'settings_backup_restore', label: '反向换行 (reverse-wrap)' },
]

// =====================
// 对齐 - 9 宫格
// =====================
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
  const flexDir = styleData.getValue('flexDirection')
  const isRow = flexDir?.startsWith('row')
  const mainIdx = isRow ? gridCol : gridRow
  const crossIdx = isRow ? gridRow : gridCol
  return {
    justify: `justify-${mainMap[mainIdx]}`,
    items: `items-${crossMap[crossIdx]}`,
  }
}

function isGridCellActive(gridRow, gridCol) {
  const { justify, items } = getClassesFromGrid(gridRow, gridCol)
  return styleData.getValue('justifyContent') === justify && styleData.getValue('alignItems') === items
}

function onGridCellClick(gridRow, gridCol) {
  if (isGridCellActive(gridRow, gridCol)) {
    styleData.setValue('justifyContent', undefined)
    styleData.setValue('alignItems', undefined)
  } else {
    const { justify, items } = getClassesFromGrid(gridRow, gridCol)
    styleData.setValue('justifyContent', justify)
    styleData.setValue('alignItems', items)
  }
}

// =====================
// 对齐 - 分布 + 交叉轴特殊
// =====================
const distributeOpts = [
  { value: 'justify-between', short: '两端', label: '两端分布 (space-between)' },
  { value: 'justify-around', short: '环绕', label: '环绕分布 (space-around)' },
  { value: 'justify-evenly', short: '等分', label: '等分分布 (space-evenly)' },
]

const crossExtras = [
  { value: 'items-stretch', short: '拉伸', label: '交叉轴拉伸 (stretch)' },
  { value: 'items-baseline', short: '基线', label: '基线对齐 (baseline)' },
]

// =====================
// 多行对齐
// =====================
const contentAlignOpts = [
  { value: 'content-start', icon: 'vertical_align_top', label: '顶部对齐' },
  { value: 'content-center', icon: 'vertical_align_center', label: '居中对齐' },
  { value: 'content-end', icon: 'vertical_align_bottom', label: '底部对齐' },
  { value: 'content-between', short: '两端', label: '两端对齐' },
  { value: 'content-stretch', short: '拉伸', label: '拉伸填充' },
]

// =====================
// 间隙
// =====================
// 二维 prefix:col/plain × both/x/y。col vs plain 由 hasGridChildren 自动判断
//   有任一子项带 col-*/offset- → q-col-gutter[-x|-y]?-
//   否则                       → q-gutter[-x|-y]?-
const GUTTER_PREFIXES = {
  plain: { both: 'q-gutter-', x: 'q-gutter-x-', y: 'q-gutter-y-' },
  col: { both: 'q-col-gutter-', x: 'q-col-gutter-x-', y: 'q-col-gutter-y-' },
}

// 解析顺序:必须先匹配带方向(-x-/-y-)的 prefix,否则会被无方向 prefix 抢先匹配
function parseGutter(val) {
  if (!val) return { size: null, dir: 'both' }
  for (const family of ['col', 'plain']) {
    for (const dir of ['x', 'y', 'both']) {
      const p = GUTTER_PREFIXES[family][dir]
      if (val.startsWith(p)) return { size: val.slice(p.length), dir }
    }
  }
  return { size: null, dir: 'both' }
}

const currentGutterSize = computed(() => parseGutter(styleData.getValue('gutter')).size)

// 方向用本地 ref 暂存:未选尺寸时仍可点击,等下次选尺寸时一起组装
const localGutterDirection = ref('both')
watch(
  () => styleData.getValue('gutter'),
  (val) => { localGutterDirection.value = parseGutter(val).dir },
  { immediate: true }
)
const currentGutterDirection = computed(() => localGutterDirection.value)

const gutterSizes = [
  { value: 'none', label: '无' },
  { value: 'xs', label: 'xs' },
  { value: 'sm', label: 'sm' },
  { value: 'md', label: 'md' },
  { value: 'lg', label: 'lg' },
  { value: 'xl', label: 'xl' },
]

const gutterDirections = [
  { value: 'both', label: '均', tooltip: '双向间隙' },
  { value: 'x', label: 'X', tooltip: '仅水平间隙 (q-gutter-x-*)' },
  { value: 'y', label: 'Y', tooltip: '仅垂直间隙 (q-gutter-y-*)' },
]

function buildGutterClass(size, dir) {
  if (!size || size === 'none') return undefined
  const family = hasGridChildren.value ? 'col' : 'plain'
  return `${GUTTER_PREFIXES[family][dir]}${size}`
}

function setGutter(size) {
  if (currentGutterSize.value === size) {
    styleData.setValue('gutter', undefined)
    return
  }
  styleData.setValue('gutter', buildGutterClass(size, localGutterDirection.value))
}

function setGutterDirection(dir) {
  if (localGutterDirection.value === dir) return
  localGutterDirection.value = dir
  // 已有尺寸:重写 class;无尺寸:仅暂存,等用户选尺寸时再组装
  if (currentGutterSize.value) {
    styleData.setValue('gutter', buildGutterClass(currentGutterSize.value, dir))
  }
}

// =====================
// Grid 模式
// =====================

// grid-layout-plus 按需加载（通过 watch 响应模式切换）
const glpComponents = shallowRef(null)

async function loadGlp() {
  if (glpComponents.value) return
  try {
    const glp = await import('grid-layout-plus')
    glpComponents.value = { GridLayout: glp.GridLayout, GridItem: glp.GridItem }
  } catch { /* 未安装时静默 */ }
}

watch(activeMode, (mode) => {
  if (mode === 'grid') loadGlp()
}, { immediate: true })

const gridSizeModes = [
  { value: 'content', label: '内容撑开' },
  { value: 'fill', label: '占满父容器' },
  { value: 'fixed', label: '指定大小' },
]

const currentSizeMode = computed(() => {
  return ensureGridConfig()?.sizeMode || 'content'
})

// Grid 容器属性读写（从 properties.gridConfig）
// 兼容旧 GridLayout 节点：首次访问时从 props 迁移到 gridConfig
const ensureGridConfig = () => {
  const props = selectNode.value?.properties
  if (!props) return null
  if (props.gridConfig) return props.gridConfig
  // 旧格式迁移
  if (selectNode.value?.nodeRawData?.meta?.layoutType === 'grid') {
    const getPropVal = (name, def) => {
      const p = props.props?.[name]
      const v = p?.value || p?.data
      return (v !== undefined && v !== '' && v !== null) ? v : def
    }
    let margin = [10, 10]
    try { margin = JSON.parse(getPropVal('margin', '[10, 10]')) } catch { }
    props.gridConfig = {
      colNum: Number(getPropVal('colNum', 12)) || 12,
      rowHeight: Number(getPropVal('rowHeight', 30)) || 30,
      margin,
    }
    if (!props.gridLayout) props.gridLayout = []
    return props.gridConfig
  }
  return null
}

const getGridProp = (propName) => {
  const gc = ensureGridConfig()
  if (!gc) return ''
  const val = gc[propName]
  if (propName === 'margin' && Array.isArray(val)) return JSON.stringify(val)
  return val ?? ''
}

const setGridProp = (propName, value) => {
  const gc = ensureGridConfig()
  if (!gc) return
  if (propName === 'margin') {
    try { gc.margin = JSON.parse(value) } catch { /* 格式不对时忽略 */ }
    return
  }
  if (propName === 'sizeMode') {
    gc.sizeMode = value
    return
  }
  gc[propName] = value ? Number(value) : undefined
}

// 子节点列表（从 dragEditor 树获取）
const dragEditorData = computed(() => _project.getEditorData('dragEditor') || [])

const currentDragNode = computed(() => {
  if (!selectNode.value?.id) return null
  return findElementById(dragEditorData.value, selectNode.value.id)
})

const gridChildren = computed(() => {
  const node = currentDragNode.value
  if (!node?.children) return []
  if (Array.isArray(node.children)) return node.children
  if (node.children.default) return node.children.default
  return []
})

// 间隙 prefix 自动判断: 任一子项带 col-*/offset- → q-col-gutter-,否则 q-gutter-
const hasGridChildren = computed(() => {
  const node = currentDragNode.value
  if (!node?.children) return false
  const checkChild = (child) => {
    const sc = child?.properties?.styleClass
    if (!sc) return false
    const cs = sc.colSize
    const co = sc.colOffset
    return (
      (typeof cs === 'string' && (cs === 'col' || cs.startsWith('col-'))) ||
      (typeof co === 'string' && co.startsWith('offset-'))
    )
  }
  if (Array.isArray(node.children)) return node.children.some(checkChild)
  if (typeof node.children === 'object') {
    return Object.values(node.children).some(arr => Array.isArray(arr) && arr.some(checkChild))
  }
  return false
})

// 子项栅格变化时,自动同步 gutter 的 col/plain 段(保留尺寸与方向)
watch(hasGridChildren, () => {
  const { size, dir } = parseGutter(styleData.getValue('gutter'))
  if (!size) return
  const next = buildGutterClass(size, dir)
  if (styleData.getValue('gutter') !== next) {
    styleData.setValue('gutter', next)
  }
})

// Grid 布局数据
const gridColNum = computed(() => {
  return ensureGridConfig()?.colNum || 12
})

const gridLayoutData = computed(() => {
  ensureGridLayout()
  return selectNode.value?.properties?.gridLayout || []
})

const ensureGridLayout = () => {
  const props = selectNode.value?.properties
  if (!ensureGridConfig()) return
  if (!props.gridLayout) {
    props.gridLayout = []
  }
  const existing = new Set(props.gridLayout.map(g => g.i))
  gridChildren.value.forEach((child, idx) => {
    if (!existing.has(child.id)) {
      props.gridLayout.push({
        i: child.id,
        x: (idx * 6) % gridColNum.value,
        y: Math.floor((idx * 6) / gridColNum.value) * 2,
        w: 6, h: 2,
      })
    }
  })
}

const onGridLayoutUpdated = (newLayout) => {
  if (!selectNode.value?.properties) return
  selectNode.value.properties.gridLayout = newLayout
}

const getChildName = (childId) => {
  const child = gridChildren.value.find(c => c.id === childId)
  if (!child) return childId.slice(0, 6)
  return child.tag || child.type?.split('/').pop() || 'Node'
}

// ===== Grid 格子添加 / 删除 =====
// Div 节点的完整注册类型（treePath/id 格式，见 useLitegraphEditor.js:276）
const DIV_NODE_TYPE = 'ui/HTML/b8f3c9d1-5a2e-4f6b-9c7d-1e8a3f5b2c4d'

const addGridCell = () => {
  const nodeId = selectNode.value?.id
  if (!nodeId) return

  const newNode = addToComponentSlot(DIV_NODE_TYPE, nodeId, 'default', { skipSelect: true })
  if (!newNode) return

  // 为新节点添加 gridLayout 条目
  const props = selectNode.value.properties
  if (!props) return
  if (!props.gridLayout) props.gridLayout = []

  const colNum = props.gridConfig?.colNum || 12
  // 找到 y 轴最大行的末尾位置，将新格子放在底部
  const maxY = props.gridLayout.reduce((max, item) => Math.max(max, item.y + item.h), 0)
  props.gridLayout.push({
    i: newNode.id,
    x: 0,
    y: maxY,
    w: Math.min(6, colNum),
    h: 2,
  })
}

const removeGridCell = (childId) => {
  if (!childId) return

  // 从 gridLayout 中移除
  const props = selectNode.value?.properties
  if (props?.gridLayout) {
    props.gridLayout = props.gridLayout.filter(item => item.i !== childId)
  }

  // 从 dragEditor + litegraph 中删除节点
  removeDragNode(childId)
}
</script>

<style scoped>
.container-section {
  padding-bottom: 4px;
}

.clear-row {
  display: flex;
  align-items: center;
  padding: 0 8px;
  margin-top: -2px;
}

.sub-group-label {
  font-size: 0.72em;
  color: rgba(255, 255, 255, 0.4);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
  margin-top: 8px;
}

.hint-text {
  font-size: 0.68em;
  color: rgba(255, 255, 255, 0.4);
  line-height: 1.3;
  margin-top: -2px;
}

/* 排布 tabs */
.mode-tabs {
  display: flex;
  gap: 2px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 4px;
  padding: 2px;
}

.mode-tab {
  flex: 1;
  font-size: 0.72em;
  min-height: 28px;
  border-radius: 3px;
  color: rgba(255, 255, 255, 0.5);
  transition: all 0.15s;
}

.mode-tab--active {
  background: rgba(25, 118, 210, 0.2);
  color: #42a5f5;
}

/* 方向 / 换行按钮 */
.ctrl-btn {
  width: 28px !important;
  height: 28px !important;
  min-width: 28px !important;
  min-height: 28px !important;
  padding: 0 !important;
}

/* 9 宫格 */
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

/* 分布 + 交叉轴特殊 */
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

/* 多行对齐 */
.multiline-align {
  display: flex;
  gap: 2px;
  flex-wrap: wrap;
}

/* grid-layout-plus 预览 */
.grid-preview {
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 4px;
  padding: 4px;
  min-height: 80px;
  background: rgba(0, 0, 0, 0.2);
}

.grid-preview-item {
  background: rgba(64, 158, 255, 0.15);
  border: 1px solid rgba(64, 158, 255, 0.4);
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  position: relative;
}

.grid-cell-delete {
  position: absolute;
  top: 0;
  right: 0;
  opacity: 0;
  transition: opacity 0.15s;
}

.grid-preview-item:hover .grid-cell-delete {
  opacity: 1;
}

/* btn-group label buttons: smaller text */
:deep(.q-btn-group .q-btn) {
  font-size: 0.7em;
  min-height: 26px;
  padding: 2px 6px;
}
</style>
