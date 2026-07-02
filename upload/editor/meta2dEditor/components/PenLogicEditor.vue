<template>
  <q-dialog v-model="showDialog" maximized persistent @show="initGraph" @hide="destroyGraph">
    <q-card dark class="column fit">
      <q-bar dark class="bg-grey-9">
        <span>{{ title }}</span>
        <q-space />
        <q-btn dark dense flat icon="close" @click="close" />
      </q-bar>

      <q-card-section class="col q-pa-none relative-position">
        <!-- LiteGraph 画布 -->
        <canvas ref="canvasRef" class="fit litegraph-canvas" />
        <q-resize-observer @resize="onResize" />
      </q-card-section>

      <q-card-actions align="right" class="bg-grey-9">
        <q-btn dark dense flat label="取消" @click="close" />
        <q-btn dark dense flat label="应用" color="primary" @click="apply" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script setup>
import { ref, watch, onBeforeUnmount } from "vue";
import { LiteGraph, LGraph, LGraphCanvas } from "../../nodeEditor/editor.js";

// 统一节点
import { ShapeNode, EventNode, AnimateNode } from '../../nodeEditor/node/meta2dNode/meta2dUnifiedNodes.js'

const props = defineProps({
  modelValue: { type: Boolean, default: false },
  title: { type: String, default: "节点编辑器" },
  penId: { type: String, default: "" },
  graphData: { type: Object, default: null },
});

const emit = defineEmits(["update:modelValue", "apply"]);

// ==================== 响应式状态 ====================
const showDialog = ref(props.modelValue);
const canvasRef = ref(null);

let graph = null;
let graphCanvas = null;
let nodesRegistered = false;

// ==================== 注册节点 ====================
function registerNodes() {
  if (nodesRegistered) return;

  // 统一节点
  LiteGraph.registerNodeType('meta2d/统一/图形节点', ShapeNode)
  LiteGraph.registerNodeType('meta2d/统一/事件节点', EventNode)
  LiteGraph.registerNodeType('meta2d/统一/动效节点', AnimateNode)

  nodesRegistered = true;
}

// ==================== 初始化 LiteGraph ====================
function initGraph() {
  if (!canvasRef.value) return;

  registerNodes();

  graph = new LGraph();
  graphCanvas = new LGraphCanvas(canvasRef.value, graph);

  // 配置画布样式
  graphCanvas.background_image = null;
  graphCanvas.render_shadows = false;
  graphCanvas.clear_background_color = "#1e1e1e";
  graphCanvas.show_info = false;

  // 加载已有数据
  if (props.graphData) {
    graph.configure(props.graphData);
  }

  graph.start();

  // 必须在 start 之后 resize，确保 canvas 内部分辨率匹配容器尺寸
  // 否则画面模糊、拖拽坐标漂移
  graphCanvas.resize();
}

function onResize() {
  graphCanvas?.resize();
}

// ==================== 销毁 ====================
function destroyGraph() {
  if (graph) {
    graph.stop();
    graph = null;
  }
  graphCanvas = null;
}

// ==================== 方法 ====================
function close() {
  showDialog.value = false;
  emit("update:modelValue", false);
}

function apply() {
  if (graph) {
    graph.runStep()

    const events = collectEvents()
    const animateConfigs = collectAnimateConfigs()
    const shapePens = collectShapePens()

    emit('apply', {
      graphData: graph.serialize(),
      events,
      animateConfigs,
      shapePens,
    })
  }
  close()
}

/**
 * 从节点图中收集事件配置
 */
function collectEvents() {
  if (!graph) return [];

  const events = [];

  // 收集统一事件节点的输出
  const unifiedEventNodes = graph._nodes.filter(
    (n) => n.type?.includes('事件节点')
  )
  unifiedEventNodes.forEach((node) => {
    const event = node.getOutputData(1)
    if (event && event.name) {
      events.push(event)
    }
  })

  return events;
}

function collectAnimateConfigs() {
  if (!graph) return []
  const configs = []
  const animateNodes = graph._nodes.filter(
    (n) => n.type?.includes('动效节点')
  )
  animateNodes.forEach((node) => {
    const config = node.getOutputData(1)
    if (config && config.animateType) {
      configs.push(config)
    }
  })
  return configs
}

function collectShapePens() {
  if (!graph) return []
  const pens = []
  const shapeNodes = graph._nodes.filter(
    (n) => n.type?.includes('图形节点')
  )
  shapeNodes.forEach((node) => {
    const output = node.getOutputData(0)
    if (output && output.penData) {
      pens.push(output)
    }
  })
  return pens
}

// ==================== Watch ====================
watch(
  () => props.modelValue,
  (val) => {
    showDialog.value = val;
  }
);

watch(showDialog, (val) => {
  emit("update:modelValue", val);
});

// ==================== 生命周期 ====================
onBeforeUnmount(() => {
  destroyGraph();
});
</script>

<style scoped>
.litegraph-canvas {
  width: 100%;
  height: 100%;
  background-color: #1e1e1e;
}
</style>
