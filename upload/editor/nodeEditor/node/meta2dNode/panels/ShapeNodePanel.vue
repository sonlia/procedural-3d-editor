<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">图形节点</div>

    <!-- 图形类型下拉 -->
    <div class="form-row">
      <span class="form-label">图形类型</span>
      <q-select
        v-model="model.properties.shapeType"
        dark
        dense
        outlined
        :options="groupedOptions"
        emit-value
        map-options
        class="col"
        @update:model-value="onShapeTypeChange"
      />
    </div>

    <!-- 宽度 -->
    <div class="form-row">
      <span class="form-label">宽度</span>
      <q-input
        v-model.number="model.properties.width"
        dark
        dense
        outlined
        type="number"
        :min="10"
        class="col"
      />
    </div>

    <!-- 高度 -->
    <div class="form-row">
      <span class="form-label">高度</span>
      <q-input
        v-model.number="model.properties.height"
        dark
        dense
        outlined
        type="number"
        :min="10"
        class="col"
      />
    </div>

    <!-- 文字 -->
    <div class="form-row">
      <span class="form-label">文字</span>
      <q-input
        v-model="model.properties.text"
        dark
        dense
        outlined
        placeholder="显示文字"
        class="col"
      />
    </div>

    <!-- 颜色 -->
    <div class="form-row">
      <span class="form-label">颜色</span>
      <q-input
        v-model="model.properties.color"
        dark
        dense
        outlined
        class="col"
      >
        <template #append>
          <q-icon name="colorize" class="cursor-pointer">
            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
              <q-color v-model="model.properties.color" dark />
            </q-popup-proxy>
          </q-icon>
        </template>
      </q-input>
    </div>

    <!-- 背景色 -->
    <div class="form-row">
      <span class="form-label">背景色</span>
      <q-input
        v-model="model.properties.background"
        dark
        dense
        outlined
        class="col"
      >
        <template #append>
          <q-icon name="colorize" class="cursor-pointer">
            <q-popup-proxy cover transition-show="scale" transition-hide="scale">
              <q-color v-model="model.properties.background" dark />
            </q-popup-proxy>
          </q-icon>
        </template>
      </q-input>
    </div>
  </div>
</template>

<script setup>
import { useVModel } from "@vueuse/core";
import { computed } from "vue";
import { shapeTypes } from "../../../../meta2dEditor/data/nodeDefinitions.js";

const props = defineProps({
  modelValue: { type: Object, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const model = useVModel(props, "modelValue", emit, { deep: true });

// 按 category 分组的选项
const groupedOptions = computed(() => {
  const categories = [...new Set(shapeTypes.map((s) => s.category))];
  const result = [];
  for (const cat of categories) {
    result.push({
      label: cat,
      disable: true,
    });
    const items = shapeTypes.filter((s) => s.category === cat);
    for (const item of items) {
      result.push({
        label: "  " + item.label,
        value: item.value,
      });
    }
  }
  return result;
});

/** 选择图形类型时，同步 penData 的默认尺寸和文字 */
function onShapeTypeChange(val) {
  const shape = shapeTypes.find((s) => s.value === val);
  if (shape?.penData) {
    model.value.properties.width = shape.penData.width ?? 100;
    model.value.properties.height = shape.penData.height ?? 100;
    model.value.properties.text = shape.penData.text ?? "";
  }
}
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
