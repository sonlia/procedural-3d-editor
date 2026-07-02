<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 判断节点类型
const nodeType = computed(() => props.value?.constructor?.title || "");

const isDebounce = computed(() => nodeType.value === "useDebounceFn");
const isThrottle = computed(() => nodeType.value === "useThrottleFn");
const isTimeout = computed(() => nodeType.value === "useTimeoutFn");
const isInterval = computed(() => nodeType.value === "useIntervalFn");

const hookDescription = computed(() => {
  if (isDebounce.value) return "防抖函数：延迟执行，多次调用只执行最后一次";
  if (isThrottle.value) return "节流函数：限制执行频率，固定时间内只执行一次";
  if (isTimeout.value) return "超时函数：延迟执行一次，自动清理";
  if (isInterval.value) return "间隔函数：周期性执行，自动清理";
  return "";
});

function updateField(key, value) {
  set(properties.value, key, value);
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateVarNameSlot(isSlot) {
  const param = properties.value.outputVar;
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

function updateMsSlot(isSlot) {
  const param = properties.value.ms;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput("ms", "string", { id: param.id });
  } else if (!isSlot && existingIdx !== -1) {
    props.value.removeInput(existingIdx);
  }
  props.value.onExecute?.();
  props.value.graph?.setDirtyCanvas?.(true, true);
}

function updateMaxWaitSlot(isSlot) {
  const param = properties.value.maxWait;
  if (!param) return;
  param.isSlot = isSlot;
  const existingIdx = props.value.inputs.findIndex((s) => s.id === param.id);
  if (isSlot && existingIdx === -1) {
    props.value.addInput("maxWait", "string", { id: param.id });
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
                    返回的函数变量名<br />
                    示例: debouncedSearch, throttledScroll
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：函数参数 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">回调函数 (fn)</div>
          <div class="text-caption text-blue-4">
            <q-icon name="info"  class="q-mr-xs" />
            连接 FunctionBlock 节点提供回调函数
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 3：延迟时间 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">
            {{ isDebounce || isThrottle ? '延迟时间' : '间隔时间' }} (ms)
          </div>
          <div class="row items-center q-gutter-x-sm no-wrap">
            <q-toggle dense dark label="ms"
              :model-value="properties.ms?.isSlot"
              @update:model-value="v => updateMsSlot(v)"
              style="min-width: 90px; flex-shrink: 0;" />
            <q-input dense dark outlined class="col" :disable="properties.ms?.isSlot"
              :model-value="properties.ms?.value"
              @update:model-value="v => updateField('ms.value', v)"
              placeholder="200">
              <template v-slot:append>
                <q-icon name="help_outline"  class="cursor-pointer">
                  <q-tooltip class="bg-dark" max-width="250px">
                    {{ isDebounce ? '防抖延迟时间（毫秒）' : isThrottle ? '节流间隔时间（毫秒）' : isTimeout ? '超时延迟时间（毫秒）' : '执行间隔时间（毫秒）' }}<br />
                    示例: 200, 500, 1000
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 4：选项 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">选项</div>
          <div class="column q-gutter-y-xs">
            <!-- useDebounceFn 特有选项 -->
            <template v-if="isDebounce">
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="maxWait"
                  :model-value="properties.maxWait?.isSlot"
                  @update:model-value="v => updateMaxWaitSlot(v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.maxWait?.isSlot"
                  :model-value="properties.maxWait?.value"
                  @update:model-value="v => updateField('maxWait.value', v)"
                  placeholder="不限制">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        最大等待时间（毫秒）<br />
                        超过此时间强制执行
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <q-checkbox dense dark
                :model-value="properties.rejectOnCancel"
                @update:model-value="v => updateField('rejectOnCancel', v)"
                label="取消时 reject">
                <q-tooltip class="bg-dark" max-width="250px">
                  取消时 Promise reject 而非 resolve
                </q-tooltip>
              </q-checkbox>
            </template>

            <!-- useThrottleFn 特有选项 -->
            <template v-if="isThrottle">
              <q-checkbox dense dark
                :model-value="properties.trailing"
                @update:model-value="v => updateField('trailing', v)"
                label="尾部执行 (trailing)">
                <q-tooltip class="bg-dark" max-width="250px">
                  在节流周期结束时执行
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.leading"
                @update:model-value="v => updateField('leading', v)"
                label="头部执行 (leading)">
                <q-tooltip class="bg-dark" max-width="250px">
                  在节流周期开始时执行
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.rejectOnCancel"
                @update:model-value="v => updateField('rejectOnCancel', v)"
                label="取消时 reject">
                <q-tooltip class="bg-dark" max-width="250px">
                  取消时 Promise reject 而非 resolve
                </q-tooltip>
              </q-checkbox>
            </template>

            <!-- useTimeoutFn 特有选项 -->
            <template v-if="isTimeout">
              <q-checkbox dense dark
                :model-value="properties.immediate"
                @update:model-value="v => updateField('immediate', v)"
                label="立即启动">
                <q-tooltip class="bg-dark" max-width="250px">
                  创建后立即开始计时
                </q-tooltip>
              </q-checkbox>
            </template>

            <!-- useIntervalFn 特有选项 -->
            <template v-if="isInterval">
              <q-checkbox dense dark
                :model-value="properties.immediate"
                @update:model-value="v => updateField('immediate', v)"
                label="立即启动">
                <q-tooltip class="bg-dark" max-width="250px">
                  创建后立即开始计时
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.immediateCallback"
                @update:model-value="v => updateField('immediateCallback', v)"
                label="立即执行回调">
                <q-tooltip class="bg-dark" max-width="250px">
                  启动时立即执行一次回调
                </q-tooltip>
              </q-checkbox>
            </template>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
