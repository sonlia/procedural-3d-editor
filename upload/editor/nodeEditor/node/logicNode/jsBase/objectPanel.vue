<script setup>
import { ref, onMounted, computed } from 'vue';
import { uid } from 'quasar';
import { set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel(); // node 实例

// === 数据模型定义 ===
const defaultProperties = () => ({
  exported: false,
  declareType: 'const',
  outputVar: { id: uid(), isSlot: false, value: 'myObject' }, // 三元组结构
  operationType: 'instance', // 'instance' or 'static'
  // Instance mode
  sourceParam: createParam('Source'),
  methods: [],
  // Static mode
  staticOperation: 'assign',
  staticParams: [],
  remark: ''
});

// === 单一数据源模式 ===
const properties = computed(() => props.value?.properties || {});

function ensureProperties() {
  const hasData = props.value?.properties &&
    typeof props.value.properties === 'object' &&
    Object.keys(props.value.properties).length > 0;

  if (!hasData) {
    props.value.properties = defaultProperties();
  }

  // 确保 sourceParam 存在
  if (!props.value.properties.sourceParam) {
    props.value.properties.sourceParam = createParam('Source');
  }

  // 确保 outputVar 是三元组
  if (typeof props.value.properties.outputVar === 'string') {
    props.value.properties.outputVar = {
      id: uid(),
      isSlot: false,
      value: props.value.properties.outputVar
    };
  }

  // 确保 staticParams 存在
  if (!Array.isArray(props.value.properties.staticParams)) {
    props.value.properties.staticParams = (staticMethodMap[props.value.properties.staticOperation]?.params || []).map(l => createParam(l));
  }
}

onMounted(() => {
  ensureProperties();
  updateOutputSlot();
});

// === 方法映射 ===
const hasReturnValue = { hasReturnValue: true };

const instanceMethodMap = {
  hasOwnProperty: { params: ['prop'], description: '检查对象自身属性中是否具有指定的属性。', ...hasReturnValue },
  toString: { params: [], description: '返回对象的字符串表示。', ...hasReturnValue },
};

const staticMethodMap = {
  assign: { params: ['target'], description: '将所有可枚举的自身属性的值从一个或多个源对象复制到目标对象。', variadic: true, variadicLabel: 'source', ...hasReturnValue },
  keys: { params: ['obj'], description: '返回一个由一个给定对象的自身可枚举属性组成的数组。', ...hasReturnValue },
  values: { params: ['obj'], description: '返回一个给定对象自身的所有可枚举属性值的数组。', ...hasReturnValue },
  entries: { params: ['obj'], description: '返回一个给定对象自身可枚举属性的 [key, value] 键值对数组。', ...hasReturnValue },
  fromEntries: { params: ['iterable'], description: '把键值对列表转换为一个对象。', ...hasReturnValue },
  freeze: { params: ['obj'], description: '冻结一个对象。', ...hasReturnValue },
};

const instanceMethodOptions = Object.keys(instanceMethodMap).map(m => ({
  label: m,
  value: m,
  description: instanceMethodMap[m].description
}));

const staticMethodOptions = Object.keys(staticMethodMap).map(m => ({
  label: m,
  value: m,
  description: staticMethodMap[m].description
}));

// === 工具函数 ===
function createParam(label) {
  return { id: uid(), label, isSlot: false, value: '' };
}

// === 统一更新函数 ===
function triggerUpdate() {
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateField(key, value) {
  set(properties.value, key, value);
  triggerUpdate();
}

// === 输出 slot 管理（移除 computed 副作用）===
function updateOutputSlot() {
  if (!props.value) return;

  const opType = properties.value.operationType;
  let has = true;

  if (opType === 'instance' && properties.value.methods?.length > 0) {
    const lastMethod = properties.value.methods[properties.value.methods.length - 1];
    has = instanceMethodMap[lastMethod.methodName]?.hasReturnValue ?? true;
  } else if (opType === 'static') {
    has = staticMethodMap[properties.value.staticOperation]?.hasReturnValue ?? true;
  }

  const outSlotIndex = props.value.outputs.findIndex(o => o.name === 'outValue');
  if (has && outSlotIndex === -1) {
    props.value.addOutput('outValue', 'string');
  } else if (!has && outSlotIndex !== -1) {
    props.value.removeOutput(outSlotIndex);
  }
}

// === 变量名 slot 管理 ===
function updateVarNameSlot(isSlot) {
  const outputVar = properties.value.outputVar;
  if (!outputVar) return;

  outputVar.isSlot = isSlot;
  const existingSlot = props.value.inputs.find(s => s.id === outputVar.id);

  if (isSlot && !existingSlot) {
    props.value.addInput('VarName', 'string', { id: outputVar.id });
  } else if (!isSlot && existingSlot) {
    const index = props.value.inputs.indexOf(existingSlot);
    props.value.removeInput(index);
  }
  triggerUpdate();
}

// === 参数 slot 管理 ===
function updateSlot(param, isSlot, prefix = '') {
  if (!param) return;

  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex(i => i.id === param.id);
  const slotLabel = `${prefix}${param.label}`;

  if (isSlot && existingIdx === -1) {
    props.value.addInput(slotLabel, 'string', { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  triggerUpdate();
}

// === 操作类型切换 ===
function onOperationTypeChange(newType) {
  updateField('operationType', newType);
  updateOutputSlot();
}

function onStaticOperationChange(newOperation) {
  // 清理旧参数的 slots
  properties.value.staticParams?.forEach(p => {
    if (p.isSlot) {
      const idx = props.value.inputs.findIndex(i => i.id === p.id);
      if (idx !== -1) props.value.removeInput(idx);
    }
  });

  updateField('staticOperation', newOperation);
  const newParams = (staticMethodMap[newOperation]?.params || []).map(l => createParam(l));
  updateField('staticParams', newParams);
  updateOutputSlot();
}

// === 可变参数管理 ===
function addVariadicParam() {
  const opInfo = staticMethodMap[properties.value.staticOperation];
  if (!opInfo?.variadic) return;

  const newLabel = `${opInfo.variadicLabel}${properties.value.staticParams.length}`;
  properties.value.staticParams.push(createParam(newLabel));
  triggerUpdate();
}

function removeVariadicParam(idx) {
  const [removed] = properties.value.staticParams.splice(idx, 1);
  if (removed?.isSlot) {
    const inputIdx = props.value.inputs.findIndex(i => i.id === removed.id);
    if (inputIdx !== -1) props.value.removeInput(inputIdx);
  }
  triggerUpdate();
}

// === Instance 方法管理 ===
function addMethodCard() {
  if (!properties.value.methods) {
    properties.value.methods = [];
  }
  properties.value.methods.push({
    id: uid(),
    methodName: 'hasOwnProperty',
    params: [createParam('prop')]
  });
  updateOutputSlot();
  triggerUpdate();
}

function removeMethodCard(idx) {
  const [removed] = properties.value.methods.splice(idx, 1);
  if (removed) {
    removed.params?.forEach(p => {
      if (p.isSlot) {
        const inputIdx = props.value.inputs.findIndex(i => i.id === p.id);
        if (inputIdx !== -1) props.value.removeInput(inputIdx);
      }
    });
  }
  updateOutputSlot();
  triggerUpdate();
}

function onMethodChange(card, newMethod) {
  // 清理旧参数的 slots
  card.params?.forEach(p => {
    if (p.isSlot) {
      const inputIdx = props.value.inputs.findIndex(i => i.id === p.id);
      if (inputIdx !== -1) props.value.removeInput(inputIdx);
    }
  });

  card.methodName = newMethod;
  card.params = (instanceMethodMap[newMethod]?.params || []).map(l => createParam(l));
  updateOutputSlot();
  triggerUpdate();
}

// 检查是否禁用输出相关控件
const disableOutput = computed(() => {
  const opType = properties.value.operationType;
  let has = true;

  if (opType === 'instance' && properties.value.methods?.length > 0) {
    const lastMethod = properties.value.methods[properties.value.methods.length - 1];
    has = instanceMethodMap[lastMethod.methodName]?.hasReturnValue ?? true;
  } else if (opType === 'static') {
    has = staticMethodMap[properties.value.staticOperation]?.hasReturnValue ?? true;
  }

  return !has;
});
</script>

<template>
  <BasePropertyPanel v-model="props">
    <!-- ⚠️ 必须用 div 包裹，提供呼吸空间和统一间距 -->
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- === 声明区 === -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- Export 单独一行 -->
          <q-checkbox dense dark :model-value="properties.exported"
            @update:model-value="val => updateField('exported', val)" label="Export" class="q-mb-xs"
            :disable="disableOutput || properties.outputVar?.isSlot" />

          <!-- 变量名行：toggle + declareType + input -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName" :model-value="properties.outputVar?.isSlot"
              @update:model-value="updateVarNameSlot" style="min-width: 90px; flex-shrink: 0;"
              :disable="disableOutput" />
            <q-select dense dark outlined :model-value="properties.declareType"
              @update:model-value="val => updateField('declareType', val)" :options="['const', 'let']" class="col-auto"
              style="min-width: 70px;" :disable="disableOutput || properties.outputVar?.isSlot" />
            <q-input dense dark outlined class="col" :model-value="properties.outputVar?.value"
              @update:model-value="val => updateField('outputVar.value', val)" placeholder="变量名"
              :disable="disableOutput || properties.outputVar?.isSlot">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    输出变量名<br />
                    示例: myObj, result, data
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- === 操作类型切换 === -->
      <q-btn-toggle :model-value="properties.operationType" @update:model-value="onOperationTypeChange" no-caps
        unelevated toggle-color="primary" color="grey-8"
        :options="[{ label: 'Instance', value: 'instance' }, { label: 'Static', value: 'static' }]"
        class="full-width" />

      <!-- === Instance 模式 === -->
      <template v-if="properties.operationType === 'instance'">
        <!-- 源对象 -->
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark :model-value="properties.sourceParam?.isSlot"
                @update:model-value="val => updateSlot(properties.sourceParam, val)"
                :label="properties.sourceParam?.label || 'Source'" style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" type="textarea" autogrow
                :model-value="properties.sourceParam?.value"
                @update:model-value="val => updateField('sourceParam.value', val)"
                :disable="properties.sourceParam?.isSlot" placeholder="{ name: 'Gemini' }">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      源对象，支持对象字面量或变量名<br />
                      示例: { key: 'value' }, myObj
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>

        <!-- 方法卡片 -->
        <q-card v-for="(card, idx) in (properties.methods || [])" :key="card.id" dark flat bordered
          style="position: relative;">
          <!-- 删除按钮：绝对定位在右上角 -->
          <q-btn icon="close" flat dense color="negative" @click="removeMethodCard(idx)"
            style="position: absolute; right: 8px; top: 8px; z-index: 1;" />
          <q-badge color="primary" class="q-ml-xs q-mt-xs">{{ idx + 1 }}</q-badge>

          <!-- 内容区预留空间 -->
          <q-card-section class="q-pa-sm" style="padding-right: 48px;">
            <q-select dense dark outlined :options="instanceMethodOptions" :model-value="card.methodName"
              @update:model-value="val => onMethodChange(card, val)" emit-value map-options>
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps" dense>
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <div v-for="p in card.params" :key="p.id" class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
              <q-toggle dense dark :model-value="p.isSlot"
                @update:model-value="val => updateSlot(p, val, `${idx + 1}-`)" :label="p.label"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :model-value="p.value"
                @update:model-value="val => { p.value = val; triggerUpdate(); }" :disable="p.isSlot" placeholder="参数值">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      方法参数值<br />
                      示例: 'propertyName', 变量名
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>

        <q-btn dense flat no-caps label="Add Method" color="primary" @click="addMethodCard" class="full-width" />
      </template>

      <!-- === Static 模式 === -->
      <template v-if="properties.operationType === 'static'">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <q-select dense dark outlined :options="staticMethodOptions" :model-value="properties.staticOperation"
              @update:model-value="onStaticOperationChange" emit-value map-options>
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps" dense>
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>

            <div v-for="(p, idx) in (properties.staticParams || [])" :key="p.id"
              class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
              <q-toggle dense dark :model-value="p.isSlot" @update:model-value="val => updateSlot(p, val, 'S-')"
                :label="p.label" style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :model-value="p.value"
                @update:model-value="val => { p.value = val; triggerUpdate(); }" :disable="p.isSlot" placeholder="参数值">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      静态方法参数<br />
                      示例: targetObj, sourceObj
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
              <q-btn v-if="staticMethodMap[properties.staticOperation]?.variadic && idx > 0" icon="close" flat dense
                color="negative" @click="removeVariadicParam(idx)" />
            </div>

            <q-btn v-if="staticMethodMap[properties.staticOperation]?.variadic" label="+ Add Source" no-caps dense flat
              color="primary" @click="addVariadicParam" class="full-width q-mt-xs" />
          </q-card-section>
        </q-card>
      </template>
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
