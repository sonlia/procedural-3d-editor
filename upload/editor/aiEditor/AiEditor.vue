<template>
  <!-- 三栏:工作目录文件树 | 代码预览 | 交互式 claude-code 终端 -->
  <q-splitter v-model="treeSplit" :limits="[12, 32]" dark class="ai-editor full-height bg-dark">
    <!-- 1:专属工作目录文件树(claude-code 在此生成的真实文件),点击预览 -->
    <template #before>
      <div class="column no-wrap full-height bg-grey-10">
        <q-bar dark dense class="bg-grey-10 text-grey-4">
          <q-icon name="folder_open" size="sm" />
          <div class="text-caption">文件</div>
          <q-space />
          <q-btn dark dense flat size="sm" icon="refresh" @click="refresh">
            <q-tooltip>刷新</q-tooltip>
          </q-btn>
        </q-bar>
        <q-scroll-area class="col">
          <q-tree
            v-if="tree.length"
            :nodes="tree"
            node-key="nodeKey"
            label-key="label"
            v-model:selected="selectedPath"
            dense
            dark
            no-selection-unset
            selected-color="light-blue-6"
            @update:selected="openFile"
          >
            <template #default-header="{ node }">
              <div class="row items-center no-wrap">
                <q-icon :name="node.icon" size="xs" class="q-mr-xs" />
                <span class="text-caption">{{ node.label }}</span>
              </div>
            </template>
          </q-tree>
          <div v-else class="q-pa-sm text-grey-6 text-caption">
            暂无文件,在右侧 claude-code 终端里生成
          </div>
        </q-scroll-area>
      </div>
    </template>

    <!-- 2 + 3:代码预览 | 终端 -->
    <template #after>
      <q-splitter v-model="contentSplit" :limits="[30, 78]" dark class="full-height">
        <!-- 2:只读代码预览,展示选中文件内容 -->
        <template #before>
          <div class="column no-wrap full-height">
            <q-bar dark dense class="bg-grey-10 text-grey-4">
              <q-icon name="description" size="sm" />
              <div class="text-caption ellipsis">{{ selectedPath ? previewFileName : "代码预览" }}</div>
            </q-bar>
            <div class="col relative-position">
              <MonacoEditor
                v-if="selectedPath"
                :filename="previewFileName"
                :value="fileContent"
                readonly
              />
              <div v-else class="absolute-full row flex-center text-grey-6 text-caption">
                {{ placeholder }}
              </div>
            </div>
          </div>
        </template>

        <!-- 3:交互式 claude-code 终端,cwd = 专属工作目录,生成的文件即出现在左侧树 -->
        <template #after>
          <AiTerminal :project-id="ptySessionId" :root-dir="workingDir" :root-folder="rootFolder" :cli="aiCli" />
        </template>
      </q-splitter>
    </template>
  </q-splitter>
</template>

<script setup>
import { computed, ref } from "vue";
import { useProjectMangerStore } from "src/stores/projectMange";
import MonacoEditor from "../codeEditor/monacoEditor/MonacoEditor.vue";
import AiTerminal from "./AiTerminal.vue";
import { useAiEditor } from "./useAiEditor.js";
import { useAiFileTree } from "./useAiFileTree.js";

const _projectManger = useProjectMangerStore();
const projectId = computed(() => _projectManger.currentProjectId);

// 该项目选用的 AI CLI(claude/codex);传给交互终端决定起哪个 CLI
const aiCli = computed(() => _projectManger.getAiCli());

const treeSplit = ref(18);
const contentSplit = ref(58);
const placeholder = "（点击左侧文件查看内容;在右侧 claude-code 终端里生成文件）";

// 打开即把已有产物注册成 graph 节点(导出副作用,沿用现有逻辑)
useAiEditor();

// 专属工作目录文件树:列文件、点击读盘预览、定时刷新反映新生成文件
const { tree, selectedPath, fileContent, workingDir, rootFolder, refresh, openFile } = useAiFileTree();

// PTY 会话键按工作目录走(节点所在真实文件夹);同文件夹多个 AI 编辑器共享一个会话,
// 切到不同目录的节点时重连到对应 cwd 的会话。后端 aiTerminalManager 把它当不透明 key。
const ptySessionId = computed(() => workingDir.value || projectId.value);

// 预览文件名(MonacoEditor 据扩展名推断语言高亮)
const previewFileName = computed(() => {
  const p = selectedPath.value;
  return p ? p.split(/[\\/]/).pop() || "preview.txt" : "preview.txt";
});
</script>

<style scoped>
.ai-editor :deep(.q-tree__node-header) {
  padding: 2px 4px;
}
</style>
