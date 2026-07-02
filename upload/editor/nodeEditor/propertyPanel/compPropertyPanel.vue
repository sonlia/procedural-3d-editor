<template>
  <div class="comp-property-panel">
    <div v-if="groupedProps.length > 0" class="category-groups">
      <q-expansion-item v-for="group in groupedProps" :key="group.category" :label="group.category" dense default-closed
        header-class="category-header">
        <div class="category-content">
          <div v-for="item in group.items" :key="item.key" class="property-editor">
            <!-- 错误状态显示 -->
            <div v-if="editorErrors[item.key]" class="editor-error">
              <q-banner inline-actions class="text-white bg-negative" dense>
                <template #avatar>
                  <q-icon name="warning" color="white"  />
                </template>
                组件加载失败: {{ item.key }}
                <template #action>
                  <q-btn flat dense color="white" label="重试"  @click="retryLoad(item.key)" />
                </template>
              </q-banner>
            </div>

            <!-- 加载状态 -->
            <div v-else-if="loadingStates[item.key]" class="editor-loading">
              <q-skeleton type="QInput" dark height="32px" />
            </div>

            <!-- 正常组件渲染 -->
            <Suspense v-else>
              <template #default>
                <component :is="getEditorComponent(item.value.outType)" v-model="nodeData" :label="item.key"
                  :property-config="item.value" :key="`${item.key}-${retryCounts[item.key] || 0}`" dense />
              </template>

              <template #fallback>
                <q-skeleton type="QInput" dark height="32px" />
              </template>
            </Suspense>
          </div>
        </div>
      </q-expansion-item>
    </div>

    <div v-else class="no-properties">
      <q-icon name="settings" size="3em" color="grey-6" />
      <div class="text-caption text-grey-6 q-mt-sm">
        该组件暂无可配置属性
      </div>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from "vue";
import { useNodeData } from "./composables/useNodeData.js";
import { getPropertyEditorComponents } from "./propertyItem/componentImports.js";

// 接收节点数据
const nodeData = defineModel();

// 使用统一数据访问接口
const { propsDefinition, propsProperties } = useNodeData(nodeData);

// 错误状态和加载状态管理
const editorErrors = ref({});
const loadingStates = ref({});
const retryCounts = ref({});

// 错误处理回调
const handleComponentError = (componentName, error) => {
  editorErrors.value[componentName] = error;
};

// 获取组件映射
const componentMap = getPropertyEditorComponents(handleComponentError);

// 获取编辑器组件
const getEditorComponent = (outType) => {
  return componentMap[outType] || componentMap['inputItem'];
};

// 重试加载
const retryLoad = async (propKey) => {
  loadingStates.value[propKey] = true;
  editorErrors.value[propKey] = null;
  retryCounts.value[propKey] = (retryCounts.value[propKey] || 0) + 1;

  setTimeout(() => {
    loadingStates.value[propKey] = false;
  }, 500);
};

// 生成属性列表，合并定义和配置
const propsList = computed(() => {
  const definition = propsDefinition.value;
  const properties = propsProperties.value;

  if (!definition || Object.keys(definition).length === 0) {
    return [];
  }

  return Object.freeze(
    Object.entries(definition).map(([key, definitionValue]) => {
      // 获取对应的属性配置，如果不存在则使用默认值
      const propertyValue = properties[key] || {
        value: "",
        isSlot: false,
        outType: "inputItem"
      };

      return Object.freeze({
        key,
        value: {
          ...definitionValue,
          ...propertyValue
        }
      });
    })
  );
});

// 按 category 分组
const groupedProps = computed(() => {
  const list = propsList.value;
  if (list.length === 0) return [];

  const groups = {};

  list.forEach(item => {
    const category = item.value.category || '其他';
    if (!groups[category]) {
      groups[category] = [];
    }
    groups[category].push(item);
  });

  return Object.freeze(
    Object.entries(groups).map(([category, items]) =>
      Object.freeze({ category, items })
    )
  );
});
</script>

<style scoped>
.comp-property-panel {
  width: 100%;
  height: 100%;
  min-height: 200px;
}

.category-groups {
  width: 100%;
  height: 100%;
}

.category-groups :deep(.category-header) {
  min-height: 36px;
  padding: 4px 12px;
  font-weight: 500;
  font-size: 0.85em;
}

.category-content {
  padding: 4px 8px;
}

.no-properties {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
}

/* 属性编辑器样式 - 最小间距 */
.property-editor {
  width: 100%;
  margin-bottom: 2px;
  min-height: 32px;
}

/* 错误状态样式 */
.editor-error {
  padding: 0;
  margin: 0;
}

.editor-error .q-banner {
  font-size: 0.8em;
  padding: 4px 8px;
}

/* 加载状态样式 */
.editor-loading {
  padding: 0;
  margin: 0;
}

/* 深色主题优化 */
.property-editor :deep(.q-skeleton) {
  background: rgba(255, 255, 255, 0.05);
}
</style>
