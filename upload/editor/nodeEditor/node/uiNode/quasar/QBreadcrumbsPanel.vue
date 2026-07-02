<template>
  <BasePropertyPanel v-model="nodeData" code-filename="qbreadcrumbs.generated.js" class="qbreadcrumbs-panel">
    <div class="property-panel-tabs">
      <q-tabs v-model="activeTab" class="tabs-white" dense inline-label :breakpoint="0">
        <q-tab name="property" label="属性" />
        <q-tab name="items" label="列表" />
        <q-tab name="slot" label="插槽" />
        <q-tab name="style" label="样式" />
      </q-tabs>
      <q-separator />
    </div>

    <q-tab-panels v-model="activeTab" dark class="panel-body">
      <q-tab-panel name="property" class="panel-tab">
        <q-scroll-area class="panel-scroll">
          <compPropertyPanel v-model="nodeData" />
        </q-scroll-area>
      </q-tab-panel>

      <q-tab-panel name="items" class="panel-tab">
        <q-scroll-area class="panel-scroll">
          <div class="items-panel">
            <q-btn-toggle
              v-model="mode"
              :options="[
                { label: '手动添加', value: 'manual' },
                { label: '数据接入', value: 'data' },
              ]"
              dense
              dark
              spread
              no-caps
              unelevated
              toggle-color="primary"
              color="dark"
              class="full-width q-mb-sm mode-toggle"
            />

            <template v-if="mode === 'manual'">
              <q-btn
                icon="add"
                label="添加面包屑"
                color="primary"
                dense
                unelevated
                class="full-width q-mb-sm"
                @click="addItem"
              />

            <q-expansion-item
              v-for="(item, index) in items"
              :key="item.id"
              dense
              dark
              default-opened
              class="item-card"
              header-class="item-header"
            >
              <template #header>
                <q-item-section>
                  <q-item-label>{{ itemTitle(item, index) }}</q-item-label>
                </q-item-section>
                <q-item-section side>
                  <q-btn
                    icon="delete"
                    flat
                    dense
                    round
                    color="negative"
                    :disable="items.length <= 1"
                    @click.stop="removeItem(index)"
                  >
                    <q-tooltip>删除</q-tooltip>
                  </q-btn>
                </q-item-section>
              </template>

              <div class="item-content">
                <div class="section-title">QBreadcrumbsEl 属性</div>
                <div
                  v-for="group in groupedElProps"
                  :key="group.category"
                  class="prop-group"
                >
                  <div class="group-title">{{ group.category }}</div>
                  <div
                    v-for="prop in group.items"
                    :key="prop.key"
                    class="prop-row"
                  >
                    <q-toggle
                      icon="code"
                      :model-value="item.props[prop.key]?.isSlot || false"
                      dense
                      color="teal"
                      @update:model-value="value => updatePropSlot(item, prop.key, value)"
                    >
                      <q-tooltip>
                        {{ item.props[prop.key]?.isSlot ? "使用直接输入" : "使用 Slot 连接" }}
                      </q-tooltip>
                    </q-toggle>

                    <q-toggle
                      v-if="prop.value.type === 'Boolean'"
                      :label="prop.key"
                      :model-value="!!item.props[prop.key]?.value"
                      :disable="item.props[prop.key]?.isSlot"
                      dense
                      dark
                      color="green"
                      class="col"
                      @update:model-value="value => setPropValue(item, prop.key, value)"
                    />

                    <q-select
                      v-else-if="prop.value.values"
                      :label="prop.key"
                      :model-value="displayValue(item.props[prop.key]?.value)"
                      :disable="item.props[prop.key]?.isSlot"
                      :options="prop.value.values"
                      dense
                      dark
                      borderless
                      class="col"
                      @update:model-value="value => setPropValue(item, prop.key, value ? JSON.stringify(value) : '')"
                    />

                    <q-input
                      v-else
                      :label="prop.key"
                      :model-value="item.props[prop.key]?.value || ''"
                      :disable="item.props[prop.key]?.isSlot"
                      dense
                      dark
                      borderless
                      debounce="100"
                      class="col"
                      @update:model-value="value => setPropValue(item, prop.key, value)"
                    />
                  </div>
                </div>

                <div class="section-title q-mt-sm">QBreadcrumbsEl 插槽</div>
                <q-toggle
                  :model-value="item.slots?.default || false"
                  label="default"
                  dense
                  dark
                  color="primary"
                  class="function-row"
                  @update:model-value="value => updateItemSlot(item, 'default', value)"
                >
                  <q-tooltip>{{ elRaw.slots.default.desc_cn }}</q-tooltip>
                </q-toggle>

                <div class="section-title q-mt-sm">QBreadcrumbsEl 事件</div>
                <q-toggle
                  :model-value="item.events?.click || false"
                  label="click(evt)"
                  dense
                  dark
                  color="primary"
                  class="function-row"
                  @update:model-value="value => updateItemEvent(item, 'click', value)"
                >
                  <q-tooltip>{{ elRaw.events.click.desc_cn }}</q-tooltip>
                </q-toggle>
              </div>
            </q-expansion-item>
            </template>

            <template v-else>
              <!-- 数据源 -->
              <div class="section-title">数据源</div>
              <div class="items-input-row q-mb-sm">
                <q-toggle
                  icon="code"
                  :model-value="dataSource.isSlot"
                  color="teal"
                  dense
                  @update:model-value="handleDataSourceSlotToggle"
                >
                  <q-tooltip>
                    {{ dataSource.isSlot ? "使用 Slot 连接" : "直接输入变量名" }}
                  </q-tooltip>
                </q-toggle>
                <q-input
                  :model-value="dataSource.value"
                  label="数据数组 (变量名)"
                  placeholder="navList"
                  :disable="dataSource.isSlot"
                  dense
                  dark
                  outlined
                  debounce="100"
                  class="col"
                  @update:model-value="updateDataSourceValue"
                />
              </div>

              <!-- 循环变量 -->
              <div class="section-title q-mt-sm">循环变量</div>
              <q-input
                :model-value="properties.itemVar"
                label="循环项变量名 (itemVar)"
                placeholder="item"
                dense
                dark
                outlined
                debounce="100"
                class="q-mb-xs"
                @update:model-value="(v) => updateLoopVar('itemVar', v)"
              />
              <q-input
                :model-value="properties.indexVar"
                label="索引变量名 (indexVar)"
                placeholder="index"
                dense
                dark
                outlined
                debounce="100"
                class="q-mb-xs"
                @update:model-value="(v) => updateLoopVar('indexVar', v)"
              />
              <q-input
                :model-value="properties.keyExpression"
                label=":key 表达式"
                placeholder="index"
                dense
                dark
                outlined
                debounce="100"
                @update:model-value="(v) => updateLoopVar('keyExpression', v)"
              />

              <!-- 示例数据 -->
              <div class="section-title q-mt-sm">示例数据 (JSON,仅用于字段选择)</div>
              <q-input
                :model-value="properties.sampleData"
                type="textarea"
                autogrow
                placeholder='[{ "label": "首页", "path": "/" }]'
                dense
                dark
                outlined
                debounce="200"
                input-style="min-height: 56px"
                @update:model-value="updateSampleData"
              />
              <div
                v-if="sampleParseError"
                class="text-negative text-caption q-mt-xs"
              >
                JSON 解析失败: {{ sampleParseError }}
              </div>
              <div
                v-else-if="fieldOptions.length"
                class="text-grey-5 text-caption q-mt-xs"
              >
                可用字段: {{ fieldOptions.join(", ") }}
              </div>

              <!-- 模板属性 -->
              <div class="section-title q-mt-sm">QBreadcrumbsEl 模板属性</div>
              <div
                v-for="group in groupedElProps"
                :key="group.category"
                class="prop-group"
              >
                <div class="group-title">{{ group.category }}</div>
                <div
                  v-for="prop in group.items"
                  :key="prop.key"
                  class="prop-row"
                >
                  <q-toggle
                    icon="code"
                    :model-value="template.props?.[prop.key]?.isSlot || false"
                    dense
                    color="teal"
                    @update:model-value="
                      (value) => updateTemplatePropSlot(prop.key, value)
                    "
                  >
                    <q-tooltip>
                      {{
                        template.props?.[prop.key]?.isSlot
                          ? "使用直接输入 / 字段绑定"
                          : "使用 Slot 连接上游节点"
                      }}
                    </q-tooltip>
                  </q-toggle>

                  <q-toggle
                    v-if="prop.value.type === 'Boolean'"
                    :label="prop.key"
                    :model-value="template.props?.[prop.key]?.value === 'true'"
                    :disable="template.props?.[prop.key]?.isSlot"
                    dense
                    dark
                    color="green"
                    class="col"
                    @update:model-value="
                      (v) => updateTemplateProp(prop.key, v ? 'true' : '')
                    "
                  />

                  <q-select
                    v-else
                    :model-value="template.props?.[prop.key]?.value || ''"
                    :options="propFieldOptions(prop)"
                    :label="prop.key"
                    :disable="template.props?.[prop.key]?.isSlot"
                    use-input
                    fill-input
                    hide-selected
                    new-value-mode="add-unique"
                    dense
                    dark
                    borderless
                    options-dense
                    class="col"
                    @update:model-value="(v) => updateTemplateProp(prop.key, v)"
                  >
                    <q-tooltip>
                      {{ prop.value.desc_cn || prop.value.desc }}
                    </q-tooltip>
                  </q-select>
                </div>
              </div>

              <!-- 模板插槽 / 事件 -->
              <div class="section-title q-mt-sm">QBreadcrumbsEl 插槽</div>
              <q-toggle
                :model-value="template.slots?.default || false"
                label="default"
                dense
                dark
                color="primary"
                class="function-row"
                @update:model-value="(v) => updateTemplateSlot('default', v)"
              >
                <q-tooltip>{{ elRaw.slots.default.desc_cn }}</q-tooltip>
              </q-toggle>

              <div class="section-title q-mt-sm">QBreadcrumbsEl 事件</div>
              <q-toggle
                :model-value="template.events?.click || false"
                label="click(evt)"
                dense
                dark
                color="primary"
                class="function-row"
                @update:model-value="(v) => updateTemplateEvent('click', v)"
              >
                <q-tooltip>{{ elRaw.events.click.desc_cn }}</q-tooltip>
              </q-toggle>
            </template>
          </div>
        </q-scroll-area>
      </q-tab-panel>

      <q-tab-panel name="slot" class="panel-tab">
        <q-scroll-area class="panel-scroll">
          <div class="root-slots-panel">
            <q-toggle
              v-for="slot in rootSlots"
              :key="slot.name"
              :model-value="nodeData?.properties?.slots?.[slot.name] || false"
              :label="slot.name"
              dense
              dark
              color="primary"
              class="function-row"
              @update:model-value="value => updateRootSlot(slot.name, value)"
            >
              <q-tooltip>{{ slot.desc }}</q-tooltip>
            </q-toggle>
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
import compPropertyPanel from "../../../propertyPanel/compPropertyPanel.vue";
import compStylePanel from "../../../propertyPanel/compStylePanel.vue";
import {
  BREADCRUMBS_RAW_DATA,
  BREADCRUMBS_EL_RAW_DATA,
  createBreadcrumbPanelItem,
  removeBreadcrumbInputSlots,
  setBreadcrumbFunctionSlot,
  setBreadcrumbPropSlot,
  setBreadcrumbDataSourceSlot,
  syncBreadcrumbLoopOutputs,
} from "./QBreadcrumbs.js";

const nodeData = defineModel();
const activeTab = ref("property");
const elRaw = BREADCRUMBS_EL_RAW_DATA;
const rootSlots = Object.entries(BREADCRUMBS_RAW_DATA.slots).map(
  ([name, config]) => ({
    name,
    desc: config.desc_cn || config.desc,
  }),
);

const items = computed(() => {
  if (!nodeData.value?.properties) return [];
  return nodeData.value.properties.items;
});

watchEffect(() => {
  if (!nodeData.value?.properties) return;
  if (!Array.isArray(nodeData.value.properties.items)) {
    nodeData.value.properties.items = [];
  }
});

const groupedElProps = computed(() => {
  const groups = {};
  Object.entries(elRaw.props).forEach(([key, value]) => {
    const category = value.category || "其他";
    if (!groups[category]) groups[category] = [];
    groups[category].push({ key, value });
  });
  return Object.entries(groups).map(([category, groupItems]) => ({
    category,
    items: groupItems,
  }));
});

function triggerUpdate() {
  nodeData.value?.onExecute?.();
  nodeData.value?.graph?.setDirtyCanvas?.(true, true);
}

function addItem() {
  items.value.push(createBreadcrumbPanelItem(items.value.length));
  triggerUpdate();
}

function removeItem(index) {
  if (items.value.length <= 1) return;
  const [item] = items.value.splice(index, 1);
  removeBreadcrumbInputSlots(nodeData.value, item.id);
  triggerUpdate();
}

function itemTitle(item, index) {
  const label = displayValue(item.props?.label?.value);
  return label || `面包屑 ${index + 1}`;
}

function displayValue(value) {
  return typeof value === "string" ? value.replace(/^['"]|['"]$/g, "") : value;
}

function ensureItemProp(item, propName) {
  if (!item.props) item.props = {};
  if (!item.props[propName]) {
    item.props[propName] = {
      data: "",
      disable: false,
      isSlot: false,
      value: "",
    };
  }
}

function setPropValue(item, propName, value) {
  ensureItemProp(item, propName);
  item.props[propName].value = value;
  triggerUpdate();
}

function updatePropSlot(item, propName, value) {
  ensureItemProp(item, propName);
  setBreadcrumbPropSlot(nodeData.value, item, propName, value);
}

function updateItemSlot(item, slotName, value) {
  if (!item.slots) item.slots = {};
  item.slots[slotName] = value;
  setBreadcrumbFunctionSlot(nodeData.value, item, "slot", slotName, value);
}

function updateItemEvent(item, eventName, value) {
  if (!item.events) item.events = {};
  item.events[eventName] = value;
  setBreadcrumbFunctionSlot(nodeData.value, item, "event", eventName, value);
}

function updateRootSlot(slotName, value) {
  if (!nodeData.value?.properties) return;
  if (!nodeData.value.properties.slots) nodeData.value.properties.slots = {};
  nodeData.value.properties.slots[slotName] = value;

  const inputName = `S#${slotName}`;
  const slotIndex =
    nodeData.value.inputs?.findIndex((slot) => slot.name === inputName) ?? -1;
  if (!value && slotIndex !== -1) {
    nodeData.value.removeInput(slotIndex);
  }
  triggerUpdate();
}

/* ==================== 数据接入模式 ==================== */

const properties = computed(() => nodeData.value?.properties || {});
const template = computed(() => nodeData.value?.properties?.template || {});
const dataSource = computed(
  () => nodeData.value?.properties?.dataSource || { isSlot: false, value: "" },
);

const mode = computed({
  get: () => nodeData.value?.properties?.mode || "manual",
  set: (value) => {
    if (!nodeData.value?.properties) return;
    nodeData.value.properties.mode = value;
    // 切换模式后同步 item/index 输出槽与 data 输入槽(onExecute 内会调 ensureDataSourceSlot)
    syncBreadcrumbLoopOutputs(nodeData.value);
  },
});

// 示例数据 JSON 解析出的字段名(取数组首元素的键)。解析用户输入是 try 的正当场景:
// 失败时通过 sampleParseError 提示,不吞错。
const fieldOptions = computed(() => {
  const raw = nodeData.value?.properties?.sampleData;
  if (!raw || !raw.trim()) return [];
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return [];
  }
  const first = Array.isArray(parsed) ? parsed[0] : parsed;
  if (!first || typeof first !== "object") return [];
  return Object.keys(first);
});

const sampleParseError = computed(() => {
  const raw = nodeData.value?.properties?.sampleData;
  if (!raw || !raw.trim()) return "";
  try {
    JSON.parse(raw);
    return "";
  } catch (e) {
    return e.message;
  }
});

// 每个属性的可输入下拉选项:字段绑定(item.字段)+ 该属性原生候选(枚举/布尔/示例)
function propFieldOptions(prop) {
  const itemVar = nodeData.value?.properties?.itemVar || "item";
  const opts = fieldOptions.value.map((field) => `${itemVar}.${field}`);
  if (prop.value.type === "Boolean") {
    opts.push("true", "false");
  } else if (Array.isArray(prop.value.values)) {
    prop.value.values.forEach((v) => opts.push(JSON.stringify(v)));
  } else if (Array.isArray(prop.value.examples)) {
    prop.value.examples.forEach((v) => opts.push(JSON.stringify(v)));
  }
  return opts;
}

function handleDataSourceSlotToggle(isSlot) {
  setBreadcrumbDataSourceSlot(nodeData.value, isSlot);
}

function updateDataSourceValue(value) {
  if (!nodeData.value.properties.dataSource) {
    nodeData.value.properties.dataSource = { isSlot: false, value: "" };
  }
  nodeData.value.properties.dataSource.value = value;
  triggerUpdate();
}

function updateLoopVar(key, value) {
  nodeData.value.properties[key] = value;
  if (key === "itemVar" || key === "indexVar") {
    syncBreadcrumbLoopOutputs(nodeData.value);
  } else {
    triggerUpdate();
  }
}

function updateSampleData(value) {
  // 示例数据仅用于设计期字段下拉,不影响生成代码,无需 triggerUpdate
  nodeData.value.properties.sampleData = value;
}

function ensureTemplateProp(propName) {
  const tpl = nodeData.value.properties.template;
  if (!tpl.props) tpl.props = {};
  if (!tpl.props[propName]) {
    tpl.props[propName] = { data: "", disable: false, isSlot: false, value: "" };
  }
}

function updateTemplateProp(propName, value) {
  ensureTemplateProp(propName);
  nodeData.value.properties.template.props[propName].value = value ?? "";
  triggerUpdate();
}

// 切换模板属性的 Slot 模式(接入上游节点变量名,复用 P#<id>#<prop> 机制)
function updateTemplatePropSlot(propName, value) {
  ensureTemplateProp(propName);
  setBreadcrumbPropSlot(
    nodeData.value,
    nodeData.value.properties.template,
    propName,
    value,
  );
}

function updateTemplateSlot(slotName, value) {
  const tpl = nodeData.value.properties.template;
  if (!tpl.slots) tpl.slots = {};
  tpl.slots[slotName] = value;
  setBreadcrumbFunctionSlot(nodeData.value, tpl, "slot", slotName, value);
}

function updateTemplateEvent(eventName, value) {
  const tpl = nodeData.value.properties.template;
  if (!tpl.events) tpl.events = {};
  tpl.events[eventName] = value;
  setBreadcrumbFunctionSlot(nodeData.value, tpl, "event", eventName, value);
}
</script>

<style scoped>
.qbreadcrumbs-panel :deep(.base-property-content) {
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

.items-panel {
  padding: 4px;
}

.item-card {
  margin-bottom: 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.03);
}

.item-content {
  padding: 8px;
}

.section-title {
  color: rgba(255, 255, 255, 0.68);
  font-size: 12px;
  font-weight: 600;
  margin-bottom: 6px;
}

.group-title {
  color: rgba(255, 255, 255, 0.52);
  font-size: 11px;
  margin: 6px 0 2px;
}

.prop-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
}

.function-row {
  width: 100%;
  padding: 4px 8px;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 4px;
  background: rgba(255, 255, 255, 0.03);
}

.mode-toggle {
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 6px;
}

.items-input-row {
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
