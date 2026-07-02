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

// ===== 颜色选择器相关逻辑 =====
const colorList = [
  "red", "pink", "purple", "deep-purple", "indigo", "blue", "light-blue",
  "cyan", "teal", "green", "light-green", "lime", "yellow", "amber",
  "orange", "deep-orange", "brown", "grey", "blue-grey",
];

const shadesList = colorList.flatMap((color) =>
  Array.from({ length: 15 }, (_, index) => {
    if (index === 0) {
      return color;
    } else {
      return `${color}-${index}`;
    }
  }),
);

const getColorName = (colorCode) => {
  const colorNames = {
    'red': '红色', 'pink': '粉色', 'purple': '紫色', 'deep-purple': '深紫色',
    'indigo': '靛蓝色', 'blue': '蓝色', 'light-blue': '浅蓝色', 'cyan': '青色',
    'teal': '蓝绿色', 'green': '绿色', 'light-green': '浅绿色', 'lime': '柠檬绿',
    'yellow': '黄色', 'amber': '琥珀色', 'orange': '橙色', 'deep-orange': '深橙色',
    'brown': '棕色', 'grey': '灰色', 'blue-grey': '蓝灰色'
  };

  const baseColor = colorCode.split('-')[0];
  const shade = colorCode.includes('-') ? colorCode.split('-')[1] : '';
  const baseName = colorNames[baseColor] || baseColor;

  return shade ? `${baseName} ${shade}` : baseName;
};

const selectedColor = ref('');
const popupProxy = ref(null);

const selectColor = (color) => {
  selectedColor.value = color;
};

const confirmColor = () => {
  if (selectedColor.value) {
    value.value = `'${selectedColor.value}'`;
  }
  popupProxy.value?.hide();
};

const cancelColor = () => {
  selectedColor.value = '';
  popupProxy.value?.hide();
};
</script>

<template>
  <div class="property-color-item">
    <div class="color-main-content">
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
          <!-- 颜色选择器按钮 -->
          <q-btn icon="palette" flat dense round class="action-btn color-picker-btn"
            :class="{ 'btn-disabled': isSlot }">
            <q-tooltip anchor="top middle" self="bottom middle" :delay="500">
              选择颜色
            </q-tooltip>

            <!-- 颜色选择器弹窗 -->
            <q-popup-proxy ref="popupProxy" class="color-picker-popup">
              <div class="color-picker-container">
                <!-- 标题栏 -->
                <div class="color-picker-header">
                  <q-icon name="palette"  color="teal" dense />
                  <span class="header-title">选择颜色</span>
                  <div class="selected-preview" v-if="selectedColor">
                    <div :class="`bg-${selectedColor}`" class="preview-color"></div>
                    <span class="preview-name">{{ getColorName(selectedColor) }}</span>
                  </div>
                </div>

                <!-- 颜色网格（带滚动） -->
                <div class="color-grid-wrapper">
                  <div class="color-grid">
                    <div v-for="color in shadesList" :key="color"
                      :class="[`bg-${color}`, 'color-item-box', { 'selected': selectedColor === color }]"
                      @click="selectColor(color)">
                      <div class="color-overlay">
                        <q-icon v-if="selectedColor === color" name="check" color="white"
                          class="check-icon" />
                      </div>

                      <!-- Tooltip显示颜色名称 -->
                      <q-tooltip anchor="top middle" self="bottom middle" :delay="800" class="color-tooltip">
                        {{ getColorName(color) }}
                        <br>
                        <span class="text-caption">{{ color }}</span>
                      </q-tooltip>
                    </div>
                  </div>
                </div>

                <!-- 底部操作栏 -->
                <div class="color-picker-footer">
                  <div class="footer-left">
                    <q-btn flat dense  color="grey-6" @click="selectedColor = ''" class="clear-btn">
                      <q-icon name="clear"  />
                      清除
                    </q-btn>
                    <span class="text-caption text-grey-5">
                      共 {{ shadesList.length }} 种颜色
                    </span>
                  </div>

                  <div class="footer-actions">
                    <q-btn flat dense  color="grey-6" @click="cancelColor" class="action-btn-footer">
                      取消
                    </q-btn>
                    <q-btn flat dense  color="teal" @click="confirmColor" class="action-btn-footer">
                      确认
                    </q-btn>
                  </div>
                </div>
              </div>
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
.property-color-item {
  width: 100%;
  margin-bottom: 2px;
}

.color-main-content {
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

.color-picker-btn {
  color: #e74c3c;
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

/* ===== 颜色选择器样式 ===== */
.color-picker-popup {
  border-radius: 4px;
  overflow: hidden;
}

.color-picker-container {
  background: #2d2d2d;
  border-radius: 4px;
  padding: 8px;
  width: 320px;
  display: flex;
  flex-direction: column;
}

.color-picker-header {
  display: flex;
  align-items: center;
  gap: 4px;
  padding-bottom: 6px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
  margin-bottom: 8px;
  flex-shrink: 0;
  min-height: 28px;
}

.header-title {
  font-weight: 500;
  color: white;
  flex: 1;
  font-size: 0.9em;
}

.selected-preview {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 2px 4px;
  background: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
}

.preview-color {
  width: 12px;
  height: 12px;
  border-radius: 2px;
  border: 1px solid rgba(255, 255, 255, 0.2);
}

.preview-name {
  font-size: 0.75em;
  color: #bdc3c7;
  font-weight: 400;
  white-space: nowrap;
}

.color-grid-wrapper {
  max-height: 300px;
  overflow-y: auto;
  overflow-x: hidden;
  margin-bottom: 8px;
  padding-right: 4px;
}

.color-grid-wrapper::-webkit-scrollbar {
  width: 6px;
}

.color-grid-wrapper::-webkit-scrollbar-track {
  background: rgba(255, 255, 255, 0.05);
  border-radius: 3px;
}

.color-grid-wrapper::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.2);
  border-radius: 3px;
}

.color-grid-wrapper::-webkit-scrollbar-thumb:hover {
  background: rgba(255, 255, 255, 0.3);
}

.color-grid {
  display: grid;
  grid-template-columns: repeat(15, 1fr);
  gap: 2px;
}

.color-item-box {
  width: 16px;
  height: 16px;
  border-radius: 2px;
  cursor: pointer;
  position: relative;
  border: 1px solid rgba(255, 255, 255, 0.1);
  transition: transform 0.15s ease;
}

.color-item-box:hover {
  transform: scale(1.15);
  z-index: 1;
}

.color-item-box.selected {
  border: 2px solid #1abc9c;
  transform: scale(1.15);
  z-index: 2;
}

.color-overlay {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 2px;
  background: rgba(0, 0, 0, 0.3);
  opacity: 0;
  transition: opacity 0.15s ease;
}

.color-item-box.selected .color-overlay {
  opacity: 1;
}

.check-icon {
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.5));
}

.color-picker-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-top: 6px;
  border-top: 1px solid rgba(255, 255, 255, 0.1);
  flex-shrink: 0;
  min-height: 32px;
}

.footer-left {
  display: flex;
  align-items: center;
  gap: 6px;
}

.clear-btn {
  border-radius: 4px;
}

.footer-actions {
  display: flex;
  gap: 4px;
}

.action-btn-footer {
  border-radius: 4px;
  min-width: 48px;
}

.color-tooltip {
  font-size: 0.75em;
  text-align: center;
  line-height: 1.2;
}
</style>
