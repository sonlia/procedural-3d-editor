/**
 * 图形编辑器钩子函数 - 包含所有数据库图形管理功能
 */
import { shallowRef, onBeforeUnmount } from "vue";

import { LGraph, LGraphCanvas, LiteGraph } from "../../nodeEditor/editor.js";
import { DBTableNode } from "../graph/DBTableNode.js";
import { DBProcedureNode } from "../graph/DBProcedureNode.js";
import { uid } from "quasar";
import { useDbConfig, currentGraphId } from "./useDbConfig.js";
import { dbTreeManager } from "./useDbTreeManager.js";
import { DEFAULT_JOIN_TYPE } from "./useDbJoinManager.js";
import { set } from "lodash-es";
import { useProjectStore } from "../../../../stores/projectMange.js";


// 使用单例模式存储图形实例
export const graphIns = shallowRef(null);
export const canvasIns = shallowRef(null);

const dbConfig = useDbConfig();

/**
 * 图形编辑器Hook - 单例模式实现
 */
export function useGraphEditor() {
  /**
   * 初始化图形实例
   * @param {HTMLElement} canvasElement 画布DOM元素
   * @returns {Object} 图形和画布实例
   */
  const initGraph = (canvasElement) => {
    // 延迟获取 manager，避免循环依赖
    const manager = dbTreeManager();

    // 注册表节点类型
    LiteGraph.registerNodeType("db/table", DBTableNode);
    // 注册存储过程/函数节点类型(与表同级的独立节点,slot 由签名同步)
    LiteGraph.registerNodeType("db/procedure", DBProcedureNode);

    // 重置 currentGraphId，确保 selectNode 会重新加载 graph 数据
    // 避免组件重新挂载时新空 LGraph 被误认为已加载
    currentGraphId.value = "";

    // 创建图形实例
    graphIns.value = new LGraph();
    canvasIns.value = new LGraphCanvas(canvasElement, graphIns.value, {
      autoresize: true,
    });

    // 调整大小
    canvasIns.value.resize();

    graphIns.value.on_change = function () {
      const dbNodeId = currentGraphId.value;
      if (!dbNodeId) return;
      if (graphIns.value?.reload) return;

      const projectStore = useProjectStore();
      projectStore.updateDbEditorData(dbNodeId, 'graphData', graphIns.value.serialize());

      manager.saveTreeData();
    };
    // 注册连接变更事件 — JOIN type 存在 target 节点 properties.joinTypes[slotId]
    graphIns.value.onNodeConnectionChange = function (
      type,
      nodeA,
      slotA,
      nodeB,
      slotB,
    ) {
      if (type !== LiteGraph.OUTPUT) return;
      if (graphIns.value?.reload) return;

      if (nodeB !== undefined) {
        // ── 连接创建：给 target 节点的 input slot 设默认 joinType ──
        const targetNode = nodeB;
        if (targetNode.properties?.type !== "table") return;

        const inputSlot = targetNode.inputs?.[slotB];
        if (!inputSlot?.id) return;

        if (!targetNode.properties.joinTypes) {
          targetNode.properties.joinTypes = {};
        }
        // 仅在没有记录时设置默认值，保留已有配置
        if (!targetNode.properties.joinTypes[inputSlot.id]) {
          targetNode.properties.joinTypes[inputSlot.id] = DEFAULT_JOIN_TYPE;
        }
      } else {
        // ── 连接断开：清理无连接的 joinType 条目 ──
        const node = nodeA;
        if (!node?.properties?.joinTypes) return;

        const inputSlot = node.inputs?.[slotA];
        if (inputSlot?.id && inputSlot.link == null) {
          delete node.properties.joinTypes[inputSlot.id];
        }
      }
    };

    // 设置节点选中事件 — 统一走 selectNode 路径，确保 currentSelectTreeNode 同步
    canvasIns.value.onNodeSelected = (node) => {
      if (node && node.id) {
        const treeNode = manager.findNode(node.id);
        if (treeNode) {
          dbConfig.selectNode(treeNode);
        }
      }
    };
  };

  /**
   * 创建图形节点
   * @param {string} type 节点类型
   * @param {Array} position 位置坐标 [x, y]
   * @param {string} nodeId 可选的节点ID，如果提供则使用该ID
   * @param {string} nodeName 可选的节点名称
   * @returns {Object} 创建的节点
   */
  const createNode = (type, position, nodeId = null, nodeName = null) => {
    if (!graphIns.value) return null;

    const node = LiteGraph.createNode(type);

    // 如果提供了nodeId，使用该ID
    if (nodeId) {
      node.id = nodeId;
    }
    const _id = node.inputs?.find((item) => item.name === "id");
    if (_id) _id.id = nodeId;
    node.pos = position;

    // 设置节点标题和属性

    node.title = nodeName;
    node.properties.name = nodeName;
    graphIns.value.add(node);

    return node;
  };

  /**
   * 删除图形节点
   * @param {string} nodeId 节点ID
   * @returns {boolean} 是否删除成功
   */
  const removeNode = (nodeId) => {
    if (!graphIns.value) return false;

    const node = graphIns.value.getNodeById(nodeId);
    if (node) graphIns.value.remove(node);
    return true;
  };

  /**
   * 更新节点标题
   * @param {string} nodeId 节点ID
   * @param {string} title 新标题
   */
  const updateNodeTitle = (nodeId, title) => {
    if (!graphIns.value) return;

    const node = graphIns.value.getNodeById(nodeId);
    if (node) {
      node.title = title;

      // 同时更新properties中的name
      if (node.properties) {
        node.properties.name = title;
      }
    }
    graphIns.value.change();
  };
  const updateDataBase = (newDbName) => {
    if (!graphIns.value) return;

    set(graphIns.value, "extra.connection.database", newDbName);
  };
  const updateSlotName = (nodeId, oldNme, newName) => {
    if (!graphIns.value) return;

    const node = graphIns.value.getNodeById(nodeId);
    if (node) {
      const inputIndex = node.findInputSlot(oldNme);
      if (inputIndex !== -1) node.inputs[inputIndex].name = newName;
      const outputIndex = node.findOutputSlot(oldNme);
      if (outputIndex !== -1) node.outputs[outputIndex].name = newName;
    }
    graphIns.value.change();
  };
  const addSlot = (nodeId, name, id) => {
    if (!graphIns.value) return;

    //  graph node  添加 输入输出 slot
    const node = graphIns.value.getNodeById(nodeId);
    if (node) {
      node.addInput(name, "string", { id: id });
      node.addOutput(name, "string", { id: id });
    }

    graphIns.value.change();
  };

  // 用后端权威签名重建存储过程节点的输入/输出 slot
  const syncProcedureSlots = (nodeId, argsStr, returnsStr) => {
    if (!graphIns.value) return;
    const node = graphIns.value.getNodeById(nodeId);
    if (node && typeof node.setSignature === "function") {
      node.setSignature(argsStr, returnsStr);
      graphIns.value.change();
    }
  };

  // 用预解析的签名对象 {inputs:[{name,type}], outputs:[{name,type}]} 重建函数节点 slot
  const syncFunctionSlots = (nodeId, parsed) => {
    if (!graphIns.value || !parsed) return;
    const node = graphIns.value.getNodeById(nodeId);
    if (!node) return;
    if (node.inputs) while (node.inputs.length) node.removeInput(0);
    if (node.outputs) while (node.outputs.length) node.removeOutput(0);
    for (const p of parsed.inputs || []) {
      node.addInput(p.name, "string", { dbType: p.type });
    }
    for (const o of parsed.outputs || []) {
      node.addOutput(o.name, "string", { dbType: o.type });
    }
    node.setDirtyCanvas?.(true, true);
    graphIns.value.change();
  };

  return {
    initGraph,
    addSlot,
    syncProcedureSlots,
    syncFunctionSlots,
    createNode,
    updateSlotName,
    removeNode,
    updateNodeTitle,
    updateDataBase,
  };
}
