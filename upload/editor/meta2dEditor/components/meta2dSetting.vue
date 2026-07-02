<template>
  <div class="meta2d-setting column">
    <q-bar dark class="bg-grey-10">
      <span class="text-grey-5 text-caption">属性面板</span>
    </q-bar>

    <!-- 未选中图元：显示图纸/全局配置 -->
    <template v-if="!hasSelection">
      <q-tabs v-model="mapTab" dark dense inline-label class="bg-grey-9 text-grey-5">
        <q-tab name="map" label="图纸" icon="map" />
        <q-tab name="global" label="全局配置" icon="settings" />
      </q-tabs>
      <q-tab-panels v-model="mapTab" dark animated class="col bg-grey-10">
        <q-tab-panel name="map" class="q-pa-none">
          <MapProps />
        </q-tab-panel>
        <q-tab-panel name="global" class="q-pa-none">
          <GlobalProps />
        </q-tab-panel>
      </q-tab-panels>
    </template>

    <!-- 选中单个图元：显示节点编辑器按钮 + 外观/数据 -->
    <template v-else-if="!isMulti">
      <!-- 节点编辑器入口 -->
      <div class="q-pa-xs">
        <q-btn
          dark
          dense
          flat
          icon="account_tree"
          label="节点编辑器"
          class="full-width"
          color="primary"
          @click="showLogicEditor = true"
        >
          <q-tooltip>使用节点编辑器配置交互、动效和图形创建</q-tooltip>
        </q-btn>
        <div v-if="hasGraphData" class="text-grey-6 text-caption text-center q-mt-xs">
          已配置节点逻辑
        </div>
      </div>

      <q-tabs v-model="penTab" dark dense inline-label class="bg-grey-9 text-grey-5">
        <q-tab name="appearance" label="外观" icon="palette" />
        <q-tab name="data" label="数据" icon="data_object" />
      </q-tabs>
      <q-tab-panels v-model="penTab" dark animated class="col bg-grey-10">
        <q-tab-panel name="appearance" class="q-pa-none">
          <PenAppearance />
        </q-tab-panel>
        <q-tab-panel name="data" class="q-pa-none">
          <PenData />
        </q-tab-panel>
      </q-tab-panels>
    </template>

    <!-- 多选图元：显示对齐工具 + 批量外观 -->
    <template v-else>
      <q-scroll-area class="col">
        <PenAppearance :multi="true" />
      </q-scroll-area>
    </template>

    <!-- 统一节点编辑器（放在条件渲染之外，避免取消选中时卸载导致 dialog 报错） -->
    <PenLogicEditor
      v-model="showLogicEditor"
      :pen-id="activePen?.id"
      :graph-data="graphData"
      @apply="onLogicApply"
    />
  </div>
</template>

<script setup>
import { ref, computed } from "vue";
import { activePen, activePens, meta2dInstance, safeClone } from "../composables/useMeta2dEditor.js";
import PenAppearance from "./penProps/PenAppearance.vue";
import PenData from "./penProps/PenData.vue";
import MapProps from "./meta2dMapProps.vue";
import GlobalProps from "./meta2dGlobalProps.vue";
import PenLogicEditor from "./PenLogicEditor.vue";

// Tab 状态
const mapTab = ref("map");
const penTab = ref("appearance");

// 节点编辑器
const showLogicEditor = ref(false);
const graphData = computed(() => activePen.value?._graphData || null);
const hasGraphData = computed(() => graphData.value !== null);

// Computed
const hasSelection = computed(() => activePens.value.length > 0);
const isMulti = computed(() => activePens.value.length > 1);

// 节点编辑器应用回调
function onLogicApply({ graphData: gd, events, animateConfigs, shapePens }) {
  const m2d = meta2dInstance.value;
  const pen = activePen.value;
  if (!m2d || !pen) return;

  const cleanGraphData = safeClone(gd);

  // 保存图数据到 pen
  m2d.setValue({ id: pen.id, _graphData: cleanGraphData });

  // 应用事件配置
  if (events?.length > 0) {
    m2d.setValue({ id: pen.id, events });
  }

  // 应用动画配置（取第一个）
  if (animateConfigs?.length > 0) {
    const config = animateConfigs[0];
    m2d.setValue({
      id: pen.id,
      animateType: config.animateType,
      animateDuration: config.animateDuration,
      animateCycle: config.animateCycle,
      autoPlay: config.autoPlay,
      frames: config.frames,
    });
  }

  // 创建新图元
  if (shapePens?.length > 0) {
    shapePens.forEach((sp) => {
      if (sp.penData) m2d.addPen(sp.penData);
    });
    m2d.render();
  }
}
</script>

<style scoped>
.meta2d-setting {
  background-color: #252526;
  border-left: 1px solid #3c3c3c;
}
</style>
