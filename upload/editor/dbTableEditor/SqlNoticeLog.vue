<script setup>
import { computed } from "vue";

// 展示 PostgreSQL RAISE NOTICE/LOG 输出(后端 runSqlWithNotices 捕获)
const props = defineProps({
  notices: { type: Array, default: () => [] },
});

// 按 severity 上色
const severityColor = (severity) => {
  const s = (severity || "").toUpperCase();
  if (s === "WARNING" || s === "EXCEPTION") return "text-orange-4";
  if (s === "INFO" || s === "DEBUG") return "text-light-blue-4";
  return "text-grey-5"; // NOTICE / LOG / 其他
};

const items = computed(() => props.notices || []);
</script>

<template>
  <div class="sql-notice-log column no-wrap full-height bg-dark text-white">
    <div v-if="items.length" class="col scroll q-pa-xs">
      <div
        v-for="(n, i) in items"
        :key="i"
        class="sql-notice-log__line row no-wrap items-start q-gutter-x-xs"
      >
        <span :class="['text-caption', 'text-bold', severityColor(n.severity)]">
          {{ (n.severity || "NOTICE").toUpperCase() }}
        </span>
        <span class="text-caption text-grey-3 sql-notice-log__msg">{{ n.message }}</span>
      </div>
    </div>
    <div v-else class="col flex flex-center text-caption text-grey-6">无日志</div>
  </div>
</template>

<style scoped>
.sql-notice-log {
  min-height: 0;
}
.sql-notice-log__line {
  padding: 1px 0;
  font-family: monospace;
}
.sql-notice-log__msg {
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
