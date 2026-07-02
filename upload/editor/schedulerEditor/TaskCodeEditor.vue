<template>
  <div class="column full-height">
    <!-- 工具栏 -->
    <div class="row items-center q-pa-sm bg-grey-9">
      <q-btn flat dense icon="arrow_back" @click="$emit('back')">
        <q-tooltip>返回</q-tooltip>
      </q-btn>
      <div class="text-subtitle2 q-mx-sm">{{ task.name }}</div>
      <q-badge color="blue" label="JS" />
      <q-space />
      <q-btn flat dense icon="save" :loading="saving" @click="handleSave">
        <q-tooltip>保存 (Ctrl+S)</q-tooltip>
      </q-btn>
      <q-btn flat dense icon="play_arrow" color="green" :loading="running" @click="handleTestRun">
        <q-tooltip>测试运行</q-tooltip>
      </q-btn>
    </div>

    <!-- 编辑器区域 -->
    <div class="col relative-position">
      <div ref="editorContainer" class="absolute-full" />
    </div>

    <!-- 终端输出区域 -->
    <div v-if="showTerminal" class="terminal-panel">
      <div class="row items-center q-px-sm q-py-xs bg-grey-9">
        <q-icon name="terminal" class="q-mr-xs" />
        <span class="text-caption">运行输出</span>
        <q-space />
        <q-btn flat dense icon="delete_outline" @click="clearTerminal">
          <q-tooltip>清空</q-tooltip>
        </q-btn>
        <q-btn flat dense :icon="terminalExpanded ? 'expand_more' : 'expand_less'"
          @click="terminalExpanded = !terminalExpanded">
          <q-tooltip>{{ terminalExpanded ? '收起' : '展开' }}</q-tooltip>
        </q-btn>
        <q-btn v-if="running" flat dense icon="stop" color="red" @click="handleStopRun">
          <q-tooltip>停止</q-tooltip>
        </q-btn>
      </div>
      <div ref="terminalContainer" class="terminal-content" :style="{ height: terminalExpanded ? '200px' : '100px' }" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from "vue";
import { Notify } from "quasar";
import { useProjectTerminal } from "src/composables/useProjectTerminal";
import * as monaco from "monaco-editor-core";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const props = defineProps({
  task: { type: Object, required: true },
});

const emit = defineEmits(["back", "save"]);

const { send, onMessage } = useProjectTerminal();

// 编辑器
const editorContainer = ref(null);
let editor = null;
const codeContent = ref("");

// 终端
const terminalContainer = ref(null);
let terminal = null;
let fitAddon = null;
const showTerminal = ref(false);
const terminalExpanded = ref(true);

// 状态
const saving = ref(false);
const running = ref(false);

// 初始化编辑器
const initEditor = () => {
  if (!editorContainer.value) return;

  editor = monaco.editor.create(editorContainer.value, {
    value: props.task.codeContent || "",
    language: "javascript",
    theme: "vs-dark",
    fontSize: 13,
    fontFamily: "Consolas, 'Courier New', monospace",
    minimap: { enabled: false },
    lineNumbers: "on",
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
  });

  // 保存快捷键
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
    handleSave();
  });

  // 运行快捷键
  editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
    handleTestRun();
  });

  codeContent.value = props.task.codeContent || "";
};

// 初始化终端
const initTerminal = () => {
  if (!terminalContainer.value || terminal) return;

  terminal = new Terminal({
    theme: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
    },
    fontSize: 12,
    fontFamily: "Consolas, 'Courier New', monospace",
    cursorStyle: "bar",
    cursorBlink: false,
    disableStdin: true,
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(terminalContainer.value);

  nextTick(() => {
    fitAddon.fit();
  });
};

// 清空终端
const clearTerminal = () => {
  terminal?.clear();
};

// 保存代码
const handleSave = async () => {
  if (!editor) return;

  saving.value = true;
  try {
    const code = editor.getValue();
    emit("save", { codeContent: code, codeModified: true });
    Notify.create({ type: "positive", message: "保存成功" });
  } catch (error) {
    Notify.create({ type: "negative", message: `保存失败: ${error.message}` });
  } finally {
    saving.value = false;
  }
};

// 测试运行
const handleTestRun = async () => {
  if (!editor || running.value) return;

  running.value = true;
  showTerminal.value = true;

  await nextTick();
  initTerminal();
  clearTerminal();

  const code = editor.getValue();

  // 监听输出（使用 cleanup 函数）
  let cleanupOutput = null;
  let cleanupComplete = null;

  const outputHandler = (payload) => {
    if (payload.taskId === props.task.id) {
      terminal?.write(payload.content.replace(/\n/g, "\r\n"));
    }
  };

  const completeHandler = (payload) => {
    if (payload.taskId === props.task.id) {
      running.value = false;
      // 清理监听
      if (cleanupOutput) cleanupOutput();
      if (cleanupComplete) cleanupComplete();
    }
  };

  cleanupOutput = onMessage("scheduler:output", outputHandler);
  cleanupComplete = onMessage("scheduler:complete", completeHandler);

  // 发送测试运行请求
  send("scheduler:test", {
    taskId: props.task.id,
    code,
    projectId: props.task.projectId,
  });
};

// 停止运行
const handleStopRun = () => {
  send("scheduler:stop", { taskId: props.task.id });
  running.value = false;
};

// 监听任务变化
watch(() => props.task, (newTask) => {
  if (editor && newTask.codeContent !== undefined) {
    const currentValue = editor.getValue();
    if (currentValue !== newTask.codeContent) {
      editor.setValue(newTask.codeContent || "");
    }
  }
});

// 监听终端展开状态
watch(terminalExpanded, () => {
  nextTick(() => {
    fitAddon?.fit();
  });
});

onMounted(() => {
  initEditor();
});

onUnmounted(() => {
  editor?.dispose();
  terminal?.dispose();
});
</script>

<style scoped>
.terminal-panel {
  border-top: 1px solid #333;
  background: #1e1e1e;
}

.terminal-content {
  overflow: hidden;
}
</style>
