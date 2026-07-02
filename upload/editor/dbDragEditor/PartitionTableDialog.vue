<script setup>
import { ref, computed, onMounted } from "vue";
import { useDialogPluginComponent } from "quasar";
import api from "../../../services/api.js";
import {
  PARTITION_STRATEGIES,
  canAutoManage,
  canUsePartman,
} from "./hooks/useDbPartitionManager";

const props = defineProps({
  serverDbId: { type: String, default: "" },
  projectId: { type: [String, Number], default: "" },
});

defineEmits([...useDialogPluginComponent.emits]);

const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } =
  useDialogPluginComponent();

// 建表时仅系统字段可作分区键（id 为整数，created_at/updated_at 为时间戳）
const KEY_OPTIONS = [
  { value: "id", label: "id (整数)", isInteger: true },
  { value: "created_at", label: "created_at (时间戳)", isInteger: false },
  { value: "updated_at", label: "updated_at (时间戳)", isInteger: false },
];

// 时间分区粒度（auto 时间键用）
const TIME_UNITS = [
  { value: "hour", label: "按小时" },
  { value: "day", label: "按天" },
  { value: "week", label: "按周" },
  { value: "month", label: "按月" },
  { value: "year", label: "按年" },
];

const tableName = ref("");
const strategy = ref("range");
const key = ref("created_at");
const manage = ref("auto");

// auto / partman 共用的配置
const timeUnit = ref("month"); // time 键：粒度
const idStep = ref(100000); // id 键：数值步长
const partmanInterval = ref("1 month"); // partman：原样 interval
const premake = ref(4);
const retention = ref("");
const retentionKeepTable = ref(true);
const cron = ref("0 1 * * *");

// 后端探测能力
const partmanAvailableInDb = ref(false);
const cronAvailable = ref(false);

onMounted(async () => {
  if (!props.serverDbId) return;
  try {
    const { data } = await api.get(`/api/db/capabilities`, {
      params: { serverDbId: props.serverDbId, projectId: props.projectId },
    });
    partmanAvailableInDb.value = !!data?.data?.partmanAvailable;
    cronAvailable.value = !!data?.data?.cronAvailable;
  } catch {
    /* 探测失败按不可用处理 */
  }
});

const keyIsInteger = computed(
  () => KEY_OPTIONS.find((k) => k.value === key.value)?.isInteger || false
);

// 自动(内置)是否可用：仅 RANGE
const autoEnabled = computed(() => canAutoManage(strategy.value));
// partman 是否可用：DB 装了扩展 且 策略/键支持
const partmanEnabled = computed(
  () => partmanAvailableInDb.value && canUsePartman(strategy.value, keyIsInteger.value)
);

const manageOptions = computed(() => [
  { value: "auto", label: "自动(内置)", disable: !autoEnabled.value },
  { value: "manual", label: "手动" },
  { value: "partman", label: "pg_partman", disable: !partmanEnabled.value },
]);

// 策略/键变化时，若当前管理方式不可用则回退
const onConstraintChange = () => {
  if (manage.value === "auto" && !autoEnabled.value) manage.value = "manual";
  if (manage.value === "partman" && !partmanEnabled.value) {
    manage.value = autoEnabled.value ? "auto" : "manual";
  }
};

const canSubmit = computed(() => !!tableName.value.trim());

const onSubmit = () => {
  const partition = { strategy: strategy.value, key: key.value, manage: manage.value };

  if (manage.value === "auto") {
    partition.auto = {
      interval: keyIsInteger.value ? String(idStep.value) : timeUnit.value,
      premake: Number(premake.value) || 4,
      retention: retention.value || "",
      retentionKeepTable: retentionKeepTable.value,
      cron: cron.value,
    };
  } else if (manage.value === "partman") {
    partition.partman = {
      interval: partmanInterval.value,
      premake: Number(premake.value) || 4,
      retention: retention.value || "",
      retentionKeepTable: retentionKeepTable.value,
      cron: cron.value,
    };
  }
  onDialogOK({ name: tableName.value.trim(), partition });
};
</script>

<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card dark class="bg-dark" style="min-width: 400px">
      <q-card-section class="q-pb-none">
        <div class="text-subtitle1 text-white">新建分区表</div>
      </q-card-section>

      <q-card-section class="q-gutter-y-sm">
        <q-input v-model="tableName" label="表名" dark dense outlined autofocus />

        <q-select v-model="strategy" :options="PARTITION_STRATEGIES" label="分区策略" dark dense outlined
          emit-value map-options @update:model-value="onConstraintChange">
          <template #option="scope">
            <q-item v-bind="scope.itemProps">
              <q-item-section>
                <q-item-label>{{ scope.opt.label }}</q-item-label>
                <q-item-label caption>{{ scope.opt.desc }}</q-item-label>
              </q-item-section>
            </q-item>
          </template>
        </q-select>

        <q-select v-model="key" :options="KEY_OPTIONS" label="分区键" dark dense outlined emit-value map-options
          @update:model-value="onConstraintChange" />

        <q-option-group v-model="manage" :options="manageOptions" color="primary" dark dense inline />
        <div v-if="!autoEnabled" class="text-caption text-orange-4">
          自动(内置)仅支持 RANGE；LIST/HASH 请用手动管理。
        </div>

        <!-- 自动(内置) 配置 -->
        <template v-if="manage === 'auto'">
          <q-select v-if="!keyIsInteger" v-model="timeUnit" :options="TIME_UNITS" label="分区粒度" dark dense
            outlined emit-value map-options />
          <q-input v-else v-model.number="idStep" type="number" label="数值步长" dark dense outlined
            hint="每个分区覆盖的 id 数量，如 100000" />
          <q-input v-model.number="premake" type="number" label="预建数量 (premake)" dark dense outlined />
          <q-input v-model="retention" label="保留策略 (可选)" dark dense outlined
            :hint="keyIsInteger ? '保留最近 N 个 id，如 500000' : '如 3 months，留空则不清理'" />
          <q-toggle v-model="retentionKeepTable" label="清理时保留表（仅解除继承，不删表）" dark dense />
          <q-input v-model="cron" label="维护频率 (cron · 全局共享)" dark dense outlined
            :hint="cronAvailable ? '所有自动分区表共用一个 pg_cron 维护任务,此处会更新该全局频率' : '未检测到 pg_cron(需装在宿主库,默认 postgres),仅能手动维护'" />
          <div v-if="!cronAvailable" class="text-caption text-orange-4">
            未检测到 pg_cron，分区表仍会创建，但需手动点「立即维护」。
          </div>
        </template>

        <!-- partman 配置 -->
        <template v-else-if="manage === 'partman'">
          <q-input v-model="partmanInterval" label="分区间隔" dark dense outlined
            hint="如 1 month / 1 day（整数键填数值区间）" />
          <q-input v-model.number="premake" type="number" label="预建数量 (premake)" dark dense outlined />
          <q-input v-model="retention" label="保留策略 (可选)" dark dense outlined hint="如 3 months，留空则不清理" />
          <q-toggle v-model="retentionKeepTable" label="清理时保留表" dark dense />
          <q-input v-model="cron" label="维护频率 (cron · 全局共享)" dark dense outlined hint="所有 partman 分区表共用一个 pg_cron 维护任务(run_maintenance_proc),此处会更新该全局频率" />
        </template>
      </q-card-section>

      <q-card-actions align="right">
        <q-btn flat dense label="取消" color="grey" @click="onDialogCancel" />
        <q-btn flat dense label="创建" color="primary" :disable="!canSubmit" @click="onSubmit" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
