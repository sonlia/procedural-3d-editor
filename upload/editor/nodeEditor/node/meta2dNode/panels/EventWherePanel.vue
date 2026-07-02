<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">触发条件</div>

    <div class="form-row">
      <span class="form-label">条件类型</span>
      <q-input
        v-model="model.properties.type"
        dark
        dense
        outlined
        placeholder="custom"
        class="col"
      />
    </div>

    <div class="text-grey-6 text-caption q-mb-xs">JS 条件表达式 (返回 true/false)</div>
    <q-input
      v-model="model.properties.fnJs"
      dark
      dense
      outlined
      type="textarea"
      rows="5"
      placeholder='return pen.id === "xxx"'
    />
    <div class="text-grey-6 text-caption q-mt-xs">
      可用变量: pen, context
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
.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.form-label {
  width: 60px;
  flex-shrink: 0;
  font-size: 12px;
  color: #999;
}
</style>
