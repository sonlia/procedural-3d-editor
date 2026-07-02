<script setup>
import { watch, computed } from 'vue';
import { uid } from 'quasar';
import { get, set } from 'lodash-es';
import { isFunctionParam, parseFunctionSignature } from '../utils.js';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel(); // node 实例

// --- 辅助函数 ---
function createParam(label) {
  return { id: uid(), label, isSlot: isFunctionParam(label), value: '' };
}

// --- Set 方法地图 ---
const hasReturnValue = { hasReturnValue: true };
const noReturnValue = { hasReturnValue: false };

const methodParamMap = {
  add: { params: ['value'], desc: '向 Set 添加一个新元素', ...hasReturnValue },
  has: { params: ['value'], desc: '检查 Set 中是否存在指定的元素', ...hasReturnValue },
  delete: { params: ['value'], desc: '从 Set 中删除一个元素', ...hasReturnValue },
  clear: { params: [], desc: '从 Set 中移除所有元素', ...noReturnValue },
  forEach: { params: ['callback(value, value2, set)'], desc: '为 Set 中的每个元素执行一次函数', ...noReturnValue },
  values: { params: [], desc: '返回一个包含 Set 中所有值的迭代器对象', ...hasReturnValue },
  keys: { params: [], desc: '与 values() 相同, 返回一个包含 Set 中所有值的迭代器对象', ...hasReturnValue },
  entries: { params: [], desc: '返回一个包含 Set 中所有 [value, value] 对的迭代器对象', ...hasReturnValue },
  size: { params: [], desc: '返回 Set 中的元素数量（作为属性访问）', ...hasReturnValue },
};
const methodOptions = Object.keys(methodParamMap).map(m => ({ label: m, value: m, description: methodParamMap[m].desc }));

// --- 声明类型选项（带描述） ---
const declareTypeOptions = [
  { label: 'const', value: 'const', description: '常量声明，不可重新赋值' },
  { label: 'let', value: 'let', description: '变量声明，可重新赋值' },
  { label: 'ref', value: 'ref', description: 'Vue 响应式引用' },
  { label: 'reactive', value: 'reactive', description: 'Vue 响应式对象' }
];

// --- 数据模型 ---
const properties = computed(() => props.value?.properties || {});

// --- 初始化 ---
watch(() => props.value, (node) => {
  if (!node) return;
  // 确保 properties 结构完整
  if (!node.properties) node.properties = {};
  const p = node.properties;
  if (p.exported === undefined) p.exported = false;
  if (p.declareType === undefined) p.declareType = 'const';
  // 兼容旧格式：字符串 → 三元组
  if (typeof p.outputVar === 'string') {
    p.outputVar = { id: uid(), isSlot: false, value: p.outputVar };
  }
  if (!p.outputVar?.id) {
    p.outputVar = { id: uid(), isSlot: false, value: p.outputVar?.value || `set_${uid().slice(0, 8)}` };
  }
  if (!p.constructorParam) p.constructorParam = createParam('iterable');
  if (!Array.isArray(p.methods)) p.methods = [];
}, { immediate: true });

// --- 计算是否禁用输出相关控件 ---
const disableOutput = computed(() => {
  const methods = properties.value.methods;
  if (!props.value) return true;

  let hasReturnVal = true;
  if (methods && methods.length > 0) {
    const lastMethodName = methods[methods.length - 1].methodName;
    const lastMethodInfo = methodParamMap[lastMethodName];
    if (lastMethodInfo) {
      hasReturnVal = lastMethodInfo.hasReturnValue;
    }
  }
  return !hasReturnVal;
});

// --- 监听 methods 变化，管理 out slot ---
watch(() => properties.value.methods, (methods) => {
  if (!props.value) return;

  const outSlotIndex = props.value.outputs.findIndex(o => o.name === 'outValue');
  let hasReturnVal = true;

  if (methods && methods.length > 0) {
    const lastMethodName = methods[methods.length - 1].methodName;
    const lastMethodInfo = methodParamMap[lastMethodName];
    if (lastMethodInfo) {
      hasReturnVal = lastMethodInfo.hasReturnValue;
    }
  }

  if (hasReturnVal && outSlotIndex === -1) {
    props.value.addOutput('outValue', 'string');
  } else if (!hasReturnVal && outSlotIndex !== -1) {
    props.value.removeOutput(outSlotIndex);
  }
}, { deep: true, immediate: true });

// --- UI 事件处理 ---
function getParamHelp(methodName, paramLabel) {
  const helpMap = {
    add: { value: '要添加到 Set 的值' },
    has: { value: '要检查是否存在的值' },
    delete: { value: '要从 Set 中删除的值' },
  };
  const paramName = paramLabel.split('(')[0];
  return helpMap[methodName]?.[paramName] || `${methodName} 方法的参数`;
}

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// VarName slot 管理
function updateOutputVarSlot(isSlot) {
  const param = properties.value.outputVar;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex(i => i.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput('VarName', 'string', { id: param.id });
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
  properties.value.methods.push(method);
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
  const [removed] = properties.value.methods.splice(idx, 1);
  if (removed) {
    removed.params.forEach(p => {
      if (p.isSlot) {
        // 函数类型和普通类型都在 inputs 中
        const inIdx = props.value.inputs.findIndex(i => i.id === p.id);
        if (inIdx !== -1) props.value.removeInput(inIdx);
      }
    });
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function onMethodChange(card, newMethod) {
  const methodIdx = properties.value.methods.findIndex(m => m.id === card.id);
  const oldParams = get(card, 'params', []);
  // 清理旧的输入槽（函数类型和普通类型都在 inputs 中）
  oldParams.forEach(p => {
    if (p.isSlot) {
      const inputIndex = props.value.inputs.findIndex(i => i.id === p.id);
      if (inputIndex !== -1) props.value.removeInput(inputIndex);
    }
  });

  card.methodName = newMethod;
  card.params = (methodParamMap[newMethod]?.params || []).map(l => createParam(l));
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
    if (isFunc) {
      // 函数类型：当前节点消费该函数，所以是 input slot
      const signature = parseFunctionSignature(param.label);
      props.value.addInput(slotLabel, "function", {
        id: param.id,
        shape: 5,
        meta: { args: signature.args }
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
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- Declaration Card -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-checkbox dense dark :model-value="properties.exported"
            @update:model-value="val => updateField('exported', val)" label="Export" class="q-mb-xs"
            :disable="disableOutput || properties.outputVar?.isSlot" />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName" :model-value="properties.outputVar?.isSlot"
              @update:model-value="updateOutputVarSlot" style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined :model-value="properties.declareType"
              @update:model-value="val => updateField('declareType', val)" :options="declareTypeOptions" emit-value
              map-options class="col-auto" :disable="disableOutput || properties.outputVar?.isSlot">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ scope.opt.description
                      }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input dense dark outlined class="col" :model-value="properties.outputVar?.value"
              @update:model-value="val => updateField('outputVar.value', val)" placeholder="变量名"
              :disable="disableOutput || properties.outputVar?.isSlot">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    Set 实例的变量名<br />
                    示例: mySet, userSet, dataSet
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
          <div class="text-caption q-mb-xs">Constructor: new Set(iterable)</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle :model-value="properties.constructorParam?.isSlot"
              @update:model-value="updateConstructorParamSlot" dense dark :label="properties.constructorParam?.label"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" v-model="properties.constructorParam.value"
              :disable="properties.constructorParam?.isSlot" placeholder="[1, 2, 'a']">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    可迭代对象用于初始化 Set<br />
                    示例: [1, 2, 3], "abc", new Map()
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- Methods Area -->
      <q-card v-for="(card, idx) in properties.methods" :key="card.id" dark flat bordered style="position: relative;">
        <q-card-section class="q-pa-sm" style="padding-right: 48px;">
          <q-badge color="primary" class="q-mb-xs">{{ idx + 1 }}</q-badge>
          <q-select dense dark outlined style="width:100%" :options="methodOptions" v-model="card.methodName"
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
            <q-input v-if="!isFunctionParam(p.label)" dense dark outlined class="col" v-model="p.value"
              :disable="p.isSlot" placeholder="参数值">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    {{ getParamHelp(card.methodName, p.label) }}
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
        <q-btn icon="close" flat dense color="negative" @click="removeMethodCard(idx)"
          style="position: absolute; right: 8px; top: 8px;">
          <q-tooltip>删除方法</q-tooltip>
        </q-btn>
      </q-card>

      <q-btn flat color="primary" label="Add Method" no-caps dense @click="addMethodCard" class="full-width" />
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
