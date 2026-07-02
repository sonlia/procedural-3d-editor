<script setup>
import { computed, watch } from 'vue';
import { uid } from 'quasar';
import { set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();

// 单一数据源 - 直接使用 props.value.properties
const properties = computed(() => props.value?.properties || {});

// --- Math 操作映射 ---
const mathOperationsMap = {
  E: { params: [], desc: '欧拉常数 (≈2.718)' },
  PI: { params: [], desc: '圆周率 (≈3.14159)' },
  abs: { params: ['x'], desc: '返回绝对值' },
  acos: { params: ['x'], desc: '返回反余弦值' },
  asin: { params: ['x'], desc: '返回反正弦值' },
  atan: { params: ['x'], desc: '返回反正切值' },
  atan2: { params: ['y', 'x'], desc: '返回 y/x 的反正切值' },
  ceil: { params: ['x'], desc: '向上取整' },
  cos: { params: ['x'], desc: '返回余弦值' },
  exp: { params: ['x'], desc: '返回 e 的 x 次幂' },
  floor: { params: ['x'], desc: '向下取整' },
  log: { params: ['x'], desc: '返回自然对数' },
  max: { params: ['n1'], desc: '返回最大值', variadic: true },
  min: { params: ['n1'], desc: '返回最小值', variadic: true },
  pow: { params: ['base', 'exponent'], desc: '返回 base 的 exponent 次幂' },
  random: { params: [], desc: '返回 0~1 随机数' },
  round: { params: ['x'], desc: '四舍五入' },
  sin: { params: ['x'], desc: '返回正弦值' },
  sqrt: { params: ['x'], desc: '返回平方根' },
  tan: { params: ['x'], desc: '返回正切值' },
};

const operationOptions = Object.keys(mathOperationsMap).map(m => ({
  label: m,
  value: m,
  description: mathOperationsMap[m].desc
}));

// 统一更新函数
function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function createParam(label) {
  return { id: uid(), label, isSlot: false, value: '' };
}

// --- 监听 params 变化，同步 input slots ---
watch(() => properties.value.params, (params) => {
  if (!props.value || !Array.isArray(params)) return;

  // 同步每个参数的 slot 状态
  params.forEach(p => {
    const existingIdx = props.value.inputs.findIndex(i => i.id === p.id);
    const slotLabel = `${properties.value.operation}-${p.label}`;

    if (p.isSlot && existingIdx === -1) {
      props.value.addInput(slotLabel, 'string', { id: p.id });
    } else if (!p.isSlot && existingIdx !== -1) {
      props.value.removeInput(existingIdx);
    }
  });
}, { immediate: true, deep: true });

// --- 监听 outputVar slot 变化 ---
watch(() => properties.value.outputVarIsSlot, (isSlot) => {
  if (!props.value) return;
  const slotId = properties.value.outputVarSlotId;
  const existingIdx = props.value.inputs.findIndex(i => i.id === slotId);

  if (isSlot && existingIdx === -1) {
    props.value.addInput('VarName', 'string', { id: slotId });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}, { immediate: true });

// --- UI 事件处理 ---
function onOperationChange(newOperation) {
  // 清理旧参数的插槽
  if (Array.isArray(properties.value.params)) {
    properties.value.params.forEach(p => {
      if (p.isSlot) {
        const idx = props.value.inputs.findIndex(i => i.id === p.id);
        if (idx !== -1) props.value.removeInput(idx);
      }
    });
  }

  // 设置新参数
  const newParams = (mathOperationsMap[newOperation]?.params || []).map(l => createParam(l));
  updateField('operation', newOperation);
  updateField('params', newParams);
}

function addVariadicParam() {
  const params = properties.value.params || [];
  const newLabel = `n${params.length + 1}`;
  params.push(createParam(newLabel));
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function removeParam(idx) {
  const params = properties.value.params || [];
  const [removedParam] = params.splice(idx, 1);
  if (removedParam?.isSlot) {
    const slotIdx = props.value.inputs.findIndex(i => i.id === removedParam.id);
    if (slotIdx !== -1) {
      props.value.removeInput(slotIdx);
    }
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateParamSlot(param, isSlot) {
  param.isSlot = isSlot;
  // watch 会自动同步 slot
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 计算属性：是否为可变参数且有多个参数
const isVariadicWithMultipleParams = computed(() => {
  return mathOperationsMap[properties.value.operation]?.variadic &&
         (properties.value.params || []).length > 1;
});

// 获取参数帮助文本
function getParamHelpText(label) {
  const operation = properties.value.operation;
  const helpTexts = {
    x: '数值参数，如: 3.14, -5, 0',
    y: 'Y 坐标值',
    base: '底数，如: 2, 10',
    exponent: '指数，如: 2, 0.5',
    n1: '数值参数，可添加多个',
  };
  return helpTexts[label] || `${operation} 的 ${label} 参数`;
}
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- Declaration Card -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-checkbox
            dense
            dark
            :disable="properties.outputVarIsSlot"
            :model-value="properties.exported"
            @update:model-value="val => updateField('exported', val)"
            label="Export"
            class="q-mb-xs"
          />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle
              dense
              dark
              label="VarName"
              :model-value="properties.outputVarIsSlot"
              @update:model-value="val => updateField('outputVarIsSlot', val)"
              style="min-width: 90px; flex-shrink: 0;"
            />
            <q-select
              dense
              dark
              outlined
              style="width: 80px; flex-shrink: 0;"
              :options="['const', 'let']"
              :disable="properties.outputVarIsSlot"
              :model-value="properties.declareType"
              @update:model-value="val => updateField('declareType', val)"
            />
            <q-input
              dense
              dark
              outlined
              class="col"
              :model-value="properties.outputVar"
              @update:model-value="val => updateField('outputVar', val)"
              :disable="properties.outputVarIsSlot"
              placeholder="变量名"
            >
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    存储计算结果的变量名<br />
                    示例: result, sum, avg
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- Operation Card -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-select
            dense
            dark
            outlined
            :options="operationOptions"
            :model-value="properties.operation"
            @update:model-value="onOperationChange"
            emit-value
            map-options
            label="Operation"
          >
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <!-- 参数列表 -->
          <div
            v-for="(p, idx) in (properties.params || [])"
            :key="p.id"
            class="q-mt-xs"
            style="position: relative;"
          >
            <div
              class="row items-center q-gutter-x-sm no-wrap"
              :style="isVariadicWithMultipleParams ? 'padding-right: 40px;' : ''"
            >
              <q-toggle
                :model-value="p.isSlot"
                @update:model-value="(val) => updateParamSlot(p, val)"
                dense
                dark
                :label="p.label"
                style="min-width: 90px; flex-shrink: 0;"
              />
              <q-input
                dense
                dark
                outlined
                class="col"
                :model-value="p.value"
                @update:model-value="val => p.value = val"
                :disable="p.isSlot"
                placeholder="参数值"
              >
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      {{ getParamHelpText(p.label) }}
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <q-btn
              v-if="isVariadicWithMultipleParams"
              flat
              dense
              icon="close"
              color="negative"
              size="sm"
              @click="removeParam(idx)"
              style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%);"
            />
          </div>

          <q-btn
            v-if="mathOperationsMap[properties.operation]?.variadic"
            flat
            dense
            icon="add"
            label="添加参数"
            no-caps
            @click="addVariadicParam"
            color="primary"
            class="full-width q-mt-sm"
          />
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
