<template>
  <div class="column full-height">
    <!-- 模式切换 -->
    <div class="row items-center q-pa-xs bg-grey-10">
      <q-btn-toggle
        v-model="logicType"
        flat
        dense
        toggle-color="primary"
        :options="[
          { label: '代码模式', value: 'code' },
          { label: '图形模式', value: 'graph' },
        ]"
        @update:model-value="handleModeChange"
      />
      <q-space />
      <q-btn v-if="logicType === 'code'" flat dense icon="content_copy" @click="copyCode">
        <q-tooltip>复制代码</q-tooltip>
      </q-btn>
      <q-btn v-if="logicType === 'code'" flat dense icon="format_indent_increase" @click="formatCode">
        <q-tooltip>格式化</q-tooltip>
      </q-btn>
    </div>

    <q-separator dark />

    <!-- 代码编辑器 -->
    <div v-show="logicType === 'code'" class="col">
      <div ref="codeEditorContainer" class="full-height" />
    </div>

    <!-- 图形编辑器 -->
    <div v-show="logicType === 'graph'" class="col column">
      <div class="q-pa-md text-grey-6 text-center">
        <q-icon name="account_tree" size="64px" color="grey-8" />
        <div class="q-mt-md">图形编排模式</div>
        <div class="text-caption q-mt-sm">
          图形编排将使用 LiteGraph 节点编辑器
        </div>
        <q-btn
          flat
          color="primary"
          class="q-mt-md"
          label="打开图形编辑器"
          @click="openGraphEditor"
        />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, watch, onMounted, onBeforeUnmount, nextTick } from "vue";
import { copyToClipboard, Notify } from "quasar";

const props = defineProps({
  item: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(['update']);

// 编辑器容器
const codeEditorContainer = ref(null);
let monacoEditor = null;

// 逻辑类型
const logicType = ref(props.item.logicType || 'code');

// 当前代码
const currentCode = ref(props.item.code || '');

// 初始化 Monaco 编辑器
const initMonacoEditor = async () => {
  if (!codeEditorContainer.value) return;

  // 动态导入 Monaco
  const monaco = await import('monaco-editor-core');

  // 创建编辑器
  monacoEditor = monaco.editor.create(codeEditorContainer.value, {
    value: currentCode.value,
    language: 'javascript',
    theme: 'vs-dark',
    automaticLayout: true,
    minimap: { enabled: false },
    fontSize: 13,
    lineNumbers: 'on',
    folding: true,
    wordWrap: 'on',
    tabSize: 2,
    insertSpaces: true,
  });

  // 监听内容变化
  monacoEditor.onDidChangeModelContent(() => {
    const value = monacoEditor.getValue();
    currentCode.value = value;
    emit('update', {
      logicType: 'code',
      code: value,
    });
  });
};

// 销毁编辑器
const destroyMonacoEditor = () => {
  if (monacoEditor) {
    monacoEditor.dispose();
    monacoEditor = null;
  }
};

// 监听 item 变化
watch(() => props.item, (newItem) => {
  logicType.value = newItem.logicType || 'code';
  currentCode.value = newItem.code || '';

  if (monacoEditor && logicType.value === 'code') {
    const currentValue = monacoEditor.getValue();
    if (currentValue !== currentCode.value) {
      monacoEditor.setValue(currentCode.value);
    }
  }
}, { deep: true });

// 模式切换
const handleModeChange = (newMode) => {
  emit('update', {
    logicType: newMode,
    code: currentCode.value,
    graphData: props.item.graphData,
  });
};

// 复制代码
const copyCode = () => {
  const code = monacoEditor?.getValue() || currentCode.value;
  copyToClipboard(code);
  Notify.create({ type: 'positive', message: '代码已复制' });
};

// 格式化代码
const formatCode = () => {
  if (monacoEditor) {
    monacoEditor.getAction('editor.action.formatDocument')?.run();
  }
};

// 打开图形编辑器
const openGraphEditor = () => {
  // TODO: 实现图形编辑器打开逻辑
  Notify.create({ type: 'info', message: '图形编辑器功能开发中' });
};

onMounted(async () => {
  await nextTick();
  if (logicType.value === 'code') {
    initMonacoEditor();
  }
});

onBeforeUnmount(() => {
  destroyMonacoEditor();
});

// 监听模式变化，初始化或销毁编辑器
watch(logicType, async (newMode) => {
  if (newMode === 'code') {
    await nextTick();
    if (!monacoEditor) {
      initMonacoEditor();
    }
  }
});
</script>
