<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 判断节点类型
const nodeType = computed(() => props.value?.constructor?.title || "");

const isAsyncState = computed(() => nodeType.value === "useAsyncState");
const isClamp = computed(() => nodeType.value === "useClamp");
const isSharedComposable = computed(() => nodeType.value === "createSharedComposable");

const hookDescription = computed(() => {
  if (isAsyncState.value) return "一次性异步数据加载";
  if (isClamp.value) return "限制数值在指定范围内";
  if (isSharedComposable.value) return "创建全局单例 composable";
  return "";
});

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
      <div class="text-caption text-grey">{{ hookDescription }}</div>

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
                    {{ isAsyncState ? '异步状态变量名前缀' : isClamp ? '限制后的数值变量名' : '共享 composable 变量名' }}<br />
                    示例: {{ isAsyncState ? 'userData, fetchResult' : isClamp ? 'clampedValue, progress' : 'useSharedMouse' }}
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- useAsyncState -->
      <template v-if="isAsyncState">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">Promise 函数</div>
            <div class="text-caption text-blue-4">
              <q-icon name="info"  class="q-mr-xs" />
              连接 FunctionBlock 节点，返回 Promise
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">初始状态 (initialState)</div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="initial"
                :model-value="properties.initialState?.isSlot"
                @update:model-value="v => updateParamSlot(properties.initialState, 'initialState', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.initialState?.isSlot"
                :model-value="properties.initialState?.value"
                @update:model-value="v => updateField('initialState.value', v)"
                placeholder="null">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      数据加载前的初始值<br />
                      示例: null, [], {}
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">选项</div>
            <div class="column q-gutter-y-xs">
              <q-checkbox dense dark
                :model-value="properties.immediate"
                @update:model-value="v => updateField('immediate', v)"
                label="立即执行">
                <q-tooltip class="bg-dark" max-width="250px">
                  创建后立即执行 Promise
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.resetOnExecute"
                @update:model-value="v => updateField('resetOnExecute', v)"
                label="执行时重置">
                <q-tooltip class="bg-dark" max-width="250px">
                  重新执行时重置状态到初始值
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.shallow"
                @update:model-value="v => updateField('shallow', v)"
                label="浅层响应式">
                <q-tooltip class="bg-dark" max-width="250px">
                  使用 shallowRef 代替 ref
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.throwError"
                @update:model-value="v => updateField('throwError', v)"
                label="抛出错误">
                <q-tooltip class="bg-dark" max-width="250px">
                  错误时抛出而非捕获到 error
                </q-tooltip>
              </q-checkbox>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="delay"
                  :model-value="properties.delay?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.delay, 'delay', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.delay?.isSlot"
                  :model-value="properties.delay?.value"
                  @update:model-value="v => updateField('delay.value', v)"
                  placeholder="0">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        延迟执行时间（毫秒）<br />
                        示例: 0, 100, 500
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">可用输出</div>
            <div class="column q-gutter-y-xs text-caption">
              <div><span class="text-blue-4">state</span> - 异步数据</div>
              <div><span class="text-blue-4">isReady</span> - 是否已完成加载</div>
              <div><span class="text-blue-4">isLoading</span> - 是否正在加载</div>
              <div><span class="text-blue-4">error</span> - 错误信息</div>
              <div><span class="text-blue-4">execute</span> - 重新执行函数</div>
            </div>
          </q-card-section>
        </q-card>
      </template>

      <!-- useClamp -->
      <template v-if="isClamp">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">数值 (value)</div>
            <div class="text-caption text-blue-4">
              <q-icon name="info"  class="q-mr-xs" />
              连接一个响应式数值（ref/computed）
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">范围限制</div>
            <div class="column q-gutter-y-xs">
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="min"
                  :model-value="properties.min?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.min, 'min', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.min?.isSlot"
                  :model-value="properties.min?.value"
                  @update:model-value="v => updateField('min.value', v)"
                  placeholder="0">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        最小值<br />
                        示例: 0, -100
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="max"
                  :model-value="properties.max?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.max, 'max', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.max?.isSlot"
                  :model-value="properties.max?.value"
                  @update:model-value="v => updateField('max.value', v)"
                  placeholder="100">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        最大值<br />
                        示例: 100, 255
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </template>

      <!-- createSharedComposable -->
      <template v-if="isSharedComposable">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">Composable 函数</div>
            <div class="text-caption text-blue-4">
              <q-icon name="info"  class="q-mr-xs" />
              连接 FunctionBlock 节点，返回 composable 结果
            </div>
            <div class="text-caption text-grey q-mt-xs">
              多次调用只会执行一次，后续调用返回相同实例
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">使用示例</div>
            <div class="column q-gutter-y-xs text-caption" style="font-family: monospace;">
              <div class="text-grey">// 创建共享 composable</div>
              <div>const useSharedMouse = createSharedComposable(useMouse)</div>
              <div class="text-grey q-mt-xs">// 在任意组件中使用，共享同一实例</div>
              <div>const { x, y } = useSharedMouse()</div>
            </div>
          </q-card-section>
        </q-card>
      </template>
    </div>
  </BasePropertyPanel>
</template>
