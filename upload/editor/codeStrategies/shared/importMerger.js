/**
 * Import 语句合并模块
 *
 * 使用 AST 解析合并多条 import 语句
 * - 同源合并：相同模块的多个 import 合并为一条
 * - 去重：移除重复的导入项
 */

import { parse } from "@babel/parser";

/**
 * 合并 import 语句
 * @param {Array<string>} importList - import 语句数组
 * @returns {string} 合并后的 import 语句
 */
export function mergeImports(importList) {
  const importsByModule = new Map();

  // 逐条解析 import 语句，避免重复声明导致整体解析失败
  for (const imp of importList) {
    try {
      const ast = parse(imp, { sourceType: "module", plugins: ["jsx"] });
      for (const node of ast.program.body) {
        if (node.type !== "ImportDeclaration") continue;

        const modulePath = node.source.value;
        if (!importsByModule.has(modulePath)) {
          importsByModule.set(modulePath, {
            specifiers: new Map(),
            defaultSpecifier: null,
            namespaceSpecifier: null,
          });
        }

        const moduleImports = importsByModule.get(modulePath);
        for (const spec of node.specifiers) {
          if (spec.type === "ImportSpecifier") {
            // 命名导入
            moduleImports.specifiers.set(spec.local.name, spec.imported.name);
          } else if (spec.type === "ImportDefaultSpecifier") {
            // 默认导入
            moduleImports.defaultSpecifier = spec.local.name;
          } else if (spec.type === "ImportNamespaceSpecifier") {
            // 命名空间导入 (import * as xxx)
            moduleImports.namespaceSpecifier = spec.local.name;
          }
        }
      }
    } catch (_) {
      // 单条解析失败则跳过
    }
  }

  // 重建 import 语句
  const result = [];
  for (const [modulePath, { specifiers, defaultSpecifier, namespaceSpecifier }] of importsByModule) {
    const parts = [];

    // 默认导入
    if (defaultSpecifier) parts.push(defaultSpecifier);

    // 命名空间导入
    if (namespaceSpecifier) {
      parts.push(`* as ${namespaceSpecifier}`);
    }

    // 命名导入
    const namedSpecs = [];
    for (const [local, imported] of specifiers) {
      namedSpecs.push(
        local === imported ? imported : `${imported} as ${local}`,
      );
    }
    if (namedSpecs.length > 0) parts.push(`{ ${namedSpecs.join(", ")} }`);

    if (parts.length > 0) {
      result.push(`import ${parts.join(", ")} from '${modulePath}'`);
    }
  }

  return result.join(";");
}

/**
 * 从节点数组收集 import 语句
 * @param {Array} nodes - 节点数组
 * @param {string} presetImports - 预置的 import 语句（可选）
 * @param {string} [field="importStr"] - 节点上读取 import 字符串的字段名;后端代码生成传 "bgImportStr"
 * @returns {string} 合并后的 import 语句
 */
export function collectAndMergeImports(nodes, presetImports = "", field = "importStr") {
  const importList = [];

  // 添加预置导入
  if (presetImports?.trim()) {
    const presets = presetImports.split(";");
    for (const imp of presets) {
      const trimmed = imp.trim();
      if (trimmed) importList.push(trimmed);
    }
  }

  for (const node of nodes) {
    if (node?.[field]?.trim()) {
      const imports = node[field].split(";");
      for (const imp of imports) {
        const trimmed = imp.trim();
        if (trimmed) importList.push(trimmed);
      }
    }
  }

  if (importList.length === 0) return "";

  return mergeImports(importList);
}

export default {
  mergeImports,
  collectAndMergeImports,
};
