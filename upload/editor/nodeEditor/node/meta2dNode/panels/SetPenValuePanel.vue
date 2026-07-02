<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">设置属性</div>

    <div class="form-row">
      <span class="form-label">目标ID</span>
      <q-input
        v-model="model.properties.targetId"
        dark
        dense
        outlined
        placeholder="图元ID或tag，空=当前"
        class="col"
      />
    </div>

    <div class="form-row">
      <span class="form-label">属性JSON</span>
      <q-input
        v-model="model.properties.propsJson"
        dark
        dense
        outlined
        type="textarea"
        rows="4"
        placeholder='{"color": "#ff0000"}'
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
