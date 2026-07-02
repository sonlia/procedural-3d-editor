<template>
  <BasePropertyPanel v-model="selectNode" code-filename="node-data.json" class="default-node-panel">
    <div class="property-panel-tabs">
      <q-tabs v-model="activeTab" class="tabs-white" dense inline-label :breakpoint="0">
        <q-tab v-for="panel in availablePanels" :key="panel.key" :name="panel.key" :label="panel.name"
          class="q-pa-none">
          <q-tooltip v-if="panel.description" :delay="1000">
            {{ panel.description }}
          </q-tooltip>
        </q-tab>
      </q-tabs>
      <q-separator />
    </div>
    <KeepAlive>
      <q-tab-panels v-model="activeTab" class="property-panel-panels" dark>
        <q-tab-panel v-for="panel in availablePanels" :key="panel.key" :name="panel.key" class="property-panel-item">
          <Suspense>
            <template #default>
              <q-scroll-area style="height: 100%; width: 100%;">
                <component :is="panelComponents[panel.component]" v-model="selectNode" :key="panel.key" />
              </q-scroll-area>
            </template>
            <template #fallback>
              <div class="panel-loading">
                <q-spinner-dots size="2em" color="teal" />
                <div class="text-caption q-mt-sm">加载中...</div>
              </div>
            </template>
          </Suspense>
        </q-tab-panel>
      </q-tab-panels>
    </KeepAlive>
  </BasePropertyPanel>

  <!-- 文档对话框 -->
  <DocDialog v-if="hasDocUrl" v-model="showDocDialog" :url="selectNode?.nodeRawData?.meta?.docsUrl"
    :component-name="selectNode?.nodeRawData?.tag" />
</template>

<script setup>
import { defineAsyncComponent, computed, ref } from "vue";
import { usePropertyPanels } from "./composables/usePropertyPanels.js";
import BasePropertyPanel from "./BasePropertyPanel.vue";
import DocDialog from "./doc/DocDialog.vue";
import { copyToClipboard, Notify } from "quasar";

// 懒加载面板组件
const panelComponents = {
  compPropertyPanel: defineAsyncComponent(() =>
    import('./compPropertyPanel.vue')
  ),
  textStyle: defineAsyncComponent(() =>
    import('./compStylePanel.vue')
  ),
  compEventsPanel: defineAsyncComponent(() =>
    import('./compEventsPanel.vue')
  ),
  compMethodsPanel: defineAsyncComponent(() =>
    import('./compMethodsPanel.vue')
  ),
  compSlotsPanel: defineAsyncComponent(() =>
    import('./compSlotsPanel.vue')
  ),
  compComputedPropsPanel: defineAsyncComponent(() =>
    import('./compComputedPropsPanel.vue')
  ),
  compEnhancePanel: defineAsyncComponent(() =>
    import('./compEnhancePanel.vue')
  ),
  layoutPanel: defineAsyncComponent(() =>
    import('../node/webNode/layout/LayoutPanel.vue')
  ),
};

// 接收选中的节点
const selectNode = defineModel();

// 节点 ID
const nodeId = computed(() => selectNode.value?.id || "N/A");

// 是否有文档 URL
const hasDocUrl = computed(() => !!selectNode.value?.nodeRawData?.meta?.docsUrl);

// 状态
const showDocDialog = ref(false);

// 复制节点 ID
const copyNodeId = async () => {
  const id = nodeId.value;
  if (id === "N/A") return;

  try {
    await copyToClipboard(id);
    Notify.create({
      type: "positive",
      message: "节点 ID 已复制",
      position: "top",
      timeout: 1500
    });
  } catch (error) {
    Notify.create({
      type: "negative",
      message: "复制失败",
      position: "top",
      timeout: 1500
    });
  }
};

// 节点标题
const nodeTitle = computed({
  get: () => selectNode.value?.title || "",
  set: (value) => {
    if (selectNode.value) {
      selectNode.value.title = value;
    }
  }
});

// 使用面板状态管理
const {
  activeTab,
  availablePanels,

} = usePropertyPanels(selectNode);

</script>

<style scoped>
/* 覆盖 BasePropertyPanel 的滚动样式，使用 tab-panels 自己的滚动 */
.default-node-panel :deep(.base-property-content) {
  overflow: visible;
}

/* 节点 ID 显示区域 */
.node-id-bar {
  background-color: rgba(255, 255, 255, 0.05);
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.property-panel-tabs {
  background-color: var(--q-dark, #1d1d1d);
}

/* Tab 字体颜色 - 浅白色 */
.tabs-white :deep(.q-tab__label) {
  color: rgba(255, 255, 255, 0.7);
}

.tabs-white :deep(.q-tab--active .q-tab__label) {
  color: rgba(255, 255, 255, 0.95);
}

.tabs-white :deep(.q-tab__indicator) {
  background-color: rgba(255, 255, 255, 0.8);
}

.property-panel-panels {
  height: 100%;
  background: transparent;
}

.property-panel-item {
  padding: 8px;
  min-height: calc(100% - 16px);
}

.panel-loading {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px;
  color: var(--q-primary, #1976d2);
}

/* 响应式设计 */
@media (max-width: 600px) {
  .property-panel-item {
    padding: 4px;
  }
}

/* 节点 ID 显示区域 */
.node-id-display {
  cursor: pointer;
  user-select: none;
}
</style>
