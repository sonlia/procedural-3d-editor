<script setup>
import { ref, computed, watch } from "vue";
import api from "../../../services/api.js";
import {
  currentSelectTreeNode,
  currentGraphId,
} from "./hooks/useDbConfig";
import { dbTreeManager } from "./hooks/useDbTreeManager";

const manager = dbTreeManager();

// 视图元信息(SQL 定义/类型/定时刷新均在画布区 DbSqlEditor 中处理)
const viewName = computed(() => currentSelectTreeNode.value?.name || "");
const isMaterialized = computed(
  () => currentSelectTreeNode.value?.type === manager.NODE_TYPES.MATERIALIZED_VIEW,
);
const viewComment = ref("");
const loading = ref(false);

watch(
  () => currentSelectTreeNode.value?.id,
  () => {
    const t = currentSelectTreeNode.value?.type;
    if (t === manager.NODE_TYPES.VIEW || t === manager.NODE_TYPES.MATERIALIZED_VIEW) {
      loadViewInfo();
    }
  },
  { immediate: true },
);

// 仅加载注释等元信息(定义不在此面板编辑)
const loadViewInfo = async () => {
  viewComment.value = "";
  if (!currentGraphId.value || !viewName.value) return;

  loading.value = true;
  try {
    const response = await api.get("/api/db/views", {
      params: { serverDbId: currentGraphId.value },
    });
    if (response.data.success) {
      const view = response.data.data.find((v) => v.name === viewName.value);
      if (view) viewComment.value = view.comment || "";
    }
  } catch (error) {
    console.error("加载视图信息失败:", error);
  } finally {
    loading.value = false;
  }
};
</script>

<template>
  <div class="column no-wrap full-height bg-dark q-pa-md q-gutter-y-md scroll">
    <q-input :model-value="viewName" label="视图名称" dark dense outlined readonly />

    <q-badge dark :color="isMaterialized ? 'teal' : 'light-blue'" class="self-start">
      <q-icon :name="isMaterialized ? 'dataset' : 'visibility'" size="xs" class="q-mr-xs" />
      {{ isMaterialized ? "物化视图" : "普通视图" }}
    </q-badge>

    <q-input
      v-model="viewComment"
      label="注释"
      dark
      dense
      outlined
      autogrow
      type="textarea"
      readonly
      input-style="min-height: 48px"
    />

    <div class="text-caption text-grey-6">
      SQL 定义、视图类型、{{ isMaterialized ? "定时刷新与立即刷新" : "预览与 AI 生成" }}均在左侧编辑区操作。改名请在数据库树右键「重命名」。
    </div>
  </div>
</template>

<style scoped></style>
