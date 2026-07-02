<template>
  <div class="redis-key-list">
    <div class="key-list-toolbar row items-center q-pa-xs q-gutter-xs">
      <q-btn
        flat
        dense
        size="sm"
        icon="refresh"
        @click="loadKeys"
        title="Refresh"
        :loading="loading"
      />
      <q-btn
        flat
        dense
        size="sm"
        icon="add"
        color="positive"
        @click="$emit('add-key')"
        title="Add"
      />
      <q-btn
        flat
        dense
        size="sm"
        icon="delete"
        color="negative"
        :disable="!selectedKey"
        @click="$emit('delete-key', selectedKey)"
        title="Delete"
      />
    </div>
    <!-- 搜索和筛选 -->
    <div class="key-list-header q-pa-xs">
      <q-input
        v-model="searchPattern"
        placeholder="搜索 key (支持通配符 *)"
        dense
        dark
        outlined
        class="q-mb-xs"
        @keyup.enter="loadKeys"
      >
        <template v-slot:append>
          <q-icon name="search" class="cursor-pointer" @click="loadKeys" />
        </template>
      </q-input>
      <q-select
        v-model="typeFilter"
        :options="typeOptions"
        label="类型筛选"
        dense
        dark
        outlined
        emit-value
        map-options
      />
    </div>

    <!-- Key 树形列表 -->
    <div class="key-list-content">
      <q-tree
        :nodes="keyTree"
        node-key="id"
        dense
        dark
        selected-color="primary"
        v-model:selected="selectedNodeId"
        @update:selected="onNodeSelect"
      >
        <template v-slot:default-header="prop">
          <div class="row items-center full-width">
            <q-icon
              :name="getNodeIcon(prop.node)"
              :color="getNodeColor(prop.node)"

              class="q-mr-xs"
            />
            <span>{{ prop.node.label }}</span>
            <q-space />
            <template v-if="prop.node.isKey">
              <q-badge
                :color="getTypeColor(prop.node.type)"
                :label="prop.node.type"
                dense
                class="q-mr-xs"
              />
              <span v-if="prop.node.ttl > 0" class="text-grey-6 text-caption">
                {{ formatTTL(prop.node.ttl) }}
              </span>
              <span v-else-if="prop.node.ttl === -1" class="text-grey-7 text-caption">
                -
              </span>
            </template>
          </div>
        </template>
      </q-tree>

      <!-- 加载更多 -->
      <div v-if="hasMore" class="text-center q-pa-sm">
        <q-btn
          flat
          dense
          label="加载更多"
          color="primary"
          size="sm"
          @click="loadMoreKeys"
          :loading="loading"
        />
      </div>

      <!-- 空状态 -->
      <div v-if="!loading && keys.length === 0" class="text-grey-6 text-center q-pa-md">
        暂无数据
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";

const props = defineProps({
  config: {
    type: Object,
    required: true,
  },
  keys: {
    type: Array,
    default: () => [],
  },
  loading: {
    type: Boolean,
    default: false,
  },
  hasMore: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["load-keys", "load-more", "select-key", "add-key", "delete-key"]);

const searchPattern = ref("*");
const typeFilter = ref("all");
const selectedNodeId = ref(null);
const selectedKey = ref(null);

const typeOptions = [
  { label: "全部", value: "all" },
  { label: "String", value: "string" },
  { label: "Hash", value: "hash" },
  { label: "List", value: "list" },
  { label: "Set", value: "set" },
  { label: "ZSet", value: "zset" },
];

// 将 keys 转换为树形结构
const keyTree = computed(() => {
  const filteredKeys = typeFilter.value === "all"
    ? props.keys
    : props.keys.filter(k => k.type === typeFilter.value);

  // 按 : 分隔构建树
  const tree = {};
  const nodeList = [];

  filteredKeys.forEach(item => {
    const parts = item.key.split(":");
    let currentLevel = tree;
    let currentPath = "";

    parts.forEach((part, index) => {
      currentPath = currentPath ? `${currentPath}:${part}` : part;
      const isLast = index === parts.length - 1;

      if (!currentLevel[part]) {
        currentLevel[part] = {
          id: currentPath,
          label: part,
          children: {},
          isKey: isLast,
          fullKey: isLast ? item.key : null,
          type: isLast ? item.type : null,
          ttl: isLast ? item.ttl : null,
        };
      } else if (isLast) {
        // 更新为 key 节点
        currentLevel[part].isKey = true;
        currentLevel[part].fullKey = item.key;
        currentLevel[part].type = item.type;
        currentLevel[part].ttl = item.ttl;
      }

      currentLevel = currentLevel[part].children;
    });
  });

  // 转换为数组格式
  const convertToArray = (obj) => {
    return Object.values(obj).map(node => ({
      id: node.id,
      label: node.label,
      isKey: node.isKey,
      fullKey: node.fullKey,
      type: node.type,
      ttl: node.ttl,
      children: Object.keys(node.children).length > 0
        ? convertToArray(node.children)
        : undefined,
    }));
  };

  return convertToArray(tree);
});

// 节点图标
const getNodeIcon = (node) => {
  if (!node.isKey) return "folder";
  const icons = {
    string: "text_fields",
    hash: "data_object",
    list: "list",
    set: "apps",
    zset: "leaderboard",
  };
  return icons[node.type] || "key";
};

// 节点颜色
const getNodeColor = (node) => {
  if (!node.isKey) return "grey-6";
  return getTypeColor(node.type);
};

// 类型颜色
const getTypeColor = (type) => {
  const colors = {
    string: "blue",
    hash: "green",
    list: "orange",
    set: "purple",
    zset: "teal",
  };
  return colors[type] || "grey";
};

// 格式化 TTL
const formatTTL = (ttl) => {
  if (ttl < 60) return `${ttl}s`;
  if (ttl < 3600) return `${Math.floor(ttl / 60)}m`;
  if (ttl < 86400) return `${Math.floor(ttl / 3600)}h`;
  return `${Math.floor(ttl / 86400)}d`;
};

// 节点选择
const onNodeSelect = (nodeId) => {
  if (!nodeId) {
    selectedKey.value = null;
    return;
  }

  // 查找节点
  const findNode = (nodes, id) => {
    for (const node of nodes) {
      if (node.id === id) return node;
      if (node.children) {
        const found = findNode(node.children, id);
        if (found) return found;
      }
    }
    return null;
  };

  const node = findNode(keyTree.value, nodeId);
  if (node && node.isKey) {
    selectedKey.value = node.fullKey;
    emit("select-key", node.fullKey);
  } else {
    selectedKey.value = null;
  }
};

// 加载 keys
const loadKeys = () => {
  emit("load-keys", searchPattern.value);
};

// 加载更多
const loadMoreKeys = () => {
  emit("load-more");
};

// 监听类型筛选变化，重置选择
watch(typeFilter, () => {
  selectedNodeId.value = null;
  selectedKey.value = null;
});

// 暴露方法
defineExpose({
  loadKeys,
  getSearchPattern: () => searchPattern.value,
  setSearchPattern: (pattern) => { searchPattern.value = pattern; },
});
</script>

<style scoped>
.redis-key-list {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1d1d1d;
  border-right: 1px solid #333;
}

.key-list-header {
  flex-shrink: 0;
  background-color: #252526;
  border-bottom: 1px solid #333;
}

.key-list-content {
  flex: 1;
  overflow-y: auto;
}

.key-list-toolbar {
  flex-shrink: 0;
  background-color: #252526;
  border-bottom: 1px solid #333;
}

.key-list-content :deep(.q-tree__node-header) {
  padding: 2px 4px;
}

.key-list-content :deep(.q-tree__node--selected .q-tree__node-header) {
  background-color: #094771;
}
</style>
