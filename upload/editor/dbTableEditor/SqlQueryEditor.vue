<template>
  <div class="sql-editor-container">
    <div v-if="!embedded" class="sql-toolbar q-pa-xs row items-center q-gutter-xs">
      <q-btn
        flat
        dense
        icon="play_arrow"
        color="positive"
        size="sm"
        label="执行"
        :loading="executing"
        @click="executeSQL"
      />
      <q-btn
        flat
        dense
        icon="format_align_left"
        color="primary"
        size="sm"
        label="格式化"
        @click="formatSQL"
      />
      <q-btn
        flat
        dense
        icon="clear"
        color="grey"
        size="sm"
        label="清空"
        @click="clearSQL"
      />
      <q-space />
      <span v-if="executionTime !== null" class="text-grey-6 text-caption">
        执行耗时: {{ executionTime }}ms
      </span>
      <span class="text-grey-7 text-caption q-ml-sm">Ctrl+Enter 执行</span>
    </div>
    <div ref="editorContainer" class="sql-editor-wrapper"></div>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import { EditorState } from "@codemirror/state";
import { EditorView, keymap, lineNumbers, highlightActiveLine } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { sql, PostgreSQL } from "@codemirror/lang-sql";
import { oneDark } from "@codemirror/theme-one-dark";
import { syntaxHighlighting, defaultHighlightStyle } from "@codemirror/language";
import api from "../../../services/api.js";
import { currentGraphId } from "../dbDragEditor/hooks/useDbConfig";
import { useProjectStore } from "../../../stores/projectMange";

// embedded:嵌入到 DbSqlEditor 等场景时,隐藏自带工具栏、初值留空、Ctrl+Enter 交父组件处理
const props = defineProps({
  embedded: { type: Boolean, default: false },
});
const emit = defineEmits(["execute-result", "log", "run"]);
const projectStore = useProjectStore();

const editorContainer = ref(null);
const executing = ref(false);
const executionTime = ref(null);

let editorView = null;

// 初始化编辑器
const initEditor = () => {
  if (!editorContainer.value || editorView) return;

  const state = EditorState.create({
    doc: props.embedded ? "" : "SELECT * FROM table_name LIMIT 10;",
    extensions: [
      lineNumbers(),
      highlightActiveLine(),
      history(),
      keymap.of([...defaultKeymap, ...historyKeymap]),
      sql({ dialect: PostgreSQL }),
      syntaxHighlighting(defaultHighlightStyle),
      oneDark,
      EditorView.theme({
        "&": {
          height: "100%",
          fontSize: "13px",
        },
        ".cm-scroller": {
          overflow: "auto",
        },
        ".cm-content": {
          caretColor: "#fff",
        },
      }),
      // Ctrl+Enter:嵌入模式交父组件做包装预览,否则原样执行
      keymap.of([
        {
          key: "Ctrl-Enter",
          run: () => {
            if (props.embedded) emit("run");
            else executeSQL();
            return true;
          },
        },
      ]),
    ],
  });

  editorView = new EditorView({
    state,
    parent: editorContainer.value,
  });
};

// 获取 SQL 内容
const getSQL = () => {
  if (!editorView) return "";
  return editorView.state.doc.toString();
};

// 设置 SQL 内容
const setSQL = (content) => {
  if (!editorView) return;
  editorView.dispatch({
    changes: {
      from: 0,
      to: editorView.state.doc.length,
      insert: content,
    },
  });
};

// 执行 SQL
const executeSQL = async () => {
  const sqlContent = getSQL().trim();
  if (!sqlContent) {
    emit("log", { message: "SQL 内容为空", type: "warning" });
    return;
  }

  const serverDbId = currentGraphId.value;
  if (!serverDbId) {
    emit("log", { message: "请先选择数据库", type: "warning" });
    return;
  }

  executing.value = true;
  executionTime.value = null;
  emit("log", { message: `执行 SQL: ${sqlContent}`, type: "info" });

  try {
    const response = await api.post("/api/db/execute-sql", {
      serverDbId,
      sql: sqlContent,
      projectId: projectStore.currentProjectId,
    });

    if (response.data.success) {
      const { rows, columns, affectedRows, executionTime: time } = response.data.data;
      executionTime.value = time;
      emit("log", {
        message: `执行成功，返回 ${rows.length} 行，影响 ${affectedRows} 行，耗时 ${time}ms`,
        type: "success",
      });
      emit("execute-result", { rows, columns, affectedRows });
    } else {
      emit("log", { message: `执行失败: ${response.data.message}`, type: "error" });
    }
  } catch (error) {
    console.error("执行 SQL 失败:", error);
    // 获取更详细的错误信息
    const errorMsg = error.response?.data?.message || error.message;
    emit("log", { message: `执行失败: ${errorMsg}`, type: "error" });
  } finally {
    executing.value = false;
  }
};

// 格式化 SQL（简单实现）
const formatSQL = () => {
  const sqlContent = getSQL();
  // 简单格式化：关键字大写，添加换行
  const keywords = [
    "SELECT", "FROM", "WHERE", "AND", "OR", "JOIN", "LEFT", "RIGHT", "INNER",
    "OUTER", "ON", "GROUP BY", "ORDER BY", "HAVING", "LIMIT", "OFFSET",
    "INSERT", "INTO", "VALUES", "UPDATE", "SET", "DELETE", "CREATE", "TABLE",
    "ALTER", "DROP", "INDEX", "UNIQUE", "PRIMARY KEY", "FOREIGN KEY",
  ];

  let formatted = sqlContent;

  // 关键字大写
  keywords.forEach((kw) => {
    const regex = new RegExp(`\\b${kw}\\b`, "gi");
    formatted = formatted.replace(regex, kw);
  });

  // 主要子句前添加换行
  const newlineKeywords = ["FROM", "WHERE", "AND", "OR", "JOIN", "LEFT JOIN", "RIGHT JOIN", "INNER JOIN", "GROUP BY", "ORDER BY", "HAVING", "LIMIT"];
  newlineKeywords.forEach((kw) => {
    const regex = new RegExp(`\\s+${kw}\\b`, "gi");
    formatted = formatted.replace(regex, `\n${kw}`);
  });

  setSQL(formatted.trim());
};

// 清空 SQL
const clearSQL = () => {
  setSQL("");
  executionTime.value = null;
};

onMounted(() => {
  nextTick(() => {
    initEditor();
  });
});

onUnmounted(() => {
  if (editorView) {
    editorView.destroy();
    editorView = null;
  }
});

// 在当前光标/选区处插入文本(替换选区),供库表字段树双击插入调用
const insertText = (text) => {
  if (!editorView) return;
  const sel = editorView.state.selection.main;
  editorView.dispatch({
    changes: { from: sel.from, to: sel.to, insert: text },
    selection: { anchor: sel.from + text.length },
  });
  editorView.focus();
};

// 暴露方法
defineExpose({
  getSQL,
  setSQL,
  executeSQL,
  insertText,
  formatSQL,
});
</script>

<style scoped>
.sql-editor-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  background-color: #1e1e1e;
}

.sql-toolbar {
  background-color: #252526;
  border-bottom: 1px solid #333;
  flex-shrink: 0;
}

.sql-editor-wrapper {
  flex: 1;
  overflow: hidden;
}

.sql-editor-wrapper :deep(.cm-editor) {
  height: 100%;
}

.sql-editor-wrapper :deep(.cm-scroller) {
  font-family: "Consolas", "Monaco", monospace;
}
</style>
