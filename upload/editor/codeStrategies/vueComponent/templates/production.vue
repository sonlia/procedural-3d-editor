<script setup>
import { h, Fragment, withDirectives, vShow, Teleport, KeepAlive, Suspense, Transition, TransitionGroup } from "vue";
//<---importStr--->

const createNode = (tag, id, props, children) => {
  const {
    __editorStyle,
    __editorBehavior,
    __editorPreview,
    __editorLabel,
    __gridLayout,
    __gridConfig,
    __layoutNode,
    __layoutPart,
    ...restProps
  } = props || {};
  return h(tag, restProps, children);
};

const createLayoutPart = (type, layoutId, slotName, style, children, editorClass) => {
  const className = (editorClass || "")
    .split(/\s+/)
    .filter(name => name && !name.startsWith("vs-layout-"))
    .join(" ");
  return h("div", { style, ...(className ? { class: className } : {}) }, children);
};

//<---replaceCode--->

const renderlist = () => h(Fragment, null, "<--replaceData-->");
</script>

<template>
  <component :is="renderlist" />
</template>
<style scoped>
/* 本地 */
</style>
<style>
/* 全局 */
</style>
