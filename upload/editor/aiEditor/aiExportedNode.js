import { LiteGraph } from "../nodeEditor/editor.js";
import { nodeMeta } from "../nodeEditor/node/nodeMetea.js";
import {
  buildFetchFunction,
  safeFuncNameFromPath,
} from "../nodeEditor/node/logicNode/backendBase/fetchCodegen.js";

// 一个 AI 编辑器节点 = 三个对外 graph 节点:ui 组件 / 前端 js / 后端 js。
// 有内容的部分各自注册成一个可在 graphjs 搜索框「AI」分组导入的节点。
// - 注册 key(= addNodes 的 type)= "AI/<源节点 id>/<part>",稳定且唯一。
// - treePath = "AI"(搜索分组);category 显式 "logic" → 落入 nodeEditor/graphJs/graphStore 场景。
// - codegen:后端节点复用 fetchCodegen 生成调接口代码(真实);ui/前端先占位(项目 codegen 约定接好再补)。

export const AI_EXPORT_TREEPATH = "AI";
export const AI_PARTS = ["ui", "frontend", "backend"];
export const aiPartNodeType = (nodeId, part) => `${AI_EXPORT_TREEPATH}/${nodeId}/${part}`;

const PART_META = {
  ui: { suffix: "组件", inputs: [], outputs: [{ name: "el", type: "string" }] },
  frontend: {
    suffix: "前端",
    inputs: [{ name: "args", type: "string" }],
    outputs: [{ name: "result", type: "string" }],
  },
  backend: {
    suffix: "后端",
    inputs: [{ name: "params", type: "string" }],
    outputs: [{ name: "data", type: "string" }],
  },
};

const isDataSlot = (s) => s && s.type !== "orderSlot";

export function buildAiPartNodeClass(nodeId, part, manifest = {}) {
  const meta = PART_META[part] || PART_META.frontend;
  const baseTitle = manifest.title || "AI 节点";
  const title = `${baseTitle} · ${meta.suffix}`;

  return class AiPartNode extends nodeMeta {
    constructor() {
      super();
      this.treePath = AI_EXPORT_TREEPATH;
      this.categories = "logic";
      this.aiSourceNodeId = nodeId;
      this.aiPart = part;
      meta.inputs.forEach((s) => this.addInput(s.name, s.type));
      meta.outputs.forEach((s) => this.addOutput(s.name, s.type));
    }

    onExecute() {
      const dataOutputs = (this.outputs || []).filter(isDataSlot);
      // 出参 slot 暴露其变量名给下游
      dataOutputs.forEach((o) => {
        const oi = this.outputs.indexOf(o);
        if (o.name) this.setOutputData(oi, o.name);
      });

      // 后端节点:有 apiPath 则生成真实 fetch 调用代码(复用 fetchCodegen)
      if (part === "backend" && manifest.apiPath) {
        const dataInputs = (this.inputs || []).filter(isDataSlot);
        const params = dataInputs.map((s) => s.name);
        const callArgs = dataInputs
          .map((s) => this.getInputData(this.inputs.indexOf(s)) ?? s.name)
          .join(", ");
        const bodyJsonExpr = params.length ? `JSON.stringify({ ${params.join(", ")} })` : null;
        const responseRefs = dataOutputs.map((s) => ({ refName: s.name, jsonKey: s.name }));
        const funcName = safeFuncNameFromPath(
          manifest.apiPath,
          `aiUnit_${String(nodeId).slice(0, 6)}`,
        );
        const { jsCode, jsRefLines, importStr } = buildFetchFunction({
          funcName,
          method: (manifest.method || "POST").toUpperCase(),
          routePath: manifest.apiPath,
          params,
          bodyJsonExpr,
          responseRefs,
          fetchMode: "robust",
          errorHandling: "notify",
          exec: { mode: "manual", watchDeps: [], callArgs, appendManualCall: true },
        });
        this.jsRefLines = jsRefLines;
        this.jsCode = jsCode;
        this.importStr = importStr;
        return;
      }

      // ui / 前端 / 未落盘后端:占位(可被插入连线,真实 codegen 待 Phase 3c)
      this.jsCode = `/* AI 编辑器节点「${title}」(源 ${nodeId} · ${part}):引用其生成的${meta.suffix},待接 codegen 约定 */`;
    }

    static get title() {
      return title;
    }
    static get name() {
      return title;
    }
    static get id() {
      return `${nodeId}/${part}`;
    }
    static get treePath() {
      return AI_EXPORT_TREEPATH;
    }
    static get categories() {
      return "logic";
    }
  };
}

// 按 manifest.parts 注册一个 AI 编辑器的三(或更少)个对外节点。
// manifest = { title, parts: { ui, frontend, backend }, apiPath?, method? }
export function registerAiEditorNodes(nodeId, manifest) {
  if (!nodeId || !manifest?.parts) return [];
  const registered = [];
  for (const part of AI_PARTS) {
    if (!manifest.parts[part]) continue;
    const type = aiPartNodeType(nodeId, part);
    LiteGraph.registerNodeType(type, buildAiPartNodeClass(nodeId, part, manifest));
    registered.push(type);
  }
  return registered;
}

// 批量注册(从 directory.aiExports 索引恢复,供图编辑器初始化时让消费图能反序列化这些节点)
export function registerAiExportedNodes(exportsMap = {}) {
  Object.entries(exportsMap || {}).forEach(([nodeId, manifest]) =>
    registerAiEditorNodes(nodeId, manifest),
  );
}
