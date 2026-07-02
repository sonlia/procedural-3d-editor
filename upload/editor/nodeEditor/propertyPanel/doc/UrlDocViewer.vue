<template>
  <div class="url-doc-viewer column">
    <div v-if="docs.text" class="doc-summary q-pa-sm text-caption text-grey-3">
      {{ docs.text }}
    </div>
    <iframe v-if="docs.url" class="doc-iframe" :src="docs.url" frameborder="0" />
    <div v-else class="q-pa-md text-grey-5">暂无可嵌入的文档链接</div>
  </div>
</template>

<script setup>
defineProps({
  docs: {
    type: Object,
    default: () => ({})
  }
});
</script>

<style scoped>
.url-doc-viewer {
  width: 100%;
  height: 100%;
  min-height: 0;
}

.doc-iframe {
  flex: 1 1 0;
  width: 100%;
  height: 100%;
  min-height: 0;
  border: 0;
  background: #fff;
}

.doc-summary {
  white-space: pre-wrap;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
</style>
