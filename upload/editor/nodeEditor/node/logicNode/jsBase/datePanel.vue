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
  outputVar: { id: uid(), isSlot: false, value: `date_${uid().slice(0, 8)}` },
  constructorType: 'now', // 'now', 'timestamp', 'string', 'components'
  constructorParams: [],
  methods: [],
  remark: ''
});

// === 单一数据源模式 ===
const properties = computed(() => props.value?.properties || {});

// 专门的初始化函数
function ensureProperties() {
  const hasPropertiesData = props.value?.properties &&
    typeof props.value.properties === 'object' &&
    !Array.isArray(props.value.properties) &&
    Object.keys(props.value.properties).length > 0;

  if (!hasPropertiesData) {
    props.value.properties = defaultProperties();
  }

  // 确保 methods 和 constructorParams 是数组
  if (!Array.isArray(props.value.properties.methods)) {
    props.value.properties.methods = [];
  }
  if (!Array.isArray(props.value.properties.constructorParams)) {
    props.value.properties.constructorParams = [];
  }

  // 确保 outputVar 是三元组
  if (typeof props.value.properties.outputVar === 'string') {
    props.value.properties.outputVar = {
      id: uid(),
      isSlot: false,
      value: props.value.properties.outputVar
    };
  }
}

onMounted(() => {
  ensureProperties();
});

// === 方法映射定义 ===
const hasReturnValue = { hasReturnValue: true };
const noReturnValue = { hasReturnValue: false };

const methodParamMap = {
  // Get Methods
  getDate: { params: [], desc: '返回一个月中的某一天 (1-31)', ...hasReturnValue },
  getDay: { params: [], desc: '返回一周中的某一天 (0-6)', ...hasReturnValue },
  getFullYear: { params: [], desc: '返回四位数的年份', ...hasReturnValue },
  getHours: { params: [], desc: '返回小时 (0-23)', ...hasReturnValue },
  getMilliseconds: { params: [], desc: '返回毫秒 (0-999)', ...hasReturnValue },
  getMinutes: { params: [], desc: '返回分钟 (0-59)', ...hasReturnValue },
  getMonth: { params: [], desc: '返回月份 (0-11)', ...hasReturnValue },
  getSeconds: { params: [], desc: '返回秒数 (0-59)', ...hasReturnValue },
  getTime: { params: [], desc: '返回 1970 年 1 月 1 日至今的毫秒数', ...hasReturnValue },
  // Set Methods
  setDate: { params: ['day'], desc: '设置一个月中的某一天', ...noReturnValue },
  setFullYear: { params: ['year', 'month', 'day'], desc: '设置年份', ...noReturnValue },
  setHours: { params: ['hour', 'min', 'sec', 'ms'], desc: '设置小时', ...noReturnValue },
  setMilliseconds: { params: ['ms'], desc: '设置毫秒', ...noReturnValue },
  setMinutes: { params: ['min', 'sec', 'ms'], desc: '设置分钟', ...noReturnValue },
  setMonth: { params: ['month', 'day'], desc: '设置月份', ...noReturnValue },
  setSeconds: { params: ['sec', 'ms'], desc: '设置秒钟', ...noReturnValue },
  setTime: { params: ['ms'], desc: '设置自 1970 年 1 月 1 日以来的毫秒数', ...noReturnValue },
  // To... Methods
  toDateString: { params: [], desc: '把 Date 的日期部分转换为可读的字符串', ...hasReturnValue },
  toISOString: { params: [], desc: '使用 ISO 标准将 Date 对象转换为字符串', ...hasReturnValue },
  toJSON: { params: [], desc: '以 JSON 数据格式返回 Date 对象', ...hasReturnValue },
  toLocaleDateString: { params: [], desc: '使用本地约定返回 Date 对象的日期部分', ...hasReturnValue },
  toLocaleString: { params: [], desc: '根据本地约定将 Date 对象转换为字符串', ...hasReturnValue },
  toLocaleTimeString: { params: [], desc: '使用本地约定返回 Date 对象的时间部分', ...hasReturnValue },
  toString: { params: [], desc: '把 Date 对象转换为字符串', ...hasReturnValue },
  toUTCString: { params: [], desc: '根据世界时约定将 Date 对象转换为字符串', ...hasReturnValue },
};

const methodOptions = Object.keys(methodParamMap).map(m => ({
  label: m,
  value: m,
  description: methodParamMap[m].desc
}));

const constructorTypeOptions = [
  { label: 'Now', value: 'now', description: '当前时间 new Date()' },
  { label: 'Timestamp', value: 'timestamp', description: '时间戳 new Date(ms)' },
  { label: 'String', value: 'string', description: '日期字符串 new Date("2024-01-01")' },
  { label: 'Components', value: 'components', description: '分量构造 new Date(year, month, ...)' }
];

const constructorParamLabels = {
  timestamp: ['timestamp'],
  string: ['dateString'],
  components: ['year', 'month', 'day', 'hours', 'minutes', 'seconds', 'ms']
};

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

// === VarName Slot 管理 ===
function updateVarNameSlot(isSlot) {
  const outputVar = properties.value.outputVar;
  outputVar.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex(i => i.id === outputVar.id);

  if (isSlot && existingIdx === -1) {
    props.value.addInput('VarName', 'string', { id: outputVar.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  triggerUpdate();
}

// === 输出插槽管理 ===
const disableOutput = computed(() => {
  const methods = properties.value.methods;
  if (!props.value) return true;

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

  return !hasReturn;
});

// === Constructor 类型变更 ===
function onConstructorTypeChange(newType) {
  updateField('constructorType', newType);

  // 清理旧的 slots
  properties.value.constructorParams.forEach(p => {
    const slotIdx = props.value.inputs.findIndex(i => i.id === p.id);
    if (slotIdx !== -1) props.value.removeInput(slotIdx);
  });

  const newParams = (constructorParamLabels[newType] || []).map(l => createParam(l));
  updateField('constructorParams', newParams);
}

// === Constructor 参数 Slot 管理 ===
function updateConstructorParamSlot(param, isSlot) {
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex(i => i.id === param.id);
  const slotLabel = `C-${param.label}`;

  if (isSlot && existingIdx === -1) {
    props.value.addInput(slotLabel, 'string', { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  triggerUpdate();
}

// === 方法卡片管理 ===
function addMethodCard() {
  const method = {
    id: uid(),
    methodName: 'getFullYear',
    params: []
  };

  if (properties.value.methods) {
    properties.value.methods.push(method);
  } else {
    properties.value.methods = [method];
  }

  triggerUpdate();
}

function removeMethodCard(idx) {
  const [removedCard] = properties.value.methods.splice(idx, 1);
  if (!removedCard) return;

  // 清理所有参数的 slots
  if (Array.isArray(removedCard.params)) {
    removedCard.params.forEach(p => {
      if (p.isSlot) {
        const slotIdx = props.value.inputs.findIndex(i => i.id === p.id);
        if (slotIdx !== -1) props.value.removeInput(slotIdx);
      }
    });
  }
  triggerUpdate();
}

function onMethodChange(card, newMethod) {
  card.methodName = newMethod;

  // 清理旧参数的 slots
  card.params.forEach(p => {
    if (p.isSlot) {
      const idx = props.value.inputs.findIndex(i => i.id === p.id);
      if (idx !== -1) props.value.removeInput(idx);
    }
  });

  card.params = (methodParamMap[newMethod]?.params || []).map(l => createParam(l));
  triggerUpdate();
}

// === 方法参数 Slot 管理 ===
function updateMethodParamSlot(param, isSlot, methodIdx) {
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex(i => i.id === param.id);
  const slotLabel = `${methodIdx + 1}-${param.label}`;

  if (isSlot && existingIdx === -1) {
    props.value.addInput(slotLabel, 'string', { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  triggerUpdate();
}

function updateParamValue(obj, key, value) {
  obj[key] = value;
  triggerUpdate();
}
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 声明控制卡片 -->
      <q-card dark flat bordered class="q-mb-xs">
        <q-card-section class="q-pa-sm">
          <q-checkbox dense dark :model-value="properties.exported"
            @update:model-value="val => updateField('exported', val)" label="export"
            :disable="disableOutput || properties.outputVar?.isSlot" />
          <div class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
            <q-toggle dense dark label="VarName" :model-value="properties.outputVar?.isSlot"
              @update:model-value="updateVarNameSlot" style="min-width: 90px; flex-shrink: 0;"
              :disable="disableOutput" />
            <q-select dense dark outlined style="width: 80px" :options="['const', 'let']"
              :model-value="properties.declareType" @update:model-value="val => updateField('declareType', val)"
              :disable="disableOutput || properties.outputVar?.isSlot" />
            <q-input dense dark outlined class="col" :model-value="properties.outputVar?.value"
              @update:model-value="val => updateField('outputVar.value', val)" placeholder="变量名"
              :disable="disableOutput || properties.outputVar?.isSlot">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    Date 对象的变量名<br />
                    示例: myDate, startDate, endDate
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- Constructor 卡片 -->
      <q-card dark flat bordered class="q-mb-xs">
        <q-card-section class="q-pa-sm">
          <q-select dense dark outlined :options="constructorTypeOptions" :model-value="properties.constructorType"
            @update:model-value="onConstructorTypeChange" emit-value map-options label="Constructor Type">
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps" dense>
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <div v-for="p in (properties.constructorParams || [])" :key="p.id"
            class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
            <q-toggle dense dark :model-value="p.isSlot" @update:model-value="val => updateConstructorParamSlot(p, val)"
              :label="p.label" style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :model-value="p.value"
              @update:model-value="val => updateParamValue(p, 'value', val)" :disable="p.isSlot"
              :placeholder="p.label" />
          </div>
        </q-card-section>
      </q-card>

      <!-- 方法卡片 -->
      <q-card dark flat bordered class="q-mb-xs">

        <q-card-section class="q-pa-sm">
          <template v-for="(card, idx) in (properties.methods || [])" :key="card.id">
            <div style="position: relative; padding-right: 40px;" class="q-mt-xs">
              <q-btn icon="close" flat dense round color="negative" @click="removeMethodCard(idx)"
                style="position: absolute; right: 0; top: 0; z-index: 1;" />
              <q-badge color="primary">{{ idx + 1 }}</q-badge>

              <q-select dense dark outlined :options="methodOptions" :model-value="card.methodName"
                @update:model-value="val => onMethodChange(card, val)" emit-value map-options class="q-mt-xs">
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps" dense>
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption>{{ scope.opt.description }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>

              <div v-for="p in (card.params || [])" :key="p.id" class="row items-center q-gutter-x-sm q-mt-xs no-wrap">
                <q-toggle dense dark :model-value="p.isSlot"
                  @update:model-value="val => updateMethodParamSlot(p, val, idx)" :label="p.label"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :model-value="p.value"
                  @update:model-value="val => updateParamValue(p, 'value', val)" :disable="p.isSlot"
                  :placeholder="p.label" />
              </div>
            </div>
          </template>

        </q-card-section>
      </q-card>
      <q-btn flat color="primary" label="Add Method" no-caps dense @click="addMethodCard" class="full-width q-mt-xs" />
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
