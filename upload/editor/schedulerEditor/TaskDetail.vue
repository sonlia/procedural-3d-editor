<template>
  <div class="column full-height">
    <!-- 工具栏 -->
    <div class="row items-center q-pa-sm bg-grey-9">
      <div class="text-subtitle2 q-mr-auto">{{ task.name }}</div>
      <q-btn flat dense icon="play_arrow" color="green" @click="$emit('run')">
        <q-tooltip>立即执行</q-tooltip>
      </q-btn>
      <q-btn v-if="!task.codeModified" flat dense icon="account_tree" color="purple" @click="$emit('edit', 'graph')">
        <q-tooltip>Graph 编排</q-tooltip>
      </q-btn>
      <q-btn flat dense icon="code" @click="$emit('edit', 'code')">
        <q-tooltip>编辑代码</q-tooltip>
      </q-btn>
      <q-btn flat dense icon="refresh" @click="$emit('refresh')">
        <q-tooltip>刷新</q-tooltip>
      </q-btn>
    </div>

    <q-scroll-area class="col">
      <div class="q-pa-md">
        <!-- 基本信息卡片 -->
        <q-card flat bordered dark class="q-mb-md">
          <q-card-section>
            <div class="text-subtitle2 q-mb-sm">基本信息</div>
            <div class="row q-col-gutter-md">
              <div class="col-12">
                <div class="text-caption text-grey-5 q-mb-xs">Cron 表达式</div>
                <CronEditor
                  v-model="cronExpression"
                  :next-run-time="cronValidation.nextRunTime"
                  @change="handleCronChange"
                  @error="handleCronError"
                />
              </div>
              <div class="col-12 col-md-6">
                <div class="text-caption text-grey-5">状态</div>
                <div class="row items-center q-mt-xs">
                  <q-badge :color="statusColor" :label="statusLabel" class="q-mr-sm" />
                  <q-btn-toggle
                    v-model="taskStatus"
                    flat
                    dense
                    toggle-color="primary"
                    :options="statusOptions"
                    @update:model-value="handleStatusChange"
                  />
                </div>
              </div>
              <div class="col-12 col-md-6">
                <div class="text-caption text-grey-5">并发策略</div>
                <q-select
                  v-model="concurrencyPolicy"
                  :options="concurrencyOptions"
                  dark
                  dense
                  outlined
                  emit-value
                  map-options
                  class="q-mt-xs"
                  @update:model-value="handleConcurrencyChange"
                />
              </div>
              <div class="col-12">
                <div class="text-caption text-grey-5">备注</div>
                <q-input
                  v-model="remark"
                  dark
                  dense
                  outlined
                  type="textarea"
                  rows="2"
                  class="q-mt-xs"
                  @blur="handleRemarkChange"
                />
              </div>
            </div>
          </q-card-section>
        </q-card>

      </div>
    </q-scroll-area>
  </div>
</template>

<script setup>
import { ref, computed, watch } from "vue";
import { useSchedulerTree } from "../../leftWidget/scheduler/useSchedulerTree";
import CronEditor from "./CronEditor.vue";

const props = defineProps({
  task: { type: Object, required: true },
});

const emit = defineEmits(["edit", "run", "update", "refresh"]);

const { validateCron } = useSchedulerTree();

// 表单数据
const cronExpression = ref("");
const taskStatus = ref("stopped");
const concurrencyPolicy = ref("skip");
const remark = ref("");
const cronValidation = ref({ isValid: false, nextRunTime: null });

const statusOptions = [
  { label: "停止", value: "stopped" },
  { label: "运行", value: "running" },
];

const concurrencyOptions = [
  { label: "跳过（正在执行时跳过新触发）", value: "skip" },
  { label: "排队（等待当前执行完成）", value: "queue" },
  { label: "并行（同时执行多个实例）", value: "parallel" },
];

const statusColor = computed(() => {
  const colors = { running: "green", paused: "orange", stopped: "grey" };
  return colors[props.task.status] || "grey";
});

const statusLabel = computed(() => {
  const labels = { running: "运行中", paused: "已暂停", stopped: "已停止" };
  return labels[props.task.status] || "未知";
});

// 初始化
const initForm = () => {
  cronExpression.value = props.task.cronExpression || "";
  taskStatus.value = props.task.status || "stopped";
  concurrencyPolicy.value = props.task.concurrencyPolicy || "skip";
  remark.value = props.task.remark || "";

  // 验证 cron
  if (cronExpression.value) {
    validateCronExpression();
  }
};

// 验证 cron 表达式
const validateCronExpression = async () => {
  if (!cronExpression.value) {
    cronValidation.value = { isValid: false, nextRunTime: null };
    return;
  }
  cronValidation.value = await validateCron(cronExpression.value);
};

// 处理 cron 变更
const handleCronChange = async () => {
  await validateCronExpression();
  if (cronValidation.value.isValid || !cronExpression.value) {
    emit("update", { cronExpression: cronExpression.value || null });
  }
};

// 处理 cron 错误
const handleCronError = (err) => {
  if (err) {
    cronValidation.value = { isValid: false, nextRunTime: null };
  }
};

// 处理状态变更
const handleStatusChange = (value) => {
  emit("update", { status: value });
};

// 处理并发策略变更
const handleConcurrencyChange = (value) => {
  emit("update", { concurrencyPolicy: value });
};

// 处理备注变更
const handleRemarkChange = () => {
  emit("update", { remark: remark.value });
};

// 监听任务变化
watch(() => props.task, () => {
  initForm();
}, { immediate: true });
</script>
