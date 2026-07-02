<template>
  <div class="redis-viewer">
    <!-- Tab 导航 -->
    <q-tabs v-model="activeTab" dense dark class="redis-tabs">
      <q-tab name="keys" label="Key 管理" />
      <q-tab name="cli" label="CLI" />
      <q-tab name="log" label="日志" />
    </q-tabs>

    <!-- CLI Tab -->
    <q-tab-panels v-model="activeTab" animated dark class="redis-tab-panels" v-if="activeTab === 'cli'">
      <q-tab-panel name="cli" class="q-pa-none">
        <div class="cli-panel">
          <!-- CLI 编辑器 -->
          <div class="cli-editor-section">
            <RedisCliEditor
              ref="cliEditorRef"
              @execute-result="onCliExecute"
              @log="onLog"
            />
          </div>

          <!-- CLI 结果表格 -->
          <div class="cli-result-section">
            <div class="result-header q-px-sm q-py-xs row items-center">
              <span class="text-caption text-grey-6">执行结果</span>
              <q-space />
              <span v-if="cliResult" class="text-caption text-grey-7">
                类型: {{ cliResult.resultType }} | 耗时: {{ cliResult.executionTime }}ms
              </span>
            </div>
            <div class="result-content">
              <vxe-table
                v-if="cliResultRows.length > 0"
                :data="cliResultRows"
                :columns="cliResultColumns"
                height="100%"
                size="mini"
                dark
                border
                show-overflow
              >
                <vxe-column
                  v-for="col in cliResultColumns"
                  :key="col.field"
                  :field="col.field"
                  :title="col.title"
                  :width="col.width"
                />
              </vxe-table>
              <div v-else class="text-grey-6 text-center q-pa-md">
                {{ cliResult ? formatSimpleResult(cliResult.result) : "执行命令查看结果" }}
              </div>
            </div>
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- 日志 Tab -->
    <q-tab-panels v-model="activeTab" animated dark class="redis-tab-panels" v-if="activeTab === 'log'">
      <q-tab-panel name="log" class="q-pa-none">
        <RedisTerminal ref="terminalRef" />
      </q-tab-panel>
    </q-tab-panels>

    <!-- Key 管理 Tab -->
    <q-tab-panels v-model="activeTab" animated dark class="redis-tab-panels" v-if="activeTab === 'keys'">
      <q-tab-panel name="keys" class="q-pa-none">
        <div class="keys-panel row">
          <!-- Key 列表 (30%) -->
          <div class="col-4">
            <RedisKeyList
              ref="keyListRef"
              :config="redisConfig"
              :keys="keys"
              :loading="loading"
              :has-more="hasMore"
              @load-keys="loadKeys"
              @load-more="loadMoreKeys"
              @select-key="selectKey"
              @add-key="showAddKeyDialog"
              @delete-key="deleteKey"
            />
          </div>

          <!-- Key 详情 (70%) -->
          <div class="col-8">
            <RedisKeyDetail
              ref="keyDetailRef"
              :key-data="selectedKeyData"
              :is-new-key="isNewKey"
              :saving="saving"
              @save="saveKey"
              @delete="deleteSelectedKey"
              @refresh="refreshSelectedKey"
            />
          </div>
        </div>
      </q-tab-panel>
    </q-tab-panels>

    <!-- 新增 Key 对话框 -->
    <q-dialog v-model="showAddDialog" persistent>
      <q-card dark class="bg-grey-9" style="min-width: 500px">
        <q-card-section>
          <div class="text-h6">新增 Key</div>
        </q-card-section>

        <q-card-section>
          <q-input
            v-model="newKey.key"
            label="Key 名称"
            outlined
            dense
            dark
            class="q-mb-sm"
          />
          <q-select
            v-model="newKey.type"
            :options="typeOptions"
            label="类型"
            outlined
            dense
            dark
            emit-value
            map-options
            class="q-mb-sm"
          />
          <q-input
            v-model.number="newKey.ttl"
            label="TTL (秒，0 或 -1 为永久)"
            type="number"
            outlined
            dense
            dark
            class="q-mb-sm"
          />
          <div class="text-caption text-grey-6 q-mb-xs">值 (Hash/List/Set/ZSet 使用 JSON 格式)</div>
          <div ref="newKeyEditorContainer" class="new-key-editor"></div>
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" v-close-popup />
          <q-btn flat label="创建" color="primary" @click="createKey" :loading="creating" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted, onUnmounted, nextTick } from "vue";
import { useQuasar } from "quasar";
import { currentSelectTreeNode } from "../dbDragEditor/hooks/useDbConfig";
import { dbTreeManager } from "../dbDragEditor/hooks/useDbTreeManager";
import api from "../../../services/api.js";
import RedisCliEditor from "./RedisCliEditor.vue";
import RedisTerminal from "./RedisTerminal.vue";
import RedisKeyList from "./RedisKeyList.vue";
import RedisKeyDetail from "./RedisKeyDetail.vue";

// CodeMirror for new key dialog
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

const $q = useQuasar();
const manager = dbTreeManager();

const props = defineProps({
  redisConfig: {
    type: Object,
    default: null,
  },
});

// Refs
const cliEditorRef = ref(null);
const terminalRef = ref(null);
const keyListRef = ref(null);
const keyDetailRef = ref(null);
const newKeyEditorContainer = ref(null);

// Tab state
const activeTab = ref("keys");

// Key 管理状态
const loading = ref(false);
const saving = ref(false);
const creating = ref(false);
const cursor = ref("0");
const hasMore = ref(false);
const keys = ref([]);
const selectedKey = ref(null);
const selectedKeyData = ref(null);
const isNewKey = ref(false);

// CLI 状态
const cliResult = ref(null);
const cliResultRows = ref([]);
const cliResultColumns = ref([]);

// 新增 Key 对话框
const showAddDialog = ref(false);
const newKey = ref({
  key: "",
  type: "string",
  value: "",
  ttl: 0,
});
let newKeyEditor = null;

const typeOptions = [
  { label: "String", value: "string" },
  { label: "Hash", value: "hash" },
  { label: "List", value: "list" },
  { label: "Set", value: "set" },
  { label: "ZSet", value: "zset" },
];

const defaultNewKeyValues = {
  hash: { field: "value" },
  list: ["value"],
  set: ["value"],
  zset: [{ member: "member", score: 1 }],
};

const getDefaultNewKeyValue = (type) => defaultNewKeyValues[type] ?? "";

const getDefaultNewKeyEditorDoc = (type) => {
  const value = getDefaultNewKeyValue(type);
  return typeof value === "string" ? value : JSON.stringify(value, null, 2);
};

const setNewKeyEditorValue = (value) => {
  if (!newKeyEditor) return;
  newKeyEditor.dispatch({
    changes: {
      from: 0,
      to: newKeyEditor.state.doc.length,
      insert: value,
    },
  });
};

const isValidNewKeyValue = (type, value) => {
  if (type === "hash") {
    return value && typeof value === "object" && !Array.isArray(value) && Object.keys(value).length > 0;
  }
  if (type === "zset") {
    return Array.isArray(value) && value.some(item => item && item.member !== undefined && item.score !== undefined);
  }
  if (type === "list" || type === "set") {
    return Array.isArray(value) && value.length > 0;
  }
  return true;
};

// 获取当前 Redis 配置
const redisConfig = computed(() => {
  // 优先使用 prop 传入的配置
  if (props.redisConfig) return props.redisConfig;

  const node = currentSelectTreeNode.value;
  if (!node) return null;

  // redis_db 节点：从父节点获取连接配置
  if (node.type === "redis_db") {
    const dbIndex = parseInt(node.name.replace("db", ""), 10) || 0;
    const parentNode = manager.findNearestParentByType(node, "redis");
    if (!parentNode) return null;

    const parentConfig = parentNode.graphData?.extra || {};
    return {
      host: parentConfig.host || "localhost",
      port: parentConfig.port || 6379,
      password: parentConfig.password || "",
      username: parentConfig.username || "",
      db: dbIndex,
    };
  }

  // redis 节点
  if (node.type === "redis") {
    const extra = node.graphData?.extra || {};
    return {
      host: extra.host || "localhost",
      port: extra.port || 6379,
      password: extra.password || "",
      username: extra.username || "",
      db: 0,
    };
  }

  return null;
});

// 添加日志
const onLog = (log) => {
  if (terminalRef.value) {
    terminalRef.value.appendLog(log.message, log.type);
  }
};

// CLI 执行
const onCliExecute = async (data) => {
  if (!data.pending) return;

  const config = redisConfig.value;
  if (!config) {
    onLog({ message: "未配置 Redis 连接", type: "error" });
    cliEditorRef.value?.setExecutionResult({ error: true });
    return;
  }

  try {
    const response = await api.post("/api/redis/execute", {
      config,
      command: data.command,
    });

    if (response.data.success) {
      cliResult.value = response.data.data;
      cliEditorRef.value?.setExecutionResult(response.data.data);
      onLog({
        message: `执行成功，耗时 ${response.data.data.executionTime}ms`,
        type: "success",
      });

      // 格式化结果为表格
      formatCliResult(response.data.data);
    } else {
      onLog({ message: response.data.message, type: "error" });
      cliEditorRef.value?.setExecutionResult({ error: true });
    }
  } catch (error) {
    onLog({ message: `执行失败: ${error.message}`, type: "error" });
    cliEditorRef.value?.setExecutionResult({ error: true });
  }
};

// 格式化 CLI 结果为表格
const formatCliResult = (data) => {
  const { result, resultType } = data;

  if (resultType === "array" && Array.isArray(result)) {
    // 检查是否为 hash 结果（偶数个元素的字段-值对）
    if (result.length > 0 && result.length % 2 === 0) {
      // 可能是 HGETALL 结果
      const isHashLike = result.every((item, i) => typeof item === "string");
      if (isHashLike) {
        const rows = [];
        for (let i = 0; i < result.length; i += 2) {
          rows.push({ index: i / 2, field: result[i], value: result[i + 1] });
        }
        cliResultColumns.value = [
          { field: "index", title: "#", width: 50 },
          { field: "field", title: "字段", width: 150 },
          { field: "value", title: "值" },
        ];
        cliResultRows.value = rows;
        return;
      }
    }

    // 普通数组
    cliResultColumns.value = [
      { field: "index", title: "#", width: 50 },
      { field: "value", title: "值" },
    ];
    cliResultRows.value = result.map((item, index) => ({
      index,
      value: typeof item === "object" ? JSON.stringify(item) : item,
    }));
  } else {
    // 非数组结果，清空表格
    cliResultColumns.value = [];
    cliResultRows.value = [];
  }
};

// 格式化简单结果
const formatSimpleResult = (result) => {
  if (result === null) return "(nil)";
  if (typeof result === "object") return JSON.stringify(result, null, 2);
  return String(result);
};

// 加载 keys
const loadKeys = async (pattern = "*") => {
  const config = redisConfig.value;
  if (!config) return;

  loading.value = true;
  cursor.value = "0";
  keys.value = [];

  try {
    const response = await api.post("/api/redis/keys", {
      config,
      pattern,
      cursor: "0",
      count: 50,
    });

    if (response.data.success) {
      keys.value = response.data.data.keys;
      cursor.value = response.data.data.cursor;
      hasMore.value = response.data.data.hasMore;
      onLog({ message: `加载了 ${keys.value.length} 个 key`, type: "info" });
    }
  } catch (error) {
    onLog({ message: `加载 keys 失败: ${error.message}`, type: "error" });
  } finally {
    loading.value = false;
  }
};

// 加载更多
const loadMoreKeys = async () => {
  const config = redisConfig.value;
  if (!config) return;

  loading.value = true;

  try {
    const pattern = keyListRef.value?.getSearchPattern() || "*";
    const response = await api.post("/api/redis/keys", {
      config,
      pattern,
      cursor: cursor.value,
      count: 50,
    });

    if (response.data.success) {
      keys.value.push(...response.data.data.keys);
      cursor.value = response.data.data.cursor;
      hasMore.value = response.data.data.hasMore;
    }
  } catch (error) {
    onLog({ message: `加载更多失败: ${error.message}`, type: "error" });
  } finally {
    loading.value = false;
  }
};

// 选择 key
const selectKey = async (key) => {
  const config = redisConfig.value;
  if (!config) return;

  selectedKey.value = key;
  isNewKey.value = false;
  loading.value = true;

  try {
    const response = await api.post("/api/redis/key/get", {
      config,
      key,
    });

    if (response.data.success) {
      const data = response.data.data;
      // 处理 zset 格式
      if (data.type === "zset" && Array.isArray(data.value)) {
        const arr = data.value;
        const result = [];
        for (let i = 0; i < arr.length; i += 2) {
          result.push({ member: arr[i], score: parseFloat(arr[i + 1]) });
        }
        data.value = result;
      }
      selectedKeyData.value = data;
    }
  } catch (error) {
    onLog({ message: `获取 key 失败: ${error.message}`, type: "error" });
  } finally {
    loading.value = false;
  }
};

// 保存 key
const saveKey = async (data) => {
  if (data.error) {
    $q.notify({ type: "negative", message: data.error });
    return;
  }

  const config = redisConfig.value;
  if (!config) return;

  saving.value = true;

  try {
    const response = await api.post("/api/redis/key/set", {
      config,
      key: data.key,
      type: data.type,
      value: data.value,
      ttl: data.ttl,
    });

    if (response.data.success) {
      $q.notify({ type: "positive", message: "保存成功" });
      onLog({ message: `Key '${data.key}' 保存成功`, type: "success" });
      loadKeys(keyListRef.value?.getSearchPattern() || "*");
    } else {
      $q.notify({ type: "negative", message: response.data.message });
    }
  } catch (error) {
    $q.notify({ type: "negative", message: `保存失败: ${error.message}` });
  } finally {
    saving.value = false;
  }
};

// 删除 key
const deleteKey = async (key) => {
  if (!key) return;

  const config = redisConfig.value;
  if (!config) return;

  $q.dialog({
    title: "确认删除",
    message: `确定要删除 Key '${key}' 吗？`,
    cancel: true,
    persistent: true,
    dark: true,
  }).onOk(async () => {
    try {
      const response = await api.post("/api/redis/key/delete", {
        config,
        keys: [key],
      });

      if (response.data.success) {
        $q.notify({ type: "positive", message: "删除成功" });
        onLog({ message: `Key '${key}' 已删除`, type: "success" });
        loadKeys(keyListRef.value?.getSearchPattern() || "*");
        if (selectedKey.value === key) {
          selectedKey.value = null;
          selectedKeyData.value = null;
        }
      }
    } catch (error) {
      $q.notify({ type: "negative", message: `删除失败: ${error.message}` });
    }
  });
};

// 删除选中的 key
const deleteSelectedKey = () => {
  if (selectedKey.value) {
    deleteKey(selectedKey.value);
  }
};

// 刷新选中的 key
const refreshSelectedKey = () => {
  if (selectedKey.value) {
    selectKey(selectedKey.value);
  }
};

// 显示新增 Key 对话框
const showAddKeyDialog = () => {
  newKey.value = { key: "", type: "string", value: "", ttl: 0 };
  showAddDialog.value = true;

  nextTick(() => {
    initNewKeyEditor();
  });
};

// 初始化新增 Key 编辑器
const initNewKeyEditor = () => {
  if (!newKeyEditorContainer.value) return;

  if (newKeyEditor) {
    newKeyEditor.destroy();
  }

  const state = EditorState.create({
    doc: getDefaultNewKeyEditorDoc(newKey.value.type),
    extensions: [
      lineNumbers(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      json(),
      syntaxHighlighting(defaultHighlightStyle),
      oneDark,
      EditorView.theme({
        "&": {
          height: "200px",
          fontSize: "13px",
        },
        ".cm-scroller": {
          overflow: "auto",
        },
      }),
    ],
  });

  newKeyEditor = new EditorView({
    state,
    parent: newKeyEditorContainer.value,
  });
};

// 创建新 Key
const createKey = async () => {
  const config = redisConfig.value;
  if (!config || !newKey.value.key) {
    $q.notify({ type: "warning", message: "Key name is required" });
    return;
  }

  creating.value = true;

  try {
    const type = newKey.value.type;
    let value = newKeyEditor ? newKeyEditor.state.doc.toString() : "";

    if (type !== "string") {
      try {
        value = value.trim() ? JSON.parse(value) : getDefaultNewKeyValue(type);
      } catch (e) {
        $q.notify({ type: "warning", message: "Non-string Redis types require JSON" });
        creating.value = false;
        return;
      }

      if (!isValidNewKeyValue(type, value)) {
        $q.notify({ type: "warning", message: "Non-string Redis types require at least one item" });
        creating.value = false;
        return;
      }
    }

    const response = await api.post("/api/redis/key/set", {
      config,
      key: newKey.value.key,
      type,
      value,
      ttl: newKey.value.ttl > 0 ? newKey.value.ttl : undefined,
    });

    if (response.data.success) {
      $q.notify({ type: "positive", message: "Created" });
      onLog({ message: `Key '${newKey.value.key}' created`, type: "success" });
      showAddDialog.value = false;
      loadKeys(keyListRef.value?.getSearchPattern() || "*");
    } else {
      $q.notify({ type: "negative", message: response.data.message });
    }
  } catch (error) {
    $q.notify({ type: "negative", message: `Create failed: ${error.message}` });
  } finally {
    creating.value = false;
  }
};

watch(currentSelectTreeNode, (node) => {
  if (props.redisConfig) return; // 使用 prop 时不响应节点变化
  if (node && (node.type === "redis" || node.type === "redis_db")) {
    loadKeys();
  } else {
    keys.value = [];
    selectedKey.value = null;
    selectedKeyData.value = null;
  }
}, { immediate: true });

// 监听 prop 配置变化
watch(() => props.redisConfig, (config) => {
  if (config) {
    loadKeys();
  }
}, { immediate: true });

// 监听对话框关闭
watch(() => newKey.value.type, (type, oldType) => {
  if (!newKeyEditor || type === oldType) return;

  const currentValue = newKeyEditor.state.doc.toString().trim();
  if (!currentValue || currentValue === getDefaultNewKeyEditorDoc(oldType).trim()) {
    setNewKeyEditorValue(getDefaultNewKeyEditorDoc(type));
  }
});

watch(showAddDialog, (val) => {
  if (!val && newKeyEditor) {
    newKeyEditor.destroy();
    newKeyEditor = null;
  }
});

// 监听右键菜单添加 Key 事件
const handleAddKeyEvent = () => {
  activeTab.value = "keys";
  showAddKeyDialog();
};

onMounted(() => {
  window.addEventListener("redis-add-key", handleAddKeyEvent);
});

onUnmounted(() => {
  window.removeEventListener("redis-add-key", handleAddKeyEvent);
});
</script>

<style scoped>
.redis-viewer {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1d1d1d;
}

.redis-tabs {
  flex-shrink: 0;
  background-color: #252526;
}

.redis-tabs :deep(.q-tab) {
  min-height: 32px;
}

.redis-tab-panels {
  flex: 1;
  overflow: hidden;
}

.redis-tab-panels :deep(.q-tab-panel) {
  padding: 0;
  height: 100%;
}

/* CLI Panel */
.cli-panel {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.cli-editor-section {
  height: 40%;
  min-height: 120px;
}

.cli-result-section {
  flex: 1;
  display: flex;
  flex-direction: column;
  border-top: 1px solid #333;
}

.result-header {
  flex-shrink: 0;
  background-color: #252526;
  border-bottom: 1px solid #333;
}

.result-content {
  flex: 1;
  overflow: auto;
}

/* Keys Panel */
.keys-panel {
  height: 100%;
}

.keys-panel > .col-4,
.keys-panel > .col-8 {
  height: 100%;
  overflow: hidden;
}

/* New Key Editor */
.new-key-editor {
  border: 1px solid #444;
  border-radius: 4px;
  overflow: hidden;
}

.new-key-editor :deep(.cm-editor) {
  height: 200px;
}

.new-key-editor :deep(.cm-scroller) {
  font-family: "Consolas", "Monaco", monospace;
}
</style>
