<template>
  <div class="db-schema-tree column full-height no-wrap">
    <q-input
      v-model="filterText"
      dense
      dark
      outlined
      clearable
      placeholder="过滤表/字段"
      class="q-mb-xs col-auto"
    >
      <template #prepend>
        <q-icon name="search" size="sm" />
      </template>
    </q-input>

    <div class="col scroll">
      <div
        v-if="!serverDbId"
        class="text-caption text-grey-6 q-pa-sm"
      >
        请先在父 Database 节点选择数据库连接。
      </div>
      <div
        v-else-if="treeNodes.length === 0"
        class="text-caption text-grey-6 q-pa-sm"
      >
        该数据库下暂无表。
      </div>
      <q-tree
        v-else
        :nodes="treeNodes"
        node-key="id"
        label-key="label"
        v-model:selected="selectedId"
        v-model:expanded="expandedIds"
        :filter="filterText"
        :filter-method="filterMethod"
        dense
        dark
        no-connectors
      >
        <template #default-header="{ node }">
          <div
            class="row items-center no-wrap full-width cursor-pointer schema-node"
            :class="{ active: selectedId === node.id }"
            @dblclick="() => onNodeDblClick(node)"
          >
            <q-icon
              :name="getIcon(node).icon"
              :color="getIcon(node).color"
              size="xs"
              class="q-mr-xs"
            />
            <span class="text-caption">{{ node.label }}</span>
            <span v-if="node.dataType" class="text-grey-6 q-ml-xs schema-type">
              {{ node.dataType }}
            </span>
            <q-tooltip v-if="node.type !== 'function_group'" class="bg-dark" :delay="400">
              双击插入 {{ node.type === 'function' ? `${node.name}()` : node.name }}
            </q-tooltip>
          </div>
        </template>
      </q-tree>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useProjectStore } from "src/stores/projectMange.js";
import { getTreeIcon } from "src/utils/treeIcons.js";

const props = defineProps({
  // 数据库连接节点 id(dbTree 中 type==='dbbase' 的节点 id)
  serverDbId: { type: String, default: "" },
});

const emit = defineEmits(["insert"]);

const projectStore = useProjectStore();
const filterText = ref("");
const selectedId = ref(null);

const flatDbTree = computed(
  () => projectStore.currentProject?.database?.dbTree || [],
);

// 取指定节点的所有后代 id(BFS,处理 folder 中间层) —— 与 tableNodePanel 同范式
function getDescendantIds(parentId) {
  const ids = new Set();
  const queue = [parentId];
  while (queue.length > 0) {
    const pid = queue.shift();
    for (const n of flatDbTree.value) {
      if (n.pId === pid && !ids.has(n.id)) {
        ids.add(n.id);
        queue.push(n.id);
      }
    }
  }
  return ids;
}

// 构造「表 → 字段/列计算」两层树 + 「函数」分组(函数供写 SQL 时双击插入 name())
const treeNodes = computed(() => {
  const dbId = props.serverDbId;
  if (!dbId) return [];
  const descendants = getDescendantIds(dbId);

  const tableNodes = flatDbTree.value
    .filter((n) => n.type === "table" && descendants.has(n.id))
    .map((t) => ({
      id: t.id,
      name: t.name,
      label: t.name,
      type: "table",
      iconSkin: t.iconSkin || "table",
      isParent: true,
      children: flatDbTree.value
        .filter(
          (f) =>
            (f.type === "field" || f.type === "computed_column") &&
            f.pId === t.id,
        )
        .map((f) => ({
          id: f.id,
          name: f.name,
          label: f.name,
          type: f.type,
          iconSkin:
            f.iconSkin ||
            (f.type === "computed_column" ? "computed_column" : "field"),
        })),
    }));

  const functions = flatDbTree.value.filter(
    (n) => n.type === "function" && descendants.has(n.id),
  );
  const functionGroup = functions.length
    ? [
        {
          id: "__functions__",
          name: "函数",
          label: "函数",
          type: "function_group",
          iconSkin: "function",
          isParent: true,
          children: functions.map((f) => ({
            id: f.id,
            name: f.name,
            label: f.name,
            type: "function",
            iconSkin: f.iconSkin || "function",
          })),
        },
      ]
    : [];

  return [...tableNodes, ...functionGroup];
});

// 默认展开所有表,方便直接双击字段(dbTree 变化时重算)
const expandedIds = ref([]);
watch(
  treeNodes,
  (nodes) => {
    expandedIds.value = nodes.map((n) => n.id);
  },
  { immediate: true },
);

const getIcon = (node) => getTreeIcon(node.iconSkin, node.isParent);

// 双击插入:函数插入 name();分组节点不插入;其余插入 name
function onNodeDblClick(node) {
  if (node.type === "function_group") return;
  emit("insert", node.type === "function" ? `${node.name}()` : node.name);
}

// 过滤:表名或字段名命中即显示(q-tree 自动保留命中节点的父链)
const filterMethod = (node, filter) => {
  const f = (filter || "").toLowerCase();
  return (node.label || "").toLowerCase().includes(f);
};
</script>

<style scoped>
.db-schema-tree {
  min-height: 0;
}
.schema-node {
  min-height: 22px;
  padding: 1px 6px;
  border-left: 2px solid transparent;
  border-radius: 4px;
  transition: all 0.2s ease;
}
.schema-node:hover {
  background: rgba(255, 255, 255, 0.06);
}
.schema-node.active {
  border-left-color: var(--q-primary);
  background: rgba(33, 150, 243, 0.18);
  color: white;
}
.schema-type {
  font-size: 10px;
}
</style>
