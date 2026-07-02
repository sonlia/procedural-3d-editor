<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 循环渲染每个响应式项 -->
      <q-card v-for="(item, index) in reactivityItems" :key="item.id" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- 标题栏 -->
          <div class="row items-center justify-between q-mb-sm">
            <q-badge color="primary" class="q-ml-xs q-mt-xs">{{ index + 1 }}</q-badge>
            <q-btn v-if="reactivityItems.length > 1" icon="close" flat dense color="negative"
              @click="removeReactivityItem(index, item)">
              <q-tooltip>删除此项</q-tooltip>
            </q-btn>
          </div>

          <!-- Expose checkbox (仅在 PiniaStore 子图内显示) -->
          <q-checkbox
            v-if="isInPiniaStore"
            dense
            dark
            :model-value="item.expose"
            @update:model-value="val => updateField(item, 'expose', val)"
            label="导出到 store"
            class="q-mb-xs"
          >
            <q-tooltip class="bg-dark" max-width="250px">
              勾选后该响应式变量会被包含在 store 的 return 中，供外部使用
            </q-tooltip>
          </q-checkbox>

          <!-- Export checkbox -->
          <q-checkbox v-model="item.exported" :disable="item.varName?.isSlot" label="Export" dense dark
            class="q-mb-xs" @update:model-value="val => updateField(item, 'exported', val)" />

          <!-- 变量名行 -->
          <div class="row items-center q-gutter-x-sm no-wrap q-mb-xs">
            <q-toggle :model-value="item.varName?.isSlot" dense dark label="VarName"
              style="min-width: 90px; flex-shrink: 0;"
              @update:model-value="val => updateField(item, 'varName.isSlot', val)" />
            <q-select :model-value="item.declareType" :disable="item.varName?.isSlot" :options="['const', 'let']"
              dense dark outlined class="col-auto" style="min-width: 70px;"
              @update:model-value="val => updateField(item, 'declareType', val)" />
            <q-input :model-value="item.varName?.value" :disable="item.varName?.isSlot" dense dark outlined class="col"
              @update:model-value="val => updateField(item, 'varName.value', val)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    响应式变量的名称<br />
                    示例: count, user, items
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>

          <!-- 值输入行 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle :model-value="item.initialValue?.isSlot" dense dark label="Value"
              style="min-width: 90px; flex-shrink: 0;"
              @update:model-value="val => updateField(item, 'initialValue.isSlot', val)" />
            <q-select :model-value="item.reactivityApi" :options="apiOptions" dense dark outlined options-dense
              emit-value map-options @update:model-value="val => updateField(item, 'reactivityApi', val)">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input :model-value="item.initialValue?.value" :disable="item.initialValue?.isSlot" dense dark outlined
              class="col" placeholder="Initial Value"
              @update:model-value="val => updateField(item, 'initialValue.value', val)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    变量的初始值<br />
                    示例: 0, '', [], {}
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 添加按钮 -->
      <q-btn dense flat no-caps label="Add" class="q-mt-xs full-width" color="primary"
        @click="addReactivityItem" />
    </div>
  </BasePropertyPanel>
</template>

<script setup>
import { computed, watch } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();

const properties = computed(() => props.value?.properties || {});
const reactivityItems = computed(() => properties.value.reactivityItems || []);

// 检查是否在 PiniaStore 子图内
const isInPiniaStore = computed(() => {
  const parentNode = props.value?.graph?.parent;
  return parentNode?.constructor?.name === 'PiniaStore';
});

// 初始化 expose 默认值
reactivityItems.value.forEach(item => {
  if (item.expose === undefined) {
    item.expose = true;
  }
});

const apiOptions = [
  { value: 'ref', label: 'ref', description: '创建深度响应式的可变 ref 对象。' },
  { value: 'shallowRef', label: 'shallowRef', description: '创建一个非深度的 ref,仅 .value 的赋值是响应式的。' },
  { value: 'reactive', label: 'reactive', description: '返回一个对象的深度响应式代理。' },
  { value: 'readonly', label: 'readonly', description: '接收一个对象或 ref,返回其深度只读代理。' },
  { value: 'shallowReactive', label: 'shallowReactive', description: '创建一个浅层响应式代理,非深度。' },
  { value: 'shallowReadonly', label: 'shallowReadonly', description: '创建一个浅层只读代理,非深度。' },
];

function addReactivityItem() {
  if (!props.value) return;

  const newItem = props.value.createReactivityItem();
  reactivityItems.value.push(newItem);

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function removeReactivityItem(index, item) {
  if (!props.value || reactivityItems.value.length <= 1) return;

  const node = props.value;

  // 移除相关的输入插槽
  const varNameSlot = node.inputs.find(s => s.id === item.varName?.id);
  if (varNameSlot) {
    const slotIndex = node.inputs.indexOf(varNameSlot);
    node.removeInput(slotIndex);
  }

  const valueSlot = node.inputs.find(s => s.id === item.initialValue?.id);
  if (valueSlot) {
    const slotIndex = node.inputs.indexOf(valueSlot);
    node.removeInput(slotIndex);
  }

  reactivityItems.value.splice(index, 1);

  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

function updateField(item, key, value) {
  set(item, key, value);

  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 监听 varName.isSlot 变化
watch(
  () => reactivityItems.value.map(item => ({ id: item.id, isSlot: item.varName?.isSlot, slotId: item.varName?.id })),
  (newVals) => {
    if (!props.value) return;
    const node = props.value;

    newVals.forEach((val, idx) => {
      const item = reactivityItems.value[idx];
      if (!item?.varName) return;

      const existingIdx = node.inputs.findIndex(s => s.id === item.varName.id);
      if (val.isSlot && existingIdx === -1) {
        node.addInput(`VarName${idx > 0 ? idx : ''}`, "string", { id: item.varName.id });
      } else if (!val.isSlot && existingIdx !== -1) {
        node.removeInput(existingIdx);
      }
    });

    node.onExecute?.();
    node.graph?.setDirtyCanvas?.(true, true);
  },
  { deep: true, immediate: true }
);

// 监听 initialValue.isSlot 变化
watch(
  () => reactivityItems.value.map(item => ({ id: item.id, isSlot: item.initialValue?.isSlot, slotId: item.initialValue?.id })),
  (newVals) => {
    if (!props.value) return;
    const node = props.value;

    newVals.forEach((val, idx) => {
      const item = reactivityItems.value[idx];
      if (!item?.initialValue) return;

      const existingIdx = node.inputs.findIndex(s => s.id === item.initialValue.id);
      if (val.isSlot && existingIdx === -1) {
        node.addInput(`value${idx > 0 ? idx : ''}`, "string", { id: item.initialValue.id });
      } else if (!val.isSlot && existingIdx !== -1) {
        node.removeInput(existingIdx);
      }
    });

    node.onExecute?.();
    node.graph?.setDirtyCanvas?.(true, true);
  },
  { deep: true, immediate: true }
);

// 监听其他属性变化
watch(
  () => reactivityItems.value.map(item => ({
    id: item.id,
    exported: item.exported,
    expose: item.expose,
    declareType: item.declareType,
    reactivityApi: item.reactivityApi,
    varNameValue: item.varName?.value,
    initialValueValue: item.initialValue?.value,
  })),
  () => {
    props.value.onExecute?.();
    props.value.graph?.setDirtyCanvas?.(true, true);
  },
  { deep: true }
);
</script>
