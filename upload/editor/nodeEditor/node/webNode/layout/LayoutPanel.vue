<template>
  <div class="layout-panel">
    <!-- 可视化区 -->
    <div class="lp-section">
      <div class="lp-section-label">
        布局可视化
        <span class="lp-hint">点击区域选择,Ctrl/Cmd+点击多选;按钮拆分/删除/加边,分隔条拖动调比</span>
      </div>
      <FlexSplitView v-model:selected-leaf-ids="selectedLeafIds" />
    </div>

    <!-- 选中详情 -->
    <div class="lp-section">
      <div class="lp-section-label">当前选中</div>
      <AreaInspector v-model:selected-leaf-ids="selectedLeafIds" />
    </div>
  </div>
</template>

<script setup>
import { ref, watch, provide } from 'vue'
import FlexSplitView from './layoutControls/FlexSplitView.vue'
import AreaInspector from './layoutControls/AreaInspector.vue'
import { createEmptyTree, makeLeafId, migrateLegacyLeafFlex } from './layoutControls/flexTreeOps.js'
import { useDragEditorData } from 'src/components/editor/dragEditor/composables/useDragEditorData.js'
import { useProjectStore } from 'src/stores/projectMange.js'

const selectNode = defineModel()

// 通过 provide 把 Layout 节点 ref 传给子组件,避免 prop mutation 警告
provide('layoutNode', selectNode)

// 选中的 leaf id 集合(单选=长度1,多选=长度>1,无选=空数组)
const selectedLeafIds = ref([])
const _project = useProjectStore()
const { findElementById } = useDragEditorData()

// ====== 初始化:首次进入 Layout 节点时建立空 flexTree 与默认样式。
// - flexDirection 用 Quasar class(无 !important,可被覆盖)
// - width/height 100% 用 inline style 而非 .full-width / .full-height class
//   (Quasar 这两个工具类带 !important,会压制用户在 SizeSection / CSS 编辑器自定义的尺寸)
function initLayoutData() {
  const n = selectNode.value
  if (!n?.properties) return

  if (!n.properties.styleClass) n.properties.styleClass = {}
  const sc = n.properties.styleClass
  if (sc.flexDirection === undefined) sc.flexDirection = 'row'
  // 旧版本预填过的 full-width / full-height 一次性迁移到 inline style
  if (sc.sizeWidth === 'full-width') sc.sizeWidth = undefined
  if (sc.sizeHeight === 'full-height') sc.sizeHeight = undefined

  const styleStr = n.properties.style || ''
  const hasWidth = /(?:^|;)\s*width\s*:/i.test(styleStr)
  const hasHeight = /(?:^|;)\s*height\s*:/i.test(styleStr)
  if (!hasWidth || !hasHeight) {
    const additions = []
    if (!hasWidth) additions.push('width: 100%')
    if (!hasHeight) additions.push('height: 100%')
    n.properties.style = (styleStr ? styleStr.replace(/;?\s*$/, ';') + ' ' : '') + additions.join('; ')
  }

  if (!n.properties.flexTree) {
    n.properties.flexTree = createEmptyTree(makeLeafId())
    return
  }
  migrateLegacyLeafFlex(n.properties.flexTree)
}

// ====== 同步 dragEditor schema.children:flexTree / gridLayout 改动后,把 leaf/cell id
// 集合差异 diff 到 schema.children 上(增/删 entry)。assembler 按 leaf id 作 slot 名替换占位符。
function collectSlotIds(properties) {
  const ids = []
  const walk = (n) => {
    if (!n) return
    if (n.type === 'leaf') ids.push(n.id)
    else (n.children || []).forEach(walk)
  }
  walk(properties?.flexTree)
  if (Array.isArray(properties?.gridLayout)) {
    properties.gridLayout.forEach(c => { if (c?.i) ids.push(c.i) })
  }
  return ids
}

function syncSchemaChildren() {
  const n = selectNode.value
  if (!n?.id || !n.properties) return
  const data = _project.getEditorData('dragEditor') || []
  const item = findElementById(data, n.id)
  if (!item) return
  if (!item.children || Array.isArray(item.children) || typeof item.children !== 'object') {
    item.children = {}
  }
  const wantedIds = new Set(collectSlotIds(n.properties))
  // 新增 entry(保留已有 children 内容)
  for (const id of wantedIds) {
    if (!(id in item.children)) item.children[id] = []
  }
  // 删除孤儿 entry(连带丢弃其下子节点)
  for (const id of Object.keys(item.children)) {
    if (!wantedIds.has(id) && !id.startsWith('_')) {
      delete item.children[id]
    }
  }
}

watch(() => selectNode.value?.id, () => {
  initLayoutData()
  selectedLeafIds.value = []
  syncSchemaChildren()
}, { immediate: true })

watch(
  () => [selectNode.value?.properties?.flexTree, selectNode.value?.properties?.gridLayout],
  syncSchemaChildren,
  { deep: true }
)

// compStylePanel 改 flexDirection → 同步 flexTree 顶层 split.direction
// 保持"分隔条排列方向 = root 容器排列方向"一致(嵌套 split.direction 不受影响)
watch(
  () => selectNode.value?.properties?.styleClass?.flexDirection,
  (dir) => {
    const t = selectNode.value?.properties?.flexTree
    if (t?.type === 'split' && dir && t.direction !== dir) t.direction = dir
  }
)
</script>

<style scoped>
.layout-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 8px;
}
.lp-section {
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  padding: 6px;
}
.lp-section-label {
  font-size: 0.7em;
  color: rgba(255, 255, 255, 0.45);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 6px;
  display: flex;
  align-items: center;
  gap: 8px;
}
.lp-hint {
  font-size: 0.85em;
  text-transform: none;
  color: rgba(255, 255, 255, 0.3);
  letter-spacing: 0;
}
</style>
