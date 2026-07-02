<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">调用全局函数</div>

    <div class="form-row">
      <span class="form-label">函数名</span>
      <q-input
        v-model="model.properties.fnName"
        dark
        dense
        outlined
        placeholder="myFunction"
        class="col"
      />
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
