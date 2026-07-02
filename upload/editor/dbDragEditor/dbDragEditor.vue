<template>
  <div class="db-drag-editor-container">
    <!-- 节点画布 / SQL 编辑器(视图/列计算时替换画布) -->
    <div class="editor-canvas">
      <div id="graphCanvas" ref="graphCanvasWrap" v-show="!isSqlEditMode" style="width: 100%; height: 100%">
        <canvas
          ref="graphCanvas"
          @contextmenu.prevent
          class="graph-canvas"
        ></canvas>
      </div>
      <component
        :is="fullCanvasEditor"
        v-if="isSqlEditMode"
        :node="currentSelectTreeNode"
        class="db-sql-editor-fill"
      />
    </div>

    <!-- 侧边栏属性面板:仅当选中节点有对应面板时显示。
         SQL 编辑模式(视图/物化视图/列计算/函数/存储过程/定时任务)由全画布编辑器占满,隐藏侧栏;
         目录/库根/各类分类 root 节点无配置(selectedDbComponent 为空)→ 不渲染侧栏。 -->
    <div v-if="!isSqlEditMode && selectedDbComponent" class="property-panel">
      <component :is="selectedDbComponent" />
    </div>
  </div>
</template>

<script setup>
import {
  ref,
  onMounted,
  defineAsyncComponent,
  computed,
  watch,
  nextTick,
  onBeforeUnmount,
} from "vue";
import { useResizeObserver } from "@vueuse/core";

import {
  graphIns,
  canvasIns,
  useGraphEditor,
} from "./hooks/useDbGraphEditor.js";
import {
  useDbConfig,
  currentSelectTreeNode,
} from "./hooks/useDbConfig";
import { dbTreeManager } from "./hooks/useDbTreeManager";
import { useProjectStore } from "../../../stores/projectMange.js";
import DbSqlEditor from "./DbSqlEditor.vue";
import DbScheduledTaskEditor from "./DbScheduledTaskEditor.vue";
import DbProcedurePanel from "./dbProcedurePanel.vue";

import _ from "lodash-es";

const mapDbComponent = {
  table: defineAsyncComponent(() => import("./dbTablePanel.vue")),
  field: defineAsyncComponent(() => import("./dbFieldsPanel.vue")),
  dbbase: defineAsyncComponent(() => import("./dbDatabasePanel.vue")),
  view: defineAsyncComponent(() => import("./dbViewPanel.vue")),
  materialized_view: defineAsyncComponent(() => import("./dbViewPanel.vue")),
  computed_column: defineAsyncComponent(() => import("./dbComputedPanel.vue")),
  redis: defineAsyncComponent(() => import("./dbRedisConfigPanel.vue")),
};

const graphCanvas = ref(null);
const graphCanvasWrap = ref(null);

const graphEditor = useGraphEditor();

const dbConfig = useDbConfig();

// 当前选中表的类型组件
const selectedDbComponent = computed(() => {
  return mapDbComponent[currentSelectTreeNode.value?.type];
});

// 全画布编辑器(替换画布区、隐藏侧栏)及其对应组件
const fullCanvasEditor = computed(() => {
  const t = currentSelectTreeNode.value?.type;
  if (["view", "materialized_view", "computed_column"].includes(t)) return DbSqlEditor;
  if (t === "scheduled_task") return DbScheduledTaskEditor;
  if (["procedure", "function"].includes(t)) return DbProcedurePanel;
  return null;
});
const isSqlEditMode = computed(() => !!fullCanvasEditor.value);

// 从 SQL 编辑器切回画布时,画布在隐藏期间尺寸为 0,需要重新 resize
watch(isSqlEditMode, (sqlMode) => {
  if (!sqlMode && canvasIns.value) {
    nextTick(() => canvasIns.value.resize());
  }
});

// 画布容器尺寸变化(分隔条收起/展开、属性面板显隐)时重算 LiteGraph 画布尺寸。
// litegraph 的 autoresize 仅在鼠标移动时触发,不感知容器布局变化,故显式监听容器尺寸。
// (隐藏期间容器 0 尺寸,跳过避免把画布缩成 0。)
useResizeObserver(graphCanvasWrap, (entries) => {
  const { width, height } = entries[0].contentRect;
  if (width > 0 && height > 0 && canvasIns.value) {
    canvasIns.value.resize();
  }
});

// 监听窗口大小变化
const handleWindowResize = _.debounce(() => {
  if (graphIns.value) {
    canvasIns.value.resize();
  }
}, 300);

onMounted(async () => {
  // 初始化图形编辑器
  graphEditor.initGraph(graphCanvas.value);

  // 禁止 Delete 键删除节点（DB 节点只能通过树面板删除）
  canvasIns.value.deleteSelectedNodes = function () {};

  // 恢复上次选中的数据库节点的 graph
  const _project = useProjectStore();
  const lastSelect = _project.getDbCurrentSelect();
  if (lastSelect) {
    const manager = dbTreeManager();
    const node = manager.findNode(lastSelect);
    if (node) {
      dbConfig.selectNode(node);
    }
  }

  // 添加窗口大小变化监听
  window.addEventListener("resize", handleWindowResize);
});

onBeforeUnmount(() => {
  // 移除事件监听
  window.removeEventListener("resize", handleWindowResize);
});
</script>

<style>
.db-drag-editor-container {
  display: flex;
  flex-direction: row;
  height: 100%;
  background-color: var(--q-dark);
  position: relative;
}

.db-drag-editor-container .editor-canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
}

.db-drag-editor-container .editor-canvas .graph-canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.db-drag-editor-container .editor-canvas .db-sql-editor-fill {
  position: absolute;
  inset: 0;
}

.db-drag-editor-container .property-panel {
  width: 300px;
  border-left: 1px solid rgba(255, 255, 255, 0.1);
  background-color: var(--q-dark);
  display: flex;
  flex-direction: column;
}

.db-drag-editor-container .property-panel .panel-content {
  flex: 1;
  overflow-y: auto;
}

.db-drag-editor-container .no-selection-message {
  padding: 16px;
  color: rgba(255, 255, 255, 0.7);
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
