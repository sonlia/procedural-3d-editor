<script setup>
import { ref, onMounted, watch, computed } from 'vue';
import { uid } from 'quasar';
import { cloneDeep, isEqual, set } from 'lodash-es';
import { isFunctionParam, parseFunctionSignature } from '../utils.js';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel(); // node 实例

// --- 数据模型 & 同步 ---
const defaultProperties = () => ({
  exported: false,
  declareType: 'const',
  declareIsSlot: false,
  declareSlotId: null,
  outputVar: `json_${uid().slice(0, 8)}`, // 唯一变量名
  operationType: 'stringify', // 'stringify' or 'parse'
  mainInputIsSlot: false,
  mainInputValue: '',
  mainInputSlotId: null, // Initialized in onMounted
  params: {
    stringify: [
      createParam('replacer(key, value)'),
      createParam('space')
    ],
    parse: [
      createParam('reviver(key, value)')
    ]
  },
  remark: ''
});
const localProperties = ref(defaultProperties());

onMounted(() => {
  const initialProps = { ...defaultProperties(), ...cloneDeep(props.value?.properties ?? {}) };
  // Ensure param structure exists
  if (!initialProps.params) initialProps.params = defaultProperties().params;
  if (!Array.isArray(initialProps.params.stringify)) initialProps.params.stringify = defaultProperties().params.stringify;
  if (!Array.isArray(initialProps.params.parse)) initialProps.params.parse = defaultProperties().params.parse;
  if (!initialProps.mainInputSlotId) {
    initialProps.mainInputSlotId = uid();
  }
  if (!initialProps.declareSlotId) {
    initialProps.declareSlotId = uid();
  }
  // If the slot should exist on mount, create it.
  if (initialProps.mainInputIsSlot) {
    const slotName = initialProps.operationType === 'stringify' ? 'value' : 'text';
    const existing = props.value.inputs.find(i => i.id === initialProps.mainInputSlotId);
    if (!existing) {
      props.value.addInput(slotName, 'string', { id: initialProps.mainInputSlotId });
    }
  }
  // 声明 slot
  if (initialProps.declareIsSlot) {
    const existing = props.value.inputs.find(i => i.id === initialProps.declareSlotId);
    if (!existing) {
      props.value.addInput('VarName', 'string', { id: initialProps.declareSlotId });
    }
  }

  if (!isEqual(localProperties.value, initialProps)) {
    localProperties.value = initialProps;
  }
  if (!isEqual(props.value.properties, localProperties.value)) {
    props.value.properties = cloneDeep(localProperties.value);
  }
});

// Watchers
watch(localProperties, (newVal) => {
  if (!isEqual(props.value.properties, newVal)) {
    props.value.properties = cloneDeep(newVal);
    // 触发重新生成 jsCode
    props.value.onExecute?.();
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}, { deep: true });

watch(() => props.value?.properties, (newVal) => {
  const newProps = { ...defaultProperties(), ...cloneDeep(newVal ?? {}) };
  if (!isEqual(newProps, localProperties.value)) {
    localProperties.value = newProps;
  }
}, { deep: true });

function createParam(label) {
  return { id: uid(), label, isSlot: false, value: '' };
}

// 当前操作类型的参数列表 - 从 localProperties.params 获取
const currentParams = computed(() => {
  const opType = localProperties.value.operationType || 'stringify';
  return localProperties.value.params?.[opType] || [];
});

// 方法参数映射 - 仅用于判断返回值
const methodParamMap = {
  stringify: { hasReturnValue: true },
  parse: { hasReturnValue: true }
};

const disableOutput = computed(() => {
  const op = localProperties.value.operationType;
  return !(methodParamMap[op]?.hasReturnValue ?? false);
});

// 管理输出 slot
watch(() => localProperties.value.operationType, () => {
  const has = !disableOutput.value;
  const outSlotIndex = props.value.outputs.findIndex(o => o.name === 'outValue');

  if (has && outSlotIndex === -1) {
    props.value.addOutput('outValue', 'string');
  } else if (!has && outSlotIndex !== -1) {
    props.value.removeOutput(outSlotIndex);
  }
}, { immediate: true });

// --- UI 事件处理 ---
function updateField(key, value) {
  set(localProperties.value, key, value);
}

function onOperationChange(opType) {
  updateField('operationType', opType);
  // Clean up all old slots before creating new ones
  const allParams = [...(localProperties.value.params?.stringify || []), ...(localProperties.value.params?.parse || [])];
  allParams.forEach(p => {
    if (p.isSlot) {
      // 函数参数和普通参数都是输入 slot
      const inputIndex = props.value.inputs.findIndex(i => i.id === p.id);
      if (inputIndex !== -1) props.value.removeInput(inputIndex);
    }
  });

  // Auto-enable function slots for the new operation type
  const newParams = localProperties.value.params?.[opType] || [];
  newParams.forEach(p => {
    if (isFunctionParam(p.label) && p.isSlot) {
      updateFunctionInputSlot(p, true);
    }
  });
}

function updateMainInputSlot(isSlot) {
  updateField('mainInputIsSlot', isSlot);
  const slotId = localProperties.value.mainInputSlotId;
  const existingIdx = props.value.inputs.findIndex(i => i.id === slotId);
  const opType = localProperties.value.operationType;
  const slotName = opType === 'stringify' ? 'value' : 'text';

  if (isSlot && existingIdx === -1) {
    props.value.addInput(slotName, 'string', { id: slotId });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
}

function updateDeclareSlot(isSlot) {
  updateField('declareIsSlot', isSlot);
  const slotId = localProperties.value.declareSlotId;
  const existingIdx = props.value.inputs.findIndex(i => i.id === slotId);

  if (isSlot && existingIdx === -1) {
    props.value.addInput('VarName', 'string', { id: slotId });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
}

// Generic slot updater - 普通参数作为输入 slot
function updateParamSlot(param, isSlot) {
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex(s => s.id === param.id);

  if (isSlot && existingIdx === -1) {
    props.value.addInput(param.label, 'string', { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
}

function updateParamValue(param, value) {
  param.value = value;
}

// 函数参数作为输入 slot（参考 uiNodeMeta 事件处理）
function updateFunctionInputSlot(param, isSlot) {
  param.isSlot = isSlot;
  const signature = parseFunctionSignature(param.label);
  const slotName = signature.name;
  const existingInputIndex = props.value.inputs.findIndex(i => i.id === param.id);

  if (isSlot && existingInputIndex === -1) {
    // 创建 function 类型的输入 slot，shape 为 5（五边形）
    props.value.addInput(slotName, 'function', {
      id: param.id,
      shape: 5,
      meta: { isFunction: true, args: signature.args }
    });
  } else if (!isSlot && existingInputIndex !== -1) {
    props.value.removeInput(existingInputIndex);
  }
}

</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm" style="overflow:auto;">
      <!-- Declaration Card -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- VarName slot 模式下禁用 Export -->
          <q-checkbox dense dark :model-value="localProperties.exported"
            @update:model-value="val => updateField('exported', val)" label="export"
            :disable="disableOutput || localProperties.declareIsSlot"
            class="q-mb-xs" />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark :model-value="localProperties.declareIsSlot"
              @update:model-value="updateDeclareSlot" label="VarName"
              style="min-width: 90px; flex-shrink: 0;" :disable="disableOutput" />
            <q-select dense dark outlined style="width: 80px; flex-shrink: 0;" :options="['const', 'let']"
              :model-value="localProperties.declareType" @update:model-value="val => updateField('declareType', val)"
              :disable="disableOutput || localProperties.declareIsSlot" />
            <q-input dense dark outlined class="col" :model-value="localProperties.outputVar"
              @update:model-value="val => updateField('outputVar', val)" placeholder="变量名"
              :disable="disableOutput || localProperties.declareIsSlot">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    输出变量的名称<br />
                    示例: jsonData, result, parsed
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- Operation Toggle and Params -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-btn-toggle :model-value="localProperties.operationType" @update:model-value="onOperationChange" no-caps
            dense unelevated toggle-color="primary" color="grey-8" class="full-width"
            :options="[{ label: 'Stringify', value: 'stringify' }, { label: 'Parse', value: 'parse' }]" />

          <!-- 主输入值 -->
          <div class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
            <q-toggle :model-value="localProperties.mainInputIsSlot" @update:model-value="updateMainInputSlot" dense
              dark :label="localProperties.operationType === 'stringify' ? 'value' : 'text'"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :model-value="localProperties.mainInputValue"
              @update:model-value="val => updateField('mainInputValue', val)" :disable="localProperties.mainInputIsSlot"
              :placeholder="localProperties.operationType === 'stringify' ? 'value' : 'text'">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    <template v-if="localProperties.operationType === 'stringify'">
                      要序列化的 JavaScript 值或对象<br />
                      示例: myObject, data, { key: value }
                    </template>
                    <template v-else>
                      要解析的 JSON 字符串<br />
                      示例: jsonString, response.text
                    </template>
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>

          <!-- 可选参数 -->
          <div v-for="param in currentParams" :key="param.id" class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
            <template v-if="isFunctionParam(param.label)">
              <span class="text-caption text-grey-4" style="min-width: 90px; flex-shrink: 0;">{{ param.label }}</span>
              <q-toggle :model-value="param.isSlot" @update:model-value="(val) => updateFunctionInputSlot(param, val)"
                dense dark label="slot" />
            </template>
            <template v-else>
              <q-toggle :model-value="param.isSlot" @update:model-value="(val) => updateParamSlot(param, val)" dense
                dark :label="param.label" style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :model-value="param.value"
                @update:model-value="val => updateParamValue(param, val)" :disable="param.isSlot"
                :placeholder="param.label">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      <template v-if="param.label === 'space'">
                        缩进空格数或字符串<br />
                        示例: 2, 4, "\t"
                      </template>
                      <template v-else>
                        可选的替换/恢复函数参数
                      </template>
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </template>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
