<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 判断节点类型
const nodeType = computed(() => props.value?.constructor?.title || "");

const isClickOutside = computed(() => nodeType.value === "onClickOutside");
const isElementSize = computed(() => nodeType.value === "useElementSize");
const isDraggable = computed(() => nodeType.value === "useDraggable");

const hookDescription = computed(() => {
  if (isClickOutside.value) return "监听元素外部点击事件";
  if (isElementSize.value) return "响应式获取元素尺寸";
  if (isDraggable.value) return "使元素可拖拽";
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

const boxOptions = [
  { label: "content-box", value: "content-box", description: "内容区域尺寸" },
  { label: "border-box", value: "border-box", description: "包含边框的尺寸" },
];

const axisOptions = [
  { label: "both", value: "both", description: "水平和垂直方向都可拖拽" },
  { label: "x", value: "x", description: "仅水平方向可拖拽" },
  { label: "y", value: "y", description: "仅垂直方向可拖拽" },
];
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 说明 -->
      <div class="text-caption text-grey">{{ hookDescription }}</div>

      <!-- 卡片 1：输出变量（仅 useElementSize 和 useDraggable） -->
      <q-card v-if="isElementSize || isDraggable" dark flat bordered>
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
                    {{ isElementSize ? '尺寸对象变量名前缀' : '拖拽状态变量名前缀' }}<br />
                    示例: {{ isElementSize ? 'boxSize, containerSize' : 'drag, position' }}
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：目标元素 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">目标元素 (target)</div>
          <div class="text-caption text-blue-4">
            <q-icon name="info"  class="q-mr-xs" />
            连接 UI 节点的 Ref 输出或 templateRef
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 3：回调函数（仅 onClickOutside） -->
      <q-card v-if="isClickOutside" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">点击外部回调 (handler)</div>
          <div class="text-caption text-blue-4">
            <q-icon name="info"  class="q-mr-xs" />
            连接 FunctionBlock 节点，参数: event
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 4：选项 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">选项</div>
          <div class="column q-gutter-y-xs">
            <!-- onClickOutside 选项 -->
            <template v-if="isClickOutside">
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="ignore"
                  :model-value="properties.ignore?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.ignore, 'ignore', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.ignore?.isSlot"
                  :model-value="properties.ignore?.value"
                  @update:model-value="v => updateField('ignore.value', v)"
                  placeholder="[]">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        忽略的元素选择器或 Ref 数组<br />
                        示例: ['.modal', buttonRef]
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <q-checkbox dense dark
                :model-value="properties.capture"
                @update:model-value="v => updateField('capture', v)"
                label="捕获阶段 (capture)">
                <q-tooltip class="bg-dark" max-width="250px">
                  在捕获阶段触发而非冒泡阶段
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.detectIframe"
                @update:model-value="v => updateField('detectIframe', v)"
                label="检测 iframe 点击">
                <q-tooltip class="bg-dark" max-width="250px">
                  检测 iframe 内的点击事件
                </q-tooltip>
              </q-checkbox>
            </template>

            <!-- useElementSize 选项 -->
            <template v-if="isElementSize">
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="initialW"
                  :model-value="properties.initialWidth?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.initialWidth, 'initialWidth', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.initialWidth?.isSlot"
                  :model-value="properties.initialWidth?.value"
                  @update:model-value="v => updateField('initialWidth.value', v)"
                  placeholder="0">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        初始宽度值<br />
                        示例: 0, 100, window.innerWidth
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="initialH"
                  :model-value="properties.initialHeight?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.initialHeight, 'initialHeight', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.initialHeight?.isSlot"
                  :model-value="properties.initialHeight?.value"
                  @update:model-value="v => updateField('initialHeight.value', v)"
                  placeholder="0">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        初始高度值<br />
                        示例: 0, 100, window.innerHeight
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <q-select dense dark outlined
                :model-value="properties.box"
                @update:model-value="v => updateField('box', v)"
                :options="boxOptions" emit-value map-options label="盒模型">
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </template>

            <!-- useDraggable 选项 -->
            <template v-if="isDraggable">
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="initialX"
                  :model-value="properties.initialX?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.initialX, 'initialX', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.initialX?.isSlot"
                  :model-value="properties.initialX?.value"
                  @update:model-value="v => updateField('initialX.value', v)"
                  placeholder="0">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        初始 X 坐标<br />
                        示例: 0, 100
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="initialY"
                  :model-value="properties.initialY?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.initialY, 'initialY', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.initialY?.isSlot"
                  :model-value="properties.initialY?.value"
                  @update:model-value="v => updateField('initialY.value', v)"
                  placeholder="0">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        初始 Y 坐标<br />
                        示例: 0, 100
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="handle"
                  :model-value="properties.handle?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.handle, 'handle', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.handle?.isSlot"
                  :model-value="properties.handle?.value"
                  @update:model-value="v => updateField('handle.value', v)"
                  placeholder="target">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        拖拽手柄元素<br />
                        示例: handleRef, '.drag-handle'
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <q-select dense dark outlined
                :model-value="properties.axis"
                @update:model-value="v => updateField('axis', v)"
                :options="axisOptions" emit-value map-options label="拖拽轴向">
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
              <q-checkbox dense dark
                :model-value="properties.exact"
                @update:model-value="v => updateField('exact', v)"
                label="精确匹配 (exact)">
                <q-tooltip class="bg-dark" max-width="250px">
                  只有点击目标元素本身才触发拖拽
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.preventDefault"
                @update:model-value="v => updateField('preventDefault', v)"
                label="阻止默认行为">
                <q-tooltip class="bg-dark" max-width="250px">
                  阻止拖拽时的默认行为
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.stopPropagation"
                @update:model-value="v => updateField('stopPropagation', v)"
                label="阻止冒泡">
                <q-tooltip class="bg-dark" max-width="250px">
                  阻止事件冒泡
                </q-tooltip>
              </q-checkbox>
            </template>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
