<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">发送消息</div>

    <div class="form-row">
      <span class="form-label">消息名</span>
      <q-input
        v-model="model.properties.message"
        dark
        dense
        outlined
        placeholder="messageName"
        class="col"
      />
    </div>

    <div class="form-row">
      <span class="form-label">数据</span>
      <q-input
        v-model="model.properties.data"
        dark
        dense
        outlined
        type="textarea"
        rows="3"
        placeholder="{}"
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
