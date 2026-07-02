<script setup>
import { mergeProps, h, Fragment, withDirectives, vShow, Teleport, KeepAlive, Suspense, Transition, TransitionGroup } from "vue";
//<---importStr--->

const selectedNodeId = "<--selectedNodeId-->";
const _hasLayoutContext = "<--hasLayout-->" === "true";

//<---editorShared--->

// 有布局上下文时，QPage/QPageContainer 直接渲染（不作为占位符）
if (_hasLayoutContext) {
  EDITOR_BEHAVIOR_OVERRIDES.QPage = { mode: "forceRender" };
  EDITOR_BEHAVIOR_OVERRIDES.QPageContainer = { mode: "forceRender" };
}

// 标签页类行为组件（在 slotEditor 中不在主流显示，提取到独立区域）
const TAB_BEHAVIOR_COMPONENTS = ['QDialog', 'QDrawer'];

// 扩展 createEditorNode：弹窗组件用 wrapper div 包裹以便内联显示
const createNode = (tag, id, props, children) => {
  const tagName = getTagName(tag);
  const { __editorBehavior, __editorPreview, __editorStyle, __layoutPart, ...restProps } = props || {};
  const behavior = EDITOR_BEHAVIOR_OVERRIDES[tagName] || __editorBehavior;

  // 标签页类行为组件：用 wrapper div 包裹以便在 slotEditor 中内联显示
  if (!_hasLayoutContext
      && !__layoutPart
      && !(__editorPreview?.visibility === 'surrogate' || __editorPreview?.mode === 'surrogate')
      && behavior?.mode === 'forceRender'
      && behavior?.propsOverride?.['model-value'] !== undefined
      && TAB_BEHAVIOR_COMPONENTS.includes(tagName)) {
    const isEmpty = isChildrenEmpty(children);
    const forcedProps = { ...restProps, ...(behavior.propsOverride || {}) };
    return h('div', {
      nodeid: id,
      class: 'vs-edit-node vs-hidden-placeholder',
      'data-popup-type': tagName,
      'data-popup-label': tagName
    }, [
      h(tag, mergeProps(
        forcedProps,
        {
          class: isEmpty ? 'vs-empty-node vs-popup-content' : 'vs-popup-content',
          style: __editorStyle || undefined,
          ...(isEmpty ? { 'data-tag': tagName } : {})
        }
      ), children)
    ]);
  }
  return createEditorNode(tag, id, { __editorBehavior, __editorPreview, __editorStyle, __layoutPart, ...restProps }, children);
};

//<---replaceCode--->

/**
 * slotEditor 模式转换函数
 * 1. 过滤：只保留选中节点及其子节点
 * 2. 转换：将选中节点的 children（对象形式）展开为 slot 容器数组
 * 3. 提取弹窗组件：将弹窗类组件单独展示在弹窗编辑区域
 */
const transformForSlotEditor = (vnodes, targetId) => {
  if (!targetId || !Array.isArray(vnodes)) return vnodes;

  // 递归查找目标节点
  const findNode = (nodes) => {
    for (const node of nodes) {
      if (!node?.props) continue;

      if (node.props.nodeid === targetId) {
        return node;
      }

      // 搜索 children
      const children = node.children;
      if (!children) continue;

      if (Array.isArray(children)) {
        const found = findNode(children);
        if (found) return found;
      } else if (typeof children === "object") {
        // slots 对象形式
        for (const slotFn of Object.values(children)) {
          if (typeof slotFn === "function") {
            const slotChildren = slotFn();
            if (Array.isArray(slotChildren)) {
              const found = findNode(slotChildren);
              if (found) return found;
            }
          }
        }
      }
    }
    return null;
  };

  // 检查是否是标签页类行为组件（只提取这些，内联类保持原位）
  const isTabBehaviorComponent = (vnode) => {
    if (!vnode?.type) return false;
    const tagName = typeof vnode.type === 'string'
      ? vnode.type
      : (vnode.type.name || vnode.type.__name);
    return tagName && TAB_BEHAVIOR_COMPONENTS.includes(tagName);
  };

  // 从 children 中提取弹窗组件
  const extractPopups = (children) => {
    const popups = [];
    const normalChildren = [];

    if (Array.isArray(children)) {
      children.forEach(child => {
        if (isTabBehaviorComponent(child)) {
          popups.push(child);
        } else {
          normalChildren.push(child);
        }
      });
    }

    return { popups, normalChildren };
  };

  const targetNode = findNode(vnodes);
  if (!targetNode) return vnodes;

  // 检查目标节点的 children 是否是 slots 对象
  const children = targetNode.children;
  const containers = [];
  let allPopups = [];

  if (children && typeof children === "object" && !Array.isArray(children)) {
    // 展开 slots 为独立容器数组
    for (const [slotName, slotFn] of Object.entries(children)) {
      // 过滤掉 Vue 内部属性（以 _ 开头）和非函数类型
      if (slotName.startsWith("_") || typeof slotFn !== "function") {
        continue;
      }
      const slotChildren = slotFn();
      const slotChildrenArr = Array.isArray(slotChildren) ? slotChildren : [slotChildren];

      // 提取弹窗组件
      const { popups, normalChildren } = extractPopups(slotChildrenArr);
      allPopups = allPopups.concat(popups);

      containers.push(
        // 外层包装：包含标签 + 内容容器
        h("div", { class: "slot-editor-wrapper", style: { marginBottom: "8px" } }, [
          // slot 名称标签
          h("div", {
            class: "slot-editor-label",
            style: {
              fontSize: "10px",
              color: "#409EFF",
              marginBottom: "2px",
              fontWeight: "bold",
            },
          }, `slot: ${slotName}`),
          // slot 内容容器（不含弹窗组件）
          h(
            "div",
            {
              slot: slotName,
              nodeid: targetId,
              class: "vs-slot-container",
            },
            normalChildren
          ),
        ])
      );
    }
  }

  // 如果有弹窗组件，添加弹窗编辑区域
  if (allPopups.length > 0) {
    containers.push(
      h("div", { class: "vs-popup-editor-section" }, [
        h("div", { class: "vs-popup-editor-header" }, "弹窗组件"),
        h("div", { class: "vs-popup-editor-content" }, allPopups)
      ])
    );
  }

  // 没有 slots 也没有弹窗，返回目标节点本身
  if (containers.length === 0) {
    return [targetNode];
  }

  return containers;
};

// 包裹为渲染函数，Vue 会在响应式变化时重新调用，确保 ref 值能正确更新
const renderlist = () => {
  const rawList = "<--replaceData-->";
  const _transformed = transformForSlotEditor(rawList, selectedNodeId);
  return _hasLayoutContext
    ? h(QLayout, { view: "lHh Lpr lFf", class: "vs-full-height" }, {
        default: () => [h(QPageContainer, {}, {
          default: () => h(QPage, {}, { default: () => h(Fragment, null, _transformed) })
        })]
      })
    : h(Fragment, null, _transformed);
};
</script>

<template>
  <component :is="renderlist" />
</template>
<style scoped>
/* 本地 */
</style>
<style>
/* 编辑器基础样式 */
/* 全局 */
/* slotEditor 专属样式 */
.vs-slot-container {
  min-height: 60px !important;
  min-width: 60px !important;
  outline: 1px dashed #409EFF !important;
  outline-offset: -1px !important;
  border-radius: 4px;
  background: rgba(64, 158, 255, 0.05);
  box-sizing: border-box;
}
.vs-popup-editor-section {
  margin-top: 16px;
  border: 1px solid #E91E63;
  border-radius: 4px;
  overflow: hidden;
}
.vs-popup-editor-header {
  background: rgba(233, 30, 99, 0.1);
  color: #E91E63;
  font-size: 11px;
  font-weight: 600;
  padding: 6px 12px;
  border-bottom: 1px solid rgba(233, 30, 99, 0.2);
}
.vs-popup-editor-content {
  padding: 8px;
  background: rgba(233, 30, 99, 0.02);
}
.vs-popup-content {
  position: relative !important;
  display: block !important;
}
</style>
