/**
 * 共享模块导出
 *
 * 统一导出所有共享功能
 */

// 编译工具
export {
  getVueStudioHost,
  loadImportMap,
  clearImportMapCache,
  getImportMap,
  transformImports,
  transformVueSfc,
  transformJsSfc,
} from "./compile.js";

// Import 合并
export {
  mergeImports,
  collectAndMergeImports,
} from "./importMerger.js";

// 占位符替换
export {
  replacePlaceholders,
  replaceTemplateVars,
  cleanupPlaceholders,
} from "./placeholderReplacer.js";

// 子图收集
export {
  isFunctionBlock,
  isUINode,
  isUILoopNode,
  isBackendNode,
  subgraphContainsBackendNode,
  collectSubgraphCode,
  collectUILoopTargets,
} from "./subgraphCollector.js";

// FunctionBlock 前后端拆分
export { splitFunctionBlockCode } from "./functionBlockSplitter.js";
