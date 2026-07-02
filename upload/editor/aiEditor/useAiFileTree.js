import { ref, computed, watch, onMounted, onUnmounted } from "vue";
import { useProjectStore } from "src/stores/projectMange";
import * as fileApi from "src/services/http/fileApi.js";
import { flatToNested, getNodePath } from "src/utils/treeUtils.js";

/**
 * AI 编辑器专属工作目录的文件树。
 * 交互式 claude-code 终端(AiTerminal,cwd = 该工作目录)在此目录生成多个真实文件;
 * 本 composable 负责扫该目录列文件、点击读盘预览、定时刷新以反映新生成的文件。
 *
 * 工作目录约定:<projectRoot>/src/<节点所在文件夹路径>/(节点所在的真实目录)
 */
export function useAiFileTree() {
  const _project = useProjectStore();

  const tree = ref([]); // q-tree 节点
  const selectedPath = ref(null); // 选中文件绝对路径
  const fileContent = ref(""); // 选中文件内容
  const loading = ref(false);

  // 当前 AI 编辑器节点的根→自身路径([根目录节点, ...子目录, 自身])
  const nodePath = computed(() => {
    const id = _project.getCurrentSelect();
    if (!id) return [];
    return getNodePath(flatToNested(_project.getTreeData() || []), id);
  });

  // 根目录名(pages/components/stores/layouts/utils):决定后端注入的生成指令类型
  const rootFolder = computed(() => nodePath.value[0]?.name || "");

  // 工作目录 = 节点所在的真实文件夹(也用作 AiTerminal 的 PTY cwd)。
  // 基准是「项目管理的项目路径」(getCurrentProjectPath = currentProject.rootDir)+ src/<父目录路径>;
  // 解析不到时退到项目根,绝不返回空(否则后端 PTY 会回退到 process.cwd 设计器路径)。
  const workingDir = computed(() => {
    const root = _project.getCurrentProjectPath();
    if (!root) return "";
    const parentPath = nodePath.value.slice(0, -1).map((n) => n.name).join("/");
    return parentPath ? `${root}/src/${parentPath}` : root;
  });

  // 后端 tree 节点 {name,path,type,children} → q-tree 节点(path 作唯一 key)
  const toQNodes = (nodes) =>
    (nodes || []).map((n) => ({
      label: n.name,
      nodeKey: n.path,
      path: n.path,
      type: n.type,
      icon: n.type === "dir" ? "folder" : "description",
      children: n.type === "dir" ? toQNodes(n.children) : undefined,
    }));

  // 只读目录刷新(轮询/手动用)
  const refresh = async () => {
    const dir = workingDir.value;
    if (!dir) {
      tree.value = [];
      return;
    }
    loading.value = true;
    try {
      const res = await fileApi.listTree(dir);
      tree.value = res?.success ? toQNodes(res.tree) : [];
    } finally {
      loading.value = false;
    }
  };

  // 确保工作目录存在 + 刷新(切换节点时用)
  const ensureAndRefresh = async () => {
    const dir = workingDir.value;
    if (!dir) {
      tree.value = [];
      return;
    }
    await fileApi.createDirectory(dir);
    await refresh();
  };

  // 点击文件 → 读盘到预览
  const openFile = async (path) => {
    if (!path) return;
    selectedPath.value = path;
    const res = await fileApi.readContent(path);
    fileContent.value = res?.success ? res.content || "" : "";
  };

  // 切换 AI 编辑器节点:重置选中 + 建目录 + 刷新
  watch(
    workingDir,
    () => {
      selectedPath.value = null;
      fileContent.value = "";
      ensureAndRefresh();
    },
    { immediate: true },
  );

  // 定时刷新,反映 claude-code 终端新生成的文件
  let timer = null;
  onMounted(() => {
    timer = setInterval(refresh, 4000);
  });
  onUnmounted(() => {
    if (timer) clearInterval(timer);
  });

  return { tree, selectedPath, fileContent, loading, workingDir, rootFolder, refresh, openFile };
}
