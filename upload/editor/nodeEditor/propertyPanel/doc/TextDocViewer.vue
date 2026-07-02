<template>
  <div class="text-doc-viewer q-pa-md">
    <div v-if="docs.text" class="text-body2 text-grey-2 doc-text">{{ docs.text }}</div>
    <div v-else class="text-grey-5">暂无帮助内容</div>
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
.text-doc-viewer {
  min-height: 100%;
}

.doc-text {
  white-space: pre-wrap;
  line-height: 1.7;
}
</style>
