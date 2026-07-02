<template>
  <div class="redis-key-detail">
    <!-- 无选中状态 -->
    <div v-if="!keyData" class="empty-state text-grey-6 text-center q-pa-lg">
      选择一个 Key 查看详情
    </div>

    <!-- Key 详情 -->
    <template v-else>
      <!-- 头部信息 -->
      <div class="key-header q-pa-sm">
        <div class="row items-center q-mb-sm">
          <div class="text-subtitle2 ellipsis" style="max-width: 200px" :title="keyData.key">
            {{ keyData.key }}
          </div>
          <q-space />
          <q-badge :color="getTypeColor(keyData.type)" :label="keyData.type" />
          <div class="key-actions row items-center q-gutter-xs">
            <q-btn
              flat
              dense
              size="sm"
              label="保存"
              color="positive"
              icon="save"
              :loading="saving"
              @click="saveKey"
            />
            <q-btn
              flat
              dense
              size="sm"
              label="删除"
              color="negative"
              icon="delete"
              @click="$emit('delete')"
              :disable="isNewKey"
            />
            <q-btn
              flat
              dense
              size="sm"
              label="刷新"
              icon="refresh"
              @click="$emit('refresh')"
              :disable="isNewKey"
            />
          </div>
        </div>

        <div class="row q-gutter-sm">
          <q-select
            v-model="editType"
            :options="typeOptions"
            label="类型"
            dense
            dark
            outlined
            emit-value
            map-options
            class="col-4"
            :disable="!isNewKey"
          />
          <q-input
            v-model.number="editTTL"
            label="TTL (秒)"
            type="number"
            dense
            dark
            outlined
            class="col-4"
            hint="-1 为永久"
          />
        </div>
      </div>

      <!-- 值编辑器 (CodeMirror) -->
      <div class="key-value-editor">
        <div class="editor-header q-px-sm q-py-xs row items-center">
          <span class="text-caption text-grey-6">值</span>
          <q-space />
          <q-btn
            flat
            dense
            icon="format_align_left"

            title="格式化 JSON"
            @click="formatValue"
            :disable="editType !== 'hash'"
          />
        </div>
        <div ref="editorContainer" class="value-editor-wrapper"></div>
      </div>

    </template>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onUnmounted, nextTick } from "vue";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { json } from "@codemirror/lang-json";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

const props = defineProps({
  keyData: {
    type: Object,
    default: null,
  },
  isNewKey: {
    type: Boolean,
    default: false,
  },
  saving: {
    type: Boolean,
    default: false,
  },
});

const emit = defineEmits(["save", "delete", "refresh"]);

const editorContainer = ref(null);
const editType = ref("string");
const editTTL = ref(-1);
let editorView = null;

const typeOptions = [
  { label: "String", value: "string" },
  { label: "Hash", value: "hash" },
  { label: "List", value: "list" },
  { label: "Set", value: "set" },
  { label: "ZSet", value: "zset" },
];

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

// 初始化编辑器
const initEditor = () => {
  if (!editorContainer.value) return;

  // 销毁旧编辑器
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }

  const state = EditorState.create({
    doc: "",
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      json(),
      syntaxHighlighting(defaultHighlightStyle),
      oneDark,
      EditorView.theme({
        "&": {
          height: "100%",
          fontSize: "13px",
        },
        ".cm-scroller": {
          overflow: "auto",
        },
        ".cm-content": {
          caretColor: "#fff",
        },
      }),
    ],
  });

  editorView = new EditorView({
    state,
    parent: editorContainer.value,
  });
};

// 获取编辑器内容
const getEditorValue = () => {
  if (!editorView) return "";
  return editorView.state.doc.toString();
};

// 设置编辑器内容
const setEditorValue = (content) => {
  if (!editorView) return;
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: content,
    },
  });
};

// 格式化值为编辑器显示格式
const formatValueForEditor = (value, type) => {
  if (value === null || value === undefined) return "";

  switch (type) {
    case "string":
      // 尝试格式化 JSON 字符串
      try {
        const parsed = JSON.parse(value);
        return JSON.stringify(parsed, null, 2);
      } catch {
        return value;
      }
    case "hash":
      return JSON.stringify(value, null, 2);
    case "list":
    case "set":
      return JSON.stringify(value, null, 2);
    case "zset":
      // [{member, score}] 格式
      return JSON.stringify(value, null, 2);
    default:
      return String(value);
  }
};

// 解析编辑器值为 API 格式
const parseEditorValue = () => {
  const content = getEditorValue().trim();
  if (!content) return null;

  const type = editType.value;

  switch (type) {
    case "string":
      return content;
    case "hash":
    case "list":
    case "set":
    case "zset":
      try {
        return JSON.parse(content);
      } catch (e) {
        throw new Error("JSON 格式错误");
      }
    default:
      return content;
  }
};

// 格式化 JSON
const formatValue = () => {
  const content = getEditorValue();
  try {
    const parsed = JSON.parse(content);
    setEditorValue(JSON.stringify(parsed, null, 2));
  } catch {
    // 忽略格式化错误
  }
};

// 保存 Key
const saveKey = () => {
  try {
    const value = parseEditorValue();
    emit("save", {
      key: props.keyData.key,
      type: editType.value,
      value,
      ttl: editTTL.value > 0 ? editTTL.value : undefined,
    });
  } catch (e) {
    // 错误由父组件处理
    emit("save", { error: e.message });
  }
};

// 监听 keyData 变化
watch(() => props.keyData, (newData) => {
  if (newData) {
    editType.value = newData.type || "string";
    editTTL.value = newData.ttl || -1;

    nextTick(() => {
      if (!editorView) {
        initEditor();
      }
      const formattedValue = formatValueForEditor(newData.value, newData.type);
      setEditorValue(formattedValue);
    });
  }
}, { immediate: true });

onMounted(() => {
  nextTick(() => {
    if (props.keyData && editorContainer.value) {
      initEditor();
      const formattedValue = formatValueForEditor(props.keyData.value, props.keyData.type);
      setEditorValue(formattedValue);
    }
  });
});

onUnmounted(() => {
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
});

// 暴露方法
defineExpose({
  getEditorValue,
  setEditorValue,
  parseEditorValue,
});
</script>

<style scoped>
.redis-key-detail {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1d1d1d;
}

.empty-state {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
}

.key-header {
  flex-shrink: 0;
  background-color: #252526;
  border-bottom: 1px solid #333;
}

.key-value-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.editor-header {
  flex-shrink: 0;
  background-color: #1e1e1e;
  border-bottom: 1px solid #333;
}

.value-editor-wrapper {
  flex: 1;
  overflow: hidden;
}

.value-editor-wrapper :deep(.cm-editor) {
  height: 100%;
}

.value-editor-wrapper :deep(.cm-scroller) {
  font-family: "Consolas", "Monaco", monospace;
}

.key-actions {
  flex-shrink: 0;
}
</style>
