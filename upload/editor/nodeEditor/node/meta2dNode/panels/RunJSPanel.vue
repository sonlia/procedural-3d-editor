<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">执行 JS 代码</div>

    <q-input
      v-model="model.properties.code"
      dark
      dense
      outlined
      type="textarea"
      rows="8"
      class="code-input"
    />
    <div class="text-grey-6 text-caption q-mt-xs">
      可用变量: pen, params, context
    </div>
  </div>
</template>

<script setup>
import { useVModel } from "@vueuse/core";

const props = defineProps({
  modelValue: { type: Object, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const model = useVModel(props, "modelValue", emit, { deep: true });
</script>

<style scoped>
.code-input :deep(textarea) {
  font-family: "Cascadia Code", "Fira Code", monospace;
  font-size: 12px;
}
</style>
