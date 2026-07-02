/**
 * 占位符替换模块
 *
 * 处理代码生成过程中的各种占位符替换
 */

/**
 * 替换子图和函数占位符
 * @param {string} code - 原始代码
 * @param {Map} subgraphCodeMap - 子图代码映射 (id -> code)
 * @param {Map} funcCodeMap - 函数代码映射 (id -> code)
 * @returns {string} 替换后的代码
 */
export function replacePlaceholders(code, subgraphCodeMap, funcCodeMap) {
  let result = code;

  // 替换子图占位符
  for (const [id, subCode] of subgraphCodeMap) {
    result = result.replaceAll(`__SUBGRAPH_${id}__`, subCode);
  }

  // 替换函数占位符
  for (const [id, funcCode] of funcCodeMap) {
    result = result.replaceAll(`__FUNC_${id}__`, funcCode);
  }

  return result;
}

/**
 * 替换模板占位符
 * @param {string} template - 模板字符串
 * @param {object} data - 占位符数据
 * @returns {string} 替换后的模板
 */
export function replaceTemplateVars(template, data) {
  let result = template;

  for (const [key, value] of Object.entries(data)) {
    // 支持多种占位符格式
    // "<--key-->" 格式
    result = result.replaceAll(`<--${key}-->`, value ?? "");
    // "\"<--key-->\"" 格式（JSON 字符串中的占位符）
    result = result.replaceAll(`"<--${key}-->"`, value ?? '""');
    // "//<---key--->" 格式（注释占位符）
    result = result.replaceAll(`//<---${key}--->`, value ?? "");
    // "/* key */" 格式（CSS 注释占位符）
    result = result.replaceAll(`/* ${key} */`, value ?? "");
  }

  return result;
}

/**
 * 清理未替换的占位符
 * @param {string} code - 代码字符串
 * @returns {string} 清理后的代码
 */
export function cleanupPlaceholders(code) {
  // 清理未替换的子节点占位符
  let result = code.replace(/__CHILDREN_[^_]+_[\w-]+__/g, "[]");

  // 清理未替换的子图占位符
  result = result.replace(/__SUBGRAPH_[\w-]+__/g, "");

  // 清理未替换的函数占位符
  result = result.replace(/__FUNC_[\w-]+__/g, "");

  // 清理未替换的循环体占位符
  result = result.replace(/__LOOP_BODY_[\w-]+__/g, "null");

  return result;
}

export default {
  replacePlaceholders,
  replaceTemplateVars,
  cleanupPlaceholders,
};
