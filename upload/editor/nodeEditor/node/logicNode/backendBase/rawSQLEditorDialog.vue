<script setup>
import { ref, computed } from "vue";
import { Notify } from "quasar";
import { useDebounceFn } from "@vueuse/core";
import codeEditorSrc from "src/components/editor/codeEditor/CodeMirror/CodeMirror..vue";
import DbSchemaTree from "src/components/editor/dbTableEditor/DbSchemaTree.vue";
import SqlResultTable from "src/components/editor/dbTableEditor/SqlResultTable.vue";
import api from "src/services/api.js";
import { useProjectStore } from "src/stores/projectMange.js";

// v-model:show 控制显隐;node 为 rawSQLNode 实例
const show = defineModel("show", { type: Boolean, default: false });
const props = defineProps({
  node: { type: Object, default: null },
});

const projectStore = useProjectStore();

const properties = computed(() => props.node?.properties || {});
const sqlText = computed(() => properties.value.sql || "");
const slotVars = computed(() => properties.value.slotVars || []);

// 父 DatabaseSubgraph 绑定的数据库连接 id,即 execute-sql 的 serverDbId
const serverDbId = computed(
  () => props.node?.graph?._subgraph_node?.properties?.dbConnectionId || "",
);

const cmRef = ref(null);

// ─── SQL 编辑(写回 + 同步 slot + 刷新代码) ───
const applySqlChange = useDebounceFn((val) => {
  if (!properties.value) return;
  properties.value.sql = val ?? "";
  props.node?.syncSlotsFromSql?.();
  props.node?.onExecute?.();
  props.node?.graph?.setDirtyCanvas?.(true, true);
}, 300);

function onSqlChange(val) {
  applySqlChange(val);
}

function clearSql() {
  if (!properties.value) return;
  properties.value.sql = "";
  props.node?.syncSlotsFromSql?.();
  props.node?.onExecute?.();
  props.node?.graph?.setDirtyCanvas?.(true, true);
}

// ─── 库表字段树双击 → 光标插入 ───
function onInsert(text) {
  cmRef.value?.insertText?.(text);
}

// ─── 参数列表(以 {{占位符}} 为源) ───
// 改名:动态联动 —— 节点内原地改 sql 占位符 + slotVars + input slot,保住连线
function onRenameParam(oldName, val) {
  const newName = (val || "").trim();
  if (!newName || newName === oldName) return;
  props.node?.renameSqlVar?.(oldName, newName);
}

function setTestValue(name, val) {
  if (!properties.value) return;
  if (!properties.value.testValues) properties.value.testValues = {};
  properties.value.testValues[name] = val;
}

// ─── 测试执行 ───
const testing = ref(false);
const resultRows = ref([]);
const resultColumns = ref([]);

// 把测试值转成 SQL 字面量:空→NULL / 纯数字原样 / true|false 原样 / 其余单引号字符串(转义)
function toSqlLiteral(v) {
  if (v === undefined || v === null || String(v).trim() === "") return "NULL";
  const s = String(v).trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) return s;
  if (s === "true" || s === "false") return s;
  return `'${s.replace(/'/g, "''")}'`;
}

async function runTest() {
  if (!serverDbId.value) {
    Notify.create({
      type: "warning",
      message: "请先在父 Database 节点配置数据库连接",
      position: "top",
    });
    return;
  }
  const rawSql = properties.value.sql || "";
  if (!rawSql.trim()) {
    Notify.create({ type: "warning", message: "SQL 为空", position: "top" });
    return;
  }

  const tv = properties.value.testValues || {};
  const sql = rawSql.replace(/\{\{(\w+)\}\}/g, (_, name) => toSqlLiteral(tv[name]));

  testing.value = true;
  try {
    const resp = await api.post("/api/db/execute-sql", {
      serverDbId: serverDbId.value,
      sql,
      projectId: projectStore.currentProjectId,
    });
    if (resp.data.success) {
      const { rows, columns } = resp.data.data;
      resultRows.value = rows || [];
      resultColumns.value = (columns || []).map((c) => ({
        name: c.name,
        type: c.type || "",
      }));
      Notify.create({
        type: "positive",
        message: `返回 ${resultRows.value.length} 行`,
        position: "top",
        timeout: 1500,
      });
    } else {
      Notify.create({
        type: "negative",
        message: resp.data.message || "执行失败",
        position: "top",
      });
    }
  } catch (e) {
    Notify.create({
      type: "negative",
      message: `执行失败: ${e.response?.data?.message || e.message}`,
      position: "top",
    });
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <q-dialog v-model="show">
    <q-card dark class="bg-dark text-white column raw-sql-dialog">
      <!-- 头部工具栏 -->
      <q-card-section class="row items-center q-py-sm col-auto raw-sql-dialog__header">
        <q-icon name="code" size="sm" class="q-mr-xs text-deep-orange-4" />
        <div class="text-subtitle2">编辑 SQL</div>
        <q-space />
        <q-btn
          dense
          flat
          no-caps
          icon="play_arrow"
          color="positive"
          label="测试"
          :loading="testing"
          :disable="!serverDbId"
          @click="runTest"
        >
          <q-tooltip v-if="!serverDbId" class="bg-dark">请先在父 Database 节点配置数据库连接</q-tooltip>
        </q-btn>
        <q-btn dense flat no-caps icon="clear" color="grey" label="清空" class="q-ml-xs" @click="clearSql" />
        <q-btn icon="close" flat round dense class="q-ml-xs" v-close-popup />
      </q-card-section>

      <q-separator dark />

      <!-- 主体:左(编辑器/结果) + 右(表字段树/参数) -->
      <q-card-section class="col raw-sql-dialog__body q-pa-none">
        <div class="row no-wrap full-height">
          <!-- 左:SQL 编辑器 + 测试结果 -->
          <div class="col column raw-sql-dialog__left">
            <div class="raw-sql-dialog__editor">
              <codeEditorSrc
                ref="cmRef"
                :value="sqlText"
                lang="sql"
                :line-numbers="true"
                :line-wrapping="true"
                filename="raw.sql"
                @change="onSqlChange"
              />
            </div>
            <div class="raw-sql-dialog__result column">
              <div class="text-caption text-grey-5 q-px-sm q-py-xs raw-sql-dialog__result-label">
                测试结果
                <span class="text-grey-6 q-ml-xs">({{ resultRows.length }} 行)</span>
              </div>
              <div class="col">
                <SqlResultTable
                  :rows="resultRows"
                  :columns="resultColumns"
                  :loading="testing"
                  :editable="false"
                />
              </div>
            </div>
          </div>

          <q-separator dark vertical />

          <!-- 右:Part1 表字段树 / Part2 参数列表 -->
          <div class="column no-wrap raw-sql-dialog__right">
            <!-- Part 1 -->
            <div class="column no-wrap raw-sql-dialog__schema">
              <div class="text-caption text-grey-5 q-px-sm q-py-xs">
                表 / 字段
                <span class="text-grey-6">(双击插入)</span>
              </div>
              <div class="col q-px-sm" style="min-height: 0;">
                <DbSchemaTree :server-db-id="serverDbId" @insert="onInsert" />
              </div>
            </div>

            <q-separator dark />

            <!-- Part 2 -->
            <div class="column no-wrap raw-sql-dialog__params">
              <div class="text-caption text-grey-5 q-px-sm q-py-xs">
                参数
                <span class="text-grey-6 q-ml-xs">({{ slotVars.length }})</span>
              </div>
              <div class="col scroll q-px-sm q-pb-sm">
                <div v-if="slotVars.length === 0" class="text-caption text-grey-6 q-pa-xs">
                  在 SQL 中使用
                  <code class="bg-grey-9 q-px-xs" v-pre>{{name}}</code>
                  自动生成参数。
                </div>
                <div
                  v-for="sv in slotVars"
                  :key="sv.id"
                  class="row items-center q-gutter-x-xs q-mb-xs no-wrap"
                >
                  <q-input
                    dense
                    dark
                    outlined
                    class="col"
                    :model-value="sv.name"
                    @update:model-value="(val) => onRenameParam(sv.name, val)"
                    label="参数名"
                  />
                  <q-input
                    dense
                    dark
                    outlined
                    class="col"
                    :model-value="properties.testValues?.[sv.name]"
                    @update:model-value="(val) => setTestValue(sv.name, val)"
                    label="测试值"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
.raw-sql-dialog {
  width: 92vw;
  max-width: 92vw;
  height: 86vh;
  max-height: 86vh;
}

.raw-sql-dialog__header {
  background: rgba(255, 255, 255, 0.04);
}

.raw-sql-dialog__body {
  min-height: 0;
  overflow: hidden;
}

.raw-sql-dialog__left {
  min-width: 0;
  min-height: 0;
}

/* 编辑器占左侧上部,结果表占下部 */
.raw-sql-dialog__editor {
  flex: 3 1 0;
  min-height: 0;
  overflow: hidden;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
}

.raw-sql-dialog__result {
  flex: 2 1 0;
  min-height: 0;
  overflow: hidden;
}

.raw-sql-dialog__result-label {
  flex-shrink: 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.08);
}

.raw-sql-dialog__right {
  width: 320px;
  min-width: 320px;
  min-height: 0;
}

.raw-sql-dialog__schema {
  flex: 1 1 0;
  min-height: 0;
}

.raw-sql-dialog__params {
  flex: 1 1 0;
  min-height: 0;
}

code {
  border-radius: 3px;
  font-size: 12px;
}
</style>
