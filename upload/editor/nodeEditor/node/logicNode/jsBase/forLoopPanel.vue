<script setup>
import { watch, computed } from 'vue';
import { uid } from 'quasar';
import { set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();

const properties = computed(() => props.value?.properties || {});

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 触发图形重新执行以刷新 jsCode
function triggerGraphRun() {
  if (props.value?.graph) {
    props.value.graph.runStep();
  }
}

// 同步循环变量槽的名称
function syncLoopVarSlotName() {
  const loopVarSlot = props.value.inputs.find(i => i.id === properties.value.loopVarSlotId);
  if (!loopVarSlot) return;

  const loopType = properties.value.loopType || 'for...of';
  let varName;
  if (loopType === 'for') {
    varName = properties.value.initVar || 'i';
  } else {
    varName = properties.value.keyVar || (loopType === 'for...of' ? 'item' : 'key');
  }
  loopVarSlot.name = varName;
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function onLoopTypeChange(newType) {
  updateField('loopType', newType);

  if (newType === 'for') {
    // 切换到 for：删除 iterable 槽
    syncIterableSlot(false);
  } else {
    // 切换到 for...of/for...in：删除 for 专用的槽
    syncInitValueSlot(false);
    syncConditionValueSlot(false);
    // 恢复 iterable 槽状态
    syncIterableSlot(properties.value.iterableIsSlot);
    // 设置默认变量名
    if (newType === 'for...of') {
      updateField('keyVar', 'item');
    } else if (newType === 'for...in') {
      updateField('keyVar', 'key');
    }
  }

  // 同步循环变量槽名称
  syncLoopVarSlotName();

  // 切换类型后触发重新执行
  triggerGraphRun();
}

// 同步 iterable 插槽状态
function syncIterableSlot(isSlot) {
  const slotId = properties.value.iterableSlotId;
  const existingIndex = props.value.inputs.findIndex(i => i.id === slotId);

  if (isSlot && existingIndex === -1) {
    props.value.addInput('iterable', 'string', {
      id: slotId,
      hideOnSubgraphPanel: true // 只在外部显示，子图内部不显示
    });
  } else if (!isSlot && existingIndex !== -1) {
    props.value.removeInput(existingIndex);
  }
}

function updateIterableSlot(isSlot) {
  updateField('iterableIsSlot', isSlot);
  syncIterableSlot(isSlot);
}

// 同步 initValue 插槽状态
function syncInitValueSlot(isSlot) {
  const slotId = properties.value.initValueSlotId;
  const existingIndex = props.value.inputs.findIndex(i => i.id === slotId);

  if (isSlot && existingIndex === -1) {
    props.value.addInput('init-value', 'string', {
      id: slotId,
      hideOnSubgraphPanel: true // 只在外部显示，子图内部不显示
    });
  } else if (!isSlot && existingIndex !== -1) {
    props.value.removeInput(existingIndex);
  }
}

function updateInitValueSlot(isSlot) {
  updateField('initValueIsSlot', isSlot);
  syncInitValueSlot(isSlot);
}

// 同步 conditionValue 插槽状态
function syncConditionValueSlot(isSlot) {
  const slotId = properties.value.conditionValueSlotId;
  const existingIndex = props.value.inputs.findIndex(i => i.id === slotId);

  if (isSlot && existingIndex === -1) {
    props.value.addInput('condition-value', 'string', {
      id: slotId,
      hideOnSubgraphPanel: true // 只在外部显示，子图内部不显示
    });
  } else if (!isSlot && existingIndex !== -1) {
    props.value.removeInput(existingIndex);
  }
}

function updateConditionValueSlot(isSlot) {
  updateField('conditionValueIsSlot', isSlot);
  syncConditionValueSlot(isSlot);
}

// 更新 keyVar 名称并同步槽
function updateKeyVar(newName) {
  updateField('keyVar', newName);
  syncLoopVarSlotName();
}

// 更新 initVar 名称并同步槽
function updateInitVar(newName) {
  updateField('initVar', newName);
  syncLoopVarSlotName();
  // 同时更新 increment 中的变量名
  const oldIncrement = properties.value.increment || 'i++';
  const oldVar = oldIncrement.replace(/\+\+|--/, '');
  if (oldVar !== newName) {
    const newIncrement = oldIncrement.replace(oldVar, newName);
    updateField('increment', newIncrement);
  }
}

// 比较运算符选项（带描述）
const comparisonOptions = [
  { label: '<', value: '<', description: '小于' },
  { label: '>', value: '>', description: '大于' },
  { label: '<=', value: '<=', description: '小于等于' },
  { label: '>=', value: '>=', description: '大于等于' },
  { label: '==', value: '==', description: '相等（宽松）' },
  { label: '!=', value: '!=', description: '不等（宽松）' },
  { label: '===', value: '===', description: '严格相等' },
  { label: '!==', value: '!==', description: '严格不等' }
];

// 增量操作选项（基于当前变量名动态生成，带描述）
const incrementOptions = computed(() => {
  const v = properties.value.initVar || 'i';
  return [
    { label: `${v}++`, value: `${v}++`, description: '后置递增' },
    { label: `++${v}`, value: `++${v}`, description: '前置递增' },
    { label: `${v}--`, value: `${v}--`, description: '后置递减' },
    { label: `--${v}`, value: `--${v}`, description: '前置递减' },
    { label: `${v} += 1`, value: `${v} += 1`, description: '每次加 1' },
    { label: `${v} += 2`, value: `${v} += 2`, description: '每次加 2' },
    { label: `${v} -= 1`, value: `${v} -= 1`, description: '每次减 1' },
    { label: `${v} *= 2`, value: `${v} *= 2`, description: '每次乘 2' },
    { label: '自定义', value: 'custom', description: '输入自定义表达式' }
  ];
});

// 检查当前 increment 是否是预设选项
const isCustomIncrement = computed(() => {
  const current = properties.value.increment || '';
  return !incrementOptions.value.some(opt => opt.value === current && opt.value !== 'custom');
});

// 选择增量类型
function onIncrementSelect(val) {
  if (val === 'custom') {
    // 切换到自定义，保留当前值或设置空
    if (!isCustomIncrement.value) {
      updateField('increment', '');
    }
  } else {
    updateField('increment', val);
  }
}

// === 传入参数管理（数据流入节点）===
function addPassIn() {
  const newParam = {
    id: uid(),
    name: `in${properties.value.passIn?.length || 0}`
  };

  if (!properties.value.passIn) {
    properties.value.passIn = [];
  }
  properties.value.passIn.push(newParam);
  // 与 FunctionBlock 保持一致：isPassIn: true，子图内可通过 GraphInput 访问
  props.value.addInput(newParam.name, 'string', {
    id: newParam.id,
    isPassIn: true
  });
}

function removePassIn(paramId, index) {
  const existingIndex = props.value.inputs.findIndex(i => i.id === paramId);
  if (existingIndex !== -1) {
    props.value.removeInput(existingIndex);
  }
  properties.value.passIn.splice(index, 1);
}

function updatePassInName(param, newName) {
  if (!param) return;
  param.name = newName;
  const slot = props.value.inputs.find(i => i.id === param.id);
  if (slot) {
    slot.name = newName;
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}

// === 传出参数管理（数据流出节点）===
function addPassOut() {
  const newParam = {
    id: uid(),
    name: `out${properties.value.passOut?.length || 0}`
  };

  if (!properties.value.passOut) {
    properties.value.passOut = [];
  }
  properties.value.passOut.push(newParam);
  props.value.addOutput(newParam.name, 'string', { id: newParam.id });
}

function removePassOut(paramId, index) {
  const existingIndex = props.value.outputs.findIndex(o => o.id === paramId);
  if (existingIndex !== -1) {
    props.value.removeOutput(existingIndex);
  }
  properties.value.passOut.splice(index, 1);
}

function updatePassOutName(param, newName) {
  if (!param) return;
  param.name = newName;
  const slot = props.value.outputs.find(o => o.id === param.id);
  if (slot) {
    slot.name = newName;
    props.value.graph?.setDirtyCanvas?.(true, true);
  }
}

// 初始化同步：iterableIsSlot
watch(() => properties.value.iterableIsSlot, (isSlot) => {
  if (properties.value.loopType !== 'for') {
    syncIterableSlot(isSlot);
  }
}, { immediate: true });

// 初始化同步：initValueIsSlot
watch(() => properties.value.initValueIsSlot, (isSlot) => {
  if (properties.value.loopType === 'for') {
    syncInitValueSlot(isSlot);
  }
}, { immediate: true });

// 初始化同步：conditionValueIsSlot
watch(() => properties.value.conditionValueIsSlot, (isSlot) => {
  if (properties.value.loopType === 'for') {
    syncConditionValueSlot(isSlot);
  }
}, { immediate: true });

// 初始化同步：passIn (传入参数)
watch(() => properties.value.passIn, (params) => {
  if (!Array.isArray(params)) return;
  params.forEach(p => {
    const exists = props.value.inputs?.some(i => i.id === p.id);
    if (!exists) {
      // 与 FunctionBlock 保持一致：isPassIn: true，子图内可通过 GraphInput 访问
      props.value.addInput(p.name, 'string', {
        id: p.id,
        isPassIn: true
      });
    }
  });
}, { immediate: true, deep: true });

// 初始化同步：passOut (传出参数)
watch(() => properties.value.passOut, (params) => {
  if (!Array.isArray(params)) return;
  params.forEach(p => {
    const exists = props.value.outputs?.some(o => o.id === p.id);
    if (!exists) {
      props.value.addOutput(p.name, 'string', { id: p.id });
    }
  });
}, { immediate: true, deep: true });

// 初始化同步：loopVarSlot（循环变量槽名称）
watch(() => properties.value.loopVarSlotId, () => {
  syncLoopVarSlotName();
}, { immediate: true });
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <q-card dark flat bordered class="q-mb-xs ">
        <q-card-section class="q-pa-sm">
          <q-btn-toggle :model-value="properties.loopType" @update:model-value="onLoopTypeChange" no-caps unelevated
            toggle-color="primary" color="grey-8" :options="[
              { label: 'For...of', value: 'for...of' },
              { label: 'For...in', value: 'for...in' },
              { label: 'For', value: 'for' }
            ]" class="full-width q-mb-sm" />
          <!-- for...of / for...in UI -->
          <template v-if="properties.loopType === 'for...of' || properties.loopType === 'for...in'">
            <!-- 可迭代对象 -->
            <div class="row items-center q-gutter-x-sm q-mb-xs no-wrap">
              <q-toggle dense dark :model-value="properties.iterableIsSlot" @update:model-value="updateIterableSlot"
                label="Iter" />
              <q-input dense dark outlined class="col" :model-value="properties.iterableValue"
                @update:model-value="val => updateField('iterableValue', val)" :disable="properties.iterableIsSlot"
                :placeholder="properties.loopType === 'for...of' ? 'array / Set / Map' : 'object'">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      要遍历的数据源<br />
                      示例: myArray, users, dataMap
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>

            <!-- 迭代变量 -->
            <div class="row items-center q-gutter-x-sm no-wrap">
              <span class="text-caption text-grey-2" style="width:36px; flex-shrink: 0;">Var</span>
              <q-input dense dark outlined class="col" :model-value="properties.keyVar"
                @update:model-value="updateKeyVar" :placeholder="properties.loopType === 'for...of' ? 'item' : 'key'">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      循环中每一项的变量名<br />
                      示例: item, user, element
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </template>

          <!-- Classic 'for' loop UI -->
          <template v-if="properties.loopType === 'for'">
            <!-- 初始化: let i = 0 -->
            <div class="row items-center q-gutter-x-sm q-mb-xs no-wrap">
              <span class="text-caption text-grey-2" style="width:30px; flex-shrink: 0;">Init</span>
              <q-input dense dark outlined style="width:60px; flex-shrink: 0;" :model-value="properties.initVar"
                @update:model-value="updateInitVar">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      循环变量名<br />
                      示例: i, j, index
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
              <span class="text-body2"> = </span>
              <q-toggle dense dark :model-value="properties.initValueIsSlot"
                @update:model-value="updateInitValueSlot" />
              <q-input dense dark outlined class="col" :model-value="properties.initValue"
                @update:model-value="val => updateField('initValue', val)" :disable="properties.initValueIsSlot">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      循环变量初始值<br />
                      示例: 0, 1, startIndex
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>

            <!-- 条件: i < 10 -->
            <div class="row items-center q-gutter-x-sm q-mb-xs no-wrap">
              <span class="text-caption text-grey-5" style="width:30px; flex-shrink: 0;">Cond</span>
              <span class="text-body2" style="width:60px; text-align:center; flex-shrink: 0;">{{ properties.initVar ||
                'i' }}</span>
              <q-select dense dark outlined style="width:70px; flex-shrink: 0;"
                :model-value="properties.conditionOperator"
                @update:model-value="val => updateField('conditionOperator', val)" :options="comparisonOptions"
                emit-value map-options>
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
              <q-toggle dense dark :model-value="properties.conditionValueIsSlot"
                @update:model-value="updateConditionValueSlot" />
              <q-input dense dark outlined class="col" :model-value="properties.conditionValue"
                @update:model-value="val => updateField('conditionValue', val)"
                :disable="properties.conditionValueIsSlot">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      循环结束条件值<br />
                      示例: 10, arr.length, maxCount
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>

            <!-- 增量: i++ -->
            <div class="row items-center q-gutter-x-sm no-wrap">
              <span class="text-caption text-grey-2" style="width:32px; flex-shrink: 0;">Step</span>
              <q-select dense dark outlined class="col"
                :model-value="isCustomIncrement ? 'custom' : properties.increment"
                @update:model-value="onIncrementSelect" :options="incrementOptions" emit-value map-options>
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
              <q-input v-if="isCustomIncrement" dense dark outlined class="col" :model-value="properties.increment"
                @update:model-value="val => updateField('increment', val)">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      自定义增量表达式<br />
                      示例: i += step, i = i * 2
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </template>
        </q-card-section>
      </q-card>

      <!-- 传入列表（数据流入节点）-->
      <q-card dark flat bordered class="q-mb-xs ">
        <q-card-section class="q-pa-sm">
          <div class="text-caption q-mb-xs">传入</div>
          <div v-for="(p, index) in (properties.passIn || [])" :key="p.id" class="q-mt-xs" style="position: relative;">
            <div style="padding-right: 40px;">
              <q-input dense dark outlined :model-value="p.name" @update:model-value="val => updatePassInName(p, val)"
                placeholder="变量名">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      传入子图的变量名<br />
                      子图内可通过 GraphInput 访问
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <q-btn flat dense icon="close" color="negative" @click="removePassIn(p.id, index)"
              style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%);" />
          </div>
          <q-btn dense flat no-caps label="+ 添加传入" @click="addPassIn" class="q-mt-sm full-width" color="primary" />
        </q-card-section>
      </q-card>

      <!-- 传出列表（数据流出节点）-->
      <q-card dark flat bordered class="q-mb-xs ">
        <q-card-section class="q-pa-sm">
          <div class="text-caption q-mb-xs">传出</div>
          <div v-for="(p, index) in (properties.passOut || [])" :key="p.id" class="q-mt-xs" style="position: relative;">
            <div style="padding-right: 40px;">
              <q-input dense dark outlined :model-value="p.name" @update:model-value="val => updatePassOutName(p, val)"
                placeholder="变量名">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      从子图传出的变量名<br />
                      子图内通过 GraphOutput 输出
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <q-btn flat dense icon="close" color="negative" @click="removePassOut(p.id, index)"
              style="position: absolute; right: 4px; top: 50%; transform: translateY(-50%);" />
          </div>
          <q-btn dense flat no-caps label="+ 添加传出" @click="addPassOut" class="q-mt-sm full-width" color="primary" />
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
