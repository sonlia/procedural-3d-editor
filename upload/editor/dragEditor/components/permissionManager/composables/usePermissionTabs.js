import { ref } from 'vue';

/**
 * 权限管理 Tab 切换管理
 */
const activeTab = ref('org');

export function usePermissionTabs() {
  /**
   * 切换到指定 tab
   */
  const switchToTab = (tabName) => {
    activeTab.value = tabName;
  };

  /**
   * 获取当前激活的 tab
   */
  const getCurrentTab = () => {
    return activeTab.value;
  };

  return {
    activeTab,
    switchToTab,
    getCurrentTab
  };
}
