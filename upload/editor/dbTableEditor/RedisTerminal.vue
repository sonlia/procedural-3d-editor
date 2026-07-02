<template>
  <div class="redis-terminal-container">
    <div class="terminal-header row items-center q-px-sm">
      <q-icon name="terminal"  class="q-mr-xs" />
      <span class="text-caption">Redis 日志</span>
      <q-space />
      <q-btn flat dense icon="delete_sweep"  @click="clear" title="清空日志" />
    </div>
    <div ref="terminalContainer" class="terminal-wrapper"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import "@xterm/xterm/css/xterm.css";

const terminalContainer = ref(null);
let terminal = null;
let fitAddon = null;

// 颜色映射
const colors = {
  info: "\x1b[36m",     // 青色
  success: "\x1b[32m",  // 绿色
  warning: "\x1b[33m",  // 黄色
  error: "\x1b[31m",    // 红色
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  bright: "\x1b[1m",
};

// 初始化终端
const initTerminal = () => {
  if (!terminalContainer.value || terminal) return;

  terminal = new Terminal({
    theme: {
      background: "#1e1e1e",
      foreground: "#d4d4d4",
      cursor: "#d4d4d4",
      cursorAccent: "#1e1e1e",
      selectionBackground: "#264f78",
      black: "#1e1e1e",
      red: "#f44747",
      green: "#6a9955",
      yellow: "#dcdcaa",
      blue: "#569cd6",
      magenta: "#c586c0",
      cyan: "#4ec9b0",
      white: "#d4d4d4",
      brightBlack: "#808080",
      brightRed: "#f44747",
      brightGreen: "#6a9955",
      brightYellow: "#dcdcaa",
      brightBlue: "#569cd6",
      brightMagenta: "#c586c0",
      brightCyan: "#4ec9b0",
      brightWhite: "#ffffff",
    },
    fontSize: 12,
    fontFamily: "Consolas, Monaco, 'Courier New', monospace",
    cursorBlink: false,
    disableStdin: true,
    scrollback: 1000,
    convertEol: true,
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  terminal.open(terminalContainer.value);

  nextTick(() => {
    try {
      fitAddon.fit();
    } catch (e) {
      // 忽略 fit 错误
    }
  });

  // 初始欢迎信息
  appendLog("Redis 日志终端就绪", "info");
};

// 格式化时间
const formatTime = () => {
  const now = new Date();
  return `${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}`;
};

// 添加日志
const appendLog = (message, type = "info") => {
  if (!terminal) return;

  const color = colors[type] || colors.info;
  const time = formatTime();
  const prefix = `${colors.dim}[${time}]${colors.reset} `;

  // 类型标签
  const typeLabel = {
    info: `${colors.info}[INFO]${colors.reset}`,
    success: `${colors.success}[OK]${colors.reset}`,
    warning: `${colors.warning}[WARN]${colors.reset}`,
    error: `${colors.error}[ERR]${colors.reset}`,
  }[type] || `${colors.info}[INFO]${colors.reset}`;

  terminal.writeln(`${prefix}${typeLabel} ${color}${message}${colors.reset}`);
};

// 清空终端
const clear = () => {
  if (terminal) {
    terminal.clear();
    appendLog("日志已清空", "info");
  }
};

// 调整大小
const resize = () => {
  if (fitAddon) {
    try {
      fitAddon.fit();
    } catch (e) {
      // 忽略 fit 错误
    }
  }
};

onMounted(() => {
  initTerminal();

  // 监听窗口大小变化
  window.addEventListener("resize", resize);
});

onUnmounted(() => {
  window.removeEventListener("resize", resize);
  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
});

// 暴露方法
defineExpose({
  appendLog,
  clear,
  resize,
});
</script>

<style scoped>
.redis-terminal-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e;
  border-top: 1px solid #333;
}

.terminal-header {
  height: 24px;
  background-color: #252526;
  color: #ccc;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.terminal-wrapper {
  flex: 1;
  overflow: hidden;
  padding: 4px;
}

.terminal-wrapper :deep(.xterm) {
  height: 100%;
}

.terminal-wrapper :deep(.xterm-viewport) {
  overflow-y: auto !important;
}

.terminal-wrapper :deep(.xterm-viewport::-webkit-scrollbar) {
  width: 8px;
}

.terminal-wrapper :deep(.xterm-viewport::-webkit-scrollbar-thumb) {
  background-color: #434343;
  border-radius: 4px;
}

.terminal-wrapper :deep(.xterm-viewport::-webkit-scrollbar-track) {
  background-color: #1e1e1e;
}
</style>
