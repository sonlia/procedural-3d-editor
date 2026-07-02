<script setup>
import { computed, onMounted, triggerRef, toRefs, watch, ref } from "vue";

const nodeData = defineModel();
const data = computed(() => {
  if (!nodeData.value?.properties?.methods) {
    getMethods().forEach((element) => {
      init(element);
    });
  }

  return nodeData.value?.properties?.methods;
});
// 初始化逻辑移到 onMounted 钩子中

const getMethods = () => {
  return Object.keys(nodeData.value?.nodeRawData?.methods || {});
};
// 定义一个方法来处理切换事件
function init(key) {
  // 快速失败检查
  if (!nodeData.value) {
    console.error('NodeData is null, cannot init method');
    return;
  }

  try {
    // 确保 nodeData.value 是对象
    if (typeof nodeData.value !== 'object' || Array.isArray(nodeData.value)) {
      console.error('NodeData.value is not an object, cannot init method');
      return;
    }

    // 确保 properties 存在
    if (!nodeData.value.properties) {
      nodeData.value.properties = {};
    }

    // 确保 methods 存在
    if (!nodeData.value.properties.methods) {
      nodeData.value.properties.methods = {};
    }

    // 初始化 method key
    if (!nodeData.value.properties.methods[key]) {
      nodeData.value.properties.methods[key] = false;
    }
  } catch (error) {
    console.error(`Error initializing method ${key}:`, error);
  }
}
</script>

<template>
  <div class="methods-panel">
    <div v-for="s in getMethods()" :key="s" class="method-item">
      <div class="method-header">
        <q-badge
          class="method-name"
          :label="s"
          outline
          color="grey-5"
        >
          <q-tooltip :delay="500" class="bg-grey-9 text-grey-3">
            {{ nodeData?.nodeRawData?.methods[s]?.desc_cn }}
          </q-tooltip>
        </q-badge>
      </div>

      <div v-if="nodeData?.nodeRawData?.methods[s].params" class="params-container">
        <q-badge
          v-for="(value, key) of nodeData?.nodeRawData?.methods[s].params"
          :key="key"
          class="param-badge"
          rounded
          color="grey-7"
          text-color="grey-3"
          :label="key"
        >
          <q-tooltip :delay="500" class="bg-grey-9 text-grey-3">
            <div class="param-tooltip">
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
.methods-panel {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 4px 0;
}

.method-item {
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 6px 8px;
  background: rgba(255, 255, 255, 0.02);
  border-radius: 4px;
  border-left: 2px solid rgba(255, 255, 255, 0.15);
  transition: all 0.2s ease;
}

.method-item:hover {
  background: rgba(255, 255, 255, 0.04);
  border-left-color: rgba(255, 255, 255, 0.3);
}

.method-header {
  display: flex;
  align-items: center;
}

.method-name {
  font-size: 11px;
  font-weight: 500;
  letter-spacing: 0.3px;
  padding: 2px 8px;
  text-transform: uppercase;
}

.params-container {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding-left: 12px;
}

.param-badge {
  font-size: 10px;
  padding: 1px 6px;
  font-weight: 500;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: all 0.2s ease;
}

.param-badge:hover {
  transform: translateY(-1px);
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.4);
}

.param-tooltip {
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
