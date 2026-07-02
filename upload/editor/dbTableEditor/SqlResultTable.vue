<template>
  <div class="sql-result-table column">
    <vxe-toolbar
      v-if="showToolbar"
      :buttons="toolbarButtons"
      @button-click="onToolbarButton"
      size="mini"
      background="dark"
    ></vxe-toolbar>

    <div class="table-wrapper col">
      <vxe-table
        ref="xTable"
        :data="rows"
        :loading="loading"
        :cell-config="{ height: 28 }"
        :row-config="{ isHover: true, isCurrent: true }"
        :current-row-config="{ isFollowSelected: true }"
        :column-config="{ resizable: true, minWidth: 120 }"
        :checkbox-config="{ highlight: true, range: true }"
        :scroll-x="{ enabled: true, gt: 0 }"
        :scroll-y="{ enabled: true }"
        :mouse-config="editable ? { selected: true } : null"
        :keyboard-config="editable ? { isArrow: true, isDel: true, isEnter: true, isTab: true, isEdit: true } : null"
        :edit-config="editable ? { trigger: 'dblclick', mode: 'cell', showStatus: true } : null"
        @edit-closed="(payload) => emit('edit-closed', payload)"
        @cell-dblclick="(payload) => emit('cell-dblclick', payload)"
        border
        stripe
        show-overflow
        show-header-overflow
        keep-source
        height="100%"
        size="mini"
      >
        <vxe-column v-if="editable" type="checkbox" width="36" fixed="left"></vxe-column>
        <vxe-column
          v-for="col in columns"
          :key="col.name"
          :field="col.name"
          :title="col.name"
          :edit-render="editable ? getEditRender(col) : null"
          :width="getColumnWidth(col)"
        >
          <template #header="{ column }">
            <span>{{ column.title }}</span>
            <span v-if="getColumnType(col)" class="column-type text-grey-6 q-ml-xs">({{ getColumnType(col) }})</span>
          </template>
        </vxe-column>
      </vxe-table>
    </div>

    <vxe-pager
      v-if="showPager"
      :current-page="page.currentPage"
      :page-size="page.pageSize"
      :total="page.total"
      :layouts="[
        'PrevJump',
        'PrevPage',
        'Jump',
        'PageCount',
        'NextPage',
        'NextJump',
        'Sizes',
        'Total',
      ]"
      :page-sizes="[10, 20, 50, 100, 500, 1000]"
      @page-change="(payload) => emit('page-change', payload)"
      perfect
      size="mini"
    />
  </div>
</template>

<script setup>
import { ref, computed } from "vue";

const props = defineProps({
  // 行数据
  rows: { type: Array, default: () => [] },
  // 列定义 [{ name, type }]
  columns: { type: Array, default: () => [] },
  loading: { type: Boolean, default: false },
  // 可编辑模式:开启 checkbox 列 / 单元格编辑 / 键盘 / 工具栏
  editable: { type: Boolean, default: false },
  // 工具栏(默认仅 editable 时显示)
  showToolbar: { type: Boolean, default: undefined },
  // 分页器
  showPager: { type: Boolean, default: false },
  page: {
    type: Object,
    default: () => ({ currentPage: 1, pageSize: 50, total: 0 }),
  },
  toolbarButtons: {
    type: Array,
    default: () => [
      { name: "新增", code: "add", status: "grey-10" },
      { name: "复制行", code: "copy", status: "grey-10" },
      { name: "删除选中", code: "del", status: "grey-10" },
      { name: "刷新", code: "refresh", status: "grey-10" },
    ],
  },
});

const emit = defineEmits([
  "edit-closed",
  "cell-dblclick",
  "toolbar-button",
  "page-change",
]);

const xTable = ref(null);

const showToolbar = computed(() =>
  props.showToolbar === undefined ? props.editable : props.showToolbar,
);

// 获取列类型显示
const getColumnType = (col) => {
  if (!col) return "";
  return col.type || "";
};

// 计算列宽度(根据字段名和类型长度)
const getColumnWidth = (col) => {
  if (!col) return 120;
  const name = col.name || "";
  const type = col.type || "";
  const textLen = name.length + type.length + 3;
  return Math.min(300, Math.max(120, textLen * 8 + 20));
};

// 根据列类型获取编辑渲染器
const getEditRender = (col) => {
  if (!col) return { name: "VxeInput" };
  const type = (col.type || "").toLowerCase();

  if (type.includes("bool")) {
    return {
      name: "VxeSelect",
      options: [
        { label: "true", value: true },
        { label: "false", value: false },
      ],
    };
  }
  if (
    type.includes("int") ||
    type.includes("numeric") ||
    type.includes("decimal") ||
    type.includes("float") ||
    type.includes("double")
  ) {
    return { name: "VxeInput", attrs: { type: "number" } };
  }
  if (type.includes("text")) {
    return { name: "VxeTextarea" };
  }
  return { name: "VxeInput" };
};

const onToolbarButton = ({ code }) => emit("toolbar-button", { code });

// 暴露内部 vxe-table 实例方法(供父组件取勾选行等)
defineExpose({
  getCheckboxRecords: () => xTable.value?.getCheckboxRecords?.() || [],
  getTable: () => xTable.value,
});
</script>

<style>
.sql-result-table {
  height: 100%;
  width: 100%;
  min-height: 0;
  overflow: hidden;
}

.sql-result-table .vxe-toolbar {
  flex-shrink: 0;
}

.sql-result-table .table-wrapper {
  min-height: 0;
  overflow: hidden;
  position: relative;
}

.sql-result-table .vxe-pager {
  flex-shrink: 0;
}

.sql-result-table .column-type {
  font-size: 10px;
  font-weight: normal;
}

.sql-result-table .vxe-toolbar {
  background-color: #1a1a1a !important;
  border-bottom: 1px solid #2c2c2c !important;
}

.sql-result-table .vxe-toolbar .vxe-button {
  background-color: #2d2d2d !important;
  border: 1px solid #383838 !important;
  color: #e0e0e0 !important;
  transition: all 0.3s ease !important;
}

.sql-result-table .vxe-toolbar .vxe-button:hover {
  background-color: #3a3a3a !important;
  border-color: #4a4a4a !important;
  color: #fff !important;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.2) !important;
}

.sql-result-table .vxe-toolbar .vxe-button:active {
  background-color: #404040 !important;
  transform: translateY(1px);
}

/* 滚动条样式 */
.sql-result-table ::-webkit-scrollbar {
  width: 8px;
  height: 8px;
}

.sql-result-table ::-webkit-scrollbar-thumb {
  background-color: #434343;
  border-radius: 4px;
}

.sql-result-table ::-webkit-scrollbar-track {
  background-color: #1d1d1d;
}
</style>
