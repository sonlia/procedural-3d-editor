<template>
  <div class="list-editor">
    <q-btn-toggle
      :model-value="cfg.mode || 'manual'"
      :options="[
        { label: '手动添加', value: 'manual' },
        { label: '数据接入', value: 'data' },
      ]"
      dense dark spread no-caps unelevated
      toggle-color="primary"
      color="dark"
      class="full-width q-mb-sm mode-toggle"
      @update:model-value="setMode"
    />

    <!-- 手动模式 -->
    <template v-if="(cfg.mode || 'manual') === 'manual'">
      <q-btn
        icon="add"
        :label="`添加${itemLabel}`"
        color="primary"
        dense unelevated
        class="full-width q-mb-sm"
        @click="addItem"
      />

      <div v-if="!items.length" class="text-caption text-grey-6 text-center q-pa-sm">
        暂无{{ itemLabel }},点击上方按钮添加
      </div>

      <q-expansion-item
        v-for="(item, index) in items"
        :key="item.id"
        dense dark default-opened
        class="item-card"
        header-class="item-header"
      >
        <template #header>
          <q-item-section>
            <q-item-label>{{ itemTitle(item, index) }}</q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn icon="delete" flat dense round color="negative" @click.stop="removeItem(index)">
              <q-tooltip>删除</q-tooltip>
            </q-btn>
          </q-item-section>
        </template>

        <div class="item-content">
          <div v-for="group in groupedProps" :key="group.category" class="prop-group">
            <div class="group-title">{{ group.category }}</div>
            <div v-for="prop in group.items" :key="prop.key" class="prop-row">
              <q-toggle
                icon="code"
                :model-value="item.props[prop.key]?.isSlot || false"
                dense color="teal"
                @update:model-value="value => updatePropSlot(item, prop.key, value)"
              >
                <q-tooltip>{{ item.props[prop.key]?.isSlot ? "使用直接输入" : "使用 Slot 连接" }}</q-tooltip>
              </q-toggle>

              <q-toggle
                v-if="prop.value.type === 'Boolean'"
                :label="prop.key"
                :model-value="!!item.props[prop.key]?.value"
                :disable="item.props[prop.key]?.isSlot"
                dense dark color="green" class="col"
                @update:model-value="value => setPropValue(item, prop.key, value)"
              />
              <q-select
                v-else-if="prop.value.values"
                :label="prop.key"
                :model-value="displayValue(item.props[prop.key]?.value)"
                :disable="item.props[prop.key]?.isSlot"
                :options="prop.value.values"
                dense dark borderless class="col"
                @update:model-value="value => setPropValue(item, prop.key, value ? JSON.stringify(value) : '')"
              />
              <q-input
                v-else
                :label="prop.key"
                :model-value="item.props[prop.key]?.value || ''"
                :disable="item.props[prop.key]?.isSlot"
                dense dark borderless debounce="100" class="col"
                @update:model-value="value => setPropValue(item, prop.key, value)"
              >
                <q-tooltip>{{ prop.value.desc_cn }}(JS 表达式,字符串需带引号)</q-tooltip>
              </q-input>
            </div>
          </div>

          <q-toggle
            v-if="showClickEvent"
            :model-value="item.events?.click || false"
            label="click(evt)"
            dense dark color="primary" class="function-row q-mt-xs"
            @update:model-value="value => updateClick(item, value)"
          >
            <q-tooltip>连 FunctionBlock 处理点击</q-tooltip>
          </q-toggle>
        </div>
      </q-expansion-item>
    </template>

    <!-- 数据接入模式 -->
    <template v-else>
      <div class="section-title">数据源</div>
      <div class="items-input-row q-mb-sm">
        <q-toggle
          icon="code"
          :model-value="cfg.dataSource?.isSlot || false"
          color="teal" dense
          @update:model-value="handleDataSourceSlotToggle"
        >
          <q-tooltip>{{ cfg.dataSource?.isSlot ? "使用 Slot 连接" : "直接输入变量名" }}</q-tooltip>
        </q-toggle>
        <q-input
          :model-value="cfg.dataSource?.value || ''"
          label="数据数组 (变量名)"
          :disable="cfg.dataSource?.isSlot"
          dense dark outlined debounce="100" class="col"
          @update:model-value="updateDataSourceValue"
        />
      </div>

      <div class="section-title q-mt-sm">循环变量</div>
      <q-input
        :model-value="cfg.itemVar" label="循环项变量名 (itemVar)"
        dense dark outlined debounce="100" class="q-mb-xs"
        @update:model-value="(v) => updateLoopVar('itemVar', v)"
      />
      <q-input
        :model-value="cfg.indexVar" label="索引变量名 (indexVar)"
        dense dark outlined debounce="100" class="q-mb-xs"
        @update:model-value="(v) => updateLoopVar('indexVar', v)"
      />
      <q-input
        :model-value="cfg.keyExpression" label=":key 表达式"
        dense dark outlined debounce="100"
        @update:model-value="(v) => updateLoopVar('keyExpression', v)"
      />

      <div class="section-title q-mt-sm">示例数据 (JSON,仅用于字段选择)</div>
      <q-input
        :model-value="cfg.sampleData"
        type="textarea" autogrow
        placeholder='[{ "name": "s1" }]'
        dense dark outlined debounce="200"
        input-style="min-height: 56px"
        @update:model-value="updateSampleData"
      />
      <div v-if="sampleParseError" class="text-negative text-caption q-mt-xs">JSON 解析失败: {{ sampleParseError }}</div>
      <div v-else-if="fieldOptions.length" class="text-grey-5 text-caption q-mt-xs">可用字段: {{ fieldOptions.join(", ") }}</div>

      <div class="section-title q-mt-sm">{{ itemLabel }}模板属性</div>
      <div v-for="group in groupedProps" :key="group.category" class="prop-group">
        <div class="group-title">{{ group.category }}</div>
        <div v-for="prop in group.items" :key="prop.key" class="prop-row">
          <q-toggle
            icon="code"
            :model-value="template.props?.[prop.key]?.isSlot || false"
            dense color="teal"
            @update:model-value="(value) => updateTemplatePropSlot(prop.key, value)"
          >
            <q-tooltip>{{ template.props?.[prop.key]?.isSlot ? "使用直接输入 / 字段绑定" : "使用 Slot 连接上游节点" }}</q-tooltip>
          </q-toggle>

          <q-toggle
            v-if="prop.value.type === 'Boolean'"
            :label="prop.key"
            :model-value="template.props?.[prop.key]?.value === 'true'"
            :disable="template.props?.[prop.key]?.isSlot"
            dense dark color="green" class="col"
            @update:model-value="(v) => updateTemplateProp(prop.key, v ? 'true' : '')"
          />
          <q-select
            v-else
            :model-value="template.props?.[prop.key]?.value || ''"
            :options="propFieldOptions(prop)"
            :label="prop.key"
            :disable="template.props?.[prop.key]?.isSlot"
            use-input fill-input hide-selected new-value-mode="add-unique"
            dense dark borderless options-dense class="col"
            @update:model-value="(v) => updateTemplateProp(prop.key, v)"
          >
            <q-tooltip>{{ prop.value.desc_cn || prop.value.desc }}</q-tooltip>
          </q-select>
        </div>
      </div>

      <q-toggle
        v-if="showClickEvent"
        :model-value="template.events?.click || false"
        label="click(evt)"
        dense dark color="primary" class="function-row q-mt-xs"
        @update:model-value="(v) => updateClick(template, v)"
      >
        <q-tooltip>连 FunctionBlock 处理点击(作用域 item/index)</q-tooltip>
      </q-toggle>
    </template>

    <!-- 内容连接提示(幻灯片) -->
    <div v-if="contentHint" class="content-hint q-mt-sm">
      <q-icon name="info" size="xs" class="q-mr-xs" />{{ contentHint }}
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import {
  removeItemInputSlots,
  setItemPropSlot,
  setItemClickSlot,
  setListDataSourceSlot,
  syncCarouselLoopOutputs,
} from "./QCarousel.js";

const cfg = defineModel("cfg", { type: Object, required: true });
const props = defineProps({
  node: { type: Object, default: null },
  rawProps: { type: Object, required: true },
  itemLabel: { type: String, default: "项" },
  dataSlotName: { type: String, required: true },
  showClickEvent: { type: Boolean, default: false },
  contentHint: { type: String, default: "" },
  createItem: { type: Function, required: true },
});

const items = computed(() => cfg.value.items || []);
const template = computed(() => cfg.value.template || {});

const groupedProps = computed(() => {
  const groups = {};
  Object.entries(props.rawProps).forEach(([key, value]) => {
    const category = value.category || "其他";
    if (!groups[category]) groups[category] = [];
    groups[category].push({ key, value });
  });
  return Object.entries(groups).map(([category, list]) => ({ category, items: list }));
});

function triggerUpdate() {
  props.node?.onExecute?.();
  props.node?.graph?.setDirtyCanvas?.(true, true);
}

function displayValue(value) {
  return typeof value === "string" ? value.replace(/^['"]|['"]$/g, "") : value;
}

/* ===== 手动 ===== */
function itemTitle(item, index) {
  const name = displayValue(item.props?.name?.value || item.props?.label?.value);
  return name || `${props.itemLabel} ${index + 1}`;
}

function addItem() {
  items.value.push(props.createItem(items.value.length));
  triggerUpdate();
}

function removeItem(index) {
  const [item] = items.value.splice(index, 1);
  if (item) removeItemInputSlots(props.node, item.id);
  triggerUpdate();
}

function ensureProp(item, propName) {
  if (!item.props) item.props = {};
  if (!item.props[propName]) {
    item.props[propName] = { data: "", disable: false, isSlot: false, value: "" };
  }
}

function setPropValue(item, propName, value) {
  ensureProp(item, propName);
  item.props[propName].value = value;
  triggerUpdate();
}

function updatePropSlot(item, propName, value) {
  ensureProp(item, propName);
  setItemPropSlot(props.node, item, propName, value);
}

function updateClick(item, value) {
  setItemClickSlot(props.node, item, value);
}

/* ===== 数据接入 ===== */
const fieldOptions = computed(() => {
  const raw = cfg.value.sampleData;
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
  const raw = cfg.value.sampleData;
  if (!raw || !raw.trim()) return "";
  try {
    JSON.parse(raw);
    return "";
  } catch (e) {
    return e.message;
  }
});

function propFieldOptions(prop) {
  const itemVar = cfg.value.itemVar || "item";
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

function setMode(mode) {
  cfg.value.mode = mode;
  syncCarouselLoopOutputs(props.node);
}

function handleDataSourceSlotToggle(isSlot) {
  setListDataSourceSlot(props.node, cfg.value, props.dataSlotName, isSlot);
}

function updateDataSourceValue(value) {
  if (!cfg.value.dataSource) cfg.value.dataSource = { isSlot: false, value: "" };
  cfg.value.dataSource.value = value;
  triggerUpdate();
}

function updateLoopVar(key, value) {
  cfg.value[key] = value;
  if (key === "itemVar" || key === "indexVar") syncCarouselLoopOutputs(props.node);
  else triggerUpdate();
}

function updateSampleData(value) {
  // 仅设计期字段下拉,不影响生成代码
  cfg.value.sampleData = value;
}

function ensureTemplateProp(propName) {
  const tpl = cfg.value.template;
  if (!tpl.props) tpl.props = {};
  if (!tpl.props[propName]) tpl.props[propName] = { data: "", disable: false, isSlot: false, value: "" };
}

function updateTemplateProp(propName, value) {
  ensureTemplateProp(propName);
  cfg.value.template.props[propName].value = value ?? "";
  triggerUpdate();
}

function updateTemplatePropSlot(propName, value) {
  ensureTemplateProp(propName);
  setItemPropSlot(props.node, cfg.value.template, propName, value);
}
</script>

<style scoped>
.list-editor {
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

.content-hint {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.5);
  line-height: 1.4;
}
</style>
