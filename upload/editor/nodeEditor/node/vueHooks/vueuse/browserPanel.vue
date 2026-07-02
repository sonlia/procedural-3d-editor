<script setup>
import { computed } from "vue";
import { set } from "lodash-es";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";

const props = defineModel();
const properties = computed(() => props.value?.properties || {});

// 判断节点类型
const nodeType = computed(() => props.value?.constructor?.title || "");

const isClipboard = computed(() => nodeType.value === "useClipboard");
const isEventListener = computed(() => nodeType.value === "useEventListener");
const isWebSocket = computed(() => nodeType.value === "useWebSocket");
const isBroadcastChannel = computed(() => nodeType.value === "useBroadcastChannel");

const hookDescription = computed(() => {
  if (isClipboard.value) return "响应式剪贴板操作";
  if (isEventListener.value) return "自动清理的事件监听器";
  if (isWebSocket.value) return "响应式 WebSocket 连接";
  if (isBroadcastChannel.value) return "多标签页通信";
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

const commonEvents = [
  { label: "click", value: "'click'", description: "点击事件" },
  { label: "dblclick", value: "'dblclick'", description: "双击事件" },
  { label: "mousedown", value: "'mousedown'", description: "鼠标按下" },
  { label: "mouseup", value: "'mouseup'", description: "鼠标释放" },
  { label: "mousemove", value: "'mousemove'", description: "鼠标移动" },
  { label: "mouseenter", value: "'mouseenter'", description: "鼠标进入" },
  { label: "mouseleave", value: "'mouseleave'", description: "鼠标离开" },
  { label: "keydown", value: "'keydown'", description: "键盘按下" },
  { label: "keyup", value: "'keyup'", description: "键盘释放" },
  { label: "scroll", value: "'scroll'", description: "滚动事件" },
  { label: "resize", value: "'resize'", description: "窗口大小变化" },
  { label: "focus", value: "'focus'", description: "获得焦点" },
  { label: "blur", value: "'blur'", description: "失去焦点" },
];
</script>

<template>
  <BasePropertyPanel v-model="props">
    <div class="column q-pa-sm q-gutter-y-sm">
      <!-- 说明 -->
      <div class="text-caption text-grey">{{ hookDescription }}</div>

      <!-- 卡片 1：输出变量（除 useEventListener 外） -->
      <q-card v-if="!isEventListener" dark flat bordered>
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
                    {{ isClipboard ? '剪贴板操作变量名前缀' : isWebSocket ? 'WebSocket 变量名前缀' : '广播频道变量名前缀' }}<br />
                    示例: {{ isClipboard ? 'clipboard' : isWebSocket ? 'ws, socket' : 'channel, broadcast' }}
                  </q-tooltip>
                </q-icon>
              </template>
            </q-input>
          </div>
        </q-card-section>
      </q-card>

      <!-- useClipboard 选项 -->
      <template v-if="isClipboard">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">选项</div>
            <div class="column q-gutter-y-xs">
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="source"
                  :model-value="properties.source?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.source, 'source', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.source?.isSlot"
                  :model-value="properties.source?.value"
                  @update:model-value="v => updateField('source.value', v)"
                  placeholder="无">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        默认复制的数据源<br />
                        示例: textRef, computed(() => data.value)
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="duration"
                  :model-value="properties.copiedDuring?.isSlot"
                  @update:model-value="v => updateParamSlot(properties.copiedDuring, 'copiedDuring', v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <q-input dense dark outlined class="col" :disable="properties.copiedDuring?.isSlot"
                  :model-value="properties.copiedDuring?.value"
                  @update:model-value="v => updateField('copiedDuring.value', v)"
                  placeholder="1500">
                  <template v-slot:append>
                    <q-icon name="help_outline"  class="cursor-pointer">
                      <q-tooltip class="bg-dark" max-width="250px">
                        copied 状态持续时间（毫秒）<br />
                        示例: 1500, 3000
                      </q-tooltip>
                    </q-icon>
                  </template>
                </q-input>
              </div>
              <q-checkbox dense dark
                :model-value="properties.legacy"
                @update:model-value="v => updateField('legacy', v)"
                label="使用旧版 API">
                <q-tooltip class="bg-dark" max-width="250px">
                  使用 document.execCommand 作为后备
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.read"
                @update:model-value="v => updateField('read', v)"
                label="读取剪贴板">
                <q-tooltip class="bg-dark" max-width="250px">
                  启用读取剪贴板内容
                </q-tooltip>
              </q-checkbox>
            </div>
          </q-card-section>
        </q-card>
      </template>

      <!-- useEventListener 参数 -->
      <template v-if="isEventListener">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">目标元素 (target)</div>
            <div class="text-caption text-blue-4">
              <q-icon name="info"  class="q-mr-xs" />
              连接 UI 节点的 Ref 输出，默认为 window
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">事件名 (event)</div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="event"
                :model-value="properties.event?.isSlot"
                @update:model-value="v => updateParamSlot(properties.event, 'event', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-select dense dark outlined class="col" :disable="properties.event?.isSlot"
                :model-value="properties.event?.value"
                @update:model-value="v => updateField('event.value', v)"
                :options="commonEvents" emit-value map-options use-input input-debounce="0"
                @filter="(val, update) => update()" new-value-mode="add">
                <template v-slot:option="scope">
                  <q-item v-bind="scope.itemProps">
                    <q-item-section>
                      <q-item-label>{{ scope.opt.label }}</q-item-label>
                      <q-item-label caption class="text-grey">{{ scope.opt.description }}</q-item-label>
                    </q-item-section>
                  </q-item>
                </template>
              </q-select>
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">事件处理函数 (listener)</div>
            <div class="text-caption text-blue-4">
              <q-icon name="info"  class="q-mr-xs" />
              连接 FunctionBlock 节点，参数: event
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">选项</div>
            <div class="column q-gutter-y-xs">
              <q-checkbox dense dark
                :model-value="properties.capture"
                @update:model-value="v => updateField('capture', v)"
                label="捕获阶段">
                <q-tooltip class="bg-dark" max-width="250px">
                  在捕获阶段触发
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.passive"
                @update:model-value="v => updateField('passive', v)"
                label="被动模式">
                <q-tooltip class="bg-dark" max-width="250px">
                  不会调用 preventDefault
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.once"
                @update:model-value="v => updateField('once', v)"
                label="只触发一次">
                <q-tooltip class="bg-dark" max-width="250px">
                  触发一次后自动移除
                </q-tooltip>
              </q-checkbox>
            </div>
          </q-card-section>
        </q-card>
      </template>

      <!-- useWebSocket 参数 -->
      <template v-if="isWebSocket">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">WebSocket URL</div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="url"
                :model-value="properties.url?.isSlot"
                @update:model-value="v => updateParamSlot(properties.url, 'url', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.url?.isSlot"
                :model-value="properties.url?.value"
                @update:model-value="v => updateField('url.value', v)"
                placeholder="'wss://example.com/ws'">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      WebSocket 服务器地址<br />
                      示例: 'wss://api.example.com/ws'
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
                label="立即连接">
                <q-tooltip class="bg-dark" max-width="250px">
                  创建后立即建立连接
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.autoReconnect"
                @update:model-value="v => updateField('autoReconnect', v)"
                label="自动重连">
                <q-tooltip class="bg-dark" max-width="250px">
                  断开后自动重新连接
                </q-tooltip>
              </q-checkbox>
              <q-checkbox dense dark
                :model-value="properties.heartbeat"
                @update:model-value="v => updateField('heartbeat', v)"
                label="心跳检测">
                <q-tooltip class="bg-dark" max-width="250px">
                  启用心跳保活
                </q-tooltip>
              </q-checkbox>
            </div>
          </q-card-section>
        </q-card>

        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">回调函数（可选）</div>
            <div class="column q-gutter-y-xs">
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="onConnected"
                  :model-value="properties.onConnected?.isSlot"
                  @update:model-value="v => updateFunctionSlot(properties.onConnected, 'onConnected', ['ws'], v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <span class="text-caption text-grey">连接成功回调 (ws)</span>
              </div>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="onMessage"
                  :model-value="properties.onMessage?.isSlot"
                  @update:model-value="v => updateFunctionSlot(properties.onMessage, 'onMessage', ['ws', 'event'], v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <span class="text-caption text-grey">收到消息回调 (ws, event)</span>
              </div>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="onError"
                  :model-value="properties.onError?.isSlot"
                  @update:model-value="v => updateFunctionSlot(properties.onError, 'onError', ['ws', 'event'], v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <span class="text-caption text-grey">错误回调 (ws, event)</span>
              </div>
              <div class="row items-center q-gutter-x-sm no-wrap">
                <q-toggle dense dark label="onDisconnected"
                  :model-value="properties.onDisconnected?.isSlot"
                  @update:model-value="v => updateFunctionSlot(properties.onDisconnected, 'onDisconnected', ['ws', 'event'], v)"
                  style="min-width: 90px; flex-shrink: 0;" />
                <span class="text-caption text-grey">断开连接回调 (ws, event)</span>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </template>

      <!-- useBroadcastChannel 参数 -->
      <template v-if="isBroadcastChannel">
        <q-card dark flat bordered>
          <q-card-section class="q-pa-sm">
            <div class="text-caption text-grey q-mb-xs">频道名称 (name)</div>
            <div class="row items-center q-gutter-x-sm no-wrap">
              <q-toggle dense dark label="name"
                :model-value="properties.name?.isSlot"
                @update:model-value="v => updateParamSlot(properties.name, 'name', v)"
                style="min-width: 90px; flex-shrink: 0;" />
              <q-input dense dark outlined class="col" :disable="properties.name?.isSlot"
                :model-value="properties.name?.value"
                @update:model-value="v => updateField('name.value', v)"
                placeholder="'my-channel'">
                <template v-slot:append>
                  <q-icon name="help_outline"  class="cursor-pointer">
                    <q-tooltip class="bg-dark" max-width="250px">
                      广播频道名称，同名频道可互相通信<br />
                      示例: 'my-channel', 'sync-data'
                    </q-tooltip>
                  </q-icon>
                </template>
              </q-input>
            </div>
          </q-card-section>
        </q-card>
      </template>

      <!-- 输出说明 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey q-mb-xs">可用输出</div>
          <div class="column q-gutter-y-xs text-caption">
            <!-- useClipboard 输出 -->
            <template v-if="isClipboard">
              <div><span class="text-blue-4">text</span> - 剪贴板内容</div>
              <div><span class="text-blue-4">copied</span> - 是否刚复制成功</div>
              <div><span class="text-blue-4">copy</span> - 复制函数 copy(text)</div>
              <div><span class="text-blue-4">isSupported</span> - 是否支持剪贴板 API</div>
            </template>

            <!-- useEventListener 输出 -->
            <template v-if="isEventListener">
              <div><span class="text-blue-4">cleanup</span> - 清理函数，调用后移除监听器</div>
            </template>

            <!-- useWebSocket 输出 -->
            <template v-if="isWebSocket">
              <div><span class="text-blue-4">data</span> - 最新收到的消息</div>
              <div><span class="text-blue-4">status</span> - 连接状态 (CONNECTING/OPEN/CLOSING/CLOSED)</div>
              <div><span class="text-blue-4">send</span> - 发送消息函数</div>
              <div><span class="text-blue-4">open</span> - 打开连接函数</div>
              <div><span class="text-blue-4">close</span> - 关闭连接函数</div>
              <div><span class="text-blue-4">ws</span> - 原始 WebSocket 实例</div>
            </template>

            <!-- useBroadcastChannel 输出 -->
            <template v-if="isBroadcastChannel">
              <div><span class="text-blue-4">data</span> - 最新收到的消息</div>
              <div><span class="text-blue-4">post</span> - 发送消息函数</div>
              <div><span class="text-blue-4">close</span> - 关闭频道函数</div>
              <div><span class="text-blue-4">error</span> - 错误信息</div>
              <div><span class="text-blue-4">isClosed</span> - 是否已关闭</div>
              <div><span class="text-blue-4">isSupported</span> - 是否支持 BroadcastChannel</div>
            </template>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>
</template>
