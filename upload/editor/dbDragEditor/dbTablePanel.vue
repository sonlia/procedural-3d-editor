<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useDbMetadata } from "./hooks/useDbMetadata";
import { QTable, QBtn, QIcon, useQuasar } from "quasar";
import DbFieldsPanel from "./dbFieldsPanel.vue";
import { uid } from "quasar";
import { defineAsyncComponent } from "vue";
import {
  useDbConfig,
  client,
  currentSelectTreeNode,
} from "./hooks/useDbConfig";
import { graphIns } from "./hooks/useDbGraphEditor.js";
import {
  JOIN_TYPE_OPTIONS,
  DEFAULT_JOIN_TYPE,
} from "./hooks/useDbJoinManager.js";
import {
  useDbPartitionManager,
  PARTITION_STRATEGIES,
} from "./hooks/useDbPartitionManager.js";

const $q = useQuasar();

// 获取数据库元数据
const {
  getFieldTypes,
  defaultValueTypes,
  getConstraintTypes,
  getIndexTypes,
  getCharsetCollationOptions,
  getDefaultDbConfig,
} = useDbMetadata();

const dbConfig = useDbConfig();

// 临时值
const tempValue = ref("");

// 索引更新触发器，用于强制计算属性重新计算
const indexUpdateTrigger = ref(0);

// 更新临时值
const updateTemp = (value) => {
  tempValue.value = value;
};

// 更新最终值
const updateFinalValue = (path, event) => {
  if (tempValue.value !== undefined) {
    dbConfig.updateConfig(`${path}`, tempValue.value);

    tempValue.value = "";

    // 如果是回车事件，让当前元素失去焦点
    if (event?.type === "keyup") {
      event.target.blur();
    }
  }
};

// 字段列表 - 使用计算属性与当前表ID关联
const fields = computed(() => dbConfig.getConfig("fieldList") || []);

// 索引列表 - 添加触发器依赖，使其能够响应强制刷新
const tableIndexes = computed(() => {
  indexUpdateTrigger.value;
  return dbConfig.getConfig("indexes") || [];
});

// 字段选项列表 - 用于下拉选择框
const fieldOptions = computed(() => {
  const excludeFields = tableIndexes.value.map((x) => x.id);
  const data = fields.value
    .map((field) => ({
      label: field.name,
      value: field.id,
    }))
    .filter((x) => !excludeFields.includes(x.value)).filter(c => c.label != "id");
  return data;
});



// 根据字段ID获取字段名称
const getFieldNameById = (fieldId) => {
  if (!fieldId) return "";
  const field = fields.value.find((f) => f.id === fieldId);
  return field ? field.name : "";
};

// 添加新索引
const addNewIndex = () => {
  const currentIndexes = dbConfig.getConfig("indexes") || [];
  const newIndex = {
    id: "",
    unique: false,
    sort: "ASC",
  };

  // 通过配置直接更新
  dbConfig.updateConfig("indexes", [...currentIndexes, newIndex]);
  indexUpdateTrigger.value++;

  // 显示成功提示
  $q.notify({
    color: "positive",
    position: "top",
    message: "已添加新索引",
    icon: "check",
  });
};

// 更新索引字段
const updateIndexField = (index, fieldId) => {

  index.id = fieldId;
  dbConfig.updateConfig("indexes", [...tableIndexes.value]);
};



// 删除索引
const deleteIndex = (idx) => {
  const currentIndexes = [...tableIndexes.value];
  currentIndexes.splice(idx, 1);
  dbConfig.updateConfig("indexes", currentIndexes);

  // 显示删除成功提示
  $q.notify({
    color: "info",
    position: "top",
    message: "已删除索引",
    icon: "delete",
  });
};

// ─── JOIN 关联（从 LiteGraph links 实时获取 slot in 的连接信息） ───
const tableJoins = computed(() => {
  const tableId = currentSelectTreeNode.value?.id;
  if (!tableId || !graphIns.value) return [];

  const node = graphIns.value.getNodeById(tableId);
  if (!node?.inputs) return [];

  const result = [];
  for (const input of node.inputs) {
    if (input.link == null) continue;

    const link = graphIns.value.links[input.link];
    if (!link) continue;

    const sourceNode = graphIns.value.getNodeById(link.origin_id);
    if (!sourceNode) continue;

    const sourceSlot = sourceNode.outputs?.[link.origin_slot];
    const joinType = node.properties.joinTypes?.[input.id] || DEFAULT_JOIN_TYPE;

    result.push({
      slotId: input.id,
      joinType,
      sourceTableName: sourceNode.title,
      sourceFieldName: sourceSlot?.name || "",
      targetFieldName: input.name,
    });
  }
  return result;
});

const onJoinTypeChange = (slotId, type) => {
  const tableId = currentSelectTreeNode.value?.id;
  if (!tableId || !graphIns.value) return;

  const node = graphIns.value.getNodeById(tableId);
  if (!node) return;

  if (!node.properties.joinTypes) {
    node.properties.joinTypes = {};
  }
  node.properties.joinTypes[slotId] = type;
  graphIns.value.change();
};

// ─── 分区管理 ───
const {
  partitionInfo,
  fetchInfo,
  addPartition,
  dropPartition,
  updatePartitionConfig,
  setSchedule,
  runMaintenance,
} = useDbPartitionManager();

// 表切换时刷新分区信息
watch(
  () => currentSelectTreeNode.value?.id,
  () => fetchInfo(),
  { immediate: true }
);

const strategyLabel = computed(() => {
  const s = PARTITION_STRATEGIES.find((x) => x.value === partitionInfo.value.strategy);
  return s ? s.label : partitionInfo.value.strategy;
});

// 托管方式标签
const manageLabel = computed(() => {
  if (partitionInfo.value.managedBy === "partman") return "pg_partman";
  if (partitionInfo.value.managedBy === "native") return "自动(内置)";
  return "手动";
});
const isAutoManaged = computed(() => !!partitionInfo.value.managedBy);

// 配置/定时本地编辑
const retentionInput = ref("");
const premakeInput = ref(4);
const cronInput = ref("");
watch(
  () => partitionInfo.value,
  (info) => {
    retentionInput.value = info?.config?.retention || "";
    premakeInput.value = info?.config?.premake ?? 4;
    cronInput.value = info?.maintainCron || "";
  },
  { immediate: true, deep: true }
);
const saveConfig = () =>
  updatePartitionConfig({
    retention: retentionInput.value,
    premake: Number(premakeInput.value) || 4,
    retentionKeepTable: true,
  });
const saveSchedule = () => {
  if (cronInput.value) setSchedule(cronInput.value);
};

// 添加分区对话框
const showAddPartition = ref(false);
const emptyPartForm = () => ({
  name: "", isDefault: false, from: "", to: "", values: "", modulus: "", remainder: "",
});
const partForm = ref(emptyPartForm());
const openAddPartition = () => {
  partForm.value = emptyPartForm();
  showAddPartition.value = true;
};
const submitAddPartition = async () => {
  const strategy = partitionInfo.value.strategy;
  const f = partForm.value;
  let bound;
  if (f.isDefault) {
    bound = { isDefault: true };
  } else if (strategy === "range") {
    bound = { from: f.from, to: f.to };
  } else if (strategy === "list") {
    bound = { values: f.values.split(",").map((v) => v.trim()).filter(Boolean) };
  } else if (strategy === "hash") {
    bound = { modulus: Number(f.modulus), remainder: Number(f.remainder) };
  }
  const ok = await addPartition({ partitionName: f.name.trim(), strategy, bound });
  if (ok) showAddPartition.value = false;
};

const onDropPartition = (name) => {
  $q.dialog({
    title: "确认删除",
    message: `删除分区 '${name}'？将 DROP 该分区表，不可恢复。`,
    cancel: true,
    dark: true,
    dense: true,
  }).onOk(() => dropPartition(name));
};
</script>

<template>
  <div class="column no-wrap full-height bg-dark">
    <!-- 表格基本信息 -->
    <div class="col-auto q-px-md q-pt-md">
      <q-input :model-value="currentSelectTreeNode.name" label="表名" dark dense outlined readonly />
    </div>

    <!-- Tab页签区域 -->
    <div class="col q-px-md q-py-sm column">
      <div class="q-mb-sm row items-center justify-between">
        <div class="text-subtitle2 text-white">索引列表</div>
        <q-btn flat dense color="primary" icon="add" @click="addNewIndex">
          <q-tooltip>添加索引</q-tooltip>
        </q-btn>
      </div>

      <!-- 使用scroll类和flex布局确保正确显示滚动条 -->
      <div class="col scroll">
        <div v-if="tableIndexes.length === 0" class="text-center q-pa-md text-grey">
          暂无索引，点击上方添加按钮创建
        </div>
        <div v-else class="q-gutter-y-sm">
          <q-card v-for="(index, idx) in tableIndexes" :key="index._key ||
            index.id ||
            'index-' + idx + '-' + indexUpdateTrigger
            " dark dense flat bordered class="q-mb-sm bg-dark">
            <q-card-section class="q-py-xs">
              <!-- 第一行：字段选择器 -->
              <div class="row q-mb-xs">
                <q-select v-model="index.id" :options="fieldOptions" label="字段" dense dark class="col-grow" emit-value
                  map-options :disable-cache="true" behavior="menu"
                  @update:model-value="(val) => updateIndexField(index, val)">
                  <template v-slot:option="scope">
                    <q-item v-bind="scope.itemProps" :disable="scope.opt.disabled">
                      <q-item-section>
                        <q-item-label>{{ scope.opt.label }}</q-item-label>
                      </q-item-section>
                    </q-item>
                  </template>
                  <template v-slot:selected-item="scope">
                    <div class="ellipsis">
                      {{ getFieldNameById(scope.opt) }}
                    </div>
                  </template>
                </q-select>
                <q-icon name="delete" class="q-ml-sm self-center text-red cursor-pointer hover-opacity"
                  style="transition: opacity 0.2s" @click="deleteIndex(idx)"
                  @mouseenter="$event.target.style.opacity = 0.7" @mouseleave="$event.target.style.opacity = 1" />
              </div>

            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>

    <!-- 分区 -->
    <div v-if="partitionInfo.partitioned" class="col-auto q-px-md q-py-sm column">
      <div class="q-mb-sm row items-center justify-between">
        <div class="text-subtitle2 text-white">
          分区
          <q-chip dense dark size="sm" color="primary" text-color="white" class="q-ml-xs">{{ strategyLabel }}</q-chip>
          <q-chip dense dark size="sm" outline class="q-ml-xs">键: {{ partitionInfo.key }}</q-chip>
          <q-chip dense size="sm" :color="partitionInfo.managedBy === 'partman' ? 'teal' : (partitionInfo.managedBy === 'native' ? 'indigo' : 'grey-7')"
            text-color="white" class="q-ml-xs">{{ manageLabel }}</q-chip>
        </div>
        <q-btn flat dense color="primary" icon="add" @click="openAddPartition">
          <q-tooltip>添加分区</q-tooltip>
        </q-btn>
      </div>

      <!-- 自动管理配置（native / partman）-->
      <div v-if="isAutoManaged" class="q-mb-sm q-gutter-y-sm">
        <div class="text-caption text-grey-5">
          间隔: {{ partitionInfo.config?.interval }} · 预建: {{ partitionInfo.config?.premake }}
        </div>
        <!-- 预建数量 + 保留策略：保存内嵌 append，避免窄面板下按钮溢出 -->
        <div class="row items-start no-wrap q-gutter-x-sm">
          <q-input v-model.number="premakeInput" type="number" label="预建数量" dark dense outlined style="max-width: 110px" />
          <q-input v-model="retentionInput" label="保留策略" dark dense outlined class="col"
            hint="如 3 months / 90，留空不清理">
            <template #append>
              <q-btn flat dense round size="sm" color="primary" icon="save" @click="saveConfig">
                <q-tooltip>保存预建/保留配置</q-tooltip>
              </q-btn>
            </template>
          </q-input>
        </div>
        <!-- 维护定时：保存内嵌 append -->
        <q-input v-model="cronInput" label="维护定时 (cron)" dark dense outlined
          :disable="!partitionInfo.cronAvailable"
          :hint="partitionInfo.cronAvailable ? 'pg_cron 执行' : '未检测到 pg_cron(宿主库默认 postgres),仅能手动维护'">
          <template #append>
            <q-btn flat dense round size="sm" color="primary" icon="save"
              :disable="!partitionInfo.cronAvailable" @click="saveSchedule">
              <q-tooltip>保存定时</q-tooltip>
            </q-btn>
          </template>
        </q-input>
        <q-btn flat dense size="sm" color="secondary" icon="build" label="立即维护" @click="runMaintenance" />
      </div>

      <!-- 子分区列表 -->
      <div v-if="(partitionInfo.partitions || []).length === 0" class="text-center q-pa-sm text-grey">
        暂无子分区
      </div>
      <div v-else class="q-gutter-y-xs">
        <q-card v-for="p in partitionInfo.partitions" :key="p.name" dark dense flat bordered class="bg-dark">
          <q-card-section class="q-py-xs row items-center no-wrap">
            <div class="col">
              <div class="text-caption text-white ellipsis">{{ p.name }}</div>
              <div class="text-caption text-grey-6 ellipsis">{{ p.bound }}</div>
            </div>
            <q-icon name="delete" class="q-ml-sm text-red cursor-pointer hover-opacity"
              style="transition: opacity 0.2s" @click="onDropPartition(p.name)"
              @mouseenter="$event.target.style.opacity = 0.7" @mouseleave="$event.target.style.opacity = 1" />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- JOIN 关联 -->
    <div v-if="tableJoins.length > 0" class="col-auto q-px-md q-py-sm column">
      <div class="q-mb-sm text-subtitle2 text-white">关联</div>
      <div class="q-gutter-y-sm">
        <q-card
          v-for="tj in tableJoins"
          :key="tj.slotId"
          dark dense flat bordered
          class="q-mb-sm bg-dark"
        >
          <q-card-section class="q-py-xs">
            <div class="text-caption text-grey-4">
              {{ currentSelectTreeNode.name }}.{{ tj.targetFieldName }} = {{ tj.sourceTableName }}.{{ tj.sourceFieldName }}
            </div>
            <q-select
              dense dark outlined
              :model-value="tj.joinType"
              @update:model-value="val => onJoinTypeChange(tj.slotId, val)"
              :options="JOIN_TYPE_OPTIONS"
              emit-value map-options
              label="连接方式"
            />
          </q-card-section>
        </q-card>
      </div>
    </div>

    <!-- 表注释 -->
    <div class="col-auto q-px-md q-pb-md">
      <q-input label="表注释" dark dense outlined type="textarea" autogrow
        input-style="min-height: 20px; max-height: 120px" class="text-caption"
        :model-value="dbConfig.getConfig('comment')" @update:model-value="(val) => updateTemp(val)"
        @keyup.enter="(e) => e.target.blur()" @blur="() => updateFinalValue('comment')" />
    </div>

    <!-- 添加分区对话框 -->
    <q-dialog v-model="showAddPartition">
      <q-card dark class="bg-dark" style="min-width: 340px">
        <q-card-section class="q-pb-none">
          <div class="text-subtitle1 text-white">添加分区</div>
        </q-card-section>
        <q-card-section class="q-gutter-y-sm">
          <q-input v-model="partForm.name" label="分区名" dark dense outlined autofocus />
          <q-toggle v-model="partForm.isDefault" label="默认分区 (DEFAULT)" dark dense />
          <template v-if="!partForm.isDefault">
            <template v-if="partitionInfo.strategy === 'range'">
              <q-input v-model="partForm.from" label="起始值 FROM" dark dense outlined />
              <q-input v-model="partForm.to" label="结束值 TO" dark dense outlined />
            </template>
            <q-input v-else-if="partitionInfo.strategy === 'list'" v-model="partForm.values"
              label="值列表 (逗号分隔)" dark dense outlined />
            <template v-else-if="partitionInfo.strategy === 'hash'">
              <q-input v-model.number="partForm.modulus" type="number" label="模数 MODULUS" dark dense outlined />
              <q-input v-model.number="partForm.remainder" type="number" label="余数 REMAINDER" dark dense outlined />
            </template>
          </template>
        </q-card-section>
        <q-card-actions align="right">
          <q-btn flat dense label="取消" color="grey" v-close-popup />
          <q-btn flat dense label="创建" color="primary" :disable="!partForm.name.trim()" @click="submitAddPartition" />
        </q-card-actions>
      </q-card>
    </q-dialog>
  </div>
</template>

<style scoped>
</style>
