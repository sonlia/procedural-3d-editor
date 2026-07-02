<script setup>
import { mergeProps, h, Fragment, withDirectives, vShow, Teleport, KeepAlive, Suspense, Transition, TransitionGroup } from "vue";
//<---importStr--->

const _hasLayoutContext = "<--hasLayout-->" === "true";

//<---editorShared--->

// 有布局上下文时，QPage/QPageContainer 直接渲染（不作为占位符）
if (_hasLayoutContext) {
  EDITOR_BEHAVIOR_OVERRIDES.QPage = { mode: "forceRender" };
  EDITOR_BEHAVIOR_OVERRIDES.QPageContainer = { mode: "forceRender" };
}

// 标签页类行为组件（不在 preview 主流中显示）
const TAB_BEHAVIOR_COMPONENTS = ['QDialog', 'QDrawer'];

// 包装 createEditorNode：标签页类行为组件在主流中显示占位
const createNode = (tag, id, props, children) => {
  const { __editorBehavior, __editorPreview, __hiddenType, __layoutPart, ...restProps } = props || {};

  // 标签页类行为组件（QDialog/QDrawer）：在主流中显示占位 div
  const tagName = typeof tag === 'string' ? tag : (tag.name || tag.__name || '');
  if (!_hasLayoutContext
      && !__layoutPart
      && !(__editorPreview?.visibility === 'surrogate' || __editorPreview?.mode === 'surrogate')
      && TAB_BEHAVIOR_COMPONENTS.includes(tagName)
      && __editorBehavior?.mode === 'forceRender'
      && __editorBehavior?.propsOverride?.['model-value'] !== undefined) {
    return h('div', {
      nodeid: id,
      class: 'vs-edit-node vs-hidden-placeholder',
      'data-hidden-type': tagName,
      'data-tag': tagName,
    });
  }

  // v-show/v-if 隐藏组件：在已有编辑节点基础上追加半透明样式
  if (__hiddenType) {
    const editorVnode = createEditorNode(tag, id, { __editorBehavior, __editorPreview, __layoutPart, ...restProps }, children);
    if (editorVnode?.props) {
      editorVnode.props = mergeProps(editorVnode.props, {
        class: 'vs-hidden-placeholder',
        'data-hidden-type': __hiddenType,
      });
    }
    return editorVnode;
  }

  return createEditorNode(tag, id, props, children);
};

const createLayoutPart = (type, layoutId, slotName, style, children, editorClass) => {
  const metaProps = type === "split"
    ? {}
    : { slot: slotName, nodeid: layoutId };
  return h("div", {
    ...metaProps,
    class: editorClass || `vs-layout-${type}`,
    style,
  }, children);
};

//<---replaceCode--->

// 包裹为渲染函数，Vue 会在响应式变化时重新调用，确保 ref 值能正确更新
// QPage 是块级容器，子元素按正常文档流排列（inline 组件如 QBtn 不会被撑满整行）
const renderlist = () => {
  const _vnodes = "<--replaceData-->";
  return _hasLayoutContext
    ? h(QLayout, { view: "lHh Lpr lFf", class: "vs-full-height" }, {
        default: () => [h(QPageContainer, {}, {
          default: () => h(QPage, {}, { default: () => h(Fragment, null, _vnodes) })
        })]
      })
    : h(Fragment, null, _vnodes);
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
</style>
