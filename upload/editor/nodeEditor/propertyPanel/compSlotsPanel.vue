<script setup>
import { computed, watch } from "vue";
import { useNodeData } from "./composables/useNodeData.js";

const nodeData = defineModel();

// 使用统一数据访问接口
const {
  slotsDefinition,
  slotsProperties,
  ensurePropertyStructure
} = useNodeData(nodeData);

// 获取所有槽位名称
const getSlots = () => {
  return Object.keys(slotsDefinition.value);
};

// 判断槽位是否有参数
const hasSlotParams = (slotName) => {
  const slotConfig = slotsDefinition.value[slotName];
  return slotConfig?.scope && Object.keys(slotConfig.scope).length > 0;
};

// 更新槽位状态
const updateSlotState = (slotName, value) => {
  ensurePropertyStructure('slots');
  nodeData.value.properties.slots[slotName] = value;

  // 管理对应的 slot input
  const slotInputName = `S#${slotName}`;
  const slotIndex = nodeData.value.inputs?.findIndex(slot => slot.name === slotInputName) ?? -1;

  if (value && slotIndex === -1) {
    // 启用槽位：添加 slot input
    const slotScope = slotsDefinition.value[slotName]?.scope || {};
    const scopeParams = Object.keys(slotScope);

    // 只为有 scope 参数的槽位添加 input
    if (scopeParams.length > 0) {
      nodeData.value.addInput(slotInputName, "function", {
        shape: 5, // 函数形状
        meta: {
          args: scopeParams, // 槽位的 scope 参数数组
        },
        slotName: slotName,
      });
    }
  } else if (!value && slotIndex !== -1) {
    // 禁用槽位：删除 slot input
    nodeData.value.removeInput(slotIndex);
  }

  // 触发节点更新
  if (nodeData.value.onExecute && typeof nodeData.value.onExecute === 'function') {
    nodeData.value.onExecute();
  }
};

// 监听节点变化，初始化槽位数据
watch(nodeData, (newNode) => {
  if (newNode && newNode.nodeRawData?.slots) {
    // 初始化所有槽位
    Object.keys(newNode.nodeRawData.slots).forEach(slotName => {
      ensurePropertyStructure('slots', slotName, false);
    });
  }
}, { immediate: true, deep: true });
</script>

<template>
  <div class="slots-panel">
    <div v-for="s in getSlots()" :key="s" class="slot-item">
      <!-- 有参数的槽位：显示 toggle -->
      <div v-if="hasSlotParams(s)" class="slot-header">
        <q-toggle
          dense
          dark
          :label="s"
          :model-value="slotsProperties[s] || false"
          @update:model-value="(val) => updateSlotState(s, val)"

          class="slot-toggle"
        >
          <q-tooltip v-if="nodeData?.nodeRawData?.slots[s]?.desc_cn" :delay="500" class="bg-grey-9 text-grey-3">
            {{ nodeData?.nodeRawData?.slots[s]?.desc_cn }}
          </q-tooltip>
        </q-toggle>
      </div>

      <!-- 没有参数的槽位：仅展示 -->
      <div v-else class="slot-header">
        <q-badge
          class="slot-name"
          :label="s"
          outline
          color="grey-5"
        >
          <q-tooltip v-if="nodeData?.nodeRawData?.slots[s]?.desc_cn" :delay="500" class="bg-grey-9 text-grey-3">
            {{ nodeData?.nodeRawData?.slots[s]?.desc_cn }}
          </q-tooltip>
        </q-badge>
      </div>

      <!-- 参数展示（始终显示，只要有参数） -->
      <div v-if="hasSlotParams(s) && nodeData?.nodeRawData?.slots[s].scope" class="scope-container">
        <q-badge
          v-for="(value, key) of nodeData?.nodeRawData?.slots[s].scope"
          :key="key"
          class="scope-badge"
          rounded
          color="grey-7"
          text-color="grey-3"
          :label="key"
        >
          <q-tooltip :delay="500" class="bg-grey-9 text-grey-3">
            <div class="scope-tooltip">
              <div v-if="value?.desc_cn" class="tooltip-desc">{{ value.desc_cn }}</div>
              <div v-if="value?.examples?.length" class="tooltip-examples">
                <q-separator dark class="q-my-xs" />
                {{ value.examples.join(", ") }}
              </div>
            </div>
          </q-tooltip>
        </q-badge>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slots-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.slot-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  border-left: 2px solid rgba(255, 255, 255, 0.15);
  transition: all 0.2s ease;
}

.slot-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-left-color: rgba(255, 255, 255, 0.3);
}

.slot-header {
  display: flex;
  align-items: center;
}

/* Toggle 样式（有参数的槽位） */
.slot-toggle {
  width: 100%;
}

.slot-toggle :deep(.q-toggle__label) {
  font-size: 0.8rem;
  color: rgba(255, 255, 255, 0.85);
}

.slot-toggle :deep(.q-toggle__inner) {
  font-size: 0.75rem;
}

/* Badge 样式（没有参数的槽位） */
.slot-name {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
  padding: 2px 8px;
  text-transform: uppercase;
}

.scope-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-left: 12px;
}

.scope-badge {
  font-size: 10px;
  padding: 1px 6px;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.scope-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

.scope-tooltip {
  font-size: 11px;
  max-width: 280px;
}

.tooltip-desc {
  line-height: 1.4;
  color: rgba(255, 255, 255, 0.9);
}

.tooltip-examples {
  font-size: 10px;
  color: rgba(255, 255, 255, 0.65);
  font-style: italic;
  margin-top: 4px;
}
</style>
