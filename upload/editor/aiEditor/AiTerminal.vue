<template>
  <div class="ai-terminal-wrap column no-wrap full-height">
    <q-bar dark dense class="bg-grey-10 text-grey-4">
      <q-icon name="smart_toy" size="sm" />
      <div class="text-caption">claude-code 交互终端</div>
      <q-space />
      <q-btn dark dense flat size="sm" icon="restart_alt" @click="restartSession">
        <q-tooltip>重启会话</q-tooltip>
      </q-btn>
    </q-bar>
    <div ref="terminalRef" class="col terminal-container"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue';

const props = defineProps({
  projectId: { type: String, default: '' },
  rootDir: { type: String, default: '' },
  rootFolder: { type: String, default: '' },
  cli: { type: String, default: '' },
});

const terminalRef = ref(null);
let terminal = null;
let fitAddon = null;
let ws = null;
let resizeObserver = null;
let isOpened = false;
let manualClose = false;

// WS 直连后端(与 SSE 同款:不过 quasar proxy),http→ws
const apiHost = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const wsBase = apiHost.replace(/^http/, 'ws');
const WS_URL = `${wsBase}/ws/ai-terminal`;

const wsSend = (obj) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify(obj));
  }
};

const sendInit = () => {
  wsSend({
    type: 'init',
    projectId: props.projectId,
    rootDir: props.rootDir,
    rootFolder: props.rootFolder,
    cli: props.cli,
    cols: terminal?.cols || 80,
    rows: terminal?.rows || 24,
  });
};

const fitAndReport = () => {
  if (!isOpened || !fitAddon || !terminal) return;
  fitAddon.fit();
  wsSend({ type: 'resize', cols: terminal.cols, rows: terminal.rows });
};

const connectWs = () => {
  // 工作目录(每个 AI 编辑器专属)是会话身份;没有它不连
  if (!props.rootDir) return;
  manualClose = false;
  ws = new WebSocket(WS_URL);

  ws.onopen = () => {
    sendInit();
    fitAndReport();
  };

  // 服务端把 pty 输出作为文本帧直接发来,收到即写入终端
  ws.onmessage = (ev) => {
    terminal?.write(typeof ev.data === 'string' ? ev.data : '');
  };

  ws.onclose = () => {
    if (!manualClose) {
      terminal?.write('\r\n\x1b[31m[AI 终端] 连接已断开\x1b[0m\r\n');
    }
  };
};

const closeWs = () => {
  manualClose = true;
  if (ws) {
    ws.close();
    ws = null;
  }
};

const restartSession = () => {
  wsSend({ type: 'restart', cli: props.cli, cols: terminal?.cols || 80, rows: terminal?.rows || 24 });
};

const openTerminal = async () => {
  if (isOpened || !terminal || !terminalRef.value) return;
  terminal.open(terminalRef.value);
  isOpened = true;
  await nextTick();
  fitAddon.fit();
};

const initTerminal = async () => {
  const [{ Terminal }, { FitAddon }] = await Promise.all([
    import('@xterm/xterm'),
    import('@xterm/addon-fit'),
  ]);
  await import('@xterm/xterm/css/xterm.css');

  terminal = new Terminal({
    theme: {
      background: '#1e1e1e',
      foreground: '#d4d4d4',
      cursor: '#d4d4d4',
      cursorAccent: '#1e1e1e',
      selectionBackground: 'rgba(255, 255, 255, 0.3)',
    },
    fontSize: 12,
    fontFamily: 'Consolas, "Courier New", monospace',
    cursorBlink: true,
    scrollback: 8000,
    convertEol: false,
    allowProposedApi: true,
  });

  // ctrl+c:有选区时复制,否则透传给 pty(claude-code 自行处理 SIGINT/取消)
  terminal.attachCustomKeyEventHandler((event) => {
    if (event.type !== 'keydown') return true;
    if (event.ctrlKey && event.key === 'c' && terminal.hasSelection()) {
      navigator.clipboard?.writeText(terminal.getSelection());
      return false;
    }
    if (event.ctrlKey && event.key === 'v') {
      navigator.clipboard?.readText().then((text) => wsSend({ type: 'input', data: text }));
      return false;
    }
    return true;
  });

  fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);

  // 键入 → 转发到后端 pty
  terminal.onData((data) => wsSend({ type: 'input', data }));

  await openTerminal();
  connectWs();

  // 容器尺寸变化(q-splitter 拖动等)自适应
  resizeObserver = new ResizeObserver(() => fitAndReport());
  resizeObserver.observe(terminalRef.value);
  window.addEventListener('resize', fitAndReport);
};

// 切换项目 / 切换 AI 编辑器(工作目录变):重连到对应目录的会话
watch(
  () => [props.projectId, props.rootDir],
  () => {
    if (!terminal) return;
    closeWs();
    terminal.reset();
    connectWs();
  },
);

onMounted(initTerminal);

onUnmounted(() => {
  closeWs();
  window.removeEventListener('resize', fitAndReport);
  resizeObserver?.disconnect();
  resizeObserver = null;
  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
});
</script>

<style scoped>
.terminal-container {
  width: 100%;
  min-height: 150px;
  background: #1e1e1e;
}

.terminal-container :deep(.xterm) {
  height: 100%;
  padding: 4px;
}

.terminal-container :deep(.xterm-viewport) {
  overflow-y: auto !important;
}
</style>
