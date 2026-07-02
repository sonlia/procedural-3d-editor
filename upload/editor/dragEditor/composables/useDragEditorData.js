import { useProjectStore } from "src/stores/projectMange.js";
import { uid, Notify } from "quasar";
import {
  addNodes,
  getNodeConf,
  removeNodesByIds,
} from "src/components/editor/nodeEditor/composables/useLitegraphEditor.js";

export const useDragEditorData = () => {
  const _project = useProjectStore();

  // ==================== 核心工具函数 ====================

  /**
   * 统一的树遍历器 - 处理所有格式的 children
   * @param {Array} nodes - 节点数组
   * @param {Function} callback - 回调函数 (node, index, parent, slotName) => boolean | void
   *   返回 false 停止遍历，返回 true 表示找到目标（停止后续遍历）
   * @returns {boolean} - 是否找到目标或提前退出
   */
  const walkTree = (nodes, callback) => {
    if (!nodes || !Array.isArray(nodes)) return false;

    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node) continue;

      // 执行回调
      const result = callback(node, i, nodes);
      if (result === true) return true;  // 找到目标，停止遍历
      if (result === false) continue;     // 跳过当前节点的子节点

      // 递归处理 children
      if (node.children) {
        if (Array.isArray(node.children)) {
          // 数组格式 -> 视为 default slot
          if (walkTree(node.children, callback)) return true;
        } else if (typeof node.children === "object") {
          // 对象格式 -> 遍历所有 slot
          for (const slotName in node.children) {
            if (Array.isArray(node.children[slotName])) {
              if (walkTree(node.children[slotName], callback)) return true;
            }
          }
        }
        // 字符串或其他类型 -> 忽略
      }
    }

    return false;
  };

  /**
   * 规范化 children 为对象格式
   * @param {*} children - 任意格式的 children
   * @param {boolean} preserveNull - 是否保留 null（用于判断是否可放置）
   * @returns {Object|null} - { default: [], slot1: [], ... } 或 null
   */
  const normalizeChildren = (children, preserveNull = false) => {
    // 区分 null（不可放置）和 undefined（可以放置）
    if (children === null) {
      return preserveNull ? null : { default: [] };
    }
    if (children === undefined) return { default: [] };
    if (Array.isArray(children)) return { default: children };
    if (typeof children === "object") return children;
    // 字符串、数值等基础类型 -> 可以放置，转换为 default slot
    return { default: [] };
  };

  /**
   * 获取当前项目的 dragEditor 数据
   * @returns {Array} - dragEditor 数据数组
   */
  const getDragEditorData = () => {
    return _project.getEditorData("dragEditor") || [];
  };

  /**
   * 检查目标元素是否可以作为父容器接收子元素
   * @param {Object} targetElement - 目标元素
   * @returns {boolean} - 是否可以插入子元素
   */
  const canInsertAsChild = (targetElement) => {
    if (!targetElement) return false;

    // ❌ children === null 不能放置
    if (targetElement.children === null) {
      return false;
    }

    // ✅ undefined、数组、对象、字符串、数值等都可以放置
    return true;
  };

  /**
   * 校验节点的 parentMustBe 约束
   * @param {string} nodeType - 要添加/移动的节点类型
   * @param {string} targetNodeId - 目标父节点 ID
   * @param {Array} data - 数据树
   * @returns {{ valid: boolean, message?: string }} - 校验结果
   */
  const validateParentConstraint = (nodeType, targetNodeId, data) => {
    const nodeConf = getNodeConf(nodeType);
    const parentMustBe = nodeConf?.parentMustBe || [];

    // 没有约束，直接通过
    if (!parentMustBe || parentMustBe.length === 0) {
      return { valid: true };
    }

    // 根节点特殊处理
    if (!targetNodeId || targetNodeId === "app") {
      return {
        valid: false,
        message: `${nodeConf?.tag || nodeType} 必须放置在 ${parentMustBe.join(" 或 ")} 内部`,
      };
    }

    // 查找目标父节点
    const targetElement = findElementById(data, targetNodeId);
    if (!targetElement) {
      return { valid: true }; // 找不到目标，跳过校验
    }

    // 检查目标节点的 tag 是否在 parentMustBe 列表中
    const targetTag = targetElement.tag;
    if (!parentMustBe.includes(targetTag)) {
      return {
        valid: false,
        message: `${nodeConf?.tag || nodeType} 必须放置在 ${parentMustBe.join(" 或 ")} 内部，当前父节点是 ${targetTag || "未知"}`,
      };
    }

    return { valid: true };
  };

  /**
   * 将节点作为子元素插入到目标元素内部（中间位置）
   * @param {Array} data - 数据树
   * @param {string} targetNodeId - 目标节点 ID
   * @param {Object} nodeToInsert - 要插入的节点
   * @param {string} slotName - slot 名称
   * @returns {boolean} - 是否插入成功
   */
  const insertAsChild = (data, targetNodeId, nodeToInsert, slotName = "default") => {
    let inserted = false;

    walkTree(data, (node) => {
      if (node.id === targetNodeId) {
        // 检查是否可以插入
        if (!canInsertAsChild(node)) {
          console.warn(`❌ Cannot insert as child: target.children is null (id: ${targetNodeId})`);
          return true; // 停止遍历
        }

        // 规范化 children（保留 null 检查）
        const normalized = normalizeChildren(node.children, true);

        if (normalized === null) {
          console.warn(`❌ Cannot insert as child: target.children is null (id: ${targetNodeId})`);
          return true;
        }

        node.children = normalized;

        // 确保目标 slot 存在
        if (!node.children[slotName]) {
          node.children[slotName] = [];
        }

        // 插入到 slot 数组末尾
        node.children[slotName].push(nodeToInsert);

        inserted = true;
        return true; // 停止遍历
      }
    });

    return inserted;
  };

  // ==================== 查找与遍历 ====================

  const findElementById = (data, targetId) => {
    if (!data || !Array.isArray(data)) return null;

    let found = null;
    walkTree(data, (node) => {
      if (node.id === targetId) {
        found = node;
        return true; // 停止遍历
      }
    });
    return found;
  };

  // 遍历节点树的工具函数（保留向后兼容）
  const traverseNodes = (nodes, callback) => {
    walkTree(nodes, callback);
  };

  // 插入节点到目标位置
  const insertNodeToTarget = (
    nodes,
    nodeToInsert,
    targetId,
    slot,
    position,
  ) => {
    let inserted = false;

    walkTree(nodes, (node) => {
      if (node.id === targetId) {
        // 规范化 children 为对象格式
        node.children = normalizeChildren(node.children);

        // 确定目标 slot
        const targetSlot = slot || "default";
        if (!node.children[targetSlot]) {
          node.children[targetSlot] = [];
        }

        // 插入节点
        if (position === "before" || position === "top") {
          node.children[targetSlot].unshift(nodeToInsert);
        } else {
          node.children[targetSlot].push(nodeToInsert);
        }

        inserted = true;
        return true; // 停止遍历
      }
    });

    return inserted;
  };

  // 添加到拖拽编辑器根级别
  const addToDragEditorRoot = (nodeType) => {
    console.log("🔵 addToDragEditorRoot 被调用:", { nodeType });
    const data = getDragEditorData();
    console.log("🔵 当前 dragEditor 数据:", JSON.parse(JSON.stringify(data)));
    const newNode = createNodeFromType(nodeType);
    console.log("🔵 创建的新节点:", JSON.parse(JSON.stringify(newNode)));
    data.push(newNode);
    console.log("🔵 添加后的 dragEditor 数据:", JSON.parse(JSON.stringify(data)));

    // 触发响应式更新
    _project.updateEditorData("dragEditor", data);
    console.log("🔵 已调用 updateEditorData");

    // 同时添加到NodeEditor（触发 LiteGraph 更新）
    try {
      addNodes([newNode], true, null, false, { hidden: true });
      console.log("🔵 已调用 addNodes");
    } catch (error) {
      console.warn("Failed to add node to NodeEditor:", error);
    }

    return newNode;
  };

  // 添加到组件slot
  const addToComponentSlot = (nodeType, targetId, slot, { skipSelect = false } = {}) => {
    console.log("🟢 addToComponentSlot 被调用:", { nodeType, targetId, slot });
    const data = getDragEditorData();
    console.log("🟢 当前 dragEditor 数据:", JSON.parse(JSON.stringify(data)));

    // 校验 parentMustBe 约束
    const validation = validateParentConstraint(nodeType, targetId, data);
    if (!validation.valid) {
      console.warn("🟢 parentMustBe 校验失败:", validation.message);
      Notify.create({
        type: "warning",
        message: validation.message,
        position: "top",
        timeout: 3000,
      });
      return null;
    }

    const newNode = createNodeFromType(nodeType);
    console.log("🟢 创建的新节点:", JSON.parse(JSON.stringify(newNode)));

    if (targetId === "app") {
      // 直接添加到根级别
      data.push(newNode);
      console.log("🟢 添加到根级别");
    } else {
      // 添加到指定组件的slot
      const success = insertNodeToTarget(
        data,
        newNode,
        targetId,
        slot,
        "append",
      );
      console.log("🟢 insertNodeToTarget 结果:", success);
      if (!success) {
        console.error("🟢 插入失败！");
        Notify.create({
          type: "warning",
          message: "未找到目标父节点，添加失败",
          position: "top",
          timeout: 3000,
        });
        return null;
      }
    }

    console.log("🟢 添加后的 dragEditor 数据:", JSON.parse(JSON.stringify(data)));

    // 触发响应式更新
    _project.updateEditorData("dragEditor", data);
    console.log("🟢 已调用 updateEditorData");

    // 同时添加到NodeEditor（触发 LiteGraph 更新）
    try {
      addNodes([newNode], true, null, skipSelect, { hidden: true });
      console.log("🟢 已调用 addNodes");
    } catch (error) {
      console.warn("Failed to add node to NodeEditor:", error);
    }

    return newNode;
  };

  // 从节点类型创建新节点
  const createNodeFromType = (nodeType) => {
    //  需要从LiteGraph节点数据中获取详细信息
    const nodeConf = getNodeConf(nodeType);

    // Layout 节点的 slots 是动态的（由 LayoutPanel 的 flexTree/gridLayout 决定）。
    // 初始化为空对象 {}，LayoutPanel 编辑布局时会同步加 entry。
    const isLayoutNode = !!nodeConf?.nodeRawData?.meta?.isLayoutNode;

    // 基于nodeRawData中的slots构建children和slot对象
    let children;
    let slot;

    if (isLayoutNode) {
      children = {};
      slot = {};
    } else if (nodeConf?.nodeRawData?.slots) {
      const slotsObj = {};
      const slotScopeObj = {};
      let hasSlots = false;

      Object.keys(nodeConf.nodeRawData.slots).forEach((slotKey) => {
        const slotConfig = nodeConf.nodeRawData.slots[slotKey];
        // 为所有 slot 创建空数组（不再区分是否有 scope）
        slotsObj[slotKey] = [];
        // 提取 scope 的键名数组
        if (slotConfig?.scope && Object.keys(slotConfig.scope).length > 0) {
          slotScopeObj[slotKey] = Object.keys(slotConfig.scope);
        }
        hasSlots = true;
      });

      // 如果有 slot，使用对象格式；否则使用 null
      children = hasSlots ? slotsObj : null;
      slot = hasSlots ? slotScopeObj : null;
    } else {
      // 无 slot 配置，默认 null（自闭合组件）
      children = null;
      slot = null;
    }

    return {
      id: `${uid()}`,
      type: nodeType,
      properties: {},
      children,
      slot,
      tag: nodeConf?.tag,
    };
  };
  // 移除节点 —— 与 addToComponentSlot 对称:删 dragEditor 子树的同时换新引用触发重算 + 同步删 nodeEditor 节点
  const removeElement = (nodeId) => {
    const data = getDragEditorData();

    // 先收集目标子树的全部 id(含后代),用于同步删除 nodeEditor 中的对应节点
    const target = findElementById(data, nodeId);
    const ids = [];
    if (target) walkTree([target], (n) => { ids.push(n.id); });

    let removed = false;

    // 使用递归函数删除节点
    const removeFromArray = (arr) => {
      for (let i = 0; i < arr.length; i++) {
        const node = arr[i];
        if (!node) continue;

        // 找到目标节点
        if (node.id === nodeId) {
          arr.splice(i, 1);
          return true;
        }

        // 递归查找子节点
        if (node.children) {
          if (Array.isArray(node.children)) {
            if (removeFromArray(node.children)) return true;
          } else if (typeof node.children === "object") {
            for (const slotName in node.children) {
              if (Array.isArray(node.children[slotName])) {
                if (removeFromArray(node.children[slotName])) return true;
              }
            }
          }
        }
      }
      return false;
    };

    removed = removeFromArray(data);

    if (removed) {
      // 换新引用触发响应式 + debouncedRunStep 重算;并同步删除 nodeEditor 中的对应节点(否则残留孤儿、刷新后复活)
      _project.updateEditorData("dragEditor", data);
      removeNodesByIds(ids.length ? ids : [nodeId]);
    }

    return removed;
  };

  // 复制节点数据
  const cloneNodeData = (nodeData) => {
    const cloned = JSON.parse(JSON.stringify(nodeData));

    // 更新根节点 ID
    cloned.id = uid();

    // 递归更新所有子节点的 ID
    walkTree([cloned], (node) => {
      if (node !== cloned && node.id) {
        node.id = uid();
      }
    });

    return cloned;
  };

  // ==================== moveNodeToPosition 辅助函数 ====================

  /**
   * 从树中移除节点并返回
   * @returns {Object|null} - { node, parentInfo: { parentId, slot, index } } 或 null
   */
  const removeAndExtractNode = (data, sourceNodeId) => {
    let sourceNode = null;
    let parentInfo = null;

    const removeFromArray = (arr, parentId = null, slot = null) => {
      for (let i = 0; i < arr.length; i++) {
        const node = arr[i];
        if (!node) continue;

        if (node.id === sourceNodeId) {
          sourceNode = JSON.parse(JSON.stringify(node)); // 深拷贝
          parentInfo = { parentId, slot, index: i };
          arr.splice(i, 1);
          return true;
        }

        if (node.children) {
          if (Array.isArray(node.children)) {
            if (removeFromArray(node.children, node.id, "default")) return true;
          } else if (typeof node.children === "object") {
            for (const slotName in node.children) {
              if (Array.isArray(node.children[slotName])) {
                if (removeFromArray(node.children[slotName], node.id, slotName))
                  return true;
              }
            }
          }
        }
      }
      return false;
    };

    const found = removeFromArray(data);
    return found ? { node: sourceNode, parentInfo } : null;
  };

  /**
   * 插入节点到指定 slot 中
   */
  const insertNodeIntoSlot = (
    data,
    targetNodeId,
    nodeToInsert,
    slotName,
    position,
  ) => {
    let inserted = false;

    walkTree(data, (node) => {
      if (node.id === targetNodeId) {
        // 规范化 children
        node.children = normalizeChildren(node.children);

        if (!node.children[slotName]) {
          node.children[slotName] = [];
        }

        const slotArray = node.children[slotName];

        if (position === "top" || position === "left") {
          slotArray.unshift(nodeToInsert);
        } else {
          slotArray.push(nodeToInsert);
        }

        inserted = true;
        return true; // 停止遍历
      }
    });

    return inserted;
  };

  /**
   * 插入节点到相对位置（before/after）
   */
  const insertNodeAtPosition = (data, targetNodeId, nodeToInsert, position) => {
    let inserted = false;

    const insertInArray = (arr) => {
      for (let i = 0; i < arr.length; i++) {
        const node = arr[i];
        if (!node) continue;

        if (node.id === targetNodeId) {
          if (position === "top" || position === "left") {
            arr.splice(i, 0, nodeToInsert);
          } else {
            arr.splice(i + 1, 0, nodeToInsert);
          }
          return true;
        }

        if (node.children) {
          if (Array.isArray(node.children)) {
            if (insertInArray(node.children)) return true;
          } else if (typeof node.children === "object") {
            for (const slotName in node.children) {
              if (Array.isArray(node.children[slotName])) {
                if (insertInArray(node.children[slotName])) return true;
              }
            }
          }
        }
      }
      return false;
    };

    inserted = insertInArray(data);
    return inserted;
  };

  // ==================== 节点移动 ====================


  // 移动节点到指定位置（支持slot）
  const moveNodeToPosition = (
    sourceNodeId,
    targetNodeId,
    position,
    targetSlot = null,
  ) => {
    // 深拷贝：在非 reactive 副本上操作，避免 splice 等中间操作触发 watcher
    // 只在最后 updateEditorData 时触发一次 reactive 更新
    const data = JSON.parse(JSON.stringify(getDragEditorData()));

    // 找到目标元素信息（用于判断是否有 slots）
    let targetElement = null;
    if (targetNodeId && targetNodeId !== "app") {
      targetElement = findElementById(data, targetNodeId);
    }

    // 移除源节点
    const extracted = removeAndExtractNode(data, sourceNodeId);
    if (!extracted) {
      console.error("❌ Source node not found:", sourceNodeId);
      return false;
    }

    const { node: sourceNode } = extracted;

    // 判断是否要插入到目标元素内部（中间位置）
    const isInsertInside = (position === "center" || position === "middle");

    // 如果是插入到内部，校验 parentMustBe 约束
    if (isInsertInside && sourceNode.type) {
      const validation = validateParentConstraint(sourceNode.type, targetNodeId, data);
      if (!validation.valid) {
        // 校验失败，恢复源节点到原位置
        console.warn("❌ parentMustBe 校验失败:", validation.message);
        Notify.create({
          type: "warning",
          message: validation.message,
          position: "top",
          timeout: 3000,
        });
        // 恢复原位置（将节点放回数据树）
        const { parentInfo } = extracted;
        if (parentInfo?.parentId) {
          insertAsChild(data, parentInfo.parentId, sourceNode, parentInfo.slot || "default");
        } else {
          data.splice(parentInfo?.index || 0, 0, sourceNode);
        }
        _project.updateEditorData("dragEditor", data);
        return false;
      }
    }

    // 插入到目标位置
    let inserted = false;

    if (targetNodeId === "app" || !targetNodeId) {
      // 插入到根级别
      if (position === "top" || position === "left") {
        data.unshift(sourceNode);
      } else {
        data.push(sourceNode);
      }
      inserted = true;
    } else if (isInsertInside) {
      // ========== 中间位置：作为子元素插入 ==========

      // 检查目标元素是否可以接收子元素
      if (!canInsertAsChild(targetElement)) {
        console.error(`❌ Cannot insert as child: target.children is null (id: ${targetNodeId})`);
        return false;
      }

      // 判断目标元素的 children 类型
      if (
        targetElement.children &&
        typeof targetElement.children === "object" &&
        !Array.isArray(targetElement.children)
      ) {
        // children 是对象 -> 有多个 slot
        const slotName = targetSlot || "default";

        // 检查 slot 是否存在
        if (!targetElement.children[slotName]) {
          console.warn(`⚠️ Slot "${slotName}" does not exist, will be created`);
        }

        inserted = insertAsChild(data, targetNodeId, sourceNode, slotName);
      } else {
        // children 是数组、字符串、数值、undefined -> 转换为 default slot
        inserted = insertAsChild(data, targetNodeId, sourceNode, "default");
      }

      if (!inserted) {
        console.error("❌ Failed to insert node as child");
        return false;
      }
    } else {
      // ========== 上/下/左/右位置：作为兄弟节点插入 ==========
      // 兄弟插入 = 放进"目标的父级"里 → 按目标父级 tag 校验 sourceNode 的 parentMustBe
      // (否则受约束节点如 QItemSection 可绕过"内部插入"校验,以兄弟身份直接落到 QList 等非法父级下)
      if (sourceNode.type) {
        let siblingParentId = null; // 根级 = null
        walkTree(data, (n) => {
          if (!n.children) return;
          const arrs = Array.isArray(n.children)
            ? [n.children]
            : typeof n.children === "object"
              ? Object.values(n.children).filter(Array.isArray)
              : [];
          if (arrs.some((a) => a.some((c) => c && c.id === targetNodeId))) {
            siblingParentId = n.id;
            return true; // 找到目标的父级,停止遍历
          }
        });

        const validation = validateParentConstraint(sourceNode.type, siblingParentId, data);
        if (!validation.valid) {
          console.warn("❌ parentMustBe 校验失败(兄弟插入):", validation.message);
          Notify.create({
            type: "warning",
            message: validation.message,
            position: "top",
            timeout: 3000,
          });
          // 恢复源节点到原位置
          const { parentInfo } = extracted;
          if (parentInfo?.parentId) {
            insertAsChild(data, parentInfo.parentId, sourceNode, parentInfo.slot || "default");
          } else {
            data.splice(parentInfo?.index || 0, 0, sourceNode);
          }
          _project.updateEditorData("dragEditor", data);
          return false;
        }
      }

      inserted = insertNodeAtPosition(data, targetNodeId, sourceNode, position);
      if (!inserted) {
        console.error("❌ Failed to insert node at target position");
        return false;
      }
    }

    // 触发响应式更新
    _project.updateEditorData("dragEditor", data);

    return true;
  };

  // 获取元素的父级信息
  const getElementParentInfo = (nodeId) => {
    const data = getDragEditorData();
    let parentInfo = null;

    const findParent = (arr, parentId = null, slot = null) => {
      for (let i = 0; i < arr.length; i++) {
        const node = arr[i];
        if (!node) continue;

        if (node.id === nodeId) {
          parentInfo = { parentId, slot, index: i };
          return true;
        }

        if (node.children) {
          if (Array.isArray(node.children)) {
            if (findParent(node.children, node.id, "default")) return true;
          } else if (typeof node.children === "object") {
            for (const slotName in node.children) {
              if (Array.isArray(node.children[slotName])) {
                if (findParent(node.children[slotName], node.id, slotName))
                  return true;
              }
            }
          }
        }
      }
      return false;
    };

    findParent(data);
    return parentInfo;
  };

  return {
    // 基础数据操作
    findElementById,

    traverseNodes,

    // 节点操作
    insertNodeToTarget,
    addToDragEditorRoot,
    addToComponentSlot,
    removeElement,
    cloneNodeData,
    createNodeFromType,
    moveNodeToPosition,

    // 工具函数
    getElementParentInfo,
  };
};
