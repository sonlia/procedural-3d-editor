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

const targetOptions = [
  { label: "_blank", value: "_blank", description: "新窗口打开" },
  { label: "_self", value: "_self", description: "当前窗口" },
];
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 说明 -->
      <div class="text-caption text-grey">安全的文件下载</div>

      <!-- 卡片 1：URL 配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">下载 URL</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="url"
              :model-value="properties.url?.isSlot"
              @update:model-value="v => updateParamSlot(properties.url, 'url', v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :disable="properties.url?.isSlot"
              :model-value="properties.url?.value"
              @update:model-value="v => updateField('url.value', v)"
              placeholder="https://example.com/file.pdf">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    要下载的文件 URL<br />
                    示例: /api/export/report.pdf
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：文件名配置 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">保存文件名</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="filename"
              :model-value="properties.filename?.isSlot"
              @update:model-value="v => updateParamSlot(properties.filename, 'filename', v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :disable="properties.filename?.isSlot"
              :model-value="properties.filename?.value"
              @update:model-value="v => updateField('filename.value', v)"
              placeholder="自动从 URL 获取">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    下载保存的文件名<br />
                    示例: report.pdf, data.xlsx
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 3：选项 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">选项</div>
          <q-select dense dark outlined
            :model-value="properties.target?.value"
            @update:model-value="v => updateField('target.value', v)"
            :options="targetOptions" emit-value map-options label="打开方式">
            <template v-slot:option="scope">
              <q-item v-bind="scope.itemProps">
                <q-item-section>
                  <q-item-label>{{ scope.opt.label }}</q-item-label>
                  <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                </q-item-section>
              </q-item>
            </template>
          </q-select>
        </q-card-section>
      </q-card>

      <!-- 卡片 4：可用输出 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">可用输出</div>
          <div class="column q-gutter-y-xs text-caption">
            <div><span class="text-blue-4">download</span> - 触发下载函数</div>
            <div><span class="text-blue-4">isLoading</span> - 是否正在下载</div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 使用示例 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">使用示例</div>
          <div class="column q-gutter-y-xs text-caption" style="font-family: monospace;">
            <div class="text-grey">// 触发下载</div>
            <div>download()</div>
            <div class="text-grey q-mt-xs">// 或传入新 URL</div>
            <div>download('https://new-url.com/file.zip')</div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
