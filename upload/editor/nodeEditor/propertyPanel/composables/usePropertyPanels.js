import { ref, computed, shallowRef, watch } from "vue";
import { useNodeData } from "./useNodeData.js";

/**
 * 属性面板状态管理组合函数
 * 集中管理所有面板的状态和配置
 */
export function usePropertyPanels(nodeData) {
  const activeTab = ref("property");

  // 使用 shallowRef 优化大对象性能
  const nodeDataRef = shallowRef(nodeData);

  // 使用统一数据访问接口
  const { hasDefinition, hasProperties } = useNodeData(nodeDataRef);

  // 是否是 Layout 节点（meta.isLayoutNode === true）
  const isLayoutNode = computed(
    () => !!nodeData.value?.nodeRawData?.meta?.isLayoutNode,
  );

  // 面板配置定义
  const panelConfigs = computed(() => ({
    layout: {
      name: "布局",
      component: "layoutPanel",
      visible: isLayoutNode.value,
      icon: "view_quilt",
      description: "Flex / Grid 区域布局",
    },
    property: {
      name: "属性",
      component: "compPropertyPanel",
      visible: hasDefinition("props"),
      icon: "settings",
      description: "组件属性配置",
    },
    style: {
      name: "样式",
      component: "textStyle",
      visible: true, // 样式面板总是可用
      icon: "palette",
      description: "样式和外观配置",
    },
    events: {
      name: "事件",
      component: "compEventsPanel",
      visible: hasDefinition("events"),
      icon: "bolt",
      description: "事件监听配置",
    },

    slot: {
      name: "槽",
      component: "compSlotsPanel",
      visible: hasDefinition("slots") && !isLayoutNode.value,
      icon: "view_module",
      description: "插槽内容配置",
    },
    methods: {
      name: "方法",
      component: "compMethodsPanel",
      visible: hasDefinition("methods"),
      icon: "code",
      description: "组件方法调用",
    },
    computedProps: {
      name: "计算属性",
      component: "compComputedPropsPanel",
      visible: hasDefinition("computedProps"),
      icon: "functions",
      description: "计算属性配置",
    },
    enhance: {
      name: "增强",
      component: "compEnhancePanel",
      visible: true, // 所有节点都可用
      icon: "auto_awesome",
      description: "条件渲染和内建组件包裹配置",
    },
  }));

  // 可用的面板列表（只显示有数据的面板）
  const availablePanels = computed(() => {
    return Object.entries(panelConfigs.value)
      .filter(([key, config]) => config.visible)
      .map(([key, config]) => ({ key, ...config }));
  });

  // 切换节点时智能切换 activeTab：
  //  - 当前 tab 已不可用 → 切到第一个可用面板
  //  - 切换到 Layout 节点 → 优先打开"布局"面板
  watch(() => nodeData.value?.id, () => {
    const visibleKeys = availablePanels.value.map((p) => p.key);
    if (isLayoutNode.value && visibleKeys.includes("layout")) {
      activeTab.value = "layout";
    } else if (!visibleKeys.includes(activeTab.value)) {
      activeTab.value = visibleKeys[0] || "property";
    }
  }, { immediate: true });

  // 当前激活面板的配置
  const activePanelConfig = computed(() => {
    return panelConfigs.value[activeTab.value] || null;
  });

  // 切换面板
  const switchToPanel = (panelKey) => {
    if (panelConfigs.value[panelKey]?.visible) {
      activeTab.value = panelKey;
    }
  };

  // 检查面板是否有未保存的更改
  const hasUnsavedChanges = computed(() => {
    // 这里可以添加检查逻辑
    return false;
  });

  return {
    // 状态
    activeTab,
    panelConfigs,
    availablePanels,
    activePanelConfig,
    hasUnsavedChanges,

    // 方法

    switchToPanel,

    // 数据访问
    nodeData: nodeDataRef,
  };
}
