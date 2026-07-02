<template>
  <BasePropertyPanel v-model="nodeData" code-filename="qcarousel.generated.js" class="qcarousel-panel">
    <div class="property-panel-tabs">
      <q-tabs v-model="activeTab" class="tabs-white" dense inline-label :breakpoint="0">
        <q-tab name="property" label="属性" />
        <q-tab name="slides" label="幻灯片" />
        <q-tab name="control" label="控制器" />
        <q-tab name="style" label="样式" />
      </q-tabs>
      <q-separator />
    </div>

    <q-tab-panels v-model="activeTab" dark class="panel-body">
      <!-- 属性:复用标准属性编辑器 -->
      <q-tab-panel name="property" class="panel-tab">
        <q-scroll-area class="panel-scroll">
          <compPropertyPanel v-model="nodeData" />
        </q-scroll-area>
      </q-tab-panel>

      <!-- 幻灯片 -->
      <q-tab-panel name="slides" class="panel-tab">
        <q-scroll-area class="panel-scroll">
          <QCarouselListEditor
            v-if="slidesCfg"
            :node="nodeData"
            v-model:cfg="slidesCfg"
            :raw-props="slideRaw"
            item-label="幻灯片"
            data-slot-name="slidesData"
            content-hint="幻灯片内容:在画布把含 UI 节点的 FunctionBlock 连到本节点的 S#el 内容输入槽(数据模式可用 item/index)"
            :create-item="createSlidePanelItem"
          />
        </q-scroll-area>
      </q-tab-panel>

      <!-- 控制器 -->
      <q-tab-panel name="control" class="panel-tab">
        <q-scroll-area class="panel-scroll">
          <div class="q-pa-xs column q-gutter-y-sm">
            <q-toggle
              :model-value="control.enabled || false"
              label="启用 QCarouselControl"
              dense dark color="primary"
              @update:model-value="setControlEnabled"
            />

            <template v-if="control.enabled">
              <q-select
                label="position"
                :model-value="displayValue(control.props?.position?.value)"
                :options="controlPositionOptions"
                dense dark outlined
                @update:model-value="value => setControlProp('position', value ? JSON.stringify(value) : '')"
              >
                <q-tooltip>控制器停靠位置</q-tooltip>
              </q-select>
              <q-input
                label="offset(表达式,如 [18, 18])"
                :model-value="control.props?.offset?.value || ''"
                dense dark outlined debounce="100"
                @update:model-value="value => setControlProp('offset', value)"
              />

              <q-separator dark class="q-my-xs" />
              <div class="section-title">按钮(QBtn)</div>
              <QCarouselListEditor
                v-if="buttonsCfg"
                :node="nodeData"
                v-model:cfg="buttonsCfg"
                :raw-props="btnRaw"
                item-label="按钮"
                data-slot-name="btnData"
                show-click-event
                :create-item="createBtnPanelItem"
              />
            </template>
          </div>
        </q-scroll-area>
      </q-tab-panel>

      <!-- 样式 -->
      <q-tab-panel name="style" class="panel-tab">
        <q-scroll-area class="panel-scroll">
          <compStylePanel v-model="nodeData" />
        </q-scroll-area>
      </q-tab-panel>
    </q-tab-panels>
  </BasePropertyPanel>
</template>

<script setup>
import { computed, ref, watchEffect } from "vue";
import BasePropertyPanel from "../../../propertyPanel/BasePropertyPanel.vue";
import compPropertyPanel from "../../../propertyPanel/compPropertyPanel.vue";
import compStylePanel from "../../../propertyPanel/compStylePanel.vue";
import QCarouselListEditor from "./QCarouselListEditor.vue";
import {
  CAROUSEL_SLIDE_RAW_DATA,
  CAROUSEL_CONTROL_RAW_DATA,
  CONTROL_BTN_RAW_DATA,
  createSlidePanelItem,
  createBtnPanelItem,
} from "./QCarousel.js";

const nodeData = defineModel();
const activeTab = ref("property");
const slideRaw = CAROUSEL_SLIDE_RAW_DATA.props;
const btnRaw = CONTROL_BTN_RAW_DATA.props;
const controlPositionOptions = CAROUSEL_CONTROL_RAW_DATA.props.position.values;

const slidesCfg = computed(() => nodeData.value?.properties?.slides || null);
const control = computed(() => nodeData.value?.properties?.control || {});
const buttonsCfg = computed(() => nodeData.value?.properties?.control?.buttons || null);

// 兜底:确保结构存在(老数据 / 首次)
watchEffect(() => {
  const p = nodeData.value?.properties;
  if (!p) return;
  if (!p.slides) p.slides = { mode: "manual", items: [], dataSource: { isSlot: false, value: "" }, itemVar: "item", indexVar: "index", keyExpression: "index", sampleData: "", template: { id: "slideTpl", props: {} } };
  if (!p.control) p.control = { enabled: false, props: {}, buttons: null };
  if (!p.control.props) p.control.props = {};
  if (!p.control.buttons) {
    p.control.buttons = { mode: "manual", items: [], dataSource: { isSlot: false, value: "" }, itemVar: "btnItem", indexVar: "btnIndex", keyExpression: "btnIndex", sampleData: "", template: { id: "btnTpl", props: {}, events: { click: false } } };
  }
});

function triggerUpdate() {
  nodeData.value?.onExecute?.();
  nodeData.value?.graph?.setDirtyCanvas?.(true, true);
}

function displayValue(value) {
  return typeof value === "string" ? value.replace(/^['"]|['"]$/g, "") : value;
}

function setControlEnabled(value) {
  if (!nodeData.value?.properties?.control) return;
  nodeData.value.properties.control.enabled = value;
  triggerUpdate();
}

function setControlProp(propName, value) {
  const c = nodeData.value?.properties?.control;
  if (!c) return;
  if (!c.props) c.props = {};
  if (!c.props[propName]) c.props[propName] = { data: "", disable: false, isSlot: false, value: "" };
  c.props[propName].value = value;
  triggerUpdate();
}
</script>

<style scoped>
.qcarousel-panel :deep(.base-property-content) {
  overflow: visible;
}

.property-panel-tabs {
  background-color: var(--q-dark, #1d1d1d);
}

.tabs-white :deep(.q-tab__label) {
  color: rgba(255, 255, 255, 0.72);
}

.tabs-white :deep(.q-tab--active .q-tab__label) {
  color: rgba(255, 255, 255, 0.96);
}

.panel-body {
  height: 100%;
  background: transparent;
}

.panel-tab {
  height: 100%;
  padding: 8px;
}

.panel-scroll {
  width: 100%;
  height: 100%;
}

.section-title {
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  font-weight: 600;
}
</style>
