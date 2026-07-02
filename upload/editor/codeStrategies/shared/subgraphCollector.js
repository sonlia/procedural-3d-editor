/**
 * 子图代码收集模块
 *
 * 递归收集子图（Subgraph）和函数块（FunctionBlock）中的代码
 */

/**
 * 判断节点是否为 FunctionBlock 类型
 */
export function isFunctionBlock(node) {
  return (
    node.type === "FunctionBlock" || node.constructor?.name === "FunctionBlock"
  );
}

/**
 * 判断节点是否为 UI 节点
 */
export function isUINode(node) {
  // 优先检查 categories 属性（运行时创建的节点）
  if (node.categories === "ui") return true;
  // 回退检查 type 是否以 "ui/" 开头（从存储加载的节点）
  if (node.type?.startsWith("ui/")) return true;
  return false;
}

/**
 * 判断节点是否为 UILoop 节点
 */
export function isUILoopNode(node) {
  return (
    node.type?.includes("ui-loop-node") ||
    node.constructor?.name === "UILoopNode" ||
    node.title === "UiLoop"
  );
}

/**
 * 判断节点是否为后端节点
 *
 * 优先用产物字段判断（节点产出 bgJsCode 即为后端节点），
 * 回退到 categories 兜底（onExecute 未运行时 bgJsCode 可能为空），
 * 再回退到 backendCode 兼容旧字段（HttpApiNode 历史字段）
 */
export function isBackendNode(node) {
  return Boolean(node.bgJsCode?.trim() || node.backendCode?.trim()) || node.categories === "backend";
}

/**
 * 判断节点是否为 HttpApiNode
 * 使用 node.type（注册时固定为 treePath/id）代替 constructor.name（生产构建会混淆）
 */
export function isHttpApiNode(node) {
  return node.categories === "backend" && (
    node.type === "Backend/http-api-node-001" ||
    node.constructor?.name === "HttpApiNode"
  );
}

/**
 * 判断节点是否为 DatabaseSubgraph
 */
export function isDatabaseSubgraph(node) {
  return (
    node.type?.includes("db-subgraph-node-001") ||
    node.constructor?.name === "DatabaseSubgraph" ||
    node.title === "Database"
  );
}

/**
 * 判断节点是否直接产出 fastify route。
 */
export function isBackendRouteNode(node) {
  return (
    isHttpApiNode(node) ||
    isDatabaseSubgraph(node) ||
    node.type?.includes("backend-crud-node-001") ||
    node.constructor?.name === "BackendCrudNode" ||
    node.properties?.standaloneRoute === true
  );
}

export function getSubgraphNodes(subgraph) {
  if (!subgraph) return [];
  if (Array.isArray(subgraph._nodes_in_order) && subgraph._nodes_in_order.length > 0) {
    return subgraph._nodes_in_order;
  }
  if (Array.isArray(subgraph._nodes_executable) && subgraph._nodes_executable.length > 0) {
    return subgraph._nodes_executable;
  }
  if (Array.isArray(subgraph._nodes)) {
    return subgraph._nodes;
  }
  return [];
}

/**
 * 递归检测子图中是否包含后端节点（如 DatabaseSubgraph）
 * @param {object} subgraph - 子图对象
 * @returns {boolean}
 */
export function subgraphContainsBackendNode(subgraph) {
  const subNodes = getSubgraphNodes(subgraph);
  if (!subNodes?.length) return false;
  for (const node of subNodes) {
    if (isBackendNode(node)) return true;
    if (node.subgraph && subgraphContainsBackendNode(node.subgraph)) return true;
  }
  return false;
}

/**
 * 递归收集子图代码
 * @param {object} subgraph - 子图对象
 * @param {Map} subgraphCodeMap - 子图代码映射（用于存储结果）
 * @returns {string} 子图内所有节点的代码（内层占位符已解析）
 */
export function collectSubgraphCode(subgraph, subgraphCodeMap) {
  const subNodes = getSubgraphNodes(subgraph);
  if (!subNodes?.length) return "";

  const codeLines = [];

  for (const node of subNodes) {
    // 跳过 graph/output:它无 jsCode 产物,而 GraphOutput.onExecute 的副作用是把
    // 内部 wire 值写到父节点 output,会覆盖 dbSubgraph 等 codegen 容器在自己 onExecute
    // 末尾设置好的 label name(如把 outputs[1] 从 "out0" 又改回 "in0").
    if (node.type === "graph/output") continue;

    try {
      node.onExecute?.();
    } catch (e) {
      console.warn(`[collectSubgraphCode] ${node.type} onExecute 失败:`, e);
    }

    // 递归处理所有嵌套子图（FunctionBlock、DatabaseSubgraph 等）
    if (node.subgraph) {
      const innerCode = collectSubgraphCode(node.subgraph, subgraphCodeMap);
      subgraphCodeMap.set(node.id, innerCode);
    }

    if (node.jsCode?.trim() || node.bgJsCode?.trim()) {
      // 优先 bgJsCode（dbSubgraph 子图收集走后端链路），回退 jsCode（前端节点）
      codeLines.push((node.bgJsCode?.trim() || node.jsCode?.trim()));
    }
  }

  // 深度优先：内层子图已收集完毕，解析当前层级的 __SUBGRAPH_ 占位符
  let result = codeLines.join("\n");
  for (const [id, subCode] of subgraphCodeMap) {
    result = result.replaceAll(`__SUBGRAPH_${id}__`, subCode);
  }
  return result;
}

/**
 * 递归扁平化收集 graph 及其所有层级 subgraph 内的节点。
 * 主要用于跨层级聚合(如 importStr):collectSubgraphCode/splitFunctionBlockCode
 * 只搬运 jsCode/bgJsCode,子图内部节点的 importStr 必须靠这里补齐。
 *
 * @param {object} rootGraphLike - 拥有 _nodes / _nodes_in_order / _nodes_executable 的对象
 * @returns {Array} 所有层级节点的扁平数组
 */
export function collectAllNodesDeep(rootGraphLike) {
  const result = [];
  const visited = new Set();

  const walk = (graphLike) => {
    if (!graphLike || visited.has(graphLike)) return;
    visited.add(graphLike);

    const nodes = getSubgraphNodes(graphLike);
    for (const node of nodes) {
      result.push(node);
      if (node.subgraph) walk(node.subgraph);
    }
  };

  walk(rootGraphLike);
  return result;
}

/**
 * 收集 UILoop 目标映射
 * @param {object} graph - 图对象
 * @param {Array} nodes - 节点数组
 * @returns {Map} 目标节点 ID -> UILoop 节点 ID 的映射
 */
export function collectUILoopTargets(graph, nodes) {
  const targetToLoopMap = new Map();

  for (const node of nodes) {
    if (!isUILoopNode(node)) continue;
    if (!node.outputs || !graph.links) continue;

    for (const output of node.outputs) {
      if (output.name !== "item" && output.name !== "index") continue;
      if (!output.links?.length) continue;

      for (const linkId of output.links) {
        const link = graph.links[linkId];
        if (!link) continue;

        const targetNode = graph._nodes_by_id[link.target_id];
        if (targetNode?.categories === "ui" && !isUILoopNode(targetNode)) {
          targetToLoopMap.set(targetNode.id, node.id);
        }
      }
    }
  }

  return targetToLoopMap;
}

export default {
  isFunctionBlock,
  isUINode,
  isUILoopNode,
  isBackendNode,
  isHttpApiNode,
  isDatabaseSubgraph,
  isBackendRouteNode,
  getSubgraphNodes,
  subgraphContainsBackendNode,
  collectSubgraphCode,
  collectAllNodesDeep,
  collectUILoopTargets,
};
