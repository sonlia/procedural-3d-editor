<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">自定义关键帧</div>

    <q-input
      v-model="model.properties.frames"
      dark
      dense
      outlined
      type="textarea"
      rows="8"
      placeholder='[{ "duration": 300, "y": 10 }]'
    />

    <div class="text-grey-6 text-caption q-mt-xs">
      支持属性: duration, x, y, rotate, scale, opacity 等
    </div>

    <q-separator dark class="q-my-sm" />

    <!-- 快速预设 -->
    <div class="text-grey-5 text-caption q-mb-xs">快速预设</div>
    <div class="row q-gutter-xs">
      <q-btn dark dense flat label="跳动" @click="applyPreset('bounce')" />
      <q-btn dark dense flat label="旋转" @click="applyPreset('rotate')" />
      <q-btn dark dense flat label="提示" @click="applyPreset('tip')" />
      <q-btn dark dense flat label="闪烁" @click="applyPreset('flash')" />
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

const presets = {
  bounce: [{ duration: 300, y: 10 }],
  rotate: [{ duration: 1000, rotate: 360 }],
  tip: [{ duration: 300, scale: 1.3 }],
  flash: [{ duration: 500, globalAlpha: 0 }, { duration: 500, globalAlpha: 1 }],
};

function applyPreset(name) {
  model.value.properties.frames = JSON.stringify(presets[name], null, 2);
}
</script>
