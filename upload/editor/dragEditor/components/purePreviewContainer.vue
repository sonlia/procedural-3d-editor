<template>
  <uiContainer :show-mode-buttons="false">
    <PreviewCore
      ref="previewCoreRef"
      :data-source="codeData"
      @iframe-ready="onIframeReady"
    />
  </uiContainer>
</template>

<script setup>
import { ref, computed } from "vue";
import PreviewCore from "../preview/PreviewCore.vue";
import uiContainer from "./uiContainer.vue";
import { useProjectStore } from "src/stores/projectMange.js";

const _project = useProjectStore();
const previewCoreRef = ref(null);
const emits = defineEmits(["iframe-ready"]);

// 从 store 获取代码编辑器的数据
const codeData = computed(() => {
  return _project.getEditorData("code") || "";
});

const onIframeReady = (iframe) => {
  emits("iframe-ready", iframe);
};

defineExpose({
  getIframe: () => previewCoreRef.value?.getIframe?.(),
});
</script>

<style scoped>
</style>
