/**
 * 共享编译工具模块
 *
 * 提供 Import Map 管理和代码转换功能
 * 从原 compile.js 移植而来
 */

import { compileFile, useStore, File } from "@vue/repl";
import { packages } from "@babel/standalone";

// Import Map 缓存
let importMapCache = null;
let importMapDepsPath = "/node_modules/.q-cache/dev-spa/vite-spa/deps";
// VueStudio 服务器地址（用于加载编辑器依赖）
let vueStudioHost = null;

/**
 * 获取 VueStudio 服务器地址
 * @returns {string} VueStudio 服务器 host
 */
export function getVueStudioHost() {
  if (!vueStudioHost) {
    // 从当前页面 URL 获取 VueStudio 的 host
    vueStudioHost = window.location.host;
  }
  return vueStudioHost;
}

/**
 * 加载 Import Map（从 Vite 服务器获取）
 * @param {string} baseUrl - 服务器地址（如 localhost:9000）
 * @returns {Promise<object>} Import Map 对象
 */
export async function loadImportMap(baseUrl) {
  if (importMapCache) return importMapCache;

  // 始终从 VueStudio 服务器加载 Import Map
  const studioHost = getVueStudioHost();

  try {
    const url = `http://${studioHost}/api/import-map`;
    const res = await fetch(url);
    const data = await res.json();

    if (data.imports) {
      importMapCache = data.imports;
      importMapDepsPath = data.depsPath || importMapDepsPath;
      console.log("[compile] Import map loaded from VueStudio:", Object.keys(importMapCache).length, "modules");
    }
    return importMapCache;
  } catch (error) {
    console.error("[compile] Failed to load import map:", error);
    return null;
  }
}

/**
 * 清除 Import Map 缓存（用于热更新）
 */
export function clearImportMapCache() {
  importMapCache = null;
}

/**
 * 获取当前 Import Map
 */
export function getImportMap() {
  return importMapCache;
}

/**
 * 格式化模块路径
 * - 相对路径：拼接 rootPath
 * - 绝对路径：添加 baseUrl
 * - URL：直接返回
 * - 裸模块：通过 Import Map 解析（从 VueStudio 加载）
 */
function formatPath(path, rootPath, baseUrl) {
  // 相对路径
  if (path.startsWith("./") || path.startsWith("../")) {
    return rootPath + "/" + path;
  }

  // 绝对路径
  if (path.startsWith("/")) {
    return baseUrl ? `http://${baseUrl}${path}` : path;
  }

  // URL 直接返回
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }

  // 裸模块：使用 Import Map 解析（从 VueStudio 服务器加载）
  return resolveBareModule(path);
}

/**
 * 解析裸模块路径
 * 注意：裸模块（第三方依赖）从 VueStudio 服务器加载
 */
function resolveBareModule(modulePath) {
  // 裸模块始终从 VueStudio 服务器加载
  const studioHost = getVueStudioHost();
  const prefix = `http://${studioHost}`;

  // 1. 精确匹配
  if (importMapCache?.[modulePath]) {
    return prefix + importMapCache[modulePath];
  }

  // 2. 降级处理：使用 flattenId 算法生成路径
  console.warn(`[compile] Module "${modulePath}" not found in import map, using fallback`);
  return prefix + importMapDepsPath + "/" + flattenIdFallback(modulePath) + ".js";
}

/**
 * 降级用的 flattenId 函数（当 Import Map 中找不到模块时使用）
 * 复制自 Vite 源码，保持兼容性
 */
function flattenIdFallback(id) {
  const replaceSlashOrColonRE = /[/:]/g;
  const replaceDotRE = /\./g;
  const replaceNestedIdRE = /\s*>\s*/g;
  const replaceHashRE = /#/g;

  let flatId = id
    .replace(replaceSlashOrColonRE, "_")
    .replace(replaceDotRE, "__")
    .replace(replaceNestedIdRE, "___")
    .replace(replaceHashRE, "____");

  // 限制长度
  if (flatId.length > 170) {
    const hash = getHashFallback(id);
    flatId = flatId.slice(0, 170 - 9) + "_" + hash;
  }

  return flatId;
}

function getHashFallback(id) {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return Math.abs(hash).toString(36);
}

/**
 * 生成运行时使用的 formatPath 函数代码
 * 用于处理动态 import 的情况
 * 注意：裸模块从 VueStudio 服务器加载
 */
function generateRuntimeFormatPath(baseUrl) {
  const importMapJson = JSON.stringify(importMapCache || {});
  const depsPath = importMapDepsPath;
  const prefix = baseUrl ? `http://${baseUrl}` : "";
  // 裸模块使用 VueStudio 的地址
  const studioHost = getVueStudioHost();
  const studioPrefix = `http://${studioHost}`;

  return `
function formatPath(path, rootPath, baseUrl) {
  const importMap = ${importMapJson};
  const depsPath = "${depsPath}";
  const prefix = "${prefix}";
  const studioPrefix = "${studioPrefix}";

  if (path.startsWith("./") || path.startsWith("../")) {
    return rootPath + "/" + path;
  }
  if (path.startsWith("/")) {
    return prefix + path;
  }
  if (path.startsWith("http://") || path.startsWith("https://")) {
    return path;
  }
  // 裸模块从 VueStudio 服务器加载
  if (importMap[path]) {
    return studioPrefix + importMap[path];
  }
  // Fallback: flattenId
  const flatId = path.replace(/[\\/\\/:]/g, "_").replace(/\\./g, "__").replace(/\\s*>\\s*/g, "___").replace(/#/g, "____");
  return studioPrefix + depsPath + "/" + (flatId.length > 170 ? flatId.slice(0, 161) + "_" + Math.abs([...path].reduce((h, c) => ((h << 5) - h) + c.charCodeAt(0), 0)).toString(36) : flatId) + ".js";
}
`;
}

/**
 * 转换代码中的 import 路径
 */
export const transformImports = (code, rootPath, baseUrl) => {
  const ast = packages.parser.parse(code, {
    sourceType: "module",
  });

  const updateImportSource = (path) => {
    path.node.source.value = formatPath(path.node.source.value, rootPath, baseUrl);
  };

  packages.traverse.default(ast, {
    ImportDeclaration: updateImportSource,
    ExportNamedDeclaration(path) {
      if (path.node.source) {
        path.node.source.value = formatPath(path.node.source.value, rootPath, baseUrl);
      }
    },
    ExportAllDeclaration(path) {
      if (path.node.source) {
        path.node.source.value = formatPath(path.node.source.value, rootPath, baseUrl);
      }
    },
    CallExpression(path) {
      if (packages.types.isImport(path.node.callee)) {
        const arg = path.node.arguments[0];

        if (packages.types.isStringLiteral(arg)) {
          // 静态动态导入：直接替换
          path.node.arguments[0] = packages.types.stringLiteral(
            formatPath(arg.value, rootPath, baseUrl),
          );
        } else {
          // 动态路径：注入 formatPath 函数调用
          const todoFunction = packages.types.callExpression(
            packages.types.identifier("formatPath"),
            [arg, packages.types.stringLiteral(rootPath), packages.types.stringLiteral(baseUrl || "")],
          );
          path.node.arguments[0] = todoFunction;
        }
      }
    },
  });

  // 添加运行时 formatPath 函数（用于动态 import）
  const runtimeCode = generateRuntimeFormatPath(baseUrl);
  const runtimeAst = packages.parser.parse(runtimeCode, {
    sourceType: "module",
  });
  ast.program.body.unshift(...runtimeAst.program.body);

  const output = packages.generator.default(ast, {
    retainLines: true,
    compact: false,
    minified: false,
    comments: true,
  });

  return output.code;
};

const store = useStore({
  sfcOptions: {
    script: { isProd: false, propsDestructure: true, inlineTemplate: false },
    style: {
      isProd: false,
    },
    template: {
      compilerOptions: { isCustomElement: function () {} },
      isProd: false,
    },
  },
});

export async function transformVueSfc(code, rootPath, baseUrl) {
  console.log("🔸 [transformVueSfc] 输入 code 长度:", code?.length);
  console.log("🔸 [transformVueSfc] 输入 code 前 200 字符:", code?.substring(0, 200));

  const file = new File("App.vue", code);
  await compileFile(store, file);
  let comp = file.compiled.js;
  let css = file.compiled.css;

  console.log("🔸 [transformVueSfc] 编译后 comp 长度:", comp?.length);
  console.log("🔸 [transformVueSfc] 编译后 comp 前 500 字符:", comp?.substring(0, 500));
  console.log("🔸 [transformVueSfc] 编译后 css 长度:", css?.length);

  if (!comp) {
    console.warn("🔸 [transformVueSfc] 编译失败，使用默认值");
    comp = `let __sfc__=null`;
  }

  // 如果有 CSS，在 JS 开头注入动态创建 style 标签的代码
  if (css && css.trim()) {
    const cssInjection = `
(function() {
  const existingStyle = document.getElementById('__sfc_style__');
  if (existingStyle) existingStyle.remove();
  const style = document.createElement('style');
  style.id = '__sfc_style__';
  style.textContent = ${JSON.stringify(css)};
  document.head.appendChild(style);
})();
`;
    comp = cssInjection + comp;
  }

  const _transformImports = transformImports(comp, rootPath, baseUrl);
  console.log("🔸 [transformVueSfc] 最终结果长度:", _transformImports?.length);
  return _transformImports;
}

export async function transformJsSfc(code, rootPath, baseUrl) {
  return transformImports(code, rootPath, baseUrl);
}
