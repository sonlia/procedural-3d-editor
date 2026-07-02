<template>
  <div class="column fit">
    <q-bar dark class="bg-grey-10 z-max row col-auto ">
      <q-btn dark dense flat label="节点树" text-color="grey-7" :color="showGraphNodesTree ? 'cyan-8' : ''"
        @click="showGraphNodesTree = !showGraphNodesTree" class="q-ma-xs  q-pr-lg" />
      <q-btn dark dense flat label="代码预览" text-color="grey-7" @click="displayEditor = !displayEditor" class="q-ma-xs" />
      <template v-if="!displayEditor">

        <q-btn dark dense flat label="居中显示" text-color="grey-7" @click="resetCanvas" class="q-ma-xs" />
        <q-btn dark dense flat label="编辑器全屏" text-color="grey-7" @click="fullScreen" class="q-ma-xs" />
        <q-btn dark dense flat label="开始" text-color="grey-7" @click="start()" />
        <q-btn dark dense flat label="间隔运行" text-color="grey-7" @click="start(5000)" class="q-ma-xs" />
        <q-btn dark dense flat label="停止" text-color="grey-7" @click="stop" class="q-ma-xs" />
        <q-separator dark vertical inset class="q-mx-xs" />
        <!-- 面包屑导航 -->
        <q-breadcrumbs dark separator=">" separator-color="grey-7" class="text-caption">
          <q-breadcrumbs-el dense label="Root" icon="home" class="cursor-pointer text-caption"
            :class="graphPath.length === 0 ? 'text-primary' : 'text-grey-6'" style="font-size: 11px;"
            @click="navigateToGraphLevel(-1)">
          </q-breadcrumbs-el>
          <q-breadcrumbs-el v-for="(item, index) in graphPath" :key="item.id" :label="item.title"
            class="cursor-pointer text-caption" :class="index === graphPath.length - 1 ? 'text-primary' : 'text-grey-6'"
            style="font-size: 11px;" dense @click="navigateToGraphLevel(index)" />
        </q-breadcrumbs>
      </template>
    </q-bar>
    <div class="col relative-position row no-wrap">
      <!-- Graph节点树面板 -->
      <graphNodesTree v-if="showGraphNodesTree" />


      <q-splitter v-show="!displayEditor" v-model="splitterModel" :limits="splitterLimits" reverse dark class="col">
        <template v-slot:before>
          <div ref="editorCanvas" class="litegraph-editor">
            <canvas ref="canvasRef" class="lgraphcanvas" />
            <q-resize-observer @resize="onResize" />
            <indexWidget v-if="showTabMenu" :style="menuPosition" :data="searchTreeData"
              @nodeSelected="handleSearchNodeSelected" @hide="showTabMenu = false" />
          </div>
        </template>
        <template v-slot:after>
          <div class="bg-grey-10 column fit">
            <template v-if="selectNode">
              <!-- 节点的 uiPanel 缺失时显示警告 -->
              <div v-if="!selectNode.uiPanel" class="q-pa-md text-center">
                <q-icon name="warning" color="warning" size="md" class="q-mb-sm" />
                <div class="text-warning text-body2">属性面板加载失败</div>
                <div class="text-grey-6 text-caption q-mt-xs">节点类型: {{ selectNode.type }}</div>
                <div class="text-grey-7 text-caption q-mt-sm">可能原因：节点类型未正确注册</div>
              </div>
              <Suspense v-else>
                <component :is="selectNode.uiPanel" v-model="selectNode" :key="selectNode.id" class="fit" />
                <template #fallback>
                  <div class="q-pa-md text-center">加载面板中...</div>
                </template>
              </Suspense>
            </template>
            <BackendFileConfigPanel v-else-if="isBackendFile" />
            <div v-else class="q-pa-md text-center text-grey-6">未选择节点</div>

          </div>
        </template>
      </q-splitter>
      <codeEditorSrc v-show="displayEditor" class="col" :value="graphJsCode" :readonly="false" lang="javascript"
        filename="graph.js" @change="updateGraphJsCode" />
    </div>
  </div>
</template>

<script setup>
// ==================== 导入：Vue 核心 ====================
import { computed, onMounted, ref, Suspense, toRef, watch } from "vue";

// ==================== 导入：第三方库 ====================
import "litegraph.js/css/litegraph.css";
import { useDebounceFn } from "@vueuse/core";

// ==================== 导入：项目内部 ====================
import { useProjectStore, useProjectMangerStore } from "src/stores/projectMange.js";
import { selectNodeById } from "src/components/editor/dragEditor/preview/previewUtils.js";
import indexWidget from "../../../searchWidget/indexWidget.vue";
import codeEditorSrc from "../../codeEditor/CodeMirror/CodeMirror..vue";
import { showGraphNodesTree } from "src/components/editor/dragEditor/composables/useSimpleInteraction.js";
import graphNodesTree from "./graphNodesTree.vue";
import BackendFileConfigPanel from "src/components/editor/backendEditor/BackendFileConfigPanel.vue";
import {
  createIns,
  initProj,
  onResize,
  resetCanvas,
  addNodes,
  start,
  stop,
  graphNodesForSearchData,
  selectNode,
  selectNodeCounter,
  showTabMenu,
  tabMenuPosition,
  graphJsCode,
  initRegister,
  runStep,
  onNodeStructureChange,
  updateGraphJsCode,
  graphPath,
  navigateToGraphLevel,
  getNodeConf,
} from "src/components/editor/nodeEditor/composables/useLitegraphEditor.js";
import { isUINode, isUILoopNode } from "../../codeStrategies/shared/subgraphCollector.js";
import { removeDragEditor } from "../../dragEditor/preview/previewUtils.js";
import { useComponentPermissionSync } from "../../dragEditor/components/permissionManager/composables/useComponentPermissionSync.js";
import { useDebugTrace } from "src/composables/useDebugTrace.js";

// ==================== Store ====================
const _project = useProjectStore();
const _projectManger = useProjectMangerStore();

// ==================== Props ====================
const props = defineProps({
  splitterConfig: {
    type: Object,
    default: () => ({ model: 40, limits: [25, 55] })
  },
  // 场景节点范围(category 主轴 + treePath 细分);null=显示全部节点
  nodeScope: {
    type: Object,
    default: null
  }
});

// ==================== Refs ====================
const canvasRef = ref();
const editorCanvas = ref();
const splitterModel = toRef(props.splitterConfig, 'model');
const splitterLimits = toRef(props.splitterConfig, 'limits');
const displayEditor = ref(false);
const searchTreeData = ref([]);

// ==================== Debug Trace SSE 订阅 ====================
const debugTrace = useDebugTrace();

// ==================== 组件权限同步(级联清理) ====================
const { removeComponentResources } = useComponentPermissionSync();

// ==================== 内部状态 ====================
let graph = null;

// ==================== Computed ====================


const isBackendFile = computed(() => {
  const currentSelect = _project.getCurrentSelect();
  const node = (_project.getBackendTreeData() || []).find((item) => item.id === currentSelect);
  return ["serviceGraph", "serviceCode", "functionGraph", "functionCode"].includes(node?.templateType);
});

const menuPosition = computed(() => ({
  position: 'fixed',
  top: tabMenuPosition.value.y + 'px',
  left: tabMenuPosition.value.x + 'px',
  zIndex: 9999
}));

// ==================== 方法 ====================
function fullScreen() {
  if (editorCanvas.value.requestFullscreen) {
    editorCanvas.value.requestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
  } else if (editorCanvas.value.mozRequestFullscreen) {
    editorCanvas.value.requestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
  } else if (editorCanvas.value.webkitRequestFullscreen) {
    editorCanvas.value.webkitRequestFullscreen(Element.ALLOW_KEYBOARD_INPUT);
  }
  setTimeout(() => onResize(), 500);
}

const handleSearchNodeSelected = (nodeType) => {
  addNodes({ type: nodeType }, false, tabMenuPosition.value);
};

// 保存数据并同步到项目存储（防抖版本，用于属性变化）
const debouncedSaveData = useDebounceFn(() => {
  if (!graph) return;
  runStep();
}, 150);

// ==================== 生命周期 ====================
onMounted(() => {
  const { graph: createGraph } = createIns(canvasRef);
  graph = createGraph;

  // 注册所有节点类型
  initRegister();

  // 绑定图结构变化事件（添加/删除/连接）→ 触发 nodeEditorData 更新
  graph.onNodeAdded = onNodeStructureChange;
  graph.onNodeConnectionChange = onNodeStructureChange;
  graph.onNodeRemoved = (node) => {
    onNodeStructureChange();
    // UI 节点从 dragEditor 删除
    if (isUINode(node) || isUILoopNode(node)) {
      removeDragEditor(node.id);
    }
    // 级联清理组件「增强 → 权限配置」拥有的资源行
    // 注:configure() 加载/重配时会先置空 onNodeRemoved 再 clear,批量清空不会走到这里
    const pcId = node?.properties?.enhance?.permissionConfig?.id;
    if (pcId) {
      removeComponentResources(pcId);
    }
  };

  // 🔥 标记组件已 mounted，graph 已初始化
  isMounted = true;

  // 🔥 尝试初始化项目数据（如果后端数据已加载完成）
  safeInitProj();
});

// ==================== Watchers ====================
// 🔥 用于防止重复初始化的标志
let lastInitKey = null;
// 🔥 标记组件是否已 mounted（graph 是否已初始化）
let isMounted = false;

// 🔥 统一的初始化函数，避免重复初始化
function safeInitProj() {
  // 必须等待组件 mounted（graph 初始化完成）
  if (!isMounted) {
    console.log("📡 [litegraphEditor] 组件未 mounted，跳过初始化");
    return;
  }

  // 必须等待后端数据加载完成
  if (!_projectManger.isInitialized) {
    console.log("📡 [litegraphEditor] 后端数据未加载完成，跳过初始化");
    return;
  }

  // 🔥 使用正确的路径获取 currentSelect
  const currentSelect = _project.getCurrentSelect();

  // 生成当前状态的唯一标识，避免重复初始化
  const currentKey = `${_projectManger.currentProjectId}-${currentSelect}`;
  if (currentKey === lastInitKey) {
    console.log("📡 [litegraphEditor] 状态未变化，跳过重复初始化");
    return;
  }

  lastInitKey = currentKey;
  console.log("📡 [litegraphEditor] 执行初始化:", currentKey);
  initProj();
}

// 🔥 监听项目切换，重新初始化
watch(
  () => _projectManger.currentProjectId,
  (newId, oldId) => {
    console.log("📡 [litegraphEditor] 项目切换，重新初始化");
    lastInitKey = null; // 重置标志，强制重新初始化
    if (oldId) debugTrace.unsubscribe();
    if (newId) debugTrace.subscribe(newId);
    safeInitProj();
  },
  { immediate: true }
);

// 监听节点选择变化，同步到 dragEditor 预览
watch(selectNodeCounter, () => {
  if (selectNode.value?.id) {
    selectNodeById(selectNode.value.id);
  }
});

// 监听搜索菜单显示状态，动态加载搜索数据
watch(showTabMenu, (newVal) => {
  if (newVal) {
    searchTreeData.value = graphNodesForSearchData(props.nodeScope);
  }
});

// 🔥 监听文件切换，重新初始化（使用正确的路径）
watch(
  () => _project.getCurrentSelect(),
  (newSelect, oldSelect) => {
    if (newSelect !== oldSelect) {
      console.log("📡 [litegraphEditor] 文件切换:", oldSelect, "->", newSelect);
      safeInitProj();
    }
  }
);

// 🔥 监听文件树数据变化，确保节点类型正确注册
watch(
  () => _project.getTreeData(),
  (newTreeData, oldTreeData) => {
    // 只在 treeData 真正变化时才重新注册（避免初始化时重复触发）
    if (newTreeData && newTreeData.length > 0 && JSON.stringify(newTreeData) !== JSON.stringify(oldTreeData)) {
      console.log("📁 [litegraphEditor] treeData 更新，重新注册节点类型");
      initRegister();
      lastInitKey = null; // 重置标志，强制重新初始化
      safeInitProj();
    }
  },
  { deep: true }
);

// 监听节点属性变化，自动保存（使用防抖避免频繁触发）
watch(
  () => selectNode?.value?.properties,
  (value) => {
    if (value) {
      debouncedSaveData();
      selectNodeById(selectNode.value.id);
    }
  },
  { deep: true }
);
</script>

<style scoped></style>

<style>
.litegraph-editor {
  width: 100%;
  height: 100%;
  margin: 0;
  padding: 0;
  background-color: #333;
  color: #eee;
  font: 14px Tahoma;
  position: relative;
  overflow: hidden;
}

.lgraphcanvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.graphcanvas {
  touch-action: pinch-zoom;
}

.litecontextmenu .litemenubar-panel {
  z-index: 2000;
}

.litegraph-editor h1 {
  font-family: "Metro Light", Tahoma;
  color: #ddd;
  font-size: 28px;
  padding-left: 10px;
  margin: 0;
  font-weight: normal;
}

.litegraph-editor h1 span {
  font-family: "Arial";
  font-size: 14px;
  font-weight: normal;
  color: #aaa;
}

.litegraph-editor h2 {
  font-family: "Metro Light";
  padding: 5px;
  margin-left: 10px;
}

.litegraph-editor * {
  box-sizing: border-box;
  -moz-box-sizing: border-box;
}

.litegraph .graphdialog {
  display: flex;
  align-items: center;
  border-radius: 20px;
  padding: 4px 10px;
  position: absolute;
}
</style>
