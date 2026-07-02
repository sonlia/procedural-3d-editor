<template>
  <div class="redis-cli-container">
    <div class="redis-cli-toolbar q-pa-xs row items-center q-gutter-xs">
      <q-btn
        flat
        dense
        icon="play_arrow"
        color="positive"
        size="sm"
        label="执行"
        :loading="executing"
        @click="executeCommand"
      />
      <q-btn
        flat
        dense
        icon="clear"
        color="grey"
        size="sm"
        label="清空"
        @click="clearEditor"
      />
      <q-space />
      <span v-if="executionTime !== null" class="text-grey-6 text-caption">
        执行耗时: {{ executionTime }}ms
      </span>
      <span class="text-grey-7 text-caption q-ml-sm">Ctrl+Enter 执行</span>
    </div>
    <div ref="editorContainer" class="redis-cli-editor"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { StreamLanguage } from "@codemirror/language";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";

const emit = defineEmits(["execute-result", "log"]);

const editorContainer = ref(null);
const executing = ref(false);
const executionTime = ref(null);

let editorView = null;

// Redis 命令简易高亮
const redisLanguage = StreamLanguage.define({
  token(stream) {
    if (stream.sol()) {
      // 行首读取命令
      if (stream.match(/^[A-Za-z]+/)) {
        return "keyword";
      }
    }
    if (stream.match(/^"[^"]*"/)) {
      return "string";
    }
    if (stream.match(/^'[^']*'/)) {
      return "string";
    }
    if (stream.match(/^-?\d+(\.\d+)?/)) {
      return "number";
    }
    if (stream.match(/^\s+/)) {
      return null;
    }
    stream.next();
    return null;
  },
});

// 初始化编辑器
const initEditor = () => {
  if (!editorContainer.value || editorView) return;

  const state = EditorState.create({
    doc: "PING",
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      redisLanguage,
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
      // Ctrl+Enter 执行
      keymap.of([
        {
          key: "Ctrl-Enter",
          run: () => {
            executeCommand();
            return true;
          },
        },
      ]),
    ],
  });

  editorView = new EditorView({
    state,
    parent: editorContainer.value,
  });
};

// 获取命令内容
const getCommand = () => {
  if (!editorView) return "";
  return editorView.state.doc.toString();
};

// 设置命令内容
const setCommand = (content) => {
  if (!editorView) return;
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: content,
    },
  });
};

// 执行命令
const executeCommand = async () => {
  const command = getCommand().trim();
  if (!command) {
    emit("log", { message: "命令内容为空", type: "warning" });
    return;
  }

  executing.value = true;
  executionTime.value = null;
  emit("log", { message: `> ${command}`, type: "info" });

  // 通知父组件执行命令
  emit("execute-result", { command, pending: true });
};

// 设置执行结果
const setExecutionResult = (result) => {
  executing.value = false;
  if (result.executionTime !== undefined) {
    executionTime.value = result.executionTime;
  }
};

// 清空编辑器
const clearEditor = () => {
  setCommand("");
  executionTime.value = null;
};

onMounted(() => {
  nextTick(() => {
    initEditor();
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
  getCommand,
  setCommand,
  executeCommand,
  setExecutionResult,
});
</script>

<style scoped>
.redis-cli-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e;
}

.redis-cli-toolbar {
  background-color: #252526;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.redis-cli-editor {
  flex: 1;
  overflow: hidden;
}

.redis-cli-editor :deep(.cm-editor) {
  height: 100%;
}

.redis-cli-editor :deep(.cm-scroller) {
  font-family: "Consolas", "Monaco", monospace;
}
</style>
