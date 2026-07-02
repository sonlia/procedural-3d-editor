<template>
  <div v-bind="$attrs" class="base-property-panel column no-wrap">
    <!-- 头部插槽：可选的自定义头部 -->
    <slot name="header">
      <!-- 默认头部：节点类型显示区域 -->
      <q-card dark flat class="q-mb-xs">
        <q-card-section class="q-pa-sm column q-gutter-y-xs">
          <!-- 第 1 行:节点类型 + 点击复制节点 ID -->
          <div class="row items-center no-wrap node-id-display" @click="copyNodeId">
            <q-badge class="bg-red-8 text-caption  q-mr-sm col-auto text-weight-medium"> {{ nodeDisplayLabel }}</q-badge>
            <div class="text-body2 text-mono col ellipsis" style="word-break: break-all;">
              {{ nodeId }}
            </div>
            <q-tooltip class="bg-dark">点击复制 ID</q-tooltip>
          </div>

          <!-- 第 2 行:控制按钮。最左为显隐开关(仅 UI 节点),调试按钮统一靠右 -->
          <div class="row items-center no-wrap">
            <q-toggle v-if="isVisualNode" :model-value="!nodeHidden" @update:model-value="setNodeVisible" dense
              size="sm" color="teal" label="显示" class="text-grey-5 col-auto" @click.stop>
              <q-tooltip class="bg-dark">
                {{ nodeHidden ? '当前隐藏 — 打开以在 nodeEditor 中显示该节点' : '当前显示 — 关闭以在 nodeEditor 中隐藏该节点' }}
              </q-tooltip>
            </q-toggle>
            <q-space />
            <div class="row items-center q-gutter-x-xs col-auto">
              <q-btn v-if="isModeVisible('trace')" icon="visibility" dense round flat size="sm"
                :color="debugMode === 'trace' ? 'amber' : 'grey-6'" @click="toggleDebugMode('trace')">
                <q-tooltip class="bg-dark">追踪 slot 实时值(SlotValuePanel 显示 in/out)</q-tooltip>
              </q-btn>
              <q-btn v-if="isModeVisible('breakpoint')" icon="bug_report" dense round flat size="sm"
                :color="debugMode === 'breakpoint' ? 'red-5' : 'grey-6'" @click="toggleDebugMode('breakpoint')">
                <q-tooltip class="bg-dark">注入 debugger(浏览器/Node DevTools 自动断点)</q-tooltip>
              </q-btn>
              <q-btn v-if="isModeVisible('log')" icon="terminal" dense round flat size="sm"
                :color="debugMode === 'log' ? 'blue-5' : 'grey-6'" @click="toggleDebugMode('log')">
                <q-tooltip class="bg-dark">注入 console.log 打印 in/out slot 值</q-tooltip>
              </q-btn>
              <q-btn v-if="hasDocs" icon="help_outline" dense round flat color="blue-6" size="sm"
                @click="showDocDialog = true">
                <q-tooltip class="bg-dark">帮助</q-tooltip>
              </q-btn>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </slot>

    <!-- Slot 实时值面板:仅在节点 __debugMode === 'trace' 时显示;限高可滚动,避免内容过多时挤压下方默认插槽 -->
    <div class="col-auto slot-value-container">
      <SlotValuePanel :node="node" />
    </div>

    <!-- 主内容区域：可滚动 -->
    <div class="col-grow base-property-content text-white">
      <slot name="default">
        <!-- 子组件在这里插入具体的属性编辑内容 -->
      </slot>
    </div>

    <!-- 底部区域：备注和代码查看 -->
    <div v-if="!hideFooter" class="col-auto q-pa-sm ">
      <div class="row items-center q-gutter-x-sm">
        <q-input dense dark outlined class="col" :model-value="nodeRemark" @update:model-value="updateRemark"
          label="请输入备注" type="textarea" autogrow style="max-height: 120px; min-height: 48px; overflow: auto;" />
        <q-btn icon="code" dense round flat color="blue-6" @click="showJsCodeDialog = true">
          <q-tooltip class="bg-dark">查看生成的代码</q-tooltip>
        </q-btn>
      </div>
    </div>
  </div>

  <!-- JS 代码显示对话框 -->
  <q-dialog v-model="showJsCodeDialog">
    <q-card dark class="bg-dark text-white column js-code-dialog">
      <q-card-section class="row items-center q-pb-none col-auto">
        <div class="text-subtitle2">生成的 JavaScript 代码</div>
        <q-space />
        <q-btn icon="close" flat round dense v-close-popup />
      </q-card-section>

      <q-card-section class="q-pt-sm col js-code-dialog__body">
        <div class="column js-code-dialog__sections">
          <div v-for="section in codeSections" :key="section.key" class="column js-code-section">
            <div class="row items-center no-wrap js-code-section__header">
              <q-badge dense color="blue-grey-8" text-color="grey-2" class="q-mr-sm">
                {{ section.label }}
              </q-badge>
              <div class="text-caption text-grey-5 ellipsis">{{ section.filename }}</div>
            </div>
            <div class="js-code-section__editor">
              <codeEditorSrc :value="section.value" :readonly="true" :line-numbers="false" :line-wrapping="true"
                lang="javascript" :filename="section.filename" />
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>

  <!-- 文档对话框 -->
  <DocDialog v-if="hasDocs" v-model="showDocDialog" :docs="docsConfig" :component-name="node?.nodeRawData?.tag" />
</template>

<script setup>
import { ref, computed } from 'vue';
import { copyToClipboard, Notify } from 'quasar';
import { set } from 'lodash-es';
import codeEditorSrc from 'src/components/editor/codeEditor/CodeMirror/CodeMirror..vue';
import DocDialog from './doc/DocDialog.vue';
import SlotValuePanel from '../debug/SlotValuePanel.vue';
import { debugModesVisible, saveNodeEditorData } from '../composables/useLitegraphEditor.js';
import { isUINode, isUILoopNode } from '../../codeStrategies/shared/subgraphCollector.js';

// Props 定义
defineOptions({
  inheritAttrs: false
});

const props = defineProps({
  // 代码文件名（用于代码编辑器显示）
  codeFilename: {
    type: String,
    default: 'generated.js'
  },
  codeContent: {
    type: String,
    default: undefined
  },
  backendCodeContent: {
    type: String,
    default: undefined
  },
  hideFooter: {
    type: Boolean,
    default: false
  }
});

// 接收节点实例
const node = defineModel();

// === 计算属性 ===
const nodeId = computed(() => node.value?.id || 'N/A');

const nodeDisplayLabel = computed(() => {
  const n = node.value;
  if (!n) return 'N/A';

  return n.label
    || n.nodeRawData?.label
    || n.nodeRawData?.name
    || n.title
    || n.getTitle?.()
    || n.type
    || n.id
    || 'N/A';
});

// 是否为可视(UI)节点 —— 仅这类节点提供"在 nodeEditor 显示/隐藏"开关
// (UI 节点默认隐藏以减少画布杂乱;逻辑节点常驻可见,无需此开关)
const isVisualNode = computed(() => {
  const n = node.value;
  return !!n && (isUINode(n) || isUILoopNode(n));
});

// 该节点在 nodeEditor 画布是否隐藏(flags.hidden)
const nodeHidden = computed(() => !!node.value?.flags?.hidden);

// 设置显示/隐藏:经 node.value(响应式代理)改 flags.hidden 以保持开关响应式,
// 写穿到底层节点后重绘画布 + 持久化(flags 随 serialize 进入 nodeEditorData)
function setNodeVisible(visible) {
  const n = node.value;
  if (!n) return;
  if (!n.flags) n.flags = {};
  n.flags.hidden = !visible;
  n.graph?.setDirtyCanvas?.(true, true);
  saveNodeEditorData();
}

// 备注
const nodeRemark = computed(() => node.value?.properties?.remark || '');

const hasCode = (code) => typeof code === 'string' && code.trim().length > 0;

// nodeMeta 同时产出前端 jsCode 与后端 bgJsCode；弹窗中分段展示，避免后端代码被覆盖。
// 前端段拼接 importStr + jsRefLines + jsCode,呈现 SFC 内最终拼装的完整片段。
const codeSections = computed(() => {
  const sections = [];
  const frontParts = [
    node.value?.importStr,
    node.value?.jsRefLines,
    node.value?.jsCode,
  ].filter(hasCode);
  const frontCode = frontParts.length ? frontParts.join("\n") : "";
  const backendCode = props.backendCodeContent ?? node.value?.bgJsCode;
  const customCode = props.codeContent;

  const customIsBackend = props.backendCodeContent === undefined && hasCode(backendCode) && customCode !== undefined;

  if (customCode !== undefined && !customIsBackend) {
    sections.push({
      key: 'custom',
      label: '生成代码',
      filename: props.codeFilename,
      value: hasCode(customCode) ? customCode : '// 暂无生成的代码'
    });
  } else if (hasCode(frontCode)) {
    sections.push({
      key: 'frontend',
      label: '前端代码',
      filename: 'frontend.generated.js',
      value: frontCode
    });
  }

  const resolvedBackendCode = customIsBackend ? customCode : backendCode;
  if (hasCode(resolvedBackendCode) && resolvedBackendCode !== frontCode) {
    sections.push({
      key: 'backend',
      label: '后端代码',
      filename: 'backend.generated.js',
      value: resolvedBackendCode
    });
  }

  if (sections.length === 0) {
    sections.push({
      key: 'empty',
      label: '生成代码',
      filename: props.codeFilename,
      value: '// 暂无生成的代码'
    });
  }

  return sections;
});

// 帮助文档配置：优先使用 meta.docs，兼容旧的 meta.docsUrl
const docsConfig = computed(() => {
  const meta = node.value?.nodeRawData?.meta || {};
  if (meta.docs && typeof meta.docs === 'object') {
    return meta.docs;
  }
  if (meta.docsUrl) {
    return { title: '组件 API 文档', url: meta.docsUrl, component: 'api' };
  }
  if (node.value?.docs && typeof node.value.docs === 'object') {
    return node.value.docs;
  }
  return null;
});

const hasDocs = computed(() => {
  const docs = docsConfig.value;
  return !!(docs?.text || docs?.url || docs?.component);
});

// 调试模式:节点 __debugMode 单选,off / trace / breakpoint / log
const debugMode = computed(() => node.value?.properties?.__debugMode || 'off');

// 全局 UI 白名单(响应式 ref,由 initProj 兜底初始化为全 true;无 UI 配置入口,如需覆写直接改 graph.extra.__debugModesVisible 序列化字段)
// 显示规则:全局允许显示该 mode OR 节点正处于该 mode(节点优先,已选模式不会消失)
function isModeVisible(mode) {
  const globalAllow = debugModesVisible.value[mode] !== false;
  const nodeUsing = debugMode.value === mode;
  return globalAllow || nodeUsing;
}

function toggleDebugMode(mode) {
  if (!node.value) return;
  if (!node.value.properties) node.value.properties = {};
  // 互斥单选:点同色 toggle 清回 'off',点新模式切换过去
  node.value.properties.__debugMode = debugMode.value === mode ? 'off' : mode;
  // 触发 setupPropertiesWatch 的 deep watch → debouncedRunStep 重新生成代码
  node.value.graph?.setDirtyCanvas?.(true, true);
}

// === 状态 ===
const showJsCodeDialog = ref(false);
const showDocDialog = ref(false);

// === 方法 ===
// 复制节点 ID
const copyNodeId = async () => {
  const id = nodeId.value;
  if (id === 'N/A') return;

  try {
    await copyToClipboard(id);
    Notify.create({
      type: 'positive',
      message: '节点 ID 已复制',
      position: 'top',
      timeout: 1500
    });
  } catch (error) {
    Notify.create({
      type: 'negative',
      message: '复制失败',
      position: 'top',
      timeout: 1500
    });
  }
};

// 更新备注
function updateRemark(value) {
  if (!node.value) return;

  if (!node.value.properties) {
    node.value.properties = {};
  }

  set(node.value.properties, 'remark', value);
  node.value.graph?.setDirtyCanvas?.(true, true);
}
</script>

<style scoped>
.base-property-panel {
  width: 100%;
  height: 100%;
  min-height: 0;
  overflow: hidden;
  flex-wrap: nowrap;
}

.base-property-content {
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  flex: 1 1 0;
  width: 100%;
}

.node-id-display {
  cursor: pointer;
  user-select: none;
}

.slot-value-container {
  flex: 0 0 auto;
  max-height: 40vh;
  overflow-y: auto;
  overflow-x: hidden;
}

.js-code-dialog {
  width: 96vw;
  max-width: 96vw;
  height: 88vh;
  max-height: 88vh;
}

.js-code-dialog__body {
  min-width: 0;
  min-height: 0;
  overflow: hidden;
}

.js-code-dialog__sections {
  min-width: 0;
  height: 100%;
  min-height: 0;
  gap: 12px;
}

.js-code-section {
  min-width: 0;
  min-height: 180px;
  flex: 1 1 0;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
  background: #1e1e1e;
}

.js-code-section__header {
  min-width: 0;
  padding: 6px 8px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  background: rgba(255, 255, 255, 0.04);
}

.js-code-section__editor {
  min-width: 0;
  min-height: 0;
  flex: 1 1 0;
  overflow: hidden;
}
</style>
