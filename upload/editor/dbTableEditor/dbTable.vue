<template>
  <div class="table-container">
    <!-- Tab 切换：SQL 编辑器 / 日志 -->
    <q-tabs v-model="activeTab" dense dark align="left" narrow-indicator inline-label no-caps
      class="db-tabs text-grey-4" active-color="primary" indicator-color="primary">
      <q-tab name="sql" icon="code" label="SQL" />
      <q-tab name="log" icon="terminal" label="日志" />
    </q-tabs>

    <q-tab-panels v-model="activeTab" keep-alive class="db-tab-panels">
      <q-tab-panel name="sql" class="q-pa-none">
        <div class="row no-wrap full-height">
          <div class="col" style="min-width: 0;">
            <SqlQueryEditor ref="sqlEditor" @execute-result="handleSqlExecuteResult" @log="handleSqlLog" />
          </div>
          <div class="sql-schema-pane">
            <DbSchemaTree :server-db-id="currentGraphId" @insert="onSchemaInsert" />
          </div>
        </div>
      </q-tab-panel>
      <q-tab-panel name="log" class="q-pa-none">
        <DbTerminal ref="dbTerminal" />
      </q-tab-panel>
    </q-tab-panels>

    <!-- 结果表格(共享组件 SqlResultTable) -->
    <div class="result-area">
      <SqlResultTable
        ref="resultTable"
        editable
        show-pager
        :rows="tableData"
        :columns="columns"
        :loading="loading"
        :page="tablePage"
        :toolbar-buttons="toolbarButtons"
        @toolbar-button="buttonClickEvent"
        @edit-closed="handleEditClosed"
        @cell-dblclick="handleCellDblClick"
        @page-change="handlePageChange"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, onUnmounted } from "vue";
import { useQuasar } from "quasar";
import api from "../../../services/api.js";
import { useProjectStore } from "../../../stores/projectMange";

const $q = useQuasar();
const projectStore = useProjectStore();
import {
  currentSelectTreeNode,
  currentGraphId,
  graphLoading,
} from "../dbDragEditor/hooks/useDbConfig";
import { dbTreeManager } from "../dbDragEditor/hooks/useDbTreeManager";
import SqlQueryEditor from "./SqlQueryEditor.vue";
import DbTerminal from "./DbTerminal.vue";
import SqlResultTable from "./SqlResultTable.vue";
import DbSchemaTree from "./DbSchemaTree.vue";

const manager = dbTreeManager();

// 当前关联的表节点（选中 table 或 field 时都能解析到对应的表）
const currentTableNode = computed(() => {
  const node = currentSelectTreeNode.value;
  if (!node) return null;
  if (node.type === manager.NODE_TYPES.TABLE) return node;
  if (node.type === manager.NODE_TYPES.FIELD) {
    return manager.findNearestParentByType(node, manager.NODE_TYPES.TABLE);
  }
  return null;
});

// Tab 状态
const activeTab = ref("sql");

// 表格数据相关
const resultTable = ref(null);
const sqlEditor = ref(null);
const dbTerminal = ref(null);
const loading = ref(false);
const tableData = ref([]);
const columns = ref([]);
const primaryKeys = ref([]);
const currentEditingRow = ref(null);
// 用于取消未完成的表数据请求
let tableDataAbortController = null;

// 分页配置
const tablePage = ref({
  total: 0,
  currentPage: 1,
  pageSize: 50,
});

const toolbarButtons = ref([
  { name: "新增", code: "add", status: "grey-10" },
  { name: "复制行", code: "copy", status: "grey-10" },
  { name: "删除选中", code: "del", status: "grey-10" },
  { name: "刷新", code: "refresh", status: "grey-10" },
]);

// 库表字段树双击 → 插入到 SQL 编辑器光标处
const onSchemaInsert = (name) => {
  if (activeTab.value !== "sql") activeTab.value = "sql";
  sqlEditor.value?.insertText?.(name);
};

// 加载表数据
const loadTableData = async () => {
  if (!currentTableNode.value) return;

  const tableName = currentTableNode.value.name;
  const serverDbId = currentGraphId.value;

  if (!tableName || !serverDbId) return;

  // 取消上一个未完成的请求
  if (tableDataAbortController) tableDataAbortController.abort();
  tableDataAbortController = new AbortController();

  loading.value = true;
  try {
    const response = await api.post("/api/db/table/data", {
      serverDbId,
      tableName,
      page: tablePage.value.currentPage,
      pageSize: tablePage.value.pageSize,
      projectId: projectStore.currentProjectId,
    }, {
      signal: tableDataAbortController.signal,
    });

    if (response.data.success) {
      const { rows, columns: cols, total, primaryKeys: pks } = response.data.data;
      tableData.value = rows || [];
      columns.value = cols || [];
      primaryKeys.value = pks || [];
      tablePage.value.total = total || 0;
    }
  } catch (error) {
    // 被 abort 的请求不需要报错
    if (error.name === 'AbortError' || error.code === 'ERR_CANCELED') return;
    console.error("加载表数据失败:", error);
    $q.notify({
      message: `加载数据失败: ${error.message}`,
      type: "negative",
      position: "top",
      timeout: 2000,
    });
    if (dbTerminal.value) {
      dbTerminal.value.appendLog(`加载数据失败: ${error.message}`, 'error');
    }
  } finally {
    loading.value = false;
  }
};

// 清空表格数据
const clearTableData = () => {
  tableData.value = [];
  columns.value = [];
  primaryKeys.value = [];
  tablePage.value.total = 0;
};

// 监听当前关联的表节点变化（graph 优先，表数据延后加载）
watch(
  currentTableNode,
  (newVal, oldVal) => {
    if (newVal && newVal.id !== oldVal?.id) {
      tablePage.value.currentPage = 1;
      // 等待 graph 渲染完一帧后再加载表数据，避免抢占主线程
      requestAnimationFrame(() => {
        if (!graphLoading.value) {
          loadTableData();
        }
      });
    } else if (!newVal) {
      clearTableData();
    }
  },
);

const buttonClickEvent = ({ code }) => {
  switch (code) {
    case "add":
      handleAdd();
      break;
    case "copy":
      handleCopyRows();
      break;
    case "del":
      handleDelSelected();
      break;
    case "refresh":
      loadTableData();
      break;
  }
};

// 单元格双击事件
const handleCellDblClick = ({ row }) => {
  currentEditingRow.value = { ...row };
};

// 获取行的主键值
const getRowPrimaryKeys = (row) => {
  const pkValues = {};
  for (const pk of primaryKeys.value) {
    pkValues[pk] = row[pk];
  }
  return pkValues;
};

// 单元格编辑完成事件 - 调用 PUT API 更新
const handleEditClosed = async ({ row, column }) => {
  if (!currentEditingRow.value) return;

  const oldValue = currentEditingRow.value[column.property];
  const newValue = row[column.property];

  if (oldValue === newValue) {
    currentEditingRow.value = null;
    return;
  }

  // 检查是否有主键
  if (primaryKeys.value.length === 0) {
    $q.notify({
      message: "表没有主键，无法更新数据",
      type: "warning",
      position: "top",
      timeout: 2000,
    });
    // 恢复原值
    row[column.property] = oldValue;
    currentEditingRow.value = null;
    return;
  }

  // 检查是否是新行（主键值为空）
  const pkValues = getRowPrimaryKeys(row);
  const hasEmptyPk = Object.values(pkValues).some(v => v === null || v === undefined || v === '');

  if (hasEmptyPk) {
    // 新行，不需要更新，等用户填完再提交
    currentEditingRow.value = null;
    return;
  }

  const tableName = currentTableNode.value?.name;
  const serverDbId = currentGraphId.value;

  if (!tableName || !serverDbId) {
    row[column.property] = oldValue;
    currentEditingRow.value = null;
    $q.notify({
      message: "无法更新：未选择有效的表",
      type: "warning",
      position: "top",
      timeout: 2000,
    });
    return;
  }

  loading.value = true;
  try {
    const response = await api.put("/api/db/table/row", {
      serverDbId,
      tableName,
      primaryKeys: pkValues,
      rowData: { [column.property]: newValue },
      projectId: projectStore.currentProjectId,
    });

    if (response.data.success) {
      $q.notify({ message: "更新成功", type: "positive", position: "top", timeout: 1500 });
      // 更新本地数据
      if (response.data.data) {
        Object.assign(row, response.data.data);
      }
    } else {
      // 恢复原值
      row[column.property] = oldValue;
      $q.notify({
        message: response.data.message || "更新失败",
        type: "negative",
        position: "top",
        timeout: 2000,
      });
    }
  } catch (error) {
    console.error("更新数据失败:", error);
    // 恢复原值
    row[column.property] = oldValue;
    $q.notify({
      message: `更新失败: ${error.message}`,
      type: "negative",
      position: "top",
      timeout: 2000,
    });
    // 输出到日志终端
    if (dbTerminal.value) {
      dbTerminal.value.appendLog(`更新失败: ${error.message}`, 'error');
    }
  } finally {
    loading.value = false;
    currentEditingRow.value = null;
  }
};

// 添加新行 - 调用 POST API 插入数据
const handleAdd = async () => {
  const tableName = currentTableNode.value?.name;
  const serverDbId = currentGraphId.value;

  if (!tableName || !serverDbId) {
    $q.notify({
      message: "请先选择一个表",
      type: "warning",
      position: "top",
      timeout: 2000,
    });
    return;
  }

  const newRow = { _isNew: true };
  columns.value.forEach((col) => {
    newRow[col.name] = col.defaultValue || null;
  });

  // 先添加到表格顶部显示
  tableData.value.unshift(newRow);

  try {
    const response = await api.post("/api/db/table/row", {
      serverDbId,
      tableName,
      rowData: {},
      projectId: projectStore.currentProjectId,
    });

    if (response.data.success) {
      // 用服务器返回的数据替换本地新行
      const insertedRow = response.data.data;
      Object.assign(newRow, insertedRow);
      delete newRow._isNew;
      $q.notify({ message: "新增成功", type: "positive", position: "top", timeout: 1500 });
    } else {
      // 移除新行
      tableData.value.shift();
      $q.notify({
        message: response.data.message || "新增失败",
        type: "negative",
        position: "top",
        timeout: 2000,
      });
    }
  } catch (error) {
    console.error("新增数据失败:", error);
    // 移除新行
    tableData.value.shift();
    $q.notify({
      message: `新增失败: ${error.message}`,
      type: "negative",
      position: "top",
      timeout: 2000,
    });
    // 输出到日志终端
    if (dbTerminal.value) {
      dbTerminal.value.appendLog(`新增失败: ${error.message}`, 'error');
    }
  }
};

// 复制选中行并创建新行
const handleCopyRows = async () => {
  const selectRecords = resultTable.value.getCheckboxRecords();
  if (selectRecords.length === 0) {
    $q.notify({
      message: "请选择要复制的数据",
      type: "warning",
      position: "top",
      timeout: 2000,
    });
    return;
  }

  const tableName = currentTableNode.value?.name;
  const serverDbId = currentGraphId.value;

  if (!tableName || !serverDbId) {
    $q.notify({
      message: "请先选择一个表",
      type: "warning",
      position: "top",
      timeout: 2000,
    });
    return;
  }

  let successCount = 0;
  let failCount = 0;

  for (const record of selectRecords) {
    // 复制行数据，移除主键值（让数据库自动生成）和 VXE-Table 内部属性
    const rowData = {};
    for (const [key, value] of Object.entries(record)) {
      // 跳过主键、以 _ 开头的内部属性
      if (primaryKeys.value.includes(key) || key.startsWith('_')) {
        continue;
      }
      rowData[key] = value;
    }

    try {
      const response = await api.post("/api/db/table/row", {
        serverDbId,
        tableName,
        rowData,
        projectId: projectStore.currentProjectId,
      });

      if (response.data.success) {
        const insertedRow = response.data.data;
        tableData.value.unshift(insertedRow);
        successCount++;
      } else {
        failCount++;
      }
    } catch (error) {
      failCount++;
      console.error("复制行失败:", error);
    }
  }

  if (successCount > 0) {
    $q.notify({
      message: `成功复制 ${successCount} 行${failCount > 0 ? `，失败 ${failCount} 行` : ''}`,
      type: successCount > 0 && failCount === 0 ? "positive" : "warning",
      position: "top",
      timeout: 2000,
    });
  } else {
    $q.notify({
      message: "复制失败",
      type: "negative",
      position: "top",
      timeout: 2000,
    });
  }
};

// 删除选中行 - 调用 DELETE API 批量删除
const handleDelSelected = async () => {
  const selectRecords = resultTable.value.getCheckboxRecords();
  if (selectRecords.length === 0) {
    $q.notify({
      message: "请选择要删除的数据",
      type: "warning",
      position: "top",
      timeout: 2000,
    });
    return;
  }

  // 检查是否有主键
  if (primaryKeys.value.length === 0) {
    $q.notify({
      message: "表没有主键，无法删除数据",
      type: "warning",
      position: "top",
      timeout: 2000,
    });
    return;
  }

  try {
    // 使用 Quasar 的确认对话框
    $q.dialog({
      title: '确认删除',
      message: '确定要删除选中的数据吗？',
      ok: { label: '删除', color: 'negative', flat: true, dense: true },
      cancel: { label: '取消', color: 'grey', flat: true, dense: true },
      persistent: true,
      dark: true,
      class: 'bg-grey-10 text-white'
    }).onOk(async () => {
      const tableName = currentTableNode.value?.name;
      const serverDbId = currentGraphId.value;

      if (!tableName || !serverDbId) {
        $q.notify({
          message: "无法删除：未选择有效的表",
          type: "warning",
          position: "top",
          timeout: 2000,
        });
        return;
      }

      // 构建要删除的行（只包含主键值）
      const rowsToDelete = selectRecords.map(record => {
        const pkValues = {};
        for (const pk of primaryKeys.value) {
          pkValues[pk] = record[pk];
        }
        return pkValues;
      });

      loading.value = true;
      try {
        const response = await api.delete("/api/db/table/rows", {
          data: {
            serverDbId,
            tableName,
            rows: rowsToDelete,
            projectId: projectStore.currentProjectId,
          },
        });

        if (response.data.success) {
          // 从本地数据中移除
          const pks = primaryKeys.value;
          tableData.value = tableData.value.filter((item) => {
            return !selectRecords.some(record => {
              return pks.every(pk => record[pk] === item[pk]);
            });
          });
          $q.notify({
            message: `删除成功，共删除 ${response.data.data.deletedCount} 条记录`,
            type: "positive",
            position: "top",
            timeout: 2000,
          });
        } else {
          $q.notify({
            message: response.data.message || "删除失败",
            type: "negative",
            position: "top",
            timeout: 2000,
          });
        }
      } catch (e) {
        console.error("删除数据失败:", e);
        $q.notify({
          message: `删除失败: ${e.message}`,
          type: "negative",
          position: "top",
          timeout: 2000,
        });
        // 输出到日志终端
        if (dbTerminal.value) {
          dbTerminal.value.appendLog(`删除失败: ${e.message}`, 'error');
        }
      } finally {
        loading.value = false;
      }
    });
  } catch (e) {
    console.error("删除操作失败:", e);
  }
};

// 分页改变事件
const handlePageChange = ({ currentPage, pageSize }) => {
  tablePage.value.currentPage = currentPage;
  tablePage.value.pageSize = pageSize;
  loadTableData();
};

// SQL 执行结果处理
const handleSqlExecuteResult = ({ rows, columns: cols }) => {
  // 将 SQL 查询结果显示在表格中
  if (rows && cols) {
    tableData.value = rows;
    columns.value = cols.map(c => ({
      name: c.name,
      type: '',
      isPrimaryKey: false,
    }));
    primaryKeys.value = [];
    tablePage.value.total = rows.length;
    tablePage.value.currentPage = 1;
  }
};

// SQL 日志处理
const handleSqlLog = ({ message, type }) => {
  console.log(`[SQL ${type}]`, message);
  // 输出到终端
  if (dbTerminal.value) {
    dbTerminal.value.appendLog(message, type);
  }
};

onUnmounted(() => {
  if (tableDataAbortController) tableDataAbortController.abort();
});
</script>

<style>
.table-container {
  display: flex;
  flex-direction: column;
  height: 100%;
  width: 100%;
  background-color: var(--q-dark);
}

.db-tabs {
  flex-shrink: 0;
  min-height: 28px !important;
  background-color: #1a1a1a;
  border-bottom: 1px solid #333;
}

.db-tabs .q-tab {
  min-height: 28px !important;
  padding: 0 8px !important;
}

.db-tabs .q-tab__label {
  font-size: 12px;
}

.db-tabs .q-tab__icon {
  font-size: 14px;
}

.db-tab-panels {
  flex: 4;
  min-height: 0;
  overflow: hidden;
  background-color: #1e1e1e;
}

.db-tab-panels .q-tab-panel {
  padding: 0;
  height: 100%;
}

/* SQL 标签页:左编辑器 + 右库表字段树 */
.sql-schema-pane {
  width: 220px;
  min-width: 220px;
  border-left: 1px solid #333;
  background-color: #1a1a1a;
  overflow: hidden;
  padding: 4px;
}

.result-area {
  display: flex;
  flex-direction: column;
  flex: 6;
  min-height: 0;
  overflow: hidden;
}
</style>
