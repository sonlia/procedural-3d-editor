<script setup>
import { watch, computed } from 'vue';
import { uid } from 'quasar';
import { set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();

const properties = computed(() => props.value?.properties || {});

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 触发图形重新执行以刷新 jsCode
function triggerGraphRun() {
  props.value.onExecute?.();
  if (props.value?.graph) {
    props.value.graph.runStep();
  }
}

// 比较操作符（带描述）
const comparisonOperators = [
  { label: '<', value: '<', description: '小于' },
  { label: '>', value: '>', description: '大于' },
  { label: '<=', value: '<=', description: '小于等于' },
  { label: '>=', value: '>=', description: '大于等于' },
  { label: '==', value: '==', description: '相等（类型转换）' },
  { label: '!=', value: '!=', description: '不等（类型转换）' },
  { label: '===', value: '===', description: '严格相等' },
  { label: '!==', value: '!==', description: '严格不等' }
];

// 逻辑连接符（带描述）
const logicConnectors = [
  { label: '&&', value: '&&', description: '与：两者都为真' },
  { label: '||', value: '||', description: '或：任一为真' }
];

// --- Condition 管理 ---
function createCondition() {
  return {
    id: uid(),
    lhs: '',
    lhsIsSlot: false,
    op: '===',
    rhs: '',
    rhsIsSlot: false,
    connector: '&&'
  };
}

function addCondition() {
  if (!properties.value.conditions) {
    properties.value.conditions = [];
  }
  properties.value.conditions.push(createCondition());
  triggerGraphRun();
}

function removeCondition(index) {
  properties.value.conditions.splice(index, 1);
  triggerGraphRun();
}

function updateCondition(index, key, value) {
  set(properties.value.conditions[index], key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// --- passIn 管理（数据流入节点）---
function addPassIn() {
  const newParam = {
    id: uid(),
    name: `in${properties.value.passIn?.length || 0}`
  };

  if (!properties.value.passIn) {
    properties.value.passIn = [];
  }
  properties.value.passIn.push(newParam);
  props.value.addInput(newParam.name, 'string', {
    id: newParam.id,
    isPassIn: true
  });
  triggerGraphRun();
}

function removePassIn(paramId, index) {
  const existingIndex = props.value.inputs.findIndex(i => i.id === paramId);
  if (existingIndex !== -1) {
    props.value.removeInput(existingIndex);
  }
  properties.value.passIn.splice(index, 1);
  triggerGraphRun();
}

function updatePassInName(param, newName) {
  if (!param) return;
  param.name = newName;
  const slot = props.value.inputs.find(i => i.id === param.id);
  if (slot) {
    slot.name = newName;
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}

// --- passOut 管理（数据流出节点）---
function addPassOut() {
  const newParam = {
    id: uid(),
    name: `out${properties.value.passOut?.length || 0}`
  };

  if (!properties.value.passOut) {
    properties.value.passOut = [];
  }
  properties.value.passOut.push(newParam);
  props.value.addOutput(newParam.name, 'string', { id: newParam.id });
  triggerGraphRun();
}

function removePassOut(paramId, index) {
  const existingIndex = props.value.outputs.findIndex(o => o.id === paramId);
  if (existingIndex !== -1) {
    props.value.removeOutput(existingIndex);
  }
  properties.value.passOut.splice(index, 1);
  triggerGraphRun();
}

function updatePassOutName(param, newName) {
  if (!param) return;
  param.name = newName;
  const slot = props.value.outputs.find(o => o.id === param.id);
  if (slot) {
    slot.name = newName;
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}

// --- 可用变量（passIn + passOut 的变量名）---
const availableVars = computed(() => {
  const inputs = properties.value.passIn?.map(p => p.name) || [];
  const outputs = properties.value.passOut?.map(p => p.name) || [];
  return [...inputs, ...outputs];
});

// --- 初始化同步 watchers ---
// 注意：conditions 已在节点类 constructor 中初始化，无需在此创建默认条件

// 初始化同步：passIn
watch(() => properties.value.passIn, (params) => {
  if (!Array.isArray(params)) return;
  params.forEach(p => {
    const exists = props.value.inputs?.some(i => i.id === p.id);
    if (!exists) {
      props.value.addInput(p.name, 'string', {
        id: p.id,
        isPassIn: true
      });
    }
  });
}, { immediate: true, deep: true });

// 初始化同步：passOut
watch(() => properties.value.passOut, (params) => {
  if (!Array.isArray(params)) return;
  params.forEach(p => {
    const exists = props.value.outputs?.some(o => o.id === p.id);
    if (!exists) {
      props.value.addOutput(p.name, 'string', { id: p.id });
    }
  });
}, { immediate: true, deep: true });
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- Condition Builder -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption q-mb-xs">While Condition</div>

          <div v-for="(cond, index) in (properties.conditions || [])" :key="cond.id" class="q-mt-sm">
            <q-select v-if="index > 0" dense dark outlined :model-value="properties.conditions[index - 1].connector"
              @update:model-value="val => updateCondition(index - 1, 'connector', val)" :options="logicConnectors"
              emit-value map-options class="q-mb-sm">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <div style="position: relative;">
              <div class="q-pa-sm rounded-borders" style="border: 1px solid #444; padding-right: 42px;">
                <!-- A [op] B 同一行 -->
                <div class="row items-center q-gutter-x-sm no-wrap">
                  <!-- A -->
                  <q-toggle dense dark :model-value="cond.lhsIsSlot"
                    @update:model-value="val => updateCondition(index, 'lhsIsSlot', val)" style="flex-shrink: 0;" />
                  <q-select v-if="cond.lhsIsSlot" dense dark outlined style="min-width: 70px; flex: 1;"
                    :model-value="cond.lhs" @update:model-value="val => updateCondition(index, 'lhs', val)"
                    :options="availableVars" />
                  <q-input v-else dense dark outlined style="min-width: 70px; flex: 1;" :model-value="cond.lhs"
                    @update:model-value="val => updateCondition(index, 'lhs', val)" />
                  <!-- Operator -->
                  <q-select dense dark outlined style="width: 70px; flex-shrink: 0;" :model-value="cond.op"
                    @update:model-value="val => updateCondition(index, 'op', val)" :options="comparisonOperators"
                    emit-value map-options>
                    <template v-slot:option="scope">
                      <q-item v-bind="scope.itemProps">
                        <q-item-section>
                          <q-item-label>{{ scope.opt.label }}</q-item-label>
                          <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                        </q-item-section>
                      </q-item>
                    </template>
                  </q-select>
                  <!-- B -->
                  <q-toggle dense dark :model-value="cond.rhsIsSlot"
                    @update:model-value="val => updateCondition(index, 'rhsIsSlot', val)" style="flex-shrink: 0;" />
                  <q-select v-if="cond.rhsIsSlot" dense dark outlined style="min-width: 70px; flex: 1;"
                    :model-value="cond.rhs" @update:model-value="val => updateCondition(index, 'rhs', val)"
                    :options="availableVars" />
                  <q-input v-else dense dark outlined style="min-width: 70px; flex: 1;" :model-value="cond.rhs"
                    @update:model-value="val => updateCondition(index, 'rhs', val)" />
                </div>
              </div>
              <q-btn flat dense icon="close" color="negative" @click="removeCondition(index)"
                style="position: absolute; right: 8px; top: 8px;" />
            </div>
          </div>
          <q-btn flat dense no-caps label="Add Condition" color="primary" @click="addCondition"
            class="q-mt-sm full-width" />
        </q-card-section>
      </q-card>

      <!-- 传入列表（数据流入节点）-->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption q-mb-xs">传入</div>

          <div v-for="(p, index) in (properties.passIn || [])" :key="p.id"
            class="row items-center q-gutter-x-sm q-mt-xs">
            <q-input dense dark outlined style="flex:1" :model-value="p.name"
              @update:model-value="val => updatePassInName(p, val)" placeholder="变量名">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    传入子图的变量名<br />
                    示例: counter, index
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
            <q-btn flat dense icon="close" color="negative" @click="removePassIn(p.id, index)" />
          </div>
          <q-btn flat dense no-caps label="+ 添加传入" color="primary" @click="addPassIn" class="q-mt-sm full-width" />
        </q-card-section>
      </q-card>

      <!-- 传出列表（数据流出节点）-->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption q-mb-xs">传出</div>

          <div v-for="(p, index) in (properties.passOut || [])" :key="p.id"
            class="row items-center q-gutter-x-sm q-mt-xs">
            <q-input dense dark outlined style="flex:1" :model-value="p.name"
              @update:model-value="val => updatePassOutName(p, val)" placeholder="变量名">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    从子图传出的变量名<br />
                    示例: result, sum
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
            <q-btn flat dense icon="close" color="negative" @click="removePassOut(p.id, index)" />
          </div>
          <q-btn flat dense no-caps label="+ 添加传出" color="primary" @click="addPassOut" class="q-mt-sm full-width" />
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
