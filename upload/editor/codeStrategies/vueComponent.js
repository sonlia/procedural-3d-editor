/**
 * Vue 组件策略
 *
 * 统一接口：
 * - afterStep(): 在 graph.onAfterStep 中调用，返回 { jsCode, vNodeCode, importStr }
 * - generateSFC(options): 生成完整的 Vue SFC 代码（模板替换）
 * - compile(code, rootPath, baseUrl): 编译 Vue SFC
 * - generatePreviewScript(code, options): 生成 Quasar 预览脚本
 */

import { useProjectStore } from "src/stores/projectMange.js";
import { transformVueSfc, getVueStudioHost } from "./shared/compile.js";
import { getNodeConf } from "src/components/editor/nodeEditor/composables/useLitegraphEditor.js";

// 共享模块
import { collectAndMergeImports, mergeImports } from "./shared/importMerger.js";
import { replacePlaceholders } from "./shared/placeholderReplacer.js";
import {
  isFunctionBlock,
  isUINode,
  isUILoopNode,
  isBackendNode,
  isHttpApiNode,
  isDatabaseSubgraph,
  isBackendRouteNode,
  subgraphContainsBackendNode,
  collectSubgraphCode,
  collectAllNodesDeep,
  collectUILoopTargets,
} from "./shared/subgraphCollector.js";

import { splitFunctionBlockCode } from "./shared/functionBlockSplitter.js";

// UI 组装
import { assembleUITree } from "./vueComponent/assembler.js";

// 后端代码保存
// (savePageBackend 由 BackendEditor.vue 在用户点击保存时直接调用;
//  本文件只生成 backendCode,占位符 {{BG_ROOT}} 由后端 prepareGeneratedRouteCode 替换)

// 导入模板
import previewTemplate from "./vueComponent/templates/preview.vue?raw";
import productionTemplate from "./vueComponent/templates/production.vue?raw";
import slotEditorTemplate from "./vueComponent/templates/slotEditor.vue?raw";

// 共享的编辑器运行时代码（通过占位符注入模板）
import editorNodeCode from "./vueComponent/shared/createEditorNode.js?raw";
import editorStylesCSS from "./vueComponent/shared/editorStyles.css?raw";

// 后端代码保存防抖 timer（每个页面独立）
const _backendSaveTimers = new Map();

const createQuasarImport = (names) =>
  `import { ${names} } from ${JSON.stringify("quasar")}`;

// 模板预置 import（与节点 import 统一走 mergeImports 去重）
const TEMPLATE_PRESET_IMPORTS = {
  preview: createQuasarImport("QLayout, QPageContainer, QPage"),
  slotEditor: createQuasarImport("QLayout, QPageContainer, QPage"),
  production: "",
};

/**
 * 将模板预置 import 与节点 import 合并去重
 */
function mergeWithPreset(importStr, mode) {
  const preset = TEMPLATE_PRESET_IMPORTS[mode];
  if (!preset) return importStr;
  const importList = [preset];
  if (importStr) {
    importStr.split(";").forEach(s => {
      const trimmed = s.trim();
      if (trimmed) importList.push(trimmed);
    });
  }
  return mergeImports(importList);
}

// ==================== 策略导出 ====================

export default {
  type: "vue",
  hasDragEditor: true,

  /**
   * 统一接口：afterStep
   * 在 graph.onAfterStep 中调用，无需传参，内部自动获取数据
   * @returns {{ jsCode: string, vNodeCode: string, importStr: string, backendCode: string }}
   */
  afterStep() {
    // 从全局获取 graph（在 useLitegraphEditor.js 中已设置 window._graph）
    const graph = window._graph;
    if (!graph) {
      return { jsCode: "", vNodeCode: "[]", importStr: "", backendCode: "" };
    }

    const nodes = graph._nodes_executable || graph._nodes;
    if (!nodes || nodes.length === 0) {
      return { jsCode: "", vNodeCode: "[]", importStr: "", backendCode: "" };
    }

    // 内部组装代码
    const result = this._assemble(graph, nodes);

    // 获取样式，生成完整 SFC
    const _project = useProjectStore();
    const nodeId = _project.getCurrentSelect();
    const globalStyle = _project.getGlobalStyle() || "";
    const localStyle =
      _project.currentProject?.directory?.compStyle?.[nodeId] || "";

    const sfcCode = this._generateSFCInternal(result, {
      globalStyle,
      localStyle,
    });

    // 策略层写入 outputCode（关键改动）
    this._syncToBackend(nodeId, sfcCode, result.backendCode || "", result.backendServiceCode || "");

    return {
      jsCode: result.logicCode || "",
      vNodeCode: result.vNodeCode || "[]",
      importStr: result.importStr || "",
      backendCode: result.backendCode || "",
    };
  },

  /**
   * 统一接口：compile
   * 编译 Vue SFC 代码
   */
  compile(code, rootPath, baseUrl) {
    return transformVueSfc(code, rootPath, baseUrl);
  },

  /**
   * 统一接口：generateSFC
   * 生成完整的 Vue SFC 代码（模板替换）
   * @param {object} options - { mode, globalStyle, localStyle, selectedNodeId }
   * @returns {string} 完整的 Vue SFC 代码
   */
  generateSFC(options) {
    const {
      mode = "preview",
      globalStyle = "",
      localStyle = "",
      selectedNodeId = null,
    } = options;

    // 内部实时计算获取 jsCode、vNodeCode 和 importStr
    const { jsCode = "", vNodeCode = "[]", importStr = "" } = this.afterStep();

    // 组件对外接口(defineProps/defineEmits)置于 setup 顶层
    const finalLogic = this._prependComponentDefine(jsCode);

    const template = this._loadTemplate(mode);

    // 检测当前页面是否指定了布局组件
    const _project = useProjectStore();
    const currentNodeId = selectedNodeId || _project.getCurrentSelect();
    const routeConfig = currentNodeId ? _project.getRouteConfig(currentNodeId) : null;
    const hasLayout = !!(routeConfig?.layoutId);

    return template
      .replace("//<---editorShared--->", editorNodeCode)
      .replace('"<--replaceData-->"', vNodeCode)
      .replace("//<---replaceCode--->", finalLogic)
      .replace("//<---importStr--->", mergeWithPreset(importStr, mode))
      .replace("/* 编辑器基础样式 */", editorStylesCSS)
      .replace("/* 本地 */", localStyle)
      .replace("/* 全局 */", globalStyle)
      .replace('"<--hasLayout-->"', hasLayout ? '"true"' : '"false"')
      .replace(
        '"<--selectedNodeId-->"',
        selectedNodeId ? `"${selectedNodeId}"` : "null",
      );
  },

  /**
   * 统一接口：generatePreviewScript
   * 生成 Quasar 预览启动脚本
   * 注意：依赖从 VueStudio 服务器加载，而不是用户项目服务器
   */
  generatePreviewScript(code, { baseUrl, importMap, hasLayout = false }) {
    // 依赖从 VueStudio 服务器加载
    const studioHost = getVueStudioHost();
    const studioPrefix = `http://${studioHost}`;

    const vuePath = importMap?.["vue"]
      ? studioPrefix + importMap["vue"]
      : `${studioPrefix}/node_modules/.q-cache/dev-spa/vite-spa/deps/vue.js`;

    const quasarPath =
      importMap?.["quasar"] || importMap?.["quasar/dist/quasar.client.js"]
        ? studioPrefix +
          (importMap["quasar"] || importMap["quasar/dist/quasar.client.js"])
        : `${studioPrefix}/node_modules/.q-cache/dev-spa/vite-spa/deps/quasar_dist_quasar__client__js.js`;

    const vueRouterPath = importMap?.["vue-router"]
      ? studioPrefix + importMap["vue-router"]
      : `${studioPrefix}/node_modules/.q-cache/dev-spa/vite-spa/deps/vue-router.js`;

    // production 模式预览时，包裹 QLayout + QPageContainer + QPage 提供布局上下文
    const layoutImport = hasLayout
      ? `\nimport { QLayout as __QLayout__, QPageContainer as __QPageContainer__, QPage as __QPage__ } from "${quasarPath}";`
      : '';

    const appRootSetup = hasLayout
      ? `
// production 模式预览：用 QLayout > QPageContainer > QPage 包裹，提供完整布局上下文
const __app_root__ = {
  name: 'PreviewLayoutWrapper',
  setup() {
    return () => h(
      __QLayout__,
      { view: 'lHh Lpr lFf', class: 'absolute-full' },
      {
        default: () => [
          h(__QPageContainer__, null, {
            default: () => h(__QPage__, null, {
              default: () => h(__sfc__)
            })
          })
        ]
      }
    );
  }
};`
      : '\nconst __app_root__ = __sfc__;';

    return `
import { createApp } from "${vuePath}";${layoutImport}
import quasarUserOptions from '${studioPrefix}/.quasar/dev-spa/quasar-user-options.js'
import { Quasar } from "${quasarPath}"
import { markRaw } from "${vuePath}"
import createStore from "${studioPrefix}/src/stores/index.js"
import { createRouter, createMemoryHistory } from "${vueRouterPath}"
${appRootSetup}

async function createQuasarApp(createAppFn, quasarUserOptions) {
  const app = createAppFn(__app_root__)
  app.config.performance = true
  app.use(Quasar, quasarUserOptions)

  const store = typeof createStore === 'function' ? await createStore({}) : createStore
  app.use(store)

  // 创建预览用路由（RouterView/RouterLink 需要 router context）
  const router = createRouter({
    history: createMemoryHistory(),
    routes: [{ path: '/:pathMatch(.*)*', component: { render: () => null } }]
  })
  app.use(router)

  return { app, store, router }
}

console.info('[Preview] 开发环境启动')

async function start({ app, store, router }) {
  // 保存到 window 供下次脚本执行时 initEnvironment() 卸载
  window.__vueApp__ = app;
  app.mount('#app');
}

createQuasarApp(createApp, quasarUserOptions).then(start)
`;
  },

  // ==================== 内部方法 ====================

  /**
   * 内部方法：根据 graph.extra 配置生成组件对外接口代码
   * 读取 componentProps / componentEmits,产出 defineProps / defineEmits。
   * 置于 <script setup> 顶层(prepend 到 logicCode),无配置则返回 ""。
   */
  _buildComponentDefineCode() {
    const extra = window._graph?.extra || {};
    const props = Array.isArray(extra.componentProps) ? extra.componentProps : [];
    const emits = Array.isArray(extra.componentEmits) ? extra.componentEmits : [];
    const lines = [];

    // defineOptions:组件名 / inheritAttrs(Vue3 通用内建选项)。name 为空且 inheritAttrs 非 false 时不产出。
    const optsParts = [];
    if (extra.componentName) optsParts.push(`name: ${JSON.stringify(extra.componentName)}`);
    if (extra.inheritAttrs === false) optsParts.push(`inheritAttrs: false`);
    if (optsParts.length > 0) {
      lines.push(`defineOptions({ ${optsParts.join(", ")} })`);
    }

    const validProps = props.filter((p) => p && p.name);
    if (validProps.length > 0) {
      const entries = validProps.map((p) => {
        const type = p.type || "String";
        const parts = [`type: ${type}`, `required: ${p.required ? "true" : "false"}`];
        const def = this._serializePropDefault(type, p.default);
        if (def !== undefined) parts.push(`default: ${def}`);
        return `  ${JSON.stringify(p.name)}: { ${parts.join(", ")} }`;
      });
      lines.push(`const props = defineProps({\n${entries.join(",\n")}\n})`);
    }

    const validEmits = emits.map((e) => (typeof e === "string" ? e : e?.name)).filter(Boolean);
    if (validEmits.length > 0) {
      lines.push(`const emit = defineEmits([${validEmits.map((n) => JSON.stringify(n)).join(", ")}])`);
    }

    return lines.join("\n");
  },

  /**
   * 内部方法:按类型序列化 prop 默认值。
   * 空值返回 undefined(不产出 default);Array/Object 用工厂函数形式以符合 Vue 规范。
   */
  _serializePropDefault(type, raw) {
    if (raw === undefined || raw === null || raw === "") return undefined;
    switch (type) {
      case "Number": {
        const n = Number(raw);
        return Number.isNaN(n) ? undefined : String(n);
      }
      case "Boolean":
        return raw === true || raw === "true" ? "true" : "false";
      case "Array":
      case "Object":
        // raw 为用户输入的字面量文本,用工厂函数返回,避免引用共享
        return `() => (${raw})`;
      case "Function":
        return undefined;
      default:
        // String 及其它:字符串字面量
        return JSON.stringify(String(raw));
    }
  },

  /**
   * 内部方法:把组件接口 define 代码 prepend 到 logicCode 顶部
   */
  _prependComponentDefine(logicCode) {
    const defineCode = this._buildComponentDefineCode();
    if (!defineCode) return logicCode;
    return logicCode ? `${defineCode}\n\n${logicCode}` : defineCode;
  },

  /**
   * 内部方法：组装代码
   * 职责：只负责读取数据并编译，不修改任何数据
   */
  _assemble(graph, nodes) {
    const store = useProjectStore();
    const subgraphCodeMap = new Map();
    const funcCodeMap = new Map();
    const uiCodeMap = new Map();
    const logicLines = [];
    // Layout 节点的 setup 顶层 const(layoutNode_<shortId> = () => h(...));
    // assembler 在 layout 分支替换内部 __CHILDREN__ 占位符,然后由本函数推到 logicLines
    const layoutSetupMap = new Map();

    // 后端代码收集：路由 (HttpApiNode) 和服务函数 (BackendFunction) 分离
    const backendCodeMap = new Map();      // HttpApiNode → 路由代码
    const backendServiceMap = new Map();   // BackendFunction → 服务函数代码
    const backendNodes = [];

    const targetToLoopMap = collectUILoopTargets(graph, nodes);

    // 获取 graph 中所有节点的 ID
    const allNodes = graph._nodes || [];

    // 获取 dragEditor schema
    const schema = store.getEditorData("dragEditor") || [];

    // 收集 schema 中的所有节点 ID（仅用于编译时的节点匹配）
    const schemaNodeIds = new Set();
    const collectIds = (items) => {
      for (const item of items) {
        schemaNodeIds.add(item.id);
        if (item.children) {
          if (Array.isArray(item.children)) {
            collectIds(item.children);
          } else {
            for (const children of Object.values(item.children)) {
              if (Array.isArray(children)) collectIds(children);
            }
          }
        }
      }
    };
    collectIds(schema);

    for (const node of allNodes) {
      if (!schemaNodeIds.has(node.id) && !nodes.includes(node)) {
        continue;
      }

      // Dirty tracking: 只执行标记为 dirty 的节点
      if (node._dirty) {
        try {
          node.onExecute?.();
        } catch (e) {
          console.warn(`[vueComponent] 执行 ${node.type} onExecute 失败:`, e);
        }
        node._dirty = false;
      }
      // 代码收集逻辑（读取 node.jsCode、node.backendCode 等）每次都执行
      // 因为 _assemble 需要完整收集所有节点的代码来组装 SFC

      // 处理后端节点（优先于 UI 节点检查）
      if (isBackendNode(node)) {
        // DatabaseSubgraph：4 件套消费方
        // bgJsCode → 路由；jsRefLines/jsCode → setup 顶层 logicLines
        if (isDatabaseSubgraph(node)) {
          if (node.subgraph) {
            const subCode = collectSubgraphCode(node.subgraph, subgraphCodeMap);
            subgraphCodeMap.set(node.id, subCode);
          }
          if (node.bgJsCode?.trim()) {
            backendCodeMap.set(node.id, node.bgJsCode);
          }
          if (node.jsRefLines?.trim()) {
            logicLines.push(node.jsRefLines);
          }
          if (node.jsCode?.trim()) {
            logicLines.push(node.jsCode);
          }
          backendNodes.push(node);
          continue;
        }

        if (node.subgraph) {
          const subCode = collectSubgraphCode(node.subgraph, subgraphCodeMap);
          subgraphCodeMap.set(node.id, subCode);
        }

        // HttpApiNode：bgJsCode 存后端路由（旧字段 backendCode），jsCode 存前端请求（旧字段 frontendCode）
        // BackendFunction：bgJsCode 存后端服务函数（旧字段 jsCode）
        if (isBackendRouteNode(node)) {
          const beCode = node.bgJsCode?.trim() || node.backendCode?.trim();
          const feCode = node.jsCode?.trim() || node.frontendCode?.trim();
          if (beCode) {
            backendCodeMap.set(node.id, beCode);
          }
          if (feCode) {
            logicLines.push(feCode);
          }
        } else {
          const code = node.bgJsCode?.trim() || node.jsCode?.trim();
          if (code) {
            backendServiceMap.set(node.id, code);
          }
        }

        backendNodes.push(node);
        continue;
      }

      if (isUINode(node) || isUILoopNode(node)) {
        if (node.jsCode?.trim()) {
          uiCodeMap.set(node.id, node.jsCode.trim());
        }
        if (node.layoutSetupCode?.trim()) {
          layoutSetupMap.set(node.id, node.layoutSetupCode.trim());
        }
        if (node.uiSetupCode?.trim()) {
          logicLines.push(node.uiSetupCode.trim());
        }
        continue;
      }

      if (isFunctionBlock(node)) {
        if (node.subgraph) {
          const hasBackend = subgraphContainsBackendNode(node.subgraph);

          if (hasBackend) {
            // 强制 async（前端 fetch 需要 await）
            if (!node.properties.async) {
              node.properties.async = true;
              node.onExecute();
            }
            // 拆分前后端
            const split = splitFunctionBlockCode(node, subgraphCodeMap);
            subgraphCodeMap.set(node.id, split.frontendBody);
            if (split.backendRouteCode) backendCodeMap.set(node.id, split.backendRouteCode);
            if (split.backendServiceCode) backendServiceMap.set(node.id, split.backendServiceCode);
            if (split.backendRouteCode || split.backendServiceCode) backendNodes.push(node);
            if (split.frontendRefLines) logicLines.push(split.frontendRefLines);
            // 设置 import（ref）
            node.importStr = 'import { ref } from "vue"';
          } else {
            // 纯前端模式不变
            const subCode = collectSubgraphCode(node.subgraph, subgraphCodeMap);
            subgraphCodeMap.set(node.id, subCode);
          }
        }
        // __FUNC_${id}__ 替换规则：
        //   isAnonymous=true（funcOut 连 UI slot）→ funcCodeMap 存匿名箭头 jsCode，使用点内联
        //   isAnonymous=false → funcCodeMap 只存函数名，完整 const 定义放 setup 顶部
        if (node.jsCode) {
          if (node.isAnonymous) {
            funcCodeMap.set(node.id, node.jsCode);
          } else {
            const funcName = node.properties?.functionName;
            if (funcName) funcCodeMap.set(node.id, funcName);
            logicLines.push(node.jsCode.trim());
          }
        }
        continue;
      }

      if (node.jsCode?.trim()) {
        logicLines.push(node.jsCode.trim());
      }
    }

    for (const [id, code] of funcCodeMap) {
      funcCodeMap.set(
        id,
        replacePlaceholders(code, subgraphCodeMap, funcCodeMap),
      );
    }

    for (const [id, code] of uiCodeMap) {
      uiCodeMap.set(
        id,
        replacePlaceholders(code, subgraphCodeMap, funcCodeMap),
      );
    }

    const vNodeCode = assembleUITree(schema, uiCodeMap, targetToLoopMap, layoutSetupMap);

    // Layout 节点的 tmp 函数组件提到 setup 顶层(assembler 已替换内部 __CHILDREN__ 占位符)
    for (const setupCode of layoutSetupMap.values()) {
      if (setupCode?.trim()) logicLines.push(setupCode);
    }

    let logicCode = logicLines.join("\n");
    logicCode = replacePlaceholders(logicCode, subgraphCodeMap, funcCodeMap);

    // 收集 import 语句(使用共享模块)
    // 注意:必须递归收集所有子图层级的节点 importStr,
    // 否则 FunctionBlock 内部反应式节点(如 ref)的 import 会被丢失
    const importStr = collectAndMergeImports(collectAllNodesDeep(graph));

    // 组装后端路由代码 (HttpApiNode + FunctionBlock split)
    let backendCode = "";
    if (backendNodes.length > 0) {
      for (const [id, code] of backendCodeMap) {
        backendCodeMap.set(id, replacePlaceholders(code, subgraphCodeMap, funcCodeMap));
      }

      const routeLines = [];
      for (const node of backendNodes) {
        // HttpApiNode / FunctionBlock / DbSubgraph 都可以产生路由代码
        if (!isBackendRouteNode(node) && !isFunctionBlock(node)) continue;
        const code = backendCodeMap.get(node.id);
        if (code) routeLines.push(code);
      }

      if (routeLines.length > 0) {
        // 收集所有节点(含子图深层)声明的 bgImportStr,合并去重后 prepend 到路由文件顶部.
        // 路径中的 {{BG_ROOT}} 占位符由 _saveBackendToDisk 按 pagePath 深度替换为相对路径.
        const bgImportStr = collectAndMergeImports(
          collectAllNodesDeep(graph),
          "",
          "bgImportStr"
        );
        const importHeader = bgImportStr ? `${bgImportStr.split(";").join(";\n")};\n` : "";

        backendCode = `${importHeader}// Auto-generated by VueStudio
export default async function routes(fastify, options) {
  ${routeLines.join("\n\n  ")}
}
`;
      }
    }

    // 组装后端服务函数代码 (BackendFunction)
    let backendServiceCode = "";
    if (backendServiceMap.size > 0) {
      for (const [id, code] of backendServiceMap) {
        backendServiceMap.set(id, replacePlaceholders(code, subgraphCodeMap, funcCodeMap));
      }

      const serviceLines = [];
      for (const node of backendNodes) {
        if (isBackendRouteNode(node)) continue;
        const code = backendServiceMap.get(node.id);
        if (!code) continue;

        // FunctionBlock 的服务函数已由 splitter 生成完整格式，直接使用
        if (isFunctionBlock(node)) {
          serviceLines.push(code);
          continue;
        }

        // 为每个 BackendFunction 生成 exported async function
        // 函数名来自 remark 或 title，参数来自 passIn
        let funcName = (node.properties?.remark || node.title || `func_${String(node.id).slice(0, 8)}`)
          .replace(/[^a-zA-Z0-9]/g, "_");
        if (/^\d/.test(funcName)) funcName = "_" + funcName;
        const params = (node.properties?.passIn || []).map(p => p.name).join(", ");
        serviceLines.push(`export async function ${funcName}(${params}) {\n${code}\n}`);
      }

      if (serviceLines.length > 0) {
        backendServiceCode = `// Auto-generated by VueStudio\n\n${serviceLines.join("\n\n")}`;
      }
    }

    return {
      logicCode,
      vNodeCode,
      importStr,
      backendCode,
      backendServiceCode,
      backendOutputs: backendNodes,
    };
  },

  /**
   * 内部方法：同步到后端（写入 outputCode 到 store）
   * @param {string} nodeId 节点 ID
   * @param {string} outputCode 前端输出代码
   * @param {string} outputBackendCode 后端路由代码 (HttpApiNode)
   * @param {string} outputBackendServiceCode 后端服务函数代码 (BackendFunction)
   */
  _syncToBackend(nodeId, outputCode, outputBackendCode, outputBackendServiceCode) {
    if (!nodeId) {
      console.log("[vueComponent._syncToBackend] 未找到当前节点 ID");
      return;
    }

    const _project = useProjectStore();
    _project.setOutputCode(nodeId, outputCode, outputBackendCode, outputBackendServiceCode);
  },

  /**
   * 内部方法：生成 SFC 代码（供 afterStep 内部调用）
   * @param {object} result 组装结果
   * @param {object} options 样式选项
   * @returns {string} 完整的 Vue SFC 代码
   */
  _generateSFCInternal(result, options) {
    const { globalStyle = "", localStyle = "" } = options;
    const template = this._loadTemplate("production");

    let logicCode = result.logicCode || "";
    let importStr = result.importStr || "";

    // Notify 已作为全局 Quasar 插件注册，SSE 通知由 boot/sseNotify.js 统一建立；
    // 页面仅在实际使用到 Notify.create 时补充 import。
    if (/\bNotify\.create\b/.test(logicCode) && !importStr.includes("import { Notify }")) {
      importStr += "\nimport { Notify } from 'quasar'";
    }

    // 组件对外接口(defineProps/defineEmits)置于 setup 顶层
    logicCode = this._prependComponentDefine(logicCode);

    return template
      .replace('"<--replaceData-->"', result.vNodeCode || "[]")
      .replace("//<---replaceCode--->", logicCode)
      .replace("//<---importStr--->", mergeWithPreset(importStr, "production"))
      .replace("/* 本地 */", localStyle)
      .replace("/* 全局 */", globalStyle);
  },

  /**
   * 内部方法：加载模板
   * @param {string} mode - 模板模式：preview, production, slotEditor
   * @returns {string} 模板内容
   */
  _loadTemplate(mode) {
    const templates = {
      preview: previewTemplate,
      production: productionTemplate,
      slotEditor: slotEditorTemplate,
    };
    return templates[mode] || templates.preview;
  },
};
