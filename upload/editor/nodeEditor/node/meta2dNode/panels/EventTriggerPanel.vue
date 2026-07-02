<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">事件触发器</div>

    <div class="form-row">
      <span class="form-label">事件类型</span>
      <q-select
        v-model="model.properties.eventType"
        dark
        dense
        outlined
        :options="typeOptions"
        emit-value
        map-options
        class="col"
      />
    </div>

    <div class="form-row">
      <span class="form-label">图元ID</span>
      <q-input
        v-model="model.properties.penId"
        dark
        dense
        outlined
        placeholder="空=当前选中"
        class="col"
      />
    </div>
  </div>
</template>

<script setup>
import { useVModel } from "@vueuse/core";
import { META2D_EVENT_TYPES } from "../meta2dEventNodes.js";

const props = defineProps({
  modelValue: { type: Object, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const model = useVModel(props, "modelValue", emit, { deep: true });

const typeOptions = Object.entries(META2D_EVENT_TYPES).map(([, v]) => ({
  label: v.label,
  value: v.value,
}));
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
