<script setup>
import { ref, computed } from "vue";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";
import RawSQLEditorDialog from "./rawSQLEditorDialog.vue";

// defineModel 双向绑定节点对象(与 tableNodePanel / dbSubgraphPanel 一致)
const props = defineModel();

const node = computed(() => props.value);
const properties = computed(() => props.value?.properties || {});

// 代码预览:后端节点优先读 bgJsCode
const generatedCodePreview = computed(
  () => props.value?.bgJsCode || props.value?.jsCode || "// 暂无生成的代码",
);

// 单一"输出"选择器:rows/first/raw 执行并出值,subquery 不执行只出 knex.raw 片段。
// 把原 outputMode(执行/片段)× resultMode(行形态)两轴塌成一个列表,subquery 与三种出值形态平级,
// 避免"两个模式都像在出值"的概念混淆。
const resultModeOptions = [
  { label: "rows · 行数组(执行)", value: "rows" },
  { label: "first · 首行(执行)", value: "first" },
  { label: "raw · 原样(执行)", value: "raw" },
  { label: "subquery · 子查询片段(不执行)", value: "subquery" },
];

function onResultModeChange(val) {
  if (!properties.value) return;
  properties.value.resultMode = val;
  node.value?.onExecute?.();
  node.value?.graph?.setDirtyCanvas?.(true, true);
}

// slotVars 只读列表(同步自 sql 占位符)
const slotVars = computed(() => properties.value.slotVars || []);

// SQL 编辑弹窗
const showDialog = ref(false);
</script>

<template>
  <BasePropertyPanel v-model="props" :code-content="generatedCodePreview">
    <div v-if="properties" class="column q-pa-sm q-gutter-y-sm">
      <!-- 提示:必须在 dbSubgraph 内 -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center text-body2 text-grey-4">
            <q-icon name="info" size="sm" class="q-mr-xs" />
            <span>必须放在 Database 子图内运行,引用 knex.raw 全局。</span>
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 1:SQL 编辑(弹窗) -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="row items-center q-mb-xs">
            <div class="text-caption text-grey-5">SQL 语句</div>
            <q-space />
            <q-btn dense flat no-caps size="sm" color="primary" icon="edit" label="编辑 SQL"
              @click="showDialog = true" />
          </div>
          <div
            class="sql-preview bg-grey-10 q-pa-sm rounded-borders"
            @click="showDialog = true"
          >
            <span v-if="properties.sql" class="text-monospace">{{ properties.sql }}</span>
            <span v-else class="text-grey-6">点击「编辑 SQL」打开编辑器(CodeMirror + 库表字段树 + 参数测试)</span>
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 2:占位符 → slot 列表(只读,详细编辑在弹窗) -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">
            占位符 → Input Slot
            <span class="text-grey-6 q-ml-xs">({{ slotVars.length }})</span>
          </div>
          <div v-if="slotVars.length === 0" class="text-body2 text-grey-6 q-pa-sm">
            暂无占位符。在 SQL 中加入
            <code class="bg-grey-9 q-px-xs" v-pre>{{name}}</code>
            即自动出现。
          </div>
          <div v-else class="row q-gutter-xs">
            <q-chip
              v-for="sv in slotVars"
              :key="sv.id"
              dense
              square
              color="blue-grey-9"
              text-color="grey-3"
              icon="input"
            >
              {{ sv.name }}
            </q-chip>
          </div>
        </q-card-section>
      </q-card>

      <!-- 分区 3:输出(单一选择器,subquery 与 rows/first/raw 平级) -->
      <q-card dark flat bordered>
        <q-card-section class="q-pa-sm">
          <div class="text-caption text-grey-5 q-mb-xs">输出</div>
          <q-select
            dense
            dark
            outlined
            :model-value="properties.resultMode || 'rows'"
            @update:model-value="onResultModeChange"
            :options="resultModeOptions"
            emit-value
            map-options
            label="输出形态"
          />
          <div class="text-caption text-grey-6 q-mt-xs">
            <span v-if="properties.resultMode === 'first'">
              执行查询,取首行,无行时返回 null。
            </span>
            <span v-else-if="properties.resultMode === 'raw'">
              执行查询,原样输出 knex.raw 的返回值,不做后处理。
            </span>
            <span v-else-if="properties.resultMode === 'subquery'">
              不执行,result slot 输出
              <code class="bg-grey-9 q-px-xs">knex.raw('sql', [...])</code>
              片段(不带别名),接下游子查询位:tableName(FROM 派生表),
              或 operator='raw'/'exists' 的 where / having。
            </span>
            <span v-else>
              执行查询,取 PG knex.raw 返回的行数组 (result.rows)。
            </span>
          </div>
        </q-card-section>
      </q-card>
    </div>
  </BasePropertyPanel>

  <!-- SQL 编辑弹窗 -->
  <RawSQLEditorDialog v-model:show="showDialog" :node="node" />
</template>

<style scoped>
.text-monospace {
  font-family: "Fira Code", Consolas, Monaco, monospace;
  font-size: 13px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-all;
}
.sql-preview {
  cursor: pointer;
  max-height: 120px;
  overflow: auto;
  min-height: 36px;
}
code {
  border-radius: 3px;
  font-size: 12px;
}
</style>
