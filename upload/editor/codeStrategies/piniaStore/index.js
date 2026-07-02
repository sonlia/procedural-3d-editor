/**
 * Pinia Store 策略
 *
 * 仅 node 编辑器，无 drag 编辑器
 * 生成 Pinia Composition API 格式的 store
 *
 * 简化设计：
 * - 所有节点代码统一收集，不按 State/Getters/Actions 分类
 * - Pinia 使用 Vue setup 组合式 API 写法，只有 ref/computed/function
 * - 自动提取所有定义的变量名用于 return 导出
 */

import { useProjectStore } from "src/stores/projectMange.js";
import { transformJsSfc } from "../shared/compile.js";
import { collectAndMergeImports } from "../shared/importMerger.js";
import {
  replacePlaceholders,
  replaceTemplateVars,
} from "../shared/placeholderReplacer.js";
import {
  isFunctionBlock,
  collectSubgraphCode,
  collectAllNodesDeep,
} from "../shared/subgraphCollector.js";

// 导入模板
import storeTemplate from "./templates/store.js.template?raw";

// ==================== 策略导出 ====================

export default {
  type: "js",
  hasDragEditor: false,

  /**
   * 统一接口：afterStep
   * 收集节点代码，统一处理
   */
  afterStep() {
    const graph = window._graph;
    if (!graph) {
      return { jsCode: "", importStr: "", exportList: "" };
    }

    const nodes = graph._nodes_executable || graph._nodes;
    if (!nodes || nodes.length === 0) {
      return { jsCode: "", importStr: "", exportList: "" };
    }

    const result = this._assemble(graph, nodes);

    // 生成完整 Store 代码并写入 outputCode
    const _project = useProjectStore();
    const nodeId = _project.getCurrentSelect();
    const storeName = graph?.extra?.storeName || "example";
    const fullCode = this._generateJSInternal(result, { storeName });
    _project.setOutputCode(nodeId, fullCode, "");

    return {
      jsCode: result.jsCode || "",
      importStr: result.importStr || "",
      exportList: result.exportList || "",
    };
  },

  /**
   * 统一接口：compile
   * 编译 JS 代码（转换 import 路径）
   */
  compile(code, rootPath, baseUrl) {
    return transformJsSfc(code, rootPath, baseUrl);
  },

  /**
   * 统一接口：generateJS
   * 生成完整的 Pinia Store 代码
   * @param {object} options - { storeName }
   * @returns {string} 完整的 Store 代码
   */
  generateJS(options = {}) {
    // 优先从 graph.extra 读取，fallback 到 options.storeName
    const graph = window._graph;
    const storeName =
      graph?.extra?.storeName || options.storeName || "example";

    const {
      jsCode = "",
      importStr = "",
      exportList = "",
    } = this.afterStep();

    return this._buildStoreCode({ jsCode, importStr, exportList, storeName });
  },

  /**
   * 统一接口：generateSFC
   * Store 不是 SFC，但为了统一接口保留此方法
   * 内部委托到 generateJS
   */
  generateSFC(options = {}) {
    return this.generateJS(options);
  },

  // ==================== 内部方法 ====================

  /**
   * 收集并组装所有节点代码
   * 简化逻辑：不再按 State/Getters/Actions 分类
   */
  _assemble(graph, nodes) {
    const subgraphCodeMap = new Map();
    const funcCodeMap = new Map();
    const codeLines = []; // 统一收集所有代码
    const exportNames = []; // 收集导出变量名

    const allNodes = graph._nodes || [];

    for (const node of allNodes) {
      try {
        node.onExecute?.();
      } catch (e) {
        console.warn(`[piniaStore] 执行 ${node.type} onExecute 失败:`, e);
      }

      // 统一处理 FunctionBlock（子图收集）
      if (isFunctionBlock(node)) {
        if (node.subgraph) {
          const subCode = collectSubgraphCode(node.subgraph, subgraphCodeMap);
          subgraphCodeMap.set(node.id, subCode);
        }
        if (node.jsCode) {
          funcCodeMap.set(node.id, node.jsCode);
          codeLines.push(node.jsCode.trim());
          // 提取导出名
          const names = this._extractExportNames(node.jsCode);
          exportNames.push(...names);
        }
        continue;
      }

      // 其他所有节点：直接收集代码
      if (node.jsCode?.trim()) {
        codeLines.push(node.jsCode.trim());
        // 提取导出名
        const names = this._extractExportNames(node.jsCode);
        exportNames.push(...names);
      }
    }

    // 占位符替换
    let jsCode = codeLines.join("\n\n");
    jsCode = replacePlaceholders(jsCode, subgraphCodeMap, funcCodeMap);

    const importStr = collectAndMergeImports(collectAllNodesDeep(graph));
    const exportList = [...new Set(exportNames)].join(", "); // 去重

    return { jsCode, importStr, exportList };
  },

  /**
   * 增强的变量名提取
   * 支持 const/let/var、function、解构赋值等场景
   */
  _extractExportNames(code) {
    if (!code) return [];
    const names = [];

    // 1. const/let/var xxx = ...
    const varMatches = code.matchAll(/(?:const|let|var)\s+(\w+)\s*=/g);
    for (const m of varMatches) names.push(m[1]);

    // 2. function xxx(...) 或 async function xxx(...)
    const funcMatches = code.matchAll(/(?:async\s+)?function\s+(\w+)\s*\(/g);
    for (const m of funcMatches) names.push(m[1]);

    // 3. 解构赋值 const { a, b } = ...
    const destructMatches = code.matchAll(
      /(?:const|let|var)\s*\{([^}]+)\}\s*=/g
    );
    for (const m of destructMatches) {
      const vars = m[1].split(",").map((v) => v.trim().split(":")[0].trim());
      names.push(...vars.filter((v) => /^\w+$/.test(v)));
    }

    return names;
  },

  /**
   * 内部方法：生成 JS 代码（供 afterStep 内部调用）
   */
  _generateJSInternal(result, options) {
    const { storeName = "example" } = options;
    return this._buildStoreCode({
      jsCode: result.jsCode || "",
      importStr: result.importStr || "",
      exportList: result.exportList || "",
      storeName,
    });
  },

  /**
   * 内部方法：构建 Store 代码
   * 统一处理模板替换和缩进
   */
  _buildStoreCode({ jsCode, importStr, exportList, storeName }) {
    // 将 storeName 转为 PascalCase
    const storeNamePascal = storeName.replace(
      /(^|[-_])(\w)/g,
      (_, __, c) => c.toUpperCase()
    );

    // 处理 jsCode 缩进：每行添加 2 空格缩进
    const indentedJsCode = jsCode
      .split("\n")
      .map((line) => (line.trim() ? `  ${line}` : line))
      .join("\n");

    // 使用统一的模板替换
    return replaceTemplateVars(storeTemplate, {
      importStr,
      StoreNamePascal: storeNamePascal,
      storeName,
      jsCode: indentedJsCode,
      exportList,
    });
  },
};
