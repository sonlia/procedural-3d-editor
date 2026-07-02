<script setup>
import { computed } from "vue";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const node = computed(() => props.value);
const properties = computed(() => props.value?.properties || {});

const generatedCodePreview = computed(() => {
  const expr = node.value?._buildExpression?.();
  if (expr && expr.trim()) {
    const mode = properties.value.mode || "expression";
    const tag = mode === "predicate"
      ? "// predicate(下游 tableNode where operator='raw' 的 value slot):"
      : "// expression(下游 tableNode 字段 slot 引用):";
    return `${tag}\n${expr}`;
  }
  return "// 未生成表达式";
});

const modeOptions = [
  { label: "expression — 产 knex.jsonXxx(...) 表达式", value: "expression" },
  { label: "predicate — 产 knex.raw(...) WHERE 谓词", value: "predicate" },
];

const expressionOpOptions = [
  { label: "extract — knex.jsonExtract(col, path)", value: "extract" },
  { label: "set — knex.jsonSet(col, path, value)", value: "set" },
  { label: "insert — knex.jsonInsert(col, path, value)", value: "insert" },
  { label: "remove — knex.jsonRemove(col, path)", value: "remove" },
  { label: "value — knex.jsonValue(col, path) (标量)", value: "value" },
  { label: "path — jsonb_path_query(col, path) [PG]", value: "path" },
  { label: "arrayLength — knex.jsonArrayLength(col)", value: "arrayLength" },
  { label: "arrayInsert — knex.jsonArrayInsert(col, path, value)", value: "arrayInsert" },
];

const predicateOpOptions = [
  { label: "whereJsonObject — col::jsonb = val::jsonb", value: "whereJsonObject" },
  { label: "whereJsonPath — jsonb_path_exists(col, path)", value: "whereJsonPath" },
  { label: "whereJsonSupersetOf — col @> val", value: "whereJsonSupersetOf" },
  { label: "whereJsonSubsetOf — col <@ val", value: "whereJsonSubsetOf" },
  { label: "jsonContains — col @> val (同 supersetOf)", value: "jsonContains" },
];

const opOptions = computed(() =>
  (properties.value.mode || "expression") === "predicate"
    ? predicateOpOptions
    : expressionOpOptions,
);

const PATH_EXPR_OPS = new Set([
  "extract", "set", "insert", "remove", "value", "path", "arrayInsert",
]);
const VALUE_EXPR_OPS = new Set(["set", "insert", "arrayInsert"]);
const PATH_PRED_OPS = new Set(["whereJsonPath"]);
const VALUE_PRED_OPS = new Set([
  "whereJsonObject", "whereJsonSupersetOf", "whereJsonSubsetOf", "jsonContains",
]);

const pathVisible = computed(() => {
  const m = properties.value.mode || "expression";
  const op = properties.value.op;
  return m === "expression" ? PATH_EXPR_OPS.has(op) : PATH_PRED_OPS.has(op);
});

const valueVisible = computed(() => {
  const m = properties.value.mode || "expression";
  const op = properties.value.op;
  return m === "expression" ? VALUE_EXPR_OPS.has(op) : VALUE_PRED_OPS.has(op);
});

function updateProp(key, val) {
  if (!properties.value) return;
  properties.value[key] = val;
  // 切 mode 时把 op 重置为该 mode 下第一个合法 op,避免老 op 留在新 mode 列表里失效
  if (key === "mode") {
    const list = val === "predicate" ? predicateOpOptions : expressionOpOptions;
    const validOps = new Set(list.map((o) => o.value));
    if (!validOps.has(properties.value.op)) {
      properties.value.op = list[0].value;
    }
  }
  node.value?.syncSlots?.();
  node.value?.onExecute?.();
  node.value?.graph?.setDirtyCanvas?.(true, true);
}
</script>

<template>
  <BasePropertyPanel v-model="props" :code-content="generatedCodePreview">
    <div v-if="properties" class="column q-pa-sm q-gutter-y-sm">
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center text-body2 text-grey-4">
            <q-icon name="info" size="sm" class="q-mr-xs" />
            <span>
              必须放在 Database 子图内。expression 产表达式接 SELECT/UPDATE 字段 slot;
              predicate 产 WHERE 谓词接 tableNode where operator='raw' 的 value slot。
            </span>
          </div>
        </q-card-section>
      </q-card>

      <!-- mode -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">输出模式 (mode)</div>
          <q-select
            dense dark outlined
            :model-value="properties.mode || 'expression'"
            @update:model-value="(v) => updateProp('mode', v)"
            :options="modeOptions"
            emit-value map-options
            label="mode"
          />
        </q-card-section>
      </q-card>

      <!-- op -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">操作 (op)</div>
          <q-select
            dense dark outlined
            :model-value="properties.op"
            @update:model-value="(v) => updateProp('op', v)"
            :options="opOptions"
            emit-value map-options
            label="op"
          />
        </q-card-section>
      </q-card>

      <!-- column -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between q-mb-xs">
            <div class="text-caption text-grey-5">column (JSON 列名)</div>
            <q-toggle
              dense dark
              :model-value="properties.columnIsSlot"
              @update:model-value="(v) => updateProp('columnIsSlot', v)"
              label="isSlot"
            />
          </div>
          <q-input
            v-if="!properties.columnIsSlot"
            dense dark outlined
            :model-value="properties.column"
            @update:model-value="(v) => updateProp('column', v ?? '')"
            placeholder="settings"
            debounce="200"
          />
          <div v-else class="text-caption text-grey-6">
            input slot
            <code class="bg-grey-9 q-px-xs">{{ properties.columnSlotId }}</code>
            已挂上,连接上游传 column 名变量。
          </div>
        </q-card-section>
      </q-card>

      <!-- path -->
      <q-card v-if="pathVisible" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between q-mb-xs">
            <div class="text-caption text-grey-5">path (JSON path 表达式)</div>
            <q-toggle
              dense dark
              :model-value="properties.pathIsSlot"
              @update:model-value="(v) => updateProp('pathIsSlot', v)"
              label="isSlot"
            />
          </div>
          <q-input
            v-if="!properties.pathIsSlot"
            dense dark outlined
            :model-value="properties.path"
            @update:model-value="(v) => updateProp('path', v ?? '')"
            placeholder="$.theme"
            debounce="200"
          />
          <div v-else class="text-caption text-grey-6">
            input slot
            <code class="bg-grey-9 q-px-xs">{{ properties.pathSlotId }}</code>
            已挂上。
          </div>
        </q-card-section>
      </q-card>

      <!-- value -->
      <q-card v-if="valueVisible" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center justify-between q-mb-xs">
            <div class="text-caption text-grey-5">value (新值 / 比较值)</div>
            <q-toggle
              dense dark
              :model-value="properties.valueIsSlot"
              @update:model-value="(v) => updateProp('valueIsSlot', v)"
              label="isSlot"
            />
          </div>
          <q-input
            v-if="!properties.valueIsSlot"
            dense dark outlined
            :model-value="properties.value"
            @update:model-value="(v) => updateProp('value', v ?? '')"
            placeholder="dark / 123 / 'literal' / {&quot;k&quot;:&quot;v&quot;}"
            debounce="200"
          />
          <div v-else class="text-caption text-grey-6">
            input slot
            <code class="bg-grey-9 q-px-xs">{{ properties.valueSlotId }}</code>
            已挂上。
          </div>
          <div class="text-caption text-grey-6 q-mt-xs">
            <template v-if="(properties.mode || 'expression') === 'predicate'">
              predicate 模式 value 形如 <code class="bg-grey-9 q-px-xs">{"theme":"dark"}</code>
              或 <code class="bg-grey-9 q-px-xs">[1,2]</code>;运行时由 JSON.stringify 序列化为 jsonb 字面。
            </template>
            <template v-else>
              expression 模式 value 智能识别:数字/true/false/null 直传;
              <code class="bg-grey-9 q-px-xs">'...'</code> 已 quote 直传;
              其他按字符串字面包裹。
            </template>
          </div>
        </q-card-section>
      </q-card>

      <!-- expression preview -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">输出表达式</div>
          <pre class="code-block">{{ node?._buildExpression?.() || "// 暂无" }}</pre>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>

<style scoped>
.code-block {
  background: #1a1a1a;
  color: #d4d4d4;
  padding: 8px;
  border-radius: 4px;
  font-family: "Fira Code", Consolas, Monaco, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
  margin: 0;
}
code {
  border-radius: 3px;
  font-size: 12px;
}
</style>
