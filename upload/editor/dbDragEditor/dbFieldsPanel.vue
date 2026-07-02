<script setup>
import { ref, computed } from "vue";
import { useDbMetadata } from "./hooks/useDbMetadata";
import {
  useDbConfig,
  nodeData,
  client,
  currentSelectTreeNode,
} from "./hooks/useDbConfig";
import { graphIns } from "./hooks/useDbGraphEditor.js";

const { getFieldTypes, getFieldTypeDef } = useDbMetadata();
const { getConfig, updateConfig } = useDbConfig();

// 系统字段不可编辑
const isSystemField = computed(() => !!currentSelectTreeNode.value?.system);

// 字段类型选项
const fieldTypeOptions = computed(() => getFieldTypes(client.value, true));

// 当前字段类型定义
const currentTypeDef = computed(() => getFieldTypeDef(nodeData.value.fieldType));

// 当前类型的参数定义（用于智能显示）
const typeParamsDef = computed(() => currentTypeDef.value?.params || {});

// 是否显示自增（仅 integer / bigInteger）
const showAutoIncrement = computed(() =>
  ["integer", "bigInteger"].includes(nodeData.value.fieldType)
);

// 自增状态下锁定主键和非空
const isAutoIncrement = computed(() => !!nodeData.value.autoIncrement);

// 是否是 specificType（隐藏约束区域）
const isSpecificType = computed(() => nodeData.value.fieldType === "specificType");

// 默认值快捷选项（根据类型动态生成，不含"无"和"自定义"）
const defaultValueOptions = computed(() => {
  if (isAutoIncrement.value) return [];
  return currentTypeDef.value?.defaultValueOptions || [];
});

// ─── 字段类型 ───
const fieldType = computed({
  get: () => getConfig("fieldType") || "string",
  set: (val) => updateConfig("fieldType", val),
});

// ─── 类型参数的 getter/setter ───
const getTypeParam = (paramKey) => {
  const params = nodeData.value.typeParams || {};
  if (params[paramKey] !== undefined) return params[paramKey];
  return typeParamsDef.value[paramKey]?.default ?? null;
};

const setTypeParam = (paramKey, value) => {
  updateConfig(`typeParams.${paramKey}`, value);
};

// ─── 自增 ───
const autoIncrement = computed({
  get: () => !!getConfig("autoIncrement"),
  set: (val) => updateConfig("autoIncrement", val),
});

// ─── 约束属性 ───
const isNotNullable = computed({
  get: () => !!getConfig("notNullable"),
  set: (val) => updateConfig("notNullable", val),
});
const isPrimary = computed({
  get: () => !!getConfig("primary"),
  set: (val) => updateConfig("primary", val),
});
const isUnique = computed({
  get: () => !!getConfig("unique"),
  set: (val) => updateConfig("unique", val),
});

// ─── 默认值 Combobox ───
const defaultValueInput = ref("");
const filteredDefaultOptions = ref([]);

const filterDefaultOptions = (val, update) => {
  update(() => {
    const options = defaultValueOptions.value;
    if (!val) {
      filteredDefaultOptions.value = options;
    } else {
      const needle = val.toLowerCase();
      filteredDefaultOptions.value = options.filter(
        (o) => o.label.toLowerCase().includes(needle)
      );
    }
  });
};

const onDefaultInput = (val) => {
  defaultValueInput.value = val;
};

const onDefaultSelect = (val) => {
  updateConfig("defaultValue", val || "");
};

const onDefaultBlur = () => {
  const typed = defaultValueInput.value;
  const current = getConfig("defaultValue") || "";
  if (typed !== current) {
    updateConfig("defaultValue", typed);
  }
};

const onDefaultClear = () => {
  updateConfig("defaultValue", "");
};

// ─── 注释用 blur 提交 ───
const tempComment = ref("");
const tempTypeParams = ref({});

const updateFinalValue = (path) => {
  if (path === "comment" && tempComment.value !== undefined) {
    updateConfig("comment", tempComment.value);
    tempComment.value = "";
  }
};

// ─── JOIN 关联只读提示（从 LiteGraph link 实时获取） ───
const fieldJoinHint = computed(() => {
  const fieldId = currentSelectTreeNode.value?.id;
  if (!fieldId || !graphIns.value) return null;

  // 查找当前表节点，遍历 inputs 找到匹配 slot
  for (const nodeId in graphIns.value._nodes_by_id) {
    const node = graphIns.value._nodes_by_id[nodeId];
    if (!node?.inputs) continue;

    const input = node.inputs.find((s) => s.id === fieldId);
    if (!input || input.link == null) continue;

    const link = graphIns.value.links[input.link];
    if (!link) return null;

    const sourceNode = graphIns.value.getNodeById(link.origin_id);
    const sourceSlot = sourceNode?.outputs?.[link.origin_slot];
    return `${sourceNode?.title || ""}.${sourceSlot?.name || ""}`;
  }
  return null;
});
</script>

<template>
  <div class="column no-wrap full-height q-pa-md">
    <div class="col-grow q-col-gutter-md">
      <!-- 字段名（只读） -->
      <div class="col-12">
        <q-input
          :model-value="currentSelectTreeNode?.name"
          label="字段名"
          dark dense outlined readonly
        />
      </div>

      <!-- 字段类型 -->
      <div class="col-12">
        <q-select
          v-model="fieldType"
          :options="fieldTypeOptions"
          label="字段类型"
          dark dense outlined
          emit-value map-options
          :disable="isSystemField"
        />
      </div>

      <!-- 智能类型参数 -->
      <template v-for="(paramDef, paramKey) in typeParamsDef" :key="paramKey">
        <!-- 跳过 autoIncrement，它在约束区域显示 -->
        <template v-if="paramKey !== 'autoIncrement'">
          <!-- 布尔参数 → 复选框 -->
          <div v-if="paramDef.type === 'boolean'" class="col-12">
            <q-checkbox
              :model-value="!!getTypeParam(paramKey)"
              @update:model-value="(val) => setTypeParam(paramKey, val)"
              :label="paramDef.label"
              dark dense
            />
          </div>
          <!-- 数值参数 → 数字输入框 -->
          <div v-else-if="paramDef.type === 'number'" class="col-12">
            <q-input
              :model-value="getTypeParam(paramKey)"
              @update:model-value="(val) => (tempTypeParams[paramKey] = val ? Number(val) : null)"
              @keyup.enter="(e) => e.target.blur()"
              @blur="() => { if (tempTypeParams[paramKey] !== undefined) { setTypeParam(paramKey, tempTypeParams[paramKey]); delete tempTypeParams[paramKey]; } }"
              :label="paramDef.label"
              :placeholder="paramDef.default != null ? String(paramDef.default) : '可选'"
              dark dense outlined
              type="number"
            />
          </div>
          <!-- 文本参数 → 文本输入框 -->
          <div v-else-if="paramDef.type === 'text'" class="col-12">
            <q-input
              :model-value="getTypeParam(paramKey)"
              @update:model-value="(val) => (tempTypeParams[paramKey] = val)"
              @keyup.enter="(e) => e.target.blur()"
              @blur="() => { if (tempTypeParams[paramKey] !== undefined) { setTypeParam(paramKey, tempTypeParams[paramKey]); delete tempTypeParams[paramKey]; } }"
              :label="paramDef.label"
              :placeholder="paramDef.label"
              dark dense outlined
            />
          </div>
        </template>
      </template>

      <!-- 默认值 (Combobox: 下拉选快捷值 / 直接输入自定义值 / 清空=无) -->
      <div class="col-12" v-if="!isAutoIncrement">
        <q-select
          :model-value="getConfig('defaultValue') || null"
          :options="filteredDefaultOptions"
          label="默认值"
          use-input
          hide-selected
          fill-input
          clearable
          input-debounce="0"
          dark dense outlined
          emit-value map-options
          placeholder="留空表示无默认值"
          :disable="isSystemField"
          @filter="filterDefaultOptions"
          @input-value="onDefaultInput"
          @update:model-value="onDefaultSelect"
          @clear="onDefaultClear"
          @blur="onDefaultBlur"
        >
          <template v-slot:no-option>
            <q-item>
              <q-item-section class="text-grey">
                输入自定义值，失焦后自动保存
              </q-item-section>
            </q-item>
          </template>
        </q-select>
      </div>
      <div class="col-12" v-if="isAutoIncrement">
        <q-input
          model-value="(自增，无需默认值)"
          label="默认值"
          dark dense outlined readonly
        />
      </div>

      <!-- 约束属性 -->
      <div class="row q-mt-md" v-if="!isSpecificType">
        <q-checkbox
          v-if="showAutoIncrement"
          class="col text-white"
          v-model="autoIncrement"
          label="自增"
          dark
          :disable="isSystemField"
        />
        <q-checkbox
          class="col text-white"
          :model-value="isNotNullable"
          @update:model-value="(val) => (isNotNullable = val)"
          label="非空"
          dark
          :disable="isAutoIncrement || isSystemField"
        />
        <q-checkbox
          class="col text-white"
          :model-value="isPrimary"
          @update:model-value="(val) => (isPrimary = val)"
          label="主键"
          dark
          :disable="isAutoIncrement || isSystemField"
        />
        <q-checkbox
          class="col text-white"
          v-model="isUnique"
          label="唯一"
          dark
          :disable="isSystemField"
        />
      </div>

      <!-- JOIN 关联只读提示 -->
      <div v-if="fieldJoinHint" class="col-12">
        <q-input
          :model-value="fieldJoinHint"
          label="关联"
          dark dense outlined readonly
        >
          <template #prepend>
            <q-icon name="mdi-link-variant" size="sm" color="blue" />
          </template>
        </q-input>
      </div>
    </div>

    <!-- 注释 -->
    <div class="col-auto q-mt-auto">
      <div class="col-12">
        <q-input
          :model-value="getConfig('comment')"
          @update:model-value="(val) => (tempComment = val)"
          @keyup.enter="(e) => e.target.blur()"
          @blur="() => updateFinalValue('comment')"
          label="注释"
          dark dense outlined autogrow
          :disable="isSystemField"
        />
      </div>
    </div>
  </div>
</template>

<style scoped></style>
