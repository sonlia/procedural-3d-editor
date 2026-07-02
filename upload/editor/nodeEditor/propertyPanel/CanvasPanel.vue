<template>
  <BasePropertyPanel v-model="selectNode" code-filename="canvas-settings.json" class="canvas-panel" hide-footer>
    <template #header>
      <q-card dark flat class="q-mb-sm">
        <q-card-section class="q-pa-sm">
          <div class="text-h6">画布设置</div>
          <div class="text-caption text-grey-6">管理全局样式和作用域样式</div>
        </q-card-section>
      </q-card>
    </template>

    <div class="canvas-body">
      <!-- 仅 UI 组件文件显示 tab 切换;其它类型只有画布设置 -->
      <template v-if="isVueComponent">
        <q-tabs v-model="activeTab" dense inline-label class="text-grey-5 col-auto" active-color="primary"
          indicator-color="primary" :breakpoint="0">
          <q-tab name="canvas" label="画布设置" no-caps />
          <q-tab name="component" label="组件属性" no-caps />
        </q-tabs>
        <q-separator dark />
      </template>

      <!-- 画布设置:非 UI 组件文件常显;UI 组件文件按 tab 切换 -->
      <div v-show="!isVueComponent || activeTab === 'canvas'" class="canvas-content-scroll">
        <div class="column q-pa-sm q-gutter-y-sm">
          <!-- Store 名称设置（仅 piniaStore 策略显示）-->
          <q-card v-if="isPiniaStore" dark flat bordered>
            <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="storage" size="sm" class="q-mr-sm" />
                <div class="text-subtitle1">Store 名称</div>
              </div>
              <div class="text-caption text-grey-6 q-mb-md">
                定义 Pinia Store 的名称，生成 useXxxStore
              </div>
              <q-input v-model="storeName" dark dense outlined placeholder="例如: project"
                @update:model-value="saveStoreName">
                <template #prepend>
                  <span class="text-grey-6">use</span>
                </template>
                <template #append>
                  <span class="text-grey-6">Store</span>
                </template>
              </q-input>
              <div class="text-caption text-grey-6 q-mt-xs">
                预览: use{{ storeNamePascal }}Store
              </div>
            </q-card-section>
          </q-card>

          <!-- 全局 CSS -->
          <q-card dark flat bordered>
            <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="public" size="sm" class="q-mr-sm" />
                <div class="text-subtitle1">全局 CSS</div>
              </div>
              <div class="text-caption text-grey-6 q-mb-md">
                应用于整个项目的全局样式
              </div>
              <q-btn dense unelevated color="primary" label="编辑全局样式" icon="edit" @click="editGlobalStyle"
                class="full-width" />
              <div v-if="globalStylePreview" class="q-mt-sm code-preview">
                <div class="text-caption text-grey-6 q-mb-xs">预览:</div>
                <pre class="text-caption">{{ globalStylePreview }}</pre>
              </div>
            </q-card-section>
          </q-card>

          <!-- 作用域 CSS -->
          <q-card dark flat bordered>
            <q-card-section>
              <div class="row items-center q-mb-sm">
                <q-icon name="dashboard" size="sm" class="q-mr-sm" />
                <div class="text-subtitle1">作用域 CSS</div>
              </div>
              <div class="text-caption text-grey-6 q-mb-md">
                仅应用于当前画布的样式 (ID: {{ canvasId }})
              </div>
              <q-btn dense unelevated color="secondary" label="编辑作用域样式" icon="edit" @click="editScopedStyle"
                class="full-width" />
              <div v-if="scopedStylePreview" class="q-mt-sm code-preview">
                <div class="text-caption text-grey-6 q-mb-xs">预览:</div>
                <pre class="text-caption">{{ scopedStylePreview }}</pre>
              </div>
            </q-card-section>
          </q-card>
        </div>
      </div>

      <!-- 组件对外 props/emits 接口:仅 UI 组件文件 -->
      <div v-if="isVueComponent" v-show="activeTab === 'component'" class="canvas-content-scroll">
        <ComponentInterfacePanel :graph="activeGraph" />
      </div>
    </div>

    <!-- 全局样式编辑对话框 -->
    <q-dialog v-model="showGlobalStyleDialog" persistent>
      <q-card dark style="min-width: 600px; max-width: 90vw;">
        <q-card-section class="row items-center">
          <div class="text-h6">编辑全局 CSS</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section style="height: 400px;">
          <codeEditorSrc :value="globalStyleTemp" @change="globalStyleTemp = $event" lang="css" filename="global.css"
            :readonly="false" />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" v-close-popup />
          <q-btn unelevated color="primary" label="保存" @click="saveGlobalStyle" />
        </q-card-actions>
      </q-card>
    </q-dialog>

    <!-- 作用域样式编辑对话框 -->
    <q-dialog v-model="showScopedStyleDialog" persistent>
      <q-card dark style="min-width: 600px; max-width: 90vw;">
        <q-card-section class="row items-center">
          <div class="text-h6">编辑作用域 CSS</div>
          <q-space />
          <q-btn icon="close" flat round dense v-close-popup />
        </q-card-section>

        <q-card-section style="height: 400px;">
          <codeEditorSrc :value="scopedStyleTemp" @change="scopedStyleTemp = $event" lang="css" filename="scoped.css"
            :readonly="false" />
        </q-card-section>

        <q-card-actions align="right">
          <q-btn flat label="取消" v-close-popup />
          <q-btn unelevated color="secondary" label="保存" @click="saveScopedStyle" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </BasePropertyPanel>
</template>

<script setup>
import { ref, computed, watch } from 'vue';
import { useProjectStore } from 'src/stores/projectMange.js';
import BasePropertyPanel from './BasePropertyPanel.vue';
import ComponentInterfacePanel from './ComponentInterfacePanel.vue';
import codeEditorSrc from '../../codeEditor/CodeMirror/CodeMirror..vue';
import { Notify } from 'quasar';
import { currentFileType } from 'src/components/leftWidget/folder/useFileTree.js';

// 接收选中的节点（画布对象）
const selectNode = defineModel();

// 项目 Store
const projectStore = useProjectStore();

// 当前画布ID（对应 currentSelect）
const canvasId = computed(() => projectStore.getCurrentSelect());

// 是否为 UI 组件文件(vueComponent 策略)——决定是否显示"组件属性" tab
const isVueComponent = computed(() =>
  currentFileType.value?.codeStrategy === 'vueComponent'
);

// 当前 tab(canvas=画布设置 / component=组件属性)
const activeTab = ref('canvas');

// ==================== Store 名称（piniaStore 策略） ====================

// 判断是否是 piniaStore 策略
const isPiniaStore = computed(() =>
  currentFileType.value?.codeStrategy === 'piniaStore'
);

// storeName 响应式
const storeName = ref('');

// 转换为 PascalCase
const storeNamePascal = computed(() =>
  storeName.value.replace(/(^|[-_])(\w)/g, (_, __, c) => c.toUpperCase()) || 'Example'
);

const activeGraph = computed(() => selectNode.value?.graph || window._graph || null);

// 初始化时从 graph.extra 读取。window._graph 不是响应式对象，所以优先依赖画布选中对象携带的 graph。
watch(activeGraph, (graph) => {
  storeName.value = graph?.extra?.storeName || '';
}, { immediate: true });

// 保存到 graph.extra
const saveStoreName = (value) => {
  const graph = activeGraph.value;
  if (!graph) return;
  graph.extra = graph.extra || {};
  graph.extra.storeName = value;
};

// 全局样式
const globalStyle = computed(() => projectStore.getGlobalStyle());
const globalStylePreview = computed(() => {
  const style = globalStyle.value;
  return style ? style.substring(0, 100) + (style.length > 100 ? '...' : '') : '';
});

// 作用域样式
const scopedStyle = computed(() => projectStore.getStyle());
const scopedStylePreview = computed(() => {
  const style = scopedStyle.value;
  return style ? style.substring(0, 100) + (style.length > 100 ? '...' : '') : '';
});

// 对话框状态
const showGlobalStyleDialog = ref(false);
const showScopedStyleDialog = ref(false);

// 临时样式内容
const globalStyleTemp = ref('');
const scopedStyleTemp = ref('');

// 编辑全局样式
const editGlobalStyle = () => {
  globalStyleTemp.value = globalStyle.value;
  showGlobalStyleDialog.value = true;
};

// 编辑作用域样式
const editScopedStyle = () => {
  scopedStyleTemp.value = scopedStyle.value;
  showScopedStyleDialog.value = true;
};

// 保存全局样式
const saveGlobalStyle = () => {
  console.log('[CanvasPanel] 保存全局样式:', globalStyleTemp.value);
  projectStore.setGlobalStyle(globalStyleTemp.value);
  console.log('[CanvasPanel] 保存后读取:', projectStore.getGlobalStyle());
  showGlobalStyleDialog.value = false;
  Notify.create({
    type: 'positive',
    message: '全局样式已保存',
    position: 'top',
    timeout: 1500
  });
};

// 保存作用域样式
const saveScopedStyle = () => {
  console.log('[CanvasPanel] 保存作用域样式:', scopedStyleTemp.value);
  console.log('[CanvasPanel] 当前画布ID:', canvasId.value);
  projectStore.setStyle(scopedStyleTemp.value);
  console.log('[CanvasPanel] 保存后读取:', projectStore.getStyle());
  showScopedStyleDialog.value = false;
  Notify.create({
    type: 'positive',
    message: '作用域样式已保存',
    position: 'top',
    timeout: 1500
  });
};
</script>

<style scoped>
.canvas-panel {
  height: 100%;
  display: flex;
  flex-direction: column;
}

/* 让 BasePropertyPanel 内部使用 flex 布局 */
.canvas-panel :deep(.base-property-content) {
  display: flex;
  flex-direction: column;
  overflow: hidden;
  min-height: 0;
}

/* tab + 滚动区容器，撑满剩余高度。
   显式 flex 列布局(不用 Quasar .column,后者带 flex-wrap:wrap 会把列内子项换列、压塌 q-scroll-area 高度) */
.canvas-body {
  flex: 1 1 0;
  min-height: 0;

  flex-direction: column;
  flex-wrap: nowrap;
}

/* 原先使用 q-scroll-area,隐藏切换和 flex 高度推导下会出现内容区高度为 0。 */
.canvas-content-scroll {
  flex: 1 1 0;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
}

.code-preview {
  background-color: rgba(0, 0, 0, 0.2);
  border-radius: 4px;
  padding: 8px;
  max-height: 100px;
  overflow: auto;
}

.code-preview pre {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-all;
  color: rgba(255, 255, 255, 0.7);
  font-family: monospace;
}
</style>
