/**
 * 编译工具模块 - 兼容层
 *
 * 此文件现在重导出 shared/compile.js 的内容
 * 保留此文件是为了向后兼容现有代码
 *
 * @deprecated 请直接使用 ../shared/compile.js
 */

export {
  getVueStudioHost,
  loadImportMap,
  clearImportMapCache,
  getImportMap,
  transformImports,
  transformVueSfc,
  transformJsSfc,
} from "../shared/compile.js";
