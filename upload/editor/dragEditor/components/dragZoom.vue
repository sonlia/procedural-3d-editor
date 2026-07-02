<template>
  <div ref="test">
    <slot></slot>
  </div>
</template>
<script setup>
import {
  ref,
  onMounted,
  onUnmounted,
  nextTick,
} from "vue";
import Panzoom from "@panzoom/panzoom";

const test = ref();
const panzoom = ref();
const reset = () => {
  panzoom.value?.reset();
};
defineExpose({ reset });

onUnmounted(() => {
  panzoom.value?.destroy();
});

onMounted(async () => {
  // 等待 DOM 完全渲染
  await nextTick();

  // 确保元素已挂载到 DOM
  if (!test.value || !document.body.contains(test.value)) {
    console.warn("[dragZoom] 元素未挂载到 DOM，跳过 Panzoom 初始化");
    return;
  }

  panzoom.value = Panzoom(test.value, {
    maxScale: 5,
    handleStartEvent: () => { },
    disablePan: true,
    cursor: "default",
  });

  // 鼠标滚轮缩放
  test.value.parentElement.addEventListener("wheel", function (event) {
    panzoom.value.zoomWithWheel(event);
  });

  const startPan = (event) => {
    if (event.button !== 2) return;
    event.preventDefault();
    panzoom.value.setOptions({
      disablePan: false,
      disableZoom: true,
      cursor: "move",
      handleStartEvent: (event) => {
        event.preventDefault();
      },
    });
    panzoom.value.handleDown(event);
  };

  const endPan = (event) => {
    if (event.button !== 2) return;
    panzoom.value.setOptions({
      disablePan: true,
      disableZoom: false,
      cursor: "default",
    });
  };

  // 鼠标右键拖动平移
  test.value.parentElement.addEventListener("pointerdown", startPan);
  test.value.addEventListener("pointerdown", startPan);
  test.value.parentElement.addEventListener("pointerup", endPan);
  test.value.addEventListener("pointerup", endPan);

  // 禁用右键菜单
  test.value.parentElement.addEventListener("contextmenu", (event) => {
    event.preventDefault();
  });
});
</script>
<style scoped></style>
