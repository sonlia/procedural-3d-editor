<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { Notify } from "quasar";
import SqlQueryEditor from "src/components/editor/dbTableEditor/SqlQueryEditor.vue";
import SqlResultTable from "src/components/editor/dbTableEditor/SqlResultTable.vue";
import DbSchemaTree from "src/components/editor/dbTableEditor/DbSchemaTree.vue";
import CronEditor from "../schedulerEditor/CronEditor.vue";
import api from "src/services/api.js";
import * as aiApi from "src/services/http/aiApi.js";
import { useProjectStore } from "src/stores/projectMange.js";
import { currentGraphId } from "./hooks/useDbConfig.js";
import { dbTreeManager } from "./hooks/useDbTreeManager.js";
import { useGraphEditor } from "./hooks/useDbGraphEditor.js";

// dbDragEditor 在画布区直接挂载本组件;node 为当前选中树节点
const props = defineProps({
  node: { type: Object, default: null },
});

const projectStore = useProjectStore();
const manager = dbTreeManager();
const NODE_TYPES = manager.NODE_TYPES;
const { syncProcedureSlots } = useGraphEditor();

// view | materialized | computed | function —— 由节点类型推导
const mode = computed(() => {
  const t = props.node?.type;
  if (t === NODE_TYPES.MATERIALIZED_VIEW) return "materialized";
  if (t === NODE_TYPES.COMPUTED) return "computed";
  if (t === NODE_TYPES.FUNCTION) return "function";
  return "view";
});
const isComputed = computed(() => mode.value === "computed");
const isMaterialized = computed(() => mode.value === "materialized");
const isFunction = computed(() => mode.value === "function");

const serverDbId = computed(() => currentGraphId.value || "");
const projectId = computed(() => projectStore.currentProjectId);
const rootDir = computed(() => projectStore.currentProject?.rootDir || "");

// 列计算所属表
const tableNode = computed(() =>
  props.node ? manager.findNearestParentByType(props.node, NODE_TYPES.TABLE) : null,
);
const tableName = computed(() => tableNode.value?.name || "");

const title = computed(() => {
  if (isFunction.value) return `函数:${props.node?.name || ""}`;
  if (isComputed.value) return `列计算:${props.node?.name || ""}`;
  return `${isMaterialized.value ? "物化视图" : "视图"}:${props.node?.name || ""}`;
});

// ─── SQL 编辑器(复用表编辑器同款 SqlQueryEditor,嵌入模式)───
const sqlEditor = ref(null);
// 读取当前编辑器 SQL(去尾分号)
const getEditorSql = () => (sqlEditor.value?.getSQL() || "").trim().replace(/;\s*$/, "");
// 写入编辑器(nextTick 确保子组件已就绪)
const setEditorSql = (val) => nextTick(() => sqlEditor.value?.setSQL(val || ""));
const formatSql = () => sqlEditor.value?.formatSQL();
// 库表字段树双击 → 插入到 SQL 编辑器光标处
const onSchemaInsert = (name) => sqlEditor.value?.insertText?.(name);

// 列计算的列类型(PG SQL 类型字符串)
const columnType = ref("integer");
const COLUMN_TYPE_OPTIONS = ref([
  "integer", "bigint", "smallint", "numeric", "numeric(10,2)",
  "real", "double precision", "text", "varchar(255)", "boolean",
  "date", "timestamptz", "jsonb",
]);

const loading = ref(false);

// ─── 加载定义 ───
async function loadDefinition() {
  setEditorSql("");
  previewRows.value = [];
  previewColumns.value = [];
  aiResult.value = "";
  if (!serverDbId.value || !props.node) return;

  const reqNodeId = props.node.id; // 防竞态:快速切换节点时丢弃过期响应
  loading.value = true;
  try {
    if (isFunction.value) {
      const resp = await api.get("/api/db/procedures", {
        params: { serverDbId: serverDbId.value, projectId: projectId.value },
      });
      if (props.node?.id !== reqNodeId) return;
      if (resp.data.success) {
        const proc = resp.data.data.find((p) => p.name === props.node.name);
        if (proc) {
          setEditorSql(proc.definition || "");
          syncProcedureSlots(props.node.id, proc.signature_args, proc.return_type);
        }
      }
    } else if (isComputed.value) {
      const resp = await api.get("/api/db/computed-column", {
        params: {
          serverDbId: serverDbId.value,
          tableName: tableName.value,
          columnName: props.node.name,
          projectId: projectId.value,
        },
      });
      if (props.node?.id !== reqNodeId) return;
      if (resp.data.success) {
        setEditorSql(resp.data.data.expression || "");
        const dt = resp.data.data.dataType;
        if (dt) {
          if (!COLUMN_TYPE_OPTIONS.value.includes(dt)) COLUMN_TYPE_OPTIONS.value.unshift(dt);
          columnType.value = dt;
        }
      }
    } else {
      const resp = await api.get("/api/db/views", {
        params: { serverDbId: serverDbId.value, projectId: projectId.value },
      });
      if (props.node?.id !== reqNodeId) return;
      if (resp.data.success) {
        const view = resp.data.data.find((v) => v.name === props.node.name);
        if (view) setEditorSql(view.definition || "");
      }
    }
  } catch (error) {
    console.error("加载定义失败:", error);
    Notify.create({ type: "negative", message: `加载失败: ${error.response?.data?.message || error.message}`, position: "top" });
  } finally {
    if (props.node?.id === reqNodeId) loading.value = false;
  }
}

// ─── 预览(运行)───
const previewing = ref(false);
const previewRows = ref([]);
const previewColumns = ref([]);

function buildPreviewSql() {
  const body = getEditorSql();
  if (!body) return "";
  if (isComputed.value) {
    return `SELECT (${body}) AS computed FROM "${tableName.value}" LIMIT 100`;
  }
  return `SELECT * FROM (${body}) AS _preview LIMIT 100`;
}

async function runPreview() {
  if (!serverDbId.value) {
    Notify.create({ type: "warning", message: "请先选择已配置连接的数据库", position: "top" });
    return;
  }
  const sql = buildPreviewSql();
  if (!sql) {
    Notify.create({ type: "warning", message: "SQL 为空", position: "top" });
    return;
  }
  previewing.value = true;
  try {
    const resp = await api.post("/api/db/execute-sql", {
      serverDbId: serverDbId.value,
      sql,
      projectId: projectId.value,
    });
    if (resp.data.success) {
      const { rows, columns } = resp.data.data;
      previewRows.value = rows || [];
      previewColumns.value = (columns || []).map((c) => ({ name: c.name, type: c.type || "" }));
      Notify.create({ type: "positive", message: `返回 ${previewRows.value.length} 行`, position: "top", timeout: 1500 });
    } else {
      Notify.create({ type: "negative", message: resp.data.message || "执行失败", position: "top" });
    }
  } catch (error) {
    Notify.create({ type: "negative", message: `执行失败: ${error.response?.data?.message || error.message}`, position: "top" });
  } finally {
    previewing.value = false;
  }
}

// ─── 保存 ───
async function save() {
  if (!serverDbId.value || !props.node) return;
  const body = getEditorSql();
  if (!body) {
    Notify.create({ type: "warning", message: isFunction.value ? "函数定义为空" : isComputed.value ? "表达式为空" : "视图定义为空", position: "top" });
    return;
  }
  loading.value = true;
  try {
    let resp;
    if (isFunction.value) {
      resp = await api.post("/api/db/procedure", {
        serverDbId: serverDbId.value,
        name: props.node.name,
        definition: body,
        type: "function",
        projectId: projectId.value,
      });
    } else if (isComputed.value) {
      resp = await api.put("/api/db/computed-column", {
        serverDbId: serverDbId.value,
        tableName: tableName.value,
        columnName: props.node.name,
        columnType: columnType.value,
        expression: body,
        projectId: projectId.value,
      });
    } else {
      resp = await api.put("/api/db/view", {
        serverDbId: serverDbId.value,
        name: props.node.name,
        definition: body,
        type: isMaterialized.value ? "materialized" : "view",
        projectId: projectId.value,
      });
    }
    if (resp.data.success) {
      Notify.create({ type: "positive", message: resp.data.message || "保存成功", position: "top" });
      if (isFunction.value) loadDefinition();
    } else {
      Notify.create({ type: "negative", message: resp.data.message || "保存失败", position: "top" });
    }
  } catch (error) {
    Notify.create({ type: "negative", message: `保存失败: ${error.response?.data?.message || error.message}`, position: "top" });
  } finally {
    loading.value = false;
  }
}

// ─── 物化视图:定时刷新(pg_cron)+ 立即刷新(从右侧属性面板移入主编辑区)───
const cronAvailable = ref(false);
const scheduleEnabled = ref(false);
const cronExpr = ref("*/30 * * * *");
const scheduleSaving = ref(false);

async function loadSchedule() {
  cronAvailable.value = false;
  scheduleEnabled.value = false;
  if (!isMaterialized.value || !serverDbId.value || !props.node) return;
  try {
    const resp = await api.get("/api/db/view/refresh-schedule", {
      params: { serverDbId: serverDbId.value, name: props.node.name },
    });
    if (resp.data.success) {
      cronAvailable.value = resp.data.data.available;
      if (resp.data.data.cron) {
        scheduleEnabled.value = true;
        cronExpr.value = resp.data.data.cron;
      }
    }
  } catch (error) {
    console.error("加载定时刷新配置失败:", error);
  }
}

async function saveSchedule() {
  scheduleSaving.value = true;
  try {
    let resp;
    if (scheduleEnabled.value) {
      resp = await api.put("/api/db/view/refresh-schedule", {
        serverDbId: serverDbId.value,
        name: props.node.name,
        cron: cronExpr.value,
      });
    } else {
      resp = await api.delete("/api/db/view/refresh-schedule", {
        data: { serverDbId: serverDbId.value, name: props.node.name },
      });
    }
    if (resp.data.success) {
      Notify.create({ type: "positive", message: resp.data.message, position: "top" });
    } else {
      Notify.create({ type: "negative", message: resp.data.message || "保存失败", position: "top" });
    }
  } catch (error) {
    Notify.create({ type: "negative", message: `保存失败: ${error.response?.data?.message || error.message}`, position: "top" });
  } finally {
    scheduleSaving.value = false;
  }
}

async function refreshMaterializedView() {
  if (!isMaterialized.value) return;
  loading.value = true;
  try {
    const resp = await api.post("/api/db/view/refresh", {
      serverDbId: serverDbId.value,
      name: props.node.name,
      concurrently: false,
    });
    if (resp.data.success) {
      Notify.create({ type: "positive", message: resp.data.message, position: "top" });
    }
  } catch (error) {
    console.error("刷新物化视图失败:", error);
    Notify.create({ type: "negative", message: `刷新失败: ${error.response?.data?.message || error.message}`, position: "top" });
  } finally {
    loading.value = false;
  }
}

// ─── AI CLI ───
const aiPrompt = ref("");
const aiRunning = ref(false);
const aiResult = ref("");

// 从当前数据库节点收集表与列,作为 AI 的 schema 上下文
function collectDbSchema() {
  const dbNode = props.node ? manager.findNearestParentByType(props.node, NODE_TYPES.DATABASE) : null;
  if (!dbNode) return [];
  const tables = [];
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (n.type === NODE_TYPES.TABLE) {
        const columns = (n.children || [])
          .filter((c) => c.type === NODE_TYPES.FIELD || c.type === NODE_TYPES.COMPUTED)
          .map((c) => c.name);
        tables.push({ table: n.name, columns });
      } else if (n.type === NODE_TYPES.FOLDER) {
        walk(n.children);
      }
    }
  };
  walk(dbNode.children);
  return tables;
}

const canRunAi = computed(() => Boolean(projectId.value && aiPrompt.value.trim() && !aiRunning.value));

async function runAi() {
  if (!canRunAi.value) return;
  aiRunning.value = true;
  aiResult.value = "";
  try {
    const current = getEditorSql();
    const hasContent = !!current;
    const resp = await aiApi.generate({
      projectId: projectId.value,
      mode: "sql",
      rootDir: rootDir.value,
      prompt: aiPrompt.value,
      context: {
        op: hasContent ? "edit" : "create",
        target: {
          kind: isFunction.value ? "function" : isComputed.value ? "computed" : "view",
          tableName: tableName.value,
          viewType: mode.value,
        },
        dbSchema: collectDbSchema(),
        current: hasContent ? { sql: current } : undefined,
      },
    });
    if (!resp.success) {
      Notify.create({ type: "negative", message: resp.error || "AI 生成失败", position: "top" });
      return;
    }
    aiResult.value = resp.result?.sql || "";
    if (!aiResult.value) {
      Notify.create({ type: "warning", message: "AI 未返回 SQL", position: "top" });
    }
  } finally {
    aiRunning.value = false;
  }
}

function applyAiResult() {
  if (!aiResult.value) return;
  setEditorSql(aiResult.value);
  Notify.create({ type: "positive", message: "已应用到编辑器", position: "top", timeout: 1200 });
}

// ─── 节点切换 → 加载定义(放末尾:immediate 同步触发时,上面引用到的 ref/函数须已初始化)───
watch(
  () => props.node?.id,
  () => {
    loadDefinition();
    if (isMaterialized.value) loadSchedule();
  },
  { immediate: true },
);
</script>

<template>
  <div class="db-sql-editor column no-wrap full-height bg-dark text-white">
    <!-- 头部 -->
    <div class="row items-center q-px-sm q-py-xs db-sql-editor__header">
      <q-icon :name="isComputed ? 'functions' : 'table_view'" size="sm" class="q-mr-xs text-light-blue-4" />
      <div class="text-subtitle2 ellipsis">{{ title }}</div>
    </div>
    <q-separator dark />

    <!-- 物化视图:定时刷新(pg_cron)+ 立即刷新 -->
    <template v-if="isMaterialized">
      <div class="db-sql-editor__mv q-px-sm q-py-xs">
        <div class="row items-center q-gutter-x-sm no-wrap">
          <q-icon name="schedule" size="xs" class="text-teal-4" />
          <div class="text-caption text-grey-5">定时刷新</div>
          <template v-if="cronAvailable">
            <q-toggle v-model="scheduleEnabled" dark dense size="sm" />
            <q-btn dense flat no-caps size="sm" icon="save" color="primary" label="保存定时刷新" :loading="scheduleSaving" @click="saveSchedule" />
          </template>
          <div v-else class="text-caption text-grey-6 ellipsis">
            未检测到 pg_cron 扩展,无法定时刷新(pg_cron 需装在数据库实例的宿主库,默认 postgres,并授予调度权限)
          </div>
          <q-space />
          <q-btn dense flat no-caps size="sm" icon="refresh" color="secondary" label="立即刷新" :loading="loading" @click="refreshMaterializedView" />
        </div>
        <CronEditor v-if="cronAvailable && scheduleEnabled" v-model="cronExpr" class="q-mt-xs" />
      </div>
      <q-separator dark />
    </template>

    <div class="row no-wrap col db-sql-editor__body">
      <!-- 左:SQL 编辑器 + 预览 -->
      <div class="col column no-wrap db-sql-editor__left">
        <!-- 工具栏 -->
        <div class="row items-center q-px-sm q-py-xs q-gutter-x-sm db-sql-editor__toolbar">
          <q-select
            v-if="isComputed"
            v-model="columnType"
            :options="COLUMN_TYPE_OPTIONS"
            dark
            dense
            outlined
            options-dense
            label="列类型"
            class="db-sql-editor__type"
          />
          <q-space />
          <q-btn dense flat no-caps size="sm" icon="format_align_left" color="primary" label="格式化" @click="formatSql" />
          <q-btn v-if="!isFunction" dense flat no-caps size="sm" icon="play_arrow" color="positive" label="运行" :loading="previewing" :disable="!serverDbId" @click="runPreview" />
          <q-btn dense flat no-caps size="sm" icon="save" color="primary" label="保存" :loading="loading" :disable="!serverDbId" @click="save" />
        </div>

        <!-- 编辑器(复用 SqlQueryEditor)+ 库表字段树(过滤/双击插入) -->
        <div class="db-sql-editor__code row no-wrap">
          <div class="col relative-position" style="min-width: 0">
            <q-inner-loading :showing="loading" dark />
            <SqlQueryEditor ref="sqlEditor" embedded @run="runPreview" />
          </div>
          <div class="db-sql-editor__schema">
            <DbSchemaTree :server-db-id="serverDbId" @insert="onSchemaInsert" />
          </div>
        </div>

        <!-- 预览 -->
        <div v-if="!isFunction" class="db-sql-editor__preview column no-wrap">
          <div class="text-caption text-grey-5 q-px-sm q-py-xs db-sql-editor__preview-label">
            预览 <span class="text-grey-6 q-ml-xs">({{ previewRows.length }} 行)</span>
          </div>
          <div class="col" style="min-height: 0">
            <SqlResultTable :rows="previewRows" :columns="previewColumns" :loading="previewing" :editable="false" />
          </div>
        </div>
      </div>

      <q-separator dark vertical />

      <!-- 右:AI CLI -->
      <div class="column no-wrap db-sql-editor__ai">
        <div class="text-caption text-grey-5 q-px-sm q-py-xs">AI 编辑器(自然语言生成 SQL)</div>
        <div v-if="aiResult" class="q-pa-sm db-sql-editor__ai-result">
          <div class="text-caption text-grey-5 q-mb-xs">AI 结果(确认后应用)</div>
          <pre class="db-sql-editor__ai-sql">{{ aiResult }}</pre>
        </div>

        <div class="q-pa-sm column q-gutter-y-xs">
          <q-input
            v-model="aiPrompt"
            dark
            dense
            outlined
            type="textarea"
            autogrow
            label="描述你想要的 SQL"
            input-style="max-height: 120px"
          />
          <div class="row items-center q-gutter-x-sm justify-end">
            <q-btn dense flat no-caps size="sm" icon="auto_awesome" color="light-blue-4" label="生成" :loading="aiRunning" :disable="!canRunAi" @click="runAi" />
            <q-btn dense flat no-caps size="sm" icon="done" color="positive" label="应用" :disable="!aiResult" @click="applyAiResult" />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.db-sql-editor {
  min-height: 0;
}

.db-sql-editor__header {
  background: rgba(255, 255, 255, 0.04);
}

.db-sql-editor__mv {
  background: rgba(255, 255, 255, 0.02);
}

.db-sql-editor__body {
  min-height: 0;
  overflow: hidden;
}

.db-sql-editor__left {
  min-width: 0;
  min-height: 0;
}

.db-sql-editor__toolbar {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.db-sql-editor__type {
  width: 180px;
}

.db-sql-editor__code {
  position: relative;
  flex: 3 1 0;
  min-height: 0;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.db-sql-editor__schema {
  width: 200px;
  min-width: 200px;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  padding: 4px;
}

.db-sql-editor__preview {
  flex: 2 1 0;
  min-height: 0;
  overflow: hidden;
}

.db-sql-editor__preview-label {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.db-sql-editor__ai {
  width: 360px;
  min-width: 360px;
  min-height: 0;
}

.db-sql-editor__terminal {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.db-sql-editor__ai-result {
  max-height: 140px;
  overflow: auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.db-sql-editor__ai-sql {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
  font-size: 12px;
  color: #d7e3ff;
}
</style>
