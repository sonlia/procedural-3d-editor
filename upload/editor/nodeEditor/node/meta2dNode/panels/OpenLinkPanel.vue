<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">打开链接</div>

    <div class="form-row">
      <span class="form-label">URL</span>
      <q-input
        v-model="model.properties.url"
        dark
        dense
        outlined
        placeholder="https://..."
        class="col"
      />
    </div>

    <div class="form-row">
      <span class="form-label">打开方式</span>
      <q-select
        v-model="model.properties.target"
        dark
        dense
        outlined
        :options="targetOptions"
        emit-value
        map-options
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

const targetOptions = [
  { label: "新窗口", value: "_blank" },
  { label: "当前页面", value: "_self" },
];
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
