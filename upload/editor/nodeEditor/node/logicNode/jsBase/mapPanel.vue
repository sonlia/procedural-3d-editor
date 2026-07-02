<script setup>
import { ref, computed, watch } from 'vue';
import { uid } from 'quasar';
import { set } from 'lodash-es';
import { isFunctionParam, parseFunctionSignature } from '../utils.js';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();

const properties = computed(() => props.value?.properties || {});

const hasReturnValue = { hasReturnValue: true };
const noReturnValue = { hasReturnValue: false };

// --- Map 方法地图 ---
const methodParamMap = {
  set: { params: ['key', 'value'], desc: '向 Map 添加一个新键/值对', ...hasReturnValue },
  get: { params: ['key'], desc: '获取 Map 中指定键的值', ...hasReturnValue },
  has: { params: ['key'], desc: '检查 Map 中是否存在指定的键', ...hasReturnValue },
  delete: { params: ['key'], desc: '从 Map 中删除一个键/值对', ...hasReturnValue },
  clear: { params: [], desc: '从 Map 中移除所有键/值对', ...noReturnValue },
  forEach: { params: ['callback(value, key, map)'], desc: '为 Map 中的每个键/值对执行一次函数', ...noReturnValue },
  keys: { params: [], desc: '返回一个包含 Map 中所有键的迭代器对象', ...hasReturnValue },
  values: { params: [], desc: '返回一个包含 Map 中所有值的迭代器对象', ...hasReturnValue },
  entries: { params: [], desc: '返回一个包含 Map 中所有 [key, value] 对的迭代器对象', ...hasReturnValue },
  size: { params: [], desc: '返回 Map 中的键/值对数量（作为属性访问）', ...hasReturnValue },
};
const methodOptions = Object.keys(methodParamMap).map(m => ({ label: m, value: m, description: methodParamMap[m].desc }));

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function createParam(label) {
  return { id: uid(), label, isSlot: isFunctionParam(label), value: '' };
}

// --- 输出槽管理（仅控制 out slot 和声明区禁用状态，不影响 VarName slot） ---
const disableDeclaration = ref(false);

watch(() => properties.value.methods, (methods) => {
  if (!props.value) {
    disableDeclaration.value = true;
    return;
  }

  const outSlotIndex = props.value.outputs.findIndex(o => o.name === 'outValue');
  let hasReturn = true; // Constructor always returns a value

  if (methods && methods.length > 0) {
    const lastMethodName = methods[methods.length - 1].methodName;
    const lastMethodInfo = methodParamMap[lastMethodName];
    if (lastMethodInfo) {
      hasReturn = lastMethodInfo.hasReturnValue;
    }
  }

  if (hasReturn && outSlotIndex === -1) {
    props.value.addOutput('outValue', 'string');
  } else if (!hasReturn && outSlotIndex !== -1) {
    props.value.removeOutput(outSlotIndex);
  }

  disableDeclaration.value = !hasReturn;
}, { immediate: true, deep: true });

// --- UI 事件处理 ---
const hoverIdx = ref(-1);

function updateOutputVarSlot(isSlot) {
  const outputVar = properties.value.outputVar;
  if (!outputVar) return;

  outputVar.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex(i => i.id === outputVar.id);

  if (isSlot && existingIdx === -1) {
    props.value.addInput('VarName', 'string', { id: outputVar.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateConstructorParamSlot(isSlot) {
  properties.value.constructorParam.isSlot = isSlot;
  const param = properties.value.constructorParam;
  const existingIdx = props.value.inputs.findIndex(i => i.id === param.id);

  if (isSlot && existingIdx === -1) {
    props.value.addInput(param.label, 'string', { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function addMethodCard() {
  const method = {
    id: uid(),
    methodName: 'forEach',
    params: methodParamMap['forEach'].params.map(l => createParam(l))
  };
  if (!properties.value.methods) properties.value.methods = [];
  properties.value.methods.push(method);

  // Auto-enable slot for function params
  const newMethodIndex = properties.value.methods.length - 1;
  method.params.forEach(p => {
    if (p.isSlot) {
      updateParamSlot(p, true, newMethodIndex);
    }
  });
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function removeMethodCard(idx) {
  const methods = properties.value.methods;
  if (!methods || !methods[idx]) return;

  const removedCard = methods[idx];

  // 所有参数（包括函数参数）都是输入 slot
  removedCard.params.forEach(p => {
    if (p.isSlot) {
      const inIdx = props.value.inputs.findIndex(i => i.id === p.id);
      if (inIdx !== -1) props.value.removeInput(inIdx);
    }
  });

  methods.splice(idx, 1);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function onMethodChange(card, newMethod) {
  const methodIdx = properties.value.methods.findIndex(m => m.id === card.id);
  const oldParams = card.params || [];

  // 清理旧的输入槽（所有参数都是输入）
  oldParams.forEach(p => {
    if (p.isSlot) {
      const inputIndex = props.value.inputs.findIndex(i => i.id === p.id);
      if (inputIndex !== -1) props.value.removeInput(inputIndex);
    }
  });

  card.methodName = newMethod;
  card.params = (methodParamMap[newMethod]?.params || []).map(l => createParam(l));

  // Auto-enable slot for new function params
  card.params.forEach(p => {
    if (p.isSlot) {
      updateParamSlot(p, true, methodIdx);
    }
  });

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateParamSlot(param, isSlot, methodIdx) {
  param.isSlot = isSlot;
  const isFunc = isFunctionParam(param.label);
  const existingIdx = props.value.inputs.findIndex(s => s.id === param.id);
  const slotLabel = `${methodIdx + 1}-${param.label.split('(')[0]}`;

  if (isSlot && existingIdx === -1) {
    // 所有参数都是输入 slot，函数参数使用 function 类型和五边形
    if (isFunc) {
      const signature = parseFunctionSignature(param.label);
      props.value.addInput(slotLabel, 'function', {
        id: param.id, shape: 5, meta: { isFunction: true, args: signature.args }
      });
    } else {
      props.value.addInput(slotLabel, 'string', { id: param.id });
    }
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// --- 初始化同步 ---
watch(() => properties.value.outputVar, (outputVar) => {
  if (!outputVar || !props.value) return;
  const existingIdx = props.value.inputs.findIndex(i => i.id === outputVar.id);

  if (outputVar.isSlot && existingIdx === -1) {
    props.value.addInput('VarName', 'string', { id: outputVar.id });
  } else if (!outputVar.isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
}, { immediate: true, deep: true });

watch(() => properties.value.constructorParam, (param) => {
  if (!param || !props.value) return;
  const existingIdx = props.value.inputs.findIndex(i => i.id === param.id);

  if (param.isSlot && existingIdx === -1) {
    props.value.addInput(param.label, 'string', { id: param.id });
  } else if (!param.isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
}, { immediate: true, deep: true });

watch(() => properties.value.methods, (methods) => {
  if (!Array.isArray(methods) || !props.value) return;

  methods.forEach((method, methodIdx) => {
    method.params?.forEach(p => {
      if (!p.isSlot) return;

      // 所有参数都是输入 slot
      const exists = props.value.inputs.some(s => s.id === p.id);

      if (!exists) {
        const isFunc = isFunctionParam(p.label);
        const slotLabel = `${methodIdx + 1}-${p.label.split('(')[0]}`;
        if (isFunc) {
          const signature = parseFunctionSignature(p.label);
          props.value.addInput(slotLabel, 'function', {
            id: p.id, shape: 5, meta: { isFunction: true, args: signature.args }
          });
        } else {
          props.value.addInput(slotLabel, 'string', { id: p.id });
        }
      }
    });
  });
  props.value.onExecute?.();
}, { immediate: true, deep: true });
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- Declaration Card -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-checkbox dense dark :model-value="properties.exported"
            @update:model-value="val => updateField('exported', val)" label="Export" class="q-mb-xs"
            :disable="disableDeclaration || properties.outputVar?.isSlot" />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName" :model-value="properties.outputVar?.isSlot"
              @update:model-value="updateOutputVarSlot" style="min-width: 90px; flex-shrink: 0;"
              :disable="disableDeclaration" />
            <q-select dense dark outlined style="width: 80px" :options="['const', 'let']"
              :model-value="properties.declareType" @update:model-value="val => updateField('declareType', val)"
              :disable="disableDeclaration || properties.outputVar?.isSlot" />
            <q-input dense dark outlined class="col" :model-value="properties.outputVar?.value"
              @update:model-value="val => updateField('outputVar.value', val)" placeholder="变量名"
              :disable="disableDeclaration || properties.outputVar?.isSlot">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    Map 变量名<br />
                    示例: myMap, userMap, dataMap
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- Constructor Card -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption">Constructor: new Map(iterable)</div>
          <div class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
            <q-toggle :model-value="properties.constructorParam?.isSlot"
              @update:model-value="updateConstructorParamSlot" dense dark
              :label="properties.constructorParam?.label || 'iterable'" style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :model-value="properties.constructorParam?.value"
              @update:model-value="val => { if (properties.constructorParam) properties.constructorParam.value = val; }"
              :disable="properties.constructorParam?.isSlot" placeholder="[['k1','v1'], ['k2','v2']]">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    初始化数据，可选<br />
                    示例: [['key1', 'value1'], ['key2', 'value2']]
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- Methods Area -->
      <q-card v-for="(card, idx) in properties.methods" :key="card.id" dark flat bordered @mouseenter="hoverIdx = idx"
        @mouseleave="hoverIdx = -1" style="position: relative;">
        <q-card-section class="q-pa-sm" style="padding-right: 48px;">
          <q-btn v-if="hoverIdx === idx" icon="close" flat dense color="negative"
            @click="removeMethodCard(idx)" style="position: absolute; right: 8px; top: 8px; z-index: 1;" />
          <q-badge color="primary" class="q-mb-xs">{{ idx + 1 }}</q-badge>
          <q-select dense dark outlined style="width: 100%" :options="methodOptions" :model-value="card.methodName"
            @update:model-value="val => onMethodChange(card, val)" emit-value map-options>
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
          <div v-for="p in card.params" :key="p.id" class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
            <q-toggle :model-value="p.isSlot" @update:model-value="(val) => updateParamSlot(p, val, idx)" dense dark
              :label="p.label.split('(')[0]" style="min-width: 90px; flex-shrink: 0;" />
            <q-input v-if="!isFunctionParam(p.label)" dense dark outlined class="col" :model-value="p.value"
              @update:model-value="val => p.value = val" :disable="p.isSlot" placeholder="参数值">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    {{ p.label }} 参数值
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <q-btn flat color="primary" label="Add Method" no-caps dense @click="addMethodCard" class="full-width" />
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
