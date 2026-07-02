import { useProjectStore } from "src/stores/projectMange.js";
import { collectAndMergeImports } from "./importMerger.js";
import { replacePlaceholders } from "./placeholderReplacer.js";
import {
  collectAllNodesDeep,
  collectSubgraphCode,
  isBackendNode,
  isBackendRouteNode,
  isDatabaseSubgraph,
} from "./subgraphCollector.js";

export function getCurrentBackendFile() {
  const store = useProjectStore();
  const currentSelect = store.getCurrentSelect();
  return (
    (store.getBackendTreeData() || []).find(
      (item) => item.id === currentSelect,
    ) || null
  );
}

export function safeIdentifier(name, fallback = "backendFunction") {
  const value = String(name || fallback).replace(/[^a-zA-Z0-9_$]/g, "_");
  return /^\d/.test(value) ? `_${value}` : value;
}

export function getExecutableNodes(graph) {
  return graph?._nodes_executable || graph?._nodes || [];
}

export function executeDirtyNodes(nodes, logPrefix) {
  for (const node of nodes || []) {
    if (!node?._dirty) continue;
    try {
      node.onExecute?.();
    } catch (e) {
      console.warn(`[${logPrefix}] 执行 ${node.type} onExecute 失败:`, e);
    }
    node._dirty = false;
  }
}

export function collectRootGraphCode(graph, nodes, options = {}) {
  const {
    preferBackend = true,
    includeRoutes = true,
    includeServices = true,
    includePlainJs = true,
  } = options;
  const subgraphCodeMap = new Map();
  const routeCodeMap = new Map();
  const serviceCodeMap = new Map();
  const bodyLines = [];
  const backendNodes = [];

  for (const node of nodes || []) {
    if (!node || node.type === "graph/output") continue;

    if (node.subgraph) {
      const subCode = collectSubgraphCode(node.subgraph, subgraphCodeMap);
      subgraphCodeMap.set(node.id, subCode);
    }

    if (isBackendNode(node)) {
      backendNodes.push(node);

      if (isDatabaseSubgraph(node)) {
        if (includeRoutes && node.bgJsCode?.trim()) {
          routeCodeMap.set(node.id, node.bgJsCode.trim());
        }
        if (includePlainJs && node.jsRefLines?.trim()) {
          bodyLines.push(node.jsRefLines.trim());
        }
        if (includePlainJs && node.jsCode?.trim()) {
          bodyLines.push(node.jsCode.trim());
        }
        continue;
      }

      const code = preferBackend
        ? node.bgJsCode?.trim() || node.jsCode?.trim()
        : node.jsCode?.trim() || node.bgJsCode?.trim();

      if (isBackendRouteNode(node)) {
        if (includeRoutes && code) routeCodeMap.set(node.id, code);
      } else if (includeServices && code) {
        serviceCodeMap.set(node.id, code);
      }
      if (includePlainJs && code) {
        bodyLines.push(code);
      }
      continue;
    }

    const code = preferBackend
      ? node.bgJsCode?.trim() || node.jsCode?.trim()
      : node.jsCode?.trim() || node.bgJsCode?.trim();
    if (includePlainJs && code) bodyLines.push(code);
  }

  const replace = (code) => replacePlaceholders(code, subgraphCodeMap, new Map());
  const bodyCode = replace(bodyLines.join("\n"));
  for (const [id, code] of routeCodeMap) routeCodeMap.set(id, replace(code));
  for (const [id, code] of serviceCodeMap) serviceCodeMap.set(id, replace(code));

  return {
    bodyCode,
    routeCodeMap,
    serviceCodeMap,
    backendNodes,
    bgImportStr: collectAndMergeImports(collectAllNodesDeep(graph), "", "bgImportStr"),
  };
}

export function buildImportHeader(importStr) {
  return importStr ? `${importStr.split(";").join(";\n")};\n` : "";
}

export function syncBackendOutput(nodeId, outputCode, routeCode = "", serviceCode = "") {
  if (!nodeId) return;
  useProjectStore().setOutputCode(nodeId, outputCode, routeCode, serviceCode);
}
