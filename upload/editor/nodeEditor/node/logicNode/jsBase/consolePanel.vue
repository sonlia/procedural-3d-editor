<script setup>
import { computed, watch } from 'vue';
import { set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();

const consoleMethodOptions = [
  { label: 'log', value: 'log', description: '输出普通日志信息' },
  { label: 'warn', value: 'warn', description: '输出警告信息（黄色）' },
  { label: 'error', value: 'error', description: '输出错误信息（红色）' },
  { label: 'info', value: 'info', description: '输出提示信息' },
  { label: 'debug', value: 'debug', description: '输出调试信息' },
  { label: 'table', value: 'table', description: '以表格形式输出数据' },
];

const properties = computed(() => props.value?.properties || {});

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

// 监听 useSlot 变化，动态管理插槽
watch(() => properties.value.useSlot, (useSlot) => {
  if (!props.value) return;

  const node = props.value;
  const slotId = properties.value.id;
  const existingSlot = node.inputs.find(s => s.id === slotId);

  if (useSlot && !existingSlot) {
    node.addInput('value', 'string', { id: slotId });
  } else if (!useSlot && existingSlot) {
    const index = node.inputs.indexOf(existingSlot);
    node.removeInput(index);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}, { immediate: true });
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <q-card dark flat bordered class="q-mb-xs">
        <q-card-section class="q-pa-sm">
          <q-select dense dark outlined :model-value="properties.consoleMethod"
            @update:model-value="val => updateField('consoleMethod', val)" :options="consoleMethodOptions" emit-value
            map-options label="方法" class="q-mb-xs">
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>

          <q-separator dark class="q-my-xs" />

          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark :model-value="properties.useSlot"
              @update:model-value="val => updateField('useSlot', val)" label="Value"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :model-value="properties.consoleValue"
              @update:model-value="val => updateField('consoleValue', val)" :disable="properties.useSlot"
              placeholder="直接输入值">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    输出到控制台的内容<br />
                    示例: "Hello World", myVariable, obj.property
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>

<style scoped></style>
