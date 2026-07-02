<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 判断节点类型
const nodeType = computed(() => props.value?.constructor?.title || "");

const isMouse = computed(() => nodeType.value === "useMouse");
const isScroll = computed(() => nodeType.value === "useScroll");
const isGeolocation = computed(() => nodeType.value === "useGeolocation");
const isNetwork = computed(() => nodeType.value === "useNetwork");

const hookDescription = computed(() => {
  if (isMouse.value) return "响应式获取鼠标位置";
  if (isScroll.value) return "响应式获取滚动位置和状态";
  if (isGeolocation.value) return "响应式获取地理位置";
  if (isNetwork.value) return "响应式获取网络状态";
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

const mouseTypeOptions = [
  { label: "page", value: "page", description: "相对于整个文档" },
  { label: "client", value: "client", description: "相对于视口" },
  { label: "screen", value: "screen", description: "相对于屏幕" },
  { label: "movement", value: "movement", description: "相对于上次位置的移动量" },
];

const scrollBehaviorOptions = [
  { label: "auto", value: "auto", description: "默认滚动行为" },
  { label: "smooth", value: "smooth", description: "平滑滚动" },
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
                    {{ isMouse ? '鼠标位置变量名前缀' : isScroll ? '滚动状态变量名前缀' : isGeolocation ? '地理位置变量名前缀' : '网络状态变量名前缀' }}<br />
                    示例: {{ isMouse ? 'mouse, cursor' : isScroll ? 'scroll, pageScroll' : isGeolocation ? 'geo, location' : 'network, net' }}
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 2：目标元素（仅 useScroll） -->
      <q-card v-if="isScroll" dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">目标元素 (target)</div>
          <div class="text-caption text-blue-4">
            <q-icon name="info"  class="q-mr-xs" />
            连接 UI 节点的 Ref 输出，默认为 window
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 3：选项 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">选项</div>
          <div class="column q-gutter-y-xs">
            <!-- useMouse 选项 -->
            <template v-if="isMouse">
              <q-select dense dark outlined
                :model-value="properties.type"
                @update:model-value="v => updateField('type', v)"
                :options="mouseTypeOptions" emit-value map-options label="坐标类型">
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
                :model-value="properties.touch"
                @update:model-value="v => updateField('touch', v)"
                label="支持触摸">
                <q-tooltip class="bg-dark" max-width="250px">
                  是否响应触摸事件
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.resetOnTouchEnds"
                @update:model-value="v => updateField('resetOnTouchEnds', v)"
                label="触摸结束时重置">
                <q-tooltip class="bg-dark" max-width="250px">
                  触摸结束时重置坐标到初始值
                </q-tooltip>
              </q-checkbox>
            </template>

            <!-- useScroll 选项 -->
            <template v-if="isScroll">
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="throttle"
                  :model-value="properties.throttle?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.throttle, 'throttle', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.throttle?.isSlot"
                  :model-value="properties.throttle?.value"
                  @update:model-value="v => updateField('throttle.value', v)"
                  placeholder="0">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        节流时间（毫秒）<br />
                        示例: 0, 100, 200
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <q-select dense dark outlined
                :model-value="properties.behavior"
                @update:model-value="v => updateField('behavior', v)"
                :options="scrollBehaviorOptions" emit-value map-options label="滚动行为">
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

            <!-- useGeolocation 选项 -->
            <template v-if="isGeolocation">
              <q-checkbox dense dark
                :model-value="properties.enableHighAccuracy"
                @update:model-value="v => updateField('enableHighAccuracy', v)"
                label="高精度模式">
                <q-tooltip class="bg-dark" max-width="250px">
                  启用高精度定位（可能更耗电）
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.immediate"
                @update:model-value="v => updateField('immediate', v)"
                label="立即获取">
                <q-tooltip class="bg-dark" max-width="250px">
                  创建后立即开始获取位置
                </q-tooltip>
              </q-checkbox>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="timeout"
                  :model-value="properties.timeout?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.timeout, 'timeout', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.timeout?.isSlot"
                  :model-value="properties.timeout?.value"
                  @update:model-value="v => updateField('timeout.value', v)"
                  placeholder="Infinity">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        获取位置的超时时间（毫秒）<br />
                        示例: 5000, 10000
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="maxAge"
                  :model-value="properties.maximumAge?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.maximumAge, 'maximumAge', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.maximumAge?.isSlot"
                  :model-value="properties.maximumAge?.value"
                  @update:model-value="v => updateField('maximumAge.value', v)"
                  placeholder="0">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        缓存位置的最大时间（毫秒）<br />
                        示例: 0, 30000
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
            </template>

            <!-- useNetwork 无额外选项 -->
            <template v-if="isNetwork">
              <div class="text-caption text-grey">无需配置选项</div>
            </template>
          </div>
        </q-card-section>
      </q-card>

      <!-- 卡片 4：输出说明 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">可用输出</div>
          <div class="column q-gutter-y-xs text-caption">
            <!-- useMouse 输出 -->
            <template v-if="isMouse">
              <div><span class="text-blue-4">x</span> - 鼠标 X 坐标</div>
              <div><span class="text-blue-4">y</span> - 鼠标 Y 坐标</div>
              <div><span class="text-blue-4">sourceType</span> - 事件来源 (mouse/touch)</div>
            </template>

            <!-- useScroll 输出 -->
            <template v-if="isScroll">
              <div><span class="text-blue-4">x</span> - 水平滚动位置</div>
              <div><span class="text-blue-4">y</span> - 垂直滚动位置</div>
              <div><span class="text-blue-4">isScrolling</span> - 是否正在滚动</div>
              <div><span class="text-blue-4">arrivedState</span> - 到达边界状态 { left, right, top, bottom }</div>
              <div><span class="text-blue-4">directions</span> - 滚动方向 { left, right, top, bottom }</div>
            </template>

            <!-- useGeolocation 输出 -->
            <template v-if="isGeolocation">
              <div><span class="text-blue-4">coords</span> - 坐标对象 { latitude, longitude, accuracy, ... }</div>
              <div><span class="text-blue-4">locatedAt</span> - 定位时间戳</div>
              <div><span class="text-blue-4">error</span> - 错误信息</div>
              <div><span class="text-blue-4">resume</span> - 恢复定位函数</div>
              <div><span class="text-blue-4">pause</span> - 暂停定位函数</div>
            </template>

            <!-- useNetwork 输出 -->
            <template v-if="isNetwork">
              <div><span class="text-blue-4">isOnline</span> - 是否在线</div>
              <div><span class="text-blue-4">offlineAt</span> - 离线时间戳</div>
              <div><span class="text-blue-4">onlineAt</span> - 上线时间戳</div>
              <div><span class="text-blue-4">downlink</span> - 下行速度 (Mbps)</div>
              <div><span class="text-blue-4">effectiveType</span> - 网络类型 (slow-2g/2g/3g/4g)</div>
              <div><span class="text-blue-4">type</span> - 连接类型 (wifi/cellular/...)</div>
            </template>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
