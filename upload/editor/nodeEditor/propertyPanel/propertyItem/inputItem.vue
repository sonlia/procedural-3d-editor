<script setup>
import { QToggle } from "quasar";
import { computed, onMounted, toRef, watchEffect } from "vue";
import { convertEdgeQuotes } from "src/components/utils/util.js";

// 定义 ensurePropertyStructure 作为函数声明，以确保它可以被提升
function ensurePropertyStructure(x, key) {
  // 如果使用 reactive，可以直接操作对象
  if (!x.properties?.props) {
    x.properties.props = {};
  }
  if (!x.properties.props?.[key]) {
    x.properties.props[key] = { value: "", isSlot: false };
  }
}

const props = defineProps({
  label: String,
});

const key = toRef(props, "label");

const nodeData = defineModel();

// 确保在组件挂载时就建立好所需的结构
onMounted(() => {
  if (nodeData.value) {
    ensurePropertyStructure(nodeData.value, key.value);
  }
});

// 使用watchEffect来监听nodeData的变化，并确保结构完整
watchEffect(() => {
  if (nodeData.value) {
    ensurePropertyStructure(nodeData.value, key.value);
  }
});

const value = computed({
  get: () => nodeData.value.properties.props[key.value]?.value ?? "",
  set: (v) => {
    if (nodeData.value) {
      ensurePropertyStructure(nodeData.value, key.value);
      nodeData.value.properties.props[key.value].value = v;
    }
  },
});

const isSlot = computed({
  get: () => nodeData.value.properties.props[key.value]?.isSlot ?? false,
  set: (v) => {
    if (nodeData.value) {
      ensurePropertyStructure(nodeData.value, key.value);
      nodeData.value.properties.props[key.value].isSlot = v;

      // 管理对应的 slot input
      const propName = key.value;
      const slotIndex = nodeData.value.inputs?.findIndex(slot => slot.name === propName) ?? -1;

      if (v && slotIndex === -1) {
        // isSlot=true：添加 input slot
        nodeData.value.addInput(propName, "string");
      } else if (!v && slotIndex !== -1) {
        // isSlot=false：删除 input slot
        nodeData.value.removeInput(slotIndex);
      }

      // 触发节点更新
      if (nodeData.value.onExecute && typeof nodeData.value.onExecute === 'function') {
        nodeData.value.onExecute();
      }
    }
  },
});

// 工具函数：安全地获取提示信息（从 nodeRawData 获取元数据）
const getTooltipInfo = computed(() => {
  const rawProp = nodeData.value.nodeRawData?.props?.[key.value];
  return {
    examples: rawProp?.examples ?? "",
    desc_cn: rawProp?.desc_cn ?? "",
  };
});
</script>
<template>
  <div class="property-input-item">
    <!-- 主要内容区域 -->
    <div class="input-main-content">
      <!-- 启用/禁用切换 -->
      <q-toggle icon="code" v-model="isSlot" color="teal" dense class="toggle-switch">
        <q-tooltip anchor="top middle" self="bottom middle" :delay="800">
          {{ isSlot ? '使用直接输入' : '使用 Slot 连接' }}
        </q-tooltip>
      </q-toggle>

      <!-- 输入字段 -->
      <q-input :label="key" v-model="value" :disable="isSlot" borderless dense dark debounce="100"
        class="property-input" @update:model-value="(v) => (value = convertEdgeQuotes(v))"
        :class="{ 'input-disabled': isSlot }">

        <!-- 属性提示信息 -->
        <q-tooltip v-if="getTooltipInfo.examples || getTooltipInfo.desc_cn" anchor="center left" self="center right"
          :delay="1000" class="property-tooltip">
          <div class="tooltip-content">
            <div v-if="getTooltipInfo.desc_cn" class="tooltip-description">
              {{ getTooltipInfo.desc_cn }}
            </div>
            <div v-if="getTooltipInfo.examples" class="tooltip-examples">
              <q-separator spaced />
              <div class="text-caption text-grey-4">示例:</div>
              {{ getTooltipInfo.examples }}
            </div>
          </div>
        </q-tooltip>
      </q-input>
    </div>
  </div>
</template>

<style scoped>
.property-input-item {
  width: 100%;
  margin-bottom: 2px;
}

.input-main-content {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 2px 0;
}

.toggle-switch {
  flex-shrink: 0;
}

.property-input {
  flex: 1;
}

.input-disabled {
  opacity: 0.6;
}

/* Tooltip 样式 */
.property-tooltip {
  max-width: 250px;
}

.tooltip-content {
  padding: 2px 0;
}

.tooltip-description {
  font-weight: 500;
  color: white;
  line-height: 1.3;
}

.tooltip-examples {
  margin-top: 2px;
  color: #bdc3c7;
  font-size: 0.85em;
  line-height: 1.2;
}
</style>
