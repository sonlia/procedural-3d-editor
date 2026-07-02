<script setup>
import { watch, computed } from 'vue';
import { uid } from 'quasar';
import { set } from 'lodash-es';
import { isFunctionParam, parseFunctionSignature } from '../utils.js';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel(); // node 实例

// 直接使用 props.value.properties 作为单一数据源
const properties = computed(() => props.value?.properties || {});

const declareTypeOptions = [
  { label: 'const', value: 'const', description: '常量声明，不可重新赋值' },
  { label: 'let', value: 'let', description: '变量声明，可重新赋值' },
  { label: 'ref', value: 'ref', description: 'Vue 响应式引用' },
  { label: 'reactive', value: 'reactive', description: 'Vue 响应式对象' }
];

const hasReturnValue = { hasReturnValue: true };
const noReturnValue = { hasReturnValue: false }; // 虽然string里没有，但保持一致性

// --- String 方法地图 (根据 W3School 更新，支持函数式参数) ---
const methodParamMap = {
  at: { params: ['index'], description: '返回字符串中指定索引的字符。', ...hasReturnValue },
  charAt: { params: ['index'], description: '返回字符串中指定索引（位置）的字符。', ...hasReturnValue },
  charCodeAt: { params: ['index'], description: '返回字符串中指定索引处字符的 Unicode 值。', ...hasReturnValue },
  codePointAt: { params: ['position'], description: '返回字符串中指定索引（位置）的 Unicode 值。', ...hasReturnValue },
  concat: { params: ['item1'], description: '返回两个或多个连接的字符串。', ...hasReturnValue },
  endsWith: { params: ['searchString', 'endPosition'], description: '返回字符串是否以指定值结尾。', ...hasReturnValue },
  includes: { params: ['searchString', 'position'], description: '返回字符串是否包含指定值。', ...hasReturnValue },
  indexOf: { params: ['searchValue', 'fromIndex'], description: '返回字符串中第一次出现指定值的索引（位置）。', ...hasReturnValue },
  lastIndexOf: { params: ['searchValue', 'fromIndex'], description: '返回字符串中最后一次出现指定值的索引（位置）。', ...hasReturnValue },
  localeCompare: { params: ['compareString', 'locales', 'options'], description: '在当前区域设置下比较两个字符串。', ...hasReturnValue },
  match: { params: ['regexp'], description: '在字符串中搜索值或正则表达式，并返回匹配项。', ...hasReturnValue },
  padEnd: { params: ['targetLength', 'padString'], description: '在字符串末尾填充字符。', ...hasReturnValue },
  padStart: { params: ['targetLength', 'padString'], description: '从字符串开头填充字符。', ...hasReturnValue },
  repeat: { params: ['count'], description: '返回包含指定数量字符串副本的新字符串。', ...hasReturnValue },
  replace: { params: ['pattern', 'replacer(match, ...p)'], description: '在字符串中搜索模式，并返回替换第一个匹配项后的字符串。', ...hasReturnValue },
  replaceAll: { params: ['pattern', 'replacer(match, ...p)'], description: '在字符串中搜索模式，并返回替换所有匹配项后的新字符串。', ...hasReturnValue },
  search: { params: ['regexp'], description: '在字符串中搜索值或正则表达式，并返回匹配项的索引（位置）。', ...hasReturnValue },
  slice: { params: ['indexStart', 'indexEnd'], description: '提取字符串的一部分并返回新字符串。', ...hasReturnValue },
  split: { params: ['separator', 'limit'], description: '将字符串拆分为子字符串数组。', ...hasReturnValue },
  startsWith: { params: ['searchString', 'position'], description: '检查字符串是否以指定字符开头。', ...hasReturnValue },
  substr: { params: ['start', 'length'], description: '从字符串的指定索引（位置）开始提取指定数量的字符。', ...hasReturnValue },
  substring: { params: ['indexStart', 'indexEnd'], description: '提取字符串中两个指定索引（位置）之间的字符。', ...hasReturnValue },
  toLocaleLowerCase: { params: ['locale'], description: '使用主机的区域设置将字符串转换为小写字母并返回。', ...hasReturnValue },
  toLocaleUpperCase: { params: ['locale'], description: '使用主机的区域设置将字符串转换为大写字母并返回。', ...hasReturnValue },
  toLowerCase: { params: [], description: '返回转换为小写字母的字符串。', ...hasReturnValue },
  toUpperCase: { params: [], description: '返回转换为大写字母的字符串。', ...hasReturnValue },
  toString: { params: [], description: '将字符串或字符串对象作为字符串返回。', ...hasReturnValue },
  trim: { params: [], description: '返回去除空格的字符串。', ...hasReturnValue },
  trimEnd: { params: [], description: '返回去除末尾空格的字符串。', ...hasReturnValue },
  trimStart: { params: [], description: '返回去除开头空格的字符串。', ...hasReturnValue },
  valueOf: { params: [], description: '返回字符串或字符串对象的原始值。', ...hasReturnValue },
  length: { params: [], description: '返回字符串的长度。', ...hasReturnValue },
  '${}': { params: [], description: '使用ES6模板字符串进行插值。', ...hasReturnValue }
};
const methodOptions = Object.keys(methodParamMap).map(m => ({ label: m, value: m, description: methodParamMap[m].description }));

const disableOutput = computed(() => {
  const methods = properties.value.methods;
  if (!props.value) return true;

  let hasReturn = true; // Default to true

  if (methods && methods.length > 0) {
    const lastMethodName = methods[methods.length - 1].methodName;
    const lastMethodInfo = methodParamMap[lastMethodName];
    if (lastMethodInfo) {
      hasReturn = lastMethodInfo.hasReturnValue;
    }
  }

  // String a= "string" also has a return value.
  const sourceValue = properties.value.source?.value;
  if (!sourceValue && (!methods || methods.length === 0)) {
    hasReturn = false;
  }

  return !hasReturn;
});

function createParam(label) {
  return { id: uid(), label, isSlot: isFunctionParam(label), value: '' };
}

// --- UI 事件处理 ---
function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();           // 触发代码重新生成
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 更新 source slot
function updateSourceSlot(isSlot) {
  updateField('source.isSlot', isSlot);
  const slotId = properties.value.source?.id;
  if (!slotId) return;

  const existingInputIndex = props.value.inputs.findIndex(i => i.id === slotId);

  if (isSlot && existingInputIndex === -1) {
    props.value.addInput('Source', 'string', { id: slotId });
  } else if (!isSlot && existingInputIndex !== -1) {
    props.value.removeInput(existingInputIndex);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 更新 outputVar slot
function updateOutputVarSlot(isSlot) {
  updateField('outputVar.isSlot', isSlot);
  const slotId = properties.value.outputVar?.id;
  if (!slotId) return;

  const existingInputIndex = props.value.inputs.findIndex(i => i.id === slotId);

  if (isSlot && existingInputIndex === -1) {
    props.value.addInput('VarName', 'string', { id: slotId });
  } else if (!isSlot && existingInputIndex !== -1) {
    props.value.removeInput(existingInputIndex);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function addMethodCard() {
  const method = {
    id: uid(),
    methodName: 'replace', // Default to a method with a function param
    params: methodParamMap['replace'].params.map(l => createParam(l))
  };
  properties.value.methods.push(method);
  // Auto-enable slot for function params
  const newMethodIndex = properties.value.methods.length - 1;
  method.params.forEach(p => {
    if (p.isSlot) {
      updateFunctionInputSlot(p, true, newMethodIndex);
    }
  });
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function onMethodChange(card, newMethod) {
  const methodIdx = properties.value.methods.findIndex(m => m.id === card.id);
  card.methodName = newMethod;
  const oldParams = card.params || [];
  // 清理旧的输入槽
  oldParams.forEach(p => {
    if (p.isSlot) {
      const inputIndex = props.value.inputs.findIndex(i => i.id === p.id);
      if (inputIndex !== -1) props.value.removeInput(inputIndex);
    }
  });

  // 特殊处理 concat
  if (newMethod === 'concat') {
    card.params = card.params.length > 0 ? card.params.map((p, i) => ({ ...p, label: `item${i + 1}` })) : [createParam('item1')];
  } else {
    card.params = (methodParamMap[newMethod]?.params || []).map(l => createParam(l));
  }
  // Auto-enable slot for new function params
  card.params.forEach(p => {
    if (p.isSlot) {
      updateFunctionInputSlot(p, true, methodIdx);
    }
  });
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function addConcatParam(card) {
  const idx = card.params.length + 1;
  card.params.push(createParam('item' + idx));
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 更新普通输入槽
function updateInputSlot(param, isSlot, methodIdx) {
  param.isSlot = isSlot;
  const existingInputIndex = props.value.inputs.findIndex(i => i.id === param.id);
  const slotLabel = `${methodIdx + 1}-${param.label}`;

  if (isSlot && existingInputIndex === -1) {
    props.value.addInput(slotLabel, 'string', { id: param.id });
  } else if (!isSlot && existingInputIndex !== -1) {
    props.value.removeInput(existingInputIndex);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 更新函数式输入槽（参考 compEventsPanel.vue）
function updateFunctionInputSlot(param, isSlot, methodIdx) {
  param.isSlot = isSlot;
  const signature = parseFunctionSignature(param.label);
  const slotName = `${methodIdx + 1}-${signature.name}`;
  const existingInputIndex = props.value.inputs.findIndex(i => i.id === param.id);

  if (isSlot && existingInputIndex === -1) {
    // 函数参数是 input slot，当前节点消费该函数
    props.value.addInput(slotName, "function", {
      id: param.id,
      shape: 5, // FUNCTION SHAPE
      meta: { isFunction: true, args: signature.args }
    });
  } else if (!isSlot && existingInputIndex !== -1) {
    props.value.removeInput(existingInputIndex);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateParamValue(methodId, paramId, value) {
  const method = properties.value.methods.find(m => m.id === methodId);
  if (method) {
    const param = method.params.find(p => p.id === paramId);
    if (param) param.value = value;
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function removeMethodCard(idx) {
  const card = properties.value.methods[idx];
  if (!card) return;

  // 清理该方法卡片的所有输入槽
  card.params.forEach(p => {
    if (p.isSlot) {
      const inputIndex = props.value.inputs.findIndex(i => i.id === p.id);
      if (inputIndex !== -1) props.value.removeInput(inputIndex);
    }
  });

  // 移除方法卡片
  properties.value.methods.splice(idx, 1);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

</script>

<template>
  <BasePropertyPanel v-model="props">
    <!-- ⚠️ 必须用 div 包裹所有卡片，提供呼吸空间和统一间距 -->
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 分区 1：输出变量配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- Export 单独一行 -->
          <q-checkbox dense dark :model-value="properties.exported"
            @update:model-value="val => updateField('exported', val)" label="Export" class="q-mb-xs"
            :disable="properties.outputVar?.isSlot" />
          <!-- 变量声明行 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle :model-value="properties.outputVar?.isSlot" @update:model-value="updateOutputVarSlot" dense dark
              label="VarName" style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined :model-value="properties.declareType" :disable="properties.outputVar?.isSlot"
              @update:model-value="val => updateField('declareType', val)" :options="declareTypeOptions" emit-value
              map-options class="col-auto">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input dense dark outlined class="col" :model-value="properties.outputVar?.value"
              :disable="properties.outputVar?.isSlot" @update:model-value="val => updateField('outputVar.value', val)"
              placeholder="变量名">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    输出变量的名称<br />
                    示例: myString, result, text
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
          <!-- 源字符串行 -->
          <div class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
            <q-toggle :model-value="properties.source?.isSlot" @update:model-value="updateSourceSlot" dense dark
              label="Source" style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" type="textarea" autogrow :model-value="properties.source?.value"
              @update:model-value="val => updateField('source.value', val)" :disable="properties.source?.isSlot"
              placeholder="字符串或变量">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    源字符串或变量名<br />
                    示例: "Hello World", myVar, `模板字符串`
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 2：方法链 -->
      <template v-if="Array.isArray(properties.methods)">
        <q-card v-for="(card, idx) in properties.methods" :key="card.id" dark flat bordered>
          <q-card-section class="q-pa-sm" style="position: relative; padding-right: 48px;">
            <q-badge color="primary" class="q-mb-xs">{{ idx + 1 }}</q-badge>
            <div class="row items-center">
              <q-select dense dark outlined style="width:120px" :options="methodOptions" :model-value="card.methodName"
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
              <q-btn v-if="card.methodName === 'concat'" icon="add" flat dense round class="q-ml-xs"
                @click="() => addConcatParam(card)" />
            </div>
            <div v-for="p in card.params" :key="p.id" class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
              <!-- 函数式参数 -->
              <template v-if="isFunctionParam(p.label)">
                <q-toggle :model-value="p.isSlot" @update:model-value="(val) => updateFunctionInputSlot(p, val, idx)"
                  dense dark :label="p.label" style="min-width: 90px; flex-shrink: 0;" />
              </template>
              <!-- 普通参数 -->
              <template v-else>
                <q-toggle :model-value="p.isSlot" @update:model-value="(val) => updateInputSlot(p, val, idx)" dense dark
                  :label="p.label" style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :model-value="p.value"
                  @update:model-value="val => updateParamValue(card.id, p.id, val)" :disable="p.isSlot"
                  placeholder="参数值">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        方法参数值<br />
                        根据方法不同，可以是索引、字符串或正则表达式
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </template>
            </div>
          </q-card-section>
          <!-- 删除按钮：绝对定位在右上角 -->
          <q-btn flat dense icon="close" color="negative" @click="removeMethodCard(idx)"
            style="position: absolute; right: 8px; top: 8px;" />
        </q-card>
      </template>

      <!-- 添加方法按钮 -->
      <q-btn flat color="primary" label="Add Method" no-caps dense @click="addMethodCard" class="full-width" />
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
