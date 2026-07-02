<script setup>
import { ref, watch, computed } from 'vue';
import { uid } from 'quasar';
import { set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();

// 单一数据源
const properties = computed(() => props.value?.properties || {});

// --- 参数类型定义（仅用于 UI 输入约束）---
// inputType: 'number' | 'text' | 'any'
// - number: 数字输入框，带 min/max 范围校验
// - text: 文本输入框，提示用户输入格式
// - any: 文本输入框，接受任意格式（变量名/表达式）
const instanceMethodMap = {
  toFixed: {
    params: [{ label: 'digits', inputType: 'number', min: 0, max: 100, desc: '小数位数 (0-100)' }],
    desc: '把数字转换为字符串，结果的小数点后有指定位数的数字。'
  },
  toPrecision: {
    params: [{ label: 'precision', inputType: 'number', min: 1, max: 100, desc: '精度长度 (1-100)' }],
    desc: '把数字格式化为指定的长度。'
  },
  toString: {
    params: [{ label: 'radix', inputType: 'number', min: 2, max: 36, desc: '进制基数 (2-36)' }],
    desc: '把数字转换为字符串，使用指定的基数。'
  },
};
const staticOperationsMap = {
  MAX_VALUE: { params: [], desc: '可在 JavaScript 中表示的最大数字。' },
  MIN_VALUE: { params: [], desc: '可在 JavaScript 中表示的最小的正数。' },
  isFinite: {
    params: [{ label: 'value', inputType: 'any', desc: '要检测的值，如 myVar 或 123' }],
    desc: '检查某个值是否为有限的数字。'
  },
  isInteger: {
    params: [{ label: 'value', inputType: 'any', desc: '要检测的值，如 myVar 或 123' }],
    desc: '检查某个值是否为整数。'
  },
  isNaN: {
    params: [{ label: 'value', inputType: 'any', desc: '要检测的值' }],
    desc: '检查某个值是否为 NaN。'
  },
  isSafeInteger: {
    params: [{ label: 'value', inputType: 'any', desc: '要检测的值，如 myVar 或 123' }],
    desc: '检查某个值是否为安全整数。'
  },
  parseFloat: {
    params: [{ label: 'string', inputType: 'text', desc: '要解析的字符串，如 "3.14"' }],
    desc: '解析一个字符串参数并返回一个浮点数。'
  },
  parseInt: {
    params: [
      { label: 'string', inputType: 'text', desc: '要解析的字符串，如 "123"' },
      { label: 'radix', inputType: 'number', min: 2, max: 36, desc: '进制基数 (2-36)', optional: true }
    ],
    desc: '解析一个字符串参数并返回一个指定基数的整数。'
  },
};
const instanceMethodOptions = Object.keys(instanceMethodMap).map(m => ({ label: m, value: m, description: instanceMethodMap[m].desc }));
const staticOperationOptions = Object.keys(staticOperationsMap).map(m => ({ label: m, value: m, description: staticOperationsMap[m].desc }));

// 从映射创建参数对象，保留类型约束信息
function createParam(paramDef) {
  // 兼容旧的字符串格式和新的对象格式
  const def = typeof paramDef === 'string' ? { label: paramDef, inputType: 'any' } : paramDef;
  return {
    id: uid(),
    label: def.label,
    isSlot: false,
    value: '',
    // 类型约束信息
    inputType: def.inputType || 'any',
    desc: def.desc || '',
    min: def.min,
    max: def.max,
    optional: def.optional || false
  };
}

// --- 统一更新函数 ---
function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// --- isSlot 插槽管理 ---
function updateSlot(param, isSlot, prefix = '', labelOverride = '') {
  param.isSlot = isSlot;
  const node = props.value;
  const existingIdx = node.inputs.findIndex(i => i.id === param.id);
  const slotLabel = `${prefix}${labelOverride || param.label || 'value'}`;

  if (isSlot && existingIdx === -1) {
    node.addInput(slotLabel, 'string', { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    node.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// --- 操作类型切换 ---
function onOperationTypeChange(newType) {
  updateField('operationType', newType);
}

// --- 静态操作切换 ---
function onStaticOperationChange(newOperation) {
  // 清理旧的 slot
  properties.value.staticParams?.forEach(p => {
    if (p.isSlot) {
      const idx = props.value.inputs.findIndex(i => i.id === p.id);
      if (idx !== -1) props.value.removeInput(idx);
    }
  });
  // 设置新参数
  const newParams = (staticOperationsMap[newOperation]?.params || []).map(l => createParam(l));
  set(properties.value, 'staticOperation', newOperation);
  set(properties.value, 'staticParams', newParams);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// --- 方法卡片管理 ---
const hoverIdx = ref(-1);

function addMethodCard() {
  const defaultMethod = 'toFixed';
  properties.value.methods.push({
    id: uid(),
    methodName: defaultMethod,
    params: instanceMethodMap[defaultMethod].params.map(p => createParam(p))
  });
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function removeMethodCard(idx) {
  const [removed] = properties.value.methods.splice(idx, 1);
  if (removed) {
    removed.params.forEach(p => {
      if (p.isSlot) {
        const slotIdx = props.value.inputs.findIndex(i => i.id === p.id);
        if (slotIdx !== -1) props.value.removeInput(slotIdx);
      }
    });
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function onMethodChange(card, newMethod, cardIdx) {
  // 清理旧参数的 slot
  card.params.forEach(p => {
    if (p.isSlot) {
      const idx = props.value.inputs.findIndex(i => i.id === p.id);
      if (idx !== -1) props.value.removeInput(idx);
    }
  });
  card.methodName = newMethod;
  card.params = (instanceMethodMap[newMethod]?.params || []).map(l => createParam(l));
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// --- 初始化静态参数（确保与操作匹配） ---
watch(() => properties.value.staticOperation, (op) => {
  if (!op || !properties.value.staticParams) return;
  const expectedParams = staticOperationsMap[op]?.params || [];
  if (properties.value.staticParams.length !== expectedParams.length) {
    properties.value.staticParams = expectedParams.map(l => createParam(l));
  }
}, { immediate: true });
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 声明区 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-checkbox dense dark :model-value="properties.exported" :disable="properties.outputVar?.isSlot"
            @update:model-value="val => updateField('exported', val)" label="Export" class="q-mb-xs" />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle :model-value="properties.outputVar?.isSlot"
              @update:model-value="val => updateSlot(properties.outputVar, val, 'Var-', 'Name')" dense dark
              label="VarName" style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined :model-value="properties.declareType" :disable="properties.outputVar?.isSlot"
              @update:model-value="val => updateField('declareType', val)" :options="['const', 'let']"
              class="col-auto" />
            <q-input dense dark outlined class="col" :model-value="properties.outputVar?.value"
              @update:model-value="val => updateField('outputVar.value', val)" :disable="properties.outputVar?.isSlot"
              hide-bottom-space />
          </div>
        </q-card-section>
      </q-card>

      <!-- 操作类型切换 -->
      <q-btn-toggle :model-value="properties.operationType" @update:model-value="onOperationTypeChange" no-caps
        unelevated toggle-color="primary" color="grey-8"
        :options="[{ label: 'Instance', value: 'instance' }, { label: 'Static', value: 'static' }]"
        class="full-width" />

      <!-- Instance 模式 -->
      <template v-if="properties.operationType === 'instance'">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption q-mb-xs">new Number(value)</div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle :model-value="properties.constructorParam?.isSlot"
                @update:model-value="val => updateSlot(properties.constructorParam, val)" dense dark label="value"
                style="min-width: 80px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" v-model="properties.constructorParam.value"
                :disable="properties.constructorParam?.isSlot" hide-bottom-space>
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      构造函数参数<br />示例: 123, myVar
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>

        <!-- 方法链 -->
        <q-card v-for="(card, idx) in properties.methods" :key="card.id" dark flat bordered style="position: relative;"
          @mouseenter="hoverIdx = idx" @mouseleave="hoverIdx = -1">
          <q-btn v-if="hoverIdx === idx" icon="delete" flat dense round color="grey-6"
            @click="removeMethodCard(idx)" style="position: absolute; right: 2px; top: 2px; z-index: 1;" />
          <q-badge color="primary">{{ idx + 1 }}</q-badge>
          <q-card-section class="q-pa-sm">
            <q-select dense dark outlined :options="instanceMethodOptions" :model-value="card.methodName"
              @update:model-value="val => onMethodChange(card, val, idx)" emit-value map-options class="q-mb-xs">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <div v-for="p in card.params" :key="p.id" class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
              <q-toggle :model-value="p.isSlot" @update:model-value="val => updateSlot(p, val, `${idx + 1}-`)" dense
                dark :label="p.label + (p.optional ? '?' : '')" style="min-width: 80px; flex-shrink: 0;" />
              <!-- 数字类型输入 -->
              <q-input v-if="p.inputType === 'number'" dense dark outlined class="col" v-model="p.value"
                :disable="p.isSlot" hide-bottom-space
                :error="!p.isSlot && p.value !== '' && p.value != null && (isNaN(Number(p.value)) || Number(p.value) < p.min || Number(p.value) > p.max)"
                :error-message="isNaN(Number(p.value)) ? '请输入有效数字' : `范围: ${p.min}-${p.max}`">
                <template v-slot:append>
                  <q-icon v-if="p.desc && !p.isSlot" name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">{{ p.desc }}</q-tooltip>
                  </q-icon>
                </template>
              </q-input>
              <!-- 文本/任意类型输入 -->
              <q-input v-else dense dark outlined class="col" v-model="p.value" :disable="p.isSlot" hide-bottom-space>
                <template v-slot:append>
                  <q-icon v-if="p.desc && !p.isSlot" name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">{{ p.desc }}</q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>
        <q-btn flat color="primary" label="Add Method" no-caps dense @click="addMethodCard" class="full-width" />
      </template>

      <!-- Static 模式 -->
      <template v-if="properties.operationType === 'static'">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <q-select dense dark outlined :options="staticOperationOptions" :model-value="properties.staticOperation"
              @update:model-value="onStaticOperationChange" emit-value map-options label="Static Operation">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <div v-for="p in properties.staticParams" :key="p.id"
              class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
              <q-toggle :model-value="p.isSlot" @update:model-value="val => updateSlot(p, val, 'S-')" dense dark
                :label="p.label + (p.optional ? '?' : '')" style="min-width: 80px; flex-shrink: 0;" />
              <!-- 数字类型输入 -->
              <q-input v-if="p.inputType === 'number'" dense dark outlined class="col" v-model="p.value"
                :disable="p.isSlot" hide-bottom-space
                :error="!p.isSlot && p.value !== '' && p.value != null && (isNaN(Number(p.value)) || Number(p.value) < p.min || Number(p.value) > p.max)"
                :error-message="isNaN(Number(p.value)) ? '请输入有效数字' : `范围: ${p.min}-${p.max}`">
                <template v-slot:append>
                  <q-icon v-if="p.desc && !p.isSlot" name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">{{ p.desc }}</q-tooltip>
                  </q-icon>
                </template>
              </q-input>
              <!-- 文本/任意类型输入 -->
              <q-input v-else dense dark outlined class="col" v-model="p.value" :disable="p.isSlot" hide-bottom-space>
                <template v-slot:append>
                  <q-icon v-if="p.desc && !p.isSlot" name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">{{ p.desc }}</q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>
      </template>
    </div>
  </BasePropertyPanel>
</template>
