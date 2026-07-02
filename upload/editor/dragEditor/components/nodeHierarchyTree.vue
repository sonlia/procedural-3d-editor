<template>
  <div class="node-hierarchy-panel bg-grey-10">
    <q-bar dense dark class="bg-grey-9">
      <q-icon name="account_tree" size="14px" color="orange-4" class="q-mr-xs" />
      <span class="text-caption text-grey-5">节点层级</span>
    </q-bar>
    <q-list
      ref="treeContainer"
      dense
      dark
      class="node-tree-content"
      @dragover.prevent
      @drop.prevent="onDropRoot"
    >
      <div
        v-for="item in visibleNodes"
        :key="item.id"
        :data-node-id="item.id"
        class="tree-node"
        :class="{
          'tree-node--selected': item.id === treeSelectedId,
          'tree-node--drop-top': dragOverId === item.id && dropPosition === 'top',
          'tree-node--drop-bottom': dragOverId === item.id && dropPosition === 'bottom',
          'tree-node--drop-center': dragOverId === item.id && dropPosition === 'center',
          'tree-node--dragging': dragStartId === item.id,
        }"
        :style="{ paddingLeft: item.depth * 16 + 4 + 'px' }"
        draggable="true"
        @click="onNodeClick(item)"
        @dragstart="onDragStart($event, item)"
        @dragover.prevent.stop="onDragOver($event, item)"
        @dragleave="onDragLeave"
        @drop.prevent.stop="onDrop($event, item)"
        @dragend="onDragEnd"
      >
        <span
          v-if="item.hasChildren"
          class="tree-toggle"
          @click.stop="toggleExpand(item.id)"
        >
          <q-icon
            :name="expandedIds.has(item.id) ? 'expand_more' : 'chevron_right'"
            size="14px"
            color="grey-5"
          />
        </span>
        <span v-else class="tree-leaf">
          <q-icon name="circle" size="5px" color="green-4" />
        </span>
        <span class="tree-node__name">{{ item.name }}</span>
        <span
          v-if="item.slotName && item.slotName !== 'default'"
          class="tree-node__slot"
        >
          #{{ item.slotName }}
        </span>
      </div>
      <div
        v-if="!visibleNodes.length"
        class="text-grey-6 text-caption q-pa-sm text-center"
      >
        暂无节点
      </div>
    </q-list>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, shallowRef } from "vue";
import {
  showNodeHierarchy,
  selectedNodeId,
} from "src/components/editor/dragEditor/composables/useSimpleInteraction.js";
import { centerOnNode } from "src/components/editor/nodeEditor/composables/useLitegraphEditor.js";
import { simulatePreviewNodeClick } from "src/components/editor/dragEditor/preview/previewUtils.js";
import { useProjectStore } from "src/stores/projectMange.js";
import { useDragEditorData } from "../composables/useDragEditorData.js";

const _project = useProjectStore();
const { moveNodeToPosition } = useDragEditorData();
const treeContainer = ref(null);

// === 树数据构建 ===

const dragEditorData = computed(() => _project.getEditorData("dragEditor"));

/** 将 dragEditor 扁平数据构建为层级结构 */
function buildHierarchy(nodes, slotName = "default") {
  if (!Array.isArray(nodes)) return [];
  return nodes.map((node) => {
    const children = [];
    if (node.children) {
      if (Array.isArray(node.children)) {
        children.push(
          ...buildHierarchy(node.children, "default"),
        );
      } else if (typeof node.children === "object") {
        for (const key in node.children) {
          if (Array.isArray(node.children[key])) {
            children.push(
              ...buildHierarchy(node.children[key], key),
            );
          }
        }
      }
    }
    return {
      id: node.id,
      name: node.tag || node.type?.split("/").pop() || "Node",
      type: node.type || "",
      slotName,
      children,
      hasChildren: children.length > 0,
    };
  });
}

const treeNodes = computed(() => buildHierarchy(dragEditorData.value || []));

// === 展开/折叠 ===

const expandedIds = ref(new Set());

/** 自动展开所有新出现的带子节点的节点 */
watch(
  treeNodes,
  (nodes) => {
    const collectIds = (list) => {
      for (const n of list) {
        if (n.hasChildren) {
          expandedIds.value.add(n.id);
          collectIds(n.children);
        }
      }
    };
    collectIds(nodes);
  },
  { immediate: true },
);

const toggleExpand = (id) => {
  const s = expandedIds.value;
  if (s.has(id)) s.delete(id);
  else s.add(id);
};

// === 扁平化渲染列表 ===

const visibleNodes = computed(() => {
  const result = [];
  const flatten = (nodes, depth) => {
    for (const node of nodes) {
      result.push({
        id: node.id,
        name: node.name,
        type: node.type,
        slotName: node.slotName,
        hasChildren: node.hasChildren,
        depth,
      });
      if (node.hasChildren && expandedIds.value.has(node.id)) {
        flatten(node.children, depth + 1);
      }
    }
  };
  flatten(treeNodes.value, 0);
  return result;
});

// === 节点选择 ===

// 本地选中 ID：点击时立即设置，不依赖 LiteGraph 异步回调
const treeSelectedId = shallowRef(null);

const onNodeClick = (item) => {
  treeSelectedId.value = item.id;
  // 模拟 preview 点击 → 触发完整交互（高亮 + 工具栏 + centerOnNode + 属性面板）
  if (!simulatePreviewNodeClick(item.id)) {
    // fallback: iframe 不可用时仅选中 LiteGraph 节点
    centerOnNode(item.id);
  }
};

/** 外部选中变化（preview 点击、node editor 点击）→ 同步树高亮 + 滚动 */
watch(
  () => selectedNodeId.value,
  async (nodeId) => {
    if (!nodeId || !showNodeHierarchy.value) return;
    treeSelectedId.value = nodeId;
    await nextTick();
    const container = treeContainer.value?.$el ?? treeContainer.value;
    const el = container?.querySelector(
      `[data-node-id="${nodeId}"]`,
    );
    if (el) el.scrollIntoView({ behavior: "smooth", block: "nearest" });
  },
);

// === 拖拽 ===

const dragStartId = shallowRef(null);
const dragOverId = shallowRef(null);
const dropPosition = shallowRef(null); // "top" | "bottom" | "center"
const dragDescendantIds = shallowRef(new Set());

/** 收集某节点及其所有后代的 id 集合（用于循环引用检测） */
function collectDescendants(nodeId) {
  const ids = new Set();
  const walk = (nodes) => {
    for (const n of nodes) {
      if (n.id === nodeId) {
        const gather = (node) => {
          ids.add(node.id);
          if (node.children) node.children.forEach(gather);
        };
        gather(n);
        return true;
      }
      if (n.children && walk(n.children)) return true;
    }
    return false;
  };
  walk(treeNodes.value);
  return ids;
}

const resetDragState = () => {
  dragStartId.value = null;
  dragOverId.value = null;
  dropPosition.value = null;
  dragDescendantIds.value = new Set();
};

const onDragStart = (event, item) => {
  dragStartId.value = item.id;
  dragDescendantIds.value = collectDescendants(item.id);
  event.dataTransfer.effectAllowed = "move";
  event.dataTransfer.setData("text/plain", item.id);
};

const onDragOver = (event, item) => {
  // 不能拖到自身或其后代上
  if (dragDescendantIds.value.has(item.id)) {
    event.dataTransfer.dropEffect = "none";
    dragOverId.value = null;
    return;
  }

  const rect = event.currentTarget.getBoundingClientRect();
  const y = event.clientY - rect.top;
  const h = rect.height;

  if (y < h * 0.25) {
    dropPosition.value = "top";
  } else if (y > h * 0.75) {
    dropPosition.value = "bottom";
  } else {
    dropPosition.value = "center";
  }
  dragOverId.value = item.id;
};

const onDragLeave = () => {
  dragOverId.value = null;
  dropPosition.value = null;
};

const onDrop = (event, item) => {
  if (!dragStartId.value || dragDescendantIds.value.has(item.id)) {
    resetDragState();
    return;
  }

  const targetSlot =
    dropPosition.value === "center" ? "default" : undefined;
  moveNodeToPosition(
    dragStartId.value,
    item.id,
    dropPosition.value,
    targetSlot,
  );
  resetDragState();
};

/** 拖到树空白区域 → 放到根级末尾 */
const onDropRoot = () => {
  if (!dragStartId.value) return;
  moveNodeToPosition(dragStartId.value, "app", "bottom");
  resetDragState();
};

const onDragEnd = () => {
  resetDragState();
};
</script>

<style scoped>
.node-hierarchy-panel {
  width: 250px;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-left: 1px solid #333;
}

.node-tree-content {
  flex: 1;
  overflow: auto;
  padding: 2px 0;
}

.tree-node {
  display: flex;
  align-items: center;
  padding: 3px 8px;
  cursor: pointer;
  user-select: none;
  font-size: 12px;
  color: #c4c4c4;
  border-top: 2px solid transparent;
  border-bottom: 2px solid transparent;
  transition: background 0.1s;
}

.tree-node:hover {
  background: rgba(255, 255, 255, 0.05);
}

.tree-node--selected {
  background: rgba(64, 158, 255, 0.2);
}

.tree-node--dragging {
  opacity: 0.35;
}

.tree-node--drop-top {
  border-top-color: #409eff;
}

.tree-node--drop-bottom {
  border-bottom-color: #409eff;
}

.tree-node--drop-center {
  background: rgba(64, 158, 255, 0.15);
  outline: 1px dashed #409eff;
  outline-offset: -1px;
}

.tree-toggle {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  flex-shrink: 0;
  margin-right: 2px;
  cursor: pointer;
}

.tree-leaf {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  flex-shrink: 0;
  margin-right: 2px;
}

.tree-node__name {
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.tree-node__slot {
  font-size: 10px;
  color: #777;
  margin-left: 4px;
  flex-shrink: 0;
}
</style>
