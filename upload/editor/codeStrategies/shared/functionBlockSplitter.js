/**
 * FunctionBlock 前后端自动拆分模块
 *
 * 当 FunctionBlock 子图内含后端节点（如 DatabaseSubgraph）时，
 * 将后端代码替换为 fetch 调用，参考 HttpApiNode 的前后端分离模式。
 *
 * 后端代码直接内联到路由处理器中（与 HttpApiNode 一致），无需单独 service 文件。
 */

import {
  isBackendNode,
  collectSubgraphCode,
  getSubgraphNodes,
} from "./subgraphCollector.js";


/**
 * 拆分 FunctionBlock 的前后端代码
 *
 * @param {object} node - FunctionBlock 节点
 * @param {Map} subgraphCodeMap - 子图代码映射
 * @returns {{
 *   frontendBody: string,         // 前端代码（后端部分已替换为 fetch）
 *   backendRouteCode: string,     // 后端路由代码（fastify 路由，含内联服务逻辑）
 *   backendServiceCode: string,   // 始终为空（代码已内联到路由）
 *   frontendRefLines: string,     // 前端 ref 声明行
 * }}
 */
export function splitFunctionBlockCode(node, subgraphCodeMap) {
  const subgraph = node.subgraph;
  const subNodes = getSubgraphNodes(subgraph);

  const frontendCodeLines = [];
  const refLines = [];
  const routeLines = [];

  if (!subNodes?.length) {
    return {
      frontendBody: "",
      backendRouteCode: "",
      backendServiceCode: "",
      frontendRefLines: "",
    };
  }

  for (const sn of subNodes) {
    // 执行节点以生成最新代码
    try {
      sn.onExecute?.();
    } catch (e) {
      console.warn(`[functionBlockSplitter] ${sn.type} onExecute 失败:`, e);
    }

    // 后端节点 → 消费节点已产出的 4 件套（jsCode/bgJsCode/jsRefLines）
    if (isBackendNode(sn)) {
      // 1. 解析子图内 __SUBGRAPH_xxx__（供 sn.bgJsCode 占位符还原）
      if (sn.subgraph) {
        const innerCode = collectSubgraphCode(sn.subgraph, subgraphCodeMap);
        subgraphCodeMap.set(sn.id, innerCode);
      }

      // 2. 用当前 subgraphCodeMap 还原 sn.bgJsCode 内层占位符
      let resolvedRoute = sn.bgJsCode?.trim() || "";
      for (const [id, code] of subgraphCodeMap) {
        resolvedRoute = resolvedRoute.replaceAll(`__SUBGRAPH_${id}__`, code);
      }

      // 3. 三个出口：路由、setup 顶层 refs、FB body 内 fetch
      if (resolvedRoute) routeLines.push(resolvedRoute);
      if (sn.jsRefLines?.trim()) refLines.push(sn.jsRefLines);
      const fetchBlock = sn.jsCode?.trim() || "";
      if (fetchBlock) frontendCodeLines.push(fetchBlock);

      // 4. 覆盖 subgraphCodeMap：FB jsCode 占位符替换时用 fetchBlock
      subgraphCodeMap.set(sn.id, fetchBlock);
    } else {
      // 前端节点 → 照常收集
      if (sn.subgraph) {
        const innerCode = collectSubgraphCode(sn.subgraph, subgraphCodeMap);
        subgraphCodeMap.set(sn.id, innerCode);
      }

      if (sn.jsCode?.trim()) {
        frontendCodeLines.push(sn.jsCode.trim());
      }
    }
  }

  // 组装最终前端 body（解析占位符）
  let frontendBody = frontendCodeLines.join("\n");
  for (const [id, subCode] of subgraphCodeMap) {
    frontendBody = frontendBody.replaceAll(`__SUBGRAPH_${id}__`, subCode);
  }

  const backendRouteCode = routeLines.join("\n\n");
  const frontendRefLines = refLines.length > 0 ? refLines.join("\n") : "";

  return {
    frontendBody,
    backendRouteCode,
    backendServiceCode: "", // 代码已内联到路由，无需单独 service 文件
    frontendRefLines,
  };
}
