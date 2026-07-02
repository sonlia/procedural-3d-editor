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

function updateFunctionSlot(param, slotName, args, isSlot) {
  if (!param) return;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput(slotName, "function", {
      id: param.id,
      shape: 5,
      meta: { args },
    });
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
      <div class="text-caption text-grey">执行创建、更新、删除等写操作</div>

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
                    变更操作对象变量名<br />
                    示例: createUser, updatePost, deleteItem
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：变更键（可选） -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">变更键 (mutationKey) - 可选</div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="mutationKey"
              :model-value="properties.mutationKey?.isSlot"
              @update:model-value="v => updateParamSlot(properties.mutationKey, 'mutationKey', v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :disable="properties.mutationKey?.isSlot"
              :model-value="properties.mutationKey?.value"
              @update:model-value="v => updateField('mutationKey.value', v)"
              placeholder="['createUser']">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    标识变更操作的键数组<br />
                    示例: ['createUser'], ['updatePost', postId]
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 3：变更函数 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">变更函数 (mutationFn)</div>
          <div class="text-caption text-blue-4">
            <q-icon name="info"  class="q-mr-xs" />
            连接 FunctionBlock 节点，参数: variables (传入 mutate 的数据)
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 4：回调函数 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">回调函数（可选）</div>
          <div class="column q-gutter-y-xs">
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="onSuccess"
                :model-value="properties.onSuccess?.isSlot"
                @update:model-value="v => updateFunctionSlot(properties.onSuccess, 'onSuccess', ['data', 'variables', 'context'], v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <span class="text-caption text-grey">成功回调 (data, variables, context)</span>
            </div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="onError"
                :model-value="properties.onError?.isSlot"
                @update:model-value="v => updateFunctionSlot(properties.onError, 'onError', ['error', 'variables', 'context'], v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <span class="text-caption text-grey">错误回调 (error, variables, context)</span>
            </div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="onSettled"
                :model-value="properties.onSettled?.isSlot"
                @update:model-value="v => updateFunctionSlot(properties.onSettled, 'onSettled', ['data', 'error', 'variables', 'context'], v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <span class="text-caption text-grey">完成回调 (data, error, variables, context)</span>
            </div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="onMutate"
                :model-value="properties.onMutate?.isSlot"
                @update:model-value="v => updateFunctionSlot(properties.onMutate, 'onMutate', ['variables'], v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <span class="text-caption text-grey">变更前回调 (variables) - 用于乐观更新</span>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 5：重试选项 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">重试选项</div>
          <div class="column q-gutter-y-xs">
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="retry"
                :model-value="properties.retry?.isSlot"
                @update:model-value="v => updateParamSlot(properties.retry, 'retry', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.retry?.isSlot"
                :model-value="properties.retry?.value"
                @update:model-value="v => updateField('retry.value', v)"
                placeholder="0">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      失败重试次数<br />
                      示例: 0, 3, false
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 6：输出说明 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">可用输出</div>
          <div class="column q-gutter-y-xs text-caption">
            <div><span class="text-blue-4">mutate</span> - 触发变更函数 (同步)</div>
            <div><span class="text-blue-4">mutateAsync</span> - 触发变更函数 (返回 Promise)</div>
            <div><span class="text-blue-4">data</span> - 变更返回的数据</div>
            <div><span class="text-blue-4">error</span> - 错误信息</div>
            <div><span class="text-blue-4">isLoading</span> - 正在执行中</div>
            <div><span class="text-blue-4">isError</span> - 是否出错</div>
            <div><span class="text-blue-4">isSuccess</span> - 是否成功</div>
            <div><span class="text-blue-4">reset</span> - 重置状态函数</div>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
