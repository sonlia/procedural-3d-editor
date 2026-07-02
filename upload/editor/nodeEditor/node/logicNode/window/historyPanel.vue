<script setup>
import { defineAsyncComponent, ref, onMounted, watch, computed } from "vue";
import { uid } from "quasar";
import { cloneDeep, isEqual } from "lodash-es";
import { isFunctionParam, parseFunctionSignature } from '../utils.js';
import { historyPropertyMap, historyMethodParamMap } from './base.js';
import BasePropertyPanel from '../../../propertyPanel/BasePropertyPanel.vue';

const props = defineModel(); // node instance

const propertyOptions = Object.keys(historyPropertyMap).map(p => ({ label: p, value: p, description: historyPropertyMap[p].desc }));
const methodOptions = Object.keys(historyMethodParamMap).map(m => ({ label: m, value: m, description: historyMethodParamMap[m].desc }));
const declareTypeOptions = [
  { label: 'const', value: 'const', description: '常量声明，不可重新赋值' },
  { label: 'let', value: 'let', description: '变量声明，可重新赋值' },
];

// --- Data Model & Sync ---
const defaultProperties = () => ({
  exported: false,
  outputVar: { id: uid(), isSlot: false, value: `result_${uid().slice(0, 8)}` },
  declareType: "const",
  operation: {
    id: uid(),
    type: "property", // Default to property for history
    name: "length",
    params: [],
  },
});
const localProperties = ref(defaultProperties());

// --- Computed Property for Disabling Output (no side effects) ---
const disableOutput = computed(() => {
  const op = localProperties.value.operation;
  if (!op) return true;

  let hasReturnValue = false;
  if (op.type === 'method') {
    hasReturnValue = historyMethodParamMap[op.name]?.hasReturnValue;
  } else if (op.type === 'property') {
    hasReturnValue = historyPropertyMap[op.name]?.hasReturnValue;
  }

  return !hasReturnValue;
});

// --- outValue Slot Management (via watch, not computed) ---
watch(() => {
  const op = localProperties.value.operation;
  if (!op) return { hasReturnValue: false, opName: null };

  let hasReturnValue = false;
  if (op.type === 'method') {
    hasReturnValue = historyMethodParamMap[op.name]?.hasReturnValue ?? false;
  } else if (op.type === 'property') {
    hasReturnValue = historyPropertyMap[op.name]?.hasReturnValue ?? false;
  }
  return { hasReturnValue, opName: op.name };
}, ({ hasReturnValue }) => {
  if (!props.value) return;

  const outSlotIndex = props.value.outputs?.findIndex(o => o.name === 'outValue') ?? -1;

  if (hasReturnValue && outSlotIndex === -1) {
    props.value.addOutput('outValue', 'string', { id: 'default_out' });
  } else if (!hasReturnValue && outSlotIndex !== -1) {
    props.value.removeOutput(outSlotIndex);
  }
}, { immediate: true });

onMounted(() => {
  const initialProps = { ...defaultProperties(), ...cloneDeep(props.value?.properties ?? {}) };
  if (!initialProps.operation) {
    initialProps.operation = defaultProperties().operation;
  }
  localProperties.value = initialProps;
  if (!isEqual(props.value.properties, localProperties.value)) {
    props.value.properties = cloneDeep(localProperties.value);
  }
});

watch(localProperties, (newVal) => {
  if (!isEqual(props.value.properties, newVal)) {
    props.value.properties = cloneDeep(newVal);
    props.value.onExecute?.();
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}, { deep: true }
);

watch(() => props.value?.properties, (newVal) => {
  const newProps = { ...defaultProperties(), ...cloneDeep(newVal ?? {}) };
  if (!isEqual(newProps, localProperties.value)) {
    localProperties.value = newProps;
  }
}, { deep: true }
);

// --- OutputVar Slot Management ---
watch(() => localProperties.value.outputVar?.isSlot, (isSlot) => {
  const slotId = localProperties.value.outputVar?.id;
  if (!slotId) return;
  const exists = props.value.inputs?.find(s => s.id === slotId);

  if (isSlot && !exists) {
    props.value.addInput('VarName', 'string', { id: slotId });
  } else if (!isSlot && exists) {
    props.value.removeInput(props.value.inputs.indexOf(exists));
  }
}, { immediate: true });

// --- UI Event Handlers ---
function onTypeChange(type) {
  const op = localProperties.value.operation;
  if (op.type === 'method' && op.params) {
    op.params.forEach(p => updateParamSlot(p, false));
  }

  op.type = type;
  if (type === 'method') {
    op.name = 'back'; // Default method
    op.params = generateParamsFor('method', 'back');
  } else {
    op.name = 'length'; // Default property
    delete op.params;
  }
}

function onNameChange(name) {
  const op = localProperties.value.operation;
  if (op.params) op.params.forEach(p => updateParamSlot(p, false));
  op.name = name;
  if (op.type === 'method') {
    op.params = generateParamsFor("method", name);
    op.params.forEach(p => {
      if (isFunctionParam(p.label)) {
        updateParamSlot(p, true);
      }
    });
  }
}

function generateParamsFor(type, name) {
  if (type !== 'method') return [];
  const methodInfo = historyMethodParamMap[name];
  if (!methodInfo || !methodInfo.params) return [];
  return methodInfo.params.map((paramLabel) => ({
    id: uid(),
    label: paramLabel,
    isSlot: isFunctionParam(paramLabel),
    value: "",
  }));
}

function updateParamSlot(param, isSlot) {
  param.isSlot = isSlot;
  const isFunc = isFunctionParam(param.label);
  // ✅ 函数类型也在 inputs 中（当前节点消费该函数）
  const slotIndex = props.value.inputs.findIndex(s => s.id === param.id);

  if (!isSlot && slotIndex !== -1) {
    props.value.removeInput(slotIndex);
  } else if (isSlot && slotIndex === -1) {
    const signature = parseFunctionSignature(param.label);
    const slotName = isFunc ? signature.name : param.label;
    const slotType = isFunc ? 'function' : 'string';
    let slotOptions = { id: param.id };
    if (isFunc) {
      slotOptions.shape = 5;
      slotOptions.meta = { args: signature.args };
    }
    props.value.addInput(slotName, slotType, slotOptions);
  }
}
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">

      <!-- Output Variable Section -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-checkbox dense dark v-model="localProperties.exported" label="Export" class="q-mb-xs"
            :disable="disableOutput || localProperties.outputVar?.isSlot" />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName" :model-value="localProperties.outputVar?.isSlot"
              @update:model-value="val => localProperties.outputVar.isSlot = val"
              :disable="disableOutput"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined v-model="localProperties.declareType" :options="declareTypeOptions"
              style="width: 80px;" emit-value map-options :disable="disableOutput || localProperties.outputVar?.isSlot">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps" dense>
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey-6">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input dense dark outlined :model-value="localProperties.outputVar?.value"
              @update:model-value="val => localProperties.outputVar.value = val" class="col"
              :disable="disableOutput || localProperties.outputVar?.isSlot">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    存储结果的变量名<br />
                    示例: historyLen, currentState
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- Single Operation Section -->
      <q-card v-if="localProperties.operation" :key="localProperties.operation.id" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-btn-toggle :model-value="localProperties.operation.type" @update:model-value="onTypeChange" no-caps dense
              unelevated toggle-color="primary" color="grey-8"
              :options="[{ label: 'Method', value: 'method' }, { label: 'Property', value: 'property' }]" />
          </div>
          <q-select v-if="localProperties.operation.type === 'method'" dense dark outlined
            :model-value="localProperties.operation.name" @update:model-value="onNameChange" :options="methodOptions"
            label="Method" class="q-mt-sm" emit-value map-options>
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps" dense>
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey-6">{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <q-select v-if="localProperties.operation.type === 'property'" dense dark outlined
            :model-value="localProperties.operation.name" @update:model-value="onNameChange" :options="propertyOptions"
            label="Property" class="q-mt-sm" emit-value map-options>
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps" dense>
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey-6">{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <div v-if="localProperties.operation.type === 'method'">
            <q-separator dark class="q-my-sm" />
            <div v-for="param in localProperties.operation.params" :key="param.id" class="q-mt-xs">
              <div class="row items-center no-wrap q-gutter-x-sm">
                <template v-if="!isFunctionParam(param.label)">
                  <q-toggle dense dark :label="param.label" :model-value="param.isSlot"
                    @update:model-value="val => updateParamSlot(param, val)" style="min-width: 90px; flex-shrink: 0;" />
                  <q-input dense dark outlined :model-value="param.value" @update:model-value="val => param.value = val"
                    :disable="param.isSlot" class="col">
                    <template v-slot:append>
                      <q-icon name="help_outline"  class="cursor-pointer">
                        <q-tooltip class="bg-dark" max-width="250px">
                          {{ param.label }} 参数值
                        </q-tooltip>
                      </q-icon>
                    </template>
                  </q-input>
                </template>
                <template v-else>
                  <span class="text-caption text-grey-6">函数参数 (见节点端口)</span>
                </template>
              </div>
            </div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
