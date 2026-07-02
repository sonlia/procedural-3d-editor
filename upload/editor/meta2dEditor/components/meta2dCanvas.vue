<template>
  <div class="meta2d-canvas-container column">
    <!-- 加载错误提示 -->
    <div v-if="loadError" class="col column items-center justify-center">
      <q-icon name="error_outline" color="warning" size="64px" />
      <div class="text-warning text-h6 q-mt-md">Meta2D 加载失败</div>
      <div class="text-grey-5 text-body2 q-mt-sm">{{ loadError }}</div>
      <q-btn dark dense flat color="primary" label="安装依赖" class="q-mt-md"
        @click="showInstallHelp" />
    </div>

    <!-- Meta2D 画布 -->
    <div
      v-else
      ref="canvasContainerRef"
      class="meta2d-canvas col"
      @drop="onDrop"
      @dragover.prevent
    >
      <q-resize-observer @resize="onResize" />
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, onBeforeUnmount, nextTick, watch } from "vue";
import { Notify, uid } from "quasar";
import { cloneDeep } from "lodash-es";
import { useProjectStore, useProjectMangerStore } from "src/stores/projectMange.js";
import {
  createMeta2dInstance,
  destroyMeta2dInstance,
  meta2dInstance,
  isInitialized,
  resize,
  safeInitMeta2d,
  resetInitKey,
  loadError,
} from "../composables/useMeta2dEditor.js";
import { lockStatus } from "../composables/useMeta2dConfig.js";

// ==================== Emit ====================
const emit = defineEmits(["drop"]);

// ==================== Store ====================
const _project = useProjectStore();
const _projectManger = useProjectMangerStore();

// ==================== Refs ====================
const canvasContainerRef = ref(null);

// 冷加载(整页刷新)时容器布局会经过多次 settle。若在抖动期创建实例,meta2d 会按瞬时
// (可能 0/错位)的尺寸与屏幕位置初始化内部画布与 clientRect(鼠标→画布坐标的换算基准),
// 导致刷新后缩放/拖动不跟手、render 命中 0×0 OffscreenCanvas 报错(须切节点重挂载才恢复)。
// 故冷加载延迟到容器尺寸稳定(防抖)后再创建实例,等价于重挂载的时机。
let createSettleTimer = null;

// ==================== 方法 ====================

function onResize() {
  if (!isInitialized.value && canvasContainerRef.value) {
    // 容器在 mount 时尺寸为 0；有尺寸后不立即创建,而是防抖等布局稳定再创建,
    // 避免冷加载抖动期按错误尺寸/位置初始化实例(刷新后缩放拖动不跟手的根因)。
    const rect = canvasContainerRef.value.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
      clearTimeout(createSettleTimer);
      createSettleTimer = setTimeout(createInstanceWhenStable, 150);
    }
    return;
  }
  nextTick(() => {
    // 容器尺寸为 0 时调用 meta2d resize/render 会因 OffscreenCanvas 0×0 抛 InvalidStateError,跳过
    const r = canvasContainerRef.value?.getBoundingClientRect();
    if (r && r.width > 0 && r.height > 0) {
      resize();
    }
  });
}

// 容器尺寸稳定后创建实例并加载数据(冷加载路径)
function createInstanceWhenStable() {
  if (isInitialized.value || !canvasContainerRef.value) return;
  const rect = canvasContainerRef.value.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return;
  console.log("[m2d-dbg] 尺寸稳定后创建实例: size=", rect.width, rect.height);
  createMeta2dInstance(canvasContainerRef.value).then(() => {
    if (isInitialized.value) {
      setupEditPenEvent();
      safeInitMeta2d();
    }
  });
}

function showInstallHelp() {
  Notify.create({
    type: "info",
    message: "请在终端运行以下命令安装依赖",
    caption: "cd frontend && npm install @meta2d/core",
    timeout: 10000,
    actions: [{ label: "关闭", color: "white" }],
  });
}

/**
 * 处理拖放
 */
function onDrop(event) {
  event.preventDefault();

  // 检查锁定状态
  if (lockStatus.value !== 0) return;

  // 尝试获取 Meta2d 数据
  const meta2dData = event.dataTransfer.getData("Meta2d");
  if (meta2dData) {
    handleMeta2dDrop(event, meta2dData);
    return;
  }

  // 兼容旧的 text/plain 格式
  const textData = event.dataTransfer.getData("text/plain");
  if (textData) {
    emit("drop", event);
  }
}

/**
 * 处理 Meta2d 图元拖放
 */
function handleMeta2dDrop(event, jsonData) {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  const pen = JSON.parse(jsonData);

  // 获取放置位置（相对于画布容器）
  const rect = canvasContainerRef.value.getBoundingClientRect();
  const clientX = event.clientX - rect.left;
  const clientY = event.clientY - rect.top;

  // 转换为画布坐标
  const pt = m2d.canvas.getCoordinates(clientX, clientY);

  // 创建新图元
  const newPen = cloneDeep(pen);
  newPen.id = uid();
  newPen.x = pt.x - (newPen.width || 100) / 2;
  newPen.y = pt.y - (newPen.height || 100) / 2;

  // 设置默认属性
  if (newPen.type === undefined) newPen.type = 1; // pen 类型

  m2d.addPen(newPen);
  m2d.render();
}

// ==================== 生命周期 ====================
onMounted(async () => {
  if (canvasContainerRef.value) {
    // 检查容器是否有实际尺寸，0 尺寸会导致 OffscreenCanvas 报错
    const rect = canvasContainerRef.value.getBoundingClientRect();
    console.log(
      "[m2d-dbg] onMounted: size=", rect.width, rect.height,
      "storeInit=", _projectManger.isInitialized,
      "instanceInit=", isInitialized.value,
      "select=", _project.getCurrentSelect(),
    );
    if (rect.width === 0 || rect.height === 0) {
      // 容器还没渲染出尺寸，等 q-resize-observer 的 onResize 触发再初始化
      return;
    }
    await createMeta2dInstance(canvasContainerRef.value);
    if (isInitialized.value) {
      setupEditPenEvent();
      safeInitMeta2d();
    }
  }
});

onBeforeUnmount(() => {
  clearTimeout(createSettleTimer);
  destroyMeta2dInstance();
  // 重置初始化标记，否则重新挂载同一文件时 safeInitMeta2d 会命中去重而不加载（空白画布）
  resetInitKey();
});

/**
 * 设置编辑事件合并
 */
function setupEditPenEvent() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  // 合并多个编辑事件，减少 render 调用
  m2d.on("update", () => m2d.emit("editPen"));
  m2d.on("resizePens", () => m2d.emit("editPen"));
  m2d.on("rotatePens", () => m2d.emit("editPen"));
  m2d.on("valueUpdate", () => m2d.emit("editPen"));
}

// ==================== Watchers ====================
// 监听项目切换
watch(
  () => _projectManger.currentProjectId,
  () => {
    if (!isInitialized.value) return;
    console.log("[meta2dCanvas] 项目切换，重新加载数据");
    resetInitKey();
    safeInitMeta2d();
  }
);

// 监听文件切换
watch(
  () => _project.getCurrentSelect(),
  (newSelect, oldSelect) => {
    if (!isInitialized.value) return;
    if (newSelect !== oldSelect) {
      console.log("[meta2dCanvas] 文件切换:", oldSelect, "->", newSelect);
      resetInitKey();
      nextTick(() => {
        safeInitMeta2d();
      });
    }
  }
);
</script>

<style scoped>
.meta2d-canvas-container {
  flex: 1;
  min-height: 0;
  background-color: #1e1e1e;
}

.meta2d-canvas {
  flex: 1;
  position: relative;
  overflow: hidden;
}
</style>
