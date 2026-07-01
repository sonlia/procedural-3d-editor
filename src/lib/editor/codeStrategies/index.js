/**
 * 代码策略统一入口（3D 编辑器版）
 *
 * 参考 upload/editor/codeStrategies/index.js 的接口设计，
 * 但剔除了 Vue/Quasar/后端相关策略，只保留通用的"图执行后拼接 jsCode"逻辑。
 *
 * 两种代码产物：
 *   - jsCode:  声明式拼接代码（定义 __out_<id> 变量，供下游节点引用）
 *   - bgJsCode: 运行时执行代码（直接操作 THREE 对象，存到 ctx 缓存）
 *
 * 调用方式：
 *   graph.runStep()            // 让每个节点的 onExecute() 设置 this.jsCode + this.bgJsCode
 *   codeStrategy.afterStep()   // 收集 jsCode + bgJsCode 拼接成最终代码
 *
 * 节点设计范式（与 RAR 一致）：
 *   - constructor(): 设置 this.properties, addInput/addOutput
 *   - onExecute(): 通过 this.getInputData(i) 读上游 slot 值，
 *                  通过 this.properties.xxx 读属性，
 *                  然后 this.jsCode = "..." 和/或 this.bgJsCode = "..."
 *   - 静态字段: title / id / treePath / color
 */

import { replacePlaceholders, cleanupPlaceholders } from "./shared/placeholderReplacer.js";

/**
 * 收集子图代码（递归）
 */
function collectSubgraphCode(subgraph, subgraphCodeMap) {
  if (!subgraph) return "";
  const innerNodes = subgraph._nodes_executable || subgraph._nodes || [];
  const lines = [];
  for (const n of innerNodes) {
    if (n.jsCode?.trim()) {
      lines.push(n.jsCode.trim());
    }
  }
  return lines.join("\n\n");
}

/**
 * 主入口：在 graph.runStep() 之后调用
 * @returns {{ jsCode: string, bgJsCode: string, vNodeCode: string, importStr: string }}
 */
function afterStep() {
  const graph = window._graph;
  if (!graph) {
    return { jsCode: "", bgJsCode: "", vNodeCode: "[]", importStr: "" };
  }

  const nodes = graph._nodes_executable || graph._nodes;
  if (!nodes || nodes.length === 0) {
    return { jsCode: "", bgJsCode: "", vNodeCode: "[]", importStr: "" };
  }

  const subgraphCodeMap = new Map();
  const funcCodeMap = new Map();
  const jsCodeLines = [];
  const bgJsCodeLines = [];
  const importSet = new Set();

  for (const node of nodes) {
    // 触发 onExecute（如果节点标记为 dirty）
    if (node._dirty) {
      try {
        node.onExecute?.();
      } catch (e) {
        console.warn(`[codeStrategy] onExecute failed for ${node.type}:`, e);
      }
      node._dirty = false;
    }

    // 收集子图节点的内部代码
    if (node.subgraph) {
      const subCode = collectSubgraphCode(node.subgraph, subgraphCodeMap);
      subgraphCodeMap.set(node.id, subCode);
    }

    // 收集 jsCode（声明式 — 定义 __out_<id>）
    if (node.jsCode?.trim()) {
      jsCodeLines.push(node.jsCode.trim());
    }

    // 收集 bgJsCode（运行时 — 直接操作 THREE 对象）
    if (node.bgJsCode?.trim()) {
      bgJsCodeLines.push(node.bgJsCode.trim());
    }

    // 收集 import
    if (node.importStr?.trim()) {
      for (const line of node.importStr.split(";")) {
        const trimmed = line.trim();
        if (trimmed) importSet.add(trimmed);
      }
    }
  }

  // 替换占位符
  let jsCode = jsCodeLines.join("\n\n");
  jsCode = replacePlaceholders(jsCode, subgraphCodeMap, funcCodeMap);
  jsCode = cleanupPlaceholders(jsCode);

  let bgJsCode = bgJsCodeLines.join("\n\n");
  bgJsCode = replacePlaceholders(bgJsCode, subgraphCodeMap, funcCodeMap);
  bgJsCode = cleanupPlaceholders(bgJsCode);

  const importStr = [...importSet].join(";\n") + (importSet.size > 0 ? ";" : "");

  return {
    jsCode,
    bgJsCode,
    vNodeCode: "[]",
    importStr,
  };
}

export default {
  afterStep,
  // 兼容接口
  compile: (code) => Promise.resolve(code),
  generateSFC: () => "",
  generateJS: () => "",
  generatePreviewScript: () => "",
  hasDragEditor: () => false,
  getType: () => "threejs",
};

