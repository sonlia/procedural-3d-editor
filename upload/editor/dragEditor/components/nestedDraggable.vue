<template>
  <uiContainer ref="uiContainerRef" @displayModeChange="handleDisplayModeChange">
    <!-- 搜索组件 - 放在 uiContainer 内跟随画布移动 -->
    <indexWidget ref="searchWidgetRef" v-show="showSearch" :data="searchTreeData" @nodeSelected="handleNodeSelected"
      @hide="hideSearchWidget" :position="searchPosition" />

    <!-- 编辑器标签栏 - 仅在编辑模式且有额外标签时显示 -->
    <q-tabs
      v-if="allTabs.length > 1 && previewMode === 'preview'"
      v-model="activeTabId"
      dense dark
      inline-label
      :breakpoint="0"
      class="bg-grey-10"
      active-color="primary"
      indicator-color="primary"
    >
      <q-tab
        v-for="tab in allTabs"
        :key="tab.id"
        :name="tab.id"
        :label="tab.label"
        dense
      />
    </q-tabs>

    <PreviewCore class="fit" ref="previewRef" :mode="effectiveMode" :selected-node-id="effectiveSelectedNodeId"
      @iframe-ready="setupIframeListeners" />
  </uiContainer>
</template>

<script setup>
import {
  onMounted,
  ref,
  reactive,
  computed,
  onUnmounted,
  getCurrentInstance,
  watch,
} from "vue";
import uiContainer from "./uiContainer.vue";
import PreviewCore from "../preview/PreviewCore.vue";
import indexWidget from "src/components/searchWidget/indexWidget.vue";
import { graphNodesForSearchData } from "src/components/editor/nodeEditor/composables/useLitegraphEditor.js";

// === 使用极简composables ===
import { useSimpleInteraction, globalDisplayMode, globalSlotEditNodeId, selectedNodeId } from "src/components/editor/dragEditor/composables/useSimpleInteraction.js";
import { useEditorTabs } from '../composables/useEditorTabs.js';
import { useDragEditorData } from "../composables/useDragEditorData.js";
import { useProjectStore } from "src/stores/projectMange.js";
import { setPreviewIframe } from "../preview/previewUtils.js";

// === Props ===
// dragEditor 是可视化布局工具,默认只收 UI 组件 + 文件树自定义组件;场景可经 nodeScope 覆盖
const props = defineProps({
  nodeScope: {
    type: Object,
    default: () => ({ categories: ["ui"], includeTreePaths: ["tree/components"] }),
  },
});

// === 核心状态 ===
const showSearch = ref(false);
const searchTreeData = ref([]);
const searchPosition = reactive({ top: 100, left: 100 });

// 组件引用
const previewRef = ref();
const uiContainerRef = ref();
const searchWidgetRef = ref();



// 处理 uiContainer 的 displayMode 变化事件
const handleDisplayModeChange = (newMode) => {
  globalDisplayMode.value = newMode;
};

// === 初始化交互系统和数据操作 ===
const interaction = useSimpleInteraction(); // 无需传递 displayMode 参数
const { addToDragEditorRoot, addToComponentSlot, moveNodeToPosition, findElementById } = useDragEditorData();

// 从交互系统获取状态
const { clearSelection, clearSelectionUI } = interaction;

// === iframe事件监听器变量声明 ===
let iframeCleanup = null;

// === 预览模式计算 ===
const previewMode = computed(() => {
  switch (globalDisplayMode.value) {
    case 0: return "slotEditor";
    case 1: return "preview";
    case 2: return "production";
    default: return "preview";
  }
});

// === 编辑器标签页集成 ===
const { allTabs, activeTab, activeTabId, switchTab } = useEditorTabs();

// 如果有激活的标签页且不是 preview，覆盖为 slotEditor 模式
const effectiveMode = computed(() => {
  if (activeTabId.value !== 'preview' && previewMode.value === 'preview') {
    return 'slotEditor';
  }
  return previewMode.value;
});

// 标签页激活时，覆盖 selectedNodeId 为标签页对应的 nodeId
const effectiveSelectedNodeId = computed(() => {
  if (activeTabId.value !== 'preview' && activeTab.value?.nodeId) {
    return activeTab.value.nodeId;
  }
  return globalSlotEditNodeId?.value || null;
});

// 监听标签页切换，同步更新 globalSlotEditNodeId（PreviewCore 内部依赖此值）
watch(activeTabId, (newTabId) => {
  if (newTabId !== 'preview' && activeTab.value?.nodeId) {
    globalSlotEditNodeId.value = activeTab.value.nodeId;
  } else if (newTabId === 'preview') {
    globalSlotEditNodeId.value = null;
  }
});

// === 搜索上下文管理（原 useNodeSearch 功能内联） ===
let currentClickId = null;
let currentClickSlot = null;
let currentParentTag = null; // 保存当前点击的父节点 tag

const setClickContext = (nodeId, slot = "default") => {
  currentClickId = nodeId;
  currentClickSlot = slot;
};

const clearClickContext = () => {
  currentClickId = null;
  currentClickSlot = null;
  currentParentTag = null;
};

// === 搜索数据更新 ===
const updateSearchTreeData = () => {
  try {
    // 按场景 nodeScope + 父节点 tag 过滤
    searchTreeData.value = graphNodesForSearchData(props.nodeScope, currentParentTag) || [];
  } catch (error) {
    console.error("Error updating search tree data:", error);
    searchTreeData.value = [];
  }
};

// === 搜索处理 ===
const showSearchWidget = (nodeId, slotInfo = null, position = null) => {
  // 如果有slot信息且点击的是slot元素，使用slot名称；否则使用default
  const targetSlot = (slotInfo?.isSlot && slotInfo?.slotName) ? slotInfo.slotName : "default";
  setClickContext(nodeId, targetSlot);

  // 获取父节点的 tag
  if (nodeId && nodeId !== "app") {
    const _project = useProjectStore();
    const data = _project.getEditorData("dragEditor") || [];
    const parentElement = findElementById(data, nodeId);
    currentParentTag = parentElement?.tag || null;
  } else {
    currentParentTag = null;
  }

  // 更新搜索组件位置（如果传入了位置信息）
  if (position) {
    searchPosition.left = position.left;
    searchPosition.top = position.top;
    console.log('[showSearchWidget] Updated position:', { left: position.left, top: position.top });
  } else {
    console.log('[showSearchWidget] No position provided, using current:', { left: searchPosition.left, top: searchPosition.top });
  }

  updateSearchTreeData();
  showSearch.value = true;
};

const hideSearchWidget = () => {
  showSearch.value = false;
  clearClickContext();
};

const handleNodeSelected = (nodeType, selectedNode) => {
  console.log("🟡 handleNodeSelected 被调用:", { nodeType, selectedNode, currentClickId, currentClickSlot });
  try {
    let result = null;

    if (currentClickId === null) {
      // 添加到根级别
      console.log("🟡 添加到根级别");
      result = addToDragEditorRoot(nodeType);

    } else {
      // 添加到指定组件的slot
      console.log("🟡 添加到指定组件的slot:", { targetId: currentClickId, slot: currentClickSlot });
      result = addToComponentSlot(nodeType, currentClickId, currentClickSlot);

    }

    console.log("🟡 添加结果:", result);

    // 添加完成后清理状态
    clearClickContext();
    // 隐藏搜索框
    hideSearchWidget();
    return result;
  } catch (error) {
    console.error("🟡 添加节点失败:", error);
    clearClickContext();
    hideSearchWidget();
    return null;
  }
};

// 监听 globalDisplayMode 变化以进行调试和清理
watch(
  globalDisplayMode,
  (newMode, oldMode) => {
    // 切换到预览模式时清理状态
    if (newMode === 2) {
      // 预览模式
      // 隐藏搜索组件
      hideSearchWidget();

      // 清理交互选择状态
      clearSelection();
    }

    // 切换到槽编辑模式时清理 UI 状态（保留 selectedNodeId）
    if (newMode === 0) {
      // 隐藏搜索组件
      hideSearchWidget();

      // 只清理 UI 状态（工具栏、样式类），保留 selectedNodeId
      // 因为 DOM 会重新渲染，旧的 DOM 引用需要清理
      clearSelectionUI();
    }

    // 从槽编辑模式切换回编辑模式时也要清理 UI 状态
    if (oldMode === 0 && newMode === 1) {
      clearSelectionUI();
      globalSlotEditNodeId.value = null;
    }
  },
  { immediate: true },
);

// === iframe事件监听器设置 ===

// 拖拽节点移动处理函数
const handleNodeMove = (sourceNodeId, targetNodeId, position, targetSlot = null, targetElement = null) => {
  try {
    const success = moveNodeToPosition(sourceNodeId, targetNodeId, position, targetSlot);

    if (!success) {
      console.error("❌ Failed to move node in data layer");
    }

    return success;
  } catch (error) {
    console.error("❌ Error in handleNodeMove:", error);
    return false;
  }
};

const setupIframeListeners = (iframe) => {
  console.log('🔗 setupIframeListeners 被调用:', { iframe, hasContentWindow: !!(iframe && iframe.contentWindow) });

  if (!iframe || !iframe.contentWindow) {
    console.warn('⚠️ iframe 或 contentWindow 不存在');
    return;
  }

  // 注册 iframe 引用到 previewUtils（供 selectNodeById 等函数使用）
  setPreviewIframe(iframe);

  // 清理之前的监听器
  if (iframeCleanup) {
    iframeCleanup();
  }

  // 绑定交互事件（传入 hideSearchWidget 回调，当 iframe 内部点击时会自动隐藏搜索框）
  console.log('✅ 开始绑定 iframe 事件监听器');
  iframeCleanup = interaction.bindIframe(iframe, showSearchWidget, handleNodeMove, hideSearchWidget);
  console.log('✅ iframe 事件监听器绑定完成');
};


// === 全局事件处理 ===
onMounted(() => {
  // 键盘事件处理 - ESC 键隐藏搜索框（使用捕获阶段，无论焦点在哪都能响应）
  const handleKeyDown = (event) => {
    // ESC 键隐藏搜索框
    if (event.key === "Escape" && showSearch.value) {
      hideSearchWidget();
      // 阻止事件继续传播，避免其他 ESC 处理
      event.preventDefault();
      event.stopPropagation();
    } else if (event.key !== "Escape") {
      // 其他键由交互系统处理
      interaction.handleKeyDown(event, showSearchWidget);
    }
  };

  // 点击/鼠标按下外部隐藏搜索框（使用 mousedown 更可靠）
  const handleClickOutside = (event) => {
    // 只有当搜索框显示时才处理
    if (!showSearch.value) return;

    // 获取搜索组件的 DOM 元素
    const searchWidgetEl = searchWidgetRef.value?.$el;
    if (!searchWidgetEl) return;

    // 检查点击是否在搜索组件外部
    const isClickInside = searchWidgetEl.contains(event.target);

    // 如果点击在外部，隐藏搜索框
    if (!isClickInside) {
      // 使用 setTimeout 确保在下一个事件循环中执行，避免与其他点击事件冲突
      setTimeout(() => {
        hideSearchWidget();
      }, 0);
    }
  };

  // 使用捕获阶段监听键盘事件，确保最先响应
  document.addEventListener("keydown", handleKeyDown, true);
  // 使用 mousedown 而不是 click，因为 mousedown 更早触发且不会被某些元素拦截
  document.addEventListener("mousedown", handleClickOutside, false);

  // 清理函数
  const cleanup = () => {
    document.removeEventListener("keydown", handleKeyDown, true);
    document.removeEventListener("mousedown", handleClickOutside, false);
  };

  getCurrentInstance().scope.stop = cleanup;
});

onUnmounted(() => {
  if (iframeCleanup) {
    iframeCleanup();
  }

  const instance = getCurrentInstance();
  if (instance?.scope?.stop) {
    instance.scope.stop();
  }
});

// === 暴露组件接口 ===
defineExpose({
  showSearch,
  selectedNodeId,
  setupIframeListeners,
  hideSearchWidget,
});
</script>

<style scoped>
/* 无需额外样式，所有样式都动态注入到iframe中 */
</style>
