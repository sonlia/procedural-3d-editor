<script setup>
import { computed } from "vue";
import { uid } from "quasar";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";
import { useProjectStore } from "src/stores/projectMange.js";

const props = defineModel();

const node = computed(() => props.value);
const properties = computed(() => props.value?.properties || {});
const projectStore = useProjectStore();

const generatedCodePreview = computed(
  () => props.value?.bgJsCode || props.value?.jsCode || "// No generated code",
);

const flatDbTree = computed(() => projectStore.currentProject?.database?.dbTree || []);

const tableOptions = computed(() =>
  flatDbTree.value
    .filter((item) => item.type === "table")
    .map((item) => ({ label: item.name || item.id, value: item.id })),
);

const fieldOptions = computed(() => {
  const tableId = properties.value.tableId;
  if (!tableId) return [];
  return flatDbTree.value
    .filter((item) => item.type === "field" && item.pId === tableId)
    .map((item) => ({ label: item.name || item.id, value: item.id }));
});

const directionOptions = [
  { label: "descendants", value: "descendants" },
  { label: "ancestors", value: "ancestors" },
  { label: "children", value: "children" },
];

const rootModeOptions = [
  { label: "slot", value: "slot" },
  { label: "static", value: "static" },
  { label: "roots", value: "roots" },
];

const outputModeOptions = [
  { label: "flat", value: "flat" },
  { label: "nested", value: "nested" },
];

const directionOptionsShort = [
  { label: "asc", value: "asc" },
  { label: "desc", value: "desc" },
];

const whereOperatorOptions = [
  { label: "=", value: "=" },
  { label: "!=", value: "!=" },
  { label: ">", value: ">" },
  { label: "<", value: "<" },
  { label: ">=", value: ">=" },
  { label: "<=", value: "<=" },
  { label: "LIKE", value: "like" },
  { label: "ILIKE", value: "ilike" },
  { label: "IN", value: "in" },
  { label: "NOT IN", value: "not in" },
  { label: "BETWEEN", value: "between" },
  { label: "NOT BETWEEN", value: "not between" },
  { label: "IS NULL", value: "is null" },
  { label: "IS NOT NULL", value: "is not null" },
];

function resolveName(id) {
  return flatDbTree.value.find((item) => item.id === id)?.name || id || "";
}

function refresh() {
  node.value?.syncInputSlots?.();
  node.value?.onExecute?.();
  node.value?.graph?.setDirtyCanvas?.(true, true);
}

function updateField(key, value) {
  if (!properties.value) return;
  properties.value[key] = value;
  refresh();
}

function updateRoot(key, value) {
  if (!properties.value.root) {
    properties.value.root = { mode: "slot", value: "", slotId: "rootId" };
  }
  properties.value.root[key] = value;
  refresh();
}

function updateMaxDepth(key, value) {
  if (!properties.value.maxDepth) {
    properties.value.maxDepth = { value: "10", isSlot: false, slotId: "maxDepth" };
  }
  properties.value.maxDepth[key] = value;
  refresh();
}

function updateLimit(limitKey, key, value) {
  if (!properties.value[limitKey]) {
    properties.value[limitKey] = { value: "", isSlot: false, slotId: limitKey };
  }
  properties.value[limitKey][key] = value;
  refresh();
}

function pickDefaultField(names) {
  const lowerNames = new Set(names.map((name) => name.toLowerCase()));
  return fieldOptions.value.find((item) => lowerNames.has(String(item.label).toLowerCase()))?.value || "";
}

function onTableChange(tableId) {
  properties.value.tableId = tableId;
  properties.value.idFieldId = pickDefaultField(["id"]);
  properties.value.parentFieldId = pickDefaultField([
    "parent_id",
    "parentId",
    "pid",
    "p_id",
  ]);
  properties.value.fields = {};
  properties.value.rootWhere = [];
  properties.value.nodeWhere = [];
  properties.value.orderBy = [];
  refresh();
}

const selectedFieldIds = computed(() =>
  Object.entries(properties.value.fields || {})
    .filter(([, config]) => config?.enabled)
    .map(([fieldId]) => fieldId),
);

function updateSelectedFields(ids) {
  const next = {};
  for (const id of ids || []) next[id] = { enabled: true };
  properties.value.fields = next;
  refresh();
}

function addCondition(listKey) {
  const list = [...(properties.value[listKey] || [])];
  list.push({
    id: uid(),
    fieldId: fieldOptions.value[0]?.value || "",
    operator: "=",
    value: "",
    isSlot: false,
    slotId: `${listKey}_${uid().replace(/-/g, "")}`,
  });
  properties.value[listKey] = list;
  refresh();
}

function updateCondition(listKey, index, key, value) {
  const list = [...(properties.value[listKey] || [])];
  const row = { ...(list[index] || {}) };
  row[key] = value;
  list[index] = row;
  properties.value[listKey] = list;
  refresh();
}

function removeCondition(listKey, index) {
  const list = [...(properties.value[listKey] || [])];
  list.splice(index, 1);
  properties.value[listKey] = list;
  refresh();
}

function conditionTitle(listKey) {
  return listKey === "rootWhere" ? "Root WHERE" : "Node WHERE";
}

function addOrderBy() {
  if (!Array.isArray(properties.value.orderBy)) properties.value.orderBy = [];
  properties.value.orderBy.push({
    id: uid(),
    fieldId: fieldOptions.value[0]?.value || "",
    direction: "asc",
  });
  refresh();
}

function updateOrderBy(index, key, value) {
  const row = properties.value.orderBy?.[index];
  if (!row) return;
  row[key] = value;
  refresh();
}

function removeOrderBy(index) {
  properties.value.orderBy?.splice(index, 1);
  refresh();
}
</script>

<template>
  <BasePropertyPanel v-model="props" :code-content="generatedCodePreview">
    <div v-if="properties" class="column q-pa-sm q-gutter-y-sm">
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm column q-gutter-y-sm">
          <div class="text-caption text-grey-5">Source</div>
          <q-select dense dark outlined emit-value map-options label="table" :model-value="properties.tableId"
            :options="tableOptions" @update:model-value="onTableChange" />
          <div class="row q-col-gutter-sm">
            <div class="col-6">
              <q-select dense dark outlined emit-value map-options label="id field" :model-value="properties.idFieldId"
                :options="fieldOptions" @update:model-value="updateField('idFieldId', $event)" />
            </div>
            <div class="col-6">
              <q-select dense dark outlined emit-value map-options label="parent field"
                :model-value="properties.parentFieldId" :options="fieldOptions"
                @update:model-value="updateField('parentFieldId', $event)" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm column q-gutter-y-sm">
          <div class="text-caption text-grey-5">Fields</div>
          <q-select dense dark outlined multiple emit-value map-options label="output fields"
            :model-value="selectedFieldIds" :options="fieldOptions" @update:model-value="updateSelectedFields" />
          <div class="text-caption text-grey-6">
            id field and parent field are always included for tree assembly.
          </div>
        </q-card-section>
      </q-card>

      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm column q-gutter-y-sm">
          <div class="text-caption text-grey-5">Query</div>
          <div class="row q-col-gutter-sm">
            <div class="col-6">
              <q-select dense dark outlined emit-value map-options label="direction"
                :model-value="properties.direction || 'descendants'" :options="directionOptions"
                @update:model-value="updateField('direction', $event)" />
            </div>
            <div class="col-6">
              <q-select dense dark outlined emit-value map-options label="root mode"
                :model-value="properties.root?.mode || 'slot'" :options="rootModeOptions"
                @update:model-value="updateRoot('mode', $event)" />
            </div>
          </div>

          <q-input v-if="(properties.root?.mode || 'slot') === 'static'" dense dark outlined label="root value"
            :model-value="properties.root?.value" @update:model-value="updateRoot('value', $event)" />
          <q-input v-if="(properties.root?.mode || 'slot') === 'slot'" dense dark outlined label="root slot name"
            :model-value="properties.root?.slotId || 'rootId'"
            @update:model-value="updateRoot('slotId', $event || 'rootId')" />

          <div class="row items-center q-col-gutter-sm">
            <div class="col-6">
              <q-toggle dense dark label="include root" :model-value="properties.includeRoot !== false"
                @update:model-value="updateField('includeRoot', $event)" />
            </div>
            <div class="col-6">
              <q-toggle dense dark label="maxDepth slot" :model-value="!!properties.maxDepth?.isSlot"
                @update:model-value="updateMaxDepth('isSlot', $event)" />
            </div>
          </div>
          <q-input v-if="!properties.maxDepth?.isSlot" dense dark outlined label="max depth" type="number"
            :model-value="properties.maxDepth?.value || '10'"
            @update:model-value="updateMaxDepth('value', $event || '10')" />
          <q-input v-else dense dark outlined label="maxDepth slot name"
            :model-value="properties.maxDepth?.slotId || 'maxDepth'"
            @update:model-value="updateMaxDepth('slotId', $event || 'maxDepth')" />

          <div class="row q-col-gutter-sm">
            <div class="col-6">
              <q-toggle dense dark label="rootLimit slot" :model-value="!!properties.rootLimit?.isSlot"
                @update:model-value="updateLimit('rootLimit', 'isSlot', $event)" />
              <q-input dense dark outlined :label="properties.rootLimit?.isSlot ? 'rootLimit slot name' : 'root limit'"
                :model-value="properties.rootLimit?.isSlot ? (properties.rootLimit?.slotId || 'rootLimit') : (properties.rootLimit?.value || '')"
                @update:model-value="val => updateLimit('rootLimit', properties.rootLimit?.isSlot ? 'slotId' : 'value', val)" />
            </div>
            <div class="col-6">
              <q-toggle dense dark label="totalLimit slot" :model-value="!!properties.totalLimit?.isSlot"
                @update:model-value="updateLimit('totalLimit', 'isSlot', $event)" />
              <q-input dense dark outlined
                :label="properties.totalLimit?.isSlot ? 'totalLimit slot name' : 'total limit'"
                :model-value="properties.totalLimit?.isSlot ? (properties.totalLimit?.slotId || 'totalLimit') : (properties.totalLimit?.value || '')"
                @update:model-value="val => updateLimit('totalLimit', properties.totalLimit?.isSlot ? 'slotId' : 'value', val)" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card v-for="listKey in ['rootWhere', 'nodeWhere']" :key="listKey" dark flat bordered>
        <q-card-section class="q-pa-sm column q-gutter-y-sm">
          <div class="row items-center">
            <div class="text-caption text-grey-5">{{ conditionTitle(listKey) }}</div>
            <q-space />
            <q-btn dense flat round icon="add" size="sm" @click="addCondition(listKey)" />
          </div>
          <div v-if="!(properties[listKey] || []).length" class="text-caption text-grey-6">
            No conditions.
          </div>
          <div v-for="(condition, index) in properties[listKey] || []" :key="condition.id || condition.slotId || index"
            class="row items-center q-col-gutter-sm">
            <div class="col-3">
              <q-select dense dark outlined emit-value map-options label="field" :model-value="condition.fieldId"
                :options="fieldOptions" @update:model-value="updateCondition(listKey, index, 'fieldId', $event)" />
            </div>
            <div class="col-2">
              <q-select dense dark outlined emit-value map-options label="op" :model-value="condition.operator || '='"
                :options="whereOperatorOptions"
                @update:model-value="updateCondition(listKey, index, 'operator', $event)" />
            </div>
            <div class="col-2">
              <q-toggle dense dark label="slot" :model-value="!!condition.isSlot"
                @update:model-value="updateCondition(listKey, index, 'isSlot', $event)" />
            </div>
            <div class="col">
              <q-input dense dark outlined :disable="['is null', 'is not null'].includes(condition.operator)"
                :label="condition.isSlot ? 'slot name' : 'value'"
                :model-value="condition.isSlot ? condition.slotId : condition.value"
                @update:model-value="val => updateCondition(listKey, index, condition.isSlot ? 'slotId' : 'value', val)" />
            </div>
            <div class="col-auto">
              <q-btn dense flat round icon="delete" size="sm" @click="removeCondition(listKey, index)" />
            </div>
          </div>
        </q-card-section>
      </q-card>

      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm column q-gutter-y-sm">
          <div class="text-caption text-grey-5">Output</div>
          <q-select dense dark outlined emit-value map-options label="output"
            :model-value="properties.outputMode || 'flat'" :options="outputModeOptions"
            @update:model-value="updateField('outputMode', $event)" />
          <q-toggle dense dark label="cycle guard" :model-value="properties.cycleGuard !== false"
            @update:model-value="updateField('cycleGuard', $event)" />
        </q-card-section>
      </q-card>

      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm column q-gutter-y-sm">
          <div class="row items-center justify-between">
            <div class="text-caption text-grey-5">Order by</div>
            <q-btn dense flat round icon="add" size="sm" @click="addOrderBy" />
          </div>
          <div v-for="(item, index) in properties.orderBy || []" :key="item.id || index"
            class="row items-center q-col-gutter-sm">
            <div class="col-7">
              <q-select dense dark outlined emit-value map-options label="field" :model-value="item.fieldId"
                :options="fieldOptions" @update:model-value="updateOrderBy(index, 'fieldId', $event)" />
            </div>
            <div class="col-4">
              <q-select dense dark outlined emit-value map-options label="dir" :model-value="item.direction || 'asc'"
                :options="directionOptionsShort" @update:model-value="updateOrderBy(index, 'direction', $event)" />
            </div>
            <div class="col-1 row justify-end">
              <q-btn dense flat round icon="delete" size="sm" @click="removeOrderBy(index)" />
            </div>
          </div>
          <div v-if="(properties.orderBy || []).length === 0" class="text-caption text-grey-6">
            No order fields.
          </div>
        </q-card-section>
      </q-card>

      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm text-caption text-grey-6">
          {{ resolveName(properties.tableId) }} / {{ resolveName(properties.idFieldId) }} /
          {{ resolveName(properties.parentFieldId) }}
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
