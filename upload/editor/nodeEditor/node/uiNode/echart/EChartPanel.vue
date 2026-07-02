<template>
  <BasePropertyPanel v-model="nodeData" code-filename="echart.generated.js" class="echart-panel">
    <div class="property-panel-tabs">
      <q-tabs v-model="activeTab" class="tabs-white" dense inline-label :breakpoint="0">
        <q-tab name="chart" label="图表" />
        <q-tab name="style" label="样式" />
      </q-tabs>
      <q-separator />
    </div>

    <q-tab-panels v-model="activeTab" dark class="panel-body">
      <q-tab-panel name="chart" class="panel-tab">
        <q-scroll-area class="panel-scroll">
          <div v-if="e" class="q-pa-xs column q-gutter-y-sm">
            <!-- 模式切换 -->
            <q-btn-toggle
              v-model="e.mode"
              dense spread no-caps toggle-color="primary"
              :options="[{ label: '可视化', value: 'visual' }, { label: '高级 option', value: 'advanced' }]"
              @update:model-value="rerender"
            />

            <!-- 数据源(两种模式共用) -->
            <q-card dark flat bordered class="q-pa-sm column q-gutter-y-xs">
              <div class="row items-center">
                <div class="col text-caption">数据源 rawData</div>
                <q-toggle :model-value="e.rawData.isSlot" dense dark label="接上游" @update:model-value="onRawSlot" />
              </div>
              <q-input
                v-if="!e.rawData.isSlot"
                v-model="e.rawData.value" dense dark outlined
                label="变量名 / 静态值(默认 [])"
                @update:model-value="rerender"
              />
              <div v-else class="text-caption text-grey">已切换为输入槽:把上游数据节点连到 rawData</div>
              <q-input
                v-model="e.sampleData" dense dark outlined type="textarea" autogrow
                label="示例数据 JSON(仅设计期,用于字段下拉)"
                @update:model-value="rerender"
              />
            </q-card>

            <!-- 可视化模式 -->
            <template v-if="e.mode === 'visual'">
              <q-card dark flat bordered class="q-pa-sm column q-gutter-y-xs">
                <q-select
                  :model-value="e.chart.type" dense dark outlined label="图表类型"
                  :options="typeOptions" emit-value map-options
                  @update:model-value="onType"
                />
                <div v-if="schema.cartesian" class="row q-col-gutter-sm">
                  <q-select class="col" v-model="e.chart.axis.x.type" :options="axisTypes" dense dark outlined label="X 轴" emit-value map-options @update:model-value="rerender" />
                  <q-select class="col" v-model="e.chart.axis.y.type" :options="axisTypes" dense dark outlined label="Y 轴" emit-value map-options @update:model-value="rerender" />
                </div>
              </q-card>

              <!-- 系列列表 -->
              <q-card dark flat bordered class="q-pa-sm column q-gutter-y-xs">
                <div class="row items-center">
                  <div class="col text-caption">系列 series</div>
                  <q-btn dense flat icon="add" size="sm" @click="onAddSeries" />
                </div>
                <q-expansion-item
                  v-for="(s, i) in e.chart.series" :key="i" dense dark
                  :label="s.name || (schema.label + ' #' + (i + 1))"
                  header-class="text-white"
                >
                  <div class="q-pa-xs column q-gutter-y-xs">
                    <q-input v-model="s.name" dense dark outlined label="名称" @update:model-value="rerender" />
                    <q-select
                      v-for="ch in schema.channels" :key="ch.key"
                      v-model="s.encode[ch.key]" :options="fields" dense dark outlined
                      :label="ch.label" use-input new-value-mode="add-unique"
                      @update:model-value="rerender"
                    />
                    <div class="row q-gutter-sm">
                      <q-toggle v-for="t in schema.toggles" :key="t.key" v-model="s[t.key]" dense dark :label="t.label" @update:model-value="rerender" />
                    </div>
                    <q-input v-model="s.color" dense dark outlined label="颜色(可选)" @update:model-value="rerender" />
                    <q-btn dense flat color="negative" icon="delete" size="sm" label="删除系列" @click="onRemoveSeries(i)" />
                  </div>
                </q-expansion-item>
              </q-card>

              <!-- 通用选项 -->
              <q-card dark flat bordered class="q-pa-sm column q-gutter-y-xs">
                <q-input v-model="e.chart.options.title" dense dark outlined label="标题" @update:model-value="rerender" />
                <div class="row q-gutter-sm">
                  <q-toggle v-model="e.chart.options.legend" dense dark label="图例" @update:model-value="rerender" />
                  <q-toggle v-model="e.chart.options.tooltip" dense dark label="提示框" @update:model-value="rerender" />
                </div>
                <q-select
                  v-if="e.chart.options.tooltip"
                  v-model="e.chart.options.tooltipTrigger"
                  :options="['axis', 'item', 'none']"
                  dense dark outlined label="提示框触发"
                  @update:model-value="rerender"
                />
                <q-input v-model="e.height" dense dark outlined label="高度(如 400px)" @update:model-value="rerender" />
              </q-card>

              <q-btn dense no-caps icon="code" label="导出为高级模式 →" @click="onExport" />
            </template>

            <!-- 高级模式 -->
            <template v-else>
              <div class="text-caption text-grey">可用变量:<code>rawData</code>。需返回 ECharts option 对象。</div>
              <div class="echart-advanced-editor">
                <CodeEditor :value="e.advancedCode" lang="javascript" @change="onAdvancedChange" />
              </div>
            </template>
          </div>
        </q-scroll-area>
      </q-tab-panel>

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
import compStylePanel from "../../../propertyPanel/compStylePanel.vue";
import CodeEditor from "src/components/editor/codeEditor/CodeMirror/CodeMirror..vue";
import { CHART_SCHEMA, schemaOf } from "./chartSchema.js";
import { setRawDataSlot, addSeries, removeSeries, setChartType, sampleFields, exportToAdvanced } from "./EChartNode.js";

const nodeData = defineModel();
const activeTab = ref("chart");

const e = computed(() => nodeData.value?.properties?.echart || null);
const schema = computed(() => schemaOf(e.value?.chart?.type || "line"));
const fields = computed(() => sampleFields(e.value?.sampleData));
const typeOptions = computed(() =>
  Object.entries(CHART_SCHEMA).map(([value, v]) => ({ label: v.label, value })),
);
const axisTypes = [
  { label: "category 类目", value: "category" },
  { label: "value 数值", value: "value" },
  { label: "time 时间", value: "time" },
];

// 兜底:确保 echart 结构存在(老数据/首次)
watchEffect(() => {
  nodeData.value?.ensureProperties?.();
});

function rerender() {
  nodeData.value?.onExecute?.();
  nodeData.value?.graph?.setDirtyCanvas?.(true, true);
}
function onRawSlot(v) { setRawDataSlot(nodeData.value, v); }
function onType(v) { setChartType(nodeData.value, v); }
function onAddSeries() { addSeries(nodeData.value); }
function onRemoveSeries(i) { removeSeries(nodeData.value, i); }
function onExport() { exportToAdvanced(nodeData.value); }
function onAdvancedChange(code) {
  if (!e.value) return;
  e.value.advancedCode = code;
  rerender();
}
</script>

<style scoped>
.echart-panel :deep(.base-property-content) {
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
.echart-advanced-editor {
  height: 280px;
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 4px;
  overflow: hidden;
}
</style>
