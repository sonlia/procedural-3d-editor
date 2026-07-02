<template>
  <div class="comp-events-panel">
    <!-- 组件事件 -->
    <div v-if="componentEvents.length > 0" class="events-section">
      <div class="section-header">

        <span class="section-title">组件事件</span>
      </div>

      <div class="events-list">
        <div v-for="eventName in componentEvents" :key="eventName" class="event-item">
          <q-toggle
            dense
            dark
            :label="eventName"
            :model-value="eventsProperties[eventName] || false"
            @update:model-value="(val) => updateEventState(eventName, val)"

            class="event-toggle"
          >
            <q-tooltip v-if="eventsDefinition[eventName]?.desc_cn" :delay="700">
              {{ eventsDefinition[eventName].desc_cn }}
            </q-tooltip>
          </q-toggle>

          <!-- 事件参数显示 -->
          <div
            v-if="eventsDefinition[eventName]?.params && eventsProperties[eventName]"
            class="event-params"
          >
            <q-badge
              v-for="(paramInfo, paramName) in eventsDefinition[eventName].params"
              :key="paramName"
              rounded
              color="blue-grey-8"
              text-color="blue-2"
              :label="paramName"
              class="param-badge"
            >
              <q-tooltip :delay="700">
                {{ paramInfo?.desc_cn || paramInfo?.desc }}
                <template v-if="paramInfo?.examples">
                  <br/>
                  示例: {{ paramInfo.examples.join(", ") }}
                </template>
              </q-tooltip>
            </q-badge>
          </div>
        </div>
      </div>
    </div>

    <!-- HTML 原生事件 -->
    <div class="events-section">
      <div class="section-header">

        <span class="section-title">HTML 原生事件</span>
      </div>

      <q-btn-dropdown
        color="grey-9"
        text-color="grey-3"
        label="添加 HTML 事件"
        dark
        dense
        unelevated
        size="sm"
        class="add-event-btn"
        dropdown-icon="add"
        menu-anchor="bottom middle"
        menu-self="top middle"
      >
        <q-list dark dense class="html-events-menu">
          <template v-for="(events, category) in htmlEvents" :key="category">
            <q-item-label header class="category-label">
              {{ category }}
            </q-item-label>
            <q-item
              v-for="eventName in events"
              :key="eventName"
              dark
              clickable
              dense
              @click="toggleHtmlEvent(eventName)"
              class="event-menu-item"
            >
              <q-item-section>
                <q-item-label class="event-name">{{ eventName }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-checkbox
                  dark
                  dense

                  :model-value="eventsProperties[eventName] || false"
                  @update:model-value="(val) => updateEventState(eventName, val)"
                />
              </q-item-section>
            </q-item>
          </template>
        </q-list>
      </q-btn-dropdown>

      <!-- 已添加的 HTML 事件 -->
      <div v-if="htmlEventsList.length > 0" class="events-list">
        <div v-for="eventName in htmlEventsList" :key="eventName" class="event-item">
          <q-toggle
            dense
            dark
            :label="eventName"
            :model-value="eventsProperties[eventName] || false"
            @update:model-value="(val) => updateEventState(eventName, val)"

            class="event-toggle"
          >
            <q-tooltip :delay="700">
              HTML 原生事件
            </q-tooltip>
          </q-toggle>
        </div>
      </div>
    </div>

    <!-- 无事件状态 -->
    <div v-if="componentEvents.length === 0 && htmlEventsList.length === 0" class="no-events">
      <q-icon name="event_busy" size="2em" color="grey-7" />
      <div class="no-events-text">
        暂无事件配置
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, watch } from "vue";
import { useNodeData } from "./composables/useNodeData.js";

// HTML 事件分类
const htmlEvents = {
  鼠标事件: [
    "click", "dblclick", "mousedown", "mouseup", "mousemove",
    "mouseover", "mouseout", "mouseenter", "mouseleave"
  ],
  键盘事件: ["keydown", "keyup", "keypress"],
  表单事件: ["submit", "reset", "change", "focus", "blur", "input"],
  文档事件: ["load", "unload", "resize", "scroll"],
  拖放事件: [
    "dragstart", "drag", "dragenter", "dragleave",
    "dragover", "drop", "dragend"
  ]
};

const nodeData = defineModel();

// 使用统一数据访问接口
const {
  eventsDefinition,
  eventsProperties,

  ensurePropertyStructure
} = useNodeData(nodeData);

// 组件定义的事件
const componentEvents = computed(() => {
  return Object.keys(eventsDefinition.value);
});

// 已添加的 HTML 事件（不在组件定义中的）
const htmlEventsList = computed(() => {
  const allHtmlEvents = Object.values(htmlEvents).flat();
  return Object.keys(eventsProperties.value).filter(eventName =>
    !componentEvents.value.includes(eventName) && allHtmlEvents.includes(eventName)
  );
});

// 更新事件状态
const updateEventState = (eventName, value) => {
  ensurePropertyStructure('events');
  nodeData.value.properties.events[eventName] = value;

  // 管理对应的 slot input
  const slotName = `E#${eventName}`;
  const slotIndex = nodeData.value.inputs?.findIndex(slot => slot.name === slotName) ?? -1;

  if (value && slotIndex === -1) {
    // 启用事件：添加 slot input
    const eventParams = eventsDefinition.value[eventName]?.params || {};
    const paramNames = Object.keys(eventParams);

    nodeData.value.addInput(slotName, "function", {
      shape: 5, // 函数形状
      meta: {
        args: paramNames, // 函数参数名称数组
      },
    });
  } else if (!value && slotIndex !== -1) {
    // 禁用事件：删除 slot input
    nodeData.value.removeInput(slotIndex);
  }

  // 触发节点更新
  if (nodeData.value.onExecute && typeof nodeData.value.onExecute === 'function') {
    nodeData.value.onExecute();
  }
};

// 切换 HTML 事件
const toggleHtmlEvent = (eventName) => {
  const currentValue = eventsProperties.value[eventName] || false;
  updateEventState(eventName, !currentValue);
};

// 监听节点变化，初始化事件数据
watch(nodeData, (newNode) => {
  if (newNode && newNode.nodeRawData?.events) {
    // 初始化组件事件
    Object.keys(newNode.nodeRawData.events).forEach(eventName => {
      ensurePropertyStructure('events', eventName, false);
    });
  }
}, { immediate: true, deep: true });
</script>

<style scoped>
.comp-events-panel {
  width: 100%;
  padding: 8px 12px;
}

/* 分组区域 */
.events-section {
  margin-bottom: 12px;
}

.events-section:last-of-type {
  margin-bottom: 0;
}

/* 分组标题 */
.section-header {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 8px;
  padding: 4px 0;
  color: rgba(255, 255, 255, 0.7);
}

.section-title {
  font-size: 0.8rem;
  font-weight: 500;
  letter-spacing: 0.3px;
}

/* 事件列表 */
.events-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 6px;
}

/* 事件项 */
.event-item {
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 4px;
  padding: 6px 8px;
  transition: all 0.2s ease;
}

.event-item:hover {
  background: rgba(255, 255, 255, 0.06);
  border-color: rgba(255, 255, 255, 0.12);
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.2);
}

/* 事件开关 */
.event-toggle {
  width: 100%;
}

.event-toggle :deep(.q-toggle__label) {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.85);
}

.event-toggle :deep(.q-toggle__inner) {
  font-size: 0.75rem;
}

/* 事件参数 */
.event-params {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  margin-top: 6px;
  margin-left: 32px;
  padding-top: 4px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.param-badge {
  font-size: 0.7rem;
  padding: 2px 8px;
  height: 20px;
  cursor: help;
  transition: all 0.2s ease;
}

.param-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
}

/* 添加事件按钮 */
.add-event-btn {
  width: 100%;
  height: 32px;
  font-size: 0.8rem;
  border: 1px solid rgba(255, 255, 255, 0.08);
  transition: all 0.2s ease;
}

.add-event-btn:hover {
  border-color: rgba(255, 255, 255, 0.15);
  background: rgba(255, 255, 255, 0.05) !important;
}

/* HTML 事件菜单 */
.html-events-menu {
  background: #1e1e1e;
  border: 1px solid rgba(255, 255, 255, 0.1);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.6);
  max-height: 360px;
  overflow-y: auto;
}

.category-label {
  font-size: 0.7rem;
  font-weight: 600;
  color: rgba(255, 255, 255, 0.5);
  padding: 8px 12px 4px;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.event-menu-item {
  min-height: 32px;
  padding: 4px 12px;
  transition: background 0.15s ease;
}

.event-menu-item:hover {
  background: rgba(255, 255, 255, 0.08);
}

.event-name {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.85);
}

/* 无事件状态 */
.no-events {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 32px 16px;
  text-align: center;
  opacity: 0.6;
}

.no-events-text {
  font-size: 0.75rem;
  color: rgba(255, 255, 255, 0.5);
  margin-top: 8px;
}

/* 滚动条样式 */
.html-events-menu::-webkit-scrollbar {
  width: 6px;
}

.html-events-menu::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.03);
}

.html-events-menu::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 3px;
}

.html-events-menu::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.25);
}
</style>
