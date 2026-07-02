<template>
  <div class="column full-height bg-dark">
    <!-- 无选中项时的空状态 -->
    <div v-if="!selectedItem" class="col column items-center justify-center text-grey-6">
      <q-icon name="code" size="64px" color="grey-8" />
      <div class="q-mt-md text-subtitle2">选择一个 API 或函数进行编辑</div>
      <div class="q-mt-sm text-caption">
        或者点击左侧面板的 + 按钮创建新的 API/函数
      </div>
    </div>

    <!-- 编辑区域 -->
    <template v-else>
      <!-- 顶部信息栏 -->
      <div class="row items-center q-pa-sm bg-grey-10">
        <q-icon
          :name="selectedItem.type === 'api' ? 'api' : 'functions'"
          :color="selectedItem.type === 'api' ? 'primary' : 'secondary'"
          size="sm"
        />
        <div class="q-ml-sm">
          <div class="text-subtitle2 text-grey-3">
            {{ selectedItem.name || selectedItem.displayName }}
          </div>
          <div v-if="selectedItem.type === 'api'" class="text-caption text-grey-6">
            <q-badge
              :color="getMethodColor(selectedItem.method)"
              :label="selectedItem.method"
              dense
              class="q-mr-xs"
            />
            {{ selectedItem.path }}
          </div>
          <div v-else class="text-caption text-grey-6">
            {{ selectedItem.isAsync ? 'async ' : '' }}function {{ selectedItem.name }}()
          </div>
        </div>
        <q-space />
        <q-btn flat dense icon="play_arrow" color="positive" @click="handleDebug">
          <q-tooltip>调试运行</q-tooltip>
        </q-btn>
        <q-btn flat dense icon="save" color="primary" @click="handleSave">
          <q-tooltip>保存</q-tooltip>
        </q-btn>
      </div>

      <q-separator dark />

      <!-- 标签页 -->
      <q-tabs v-model="activeTab" dense dark narrow-indicator class="text-grey-5 bg-grey-10">
        <q-tab name="config" label="配置" />
        <q-tab name="logic" label="逻辑编排" />
        <q-tab name="debug" label="调试" />
      </q-tabs>

      <q-separator dark />

      <q-tab-panels v-model="activeTab" class="col bg-dark" animated keep-alive>
        <!-- 配置面板 -->
        <q-tab-panel name="config" class="q-pa-md">
          <q-scroll-area class="fit">
            <!-- API 配置 -->
            <template v-if="selectedItem.type === 'api'">
              <BackendApiConfig
                :api="selectedItem"
                @update="handleConfigUpdate"
              />
            </template>

            <!-- 函数配置 -->
            <template v-else>
              <BackendFunctionConfig
                :func="selectedItem"
                @update="handleConfigUpdate"
              />
            </template>
          </q-scroll-area>
        </q-tab-panel>

        <!-- 逻辑编排面板 -->
        <q-tab-panel name="logic" class="q-pa-none">
          <BackendLogicEditor
            :item="selectedItem"
            @update="handleLogicUpdate"
          />
        </q-tab-panel>

        <!-- 调试面板 -->
        <q-tab-panel name="debug" class="q-pa-none">
          <BackendDebugPanel
            :item="selectedItem"
          />
        </q-tab-panel>
      </q-tab-panels>
    </template>
  </div>
</template>

<script setup>
import { ref, watch } from "vue";
import { Notify } from "quasar";
import { debugApi as _debugApi, debugFunction as _debugFunction, savePageBackend } from "src/services/http/backendApi";
import { useProjectMangerStore } from "src/stores/projectMange";
import { resolvePagePath } from "src/utils/treeUtils";
import BackendApiConfig from "./BackendApiConfig.vue";
import BackendFunctionConfig from "./BackendFunctionConfig.vue";
import BackendLogicEditor from "./BackendLogicEditor.vue";
import BackendDebugPanel from "./BackendDebugPanel.vue";

const _projectManger = useProjectMangerStore();

// TODO: selectedItem 应关联后端数据模型，当前暂用 null 占位
const selectedItem = ref(null);

// TODO: 实现后端数据持久化
const updateHttpApi = (id, updates) => {};
const updateFunction = (id, updates) => {};

const saveAndGenerate = async () => {
  const nodeId = _projectManger.getCurrentSelect();
  const rootDir = _projectManger.currentProject?.rootDir;
  const projectId = _projectManger.currentProjectId;

  if (!nodeId || !rootDir || !projectId) {
    Notify.create({ type: "warning", message: "缺少项目信息，无法保存" });
    return;
  }

  // 从 store 读取当前页面的后端代码
  const editorData = _projectManger.currentProject?.directory?.editors?.[nodeId];
  const routeCode = editorData?.outputBackendCode || "";
  const serviceCode = editorData?.outputBackendServiceCode || "";

  if (!routeCode && !serviceCode) {
    Notify.create({ type: "info", message: "当前页面无后端代码" });
    return;
  }

  // 解析页面路径
  const flatTreeData = _projectManger.getTreeData();
  const pagePath = resolvePagePath(flatTreeData, nodeId);
  if (!pagePath) {
    Notify.create({ type: "warning", message: "无法解析页面路径" });
    return;
  }

  try {
    const result = await savePageBackend(projectId, {
      pagePath,
      routeCode,
      serviceCode,
      rootDir,
    });

    if (result.success) {
      Notify.create({ type: "positive", message: `后端代码已保存: ${pagePath}` });
    } else {
      Notify.create({ type: "negative", message: result.error || "保存失败" });
    }
  } catch (err) {
    Notify.create({ type: "negative", message: `保存失败: ${err.message}` });
  }
};

const activeTab = ref("config");

// 配置更新
const handleConfigUpdate = (updates) => {
  if (!selectedItem.value) return;

  if (selectedItem.value.type === 'api') {
    updateHttpApi(selectedItem.value.id, updates);
  } else {
    updateFunction(selectedItem.value.id, updates);
  }
  Object.assign(selectedItem.value, updates);
};

// 逻辑更新
const handleLogicUpdate = ({ logicType, code, graphData }) => {
  if (!selectedItem.value) return;

  const updates = { logicType };
  if (logicType === 'code') {
    updates.code = code;
  } else {
    updates.graphData = graphData;
  }

  if (selectedItem.value.type === 'api') {
    updateHttpApi(selectedItem.value.id, updates);
  } else {
    updateFunction(selectedItem.value.id, updates);
  }
  Object.assign(selectedItem.value, updates);
};

// 保存
const handleSave = async () => {
  await saveAndGenerate();
};

// 调试
const handleDebug = async () => {
  if (!selectedItem.value) return;

  activeTab.value = 'debug';

  if (selectedItem.value.type === 'api') {
    await _debugApi(_projectManger.currentProjectId, selectedItem.value.id);
  } else {
    await _debugFunction(_projectManger.currentProjectId, selectedItem.value.id);
  }
};

// HTTP 方法颜色
const getMethodColor = (method) => {
  const colorMap = {
    GET: 'green',
    POST: 'blue',
    PUT: 'orange',
    DELETE: 'red',
    PATCH: 'purple',
  };
  return colorMap[method] || 'grey';
};

// 监听选中项变化，重置标签页
watch(selectedItem, (newItem, oldItem) => {
  if (newItem?.id !== oldItem?.id) {
    activeTab.value = 'config';
  }
});
</script>
