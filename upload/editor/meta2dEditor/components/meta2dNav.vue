<template>
  <q-bar dark class="meta2d-nav bg-grey-10">
    <!-- ==================== 左侧菜单区 ==================== -->

    <!-- 文件菜单 -->
    <q-btn dark dense flat label="文件" text-color="grey-5">
      <q-menu dark dense>
        <q-list dark dense class="bg-grey-9" style="min-width: 150px">
          <q-item clickable v-close-popup @click="dispatchFunc('open')">
            <q-item-section>打开文件</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="dispatchFunc('importJson')">
            <q-item-section>导入文件</q-item-section>
          </q-item>
          <q-separator dark />
          <q-item clickable v-close-popup @click="dispatchFunc('downloadJson')">
            <q-item-section>下载到本地Json</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="dispatchFunc('exportPng')">
            <q-item-section>导出png</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="dispatchFunc('exportSvg')">
            <q-item-section>导出svg</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <!-- 钢笔 -->
    <q-btn
      dark
      dense
      flat
      label="钢笔"
      size="sm"
      :text-color="isDrawingLine ? 'primary' : 'grey-5'"
      @click="toggleDrawLine"
    />

    <!-- 铅笔 -->
    <q-btn
      dark
      dense
      flat
      label="铅笔"
      size="sm"
      :text-color="isDrawingPencil ? 'primary' : 'grey-5'"
      @click="togglePencil"
    />

    <q-separator dark vertical inset class="q-mx-xs" />

    <!-- 剪贴板 & 组合 -->
    <q-btn dark dense flat icon="delete" text-color="grey-7" @click="handleDelete" class="q-ma-xs"
      :disable="!hasSelection">
      <q-tooltip>删除选中</q-tooltip>
    </q-btn>
    <q-btn dark dense flat icon="content_copy" text-color="grey-7" @click="handleCopy" class="q-ma-xs"
      :disable="!hasSelection">
      <q-tooltip>复制</q-tooltip>
    </q-btn>
    <q-btn dark dense flat icon="content_paste" text-color="grey-7" @click="handlePaste" class="q-ma-xs"
      :disable="!isInitialized">
      <q-tooltip>粘贴</q-tooltip>
    </q-btn>
    <q-separator dark vertical inset class="q-mx-xs" />
    <q-btn dark dense flat icon="layers" text-color="grey-7" @click="handleCombine" class="q-ma-xs"
      :disable="!hasMultiSelection">
      <q-tooltip>组合</q-tooltip>
    </q-btn>
    <q-btn dark dense flat icon="layers_clear" text-color="grey-7" @click="handleUncombine" class="q-ma-xs"
      :disable="!hasSelection">
      <q-tooltip>取消组合</q-tooltip>
    </q-btn>

    <!-- ==================== 中间区域：当前选择 ==================== -->
    <q-space />
    <span class="text-grey-6 text-caption">当前选择: {{ currentName }}</span>
    <q-space />

    <!-- ==================== 右侧工具区 ==================== -->

    <!-- 居中显示 -->
    <q-btn dark dense flat text-color="grey-5" @click="dispatchFunc('fitView')">
      <svg class="l-icon" aria-hidden="true"><use xlink:href="#l-angle-left" /></svg>
      <q-tooltip>居中显示</q-tooltip>
    </q-btn>

    <!-- 撤销 -->
    <q-btn dark dense flat text-color="grey-5" @click="dispatchFunc('undo')">
      <svg class="l-icon" aria-hidden="true"><use xlink:href="#l-angle-left" /></svg>
      <q-tooltip>撤销</q-tooltip>
    </q-btn>

    <!-- 重做 -->
    <q-btn dark dense flat text-color="grey-5" @click="dispatchFunc('redo')">
      <svg class="l-icon" aria-hidden="true"><use xlink:href="#l-angle-right" /></svg>
      <q-tooltip>重做</q-tooltip>
    </q-btn>

    <!-- 起点箭头 -->
    <q-btn-dropdown dark dense flat text-color="grey-5" no-icon-animation>
      <template #label>
        <div class="icon-dropdown-label">
          <svg class="l-icon" aria-hidden="true"><use :xlink:href="'#' + fromArrowIcon" /></svg>
          <span class="text-caption">起点</span>
        </div>
      </template>
      <q-list dark dense class="bg-grey-9">
        <q-item
          v-for="arrow in arrowOptions"
          :key="arrow.value"
          clickable
          v-close-popup
          @click="setFromArrow(arrow.value, arrow.icon)"
        >
          <q-item-section side>
            <svg class="l-icon q-mr-sm" aria-hidden="true"><use :xlink:href="'#' + arrow.icon" /></svg>
          </q-item-section>
          <q-item-section>{{ arrow.name }}</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>

    <!-- 终点箭头 -->
    <q-btn-dropdown dark dense flat text-color="grey-5" no-icon-animation>
      <template #label>
        <div class="icon-dropdown-label">
          <svg class="l-icon" aria-hidden="true"><use :xlink:href="'#' + toArrowIcon" /></svg>
          <span class="text-caption">终点</span>
        </div>
      </template>
      <q-list dark dense class="bg-grey-9">
        <q-item
          v-for="arrow in arrowOptions"
          :key="arrow.value"
          clickable
          v-close-popup
          @click="setToArrow(arrow.value, arrow.icon)"
        >
          <q-item-section side>
            <svg class="l-icon q-mr-sm" aria-hidden="true"><use :xlink:href="'#' + arrow.icon" /></svg>
          </q-item-section>
          <q-item-section>{{ arrow.name }}</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>

    <!-- 连线类型 -->
    <q-btn-dropdown dark dense flat text-color="grey-5" no-icon-animation>
      <template #label>
        <div class="icon-dropdown-label">
          <svg class="l-icon" aria-hidden="true"><use :xlink:href="'#' + lineIcon" /></svg>
          <span class="text-caption">连线</span>
        </div>
      </template>
      <q-list dark dense class="bg-grey-9">
        <q-item
          v-for="line in lineOptions"
          :key="line.value"
          clickable
          v-close-popup
          @click="setLineName(line.value, line.icon)"
        >
          <q-item-section side>
            <svg class="l-icon q-mr-sm" aria-hidden="true"><use :xlink:href="'#' + line.icon" /></svg>
          </q-item-section>
          <q-item-section>{{ line.name }}</q-item-section>
        </q-item>
      </q-list>
    </q-btn-dropdown>

    <!-- 设置菜单 -->
    <q-btn dark dense flat label="设置" text-color="grey-5">
      <q-menu dark dense>
        <q-list dark dense class="bg-grey-9" style="min-width: 120px">
          <q-item clickable v-close-popup @click="toggleMagnifier">
            <q-item-section side v-if="showMagnifier">
              <q-icon name="check"  color="primary" />
            </q-item-section>
            <q-item-section>放大镜</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="toggleMiniMap">
            <q-item-section side v-if="showMiniMap">
              <q-icon name="check"  color="primary" />
            </q-item-section>
            <q-item-section>缩略图</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="toggleManualAnchor">
            <q-item-section side v-if="manualAnchor">
              <q-icon name="check"  color="primary" />
            </q-item-section>
            <q-item-section>手动锚点</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="toggleGrid">
            <q-item-section side v-if="showGrid">
              <q-icon name="check"  color="primary" />
            </q-item-section>
            <q-item-section>网格</q-item-section>
          </q-item>
          <q-item clickable v-close-popup @click="toggleRule">
            <q-item-section side v-if="showRule">
              <q-icon name="check"  color="primary" />
            </q-item-section>
            <q-item-section>标尺</q-item-section>
          </q-item>
        </q-list>
      </q-menu>
    </q-btn>

    <!-- 缩放滑块 -->
    <q-btn dark dense flat text-color="grey-5">
      <span class="text-caption">缩放</span>
      <q-menu dark dense>
        <div class="q-pa-sm bg-grey-9" style="width: 200px">
          <q-slider
            v-model="scaleValue"
            :min="0"
            :max="100"
            dark
            dense
            @update:model-value="scaleView"
          />
        </div>
      </q-menu>
    </q-btn>

    <span class="text-grey-6 text-caption q-mx-sm">图元: {{ pensCount }}</span>

    <!-- 锁定状态 -->
    <q-btn
      dark
      dense
      flat
      size="sm"
      :text-color="lockStatus === 0 ? 'grey-5' : 'warning'"
      @click="changeLock"
    >
      <span class="text-caption">{{ lockLabels[lockStatus] }}</span>
    </q-btn>
  </q-bar>
</template>

<script setup>
import { ref, computed, watch, onMounted, onBeforeUnmount } from "vue";
import {
  meta2dInstance,
  isInitialized,
  activePens,
  deleteActivePens,
  getAllPens,
  debouncedSaveData,
} from "../composables/useMeta2dEditor.js";
import { lockStatus, lockLabels, dispatchFunc } from "../composables/useMeta2dConfig.js";
import { useProjectStore } from "src/stores/projectMange.js";
import { PenType } from "@meta2d/core";

const _project = useProjectStore();

// ==================== 箭头选项配置 ====================
// 使用 SVG sprite 中的图标 (l- 前缀)
const arrowOptions = [
  { name: "无", icon: "l-line", value: "" },
  { name: "三角形", icon: "l-to-triangle", value: "triangle" },
  { name: "菱形", icon: "l-to-diamond", value: "diamond" },
  { name: "圆形", icon: "l-to-circle", value: "circle" },
  { name: "lineDown", icon: "l-to-lineDown", value: "lineDown" },
  { name: "lineUp", icon: "l-to-lineUp", value: "lineUp" },
  { name: "实心三角", icon: "l-to-triangleSolid", value: "triangleSolid" },
  { name: "实心菱形", icon: "l-to-diamondSolid", value: "diamondSolid" },
  { name: "实心圆", icon: "l-to-circleSolid", value: "circleSolid" },
  { name: "线段箭头", icon: "l-to-line", value: "line" },
];

// ==================== 连线类型配置 ====================
const lineOptions = [
  { name: "直线", icon: "l-line", value: "line" },
  { name: "曲线", icon: "l-curve2", value: "curve" },
  { name: "折线", icon: "l-polyline", value: "polyline" },
  { name: "脑图", icon: "l-mind", value: "mind" },
];

// ==================== 响应式状态 ====================
const scaleValue = ref(10);
const isDrawingLine = ref(false);
const isDrawingPencil = ref(false);
const fromArrowIcon = ref("l-line");
const toArrowIcon = ref("l-line");
const lineIcon = ref("l-curve2");
const lineName = ref("curve");
const showGrid = ref(false);
const showRule = ref(false);
const showMagnifier = ref(false);
const showMiniMap = ref(false);
const manualAnchor = ref(false);

// ==================== Computed ====================
const currentName = computed(() => {
  const select = _project.getCurrentSelect();
  if (select) {
    return select.split("/").pop();
  }
  return "";
});

const hasSelection = computed(() => activePens.value.length > 0);
const hasMultiSelection = computed(() => activePens.value.length > 1);
const pensCount = computed(() => getAllPens().length);

// ==================== 剪贴板 & 组合操作 ====================
function handleDelete() {
  deleteActivePens();
}

function handleCopy() {
  if (meta2dInstance.value && activePens.value.length > 0) {
    meta2dInstance.value.copy();
  }
}

function handlePaste() {
  if (meta2dInstance.value) {
    meta2dInstance.value.paste();
  }
}

function handleCombine() {
  if (meta2dInstance.value && activePens.value.length > 1) {
    meta2dInstance.value.combine(activePens.value);
  }
}

function handleUncombine() {
  if (meta2dInstance.value && activePens.value.length > 0) {
    meta2dInstance.value.uncombine(activePens.value[0]);
  }
}

// ==================== 方法 ====================
function toggleDrawLine() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  if (m2d.canvas.drawingLineName) {
    m2d.drawLine();
    m2d.finishPencil?.();
    isDrawingLine.value = false;
  } else {
    m2d.drawLine("line");
    isDrawingLine.value = true;
    isDrawingPencil.value = false;
  }
}

function togglePencil() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  if (m2d.canvas.pencil) {
    m2d.stopPencil?.();
    m2d.finishPencil?.();
    isDrawingPencil.value = false;
  } else {
    m2d.drawingPencil();
    isDrawingPencil.value = true;
    isDrawingLine.value = false;
  }
}

function setFromArrow(value, icon) {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  fromArrowIcon.value = icon;
  m2d.store.data.fromArrow = value;

  // 修改激活图元的 fromArrow
  if (m2d.store.active) {
    m2d.store.active.forEach((pen) => {
      if (pen.type === PenType.Line) {
        pen.fromArrow = value;
      }
    });
  }
  m2d.render();
  debouncedSaveData();
}

function setToArrow(value, icon) {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  toArrowIcon.value = icon;
  m2d.store.data.toArrow = value;

  // 修改激活图元的 toArrow
  if (m2d.store.active) {
    m2d.store.active.forEach((pen) => {
      if (pen.type === PenType.Line) {
        pen.toArrow = value;
      }
    });
  }
  m2d.render();
  debouncedSaveData();
}

function setLineName(value, icon) {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  lineIcon.value = icon;
  lineName.value = value;
  m2d.store.options.drawingLineName = value;

  if (m2d.canvas.drawingLineName) {
    m2d.canvas.drawingLineName = value;
  }

  // 修改激活线条类型
  m2d.store.active?.forEach((pen) => {
    m2d.updateLineType(pen, value);
  });
  m2d.render();
  debouncedSaveData();
}

function toggleMagnifier() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  if (m2d.canvas.magnifierCanvas?.magnifier) {
    m2d.hideMagnifier();
    showMagnifier.value = false;
  } else {
    m2d.showMagnifier();
    showMagnifier.value = true;
  }
}

function toggleMiniMap() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  if (m2d.map?.isShow) {
    m2d.hideMap();
    showMiniMap.value = false;
  } else {
    m2d.showMap();
    showMiniMap.value = true;
  }
}

function toggleManualAnchor() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  m2d.toggleAnchorMode();
  manualAnchor.value = !manualAnchor.value;
}

function toggleGrid() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  if (m2d.store.data.grid) {
    m2d.setGrid({ grid: false });
    showGrid.value = false;
  } else {
    m2d.setGrid({
      grid: true,
      gridColor: "#e2e2e2",
      gridSize: 10,
      gridRotate: 0,
    });
    showGrid.value = true;
  }
  m2d.render();
  debouncedSaveData();
}

function toggleRule() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  if (m2d.store.data.rule) {
    m2d.setRule({ rule: false });
    showRule.value = false;
  } else {
    m2d.setRule({
      rule: true,
      ruleColor: "#414141",
    });
    showRule.value = true;
  }
  m2d.render();
  debouncedSaveData();
}

function scaleView(val) {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  const minScale = m2d.store.options.minScale || 0.1;
  const maxScale = m2d.store.options.maxScale || 10;
  m2d.scale(((maxScale - minScale) / 100) * val);
  m2d.centerView();
}

function changeLock() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  lockStatus.value = (lockStatus.value + 1) % 3;
  m2d.store.data.locked = lockStatus.value;
  debouncedSaveData();
}

function syncState() {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  showGrid.value = m2d.store?.data?.grid ?? false;
  showRule.value = m2d.store?.data?.rule ?? false;
  lineName.value = m2d.store?.options?.drawingLineName || "curve";

  // 同步箭头图标
  const fromArrowValue = m2d.store?.data?.fromArrow || "";
  const toArrowValue = m2d.store?.data?.toArrow || "";
  fromArrowIcon.value = fromArrowValue ? `l-to-${fromArrowValue}` : "l-line";
  toArrowIcon.value = toArrowValue ? `l-to-${toArrowValue}` : "l-line";
}

// ==================== 生命周期 ====================
onMounted(() => {
  syncState();

  const m2d = meta2dInstance.value;
  if (m2d) {
    m2d.on("scale", (data) => {
      const minScale = m2d.store.options.minScale || 0.1;
      const maxScale = m2d.store.options.maxScale || 10;
      scaleValue.value = +(data.toFixed(1) * (maxScale - minScale)).toFixed();
    });

    m2d.on("lock", () => {
      // 锁定状态变化处理
    });
  }
});

onBeforeUnmount(() => {
  const m2d = meta2dInstance.value;
  if (m2d) {
    m2d.off("scale");
    m2d.off("lock");
  }
});

// 监听 meta2d 实例变化
watch(meta2dInstance, (m2d) => {
  if (m2d) {
    syncState();
  }
});
</script>

<style scoped>
.meta2d-nav {
  height: 40px;
  border-bottom: 1px solid #3c3c3c;
}

.icon-dropdown-label {
  display: flex;
  align-items: center;
  gap: 4px;
}
</style>
