import { useProjectStore } from "src/stores/projectMange.js";
import { uid as uuid } from "quasar";
import { computed, unref } from "vue";
import {
  getNodeConf,
  addNodes,
  removeNodesByIds,
  copyNodeEditorNode,
} from "src/components/editor/nodeEditor/composables/useLitegraphEditor.js";
import codeStrategy from "src/components/editor/codeStrategies/index.js";

const _project = useProjectStore();

// === 模块级 iframe 引用 ===
let _previewIframe = null;
const EDITOR_LABEL_TOP_SAFE_SPACE = 22;

export function setPreviewIframe(iframe) {
  _previewIframe = iframe;
}

export function updateEditorLabelPlacement(element) {
  if (!element?.getAttribute?.("data-editor-label")) return;
  const rect = element.getBoundingClientRect();
  element.classList.toggle(
    "vs-editor-label-below",
    rect.top < EDITOR_LABEL_TOP_SAFE_SPACE,
  );
}

export function clearEditorLabelPlacement(element) {
  element?.classList?.remove("vs-editor-label-below");
}

/**
 * 模拟点击 preview iframe 中的节点，触发 useSimpleInteraction 的完整交互流程
 * （高亮 + 工具栏 + centerOnNode + 属性面板）
 * @returns {boolean} 是否成功触发
 */
export function simulatePreviewNodeClick(nodeId) {
  if (!nodeId || !_previewIframe?.contentDocument) return false;
  const doc = _previewIframe.contentDocument;
  const el =
    doc.querySelector(`.vs-edit-node[nodeid="${nodeId}"]`) ||
    doc.querySelector(`[nodeid="${nodeId}"]`);
  if (!el) return false;
  const rect = el.getBoundingClientRect();
  el.dispatchEvent(new MouseEvent("click", {
    bubbles: true,
    cancelable: true,
    clientX: rect.left + rect.width / 2,
    clientY: rect.top + rect.height / 2,
  }));
  return true;
}

/**
 * 遍历节点树（支持数组和对象类型的 children）
 */
const traverseNodes = (nodes, callback) => {
  if (!nodes || !Array.isArray(nodes)) return;

  nodes.forEach((node, index) => {
    if (!node) return;
    callback(node, index, nodes);

    if (!node.children) return;

    if (Array.isArray(node.children)) {
      traverseNodes(node.children, callback);
    } else if (typeof node.children === "object") {
      Object.values(node.children).forEach((slotNodes) => {
        if (Array.isArray(slotNodes)) {
          traverseNodes(slotNodes, callback);
        }
      });
    }
  });
};

/**
 * 使用策略创建响应式更新数据
 */
export const createUpdateData = (modeRef = "preview", selectedNodeIdRef = null) => {
  return computed(() => {
    const mode = unref(modeRef);
    const selectedNodeId = unref(selectedNodeIdRef);

    // 🔥 直接访问响应式属性，确保 Vue 能追踪依赖
    const projectData = _project.projectData;
    const currentSelect = projectData?.directory?.currentSelect;
    const currentEditor = projectData?.directory?.editors?.[currentSelect];
    const currentNode = (projectData?.directory?.treeData || []).find(
      (node) => node.id === currentSelect,
    );
    const isMeta2dFile = currentNode?.templateType === "meta2d";
    const hasPreviewData = isMeta2dFile
      ? !!currentEditor
      : !!currentEditor?.nodeEditorData;


    // 如果 nodeEditorData 不存在，返回 null 表示无效数据，不应触发 compile
    if (!hasPreviewData) {

      return null;
    }

    // 获取样式
    const globalStyle = _project.getGlobalStyle?.() || '';
    const localStyle = _project.getStyle?.() || '';

    // 调用策略生成 SFC（generateSFC 内部通过 afterStep 实时获取所有代码）
    const result = codeStrategy.generateSFC({
      mode,
      globalStyle,
      localStyle,
      selectedNodeId,
      meta2dData: currentEditor?.meta2dData || { pens: [] },
    });


    return result;
  });
};


/**
 * 根据ID选择节点 - 在 iframe 中高亮显示对应元素
 */
export function selectNodeById(id) {
  if (!id) return;

  const iframe = _previewIframe;
  if (!iframe?.contentDocument) return;

  const doc = iframe.contentDocument;
  const currentSelected = Array.from(
    doc.querySelectorAll(".drag-editor-selected"),
  ).find((el) => el.getAttribute("nodeid") === id);

  // 清除之前的选中样式
  const previousSelected = doc.querySelectorAll(".drag-editor-selected");
  previousSelected.forEach((el) => {
    el.classList.remove("drag-editor-selected");
    clearEditorLabelPlacement(el);
  });

  // 查找并选中新元素
  const element =
    currentSelected ||
    doc.querySelector(`.vs-edit-node[nodeid="${id}"]`) ||
    doc.querySelector(`[nodeid="${id}"]`);
  if (element) {
    updateEditorLabelPlacement(element);
    element.classList.add("drag-editor-selected");
  }
}

/**
 * 数据操作工具函数
 */
const findNodeById = (nodes, id) => {
  let foundNode = null;
  if (!nodes || nodes.length === 0) return null;
  traverseNodes(nodes, (node) => {
    if (node?.id === id) {
      foundNode = node;
      return false;
    }
  });
  return foundNode;
};

const findAndRemoveNode = (nodes, id) => {
  let removedNode = null;
  traverseNodes(nodes, (node, index, parentArray) => {
    if (node?.id === id) {
      removedNode = parentArray.splice(index, 1)[0];
      return false;
    }
  });
  return removedNode;
};

const addNodeByPosition = (nodes, targetId, newNode, slot = "default") => {
  // 处理 nodes是[]情况。
  if (targetId == null) {
    nodes.unshift(newNode);
    return newNode;
  }

  traverseNodes(nodes, (node, index, Pnodes) => {
    if (node && node.id === targetId) {
      // 选中节点，有slot 但并未选中，父级肯定是数组，且查找到node 在其前面插入。
      if (slot) {
        for (let i = 0; i < Pnodes.length; i++) {
          if (Pnodes[i].id === node.id) {
            // 插入到前面
            Pnodes[i].children[slot].unshift(newNode);
            return false;
          }
        }
        return false;
      } else {
        for (let i = 0; i < Pnodes.length; i++) {
          if (Pnodes[i].id === node.id) {
            // 插入到前面
            Pnodes.splice(i + 1, 0, newNode);
            return false;
          }
        }
      }
      return nodes;
    }
  });
};

const moveNode = (nodes, sourceId, targetId, slot, position) => {
  const movedNode = findAndRemoveNode(nodes, sourceId);
  if (!movedNode) return nodes;

  if (!targetId) {
    switch (position) {
      case "Top":
      case "Left":
        nodes.unshift(movedNode);
        break;
      case "Bottom":
      case "Right":
      default:
        nodes.push(movedNode);
        break;
    }
    return nodes;
  }

  let inserted = false;
  traverseNodes(nodes, (node) => {
    if (node?.id === targetId) {
      if (!node.children) {
        node.children = [];
      }

      if (slot && Array.isArray(node.children[slot])) {
        node.children[slot].unshift(movedNode);
      } else {
        if (Array.isArray(node.children)) {
          switch (position) {
            case "Top":
            case "Left":
              node.children.unshift(movedNode);
              break;
            case "Bottom":
            case "Right":
              node.children.push(movedNode);
              break;
            case "Middle":
            default:
              node.children.unshift(movedNode);
              break;
          }
        } else if (typeof node.children === "object") {
          if (!node.children.default) {
            node.children.default = [];
          }
          node.children.default.unshift(movedNode);
        }
      }

      inserted = true;
      return false;
    }
  });

  return inserted ? nodes : null;
};

const removeNodeById = (nodes, id) => {
  traverseNodes(nodes, (node, index, pnodes) => {
    if (node?.id === id) {
      pnodes.splice(index, 1);
      return false;
    }
  });
  return nodes;
};

const updateChildrenIds = (node, generateId, updateId = {}) => {
  const id = node.id;
  updateId[id] = null;
  node.id = generateId();
  updateId[id] = node.id;
  if (node.children) {
    if (Array.isArray(node.children)) {
      node.children.forEach((child) =>
        updateChildrenIds(child, generateId, updateId),
      );
    } else if (typeof node.children === "object") {
      Object.keys(node.children).forEach((key) => {
        node.children[key].forEach((child) =>
          updateChildrenIds(child, generateId, updateId),
        );
      });
    } else if (node.children == null) {
      // pass
    } else {
      updateId[node.children.id] = null;
      node.children.id = generateId();
      updateId[node.children.id] = node.children.id;
    }
  }
  return updateId;
};

const getChildrenIds = (node, ids = []) => {
  if (!node) return;
  ids.push(node.id);
  if (node.children) {
    if (Array.isArray(node.children)) {
      node.children.forEach((child) => getChildrenIds(child, ids));
    } else if (typeof node.children === "object") {
      Object.keys(node.children).forEach((key) => {
        node.children[key].forEach((child) => getChildrenIds(child, ids));
      });
    } else if (node.children == null) {
      // pass
    } else {
      ids.push(node.children.id);
    }
  }
  return ids;
};

const copyNodeById = (nodes, id) => {
  const originalNode = findNodeById(nodes, id);
  if (!originalNode) return nodes;

  const copiedNode = JSON.parse(JSON.stringify(originalNode));
  const updateData = updateChildrenIds(copiedNode, uuid);

  traverseNodes(nodes, (node, index, parentArray) => {
    if (node.id === id) {
      parentArray.splice(index, 0, copiedNode);
      return false;
    }
  });

  return updateData;
};

/**
 * 分析 slots构造 slot 对象
 */
const getSlot = (slots) => {
  let slot = {};
  if (Array.isArray(slots)) {
    slot = []; // 如果是数组，直接返回空数组
  } else if (typeof slots === "object" && slots !== null) {
    for (let key in slots) {
      slot[key] = [];
    }
  } else {
    slot = slots; // 如果是其他类型，直接返回传入的值
  }
  return slot;
};

// =============== 导出的操作函数 ===============

export const copyDragEditor = (id) => {
  const data = _project.getEditorData("dragEditor");
  const copyNode = copyNodeById(data, id);
  _project.updateEditorData("dragEditor", data);
  return copyNode;
};

// drag  编辑器  节点复制
export const copy = (id, _) => {
  // drag 编辑器复制
  const copyNode = copyDragEditor(id);
  // node编辑器 复制
  copyNodeEditorNode(copyNode);
};

export const remove = (id, _) => {
  const removeNodes = removeDragEditor(id);
  // 删除node Editor 数据 - 使用ID列表删除
  const removeNodeLists = getChildrenIds(removeNodes);
   removeNodesByIds(removeNodeLists);
};

export const removeDragEditor = (id) => {
  const data = _project.getEditorData("dragEditor");
  const removeNodes = findNodeById(data, id);
  removeNodeById(data, id);
  _project.updateEditorData("dragEditor", data);
  return removeNodes;
};

export const insert = (currentId, nodeType, slot) => {
  const newNode = insertDragEditor(currentId, nodeType, slot);
  // node 编辑器创建节点
  addNodes([newNode], true);
};

export const insertDragEditor = (currentId, nodeType, slot) => {
  const data = _project.getEditorData("dragEditor") || [];
  const node = getNodeConf(nodeType);
  const slots = node.nodeRawData.slots;
  let newNode = {
    id: uuid(),
    type: nodeType,
    children: getSlot(slots),

  };
  // drag编辑器 插入节点
  addNodeByPosition(data, currentId, newNode, slot);
  _project.updateEditorData("dragEditor", data);
  return newNode;
};

// =============== 导出工具函数供composables使用 ===============

export {
  traverseNodes,
  findNodeById,
  findAndRemoveNode,
  addNodeByPosition,
  moveNode,
  removeNodeById,
  updateChildrenIds,
  getChildrenIds,
  copyNodeById,
  getSlot,
};
