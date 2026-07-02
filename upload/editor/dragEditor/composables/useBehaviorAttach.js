import { computed } from 'vue';
import { uiTypeByTag } from '../../nodeEditor/node/uiNode/quasar/index.js';
// frontend/src/components/editor/dragEditor/composables/useBehaviorAttach.js

/**
 * 行为附加系统 - 常量与核心逻辑
 *
 * 行为附加让用户通过属性面板"给组件添加菜单/提示/对话框"，
 * 底层自动处理嵌套关系，用户无需关心 DOM 结构。
 */

// 内联显示的行为组件（在 preview 中 forceRender + 边缘标识）
export const INLINE_BEHAVIORS = ['QMenu', 'QTooltip', 'QPopupEdit', 'QPopupProxy'];

// 标签页显示的行为组件（在 preview 中不显示，独立标签页编辑）
export const TAB_BEHAVIORS = ['QDialog', 'QDrawer'];

// 所有可附加的行为
export const ALL_BEHAVIORS = [...INLINE_BEHAVIORS, ...TAB_BEHAVIORS];

// 行为定义（用于 UI 按钮组和默认配置）
export const BEHAVIOR_DEFINITIONS = {
  QMenu: {
    label: '菜单',
    icon: 'menu',
    display: 'inline',
    defaultConfig: { contextMenu: false },
  },
  QTooltip: {
    label: '提示',
    icon: 'chat_bubble_outline',
    display: 'inline',
    defaultConfig: {},
  },
  QPopupEdit: {
    label: '弹出编辑',
    icon: 'edit',
    display: 'inline',
    defaultConfig: {},
  },
  QPopupProxy: {
    label: '弹出代理',
    icon: 'open_in_new',
    display: 'inline',
    defaultConfig: {},
  },
  QDialog: {
    label: '对话框',
    icon: 'picture_in_picture',
    display: 'tab',
    defaultConfig: { persistent: false },
  },
  QDrawer: {
    label: '侧边栏',
    icon: 'vertical_split',
    display: 'tab',
    defaultConfig: {},
  },
};

// 右键菜单是 QMenu 的变体
export const CONTEXT_MENU_CONFIG = { contextMenu: true };

/**
 * 判断组件类型是否是行为组件
 */
export function isBehaviorComponent(tagName) {
  return ALL_BEHAVIORS.includes(tagName);
}

/**
 * 判断组件类型的显示方式
 * @returns {'inline' | 'tab' | null}
 */
export function getBehaviorDisplay(tagName) {
  if (INLINE_BEHAVIORS.includes(tagName)) return 'inline';
  if (TAB_BEHAVIORS.includes(tagName)) return 'tab';
  return null;
}

/**
 * 行为附加 composable
 * @param {Ref} nodeData - 当前选中的节点数据 (defineModel)
 * @param {Object} dragEditorApi - useDragEditorData 的返回值
 * @param {Object} editorTabsApi - useEditorTabs 的返回值 (可选，标签页类型需要)
 */
export function useBehaviorAttach(nodeData, dragEditorApi, editorTabsApi) {

  // 确保 enhance.behaviors 结构存在
  const ensureBehaviorsStructure = () => {
    if (!nodeData.value?.properties) return;
    if (!nodeData.value.properties.enhance) {
      nodeData.value.properties.enhance = {};
    }
    if (!nodeData.value.properties.enhance.behaviors) {
      nodeData.value.properties.enhance.behaviors = { items: [] };
    }
  };

  // 当前节点已附加的行为列表
  const attachedBehaviors = computed(() => {
    return nodeData.value?.properties?.enhance?.behaviors?.items || [];
  });

  // 添加行为
  const addBehavior = (behaviorType) => {
    if (!nodeData.value || !BEHAVIOR_DEFINITIONS[behaviorType]) return null;
    if (!dragEditorApi?.addToComponentSlot) return null;

    ensureBehaviorsStructure();

    const parentId = nodeData.value.id;
    const definition = BEHAVIOR_DEFINITIONS[behaviorType];
    const isTab = definition.display === 'tab';

    // 行为按钮用裸 tag(QMenu/QDialog…)标识,但 LiteGraph 注册键是 treePath/id;
    // 必须解析成注册键再交给 addToComponentSlot,否则 getNodeConf 拿不到节点类、添加在插入前就抛错(表现为"点了没反应")
    const nodeType = uiTypeByTag[behaviorType];
    if (!nodeType) {
      console.warn(`[useBehaviorAttach] 未找到行为组件 ${behaviorType} 的注册类型,无法添加`);
      return null;
    }

    // 1. 通过 dragEditorApi 创建子节点
    //    内联行为不 skipSelect —— 复用 addNodes 渲染后自动选中 + 高亮,让用户立刻看到边缘标识;
    //    标签页行为 skipSelect,改由下方 switchTab 切到其独立编辑标签页
    const newNode = dragEditorApi.addToComponentSlot(
      nodeType,
      parentId,
      'default',
      { skipSelect: isTab }
    );

    if (!newNode) return null;

    // 2. 记录行为元数据
    const behaviorItem = {
      id: `bhv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type: behaviorType,
      nodeId: newNode.id,
      display: definition.display,
      config: { ...definition.defaultConfig },
    };
    nodeData.value.properties.enhance.behaviors.items.push(behaviorItem);

    // 3. 标签页类型：创建并切换到独立编辑标签页(标签 id 格式见 useEditorTabs.addTab)
    if (isTab && editorTabsApi) {
      editorTabsApi.addTab({
        type: behaviorType,
        nodeId: newNode.id,
        label: `${definition.label}`,
      });
      editorTabsApi.switchTab(`${behaviorType}-${newNode.id}`);
    }

    return behaviorItem;
  };

  // 删除行为
  const removeBehavior = (behaviorId) => {
    ensureBehaviorsStructure();
    const items = nodeData.value.properties.enhance.behaviors.items;
    const index = items.findIndex(b => b.id === behaviorId);
    if (index === -1) return;

    const behavior = items[index];

    // 1. 从 schema 中删除对应节点（useDragEditorData 导出的是 removeElement）
    if (dragEditorApi?.removeElement) {
      dragEditorApi.removeElement(behavior.nodeId);
    }

    // 2. 删除标签页（如有）
    if (behavior.display === 'tab' && editorTabsApi) {
      editorTabsApi.removeTab(behavior.nodeId);
    }

    // 3. 移除元数据
    items.splice(index, 1);
  };

  // 检测已有子节点中未纳入管理的行为组件
  // 接受 schema 数据作为参数（因为 getDragEditorData 未导出）
  const detectUnmanagedBehaviors = (schemaData) => {
    if (!nodeData.value || !schemaData) return [];

    const managedNodeIds = new Set(attachedBehaviors.value.map(b => b.nodeId));
    const unmanaged = [];

    // 递归查找当前节点的 children
    const findNodeChildren = (nodes, targetId) => {
      for (const node of nodes) {
        if (node.id === targetId) return node.children;
        if (node.children) {
          const children = Array.isArray(node.children)
            ? node.children
            : Object.values(node.children).flat();
          const found = findNodeChildren(children, targetId);
          if (found) return found;
        }
      }
      return null;
    };

    const children = findNodeChildren(schemaData, nodeData.value.id);
    if (!children) return [];

    const childList = Array.isArray(children)
      ? children
      : Object.values(children).flat();

    for (const child of childList) {
      // schema 里 child.type 是注册键(treePath/id),child.tag 才是 QMenu 这类裸 tag —— 按 tag 匹配
      if (child && ALL_BEHAVIORS.includes(child.tag) && !managedNodeIds.has(child.id)) {
        unmanaged.push({ type: child.tag, nodeId: child.id });
      }
    }

    return unmanaged;
  };

  // 将已有的未管理行为纳入管理
  const adoptBehavior = (nodeId, type) => {
    ensureBehaviorsStructure();
    const definition = BEHAVIOR_DEFINITIONS[type];
    if (!definition) return;

    const behaviorItem = {
      id: `bhv-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      type,
      nodeId,
      display: definition.display,
      config: { ...definition.defaultConfig },
    };
    nodeData.value.properties.enhance.behaviors.items.push(behaviorItem);

    if (definition.display === 'tab' && editorTabsApi) {
      editorTabsApi.addTab({ type, nodeId, label: definition.label });
    }
  };

  return {
    attachedBehaviors,
    addBehavior,
    removeBehavior,
    detectUnmanagedBehaviors,
    adoptBehavior,
    BEHAVIOR_DEFINITIONS,
  };
}
