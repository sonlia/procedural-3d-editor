<script setup>
import { QToggle } from "quasar";
import { computed, onMounted, toRef, watchEffect, ref } from "vue";
import { convertEdgeQuotes } from "src/components/utils/util.js";
import * as material from "@quasar/extras/material-icons";

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

// ===== 图标选择器相关逻辑 =====
const searchValue = ref("");
const selectedIcon = ref("");
const iconGroup = ref("material");
const popupRef = ref(null);

const iconData = {
  material: Object.keys(material),
};

const filteredIcons = computed(() =>
  iconData[iconGroup.value].filter((item) => item.includes(searchValue.value)).slice(0, 500)
);

const transformIconName = (str) => {
  let withoutMat = str.replace("mat", "");
  let result = withoutMat.replace(/([A-Z])/g, (match) => "_" + match.toLowerCase());
  result = result.startsWith("_") ? result.substring(1) : result;
  return result;
};

const selectIcon = (iconName) => {
  selectedIcon.value = iconName;
};

const confirmIconSelection = () => {
  if (selectedIcon.value) {
    value.value = `'${selectedIcon.value}'`;
    popupRef.value?.hide();
  }
};
</script>

<template>
  <div class="property-icon-item">
    <div class="icon-main-content">
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
          <!-- 图标选择器按钮 -->
          <q-btn icon="sentiment_satisfied_alt" flat dense round class="action-btn icon-picker-btn"
            :class="{ 'btn-disabled': isSlot }">
            <q-tooltip anchor="top middle" self="bottom middle" :delay="500">
              选择图标
            </q-tooltip>

            <!-- 图标选择器弹窗 -->
            <q-popup-proxy dark ref="popupRef">
              <q-card dark class="icon-panel">
                <!-- 搜索和预览区 -->
                <div class="search-section">
                  <q-input type="search" v-model="searchValue"  dense dark borderless placeholder="搜索图标...">
                    <template v-slot:prepend>
                      <q-icon name="search"  />
                    </template>
                  </q-input>
                  <div class="preview-section">
                    <q-icon v-if="selectedIcon" :name="selectedIcon" size="md" class="preview-icon" />
                    <span v-else class="preview-text">未选择</span>
                    <q-btn flat dense size="md" label="确定" :disable="!selectedIcon" @click="confirmIconSelection"
                      class="confirm-btn" />
                  </div>
                </div>

                <!-- 图标列表 -->
                <div class="icon-list">
                  <q-icon v-for="name in filteredIcons" :key="name" :name="transformIconName(name)" size="sm"
                    class="icon-item-box" :class="{ 'selected': selectedIcon === transformIconName(name) }"
                    @click="selectIcon(transformIconName(name))" />
                </div>
              </q-card>
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
.property-icon-item {
  width: 100%;
  margin-bottom: 2px;
}

.icon-main-content {
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

.icon-picker-btn {
  color: #f39c12;
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

/* ===== 图标选择器样式 ===== */
.icon-panel {
  padding: 4px;
}

.search-section {
  padding: 2px 2px 4px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.preview-section {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 4px;
  padding: 2px 4px;
  min-height: 28px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 2px;
}

.preview-icon {
  color: #0ae641;
}

.preview-text {
  font-size: 11px;
  color: rgba(255, 255, 255, 0.4);
}

.confirm-btn {
  min-height: 20px;
  padding: 0 8px;
}

.icon-list {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  padding: 4px 2px;
  max-height: 320px;
  overflow-y: auto;
  overflow-x: hidden;
}

.icon-list::-webkit-scrollbar {
  width: 6px;
}

.icon-list::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
}

.icon-list::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.icon-list::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.icon-item-box {
  cursor: pointer;
  padding: 4px;
  border-radius: 2px;
  transition: none;
  border: 1px solid transparent;
}

.icon-item-box:hover {
  border-color: #0ae641;
  background: rgba(10, 230, 65, 0.1);
}

.icon-item-box.selected {
  border-color: #0ae641;
  background: rgba(10, 230, 65, 0.15);
}
</style>
