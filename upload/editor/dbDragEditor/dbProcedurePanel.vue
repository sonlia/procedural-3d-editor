<script setup>
import { computed, nextTick, ref, watch } from "vue";
import { Notify } from "quasar";
import SqlQueryEditor from "src/components/editor/dbTableEditor/SqlQueryEditor.vue";
import SqlResultTable from "src/components/editor/dbTableEditor/SqlResultTable.vue";
import SqlNoticeLog from "src/components/editor/dbTableEditor/SqlNoticeLog.vue";
import DbSchemaTree from "src/components/editor/dbTableEditor/DbSchemaTree.vue";
import * as aiApi from "src/services/http/aiApi.js";
import api from "src/services/api.js";
import { currentGraphId } from "./hooks/useDbConfig";
import { dbTreeManager } from "./hooks/useDbTreeManager";
import { useDbMetadata } from "./hooks/useDbMetadata";
import { useGraphEditor } from "./hooks/useDbGraphEditor";
import { parseProcedureSignature, splitTopLevelCommas } from "./graph/procedureSignature.js";
import { assembleRoutineDefinition, extractRoutineBody } from "./graph/routineBody.js";
import { useProjectStore } from "src/stores/projectMange.js";

const props = defineProps({
  node: { type: Object, default: null },
});

const manager = dbTreeManager();
const projectStore = useProjectStore();
const { getFieldTypes, getProcedureLanguages } = useDbMetadata();
const { syncProcedureSlots } = useGraphEditor();

const sqlEditor = ref(null);
const loading = ref(false);
const language = ref("plpgsql");
const comment = ref("");
const inputParams = ref([]);
const returnsStr = ref("");

// ─── 模拟测试 ───
const testCommit = ref(false); // 真实提交开关(默认关 = 事务回滚)
const testRunning = ref(false);
const testRows = ref([]);
const testColumns = ref([]);
const testNotices = ref([]);

const procedureName = computed(() => props.node?.name || "");
const isProcedure = computed(() => props.node?.type === manager.NODE_TYPES.PROCEDURE);
const serverDbId = computed(() => currentGraphId.value || "");
const projectId = computed(() => projectStore.currentProjectId);
const title = computed(() => `${isProcedure.value ? "存储过程" : "函数"}:${procedureName.value}`);
const languageOptions = computed(() => getProcedureLanguages("pg", true));
const typeOptions = computed(() => {
  const defaults = [
    "integer",
    "bigint",
    "smallint",
    "numeric",
    "numeric(10,2)",
    "real",
    "double precision",
    "text",
    "varchar(255)",
    "boolean",
    "date",
    "timestamp",
    "timestamptz",
    "json",
    "jsonb",
    "uuid",
    "void",
  ];
  const metadataTypes = getFieldTypes("pg", true).map((item) => item.value);
  const loadedTypes = inputParams.value.map((param) => param.type).filter(Boolean);
  return [...new Set([...defaults, ...metadataTypes, ...loadedTypes])];
});
const argumentsStr = computed(() =>
  inputParams.value
    .map((param) => ({
      name: param.name.trim(),
      type: param.type.trim(),
    }))
    .filter((param) => param.name && param.type)
    .map((param) => `"${param.name.replaceAll('"', '""')}" ${param.type}`)
    .join(", "),
);
const signature = computed(() => parseProcedureSignature(argumentsStr.value, returnsStr.value));

const getEditorSql = () => (sqlEditor.value?.getSQL() || "").trim();
const setEditorSql = (val) => nextTick(() => sqlEditor.value?.setSQL(val || ""));
const formatSql = () => sqlEditor.value?.formatSQL();
const onSchemaInsert = (name) => sqlEditor.value?.insertText?.(name);

function resetState() {
  language.value = "plpgsql";
  comment.value = "";
  inputParams.value = [];
  returnsStr.value = "";
  setEditorSql("");
  testRows.value = [];
  testColumns.value = [];
  testNotices.value = [];
}

function makeInputParam(index, name = "", type = "text") {
  return {
    id: `${Date.now()}-${index}-${Math.random().toString(16).slice(2)}`,
    name,
    type,
    testValue: "",
    testNull: false,
  };
}

function parseInputParams(args) {
  return splitTopLevelCommas(args || "").map((seg, index) => {
    let tokens = seg.trim().split(/\s+/).filter(Boolean);
    if (tokens.length > 1 && ["IN", "OUT", "INOUT", "VARIADIC"].includes(tokens[0].toUpperCase())) {
      tokens = tokens.slice(1);
    }
    if (tokens.length >= 2) {
      return makeInputParam(index, tokens[0].replace(/^"|"$/g, ""), tokens.slice(1).join(" "));
    }
    return makeInputParam(index, `arg${index + 1}`, tokens[0] || "text");
  });
}

function syncLoadedProcedure(proc) {
  setEditorSql(extractRoutineBody({ definition: proc.definition || "", language: proc.language || "plpgsql" }));
  comment.value = proc.comment || "";
  language.value = proc.language || "plpgsql";
  inputParams.value = parseInputParams(proc.arguments || "");
  returnsStr.value = proc.return_type || "";
  syncProcedureSlots(props.node.id, proc.signature_args || proc.arguments || "", proc.return_type || "");
}

function addInputParam() {
  inputParams.value.push(makeInputParam(inputParams.value.length));
}

function removeInputParam(index) {
  inputParams.value.splice(index, 1);
}

async function loadProcedure() {
  resetState();
  if (!serverDbId.value || !procedureName.value || !props.node) return;

  const reqNodeId = props.node.id;
  loading.value = true;
  try {
    const resp = await api.get("/api/db/procedures", {
      params: { serverDbId: serverDbId.value, projectId: projectId.value },
    });
    if (props.node?.id !== reqNodeId) return;
    if (resp.data.success) {
      const proc = resp.data.data.find(
        (p) => p.name === procedureName.value && p.type === (isProcedure.value ? "procedure" : "function"),
      );
      if (proc) syncLoadedProcedure(proc);
    } else {
      Notify.create({ type: "negative", message: resp.data.message || "加载失败", position: "top" });
    }
  } catch (error) {
    console.error("加载存储过程定义失败:", error);
    Notify.create({
      type: "negative",
      message: `加载失败: ${error.response?.data?.message || error.message}`,
      position: "top",
    });
  } finally {
    if (props.node?.id === reqNodeId) loading.value = false;
  }
}

async function saveProcedure() {
  if (!serverDbId.value || !procedureName.value || !props.node) return;

  const body = getEditorSql();
  if (!body) {
    Notify.create({ type: "warning", message: "主体逻辑不能为空", position: "top" });
    return;
  }
  const definition = assembleRoutineDefinition({
    kind: isProcedure.value ? "PROCEDURE" : "FUNCTION",
    name: procedureName.value,
    args: argumentsStr.value,
    returnType: returnsStr.value,
    language: language.value,
    body,
  });

  loading.value = true;
  try {
    const resp = await api.post("/api/db/procedure", {
      serverDbId: serverDbId.value,
      name: procedureName.value,
      definition,
      type: isProcedure.value ? "procedure" : "function",
      projectId: projectId.value,
    });
    if (resp.data.success) {
      Notify.create({ type: "positive", message: resp.data.message || "保存成功", position: "top" });
      await loadProcedure();
    } else {
      Notify.create({ type: "negative", message: resp.data.message || "保存失败", position: "top" });
    }
  } catch (error) {
    console.error("保存存储过程失败:", error);
    Notify.create({
      type: "negative",
      message: `保存失败: ${error.response?.data?.message || error.message}`,
      position: "top",
    });
  } finally {
    loading.value = false;
  }
}

async function runTest() {
  if (!serverDbId.value || !procedureName.value || !props.node) return;

  const args = inputParams.value
    .filter((param) => param.name.trim() && param.type.trim())
    .map((param) => ({ type: param.type.trim(), value: param.testValue, isNull: param.testNull }));

  testRunning.value = true;
  try {
    const resp = await api.post("/api/db/procedure/test", {
      serverDbId: serverDbId.value,
      name: procedureName.value,
      type: isProcedure.value ? "procedure" : "function",
      args,
      commit: testCommit.value,
      projectId: projectId.value,
    });
    if (resp.data.success) {
      const { rows, columns, notices } = resp.data.data;
      testRows.value = rows || [];
      testColumns.value = (columns || []).map((c) => ({ name: c.name, type: c.type || "" }));
      testNotices.value = notices || [];
      Notify.create({
        type: "positive",
        message: testCommit.value ? "执行成功(已提交)" : "执行成功(已回滚,未落库)",
        position: "top",
        timeout: 1500,
      });
    } else {
      Notify.create({ type: "negative", message: resp.data.message || "测试执行失败", position: "top" });
    }
  } catch (error) {
    console.error("测试执行失败:", error);
    Notify.create({
      type: "negative",
      message: `测试执行失败: ${error.response?.data?.message || error.message}`,
      position: "top",
    });
  } finally {
    testRunning.value = false;
  }
}

// ─── AI(单次 LLM 生成函数/存储过程定义)───
const aiPrompt = ref("");
const aiRunning = ref(false);
const aiResult = ref("");

function collectDbSchema() {
  const dbNode = props.node ? manager.findNearestParentByType(props.node, manager.NODE_TYPES.DATABASE) : null;
  if (!dbNode) return [];
  const tables = [];
  const walk = (nodes) => {
    for (const n of nodes || []) {
      if (n.type === manager.NODE_TYPES.TABLE) {
        const columns = (n.children || [])
          .filter((c) => c.type === manager.NODE_TYPES.FIELD || c.type === manager.NODE_TYPES.COMPUTED)
          .map((c) => c.name);
        tables.push({ table: n.name, columns });
      } else if (n.type === manager.NODE_TYPES.FOLDER) {
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
      prompt: aiPrompt.value,
      context: {
        op: hasContent ? "edit" : "create",
        target: { kind: isProcedure.value ? "procedure" : "function" },
        dbSchema: collectDbSchema(),
        current: hasContent ? { sql: current } : undefined,
      },
    });
    if (!resp.success) {
      Notify.create({ type: "negative", message: resp.error || "AI 生成失败", position: "top" });
      return;
    }
    aiResult.value = resp.result?.sql || "";
    if (!aiResult.value) Notify.create({ type: "warning", message: "AI 未返回 SQL", position: "top" });
  } finally {
    aiRunning.value = false;
  }
}

function applyAiResult() {
  if (!aiResult.value) return;
  // AI 产出完整 CREATE 定义,编辑器只持主体 → 复用 extractRoutineBody 取 body 回填
  setEditorSql(extractRoutineBody({ definition: aiResult.value, language: language.value }));
  Notify.create({ type: "positive", message: "已应用到编辑器", position: "top", timeout: 1200 });
}

watch(
  () => props.node?.id,
  () => loadProcedure(),
  { immediate: true },
);
</script>

<template>
  <div class="db-procedure-editor column no-wrap full-height bg-dark text-white">
    <div class="row items-center q-px-sm q-py-xs db-procedure-editor__header">
      <q-icon :name="isProcedure ? 'settings_suggest' : 'functions'" size="sm" class="q-mr-xs text-deep-orange-4" />
      <div class="text-subtitle2 ellipsis">{{ title }}</div>
    </div>
    <q-separator dark />

    <div class="row no-wrap col db-procedure-editor__body">
      <div class="col column no-wrap db-procedure-editor__left">
        <div class="row items-center q-px-sm q-py-xs q-gutter-x-sm db-procedure-editor__toolbar">
          <q-toggle v-model="testCommit" label="真实提交" dark dense size="sm" color="negative" />
          <q-btn
            dense
            flat
            no-caps
            size="sm"
            icon="play_arrow"
            color="positive"
            label="测试运行"
            :loading="testRunning"
            :disable="!serverDbId"
            @click="runTest"
          >
            <q-tooltip>默认在事务内执行后自动回滚(不落库);需真正写入时打开「真实提交」</q-tooltip>
          </q-btn>
          <q-space />
          <q-btn dense flat no-caps size="sm" icon="format_align_left" color="primary" label="格式化" @click="formatSql" />
          <q-btn dense flat no-caps size="sm" icon="save" color="primary" label="保存" :loading="loading" :disable="!serverDbId" @click="saveProcedure" />
        </div>

        <div class="db-procedure-editor__code row no-wrap">
          <div class="col relative-position" style="min-width: 0">
            <q-inner-loading :showing="loading" dark />
            <SqlQueryEditor ref="sqlEditor" embedded />
          </div>
          <div class="db-procedure-editor__schema">
            <DbSchemaTree :server-db-id="serverDbId" @insert="onSchemaInsert" />
          </div>
        </div>

        <q-separator dark />
        <div class="db-procedure-editor__result row no-wrap">
          <div class="col column no-wrap" style="min-width: 0">
            <div class="text-caption text-grey-5 q-px-sm q-py-xs db-procedure-editor__result-label">
              返回结果 <span class="text-grey-6 q-ml-xs">({{ testRows.length }} 行)</span>
            </div>
            <div class="col" style="min-height: 0">
              <SqlResultTable :rows="testRows" :columns="testColumns" :loading="testRunning" :editable="false" />
            </div>
          </div>
          <q-separator dark vertical />
          <div class="column no-wrap db-procedure-editor__log">
            <div class="text-caption text-grey-5 q-px-sm q-py-xs db-procedure-editor__result-label">打印日志</div>
            <div class="col" style="min-height: 0">
              <SqlNoticeLog :notices="testNotices" />
            </div>
          </div>
        </div>
      </div>

      <q-separator dark vertical />

      <div class="column no-wrap db-procedure-editor__ai">
        <div class="text-caption text-grey-5 q-px-sm q-py-xs">AI 编辑器(自然语言生成 SQL)</div>
        <div v-if="aiResult" class="q-pa-sm db-procedure-editor__ai-result">
          <div class="text-caption text-grey-5 q-mb-xs">AI 结果(确认后应用)</div>
          <pre class="db-procedure-editor__ai-sql" style="white-space: pre-wrap; word-break: break-word; font-size: 12px; margin: 0">{{ aiResult }}</pre>
        </div>

        <div class="q-pa-sm column q-gutter-y-xs">
          <q-input
            v-model="aiPrompt"
            dark
            dense
            outlined
            type="textarea"
            autogrow
            :label="isProcedure ? '描述你想要的存储过程' : '描述你想要的函数'"
            input-style="max-height: 120px"
          />
          <div class="row items-center q-gutter-x-sm justify-end">
            <q-btn dense flat no-caps size="sm" icon="auto_awesome" color="light-blue-4" label="生成" :loading="aiRunning" :disable="!canRunAi" @click="runAi" />
            <q-btn dense flat no-caps size="sm" icon="done" color="positive" label="应用" :disable="!aiResult" @click="applyAiResult" />
          </div>
        </div>
      </div>

      <q-separator dark vertical />

      <div class="column no-wrap db-procedure-editor__panel">
        <div class="column q-pa-sm q-gutter-y-sm">
          <q-card dark flat bordered>
            <q-card-section class="q-pa-sm column q-gutter-y-sm">
              <div class="row items-center q-gutter-x-sm">
                <q-icon :name="isProcedure ? 'settings_suggest' : 'functions'" size="sm" :class="isProcedure ? 'text-deep-orange-4' : 'text-light-blue-4'" />
                <div class="text-subtitle2">{{ isProcedure ? "存储过程配置" : "函数配置" }}</div>
              </div>
              <q-input :model-value="procedureName" label="名称" dark dense outlined readonly />
              <q-select
                v-model="language"
                :options="languageOptions"
                label="语言"
                dark
                dense
                outlined
                options-dense
                emit-value
                map-options
              />
            </q-card-section>
          </q-card>

          <q-card dark flat bordered>
            <q-card-section class="q-pa-sm column q-gutter-y-sm">
              <div class="row items-center q-gutter-x-sm">
                <div class="text-subtitle2">输入</div>
                <q-space />
                <q-btn dense flat size="sm" icon="add" color="primary" @click="addInputParam" />
              </div>
              <div v-if="inputParams.length" class="column q-gutter-y-xs">
                <div
                  v-for="(param, index) in inputParams"
                  :key="param.id"
                  class="row items-center q-gutter-x-sm no-wrap"
                >
                  <q-input
                    v-model="param.name"
                    label="名称"
                    dark
                    dense
                    outlined
                    class="col"
                  />
                  <q-select
                    v-model="param.type"
                    :options="typeOptions"
                    label="类型"
                    dark
                    dense
                    outlined
                    options-dense
                    use-input
                    hide-selected
                    fill-input
                    input-debounce="0"
                    class="db-procedure-editor__type-select"
                  />
                  <q-btn dense flat size="sm" icon="delete" color="negative" @click="removeInputParam(index)" />
                </div>
              </div>
              <div v-else class="text-caption text-grey-6">无输入参数</div>
            </q-card-section>
          </q-card>

          <q-card v-if="inputParams.length" dark flat bordered>
            <q-card-section class="q-pa-sm column q-gutter-y-sm">
              <div class="row items-center q-gutter-x-sm">
                <q-icon name="bolt" size="sm" class="text-positive" />
                <div class="text-subtitle2">模拟测试</div>
              </div>
              <div class="column q-gutter-y-xs">
                <div
                  v-for="param in inputParams"
                  :key="param.id"
                  class="row items-center q-gutter-x-sm no-wrap"
                >
                  <q-input
                    v-model="param.testValue"
                    :label="`${param.name || 'arg'} (${param.type})`"
                    :disable="param.testNull"
                    dark
                    dense
                    outlined
                    class="col"
                  />
                  <q-checkbox v-model="param.testNull" label="NULL" dark dense size="sm" />
                </div>
              </div>
            </q-card-section>
          </q-card>

          <q-card v-if="!isProcedure" dark flat bordered>
            <q-card-section class="q-pa-sm column q-gutter-y-sm">
              <div class="text-subtitle2">输出</div>
              <q-select
                v-model="returnsStr"
                label="返回类型"
                :options="typeOptions"
                dark
                dense
                outlined
                options-dense
                use-input
                hide-selected
                fill-input
                input-debounce="0"
              />
              <q-badge v-if="signature.output" dark color="teal-7" class="self-start">
                {{ signature.output.type }}
              </q-badge>
              <div v-else class="text-caption text-grey-6">无返回值</div>
            </q-card-section>
          </q-card>

          <q-card v-if="comment" dark flat bordered>
            <q-card-section class="q-pa-sm column q-gutter-y-sm">
              <div class="text-subtitle2">注释</div>
              <q-input
                v-model="comment"
                dark
                dense
                outlined
                autogrow
                type="textarea"
                input-style="min-height: 48px"
                readonly
              />
            </q-card-section>
          </q-card>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.db-procedure-editor {
  min-height: 0;
}

.db-procedure-editor__header {
  background: rgba(255, 255, 255, 0.04);
}

.db-procedure-editor__body {
  min-height: 0;
  overflow: hidden;
}

.db-procedure-editor__left {
  min-width: 0;
  min-height: 0;
}

.db-procedure-editor__toolbar {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.db-procedure-editor__code {
  position: relative;
  flex: 3 1 0;
  min-height: 0;
  overflow: hidden;
}

.db-procedure-editor__schema {
  width: 200px;
  min-width: 200px;
  border-left: 1px solid rgba(255, 255, 255, 0.08);
  overflow: hidden;
  padding: 4px;
}

.db-procedure-editor__result {
  flex: 2 1 0;
  min-height: 0;
  overflow: hidden;
}

.db-procedure-editor__result-label {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.db-procedure-editor__log {
  width: 280px;
  min-width: 280px;
  min-height: 0;
}

.db-procedure-editor__panel {
  width: 360px;
  min-width: 360px;
  min-height: 0;
  overflow-y: auto;
}

.db-procedure-editor__ai {
  width: 320px;
  min-width: 320px;
  min-height: 0;
}

.db-procedure-editor__terminal {
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.db-procedure-editor__type-select {
  width: 96px;
  min-width: 96px;
}
</style>
