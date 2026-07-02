// frontend/src/components/editor/dragEditor/composables/useEditorTabs.js

import { ref, computed, reactive } from 'vue';

/**
 * 编辑器标签页管理
 *
 * 标签页类型：
 * - preview: 主编辑区（始终存在）
 * - slot: slot 编辑（已有功能，通过 pushSlotEdit 管理）
 * - behavior: 行为组件独立编辑（QDialog/QDrawer）
 * - hidden: 隐藏组件编辑（v-show/v-if）
 */

// 全局标签页状态（模块级别，跨组件共享）
const tabs = reactive([]);
const activeTabId = ref('preview');

export function useEditorTabs() {

  // 当前所有标签页（preview 始终在第一位）
  const allTabs = computed(() => [
    { id: 'preview', type: 'preview', label: 'preview', nodeId: null },
    ...tabs,
  ]);

  // 当前激活的标签页
  const activeTab = computed(() => {
    return allTabs.value.find(t => t.id === activeTabId.value) || allTabs.value[0];
  });

  // 添加标签页
  const addTab = ({ type, nodeId, label }) => {
    const id = `${type}-${nodeId}`;
    // 避免重复
    if (tabs.some(t => t.id === id)) return;

    tabs.push({ id, type, nodeId, label: label || id });
  };

  // 移除标签页
  const removeTab = (nodeId) => {
    const index = tabs.findIndex(t => t.nodeId === nodeId);
    if (index === -1) return;

    const removedId = tabs[index].id;
    tabs.splice(index, 1);

    // 如果移除的是当前激活的，切回 preview
    if (activeTabId.value === removedId) {
      activeTabId.value = 'preview';
    }
  };

  // 切换标签页
  const switchTab = (tabId) => {
    activeTabId.value = tabId;
  };

  // 清除所有非 preview 标签页
  const clearTabs = () => {
    tabs.length = 0;
    activeTabId.value = 'preview';
  };

  // 根据节点 ID 查找标签页
  const findTabByNodeId = (nodeId) => {
    return tabs.find(t => t.nodeId === nodeId);
  };

  return {
    allTabs,
    activeTab,
    activeTabId,
    addTab,
    removeTab,
    switchTab,
    clearTabs,
    findTabByNodeId,
  };
}
