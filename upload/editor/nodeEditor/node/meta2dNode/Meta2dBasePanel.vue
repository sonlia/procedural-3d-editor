<template>
  <div class="meta2d-base-panel q-pa-sm">
    <q-scroll-area class="fit">
      <!-- 图元信息 -->
      <div class="text-grey-5 text-caption q-mb-sm">图元信息</div>
      <div class="row q-gutter-sm q-mb-md">
        <q-input
          v-model="model.properties.penId"
          label="图元 ID"
          dark
          dense
          readonly
          class="col"
        />
        <q-input
          v-model="model.properties.penType"
          label="类型"
          dark
          dense
          readonly
          class="col-4"
        />
      </div>

      <q-input
        v-model="model.properties.penName"
        label="名称"
        dark
        dense
        class="q-mb-md"
      />

      <!-- 样式配置 -->
      <div class="text-grey-5 text-caption q-mb-sm">样式配置</div>

      <div class="row q-gutter-sm q-mb-sm">
        <q-input
          v-if="hasProperty('color')"
          v-model="model.properties.color"
          label="边框颜色"
          dark
          dense
          class="col"
        >
          <template v-slot:append>
            <q-icon name="colorize" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-color v-model="model.properties.color" dark />
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>

        <q-input
          v-if="hasProperty('background')"
          v-model="model.properties.background"
          label="背景颜色"
          dark
          dense
          class="col"
        >
          <template v-slot:append>
            <q-icon name="colorize" class="cursor-pointer">
              <q-popup-proxy cover transition-show="scale" transition-hide="scale">
                <q-color v-model="model.properties.background" dark />
              </q-popup-proxy>
            </q-icon>
          </template>
        </q-input>
      </div>

      <q-input
        v-if="hasProperty('lineWidth')"
        v-model.number="model.properties.lineWidth"
        label="边框宽度"
        type="number"
        dark
        dense
        class="q-mb-sm"
      />

      <!-- 尺寸配置（矩形、图片等） -->
      <template v-if="hasProperty('width') || hasProperty('height')">
        <div class="text-grey-5 text-caption q-mb-sm q-mt-md">尺寸配置</div>
        <div class="row q-gutter-sm q-mb-sm">
          <q-input
            v-if="hasProperty('width')"
            v-model.number="model.properties.width"
            label="宽度"
            type="number"
            dark
            dense
            class="col"
          />
          <q-input
            v-if="hasProperty('height')"
            v-model.number="model.properties.height"
            label="高度"
            type="number"
            dark
            dense
            class="col"
          />
        </div>
      </template>

      <!-- 文本配置 -->
      <template v-if="hasProperty('text')">
        <div class="text-grey-5 text-caption q-mb-sm q-mt-md">文本配置</div>
        <q-input
          v-model="model.properties.text"
          label="文本内容"
          dark
          dense
          class="q-mb-sm"
        />
        <div class="row q-gutter-sm q-mb-sm">
          <q-input
            v-if="hasProperty('fontSize')"
            v-model.number="model.properties.fontSize"
            label="字体大小"
            type="number"
            dark
            dense
            class="col"
          />
          <q-select
            v-if="hasProperty('fontWeight')"
            v-model="model.properties.fontWeight"
            label="字重"
            :options="['normal', 'bold', 'lighter']"
            dark
            dense
            class="col"
          />
        </div>
      </template>

      <!-- 图片配置 -->
      <template v-if="hasProperty('image')">
        <div class="text-grey-5 text-caption q-mb-sm q-mt-md">图片配置</div>
        <q-input
          v-model="model.properties.image"
          label="图片 URL"
          dark
          dense
          class="q-mb-sm"
        />
      </template>

      <!-- 事件配置 -->
      <div class="text-grey-5 text-caption q-mb-sm q-mt-md">事件配置</div>
      <div class="column q-gutter-xs">
        <q-toggle
          v-if="hasProperty('onClick')"
          v-model="model.properties.onClick"
          label="点击事件"
          dark
          dense
        />
        <q-toggle
          v-if="hasProperty('onDblClick')"
          v-model="model.properties.onDblClick"
          label="双击事件"
          dark
          dense
        />
        <q-toggle
          v-if="hasProperty('onMouseEnter')"
          v-model="model.properties.onMouseEnter"
          label="鼠标进入事件"
          dark
          dense
        />
        <q-toggle
          v-if="hasProperty('onMouseLeave')"
          v-model="model.properties.onMouseLeave"
          label="鼠标离开事件"
          dark
          dense
        />
      </div>

      <!-- 备注 -->
      <div class="text-grey-5 text-caption q-mb-sm q-mt-md">备注</div>
      <q-input
        v-model="model.properties.remark"
        label="备注"
        type="textarea"
        dark
        dense
        autogrow
      />
    </q-scroll-area>
  </div>
</template>

<script setup>
import { useVModel } from "@vueuse/core";

const props = defineProps({
  modelValue: {
    type: Object,
    required: true,
  },
});

const emit = defineEmits(["update:modelValue"]);

const model = useVModel(props, "modelValue", emit, { deep: true });

/**
 * 检查属性是否存在
 */
function hasProperty(propName) {
  return model.value?.properties?.hasOwnProperty(propName);
}
</script>

<style scoped>
.meta2d-base-panel {
  background-color: #1e1e1e;
  height: 100%;
}
</style>
