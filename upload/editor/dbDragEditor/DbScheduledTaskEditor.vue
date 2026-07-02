<script setup>
import { ref, computed, watch, nextTick } from "vue";
import { Notify } from "quasar";
import SqlQueryEditor from "src/components/editor/dbTableEditor/SqlQueryEditor.vue";
import SqlResultTable from "src/components/editor/dbTableEditor/SqlResultTable.vue";
import SqlNoticeLog from "src/components/editor/dbTableEditor/SqlNoticeLog.vue";
import DbSchemaTree from "src/components/editor/dbTableEditor/DbSchemaTree.vue";
import CronEditor from "../schedulerEditor/CronEditor.vue";
import api from "src/services/api.js";
import * as aiApi from "src/services/http/aiApi.js";
import { useProjectStore } from "src/stores/projectMange.js";
import { currentGraphId } from "./hooks/useDbConfig.js";
import { dbTreeManager } from "./hooks/useDbTreeManager.js";
import { wrapAnonymousBlock } from "./graph/routineBody.js";

// dbDragEditor 在画布区挂载本组件;node 为当前选中树节点(定时任务)
const props = defineProps({
  node: { type: Object, default: null },
});

const projectStore = useProjectStore();
const manager = dbTreeManager();
const NODE_TYPES = manager.NODE_TYPES;

const serverDbId = computed(() => currentGraphId.value || "");
const projectId = computed(() => projectStore.currentProjectId);
const rootDir = computed(() => projectStore.currentProject?.rootDir || "");
const title = computed(() => `定时任务:${props.node?.name || ""}`);

// ─── SQL 编辑器(复用 SqlQueryEditor,嵌入模式)───
const sqlEditor = ref(null);
const getEditorSql = () => (sqlEditor.value?.getSQL() || "").trim().replace(/;\s*$/, "");
const setEditorSql = (val) => nextTick(() => sqlEditor.value?.setSQL(val || ""));
const formatSql = () => sqlEditor.value?.formatSQL();
const onSchemaInsert = (name) => sqlEditor.value?.insertText?.(name);

// ─── 加载/保存 SQL(项目数据 editors[nodeId].sql)───
function loadSql() {
  previewRows.value = [];
  previewColumns.value = [];
  noticeLogs.value = [];
  aiResult.value = "";
  if (!props.node) return;
  const sql = projectStore.getDbEditorData(props.node.id, "sql") || "";
  setEditorSql(sql);
}

function save() {
  if (!props.node) return;
  projectStore.updateDbEditorData(props.node.id, "sql", getEditorSql());
  Notify.create({ type: "positive", message: "已保存", position: "top", timeout: 1200 });
}

// ─── 执行(测试默认事务回滚不落库;立即执行真实生效)经 execute-sql ───
const running = ref(false);
const testing = ref(false);
const previewRows = ref([]);
const previewColumns = ref([]);
const noticeLogs = ref([]);

async function execute(rollback) {
  if (!serverDbId.value) {
    Notify.create({ type: "warning", message: "请先选择已配置连接的数据库", position: "top" });
    return;
  }
  const body = getEditorSql();
  if (!body) {
    Notify.create({ type: "warning", message: "主体逻辑为空", position: "top" });
    return;
  }
  const flag = rollback ? testing : running;
  flag.value = true;
  try {
    const resp = await api.post("/api/db/execute-sql", {
      serverDbId: serverDbId.value,
      sql: wrapAnonymousBlock(body),
      rollback,
      projectId: projectId.value,
    });
    if (resp.data.success) {
      const { rows, columns, notices } = resp.data.data;
      previewRows.value = rows || [];
      previewColumns.value = (columns || []).map((c) => ({ name: c.name, type: c.type || "" }));
      noticeLogs.value = notices || [];
      Notify.create({
        type: "positive",
        message: rollback ? "执行成功(已回滚,未落库)" : "执行成功",
        position: "top",
        timeout: 1500,
      });
    } else {
      Notify.create({ type: "negative", message: resp.data.message || "执行失败", position: "top" });
    }
  } catch (error) {
    Notify.create({ type: "negative", message: `执行失败: ${error.response?.data?.message || error.message}`, position: "top" });
  } finally {
    flag.value = false;
  }
}

const runNow = () => execute(false);
const runTest = () => execute(true);

// ─── 定时调度(pg_cron,jobName 按 nodeId)───
const cronAvailable = ref(false);
const scheduleEnabled = ref(false);
const cronExpr = ref("*/30 * * * *");
const scheduleSaving = ref(false);

async function loadSchedule() {
  cronAvailable.value = false;
  scheduleEnabled.value = false;
  if (!serverDbId.value || !props.node) return;
  try {
    const resp = await api.get("/api/db/scheduled-task/schedule", {
      params: { serverDbId: serverDbId.value, nodeId: props.node.id, projectId: projectId.value },
    });
    if (resp.data.success) {
      cronAvailable.value = resp.data.data.available;
      if (resp.data.data.cron) {
        scheduleEnabled.value = true;
        cronExpr.value = resp.data.data.cron;
      }
    }
  } catch (error) {
    console.error("加载定时任务调度失败:", error);
  }
}

async function saveSchedule() {
  if (!props.node) return;
  scheduleSaving.value = true;
  try {
    let resp;
    if (scheduleEnabled.value) {
      const body = getEditorSql();
      if (!body) {
        Notify.create({ type: "warning", message: "主体逻辑为空,无法设置定时", position: "top" });
        return;
      }
      // 持久化裸主体;调度命令用 DO 匿名块包裹,与立即执行一致
      projectStore.updateDbEditorData(props.node.id, "sql", body);
      resp = await api.put("/api/db/scheduled-task/schedule", {
        serverDbId: serverDbId.value,
        nodeId: props.node.id,
        cron: cronExpr.value,
        sql: wrapAnonymousBlock(body),
        projectId: projectId.value,
      });
    } else {
      resp = await api.delete("/api/db/scheduled-task/schedule", {
        data: { serverDbId: serverDbId.value, nodeId: props.node.id, projectId: projectId.value },
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

// ─── AI CLI(自然语言生成 SQL;结果经 type:'sql' JSON 回传)───
const aiPrompt = ref("");
const aiRunning = ref(false);
const aiResult = ref("");

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
        target: { kind: "scheduled_task" },
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

// ─── 节点切换 → 加载 SQL/调度(放末尾:immediate 同步触发时,上面引用到的 ref/函数须已初始化)───
watch(
  () => props.node?.id,
  () => {
    loadSql();
    loadSchedule();
  },
  { immediate: true },
);
</script>

<template>
  <div class="db-task-editor column no-wrap full-height bg-dark text-white">
    <!-- 头部 -->
    <div class="row items-center q-px-sm q-py-xs db-task-editor__header">
      <q-icon name="schedule" size="sm" class="q-mr-xs text-teal-4" />
      <div class="text-subtitle2 ellipsis">{{ title }}</div>
    </div>
    <q-separator dark />

    <div class="row no-wrap col db-task-editor__body">
      <!-- 左:SQL 编辑器 + 结果 -->
      <div class="col column no-wrap db-task-editor__left">
        <div class="row items-center q-px-sm q-py-xs q-gutter-x-sm db-task-editor__toolbar">
          <div class="text-caption text-grey-6 ellipsis">只写主体逻辑,执行时自动包成 DO 匿名块(plpgsql 写法)</div>
          <q-space />
          <q-btn dense flat no-caps size="sm" icon="play_arrow" color="teal-4" label="测试运行" :loading="testing" :disable="!serverDbId" @click="runTest">
            <q-tooltip>在事务内执行后自动回滚,只看返回值和日志,不真正改数据</q-tooltip>
          </q-btn>
          <q-btn dense flat no-caps size="sm" icon="bolt" color="positive" label="立即执行" :loading="running" :disable="!serverDbId" @click="runNow" />
          <q-btn dense flat no-caps size="sm" icon="format_align_left" color="primary" label="格式化" @click="formatSql" />
          <q-btn dense flat no-caps size="sm" icon="save" color="primary" label="保存" @click="save" />
        </div>

        <div class="db-task-editor__code row no-wrap">
          <div class="col relative-position" style="min-width: 0">
            <SqlQueryEditor ref="sqlEditor" embedded @run="runNow" />
          </div>
          <div class="db-task-editor__schema">
            <DbSchemaTree :server-db-id="serverDbId" @insert="onSchemaInsert" />
          </div>
        </div>

        <div class="db-task-editor__result row no-wrap">
          <div class="col column no-wrap" style="min-width: 0">
            <div class="text-caption text-grey-5 q-px-sm q-py-xs db-task-editor__result-label">
              执行结果 <span class="text-grey-6 q-ml-xs">({{ previewRows.length }} 行)</span>
            </div>
            <div class="col" style="min-height: 0">
              <SqlResultTable :rows="previewRows" :columns="previewColumns" :loading="running" :editable="false" />
            </div>
          </div>
          <q-separator dark vertical />
          <div class="column no-wrap db-task-editor__log">
            <div class="text-caption text-grey-5 q-px-sm q-py-xs db-task-editor__result-label">打印日志</div>
            <div class="col" style="min-height: 0">
              <SqlNoticeLog :notices="noticeLogs" />
            </div>
          </div>
        </div>
      </div>

      <q-separator dark vertical />

      <!-- 右:AI CLI -->
      <div class="column no-wrap db-task-editor__ai">
        <div class="text-caption text-grey-5 q-px-sm q-py-xs">AI 编辑器(自然语言生成 SQL)</div>
        <div v-if="aiResult" class="q-pa-sm db-task-editor__ai-result">
          <div class="text-caption text-grey-5 q-mb-xs">AI 结果(确认后应用)</div>
          <pre class="db-task-editor__ai-sql">{{ aiResult }}</pre>
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

      <q-separator dark vertical />

      <!-- 最右:定时调度(pg_cron)-->
      <div class="column no-wrap db-task-editor__sched-col">
        <div class="text-caption text-grey-5 q-px-sm q-py-xs db-task-editor__sched-col-label">
          <q-icon name="event_repeat" size="xs" class="text-teal-4 q-mr-xs" />定时执行(pg_cron)
        </div>
        <div class="col scroll q-pa-sm column q-gutter-y-sm" style="min-height: 0">
          <div v-if="!cronAvailable" class="text-caption text-orange-4">
            未检测到 pg_cron 扩展,保存后无法定时执行(pg_cron 需装在数据库实例的宿主库,默认 postgres,并授予调度权限)
          </div>
          <div class="row items-center q-gutter-x-sm">
            <div class="text-caption text-grey-5">启用定时</div>
            <q-toggle v-model="scheduleEnabled" dark dense size="sm" />
            <q-space />
            <q-btn dense flat no-caps size="sm" icon="save" color="primary" label="保存定时" :loading="scheduleSaving" :disable="!cronAvailable" @click="saveSchedule" />
          </div>
          <CronEditor v-if="scheduleEnabled" v-model="cronExpr" />
          <div v-if="scheduleEnabled" class="text-caption text-grey-6">
            改动 SQL 后需重新点「保存定时」,调度命令才会更新为最新 SQL。
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.db-task-editor {
  min-height: 0;
}
.db-task-editor__header {
  background: rgba(255, 255, 255, 0.04);
}
.db-task-editor__sched-col {
  width: 320px;
  min-width: 320px;
  min-height: 0;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
}
.db-task-editor__sched-col-label {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.db-task-editor__body {
  min-height: 0;
  overflow: hidden;
}
.db-task-editor__left {
  min-width: 0;
  min-height: 0;
}
.db-task-editor__toolbar {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.db-task-editor__code {
  position: relative;
  flex: 3 1 0;
  min-height: 0;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}
.db-task-editor__schema {
  width: 200px;
  min-width: 200px;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  padding: 4px;
}
.db-task-editor__result {
  flex: 2 1 0;
  min-height: 0;
  overflow: hidden;
}
.db-task-editor__log {
  width: 280px;
  min-width: 280px;
  min-height: 0;
}
.db-task-editor__result-label {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.db-task-editor__ai {
  width: 360px;
  min-width: 360px;
  min-height: 0;
}
.db-task-editor__terminal {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.db-task-editor__ai-result {
  max-height: 140px;
  overflow: auto;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}
.db-task-editor__ai-sql {
  margin: 0;
  white-space: pre-wrap;
  word-break: break-word;
  font-family: monospace;
  font-size: 12px;
  color: #d7e3ff;
}
</style>
