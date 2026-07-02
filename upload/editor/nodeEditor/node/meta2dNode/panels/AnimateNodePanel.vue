<template>
  <div class="q-pa-sm">
    <div class="text-grey-5 text-caption q-mb-sm">动效节点</div>

    <!-- 动效类型 -->
    <div class="form-row">
      <span class="form-label">动效类型</span>
      <q-select
        v-model="model.properties.animateType"
        dark
        dense
        outlined
        :options="animateOpts"
        emit-value
        map-options
        class="col"
        @update:model-value="onAnimateTypeChange"
      />
    </div>

    <!-- 时长 -->
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

    <!-- 循环次数 -->
    <div class="form-row">
      <span class="form-label">循环次数</span>
      <q-input
        v-model.number="model.properties.loopCount"
        dark
        dense
        outlined
        type="number"
        placeholder="0=无限"
        :min="0"
        class="col"
      />
    </div>

    <!-- 自动播放 -->
    <div class="form-row">
      <span class="form-label">自动播放</span>
      <q-toggle
        v-model="model.properties.autoPlay"
        dark
        dense
        class="col"
      />
    </div>

    <q-separator dark class="q-my-sm" />

    <!-- 动画帧编辑区 -->
    <q-expansion-item
      dense
      dark
      label="动画帧"
      icon="animation"
      header-class="text-grey-5"
      default-opened
    >
      <div class="q-pa-xs">
        <div class="row items-center q-mb-sm">
          <span class="text-grey-6 text-caption col">帧数: {{ frames.length }}</span>
          <q-btn dark dense flat icon="add" size="sm" @click="addFrame">
            <q-tooltip>添加帧</q-tooltip>
          </q-btn>
        </div>

        <q-list dark dense separator>
          <q-item v-for="(frame, idx) in frames" :key="idx" dense class="q-pa-xs">
            <q-item-section>
              <div class="row items-center q-gutter-xs">
                <!-- 帧时长 -->
                <q-input
                  v-model.number="frame.duration"
                  dark
                  dense
                  outlined
                  type="number"
                  label="时长(ms)"
                  :min="10"
                  style="width: 90px"
                  @update:model-value="syncFrames"
                />

                <!-- Y 偏移 (bounce, moveY) -->
                <q-input
                  v-if="currentType === 'bounce' || currentType === 'moveY'"
                  v-model.number="frame.y"
                  dark
                  dense
                  outlined
                  type="number"
                  label="Y偏移"
                  style="width: 70px"
                  @update:model-value="syncFrames"
                />

                <!-- X 偏移 (moveX) -->
                <q-input
                  v-if="currentType === 'moveX'"
                  v-model.number="frame.x"
                  dark
                  dense
                  outlined
                  type="number"
                  label="X偏移"
                  style="width: 70px"
                  @update:model-value="syncFrames"
                />

                <!-- 旋转角度 (rotate) -->
                <q-input
                  v-if="currentType === 'rotate'"
                  v-model.number="frame.rotate"
                  dark
                  dense
                  outlined
                  type="number"
                  label="旋转度"
                  style="width: 70px"
                  @update:model-value="syncFrames"
                />

                <!-- 缩放 (tip) -->
                <q-input
                  v-if="currentType === 'tip'"
                  v-model.number="frame.scale"
                  dark
                  dense
                  outlined
                  type="number"
                  label="缩放"
                  :step="0.1"
                  style="width: 70px"
                  @update:model-value="syncFrames"
                />

                <!-- 透明度 (fadeIn, fadeOut, flash) -->
                <q-input
                  v-if="['fadeIn', 'fadeOut', 'flash'].includes(currentType)"
                  v-model.number="frame.globalAlpha"
                  dark
                  dense
                  outlined
                  type="number"
                  label="透明度"
                  :min="0"
                  :max="1"
                  :step="0.1"
                  style="width: 80px"
                  @update:model-value="syncFrames"
                />

                <!-- 自定义模式：显示全部属性 -->
                <template v-if="currentType === 'custom'">
                  <q-input
                    v-model.number="frame.x"
                    dark
                    dense
                    outlined
                    type="number"
                    label="X"
                    style="width: 60px"
                    @update:model-value="syncFrames"
                  />
                  <q-input
                    v-model.number="frame.y"
                    dark
                    dense
                    outlined
                    type="number"
                    label="Y"
                    style="width: 60px"
                    @update:model-value="syncFrames"
                  />
                  <q-input
                    v-model.number="frame.rotate"
                    dark
                    dense
                    outlined
                    type="number"
                    label="旋转"
                    style="width: 60px"
                    @update:model-value="syncFrames"
                  />
                  <q-input
                    v-model.number="frame.scale"
                    dark
                    dense
                    outlined
                    type="number"
                    label="缩放"
                    :step="0.1"
                    style="width: 60px"
                    @update:model-value="syncFrames"
                  />
                  <q-input
                    v-model.number="frame.globalAlpha"
                    dark
                    dense
                    outlined
                    type="number"
                    label="透明"
                    :min="0"
                    :max="1"
                    :step="0.1"
                    style="width: 60px"
                    @update:model-value="syncFrames"
                  />
                </template>
              </div>
            </q-item-section>
            <q-item-section side>
              <q-btn dark dense flat icon="delete" size="sm" color="negative" @click="removeFrame(idx)">
                <q-tooltip>删除帧</q-tooltip>
              </q-btn>
            </q-item-section>
          </q-item>
        </q-list>

        <div v-if="frames.length === 0" class="text-grey-6 text-caption text-center q-pa-sm">
          暂无动画帧，点击 + 添加
        </div>
      </div>
    </q-expansion-item>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useVModel } from "@vueuse/core";
import {
  animateTypeOptions,
  presetFrames,
} from "../../../../meta2dEditor/data/nodeDefinitions.js";

const props = defineProps({
  modelValue: { type: Object, required: true },
});

const emit = defineEmits(["update:modelValue"]);

const model = useVModel(props, "modelValue", emit, { deep: true });

const animateOpts = animateTypeOptions;

// 当前动效类型
const currentType = computed(() => model.value.properties.animateType);

// 解析帧数据为本地可编辑数组
const frames = ref([]);

// 从 node.properties.frames (JSON string) 初始化
function loadFrames() {
  try {
    frames.value = JSON.parse(model.value.properties.frames);
  } catch {
    frames.value = [];
  }
}

// 帧变更同步回 node.properties.frames
function syncFrames() {
  model.value.properties.frames = JSON.stringify(frames.value);
}

/** 动效类型切换时加载预设帧 */
function onAnimateTypeChange(type) {
  if (type && presetFrames[type]) {
    frames.value = JSON.parse(JSON.stringify(presetFrames[type]));
    syncFrames();
  }
}

function addFrame() {
  const newFrame = { duration: 300 };
  switch (currentType.value) {
    case "bounce":
    case "moveY":
      newFrame.y = 0;
      break;
    case "moveX":
      newFrame.x = 0;
      break;
    case "rotate":
      newFrame.rotate = 0;
      break;
    case "tip":
      newFrame.scale = 1;
      break;
    case "fadeIn":
    case "fadeOut":
    case "flash":
      newFrame.globalAlpha = 1;
      break;
  }
  frames.value.push(newFrame);
  syncFrames();
}

function removeFrame(idx) {
  frames.value.splice(idx, 1);
  syncFrames();
}

// 初始化加载
watch(
  () => model.value.properties.frames,
  () => loadFrames(),
  { immediate: true }
);
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
