<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">动画配置</div>

    <div class="form-row">
      <span class="form-label">动画类型</span>
      <q-select
        v-model="model.properties.animateType"
        dark
        dense
        outlined
        :options="animateTypeOptions"
        emit-value
        map-options
        class="col"
      />
    </div>

    <div class="form-row">
      <span class="form-label">时长(ms)</span>
      <q-input
        v-model.number="model.properties.duration"
        dark
        dense
        outlined
        type="number"
        :min="100"
        class="col"
      />
    </div>

    <div class="form-row">
      <span class="form-label">循环次数</span>
      <q-input
        v-model.number="model.properties.animateCycle"
        dark
        dense
        outlined
        type="number"
        placeholder="0=无限"
        :min="0"
        class="col"
      />
    </div>

    <div class="form-row">
      <span class="form-label">自动播放</span>
      <q-toggle
        v-model="model.properties.autoPlay"
        dark
        dense
        class="col"
      />
    </div>

    <template v-if="model.properties.animateType === 'custom'">
      <q-separator dark class="q-my-sm" />
      <div class="text-grey-6 text-caption q-mb-xs">自定义关键帧 (JSON)</div>
      <q-input
        v-model="model.properties.customFrames"
        dark
        dense
        outlined
        type="textarea"
        rows="4"
        placeholder='[{ "duration": 300, "y": 10 }]'
      />
    </template>
  </div>
</template>

<script setup>
import { useVModel } from "@vueuse/core";

const props = defineProps({
  modelValue: { type: Object, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const model = useVModel(props, "modelValue", emit, { deep: true });

const animateTypeOptions = [
  { label: "跳动", value: "bounce" },
  { label: "旋转", value: "rotate" },
  { label: "闪烁", value: "flash" },
  { label: "提示", value: "tip" },
  { label: "水平移动", value: "moveX" },
  { label: "垂直移动", value: "moveY" },
  { label: "渐隐", value: "fadeOut" },
  { label: "渐显", value: "fadeIn" },
  { label: "自定义", value: "custom" },
];
</script>

<style scoped>
.form-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}
.form-label {
  width: 70px;
  flex-shrink: 0;
  font-size: 12px;
  color: #999;
}
</style>
