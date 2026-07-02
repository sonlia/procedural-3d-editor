<template>
  <div class="column full-height bg-grey-10">
    <!-- 无选中任务时的空状态 -->
    <div v-if="!editingTask" class="col column items-center justify-center text-grey-6">
      <q-icon name="schedule" size="64px" class="q-mb-md" />
      <div class="text-subtitle1">请选择一个任务</div>
      <div class="text-caption">从左侧任务列表中选择或创建新任务</div>
    </div>

    <!-- 任务详情视图 -->
    <TaskDetail v-else-if="editMode === 'detail'" :task="editingTask" @edit="handleEdit" @run="handleRun"
      @update="handleUpdate" @refresh="handleRefresh" />

    <!-- 代码编辑视图 -->
    <TaskCodeEditor v-else-if="editMode === 'code'" :task="editingTask" @back="handleBack" @save="handleSave" />

    <!-- Graph 编辑视图：复用统一 nodeEditor -->
    <div v-else-if="editMode === 'graph'" class="col column">
      <q-bar dark class="bg-grey-10 col-auto">
        <q-btn dark dense flat icon="arrow_back" text-color="grey-7" @click="handleBack">
          <q-tooltip>返回</q-tooltip>
        </q-btn>
        <div class="text-subtitle2 q-mx-sm">{{ editingTask.name }}</div>

      </q-bar>
      <litegraphEditor class="col" :splitter-config="{ model: 20, limits: [15, 45] }" />
    </div>
  </div>
</template>

<script setup>
import { watch } from "vue";
import TaskDetail from "./TaskDetail.vue";
import TaskCodeEditor from "./TaskCodeEditor.vue";
import litegraphEditor from "src/components/editor/nodeEditor/components/litegraphEditor.vue";
import {
  editMode,
  editingTask,
  useSchedulerTree,
} from "../../leftWidget/scheduler/useSchedulerTree";

const {
  updateTask,
  loadTaskDetail,
  backToDetail,
  runTaskNow,
  activateTaskEditor,
} = useSchedulerTree();

// 编辑代码/Graph
const handleEdit = (mode) => {
  if (mode === "graph" && editingTask.value?.id) {
    activateTaskEditor(editingTask.value);
  }
  editMode.value = mode;
};

// 返回详情
const handleBack = () => {
  backToDetail();
};

// 保存
const handleSave = async (data) => {
  if (!editingTask.value) return;
  await updateTask(editingTask.value.id, data);
};

// 更新任务配置
const handleUpdate = async (data) => {
  if (!editingTask.value) return;
  await updateTask(editingTask.value.id, data);
};

// 立即执行
const handleRun = async () => {
  if (!editingTask.value) return;
  await runTaskNow(editingTask.value.id);
};

// 刷新详情
const handleRefresh = async () => {
  if (!editingTask.value) return;
  await loadTaskDetail(editingTask.value.id);
};
</script>
