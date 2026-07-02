<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateParamSlot(param, slotName, isSlot) {
  if (!param) return;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput(slotName, "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 说明 -->
      <div class="text-caption text-grey">页面水印生成</div>

      <!-- 卡片 1：内容配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">水印内容 (content)</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="content"
              :model-value="properties.content?.isSlot"
              @update:model-value="v => updateParamSlot(properties.content, 'content', v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :disable="properties.content?.isSlot"
              :model-value="properties.content?.value"
              @update:model-value="v => updateField('content.value', v)"
              placeholder="Watermark">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    水印显示的文字内容<br />
                    示例: 机密文档, 内部使用
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：容器 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">容器元素 (container)</div>
          <div class="text-caption text-blue-4">
            <q-icon name="info"  class="q-mr-xs" />
            连接一个 DOM 元素引用，默认为 document.body
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 3：样式配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">样式配置</div>
          <div class="column q-gutter-y-xs">
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="fontSize"
                :model-value="properties.fontSize?.isSlot"
                @update:model-value="v => updateParamSlot(properties.fontSize, 'fontSize', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.fontSize?.isSlot"
                :model-value="properties.fontSize?.value"
                @update:model-value="v => updateField('fontSize.value', v)"
                placeholder="16">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      字体大小（像素）<br />
                      示例: 14, 16, 20
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="fontColor"
                :model-value="properties.fontColor?.isSlot"
                @update:model-value="v => updateParamSlot(properties.fontColor, 'fontColor', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.fontColor?.isSlot"
                :model-value="properties.fontColor?.value"
                @update:model-value="v => updateField('fontColor.value', v)"
                placeholder="rgba(0, 0, 0, 0.15)">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      字体颜色<br />
                      示例: rgba(0, 0, 0, 0.15), #333
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="rotate"
                :model-value="properties.rotate?.isSlot"
                @update:model-value="v => updateParamSlot(properties.rotate, 'rotate', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.rotate?.isSlot"
                :model-value="properties.rotate?.value"
                @update:model-value="v => updateField('rotate.value', v)"
                placeholder="-22">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      旋转角度（度）<br />
                      示例: -22, -45, 0
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="zIndex"
                :model-value="properties.zIndex?.isSlot"
                @update:model-value="v => updateParamSlot(properties.zIndex, 'zIndex', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.zIndex?.isSlot"
                :model-value="properties.zIndex?.value"
                @update:model-value="v => updateField('zIndex.value', v)"
                placeholder="9999">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      层级<br />
                      示例: 9999, 1000
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="gap"
                :model-value="properties.gap?.isSlot"
                @update:model-value="v => updateParamSlot(properties.gap, 'gap', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.gap?.isSlot"
                :model-value="properties.gap?.value"
                @update:model-value="v => updateField('gap.value', v)"
                placeholder="100">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      水印间距（像素）<br />
                      示例: 100, 150, 200
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 4：可用输出 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">可用输出</div>
          <div class="column q-gutter-y-xs text-caption">
            <div><span class="text-blue-4">setWatermark</span> - 设置/更新水印</div>
            <div><span class="text-blue-4">clear</span> - 清除水印</div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
