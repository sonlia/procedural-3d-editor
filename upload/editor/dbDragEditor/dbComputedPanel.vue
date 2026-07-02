<script setup>
import { computed } from "vue";
import { currentSelectTreeNode } from "./hooks/useDbConfig";

// 列计算(生成列)元信息面板:名称 + 徽标 + 提示。
// 类型与表达式在画布区的 DbSqlEditor 中编辑(原子保存),此处不重复。
const name = computed(() => currentSelectTreeNode.value?.name || "");
</script>

<template>
  <div class="column no-wrap full-height bg-dark q-pa-md q-gutter-y-md">
    <q-input :model-value="name" label="列名" dark dense outlined readonly />

    <q-badge dark color="deep-purple-5" class="self-start">
      <q-icon name="functions" size="xs" class="q-mr-xs" />
      生成列 (GENERATED ALWAYS ... STORED)
    </q-badge>

    <div class="text-caption text-grey-6">
      列类型与计算表达式在左侧编辑区配置并保存。改名请在左侧数据库树右键「重命名」。
    </div>
  </div>
</template>

<style scoped></style>
