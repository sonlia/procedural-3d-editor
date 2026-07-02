import { computed, ref, watch } from "vue";
import { useProjectStore } from "src/stores/projectMange";
import { registerAiEditorNodes } from "./aiExportedNode.js";

/**
 * AI 编辑器数据 composable —— 作用于当前选中节点(directory.editors[currentSelect].aiEditor)。
 * 一个 AI 编辑器节点聚合三部分:组件 / 前端 js / 后端 js。
 * 数据全部内聚到 directory.editors[nodeId].aiEditor(8 字段范式),不污染顶级。
 *
 * 生成改由右侧交互式 claude-code 终端(AiTerminal)直接在项目 rootDir 上 vibe coding;
 * 这里只负责:左侧三部分列表 + 中间只读代码预览 + 打开时把已有产物注册成 graph 节点。
 */
export function useAiEditor() {
  const _project = useProjectStore();

  // 当前查看的部件:'component' | 'frontendJs' | 'backend'
  const selectedPart = ref("component");

  const emptyData = () => ({
    mode: "js",
    history: [],
    component: { code: "" },
    frontendJs: { code: "" },
    backend: { routeCode: "", serviceCode: "", apiPath: "", method: "GET", source: "vibe" },
    dbContext: {},
  });

  // 当前节点的 aiEditor 数据(缺省返回空结构,不报错)
  const aiData = computed(() => _project.getEditorData("aiEditor") || emptyData());

  // 三部分列表(左侧列表渲染用)
  const parts = computed(() => {
    const d = aiData.value;
    return [
      { key: "component", label: "组件", icon: "widgets", filled: !!d.component?.code },
      { key: "frontendJs", label: "前端 js", icon: "code", filled: !!d.frontendJs?.code },
      { key: "backend", label: "后端 js", icon: "dns", filled: !!d.backend?.routeCode },
    ];
  });

  // 选中部件的代码文本(前端/后端展示用)
  const selectedCode = computed(() => {
    const d = aiData.value;
    if (selectedPart.value === "component") return d.component?.code || "";
    if (selectedPart.value === "frontendJs") return d.frontendJs?.code || "";
    return [d.backend?.routeCode, d.backend?.serviceCode]
      .filter(Boolean)
      .join("\n\n/* ── service ── */\n\n");
  });

  // ── 三节点自动注册:有内容的部分(ui/前端/后端)各注册一个对外 graph 节点 ──
  const editorTitle = (nodeId) =>
    (_project.getTreeData() || []).find((n) => n.id === nodeId)?.name || "AI 节点";

  // 据当前三部分内容自动注册节点 + 写 directory.aiExports 索引(供消费图反序列化)
  const syncExportNodes = () => {
    const nodeId = _project.getCurrentSelect();
    if (!nodeId) return;
    const d = aiData.value;
    const parts = {
      ui: !!d.component?.code,
      frontend: !!d.frontendJs?.code,
      backend: !!d.backend?.routeCode,
    };
    if (!parts.ui && !parts.frontend && !parts.backend) return;
    const manifest = {
      title: editorTitle(nodeId),
      parts,
      apiPath: d.backend?.apiPath || "",
      method: d.backend?.method || "POST",
    };
    _project.setAiExport(nodeId, manifest);
    registerAiEditorNodes(nodeId, manifest);
  };

  // 切换/打开 AI 编辑器时,把已有内容对应的节点注册进 graph 搜索框
  watch(() => _project.getCurrentSelect(), syncExportNodes, { immediate: true });

  return {
    selectedPart,
    aiData,
    parts,
    selectedCode,
  };
}
