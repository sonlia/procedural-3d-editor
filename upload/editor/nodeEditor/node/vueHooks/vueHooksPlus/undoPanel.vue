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

function updateVarNameSlot(isSlot) {
  const param = properties.value.outputVar;
  if (!param) return;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput("VarName", "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
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

const declareTypeOptions = [
  { label: "const", value: "const", description: "常量声明，不可重新赋值" },
  { label: "let", value: "let", description: "变量声明，可重新赋值" },
];
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 说明 -->
      <div class="text-caption text-grey">撤销/重做历史栈管理</div>

      <!-- 卡片 1：输出变量 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <q-checkbox dense dark label="Export" :disable="properties.outputVar?.isSlot"
            :model-value="properties.exported"
            @update:model-value="v => updateField('exported', v)" class="q-mb-xs" />
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="VarName"
              :model-value="properties.outputVar?.isSlot"
              @update:model-value="v => updateVarNameSlot(v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-select dense dark outlined :disable="properties.outputVar?.isSlot"
              :model-value="properties.declareType"
              @update:model-value="v => updateField('declareType', v)"
              :options="declareTypeOptions" emit-value map-options class="col-auto">
              <template v-slot:option="scope">
                <q-item v-bind="scope.itemProps">
                  <q-item-section>
                    <q-item-label>{{ scope.opt.label }}</q-item-label>
                    <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <q-input dense dark outlined class="col" :disable="properties.outputVar?.isSlot"
              :model-value="properties.outputVar?.value"
              @update:model-value="v => updateField('outputVar.value', v)">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    撤销状态变量名前缀<br />
                    示例: formHistory, editorState
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：初始值 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">初始值 (initialValue)</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="initial"
              :model-value="properties.initialValue?.isSlot"
              @update:model-value="v => updateParamSlot(properties.initialValue, 'initialValue', v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :disable="properties.initialValue?.isSlot"
              :model-value="properties.initialValue?.value"
              @update:model-value="v => updateField('initialValue.value', v)"
              placeholder="undefined">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    初始状态值<br />
                    示例: '', 0, null, { name: '' }
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 3：可用输出 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">可用输出</div>
          <div class="column q-gutter-y-xs text-caption">
            <div><span class="text-blue-4">state</span> - 当前状态值</div>
            <div><span class="text-blue-4">setState</span> - 设置新状态（会记录历史）</div>
            <div><span class="text-blue-4">resetState</span> - 重置到初始状态</div>
            <div><span class="text-blue-4">undo</span> - 撤销到上一步</div>
            <div><span class="text-blue-4">redo</span> - 重做到下一步</div>
            <div><span class="text-blue-4">canUndo</span> - 是否可以撤销</div>
            <div><span class="text-blue-4">canRedo</span> - 是否可以重做</div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 使用示例 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">使用示例</div>
          <div class="column q-gutter-y-xs text-caption" style="font-family: monospace;">
            <div class="text-grey">// 设置新值</div>
            <div>setState('new value')</div>
            <div class="text-grey q-mt-xs">// 撤销/重做</div>
            <div>if (canUndo.value) undo()</div>
            <div>if (canRedo.value) redo()</div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
