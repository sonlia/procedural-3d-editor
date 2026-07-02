<template>
  <div class="cron-editor">
    <!-- 编辑模式切换 -->
    <div class="row items-center q-mb-sm">
      <q-btn-toggle v-model="editMode" flat dense toggle-color="primary" :options="[
        { label: '可视化', value: 'visual' },
        { label: '表达式', value: 'text' }
      ]" class="text-caption" />
      <q-space />
      <!-- 预设快捷选项 -->
      <q-btn-dropdown
        dark
        flat
        dense
        label="常用"
        color="grey-8"
        content-class="bg-grey-10 text-white"
      >
        <q-list dark dense class="bg-grey-10 text-white">
          <q-item v-for="preset in presets" :key="preset.value" clickable v-close-popup
            @click="applyPreset(preset.value)">
            <q-item-section>
              <q-item-label>{{ preset.label }}</q-item-label>
              <q-item-label caption>{{ preset.value }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-btn-dropdown>
    </div>

    <!-- 可视化编辑器 -->
    <div v-show="editMode === 'visual'" class="visual-editor q-pa-sm bg-grey-9 rounded-borders">
      <CronQuasar v-model="localValue" :disabled="disabled" :button-props="buttonProps" locale="zh-CN"
        @error="handleError" />
    </div>

    <!-- 文本编辑器 -->
    <div v-show="editMode === 'text'" class="row items-center">
      <q-input v-model="localValue" dark dense outlined class="col" placeholder="Cron 表达式 (如: 0 2 * * *)"
        :error="!!error" :error-message="error" :disable="disabled" @blur="validateAndEmit" />
      <q-btn flat dense icon="check" color="green" size="sm" class="q-ml-xs" :disable="disabled"
        @click="validateAndEmit" />
    </div>

    <!-- 下次执行时间 -->
    <div v-if="nextRunTime && !error" class="text-caption text-green q-mt-xs">
      <q-icon name="schedule" class="q-mr-xs" />
      下次执行: {{ formatDate(nextRunTime) }}
    </div>
    <div v-else-if="error" class="text-caption text-red q-mt-xs">
      <q-icon name="error_outline" class="q-mr-xs" />
      {{ error }}
    </div>
  </div>
</template>

<script setup>
import { ref, watch, computed, onMounted } from "vue";
import { CronQuasar } from "@vue-js-cron/quasar";

const props = defineProps({
  modelValue: { type: String, default: "" },
  disabled: { type: Boolean, default: false },
  nextRunTime: { type: [Date, String], default: null },
});

const emit = defineEmits(["update:modelValue", "change", "error"]);

// 编辑模式
const editMode = ref("visual");

// 本地值
const localValue = ref(props.modelValue || "* * * * *");

// 错误信息
const error = ref("");

// 按钮样式
const buttonProps = {
  dark: true,
  flat: true,
  dense: true,
  color: "grey-8",
  textColor: "white",
  size: "sm",
  class: "cron-select-btn",
};

// 常用预设
const presets = [
  { label: "每分钟", value: "* * * * *" },
  { label: "每5分钟", value: "*/5 * * * *" },
  { label: "每小时", value: "0 * * * *" },
  { label: "每天凌晨", value: "0 0 * * *" },
  { label: "每天早8点", value: "0 8 * * *" },
  { label: "每周一早9点", value: "0 9 * * 1" },
  { label: "每月1号", value: "0 0 1 * *" },
  { label: "工作日早9点", value: "0 9 * * 1-5" },
];

// 应用预设
const applyPreset = (value) => {
  localValue.value = value;
  error.value = "";
  emitChange();
};

// 处理错误
const handleError = (err) => {
  error.value = err || "";
  emit("error", err);
};

// 验证并触发更新
const validateAndEmit = () => {
  // 简单的 cron 验证（5 个或 6 个字段）
  const parts = localValue.value.trim().split(/\s+/);
  if (parts.length < 5 || parts.length > 6) {
    error.value = "无效的 Cron 表达式（需要 5-6 个字段）";
    emit("error", error.value);
    return;
  }
  error.value = "";
  emitChange();
};

// 触发变更
const emitChange = () => {
  emit("update:modelValue", localValue.value);
  emit("change", localValue.value);
};

// 格式化日期
const formatDate = (date) => {
  if (!date) return "-";
  const d = new Date(date);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// 监听 props 变化
watch(() => props.modelValue, (newVal) => {
  if (newVal !== localValue.value) {
    localValue.value = newVal || "* * * * *";
  }
});

// 监听本地值变化
watch(localValue, (newVal) => {
  if (editMode.value === "visual") {
    emitChange();
  }
});

onMounted(() => {
  if (!props.modelValue) {
    localValue.value = "* * * * *";
  }
});
</script>

<style scoped>
.cron-editor {
  width: 100%;
}

.visual-editor :deep(.q-btn) {
  font-size: 12px;
}

.visual-editor :deep(.cron-segment) {
  margin-bottom: 8px;
}

.visual-editor :deep(.cron-select-btn) {
  background: #424242;
  color: #fff;
}

.visual-editor :deep(.q-menu) {
  background: #212121;
  color: #fff;
}

.visual-editor :deep(.q-menu .q-item),
.visual-editor :deep(.q-menu .q-item__label) {
  color: #fff;
}

.visual-editor :deep(.q-menu .q-item--active),
.visual-editor :deep(.q-menu .q-item:hover) {
  background: #424242;
  color: #fff;
}

:global(.q-menu.q-position-engine.scroll) {
  background: #212121;
  color: #fff;
}

:global(.q-menu.q-position-engine.scroll .q-item),
:global(.q-menu.q-position-engine.scroll .q-item__label) {
  color: #fff;
}

:global(.q-menu.q-position-engine.scroll .q-item--active),
:global(.q-menu.q-position-engine.scroll .q-item:hover) {
  background: #424242;
  color: #fff;
}
</style>
