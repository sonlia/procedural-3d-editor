<script setup>
import { ref, onMounted, watch } from 'vue';
import { uid } from 'quasar';
import { cloneDeep, isEqual, get, set } from 'lodash-es';
import { isFunctionParam, parseFunctionSignature } from '../utils.js';
import BasePropertyPanel from '../../../propertyPanel/BasePropertyPanel.vue';

const props = defineModel(); // node 实例

// --- 数据模型 & 同步 ---
const defaultProperties = () => ({
  exported: false,
  declareType: 'const',
  outputVar: { id: uid(), isSlot: false, value: `promise_${uid().slice(0, 8)}`, label: 'Name' },
  creationType: 'new', // 'new', 'resolve', 'reject', 'all', etc.
  creationParams: [],
  handlers: [], // { id, type: 'then' | 'catch' | 'finally', params: [] }
  remark: ''
});
const localProperties = ref(defaultProperties());

onMounted(() => {
  const initialProps = { ...defaultProperties(), ...cloneDeep(props.value?.properties ?? {}) };
  if (!Array.isArray(initialProps.creationParams)) initialProps.creationParams = [];
  if (!Array.isArray(initialProps.handlers)) initialProps.handlers = [];

  if (!isEqual(localProperties.value, initialProps)) {
    localProperties.value = initialProps;
    // Set initial params after props merge
    if (initialProps.creationParams.length === 0) {
      onCreationTypeChange(initialProps.creationType, false);
    }
  }
  if (!isEqual(props.value.properties, localProperties.value)) {
    props.value.properties = cloneDeep(localProperties.value);
  }
});

// Watchers
watch(localProperties, (newVal) => {
  if (!isEqual(props.value.properties, newVal)) {
    props.value.properties = cloneDeep(newVal);
    props.value.onExecute?.();
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}, { deep: true });
watch(() => props.value?.properties, (newVal) => {
  if (!isEqual(newVal, localProperties.value)) localProperties.value = { ...defaultProperties(), ...cloneDeep(newVal ?? {}) };
}, { deep: true });

// --- Promise 操作地图 ---
const creationMap = {
  'new': { params: ['executor(resolve, reject)'], desc: '创建一个新的 Promise 对象' },
  'resolve': { params: ['value'], desc: '返回一个以给定值解析的 Promise 对象' },
  'reject': { params: ['reason'], desc: '返回一个以给定原因拒绝的 Promise 对象' },
  'all': { params: ['iterable'], desc: '当所有 Promise 都成功时返回结果数组，任一失败则立即拒绝' },
  'allSettled': { params: ['iterable'], desc: '等待所有 Promise 完成（无论成功或失败），返回每个结果的状态' },
  'race': { params: ['iterable'], desc: '返回第一个完成的 Promise 结果（无论成功或失败）' },
  'any': { params: ['iterable'], desc: '返回第一个成功的 Promise 结果，全部失败则拒绝' },
};
const handlerMap = {
  'then': { params: ['onFulfilled(value)', 'onRejected(reason)'], desc: '添加成功和/或失败的回调处理' },
  'catch': { params: ['onRejected(reason)'], desc: '添加失败时的回调处理' },
  'finally': { params: ['onFinally()'], desc: '添加无论成功失败都会执行的回调' },
};
const creationOptions = Object.keys(creationMap).map(m => ({ label: m, value: m, description: creationMap[m].desc }));
const handlerOptions = Object.keys(handlerMap).map(m => ({ label: m, value: m, description: handlerMap[m].desc }));

function createParam(label) {
  return { id: uid(), label, isSlot: false, value: '' };
}

// --- UI 事件处理 ---
function updateField(key, value) { set(localProperties.value, key, value); }

function updateSlot(param, isSlot, prefix = '') {
  param.isSlot = isSlot;
  const isFunc = isFunctionParam(param.label);
  // 函数参数是被当前节点消费的，所以添加到 inputs（参考 compEventsPanel）
  const existingIdx = props.value.inputs.findIndex(s => s.id === param.id);
  const slotLabel = `${prefix}${param.label.split('(')[0]}`;

  if (isSlot && existingIdx === -1) {
    if (isFunc) {
      const signature = parseFunctionSignature(param.label);
      props.value.addInput(slotLabel, "function", { id: param.id, shape: 5, meta: { isFunction: true, args: signature.args } });
    } else {
      props.value.addInput(slotLabel, 'string', { id: param.id });
    }
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
}

function onCreationTypeChange(newType, cleanup = true) {
  updateField('creationType', newType);
  if (cleanup) {
    localProperties.value.creationParams.forEach(p => updateSlot(p, false));
  }
  const newParams = (creationMap[newType]?.params || []).map(l => createParam(l));
  updateField('creationParams', newParams);
}

function addHandler() {
  localProperties.value.handlers.push({
    id: uid(), type: 'then', params: handlerMap.then.params.map(l => createParam(l))
  });
}
function removeHandler(idx) {
  const [removed] = localProperties.value.handlers.splice(idx, 1);
  if (removed) removed.params.forEach(p => updateSlot(p, false));
}
function onHandlerTypeChange(handler, newType) {
  handler.type = newType;
  handler.params.forEach(p => updateSlot(p, false));
  handler.params = (handlerMap[newType]?.params || []).map(l => createParam(l));
}
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- Declaration Card -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-checkbox dense dark v-model="localProperties.exported" label="Export" class="q-mb-xs"
            :disable="localProperties.outputVar?.isSlot" />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName" :model-value="localProperties.outputVar?.isSlot"
              @update:model-value="val => updateSlot(localProperties.outputVar, val, 'Var-')"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined style="width:80px" :options="['const', 'let']"
              :disable="localProperties.outputVar?.isSlot" v-model="localProperties.declareType" />
            <q-input dense dark outlined class="col" :model-value="localProperties.outputVar?.value"
              @update:model-value="val => updateField('outputVar.value', val)"
              :disable="localProperties.outputVar?.isSlot" placeholder="变量名" />
          </div>
        </q-card-section>
      </q-card>

      <!-- Creation Card -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-select dense dark outlined :options="creationOptions" v-model="localProperties.creationType"
            @update:model-value="onCreationTypeChange" emit-value map-options label="Creation Type">
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <div v-for="p in localProperties.creationParams" :key="p.id" class="row items-center q-mt-xs no-wrap">
            <q-toggle :model-value="p.isSlot" @update:model-value="(val) => updateSlot(p, val, 'C-')" dense dark
              :label="p.label.split('(')[0]" style="min-width: 90px; flex-shrink: 0;" />
            <q-input v-if="!isFunctionParam(p.label)" dense dark outlined class="col" v-model="p.value"
              :disable="p.isSlot" placeholder="参数值" />
          </div>
        </q-card-section>
      </q-card>

      <!-- Handlers Area -->
      <q-card v-for="(handler, idx) in localProperties.handlers" :key="handler.id" dark flat bordered
        style="position: relative;">
        <q-card-section class="q-pa-sm" style="padding-right: 48px;">
          <q-select dense dark outlined :options="handlerOptions" v-model="handler.type"
            @update:model-value="val => onHandlerTypeChange(handler, val)" emit-value map-options>
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <div v-for="p in handler.params" :key="p.id" class="row items-center q-mt-xs no-wrap">
            <q-toggle :model-value="p.isSlot" @update:model-value="(val) => updateSlot(p, val, `H${idx + 1}-`)" dense
              dark :label="p.label.split('(')[0]" style="min-width: 110px; flex-shrink: 0;" />
          </div>
        </q-card-section>
        <q-btn icon="close" flat dense color="negative" @click="removeHandler(idx)"
          style="position: absolute; right: 8px; top: 8px;" />
      </q-card>

      <q-btn flat color="primary" label="Add Handler" no-caps dense @click="addHandler" class="full-width" />
    </div>
  </BasePropertyPanel>
</template>
