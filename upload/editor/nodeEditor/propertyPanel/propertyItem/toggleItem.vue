<script setup>
import { QSelect, QToggle } from "quasar";
import { computed, onMounted, toRef, watchEffect } from "vue";

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
  <div class="property-toggle-item">
    <div class="toggle-main-content">
      <!-- 启用/禁用切换 -->
      <q-toggle
        icon="code"
        v-model="isSlot"
        size="sm"
        color="teal"
        dense
        class="code-toggle"
      >
        <q-tooltip anchor="top middle" self="bottom middle" :delay="800">
          {{ isSlot ? '使用直接输入' : '使用 Slot 连接' }}
        </q-tooltip>
      </q-toggle>

      <!-- 主要切换开关 -->
      <div class="main-toggle-wrapper">
        <q-toggle
          :label="props.label"
          v-model="value"
          :disable="isSlot"
          color="green"
          dark
          dense
          class="main-toggle"
          :class="{ 'toggle-disabled': isSlot }"
        >
          <!-- 属性提示信息 -->
          <q-tooltip 
            v-if="getTooltipInfo.examples || getTooltipInfo.desc_cn" 
            anchor="center left" 
            self="center right" 
            :delay="1000"
            class="property-tooltip"
          >
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
        </q-toggle>

        <!-- 状态指示器 -->
        <div class="status-indicator" :class="{ 'active': value && !isSlot, 'disabled': isSlot }">
          <q-icon
            :name="value ? 'check_circle' : 'radio_button_unchecked'"
            size="sm"
            :color="isSlot ? 'grey-6' : (value ? 'green-5' : 'grey-5')"
            class="status-icon"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.property-toggle-item {
  width: 100%;
  margin-bottom: 2px;
}

.toggle-main-content {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 32px;
  padding: 2px 0;
}

.code-toggle {
  flex-shrink: 0;
}

.main-toggle-wrapper {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 4px;
  padding: 2px 4px;
  border-radius: 4px;
  background-color: rgba(255, 255, 255, 0.02);
  border: 1px solid rgba(255, 255, 255, 0.1);
}

.main-toggle {
  flex: 1;
}

.toggle-disabled {
  opacity: 0.6;
}

.toggle-disabled .main-toggle {
  pointer-events: none;
}

.status-indicator {
  flex-shrink: 0;
  padding: 2px;
  border-radius: 50%;
}

.status-indicator.active {
  background-color: rgba(76, 175, 80, 0.1);
}

.status-indicator.disabled {
  opacity: 0.4;
}

.status-icon {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1));
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
