<template>
  <div class="column full-height">
    <!-- 调试工具栏 -->
    <div class="row items-center q-pa-xs bg-grey-10 q-gutter-sm">
      <q-btn
        flat
        dense
        icon="play_arrow"
        color="positive"
        label="运行"
        size="sm"
        :loading="isRunning"
        @click="handleRun"
      />
      <q-btn flat dense icon="clear" @click="clearOutput">
        <q-tooltip>清空输出</q-tooltip>
      </q-btn>
      <q-space />
      <q-badge v-if="lastRunTime" color="grey-8">
        {{ lastRunTime }}ms
      </q-badge>
    </div>

    <q-separator dark />

    <!-- 测试参数输入 -->
    <q-expansion-item
      v-model="showParams"
      dark
      dense
      header-class="bg-grey-10"
      label="测试参数"
    >
      <div class="q-pa-sm">
        <!-- API 测试参数 -->
        <template v-if="item.type === 'api'">
          <div class="text-caption text-grey-6 q-mb-xs">请求参数 (JSON)</div>
          <q-input
            v-model="testParams"
            dark
            dense
            type="textarea"
            rows="4"
            placeholder='{ "key": "value" }'
          />
          <div class="text-caption text-grey-6 q-mt-sm q-mb-xs">请求头</div>
          <q-input
            v-model="testHeaders"
            dark
            dense
            type="textarea"
            rows="2"
            placeholder='{ "Authorization": "Bearer token" }'
          />
        </template>

        <!-- 函数测试参数 -->
        <template v-else>
          <div class="text-caption text-grey-6 q-mb-xs">函数参数 (JSON 数组)</div>
          <q-input
            v-model="testArgs"
            dark
            dense
            type="textarea"
            rows="4"
            placeholder='["arg1", 123, { "key": "value" }]'
          />
        </template>
      </div>
    </q-expansion-item>

    <q-separator dark />

    <!-- 输出区域 -->
    <div class="col column">
      <div class="row items-center q-px-sm q-py-xs bg-grey-10">
        <q-tabs v-model="outputTab" dense dark narrow-indicator>
          <q-tab name="console" label="控制台" />
          <q-tab name="response" label="响应" />
        </q-tabs>
      </div>

      <q-separator dark />

      <q-tab-panels v-model="outputTab" class="col bg-dark" animated>
        <!-- 控制台输出 -->
        <q-tab-panel name="console" class="q-pa-none">
          <div ref="terminalContainer" class="full-height" />
        </q-tab-panel>

        <!-- 响应结果 -->
        <q-tab-panel name="response" class="q-pa-sm">
          <q-scroll-area class="fit">
            <div v-if="!responseData" class="text-grey-6 text-center q-pa-md">
              运行后查看响应结果
            </div>
            <div v-else>
              <div class="row items-center q-mb-sm">
                <q-badge
                  :color="responseSuccess ? 'positive' : 'negative'"
                  :label="responseSuccess ? '成功' : '失败'"
                />
                <span v-if="responseStatus" class="q-ml-sm text-grey-6">
                  状态码: {{ responseStatus }}
                </span>
              </div>
              <pre class="bg-grey-10 q-pa-sm rounded-borders text-grey-4" style="overflow: auto; font-size: 12px;">{{ formatResponse(responseData) }}</pre>
            </div>
          </q-scroll-area>
        </q-tab-panel>
      </q-tab-panels>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { useProjectTerminal } from "src/composables/useProjectTerminal";
import { debugApi as _debugApi, debugFunction as _debugFunction } from "src/services/http/backendApi";
import { useProjectMangerStore } from "src/stores/projectMange";

const _projectManger = useProjectMangerStore();
const currentProjectId = computed(() => _projectManger.currentProjectId);

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
});

const { on, off } = useProjectTerminal();

// 终端容器
const terminalContainer = ref(null);
let terminal = null;

// 状态
const isRunning = ref(false);
const showParams = ref(true);
const outputTab = ref('console');
const lastRunTime = ref(null);

// 测试参数
const testParams = ref('{}');
const testHeaders = ref('{}');
const testArgs = ref('[]');

// 响应数据
const responseData = ref(null);
const responseSuccess = ref(false);
const responseStatus = ref(null);

// 初始化终端
const initTerminal = async () => {
  if (!terminalContainer.value) return;

  const { Terminal } = await import('@xterm/xterm');
  const { FitAddon } = await import('@xterm/addon-fit');
  await import('@xterm/xterm/css/xterm.css');

  terminal = new Terminal({
    theme: {
      background: '#1d1d1d',
      foreground: '#cccccc',
    },
    fontSize: 12,
    fontFamily: 'Consolas, "Courier New", monospace',
    cursorBlink: false,
    disableStdin: true,
  });

  const fitAddon = new FitAddon();
  terminal.loadAddon(fitAddon);
  terminal.open(terminalContainer.value);
  fitAddon.fit();

  // 监听窗口大小变化
  const resizeObserver = new ResizeObserver(() => {
    fitAddon.fit();
  });
  resizeObserver.observe(terminalContainer.value);
};

// 销毁终端
const destroyTerminal = () => {
  if (terminal) {
    terminal.dispose();
    terminal = null;
  }
};

// 写入终端
const writeToTerminal = (text, color = '') => {
  if (!terminal) return;

  const colorCodes = {
    red: '\x1b[31m',
    green: '\x1b[32m',
    yellow: '\x1b[33m',
    blue: '\x1b[34m',
    cyan: '\x1b[36m',
    reset: '\x1b[0m',
  };

  const prefix = color ? colorCodes[color] || '' : '';
  const suffix = color ? colorCodes.reset : '';

  terminal.writeln(prefix + text + suffix);
};

// 清空输出
const clearOutput = () => {
  if (terminal) {
    terminal.clear();
  }
  responseData.value = null;
  responseSuccess.value = false;
  responseStatus.value = null;
  lastRunTime.value = null;
};

// 运行调试
const handleRun = async () => {
  if (isRunning.value) return;

  isRunning.value = true;
  clearOutput();

  const startTime = Date.now();
  writeToTerminal(`[${new Date().toLocaleTimeString()}] 开始运行...`, 'cyan');

  try {
    let result;

    if (props.item.type === 'api') {
      // 解析测试参数
      let params = {};
      let headers = {};
      try {
        params = JSON.parse(testParams.value || '{}');
        headers = JSON.parse(testHeaders.value || '{}');
      } catch (e) {
        writeToTerminal(`参数解析错误: ${e.message}`, 'red');
        isRunning.value = false;
        return;
      }

      writeToTerminal(`请求: ${props.item.method} ${props.item.path}`, 'blue');
      writeToTerminal(`参数: ${JSON.stringify(params)}`, 'blue');

      result = await _debugApi(currentProjectId.value, props.item.id, { params, headers });
    } else {
      // 解析函数参数
      let args = [];
      try {
        args = JSON.parse(testArgs.value || '[]');
      } catch (e) {
        writeToTerminal(`参数解析错误: ${e.message}`, 'red');
        isRunning.value = false;
        return;
      }

      writeToTerminal(`调用: ${props.item.name}(${args.map(a => JSON.stringify(a)).join(', ')})`, 'blue');

      result = await _debugFunction(currentProjectId.value, props.item.id, args);
    }

    const endTime = Date.now();
    lastRunTime.value = endTime - startTime;

    if (result?.success) {
      writeToTerminal(`✓ 运行成功 (${lastRunTime.value}ms)`, 'green');
      responseSuccess.value = true;
      responseStatus.value = result.status;
      responseData.value = result.data;

      // 输出日志
      if (result.logs && result.logs.length > 0) {
        writeToTerminal('\n--- 日志输出 ---', 'yellow');
        result.logs.forEach(log => {
          writeToTerminal(log);
        });
      }
    } else {
      writeToTerminal(`✗ 运行失败: ${result?.error || '未知错误'}`, 'red');
      responseSuccess.value = false;
      responseData.value = result?.error || '运行失败';

      // 输出错误堆栈
      if (result?.stack) {
        writeToTerminal('\n--- 错误堆栈 ---', 'red');
        writeToTerminal(result.stack, 'red');
      }
    }
  } catch (error) {
    writeToTerminal(`✗ 调试失败: ${error.message}`, 'red');
    responseSuccess.value = false;
    responseData.value = error.message;
  } finally {
    isRunning.value = false;
    outputTab.value = 'response';
  }
};

// 格式化响应
const formatResponse = (data) => {
  if (typeof data === 'string') {
    try {
      return JSON.stringify(JSON.parse(data), null, 2);
    } catch {
      return data;
    }
  }
  return JSON.stringify(data, null, 2);
};

// 监听调试输出
const handleDebugOutput = (payload) => {
  if (payload.projectId !== currentProjectId.value) return;
  if (payload.itemId !== props.item.id) return;

  writeToTerminal(payload.content);
};

onMounted(async () => {
  await nextTick();
  initTerminal();

  // 监听调试输出
  on('backend:debug:output', handleDebugOutput);
});

onBeforeUnmount(() => {
  destroyTerminal();
  off('backend:debug:output', handleDebugOutput);
});

// 监听 item 变化，清空输出
watch(() => props.item.id, () => {
  clearOutput();
});
</script>

<style scoped>
pre {
  white-space: pre-wrap;
  word-break: break-all;
}
</style>
