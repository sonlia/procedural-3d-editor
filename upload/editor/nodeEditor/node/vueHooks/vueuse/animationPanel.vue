<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 判断节点类型
const nodeType = computed(() => props.value?.constructor?.title || "");

const isRafFn = computed(() => nodeType.value === "useRafFn");
const isTransition = computed(() => nodeType.value === "useTransition");

const hookDescription = computed(() => {
  if (isRafFn.value) return "使用 requestAnimationFrame 执行回调";
  if (isTransition.value) return "数值过渡动画";
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

const transitionPresets = [
  { label: "linear", value: "linear", description: "线性过渡" },
  { label: "easeInSine", value: "easeInSine", description: "正弦缓入" },
  { label: "easeOutSine", value: "easeOutSine", description: "正弦缓出" },
  { label: "easeInOutSine", value: "easeInOutSine", description: "正弦缓入缓出" },
  { label: "easeInQuad", value: "easeInQuad", description: "二次方缓入" },
  { label: "easeOutQuad", value: "easeOutQuad", description: "二次方缓出" },
  { label: "easeInOutQuad", value: "easeInOutQuad", description: "二次方缓入缓出" },
  { label: "easeInCubic", value: "easeInCubic", description: "三次方缓入" },
  { label: "easeOutCubic", value: "easeOutCubic", description: "三次方缓出" },
  { label: "easeInOutCubic", value: "easeInOutCubic", description: "三次方缓入缓出" },
  { label: "easeInExpo", value: "easeInExpo", description: "指数缓入" },
  { label: "easeOutExpo", value: "easeOutExpo", description: "指数缓出" },
  { label: "easeInOutExpo", value: "easeInOutExpo", description: "指数缓入缓出" },
  { label: "easeInCirc", value: "easeInCirc", description: "圆形缓入" },
  { label: "easeOutCirc", value: "easeOutCirc", description: "圆形缓出" },
  { label: "easeInOutCirc", value: "easeInOutCirc", description: "圆形缓入缓出" },
  { label: "easeInBack", value: "easeInBack", description: "回弹缓入" },
  { label: "easeOutBack", value: "easeOutBack", description: "回弹缓出" },
  { label: "easeInOutBack", value: "easeInOutBack", description: "回弹缓入缓出" },
  { label: "easeInElastic", value: "easeInElastic", description: "弹性缓入" },
  { label: "easeOutElastic", value: "easeOutElastic", description: "弹性缓出" },
  { label: "easeInOutElastic", value: "easeInOutElastic", description: "弹性缓入缓出" },
  { label: "easeInBounce", value: "easeInBounce", description: "弹跳缓入" },
  { label: "easeOutBounce", value: "easeOutBounce", description: "弹跳缓出" },
  { label: "easeInOutBounce", value: "easeInOutBounce", description: "弹跳缓入缓出" },
];
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 说明 -->
      <div class="text-caption text-grey">{{ hookDescription }}</div>

      <!-- useRafFn -->
      <template v-if="isRafFn">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">回调函数 (fn)</div>
            <div class="text-caption text-blue-4">
              <q-icon name="info"  class="q-mr-xs" />
              连接 FunctionBlock 节点，参数: delta (距上次调用的时间差)
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
                label="立即启动">
                <q-tooltip class="bg-dark" max-width="250px">
                  创建后立即开始执行
                </q-tooltip>
              </q-checkbox>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="fpsLimit"
                  :model-value="properties.fpsLimit?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.fpsLimit, 'fpsLimit', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.fpsLimit?.isSlot"
                  :model-value="properties.fpsLimit?.value"
                  @update:model-value="v => updateField('fpsLimit.value', v)"
                  placeholder="无限制">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        帧率限制<br />
                        示例: 30, 60
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
              <div><span class="text-blue-4">pause</span> - 暂停函数</div>
              <div><span class="text-blue-4">resume</span> - 恢复函数</div>
              <div><span class="text-blue-4">isActive</span> - 是否正在运行</div>
            </div>
          </q-card-section>
        </q-card>
      </template>

      <!-- useTransition -->
      <template v-if="isTransition">
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
                      过渡后的数值变量名<br />
                      示例: animatedValue, smoothCount
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">数据源 (source)</div>
            <div class="text-caption text-blue-4">
              <q-icon name="info"  class="q-mr-xs" />
              连接一个响应式数值（ref/computed）
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">选项</div>
            <div class="column q-gutter-y-xs">
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="duration"
                  :model-value="properties.duration?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.duration, 'duration', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.duration?.isSlot"
                  :model-value="properties.duration?.value"
                  @update:model-value="v => updateField('duration.value', v)"
                  placeholder="1000">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        过渡持续时间（毫秒）<br />
                        示例: 500, 1000, 2000
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <q-select dense dark outlined
                :model-value="properties.transition"
                @update:model-value="v => updateField('transition', v)"
                :options="transitionPresets" emit-value map-options label="缓动函数">
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
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
                        延迟开始时间（毫秒）<br />
                        示例: 0, 100, 500
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <q-checkbox dense dark
                :model-value="properties.disabled"
                @update:model-value="v => updateField('disabled', v)"
                label="禁用过渡">
                <q-tooltip class="bg-dark" max-width="250px">
                  禁用后直接返回源值
                </q-tooltip>
              </q-checkbox>
            </div>
          </q-card-section>
        </q-card>
      </template>
    </div>
  </BasePropertyPanel>
</template>
