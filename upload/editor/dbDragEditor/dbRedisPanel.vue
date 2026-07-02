<template>
  <div class="redis-data-panel">
    <!-- 主内容区域：左右分割 -->
    <q-splitter v-model="splitterModel" class="full-height" :limits="[30, 70]">
      <!-- 左侧：CLI + 日志 -->
      <template #before>
        <div class="left-panel column full-height">
          <!-- CLI 编辑器 -->
          <div class="cli-section">
            <RedisCliEditor
              ref="cliEditorRef"
              @execute-result="onCliExecute"
              @log="onLog"
            />
          </div>

          <!-- 日志终端 -->
          <div class="terminal-section">
            <RedisTerminal ref="terminalRef" />
          </div>
        </div>
      </template>

      <!-- 右侧：Key 管理 -->
      <template #after>
        <div class="right-panel row full-height">
          <!-- Key 列表 -->
          <div class="col-5 key-list-wrapper">
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

          <!-- Key 详情 -->
          <div class="col-7 key-detail-wrapper">
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
      </template>
    </q-splitter>

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
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from "vue";
import { useQuasar } from "quasar";
import { currentSelectTreeNode } from "./hooks/useDbConfig";
import { dbTreeManager } from "./hooks/useDbTreeManager";
import { useProjectStore } from "../../../stores/projectMange.js";
import api from "../../../services/api.js";
import RedisCliEditor from "../dbTableEditor/RedisCliEditor.vue";
import RedisTerminal from "../dbTableEditor/RedisTerminal.vue";
import RedisKeyList from "../dbTableEditor/RedisKeyList.vue";
import RedisKeyDetail from "../dbTableEditor/RedisKeyDetail.vue";

// CodeMirror for new key dialog
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

const $q = useQuasar();
const manager = dbTreeManager();
const _project = useProjectStore();

// Refs
const cliEditorRef = ref(null);
const terminalRef = ref(null);
const keyListRef = ref(null);
const keyDetailRef = ref(null);
const newKeyEditorContainer = ref(null);

// 状态
const splitterModel = ref(40);

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
  const node = currentSelectTreeNode.value;
  if (!node || node.type !== "redis_db") return null;

  const dbIndex = parseInt(node.name.replace("db", ""), 10) || 0;
  const parentNode = manager.findNearestParentByType(node, "redis");
  if (!parentNode) return null;

  const parentConfig = _project.getDbEditorData(parentNode.id, 'graphData')?.extra || {};
  return {
    host: parentConfig.host || "localhost",
    port: parentConfig.port || 6379,
    password: parentConfig.password || "",
    username: parentConfig.username || "",
    db: dbIndex,
  };
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

  const cfg = redisConfig.value;
  if (!cfg) {
    onLog({ message: "未配置 Redis 连接", type: "error" });
    cliEditorRef.value?.setExecutionResult({ error: true });
    return;
  }

  try {
    const response = await api.post("/api/redis/execute", {
      config: cfg,
      command: data.command,
    });

    if (response.data.success) {
      const result = response.data.data;
      cliEditorRef.value?.setExecutionResult(result);

      // 格式化结果显示在日志中
      const formattedResult = formatResult(result.result, result.resultType);
      onLog({
        message: `${formattedResult}`,
        type: "success",
      });
      onLog({
        message: `执行耗时 ${result.executionTime}ms`,
        type: "info",
      });
    } else {
      onLog({ message: response.data.message, type: "error" });
      cliEditorRef.value?.setExecutionResult({ error: true });
    }
  } catch (error) {
    onLog({ message: `执行失败: ${error.message}`, type: "error" });
    cliEditorRef.value?.setExecutionResult({ error: true });
  }
};

// 格式化结果
const formatResult = (result, resultType) => {
  if (result === null) return "(nil)";
  if (resultType === "array" && Array.isArray(result)) {
    if (result.length === 0) return "(empty array)";
    return result.map((item, i) => `${i + 1}) ${typeof item === "object" ? JSON.stringify(item) : item}`).join("\n");
  }
  if (typeof result === "object") return JSON.stringify(result, null, 2);
  return String(result);
};

// 加载 keys
const loadKeys = async (pattern = "*") => {
  const cfg = redisConfig.value;
  if (!cfg) return;

  loading.value = true;
  cursor.value = "0";
  keys.value = [];

  try {
    const response = await api.post("/api/redis/keys", {
      config: cfg,
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
  const cfg = redisConfig.value;
  if (!cfg) return;

  loading.value = true;

  try {
    const pattern = keyListRef.value?.getSearchPattern() || "*";
    const response = await api.post("/api/redis/keys", {
      config: cfg,
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
  const cfg = redisConfig.value;
  if (!cfg) return;

  selectedKey.value = key;
  isNewKey.value = false;
  loading.value = true;

  try {
    const response = await api.post("/api/redis/key/get", {
      config: cfg,
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

  const cfg = redisConfig.value;
  if (!cfg) return;

  saving.value = true;

  try {
    const response = await api.post("/api/redis/key/set", {
      config: cfg,
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

  const cfg = redisConfig.value;
  if (!cfg) return;

  $q.dialog({
    title: "确认删除",
    message: `确定要删除 Key '${key}' 吗？`,
    cancel: true,
    persistent: true,
    dark: true,
  }).onOk(async () => {
    try {
      const response = await api.post("/api/redis/key/delete", {
        config: cfg,
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
    setNewKeyEditorValue(getDefaultNewKeyEditorDoc(newKey.value.type));
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
  const cfg = redisConfig.value;
  if (!cfg || !newKey.value.key) {
    $q.notify({ type: "warning", message: "请输入 Key 名称" });
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
        $q.notify({ type: "warning", message: "非 string 类型需要使用 JSON 格式" });
        creating.value = false;
        return;
      }

      if (!isValidNewKeyValue(type, value)) {
        $q.notify({ type: "warning", message: "非 string 类型至少需要一个元素" });
        creating.value = false;
        return;
      }
    }

    const response = await api.post("/api/redis/key/set", {
      config: cfg,
      key: newKey.value.key,
      type,
      value,
      ttl: newKey.value.ttl > 0 ? newKey.value.ttl : undefined,
    });

    if (response.data.success) {
      $q.notify({ type: "positive", message: "创建成功" });
      onLog({ message: `Key '${newKey.value.key}' 创建成功`, type: "success" });
      showAddDialog.value = false;
      loadKeys(keyListRef.value?.getSearchPattern() || "*");
    } else {
      $q.notify({ type: "negative", message: response.data.message });
    }
  } catch (error) {
    $q.notify({ type: "negative", message: `创建失败: ${error.message}` });
  } finally {
    creating.value = false;
  }
};

// 监听右键菜单添加 Key 事件
const handleAddKeyEvent = () => {
  showAddKeyDialog();
};

// 监听节点变化
watch(currentSelectTreeNode, (node) => {
  if (node && node.type === "redis_db") {
    loadKeys();
  } else {
    keys.value = [];
    selectedKey.value = null;
    selectedKeyData.value = null;
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

onMounted(() => {
  window.addEventListener("redis-add-key", handleAddKeyEvent);
});

onUnmounted(() => {
  window.removeEventListener("redis-add-key", handleAddKeyEvent);
});
</script>

<style scoped>
.redis-data-panel {
  height: 100%;
  overflow: hidden;
  background-color: #1d1d1d;
}

.left-panel {
  background-color: #1d1d1d;
}

.cli-section {
  height: 50%;
  min-height: 100px;
}

.terminal-section {
  height: 50%;
  border-top: 1px solid #333;
}

.right-panel {
  background-color: #1d1d1d;
}

.key-list-wrapper {
  height: 100%;
  overflow: hidden;
}

.key-detail-wrapper {
  height: 100%;
  overflow: hidden;
  border-left: 1px solid #333;
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
