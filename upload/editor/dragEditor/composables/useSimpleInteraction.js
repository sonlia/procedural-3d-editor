import { ref, computed } from "vue";
import { useProjectStore } from "src/stores/projectMange.js";
import {
  centerOnNode,
  selectNode,
  selectedNodeId,
  isNodeHidden,
  toggleNodeHidden,
} from "src/components/editor/nodeEditor/composables/useLitegraphEditor.js";
import {
  remove,
  copy,
  simulatePreviewNodeClick,
  updateEditorLabelPlacement,
  clearEditorLabelPlacement,
} from "../preview/previewUtils.js";
import { useDragEditorData } from "./useDragEditorData.js";

// === 全局 displayMode 状态管理 ===
export const globalDisplayMode = ref(1); // 0=槽编辑, 1=编辑, 2=预览

// === 全局 节点层级树面板显示状态 ===
export const showNodeHierarchy = ref(false);

// === 全局 Graph节点树面板显示状态 ===
export const showGraphNodesTree = ref(false);

// === 全局 selectedNodeId - 从 useLitegraphEditor 重新导出 ===
export { selectedNodeId };

// === 全局 槽编辑目标节点ID ===
export const globalSlotEditNodeId = ref(null);

// === 槽编辑历史栈（记录嵌套路径） ===
export const slotEditStack = ref([]);

/**
 * 进入槽编辑模式，推入栈
 * @param {string} nodeId - 节点 ID
 * @param {string} nodeName - 节点显示名称
 */
export const pushSlotEdit = (nodeId, nodeName) => {
  if (!nodeId) return;

  // 检查是否已在栈中，避免重复
  const existingIndex = slotEditStack.value.findIndex(
    (item) => item.id === nodeId,
  );
  if (existingIndex >= 0) {
    // 如果已存在，截断到该位置
    slotEditStack.value = slotEditStack.value.slice(0, existingIndex + 1);
  } else {
    slotEditStack.value.push({ id: nodeId, name: nodeName || nodeId });
  }

  globalSlotEditNodeId.value = nodeId;
  globalDisplayMode.value = 0;
};

/**
 * 跳转到栈中指定位置
 * @param {number} index - 栈索引
 */
export const jumpToSlotEdit = (index) => {
  if (index < 0 || index >= slotEditStack.value.length) return;

  // 截断栈到指定位置
  slotEditStack.value = slotEditStack.value.slice(0, index + 1);
  const target = slotEditStack.value[index];

  if (target) {
    globalSlotEditNodeId.value = target.id;
    globalDisplayMode.value = 0;
  }
};

/**
 * 退出槽编辑模式
 */
export const exitSlotEdit = () => {
  slotEditStack.value = [];
  globalSlotEditNodeId.value = null;
  globalDisplayMode.value = 1;
};

/**
 * 计算属性：面包屑导航数据
 */
export const breadcrumbItems = computed(() => {
  return [
    { id: null, name: "根", isRoot: true },
    ...slotEditStack.value.map((item) => ({ ...item, isRoot: false })),
  ];
});

/**
 * 极简的 iframe 交互管理
 * 使用内部 displayMode 状态，无需外部传参
 */
export const useSimpleInteraction = () => {
  const _project = useProjectStore();
  const { findElementById, getElementParentInfo } = useDragEditorData();

  // 取元素的第一个子节点 id(children 为数组取首个;为对象取首个非空 slot 的首个)
  const getFirstChildId = (el) => {
    if (!el || !el.children) return null;
    if (Array.isArray(el.children)) return el.children[0]?.id || null;
    if (typeof el.children === "object") {
      for (const key of Object.keys(el.children)) {
        const arr = el.children[key];
        if (Array.isArray(arr) && arr.length) return arr[0].id;
      }
    }
    return null;
  };

  let currentIframe = null;
  let currentToolbar = null;
  let injectedStyleElement = null;

  // === 拖拽状态管理 ===
  let isDragging = false;
  let dragStartElement = null;
  let dragStartNodeId = null;
  let dragStartPos = { x: 0, y: 0 };
  let dragGhost = null;
  let currentDropTarget = null;
  let currentDropTargetInfo = null; // 存储完整的 slot 信息
  let currentDropPosition = null; // 'top', 'bottom', 'left', 'right'
  let justFinishedDragging = false; // 标记是否刚完成拖拽，用于阻止 click 事件

  // 移到顶层作用域，以便 clearSelectionUI 可以重置
  let hoveredElement = null;
  let selectedElement = null;
  let lastSelectTime = 0; // 记录最后一次选中的时间，用于防止重复点击

  // === 样式注入 ===
  const injectStyles = (iframe) => {
    if (!iframe?.contentDocument) return;

    if (injectedStyleElement) {
      injectedStyleElement.remove();
    }

    const style = iframe.contentDocument.createElement("style");
    style.textContent = `
      :root {
        --drag-hover-outline: 2px dashed #409EFF;
        --drag-hover-bg: rgba(64, 158, 255, 0.1);
        --drag-selected-outline: 2px solid #409EFF;
        --drag-selected-bg: rgba(64, 158, 255, 0.2);
        --drag-ghost-bg: rgba(64, 158, 255, 0.4);
        --drop-indicator-color: #409EFF;
      }

      [nodeid].drag-editor-hover,
      [slot].drag-editor-hover {
        outline: var(--drag-hover-outline) !important;
        outline-offset: -2px !important;
        background-color: var(--drag-hover-bg) !important;
        transition: outline 0.2s ease !important;
      }

      [nodeid].drag-editor-selected,
      [slot].drag-editor-selected {
        outline: var(--drag-selected-outline) !important;
        outline-offset: -2px !important;
        background-color: var(--drag-selected-bg) !important;
        }

      /* 拖拽时目标元素边框效果 - 支持 nodeid 和 slot 元素 */
      [nodeid].drop-target-top,
      [slot].drop-target-top {
        border-top: 3px solid var(--drop-indicator-color) !important;
      }

      [nodeid].drop-target-bottom,
      [slot].drop-target-bottom {
        border-bottom: 3px solid var(--drop-indicator-color) !important;
      }

      [nodeid].drop-target-left,
      [slot].drop-target-left {
        border-left: 3px solid var(--drop-indicator-color) !important;
      }

      [nodeid].drop-target-right,
      [slot].drop-target-right {
        border-right: 3px solid var(--drop-indicator-color) !important;
      }

      [nodeid].drop-target-center,
      [slot].drop-target-center {
        outline: 3px solid #E53935 !important;
        outline-offset: -3px !important;
        background-color: rgba(229, 57, 53, 0.15) !important;
      }

      .drag-ghost {
        pointer-events: none !important;
        opacity: 0.5 !important;
        background-color: var(--drag-ghost-bg) !important;
        z-index: 10000 !important;
        position: fixed !important;
        border: 2px dashed var(--drop-indicator-color) !important;
        border-radius: 4px !important;
      }
    `;

    iframe.contentDocument.head.appendChild(style);
    injectedStyleElement = style;
  };

  // === 样式管理辅助函数 ===
  const applyHoverStyle = (element) => {
    if (!element) return;
    updateEditorLabelPlacement(element);
    element.classList.add("drag-editor-hover");
  };

  const applySelectedStyle = (element) => {
    if (!element) return;
    updateEditorLabelPlacement(element);
    element.classList.add("drag-editor-selected");
  };

  const removeHoverStyle = (element) => {
    if (!element) return;
    element.classList.remove("drag-editor-hover");
    if (!element.classList.contains("drag-editor-selected")) {
      clearEditorLabelPlacement(element);
    }
  };

  const removeSelectedStyle = (element) => {
    if (!element) return;
    element.classList.remove("drag-editor-selected");
    if (!element.classList.contains("drag-editor-hover")) {
      clearEditorLabelPlacement(element);
    }
  };

  const clearAllStyles = (element) => {
    if (!element) return;
    element.classList.remove("drag-editor-hover", "drag-editor-selected");
    clearEditorLabelPlacement(element);
  };

  // === 拖拽目标样式管理 ===
  const applyDropTargetStyle = (element, position) => {
    if (!element || !position) return;
    // 清除之前的拖拽目标样式
    clearDropTargetStyles(element);
    // 添加新的样式
    element.classList.add(`drop-target-${position}`);
  };

  const clearDropTargetStyles = (element) => {
    if (!element) return;
    element.classList.remove(
      "drop-target-top",
      "drop-target-bottom",
      "drop-target-left",
      "drop-target-right",
      "drop-target-center",
    );
  };

  const clearAllDropTargetStyles = (doc) => {
    if (!doc) return;
    const targetElements = doc.querySelectorAll(
      "[nodeid].drop-target-top, [nodeid].drop-target-bottom, [nodeid].drop-target-left, [nodeid].drop-target-right, [nodeid].drop-target-center, " +
        "[slot].drop-target-top, [slot].drop-target-bottom, [slot].drop-target-left, [slot].drop-target-right, [slot].drop-target-center",
    );
    targetElements.forEach(clearDropTargetStyles);
  };

  // === 拖拽辅助函数 ===
  const createDragGhost = (element) => {
    if (!currentIframe?.contentDocument) return null;

    const ghost = element.cloneNode(true);
    ghost.classList.add("drag-ghost");
    ghost.style.position = "fixed";
    ghost.style.pointerEvents = "none";
    ghost.style.zIndex = "10000";
    ghost.style.opacity = "0.5";

    return ghost;
  };

  const calculateDropPosition = (e, targetElement) => {
    if (!targetElement) return null;

    const rect = targetElement.getBoundingClientRect();
    const mouseX = e.clientX;
    const mouseY = e.clientY;

    // 计算鼠标在元素内的相对位置（0-1之间）
    const relativeX = (mouseX - rect.left) / rect.width;
    const relativeY = (mouseY - rect.top) / rect.height;

    // 九宫格分区逻辑：将元素分为9个区域
    // 只有在边缘区域（外围1/3）才显示插入指示器
    const threshold = 1 / 3; // 边缘区域阈值

    // 判断是否在边缘区域
    const isInLeftEdge = relativeX <= threshold;
    const isInRightEdge = relativeX >= 1 - threshold;
    const isInTopEdge = relativeY <= threshold;
    const isInBottomEdge = relativeY >= 1 - threshold;

    // 优先级：角落 > 边缘 > 中心
    // 左上角
    if (isInLeftEdge && isInTopEdge) {
      return relativeX < relativeY ? "left" : "top";
    }
    // 右上角
    if (isInRightEdge && isInTopEdge) {
      return 1 - relativeX < relativeY ? "right" : "top";
    }
    // 左下角
    if (isInLeftEdge && isInBottomEdge) {
      return relativeX < 1 - relativeY ? "left" : "bottom";
    }
    // 右下角
    if (isInRightEdge && isInBottomEdge) {
      return 1 - relativeX < 1 - relativeY ? "right" : "bottom";
    }

    // 边缘区域
    if (isInLeftEdge) return "left";
    if (isInRightEdge) return "right";
    if (isInTopEdge) return "top";
    if (isInBottomEdge) return "bottom";

    // 中心区域
    return "center";
  };

  const updateDropIndicator = (targetElement, position, doc) => {
    // 清除所有元素的拖拽目标样式
    clearAllDropTargetStyles(doc);

    // 如果没有目标元素或位置，不显示任何指示器
    if (!targetElement || !position) {
      return;
    }

    // 在目标元素上应用边框样式
    applyDropTargetStyle(targetElement, position);
  };

  const cleanupDrag = () => {
    if (dragGhost) {
      dragGhost.remove();
      dragGhost = null;
    }
    // 清除所有拖拽目标样式
    if (currentIframe?.contentDocument) {
      clearAllDropTargetStyles(currentIframe.contentDocument);
    }
    // 恢复工具栏显示
    if (currentToolbar && currentToolbar.style.display === "none") {
      currentToolbar.style.display = "flex";
    }
    isDragging = false;
    dragStartElement = null;
    dragStartNodeId = null;
    currentDropTarget = null;
    currentDropTargetInfo = null; // 清除 slot 信息
    currentDropPosition = null;
  };

  // === 工具栏创建 ===
  const createToolbar = (element, nodeId, slotInfo, onAction, iframeDoc) => {
    const toolbar = iframeDoc.createElement("div");
    toolbar.style.cssText = `
      position: absolute;
      background: rgba(64, 158, 255, 0.9);
      border-radius: 4px;
      padding: 4px 8px;
      display: flex;
      align-items: center;
      gap: 0px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
      z-index: 10000;
      font-family: Arial, sans-serif;
      font-size: 12px;
      white-space: nowrap;
      pointer-events: auto;
    `;

    // 工具按钮
    const buttons = [
      {
        text: "＋",
        action: "add",
        tooltip: "添加",
        color: "rgba(255, 255, 255, 0.8)",
      },
      {
        text: "⎘",
        action: "copy",
        tooltip: "复制",
        color: "rgba(255, 255, 255, 0.8)",
      },
      {
        text: "✕",
        action: "remove",
        tooltip: "删除",
        color: "rgba(255, 255, 255, 0.8)",
      },
      {
        text: "⬆",
        action: "selectParent",
        tooltip: "选中父级",
        color: "rgba(255, 255, 255, 0.8)",
      },
      {
        text: "⬇",
        action: "selectChild",
        tooltip: "选中子级",
        color: "rgba(255, 255, 255, 0.8)",
      },
      {
        text: "📍",
        action: "locate",
        tooltip: "定位",
        color: "rgba(255, 255, 255, 0.8)",
      },
      {
        text: "👁",
        action: "toggleVisible",
        tooltip: "在 nodeEditor 显示/隐藏",
        color: "rgba(255, 255, 255, 0.8)",
      },
    ];

    // 空白区域(无 nodeId)只显示"添加",其余按钮均针对具体元素
    const visibleButtons = nodeId
      ? buttons
      : buttons.filter((b) => b.action === "add");

    visibleButtons.forEach((btnConfig) => {
      const btn = iframeDoc.createElement("button");
      btn.style.cssText = `
        background: ${btnConfig.color};
        color: #409EFF;
        border: none;
        padding: 6px 8px;
        border-radius: 3px;
        cursor: pointer;
        font-size: 11px;
        margin: 0 1px 0 1px;
        transition: opacity 0.2s ease;
      `;
      btn.textContent = btnConfig.text;
      btn.title = btnConfig.tooltip;

      if (btnConfig.action === "toggleVisible") {
        // 眼睛按钮:透明度反映对应节点在 nodeEditor 的隐藏状态(隐藏=0.45,可视=1)
        const baseOpacity = () => (isNodeHidden(nodeId) ? "0.45" : "1");
        btn.style.opacity = baseOpacity();
        btn.onclick = (e) => {
          e.stopPropagation();
          onAction(btnConfig.action);
          btn.style.opacity = baseOpacity(); // 切换后立即刷新两态
        };
        btn.onmouseover = () => (btn.style.opacity = "0.8");
        btn.onmouseout = () => (btn.style.opacity = baseOpacity());
      } else {
        btn.onclick = (e) => {
          e.stopPropagation();
          onAction(btnConfig.action);
        };
        btn.onmouseover = () => (btn.style.opacity = "0.8");
        btn.onmouseout = () => (btn.style.opacity = "1");
      }
      toolbar.appendChild(btn);
    });

    return toolbar;
  };

  // === 位置计算 ===
  const positionToolbar = (toolbar, elementRect, iframeDoc) => {
    const toolbarWidth = 280;
    const toolbarHeight = 40;
    const viewportWidth = iframeDoc.documentElement.clientWidth;
    const viewportHeight = iframeDoc.documentElement.clientHeight;

    // 获取 iframe 内部的滚动偏移
    const scrollLeft =
      iframeDoc.documentElement.scrollLeft || iframeDoc.body.scrollLeft || 0;
    const scrollTop =
      iframeDoc.documentElement.scrollTop || iframeDoc.body.scrollTop || 0;

    // 计算相对于文档的绝对位置（加上滚动偏移）
    let left = elementRect.left + scrollLeft;
    let top = elementRect.top + scrollTop - toolbarHeight - 5;

    // 获取文档的实际尺寸（包括滚动区域）
    const documentWidth = Math.max(
      iframeDoc.documentElement.scrollWidth,
      iframeDoc.documentElement.clientWidth,
      viewportWidth,
    );
    const documentHeight = Math.max(
      iframeDoc.documentElement.scrollHeight,
      iframeDoc.documentElement.clientHeight,
      viewportHeight,
    );

    // 边界检测（相对于文档边界）
    if (left + toolbarWidth > documentWidth) {
      left = documentWidth - toolbarWidth - 10;
    }
    if (left < scrollLeft + 10) {
      left = scrollLeft + 10;
    }
    if (top < scrollTop + 10) {
      top = elementRect.top + scrollTop + elementRect.height + 5;
    }
    if (top + toolbarHeight > scrollTop + viewportHeight - 10) {
      top = scrollTop + viewportHeight - toolbarHeight - 10;
    }

    toolbar.style.left = left + "px";
    toolbar.style.top = top + "px";
  };

  // === 元素查找和数据获取 ===

  /**
   * 查找可交互元素（带有 nodeid 或 slot 属性的元素）
   * 策略：
   * - 同时有 slot 和 nodeid：使用当前元素信息
   *
   * @param {Element} target - 开始查找的目标元素
   * @returns {Object|null} - {element, nodeId, isSlot, slotName} 或 null
   */
  const findInteractiveElement = (target) => {
    if (!target) return null;

    let current = target;
    const iframeDocument = currentIframe?.contentDocument;
    const documentBody = iframeDocument?.body || document.body;

    while (current && current !== documentBody) {
      const nodeId = current.getAttribute("nodeid");
      const slotName = current.getAttribute("slot");

      // 同时有 slot 和 nodeid 属性（slotEditor 模式下的 slot 容器）
      if (slotName && nodeId) {
        return {
          element: current,
          nodeId,
          isSlot: true,
          slotName,
        };
      }

      // 只有 nodeid 属性：默认 slot 为 "default"
      if (nodeId) {
        return {
          element: current,
          nodeId,
          isSlot: true,
          slotName: "default",
        };
      }

      // 只有 slot 属性：向上查找最近的 nodeid
      if (slotName) {
        let parent = current.parentElement;
        while (parent && parent !== documentBody) {
          const parentNodeId = parent.getAttribute("nodeid");
          if (parentNodeId) {
            return {
              element: current,
              nodeId: parentNodeId,
              isSlot: true,
              slotName,
            };
          }
          parent = parent.parentElement;
        }
      }

      current = current.parentElement;
    }

    return null;
  };

  const getElementData = (nodeId) => {
    const findById = (data, id) => {
      if (!data) return null;
      for (const item of data) {
        if (item?.id === id) return item;
        if (item?.children) {
          if (Array.isArray(item.children)) {
            const found = findById(item.children, id);
            if (found) return found;
          } else if (typeof item.children === "object") {
            for (const key in item.children) {
              if (Array.isArray(item.children[key])) {
                const found = findById(item.children[key], id);
                if (found) return found;
              }
            }
          }
        }
      }
      return null;
    };

    return findById(_project.getEditorData('dragEditor')?.children || [], nodeId);
  };

  // === 检测目标元素是否有slots并确定要放入的slot ===
  const detectTargetSlot = (targetElement, position, targetNodeId) => {
    if (!targetElement || !targetNodeId) return null;

    // 优先从 DOM 元素获取 slot 属性（slotEditor 模式下的 slot 容器）
    const domSlotName = targetElement.getAttribute("slot");
    if (domSlotName) {
      return domSlotName;
    }

    const elementData = getElementData(targetNodeId);

    // 检查是否有slots（children是对象且不是数组）
    const hasSlots =
      elementData?.children &&
      typeof elementData.children === "object" &&
      !Array.isArray(elementData.children);

    if (!hasSlots) {
      return null;
    }

    const availableSlots = Object.keys(elementData.children);

    // 回退策略：选择第一个可用的slot
    const targetSlot = availableSlots[0] || "default";

    return targetSlot;
  };

  // === 事件绑定 ===
  const bindIframe = (iframe, onSearchShow, onNodeMove, onSearchHide) => {
    if (!iframe?.contentDocument) return null;

    currentIframe = iframe;
    injectStyles(iframe);

    const doc = iframe.contentDocument;

    const handleMouseOver = (e) => {
      // 直接使用全局 displayMode，无需 .value
      if (globalDisplayMode.value === 2 || isDragging) {
        return;
      }

      const interactiveInfo = findInteractiveElement(e.target);

      if (!interactiveInfo) return;

      const { element, nodeId } = interactiveInfo;

      // 检查元素是否已经有悬停样式，避免重复添加
      if (element.classList.contains("drag-editor-hover")) {
        return;
      }

      // 清除其他元素的悬停样式（除了已选中的元素）
      const currentHovered =
        currentIframe.contentDocument.querySelectorAll(".drag-editor-hover");
      currentHovered.forEach((el) => {
        if (!el.classList.contains("drag-editor-selected")) {
          removeHoverStyle(el);
        }
      });

      // 添加新的悬停样式
      applyHoverStyle(element);
      hoveredElement = element;
    };

    const handleMouseOut = (e) => {
      if (globalDisplayMode.value === 2 || isDragging) return;

      const interactiveInfo = findInteractiveElement(e.target);

      if (interactiveInfo) {
        const { element } = interactiveInfo;
        // 只移除悬停样式，不移除选中样式
        if (element && !element.classList.contains("drag-editor-selected")) {
          removeHoverStyle(element);
          if (hoveredElement === element) hoveredElement = null;
        }
      }
    };

    const handleClick = (e) => {
      if (globalDisplayMode.value === 2) {
        return;
      }

      // 如果点击的是工具栏或工具栏内的元素，跳过处理（让按钮的 onclick 正常执行）
      if (currentToolbar && currentToolbar.contains(e.target)) {
        return;
      }

      // 通知外部隐藏搜索框（如果搜索框正在显示）
      if (onSearchHide) {
        onSearchHide();
      }

      // 如果刚完成拖拽，阻止点击事件触发工具栏
      if (justFinishedDragging) {
        justFinishedDragging = false;
        return;
      }

      const interactiveInfo = findInteractiveElement(e.target);

      // 在编辑模式下，阻止组件的默认交互行为（如 label 触发 input 点击）
      // 这样可以避免同一次点击触发多次 handleClick
      if (interactiveInfo?.element) {
        e.preventDefault();
      }
      // 如果没有找到可交互元素，检查是否点击在 #app 或 body 上
      if (!interactiveInfo) {
        const target = e.target;
        // 空白根区域判定:除 #app / body / html 外,DVHA/Quasar 模板的布局壳
        // (q-layout / q-page-container / q-page)也算空白区。否则空页面时 q-layout
        // 撑满 #app,点击落在 <main class="q-page"> 上,旧的 #app/BODY 判定会漏掉,
        // 导致无法弹出"添加"工具栏、加不了第一个元素。
        const isBlankRoot =
          target.id === "app" ||
          target.tagName === "BODY" ||
          target.tagName === "HTML" ||
          (typeof target.matches === "function" &&
            target.matches(".q-layout, .q-page-container, .q-page"));

        if (isBlankRoot) {
          // 点击空白区域，交替显示/隐藏顶部工具栏
          e.stopPropagation();

          // 清除之前的选中元素样式
          if (selectedElement) {
            clearAllStyles(selectedElement);
            selectedElement = null;
          }

          // 如果工具栏已存在，则隐藏（交替效果）
          if (currentToolbar) {
            currentToolbar.remove();
            currentToolbar = null;

            // 槽编辑模式下保持 selectedNodeId，避免槽编辑按钮失效
            if (globalDisplayMode.value !== 0) {
              selectNode.value = null;
            }
            return;
          }

          // 槽编辑模式下保持 selectedNodeId，避免槽编辑按钮失效
          if (globalDisplayMode.value !== 0) {
            selectNode.value = null;
          }

          // 创建空白区域工具栏（只有添加按钮）
          currentToolbar = createToolbar(
            null,
            null,
            null, // 空白区域没有 slot 信息
            (action) => {
              handleToolbarAction(action, null, null, onSearchShow);
            },
            doc,
          );

          doc.body.appendChild(currentToolbar);

          // 定位在左上角
          currentToolbar.style.left = "10px";
          currentToolbar.style.top = "10px";
          return;
        }

        // 其他空白区域，清除选中
        if (selectedElement) {
          clearAllStyles(selectedElement);
          selectedElement = null;
        }
        if (currentToolbar) {
          currentToolbar.remove();
          currentToolbar = null;
        }
        // 槽编辑模式下保持 selectedNodeId，避免槽编辑按钮失效
        if (globalDisplayMode.value !== 0) {
          selectNode.value = null;
        }
        return;
      }

      const { element, nodeId, isSlot, slotName } = interactiveInfo;

      e.stopPropagation();

      // 如果点击的是已选中的元素，则隐藏工具栏（交替效果）
      // 但如果是刚选中的（200ms内），跳过交替隐藏（防止 label 触发 input 的重复点击）
      const now = Date.now();
      if (selectedElement === element && currentToolbar) {
        if (now - lastSelectTime < 200) {
          // 刚选中的元素，跳过交替隐藏
          console.log("⏹️ 跳过交替隐藏（防止重复点击）");
          return;
        }
        clearAllStyles(selectedElement);
        selectedElement = null;
        currentToolbar.remove();
        currentToolbar = null;

        // 槽编辑模式下保持 selectedNodeId，避免槽编辑按钮失效
        if (globalDisplayMode.value !== 0) {
          selectNode.value = null;
        }
        return;
      }

      // 清除之前的选中
      if (selectedElement) {
        clearAllStyles(selectedElement);
      }
      if (currentToolbar) {
        currentToolbar.remove();
      }

      // 设置新的选中
      selectedElement = element;
      lastSelectTime = Date.now(); // 记录选中时间

      // 确保清除所有样式后再应用选中样式
      clearAllStyles(element);
      applySelectedStyle(element);

      // 同步更新 nodeEditor：选中并居中节点
      centerOnNode(nodeId);

      // 创建工具栏，传递 slot 信息
      const slotInfo = { isSlot, slotName };

      currentToolbar = createToolbar(
        element,
        nodeId,
        slotInfo,
        (action) => {
          handleToolbarAction(action, nodeId, slotInfo, onSearchShow);
        },
        doc,
      );

      doc.body.appendChild(currentToolbar);

      // 定位工具栏
      const elementRect = element.getBoundingClientRect();
      positionToolbar(currentToolbar, elementRect, doc);
    };

    // === 拖拽事件处理 ===
    const handleMouseDown = (e) => {
      if (globalDisplayMode.value === 2) return;

      // 只处理左键，右键用于视口拖拽（Panzoom）
      if (e.button !== 0) return;

      const interactiveInfo = findInteractiveElement(e.target);
      if (!interactiveInfo) return;

      const { element, nodeId } = interactiveInfo;

      // 记录拖拽开始信息
      dragStartElement = element;
      dragStartNodeId = nodeId;
      dragStartPos = { x: e.clientX, y: e.clientY };
    };

    const handleMouseMove = (e) => {
      if (globalDisplayMode.value === 2) return;

      // 检查是否应该开始拖拽
      if (dragStartElement && !isDragging) {
        const dx = e.clientX - dragStartPos.x;
        const dy = e.clientY - dragStartPos.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // 移动距离超过10px开始拖拽
        if (distance > 10) {
          isDragging = true;

          // 隐藏工具栏，避免遮挡拖拽操作
          if (currentToolbar) {
            currentToolbar.style.display = "none";
          }

          // 创建拖拽幻影
          dragGhost = createDragGhost(dragStartElement);
          if (dragGhost) {
            doc.body.appendChild(dragGhost);
          }

          // 隐藏原始元素的hover样式
          removeHoverStyle(dragStartElement);
        }
      }

      // 如果正在拖拽，更新幻影位置和放置指示器
      if (isDragging && dragGhost) {
        dragGhost.style.left = e.clientX + 10 + "px";
        dragGhost.style.top = e.clientY + 10 + "px";

        // 检测放置目标
        const elementUnderCursor = doc.elementFromPoint(e.clientX, e.clientY);
        const dropInteractiveInfo = findInteractiveElement(elementUnderCursor);

        if (
          dropInteractiveInfo &&
          dropInteractiveInfo.element !== dragStartElement
        ) {
          const dropTarget = dropInteractiveInfo.element;
          const position = calculateDropPosition(e, dropTarget);
          currentDropTarget = dropTarget;
          currentDropTargetInfo = dropInteractiveInfo; // 存储完整的 slot 信息
          currentDropPosition = position;
          updateDropIndicator(dropTarget, position, doc);
        } else {
          currentDropTarget = null;
          currentDropTargetInfo = null; // 清除 slot 信息
          currentDropPosition = null;
          // 清除拖拽目标样式
          clearAllDropTargetStyles(doc);
        }
      }
    };

    const handleMouseUp = (e) => {
      if (!isDragging) {
        // 如果没有拖拽，重置拖拽开始状态
        dragStartElement = null;
        dragStartNodeId = null;
        return;
      }

      // 标记刚完成拖拽，阻止后续 click 事件触发工具栏
      justFinishedDragging = true;
      // 短暂延迟后重置标志，防止影响正常点击
      setTimeout(() => {
        justFinishedDragging = false;
      }, 100);

      // 执行拖拽放置
      if (currentDropTarget && currentDropPosition && onNodeMove) {
        const dropTargetNodeId = currentDropTargetInfo?.nodeId;

        if (!dropTargetNodeId) {
          cleanupDrag();
          return;
        }

        // 区分两种情况：拖拽到 slot 元素 vs 拖拽到普通 nodeid 元素
        let targetSlot = null;
        if (currentDropTargetInfo?.isSlot) {
          // 直接拖拽到 slot 元素
          targetSlot = currentDropTargetInfo.slotName;
        } else {
          // 拖拽到普通 nodeid 元素，检测是否有 slots
          targetSlot = detectTargetSlot(
            currentDropTarget,
            currentDropPosition,
            dropTargetNodeId,
          );
        }

        // 调用数据层的移动函数，传递slot信息和详细位置信息
        const success = onNodeMove(
          dragStartNodeId,
          dropTargetNodeId,
          currentDropPosition,
          targetSlot,
          currentDropTarget, // 传递目标DOM元素，用于更精确的位置计算
        );

        if (!success) {
          console.error("❌ Failed to move node");
        }
      }

      // 清理拖拽状态
      cleanupDrag();
    };

    // === 滚动事件处理 ===
    let scrollTimeout = null;
    const handleScroll = () => {
      if (currentToolbar && selectedElement) {
        // 防抖：清除之前的定时器
        if (scrollTimeout) {
          clearTimeout(scrollTimeout);
        }

        // 设置新的定时器，50ms 后执行位置更新
        scrollTimeout = setTimeout(() => {
          const elementRect = selectedElement.getBoundingClientRect();
          positionToolbar(currentToolbar, elementRect, doc);
          scrollTimeout = null;
        }, 16); // 约 60fps 的更新频率
      }
    };

    // === 键盘事件处理（在 iframe 内部） ===
    const handleKeyDownInIframe = (e) => {
      // ESC 键：隐藏工具栏和清除选中
      if (e.key === "Escape") {
        e.preventDefault();

        // 清除选中元素样式
        if (selectedElement) {
          clearAllStyles(selectedElement);
          selectedElement = null;
        }

        // 移除工具栏
        if (currentToolbar) {
          currentToolbar.remove();
          currentToolbar = null;
        }

        // 清除选中状态
        if (globalDisplayMode.value !== 0) {
          selectNode.value = null;
        }
        return;
      }

      // Delete/Backspace 键：删除节点
      if (!selectedNodeId.value) return;

      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        handleToolbarAction(
          "remove",
          selectedNodeId.value,
          null,
          onSearchShow,
        );
      }
    };

    // === 右键菜单事件处理 ===
    const handleContextMenu = (e) => {
      if (globalDisplayMode.value === 2) return;

      // 只阻止默认右键菜单，不清除选中状态
      // 右键拖拽由 Panzoom 处理，右键点击不应影响元素选中
      e.preventDefault();
      e.stopPropagation();
    };

    doc.addEventListener("mouseover", handleMouseOver, true);
    doc.addEventListener("mouseout", handleMouseOut, true);
    doc.addEventListener("click", handleClick, true);
    doc.addEventListener("mousedown", handleMouseDown, true);
    doc.addEventListener("mousemove", handleMouseMove, true);
    doc.addEventListener("mouseup", handleMouseUp, true);
    doc.addEventListener("scroll", handleScroll, true);
    doc.addEventListener("keydown", handleKeyDownInIframe, true);
    doc.addEventListener("contextmenu", handleContextMenu, true);

    return () => {
      doc.removeEventListener("mouseover", handleMouseOver, true);
      doc.removeEventListener("mouseout", handleMouseOut, true);
      doc.removeEventListener("click", handleClick, true);
      doc.removeEventListener("mousedown", handleMouseDown, true);
      doc.removeEventListener("mousemove", handleMouseMove, true);
      doc.removeEventListener("mouseup", handleMouseUp, true);
      doc.removeEventListener("scroll", handleScroll, true);
      doc.removeEventListener("keydown", handleKeyDownInIframe, true);
      doc.removeEventListener("contextmenu", handleContextMenu, true);

      if (currentToolbar) {
        currentToolbar.remove();
        currentToolbar = null;
      }
      if (injectedStyleElement) {
        injectedStyleElement.remove();
        injectedStyleElement = null;
      }
      // 清理拖拽状态
      cleanupDrag();
    };
  };

  // === 工具栏动作处理 ===
  const handleToolbarAction = (action, nodeId, slotInfo, onSearchShow) => {
    console.log('[handleToolbarAction] Called:', { action, nodeId, hasOnSearchShow: !!onSearchShow, hasCurrentToolbar: !!currentToolbar, hasCurrentIframe: !!currentIframe });

    switch (action) {
      case "add":
        // 传递nodeId、slot信息和工具栏位置给搜索回调
        if (onSearchShow) {
          // 获取工具栏位置，转换为主页面视口坐标
          let toolbarPosition = null;

          console.log('[handleToolbarAction add] Checking conditions:', { currentToolbar: !!currentToolbar, currentIframe: !!currentIframe });

          if (currentToolbar && currentIframe) {
            // 工具栏在 iframe 内的位置（相对于 iframe 视口）
            const toolbarRect = currentToolbar.getBoundingClientRect();

            // 直接使用工具栏在 iframe 内的位置
            // 因为 indexWidget 和 iframe 在同一个 transform 容器内，坐标系一致
            toolbarPosition = {
              left: toolbarRect.left,
              top: toolbarRect.top,
            };

            console.log(`[Position] toolbar in iframe: left=${toolbarRect.left.toFixed(0)}, top=${toolbarRect.top.toFixed(0)}`);
          } else {
            console.warn('[SearchWidget] Missing currentToolbar or currentIframe!', {
              currentToolbar: currentToolbar,
              currentIframe: currentIframe
            });
          }
          onSearchShow(nodeId, slotInfo, toolbarPosition);
        }
        break;
      case "copy":
        // 调用复制方法，会同时复制dragEditor节点、子节点和对应的nodeEditor节点
        if (nodeId) {
          copy(nodeId);
        }
        break;
      case "remove":
        // 调用删除方法，会同时删除dragEditor节点、子节点和对应的nodeEditor节点
        remove(nodeId);
        break;
      case "selectParent": {
        // 选中父级元素:复用 simulatePreviewNodeClick 在 dragEditor 内重选(根元素无父则无操作)
        const info = getElementParentInfo(nodeId);
        if (info?.parentId) simulatePreviewNodeClick(info.parentId);
        break;
      }
      case "selectChild": {
        // 选中第一个子级元素(叶子无子则无操作)
        const data = _project.getEditorData("dragEditor") || [];
        const childId = getFirstChildId(findElementById(data, nodeId));
        if (childId) simulatePreviewNodeClick(childId);
        break;
      }
      case "toggleVisible":
        // 切换对应节点在 nodeEditor 的显示/隐藏(眼睛按钮透明度由 createToolbar 同步刷新)
        toggleNodeHidden(nodeId);
        break;
      case "locate":
        try {
          centerOnNode(nodeId, true); // 置顶,避免被重叠节点遮挡
        } catch (error) {
          console.warn("定位失败:", error);
        }
        break;
    }
  };

  // === 键盘处理 ===
  const handleKeyDown = (e, onSearchShow) => {
    // ESC 键：隐藏工具栏和清除选中
    if (e.key === "Escape") {
      e.preventDefault();

      // 清除选中元素样式
      if (selectedElement) {
        clearAllStyles(selectedElement);
        selectedElement = null;
      }

      // 移除工具栏
      if (currentToolbar) {
        currentToolbar.remove();
        currentToolbar = null;
      }

      // 清除选中状态
      if (globalDisplayMode.value !== 0) {
        selectNode.value = null;
      }
      return;
    }

    // Delete/Backspace 键：删除节点
    if (!selectedNodeId.value) return;

    if (e.key === "Delete" || e.key === "Backspace") {
      // 检查焦点是否在可编辑元素内，如果是则不触发删除
      const target = e.target;
      const isEditable = target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.isContentEditable ||
        target.closest("[contenteditable]");
      if (isEditable) return;

      e.preventDefault();
      handleToolbarAction("remove", selectedNodeId.value);
    }
  };

  // === 清除选择状态 ===
  const clearSelection = () => {
    // 清空选中的节点
    selectNode.value = null;

    // 清理 UI 状态
    clearSelectionUI();
  };

  // === 只清除 UI 状态（不清空 selectedNodeId）===
  // 用于模式切换时保留选中节点但清理旧的 DOM 引用
  const clearSelectionUI = () => {
    // 重置内部 DOM 引用（避免引用已删除的 DOM 元素）
    selectedElement = null;
    hoveredElement = null;

    // 如果 iframe 已初始化，清除样式类
    if (currentIframe?.contentDocument) {
      const doc = currentIframe.contentDocument;
      const selectedElements = doc.querySelectorAll(".drag-editor-selected");
      const hoveredElements = doc.querySelectorAll(".drag-editor-hover");

      selectedElements.forEach((el) => {
        clearAllStyles(el);
      });

      hoveredElements.forEach((el) => {
        clearAllStyles(el);
      });
    }

    // 移除工具栏
    if (currentToolbar) {
      currentToolbar.remove();
      currentToolbar = null;
    }
  };

  return {
    bindIframe,
    handleKeyDown,
    clearSelection,
    clearSelectionUI, // 只清理 UI 状态，保留 selectedNodeId
    // 暴露样式管理函数供其他地方使用
    applyHoverStyle,
    applySelectedStyle,
    removeHoverStyle,
    removeSelectedStyle,
    clearAllStyles,
    // 拖拽目标样式管理函数
    applyDropTargetStyle,
    clearDropTargetStyles,
    clearAllDropTargetStyles,
  };
};
