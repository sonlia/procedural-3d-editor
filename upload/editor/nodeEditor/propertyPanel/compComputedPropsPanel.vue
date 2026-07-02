<template>
  <div class="comp-computed-props-panel">
    <div v-for="s in getComputedProps()" :key="s" class="computed-prop-item">
      <div class="computed-prop-header">
        <q-badge class="computed-prop-name" :label="s" outline color="grey-5">
          <q-tooltip :delay="500" class="bg-grey-9 text-grey-3">
            {{ nodeData?.nodeRawData?.computedProps[s]?.desc_cn }}
          </q-tooltip>
        </q-badge>
      </div>
    </div>

    <!-- 无计算属性状态 -->
    <div v-if="getComputedProps().length === 0" class="no-computed-props">
      <q-icon name="functions" color="grey-6" />
      <div class="text-caption text-grey-6 q-mt-xs">
        暂无计算属性配置
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";

const nodeData = defineModel();

// 获取所有计算属性名称
const getComputedProps = () => {
  return Object.keys(nodeData.value?.nodeRawData?.computedProps || {});
};

// 初始化逻辑（保持与 compMethodsPanel 一致）
const data = computed(() => {
  if (!nodeData.value?.properties?.computedProps) {
    getComputedProps().forEach((element) => {
      init(element);
    });
  }
  return nodeData.value?.properties?.computedProps;
});

function init(key) {
  if (!nodeData.value) {
    console.error('NodeData is null, cannot init computed prop');
    return;
  }

  try {
    if (typeof nodeData.value !== 'object' || Array.isArray(nodeData.value)) {
      console.error('NodeData.value is not an object, cannot init computed prop');
      return;
    }

    if (!nodeData.value.properties) {
      nodeData.value.properties = {};
    }

    if (!nodeData.value.properties.computedProps) {
      nodeData.value.properties.computedProps = {};
    }

    if (!nodeData.value.properties.computedProps[key]) {
      nodeData.value.properties.computedProps[key] = false;
    }
  } catch (error) {
    console.error(`Error initializing computed prop ${key}:`, error);
  }
}
</script>

<style scoped>
.comp-computed-props-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.computed-prop-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  border-left: 2px solid rgba(255, 255, 255, 0.15);
  transition: all 0.2s ease;
}

.computed-prop-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-left-color: rgba(255, 255, 255, 0.3);
}

.computed-prop-header {
  display: flex;
  align-items: center;
}

.computed-prop-name {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
  padding: 2px 8px;
  text-transform: uppercase;
}

.no-computed-props {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 24px 16px;
  text-align: center;
  opacity: 0.5;
}
</style>
