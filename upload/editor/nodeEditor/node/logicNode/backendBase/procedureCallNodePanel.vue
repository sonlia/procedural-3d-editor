<script setup>
import { computed, watch, ref } from "vue";
import { Notify } from "quasar";
import BasePropertyPanel from "src/components/editor/nodeEditor/propertyPanel/BasePropertyPanel.vue";
import { useProjectStore } from "src/stores/projectMange.js";
import api from "src/services/api.js";

// 与 tableNodePanel 一致的 defineModel 模式
const props = defineModel();
const node = computed(() => props.value);
const properties = computed(() => props.value?.properties || {});

const generatedCodePreview = computed(
  () => props.value?.bgJsCode || props.value?.jsCode || "// 暂无生成的代码",
);

const projectStore = useProjectStore();
const flatDbTree = computed(() => projectStore.currentProject?.database?.dbTree || []);

// ─── 数据库连接(从父 DatabaseSubgraph 继承) ───

const parentDbConnectionId = computed(
  () => node.value?.graph?._subgraph_node?.properties?.dbConnectionId || "",
);

watch(
  parentDbConnectionId,
  (newId) => {
    if (newId && properties.value.dbConnectionId !== newId) {
      properties.value.dbConnectionId = newId;
    }
  },
  { immediate: true },
);

// 取节点的所有后代 ID(BFS,处理 folder 中间层) —— 复用 DbSchemaTree/tableNodePanel 范式
function getDescendantIds(parentId) {
  const ids = new Set();
  const queue = [parentId];
  while (queue.length > 0) {
    const pid = queue.shift();
    for (const n of flatDbTree.value) {
      if (n.pId === pid && !ids.has(n.id)) {
        ids.add(n.id);
        queue.push(n.id);
      }
    }
  }
  return ids;
}

// 存储过程下拉:database.dbTree 里 type==='procedure' 且属于该连接后代的节点(只列过程,不列函数)
const procedureOptions = computed(() => {
  const dbId = parentDbConnectionId.value;
  if (!dbId) return [];
  const descendants = getDescendantIds(dbId);
  return flatDbTree.value
    .filter((n) => n.type === "procedure" && descendants.has(n.id))
    .map((n) => ({ label: n.name, value: n.name }));
});

// ─── 选择过程 + 取签名 ───

const loadingSig = ref(false);

async function fetchSignature(name) {
  const dbId = parentDbConnectionId.value;
  if (!dbId || !name) return;
  loadingSig.value = true;
  try {
    const resp = await api.get("/api/db/procedures", {
      params: { serverDbId: dbId, projectId: projectStore.currentProjectId },
    });
    if (resp.data.success) {
      const proc = resp.data.data.find(
        (p) => p.name === name && p.type === "procedure",
      );
      if (proc) {
        // 持久树不含签名,选中后回写 identity args 缓存,节点据此重建 slot
        node.value?.setArguments?.(proc.arguments || "");
      } else {
        Notify.create({ type: "warning", message: `未找到存储过程 ${name}`, position: "top" });
      }
    } else {
      Notify.create({ type: "negative", message: resp.data.message || "加载签名失败", position: "top" });
    }
  } catch (e) {
    Notify.create({
      type: "negative",
      message: `加载签名失败: ${e.response?.data?.message || e.message}`,
      position: "top",
    });
  } finally {
    loadingSig.value = false;
  }
}

function onSelectProcedure(name) {
  if (!properties.value) return;
  properties.value.procedureName = name || "";
  fetchSignature(name);
}

// ─── 参数行:isSlot 开关 / 静态值 ───

function onToggleSlot(param, val) {
  param.isSlot = val;
  node.value?._syncParamSlots?.();
  node.value?.onExecute?.();
  node.value?.graph?.setDirtyCanvas?.(true, true);
}

function onParamValue(param, val) {
  param.value = val;
  node.value?.onExecute?.();
  node.value?.graph?.setDirtyCanvas?.(true, true);
}
</script>

<template>
  <BasePropertyPanel v-model="props" :code-content="generatedCodePreview">
    <div class="column q-gutter-y-sm q-pa-sm">
      <!-- 连接缺失提示 -->
      <div v-if="!parentDbConnectionId" class="text-caption text-orange-4">
        请先在父 Database 节点选择数据库连接。
      </div>

      <!-- 存储过程选择 -->
      <q-select
        dense
        dark
        outlined
        emit-value
        map-options
        label="存储过程"
        :model-value="properties.procedureName"
        :options="procedureOptions"
        :disable="!parentDbConnectionId"
        @update:model-value="onSelectProcedure"
      >
        <template #after>
          <q-btn
            dense
            flat
            round
            icon="refresh"
            size="sm"
            :loading="loadingSig"
            :disable="!properties.procedureName"
            @click="() => fetchSignature(properties.procedureName)"
          >
            <q-tooltip class="bg-dark">刷新签名(应对外部 ALTER)</q-tooltip>
          </q-btn>
        </template>
      </q-select>

      <!-- 参数列表 -->
      <div v-if="properties.procedureName" class="column q-gutter-y-xs">
        <div class="text-caption text-grey-5">
          参数
          <span class="text-grey-6">({{ (properties.params || []).length }})</span>
        </div>
        <div
          v-if="(properties.params || []).length === 0"
          class="text-caption text-grey-6"
        >
          无参数(或点刷新签名加载)。
        </div>
        <div
          v-for="param in properties.params"
          :key="param.name"
          class="row items-center no-wrap q-gutter-x-xs"
        >
          <div class="col-auto text-caption" style="min-width: 88px">
            {{ param.name }}
            <span class="text-grey-6">{{ param.type }}</span>
          </div>
          <q-toggle
            dense
            dark
            size="sm"
            :model-value="param.isSlot"
            label="slot"
            @update:model-value="(v) => onToggleSlot(param, v)"
          />
          <q-input
            v-if="!param.isSlot"
            dense
            dark
            outlined
            class="col"
            label="静态值"
            :model-value="param.value"
            @update:model-value="(v) => onParamValue(param, v)"
          />
          <div v-else class="col text-caption text-grey-6">由上游 slot 提供</div>
        </div>
      </div>
    </div>
  </BasePropertyPanel>
</template>
