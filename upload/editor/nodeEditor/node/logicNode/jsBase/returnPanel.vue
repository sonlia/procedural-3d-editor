<script setup>
import { computed, watch } from 'vue';
import { set } from 'lodash-es';
import BasePropertyPanel from 'src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue';

const props = defineModel();

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
}, { immediate: true });
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <q-card dark flat bordered class="q-mb-xs">
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark :model-value="properties.useSlot"
              @update:model-value="val => updateField('useSlot', val)" label="ReturnValue"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :model-value="properties.returnValue"
              @update:model-value="val => updateField('returnValue', val)" label="返回值" :disable="properties.useSlot"
              placeholder="输入字面量">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    函数返回值<br />
                    示例: result, data, null
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
