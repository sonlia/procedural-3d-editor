/**
 * Vue Router 配置生成策略
 *
 * 基于 pages 文件夹和路由配置生成 Vue Router 配置文件
 *
 * 核心逻辑：
 * 1. 遍历 pages 目录下所有节点
 * 2. 根据 routeConfig 决定：
 *    - 无配置：独立路由，path 基于文件路径
 *    - 有 layoutId：作为 layout 的子路由
 * 3. 生成 routes.js 文件
 */

import { useProjectStore } from "src/stores/projectMange.js";
import {
  getLayoutsTemplateList,
  getComponentsNodeList,
} from "src/components/leftWidget/folder/useFileTree.js";

// ==================== 辅助函数 ====================

/**
 * 构建动态参数路径
 */
function buildParamPath(pathParams) {
  if (!pathParams || pathParams.length === 0) return "";

  return pathParams
    .map((param) => {
      let str = `/:${param.name}`;
      if (param.pattern) {
        str = `/:${param.name}(${param.pattern})`;
      }
      switch (param.type) {
        case "optional":
          return str + "?";
        case "repeat":
          return str + "+";
        case "repeatOptional":
          return str + "*";
        default:
          return str;
      }
    })
    .join("");
}

/**
 * 获取节点路径（从 treeData 中解析）
 */
function getNodePathFromTree(treeData, nodeId) {
  const nodeMap = new Map();
  for (const node of treeData) {
    nodeMap.set(node.id, node);
  }

  const node = nodeMap.get(nodeId);
  if (!node) return null;

  const path = [node.name];
  let current = node;

  while (current.pId) {
    const parent = nodeMap.get(current.pId);
    if (!parent) break;
    path.unshift(parent.name);
    current = parent;
  }

  return path;
}

/**
 * 生成组件导入路径
 */
function generateImportPath(nodePath) {
  // routes.js lives in src/router, so sibling src folders are one level up.
  return `../${nodePath.join("/")}.vue`;
}

/**
 * 生成组件变量名
 * 将下划线和连字符转换为驼峰命名
 */
function generateComponentName(nodePath) {
  // nodePath: ['pages', 'user', 'profile'] -> 'PagesUserProfile'
  // nodePath: ['pages', 'example_test_2'] -> 'PagesExampleTest2'
  return nodePath
    .map((p) => {
      // 将下划线和连字符分隔的字符串转换为驼峰
      return p
        .split(/[_-]/)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join('');
    })
    .join('');
}

/**
 * 生成路由路径
 *
 * pages 下节点的文件路径即 route 路径（不变量）。无论是否被 layout 包裹，
 * 页面始终使用绝对路径，layout 以 pathless 父路由包裹，不改变页面 URL。
 */
function generateRoutePath(nodePath, pathParams) {
  // nodePath: ['pages', 'user', 'profile'] -> '/user/profile'
  // 去掉 'pages' 前缀
  const pathWithoutPages = nodePath.slice(1);
  const basePath = "/" + pathWithoutPages.join("/");
  const paramPath = buildParamPath(pathParams);
  return basePath + paramPath;
}

// ==================== 路由树构建 ====================

/**
 * 构建单个页面的路由配置对象（始终绝对路径）
 * @param {Array} treeData 完整的树数据（用于重定向路径解析）
 * @param {Map} componentNodeMap 组件节点映射 (componentId -> nodePath)
 */
function buildRouteConfig(node, nodePath, routeConfig, treeData = null, componentNodeMap = null) {
  const componentName = generateComponentName(nodePath);
  const routePath = generateRoutePath(nodePath, routeConfig?.pathParams);

  const route = {
    path: routePath,
    name: nodePath.slice(1).join("-") || "index",
    _importPath: generateImportPath(nodePath),
  };

  // 检查是否有命名视图配置
  const hasNamedViews =
    routeConfig?.namedViews &&
    Array.isArray(routeConfig.namedViews) &&
    routeConfig.namedViews.length > 0;

  if (hasNamedViews && componentNodeMap) {
    // 有命名视图，使用 components 对象
    // 当前页面作为 default 视图
    route.components = {
      default: componentName,
    };
    route._componentsImports = [
      { name: componentName, path: generateImportPath(nodePath) },
    ];

    // 添加其他命名视图
    for (const view of routeConfig.namedViews) {
      if (view.componentId && componentNodeMap.has(view.componentId)) {
        const viewNodePath = componentNodeMap.get(view.componentId);
        const viewComponentName = generateComponentName(viewNodePath);
        route.components[view.name] = viewComponentName;
        route._componentsImports.push({
          name: viewComponentName,
          path: generateImportPath(viewNodePath),
        });
      }
    }
  } else {
    // 无命名视图，使用单个 component
    route.component = componentName;
  }

  // Props 配置
  if (routeConfig?.propsMode === "function" && routeConfig?.propsValue) {
    route.props = `__FUNC__${routeConfig.propsValue}__FUNC__`;
  } else if (routeConfig?.propsMode === "object" && routeConfig?.propsValue) {
    route.props = `__OBJ__${routeConfig.propsValue}__OBJ__`;
  }

  // 重定向（redirectTo 是 pages 节点的 ID）
  if (routeConfig?.redirectTo && treeData) {
    const redirectPath = getNodePathFromTree(treeData, routeConfig.redirectTo);
    if (redirectPath) {
      route.redirect = { name: redirectPath.slice(1).join("-") || "index" };
    }
  }

  return route;
}

/**
 * 构建完整的路由树
 *
 * 模型：
 * - 页面 route 路径 = 其在 pages 下的文件路径（不变量）。
 * - layout 按「每个页面/每条路径」独立指定：配了 layout 的页面在自己的绝对路径下
 *   被包裹成 `{ path: 页面路径, component: Layout, children: [{ path: '', ...页面 }] }`，
 *   layout 不改变 URL、也不合并成一个全局布局。layoutId 悬空（layout 节点被删）时
 *   页面降级为顶层独立路由，绝不丢失。
 * - 指定 index = 在该页面自身路由上挂 `alias: '/'`，让 `/` 直接渲染该页面内容、
 *   URL 保持 `/`（方便调试，非重定向）；页面仍保留它自己的文件路径路由。
 */
function buildRouteTree(treeData, routeConfigs, layoutsList, indexPageId) {
  // 创建 layouts 映射
  const layoutsMap = new Map();
  for (const layout of layoutsList) {
    layoutsMap.set(layout.id, layout);
  }

  // 创建 components 映射 (componentId -> nodePath)
  const componentNodeMap = new Map();
  const componentsList = getComponentsNodeList.value || [];
  for (const comp of componentsList) {
    // 从 path 解析出 nodePath 数组
    // comp.path 格式: "components/xxx" -> ['components', 'xxx']
    if (comp.path && comp.id) {
      const nodePath = comp.path.split("/");
      componentNodeMap.set(comp.id, nodePath);
    }
  }

  // 获取 pages 文件夹
  const pagesFolder = treeData.find(
    (n) => n.name === "pages" && n.pId === null,
  );
  if (!pagesFolder) {
    return { routes: [], imports: [] };
  }

  // 创建节点映射（用于路径查找）
  const nodeMap = new Map(treeData.map((node) => [node.id, node]));

  // 判断某节点是否在 pages 文件夹下
  const isUnderPages = (node) => {
    let current = node;
    while (current.pId) {
      const parent = nodeMap.get(current.pId);
      if (!parent) break;
      if (parent.id === pagesFolder.id) return true;
      current = parent;
    }
    return false;
  };

  // 收集所有 pages 下的非文件夹节点
  const pageNodes = treeData.filter((n) => !n.isParent && isUnderPages(n));

  const routes = [];
  const imports = [];

  const pushImport = (name, importPath) => {
    if (!imports.some((i) => i.name === name)) {
      imports.push({ name, path: importPath });
    }
  };

  // 收集单个路由（含命名视图）的所有组件 import
  const collectRouteImports = (route) => {
    if (route.component) {
      pushImport(route.component, route._importPath);
    } else if (route._componentsImports) {
      for (const compImport of route._componentsImports) {
        pushImport(compImport.name, compImport.path);
      }
    }
  };

  for (const node of pageNodes) {
    const nodePath = getNodePathFromTree(treeData, node.id);
    if (!nodePath) continue;

    const routeConfig = routeConfigs[node.id];
    const leaf = buildRouteConfig(
      node,
      nodePath,
      routeConfig,
      treeData,
      componentNodeMap,
    );

    // 指定 index：在该页面自身路由上挂 alias:"/"，让 "/" 直接渲染其内容（URL 保持 "/"）
    if (node.id === indexPageId) {
      leaf.alias = "/";
    }

    // layoutId 有效（layout 节点仍存在）才包裹，否则降级为顶层路由
    const layoutId = routeConfig?.layoutId;
    if (layoutId && layoutsMap.has(layoutId)) {
      const layout = layoutsMap.get(layoutId);
      const layoutPath = ["layouts", layout.name];
      const layoutComponentName = generateComponentName(layoutPath);
      const layoutImportPath = generateImportPath(layoutPath);

      // 页面在自己的绝对路径下被 layout 包裹，自身降为空 path 子路由
      // （alias:"/" 随页面落在空 path 子路由上 -> "/" 渲染 layout>page）
      const child = { ...leaf, path: "" };
      routes.push({
        path: leaf.path,
        component: layoutComponentName,
        _importPath: layoutImportPath,
        children: [child],
      });
      pushImport(layoutComponentName, layoutImportPath);
      collectRouteImports(child);
    } else {
      routes.push(leaf);
      collectRouteImports(leaf);
    }
  }

  return { routes, imports };
}

// ==================== 代码生成 ====================

/**
 * 生成 routes.js 代码
 */
function generateRoutesCode(routes, imports) {
  // 生成 import 语句
  const importLines = imports.map(
    (i) => `import ${i.name} from '${i.path}'`,
  );

  // 生成路由配置（需要处理特殊标记）
  const routesJson = JSON.stringify(routes, null, 2)
    // 替换 component 单组件为变量引用
    .replace(/"component":\s*"(\w+)"/g, '"component": $1')
    // 替换 components 对象中的组件名为变量引用
    .replace(/"(default|[\w-]+)":\s*"(Components?\w+|Pages?\w+|Layouts?\w+)"/g, '"$1": $2')
    // 处理函数类型的 props
    .replace(/"__FUNC__(.+?)__FUNC__"/g, "$1")
    // 处理对象类型的 props
    .replace(/"__OBJ__(.+?)__OBJ__"/g, "$1")
    // 移除 _importPath 字段
    .replace(/,?\s*"_importPath":\s*"[^"]+"/g, "")
    // 移除 _componentsImports 字段
    .replace(/,?\s*"_componentsImports":\s*\[[^\]]*\]/g, "");

  return `/**
 * Vue Router 路由配置
 * 由 VueStudio 自动生成
 */

${importLines.join("\n")}

const routes = ${routesJson}

export default routes
`;
}

// ==================== 策略导出 ====================

export default {
  type: "router",

  /**
   * 生成 Vue Router 配置文件
   * @returns {string} routes.js 代码
   */
  generateRoutes() {
    const _project = useProjectStore();
    const treeData = _project.getTreeData() || [];
    const routeConfigs = _project.getAllRouteConfigs();
    const layoutsList = getLayoutsTemplateList.value || [];
    const indexPageId = _project.getIndexPage();

    const { routes, imports } = buildRouteTree(
      treeData,
      routeConfigs,
      layoutsList,
      indexPageId,
    );

    return generateRoutesCode(routes, imports);
  },

  /**
   * 获取路由配置预览数据
   * @returns {object} { routes, imports }
   */
  getRouteTree() {
    const _project = useProjectStore();
    const treeData = _project.getTreeData() || [];
    const routeConfigs = _project.getAllRouteConfigs();
    const layoutsList = getLayoutsTemplateList.value || [];
    const indexPageId = _project.getIndexPage();

    return buildRouteTree(treeData, routeConfigs, layoutsList, indexPageId);
  },
};
