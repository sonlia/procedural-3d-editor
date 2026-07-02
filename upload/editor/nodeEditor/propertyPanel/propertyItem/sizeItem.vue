<script setup>
import { QToggle } from "quasar";
import { computed, onMounted, toRef, watchEffect, ref } from "vue";
import { convertEdgeQuotes } from "src/components/utils/util.js";

// 定义 ensurePropertyStructure 作为函数声明，以确保它可以被提升
function ensurePropertyStructure(x, key) {
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
const dropdown = ref(null);

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

// 获取尺寸描述
const getSizeDescription = (size) => {
  const descriptions = {
    'xs': '超小',
    'sm': '小',
    'md': '中等',
    'lg': '大',
    'xl': '超大'
  };
  return descriptions[size] || size;
};
</script>

<template>
  <div class="property-size-item">
    <div class="size-main-content">
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
        <template #append>
          <!-- 尺寸选择器按钮 -->
          <q-btn icon="straighten" flat dense round class="action-btn size-picker-btn"
            :class="{ 'btn-disabled': isSlot }">
            <q-tooltip anchor="top middle" self="bottom middle" :delay="500">
              选择尺寸
            </q-tooltip>
            <q-popup-proxy ref="dropdown" dark class="size-dropdown" transition-show="scale" transition-hide="scale">
              <q-list dark bordered padding class="size-options-list">
                <q-item v-for="size in ['xs', 'sm', 'md', 'lg', 'xl']" :key="size" clickable v-close-popup
                  class="size-option-item" @click="value = `'${size}'`">
                  <q-item-section>
                    <q-item-label class="size-label">{{ size.toUpperCase() }}</q-item-label>
                  </q-item-section>
                  <q-item-section side>
                    <q-badge :label="getSizeDescription(size)" color="teal-6" text-color="white" class="size-badge" />
                  </q-item-section>
                </q-item>
              </q-list>
            </q-popup-proxy>
          </q-btn>
        </template>

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
.property-size-item {
  width: 100%;
  margin-bottom: 2px;
}

.size-main-content {
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

.property-input :deep(.q-field__control) {
  padding-right: 4px;
}

.action-btn {
  border-radius: 50%;
  margin-left: 1px;
}

.btn-disabled {
  opacity: 0.4;
  pointer-events: none;
}

.size-picker-btn {
  color: #3498db;
}

/* 尺寸选择器样式 */
.size-dropdown {
  border-radius: 4px;
  overflow: hidden;
}

.size-options-list {
  min-width: 120px;
  border-radius: 4px;
}

.size-option-item {
  border-radius: 2px;
  margin: 1px;
}

.size-label {
  font-weight: 500;
  font-size: 0.9em;
}

.size-badge {
  font-size: 0.7em;
  border-radius: 8px;
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
