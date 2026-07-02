<template>
  <div
    class="flex-split-view"
    @click.self="emit('update:selectedLeafIds', [])"
    @scroll="hideToolbar"
  >
    <div class="fsv-stage">
      <component :is="renderTree" />
    </div>
  </div>
  <Teleport to="body">
    <div
      v-if="hoverLeafId"
      class="fsv-floating-toolbar"
      :style="{ top: toolbarPos.top + 'px', left: toolbarPos.left + 'px' }"
      @mouseenter="onToolbarEnter"
      @mouseleave="onToolbarLeave"
    >
      <button
        v-for="a in toolbarActions"
        :key="a.key"
        :class="a.cls"
        :title="a.title"
        @click.stop="a.onClick"
      >{{ a.icon }}</button>
    </div>
  </Teleport>
</template>

<script setup>
import { h, computed, ref, defineComponent, inject } from 'vue'
import { Notify } from 'quasar'
import {
  splitLeaf,
  removeLeaf,
  updateSplitRatio,
  insertSiblingOf,
  findLeafPath,
  collectLeafIds,
  createEmptyTree,
  makeLeafId,
  sizeToFlex,
} from './flexTreeOps.js'

const props = defineProps({
  selectedLeafIds: { type: Array, default: () => [] },   // 选中 leaf id 集合
})
const emit = defineEmits(['update:selectedLeafIds', 'change'])

// 通过 inject 获取 Layout 节点 ref（由 LayoutPanel 提供）
const layoutNode = inject('layoutNode')

const flexTree = computed({
  get: () => layoutNode.value?.properties?.flexTree,
  set: (v) => {
    if (layoutNode.value?.properties) {
      layoutNode.value.properties.flexTree = v
    }
  },
})

// 初始化：单叶子（兜底，LayoutPanel 通常已初始化）
if (layoutNode.value?.properties && !flexTree.value) {
  flexTree.value = createEmptyTree(makeLeafId())
}

// ===== 拆分 / 删除 / 加兄弟（纯 flexTree 数据操作，不创建任何真实 div 节点） =====
function doSplit(leafId, direction) {
  const { tree } = splitLeaf(flexTree.value, leafId, direction)
  flexTree.value = tree
  emit('change')
}

function doRemove(leafId) {
  // 不能删除根唯一叶
  const ids = collectLeafIds(flexTree.value)
  if (ids.length <= 1) {
    Notify.create({ type: 'warning', message: '至少保留一个区域' })
    return
  }
  flexTree.value = removeLeaf(flexTree.value, leafId)
  if (props.selectedLeafIds.includes(leafId)) {
    emit('update:selectedLeafIds', props.selectedLeafIds.filter(x => x !== leafId))
  }
  emit('change')
}

function doAddSibling(leafId, side) {
  const result = insertSiblingOf(flexTree.value, leafId, side)
  if (!result) return
  flexTree.value = result.tree
  emit('update:selectedLeafIds', [result.newLeafId])
  emit('change')
}

// ===== 浮动工具栏(Teleport 到 body,fixed 定位,不受任何祖先 overflow 裁切) =====
const hoverLeafId = ref(null)
const toolbarPos = ref({ top: 0, left: 0 })
let leaveTimer = null

function onLeafEnter(leafId, ev) {
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
  const rect = ev.currentTarget.getBoundingClientRect()
  toolbarPos.value = { top: rect.top, left: rect.left + rect.width / 2 }
  hoverLeafId.value = leafId
}

function onLeafLeave() {
  if (leaveTimer) clearTimeout(leaveTimer)
  leaveTimer = setTimeout(() => {
    hoverLeafId.value = null
    leaveTimer = null
  }, 120)
}

function onToolbarEnter() {
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
}

function onToolbarLeave() {
  hoverLeafId.value = null
}

function hideToolbar() {
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null }
  hoverLeafId.value = null
}

const toolbarActions = computed(() => {
  const id = hoverLeafId.value
  if (!id) return []
  return [
    { key: 'h',  icon: '↔', title: '左右拆分',     cls: 'fsv-act',                                  onClick: () => doSplit(id, 'row') },
    { key: 'v',  icon: '↕', title: '上下拆分',     cls: 'fsv-act',                                  onClick: () => doSplit(id, 'column') },
    { key: 'x',  icon: '×', title: '删除',         cls: 'fsv-act fsv-act-del',                      onClick: () => doRemove(id) },
    { key: 'up', icon: '↑', title: '在上方加一行', cls: 'fsv-act fsv-act-add fsv-act-group-start',  onClick: () => doAddSibling(id, 'top') },
    { key: 'dn', icon: '↓', title: '在下方加一行', cls: 'fsv-act fsv-act-add',                      onClick: () => doAddSibling(id, 'bottom') },
    { key: 'lt', icon: '←', title: '在左侧加一列', cls: 'fsv-act fsv-act-add',                      onClick: () => doAddSibling(id, 'left') },
    { key: 'rt', icon: '→', title: '在右侧加一列', cls: 'fsv-act fsv-act-add',                      onClick: () => doAddSibling(id, 'right') },
  ]
})

// ===== 分隔条拖动 =====
const dragState = ref(null)  // { path, childIndex, isRow, startCoord, totalSize }

function onSplitterDown(splitPath, childIndex, direction, ev) {
  ev.preventDefault()
  ev.stopPropagation()
  // 用相邻两 child 的 DOM 算 frac（N-ary 下不能用整个 split 容器的尺寸）
  const splitter = ev.currentTarget
  const aEl = splitter.previousElementSibling
  const bEl = splitter.nextElementSibling
  if (!aEl || !bEl) return
  const isRow = direction === 'row'
  const aRect = aEl.getBoundingClientRect()
  const bRect = bEl.getBoundingClientRect()
  dragState.value = {
    path: splitPath,
    childIndex,
    isRow,
    startCoord: isRow ? aRect.left : aRect.top,
    totalSize: isRow ? (bRect.right - aRect.left) : (bRect.bottom - aRect.top),
  }
  window.addEventListener('mousemove', onSplitterMove)
  window.addEventListener('mouseup', onSplitterUp)
}
function onSplitterMove(ev) {
  const ds = dragState.value
  if (!ds) return
  const coord = ds.isRow ? ev.clientX : ev.clientY
  const offset = coord - ds.startCoord
  if (ds.totalSize <= 0) return
  const frac = Math.max(0.05, Math.min(0.95, offset / ds.totalSize))
  flexTree.value = updateSplitRatio(flexTree.value, ds.path, ds.childIndex, frac)
}
function onSplitterUp() {
  dragState.value = null
  window.removeEventListener('mousemove', onSplitterMove)
  window.removeEventListener('mouseup', onSplitterUp)
  emit('change')
}

// ===== 渲染（h 函数递归） =====
// sizeToFlex 已统一到 flexTreeOps.js,与 flexCodeGen.js 共享同一实现

function renderLeaf(node, path) {
  const selected = props.selectedLeafIds.includes(node.id)
  return h('div', {
    class: ['fsv-leaf', { 'fsv-leaf--selected': selected }],
    style: { flex: sizeToFlex(node.size) },
    onMouseenter: (e) => onLeafEnter(node.id, e),
    onMouseleave: () => onLeafLeave(),
    onClick: (e) => {
      e.stopPropagation()
      const isToggle = e.ctrlKey || e.metaKey || e.shiftKey
      const current = props.selectedLeafIds || []
      if (isToggle) {
        const next = current.includes(node.id)
          ? current.filter((x) => x !== node.id)
          : [...current, node.id]
        emit('update:selectedLeafIds', next)
      } else {
        emit('update:selectedLeafIds', [node.id])
      }
    },
  })
}

function renderSplit(node, path) {
  const isRow = node.direction === 'row'
  const children = []
  for (let i = 0; i < node.children.length; i++) {
    children.push(renderNode(node.children[i], [...path, i]))
    if (i < node.children.length - 1) {
      children.push(h('div', {
        class: ['fsv-splitter', isRow ? 'fsv-splitter--row' : 'fsv-splitter--col'],
        onMousedown: (e) => onSplitterDown(path, i, node.direction, e),
      }))
    }
  }
  return h('div', {
    class: 'fsv-split',
    style: {
      flex: path.length === 0 ? '1 1 0' : sizeToFlex(node.size),
      display: 'flex',
      flexDirection: node.direction,
    },
  }, children)
}

function renderNode(node, path) {
  return node.type === 'split' ? renderSplit(node, path) : renderLeaf(node, path)
}

const renderTree = defineComponent({
  name: 'FlexTreeRenderer',
  setup() {
    return () => {
      if (!flexTree.value) return null
      return renderNode(flexTree.value, [])
    }
  },
})
</script>

<style>
/* 注意：不能用 scoped — 内部元素通过 h() 在 renderTree(defineComponent) 里创建，
   scope 属性只会落到根元素，子元素拿不到 data-v-xxx 标记，scoped 规则失效。
   class 名加了 fsv- 前缀避免全局冲突。 */
.flex-split-view {
  width: 100%;
  height: 280px;
  background: rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  padding: 8px;
  overflow: auto;
  box-sizing: border-box;
}

.fsv-stage {
  width: fit-content;
  height: fit-content;
  min-width: 100%;
  min-height: 100%;
  display: flex;
  box-sizing: border-box;
}

.fsv-split {
  display: flex;
  box-sizing: border-box;
}

/* ============ Leaf ============ */
.fsv-leaf {
  position: relative;
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.10), rgba(64, 158, 255, 0.04));
  border: 1.5px solid rgba(64, 158, 255, 0.40);
  border-radius: 4px;
  min-width: 40px;
  min-height: 40px;
  cursor: pointer;
  overflow: visible;
  transition: background 0.15s, border-color 0.15s, box-shadow 0.15s;
  box-sizing: border-box;
}

.fsv-leaf:hover {
  background: linear-gradient(135deg, rgba(64, 158, 255, 0.20), rgba(64, 158, 255, 0.08));
  border-color: rgba(64, 158, 255, 0.70);
  box-shadow: inset 0 0 0 1px rgba(64, 158, 255, 0.25);
  z-index: 10;
}

.fsv-leaf--selected {
  background: linear-gradient(135deg, rgba(255, 152, 0, 0.22), rgba(255, 152, 0, 0.08));
  border-color: rgba(255, 152, 0, 0.95);
  /* 仅用 inset 阴影做高亮，避免外凸阴影被 stage 的 overflow:hidden 裁切 */
  box-shadow: inset 0 0 0 2px rgba(255, 152, 0, 0.55);
  z-index: 10;
}

/* ============ Floating Toolbar (Teleport 到 body, fixed 定位, 不受祖先 overflow 裁切) ============ */
.fsv-floating-toolbar {
  position: fixed;
  /* top/left 由内联 style 设为 leaf 顶边居中 */
  transform: translate(-50%, calc(-100% - 4px));
  display: flex;
  gap: 2px;
  background: rgba(0, 0, 0, 0.85);
  border-radius: 3px;
  padding: 2px;
  backdrop-filter: blur(4px);
  z-index: 9999;
  pointer-events: auto;
  white-space: nowrap;
}

.fsv-act-group-start {
  margin-left: 8px;
}

.fsv-act {
  width: 18px;
  height: 18px;
  background: transparent;
  border: none;
  color: rgba(255, 255, 255, 0.85);
  border-radius: 2px;
  cursor: pointer;
  font-size: 12px;
  line-height: 1;
  padding: 0;
  font-weight: bold;
  transition: background 0.12s, color 0.12s;
}

.fsv-act:hover {
  background: rgba(64, 158, 255, 0.85);
  color: white;
}

.fsv-act-del:hover {
  background: rgba(220, 53, 69, 0.90);
}

.fsv-act-add:hover {
  background: rgba(76, 175, 80, 0.85);
}

/* ============ Splitter ============ */
.fsv-splitter {
  flex: 0 0 4px;
  background: rgba(255, 255, 255, 0.06);
  border-radius: 2px;
  transition: background 0.15s, flex-basis 0.15s;
  position: relative;
}

.fsv-splitter::before {
  content: '';
  position: absolute;
  inset: -3px;
}

.fsv-splitter:hover {
  background: rgba(64, 158, 255, 0.7);
  flex-basis: 6px;
}

.fsv-splitter--row {
  cursor: col-resize;
}

.fsv-splitter--col {
  cursor: row-resize;
}
</style>
