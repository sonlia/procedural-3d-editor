<template>
  <div class="meta2d-editor column fit">
    <!-- 顶部导航栏 -->
    <meta2d-nav />

    <!-- 三栏布局 -->
    <div class="row col no-wrap overflow-hidden">
      <!-- 左侧图元列表 -->
      <meta2d-pen-list ref="penListRef" style="width: 280px; min-width: 280px" />

      <!-- 中间画布 -->
      <meta2d-canvas ref="canvasRef" class="col" style="min-width: 0" />

      <!-- 右侧属性面板 -->
      <meta2d-setting v-show="lockStatus === 0" style="width: 320px; min-width: 320px" />
    </div>
  </div>
</template>

<script setup>
defineOptions({ name: "Meta2dEditor" });
import { ref, onMounted, onBeforeUnmount } from "vue";
import meta2dNav from "./components/meta2dNav.vue";
import meta2dPenList from "./components/meta2dPenList.vue";
import meta2dCanvas from "./components/meta2dCanvas.vue";
import meta2dSetting from "./components/meta2dSetting.vue";
import { lockStatus } from "./composables/useMeta2dConfig.js";

// ==================== Refs ====================
const penListRef = ref(null);
const canvasRef = ref(null);

// ==================== 生命周期 ====================
onMounted(() => {
  console.log("[meta2dEditor] 组件已挂载");
});

onBeforeUnmount(() => {
  console.log("[meta2dEditor] 组件即将卸载");
});
</script>

<style scoped>
.meta2d-editor {
  background-color: #1e1e1e;
}
</style>
