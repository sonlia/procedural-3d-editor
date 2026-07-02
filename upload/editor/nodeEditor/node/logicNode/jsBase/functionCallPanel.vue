<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateExpressionSlot(isSlot) {
  properties.value.expression.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex(
    (s) => s.id === properties.value.expression.id,
  );

  if (isSlot && existingIdx === -1) {
    props.value.addInput("expression", "string", {
      id: properties.value.expression.id,
    });
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
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <!-- 表达式输入 -->
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle
              dense
              dark
              label="Expression"
              :model-value="properties.expression?.isSlot"
              @update:model-value="(val) => updateExpressionSlot(val)"
              style="min-width: 90px; flex-shrink: 0"
            />
            <q-input
              dense
              dark
              outlined
              class="col"
              :model-value="properties.expression?.value"
              :disable="properties.expression?.isSlot"
              @update:model-value="(val) => updateField('expression.value', val)"
              placeholder="a() 或 await b()"
            >
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    函数调用表达式<br />
                    示例: myFunc(), await fetchData(), obj.method()
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
