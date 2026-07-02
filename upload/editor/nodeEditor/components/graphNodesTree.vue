<template>
  <div class="graph-nodes-panel bg-grey-10">
    <q-bar dense dark class="bg-grey-9">
      <q-icon name="device_hub" size="14px" color="cyan-4" class="q-mr-xs" />
      <span class="text-caption text-grey-5">Graph节点</span>
      <q-space />
      <q-input
        v-model="filterText"
        dense dark borderless
        placeholder="搜索..."
        class="graph-tree-filter"
        input-class="text-caption"
        clearable
      >
        <template v-slot:prepend>
          <q-icon name="search" size="xs" color="grey-6" />
        </template>
      </q-input>
    </q-bar>
    <div class="graph-tree-content">
      <q-tree
        :nodes="treeNodes"
        node-key="id"
        v-model:selected="treeSelectedId"
        :filter="filterText"
        :filter-method="filterMethod"
        dense dark no-connectors
        default-expand-all
        selected-color="light-blue-6"
      >
        <template v-slot:default-header="prop">
          <div class="row items-center no-wrap">
            <q-icon
              :name="prop.node.isSubgraph ? 'dashboard' : 'circle'"
              :color="prop.node.isSubgraph ? 'orange' : 'cyan-4'"
              size="14px"
              class="q-mr-xs"
            />
            <span class="text-caption">{{ prop.node.label }}</span>
          </div>
        </template>
      </q-tree>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from "vue";
import {
  showGraphNodesTree,
  selectedNodeId,
} from "src/components/editor/dragEditor/composables/useSimpleInteraction.js";
import {
  getGraphInstance,
  centerOnNode,
  nodeChangeCounter,
  selectNodeCounter,
} from "src/components/editor/nodeEditor/composables/useLitegraphEditor.js";
import { selectNodeById } from "src/components/editor/dragEditor/preview/previewUtils.js";

const filterText = ref("");
const treeSelectedId = ref(null);
let lastSyncedNodeId = null;

// 递归构建 QTree 嵌套数据
const buildNodeTree = (nodes) => {
  if (!nodes || !Array.isArray(nodes)) return [];

  return nodes
    .filter((node) => node != null)
    .map((node) => {
      const isSubgraph = !!(node.subgraph && node.subgraph._nodes);
      return {
        id: node.id,
        label:
          node.title || node.type?.split("/").pop() || `Node ${node.id}`,
        isSubgraph,
        children: isSubgraph
          ? buildNodeTree(node.subgraph._nodes)
          : [],
      };
    });
};

// 从 LiteGraph 实例构建树数据
const treeNodes = computed(() => {
  // 依赖 nodeChangeCounter 触发重算
  void nodeChangeCounter.value;
  const graph = getGraphInstance();
  if (!graph) return [];
  return buildNodeTree(graph._nodes || []);
});

// 搜索过滤：按 label 模糊匹配
const filterMethod = (node, filter) => {
  return node.label.toLowerCase().includes(filter.toLowerCase());
};

// 用户点击树节点 → 定位 LiteGraph 节点
// 守卫：syncSelection 写入 treeSelectedId 前已设置 lastSyncedNodeId，
// watcher 异步触发时值已一致，跳过回弹，打断循环
watch(treeSelectedId, (nodeId) => {
  if (nodeId == null || lastSyncedNodeId === nodeId) return;
  lastSyncedNodeId = nodeId;
  centerOnNode(nodeId);
  selectNodeById(nodeId);
});

// 外部选中 → 同步树高亮（带去重）
const syncSelection = () => {
  const nodeId = selectedNodeId.value;
  if (nodeId == null || lastSyncedNodeId === nodeId) return;
  lastSyncedNodeId = nodeId;
  treeSelectedId.value = nodeId;
};

watch(selectNodeCounter, () => {
  if (showGraphNodesTree.value) syncSelection();
});

watch(
  () => selectedNodeId.value,
  () => {
    if (showGraphNodesTree.value) syncSelection();
  }
);

// 面板显示时同步一次选中状态（immediate: true 处理 v-if 首次挂载）
watch(showGraphNodesTree, async (newVal) => {
  if (newVal) {
    await nextTick();
    lastSyncedNodeId = null;
    syncSelection();
  }
}, { immediate: true });
</script>

<style scoped>
.graph-nodes-panel {
  width: 250px;
  height: 100%;
  display: flex;
  flex-direction: column;
  border-right: 1px solid #333;
}

.graph-tree-content {
  flex: 1;
  overflow: auto;
  padding: 4px;
}

.graph-tree-filter {
  max-width: 120px;
}
</style>
