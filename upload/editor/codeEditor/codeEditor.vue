<template>
  <MonacoEditor :value="data" :filename="currentFileName" @change="changeData" />
</template>

<script setup>
import { onMounted, watch, ref, computed } from "vue";
import MonacoEditor from "./monacoEditor/MonacoEditor.vue";
import { useProjectStore } from "src/stores/projectMange.js";
import { getCurrentNodePath } from "src/components/leftWidget/folder/useFileTree.js";
import { useProjectTerminal } from "src/composables/useProjectTerminal";

const _project = useProjectStore();
const { saveFile, connect } = useProjectTerminal();
const data = ref("");

const currentBackendFile = computed(() => {
  const nodeId = _project.getCurrentSelect();
  return (
    (_project.getBackendTreeData() || []).find((item) => item.id === nodeId) ||
    null
  );
});

// 获取当前文件名
const currentFileName = computed(() => {
  const path = getCurrentNodePath() || '';
  const fileNameMatch = path.match(/[^/\\]*$/);
  return fileNameMatch ? fileNameMatch[0] : 'untitled.vue';
});

// 更新编辑器内容和保存到后端
const changeData = (val) => {
  _project.updateEditorData("code", val);

  // 纯代码编辑器：code 就是最终输出，写入 outputCode
  const nodeId = _project.getCurrentSelect();
  const backendType = currentBackendFile.value?.templateType;
  if (backendType?.startsWith("function")) {
    _project.setOutputCode(nodeId, "", "", val);
  } else if (backendType?.startsWith("service")) {
    _project.setOutputCode(nodeId, "", val, "");
  } else {
    _project.setOutputCode(nodeId, val, "");
  }

  // 保存到后端
  saveFile(getCurrentNodePath(), val);
};

// 监听当前选择的文件变化
watch(
  () => _project.getCurrentSelect(),
  async () => {
    await initProj();
  }
);

// 初始化项目数据
const initProj = async () => {
  data.value = _project.getEditorData("code") || "";
};

onMounted(() => {
  connect();
  initProj();
});
</script>
