import { LGraph, LGraphCanvas, LiteGraph } from "../editor.js";

import {
  ref,
  toRaw,
  computed,
  defineAsyncComponent,
  watch,
  markRaw,
} from "vue";
import { useProjectStore } from "src/stores/projectMange.js";
import {
  treeDataForSearch,
  currentTemplateType,
  templateType,
} from "src/components/leftWidget/folder/useFileTree.js";
import { uid as uuid } from "quasar";
import { useDebounceFn } from "@vueuse/core";

// 导入代码策略统一调度器
import codeStrategy from "../../codeStrategies/index.js";
// 节点场景过滤(category 主轴 + treePath 细分)与依赖过滤工具
import { matchNodeScope, matchParent, categoryOfTreePath } from "../node/nodeScope.js";
// AI 编辑器「导出节点」批量注册(从 directory.aiExports 恢复,使消费图能反序列化)
import { registerAiExportedNodes } from "../../aiEditor/aiExportedNode.js";

// ==================== 导出变量 ====================

export const selectNode = ref(null);
// 响应式的选中节点ID（从 selectNode 派生）
export const selectedNodeId = computed(() => selectNode.value?.id || null);
// 节点选择计数器，用于强制触发 watcher（解决 Vue 对象引用比较问题）
export const selectNodeCounter = ref(0);
export const showTabMenu = ref(false);
export const tabMenuPosition = ref({ x: 0, y: 0 });
// 节点变化计数器，用于触发树形组件刷新
export const nodeChangeCounter = ref(0);
// 调试模式 UI 白名单(graph 实例级):控制 trace/breakpoint/log toggle 在节点面板是否可见
// 与 graph.extra.__debugModesVisible 双向同步,initProj 时从 extra 读取
export const debugModesVisible = ref({ trace: true, breakpoint: true, log: true });
// 面包屑路径，从 graphcanvas 内部状态计算
export const graphPath = ref([]);
let graph, graphcanvas;

// 防抖的 runStep，避免属性频繁变化时重复触发
const debouncedRunStep = useDebounceFn(() => {
  if (selectNode.value && selectNode.value.type !== "canvas") {
    selectNode.value._dirty = true;
  }
  runStep();
}, 100);

// 属性变化监听器的清理函数
let stopPropertiesWatch = null;

// 初始化属性变化监听
// 监听选中节点的 properties 变化，自动触发 runStep
// 这样属性面板只需维护数据，不需要关心触发更新的逻辑
function setupPropertiesWatch() {
  // 清理之前的监听器
  stopPropertiesWatch?.();

  stopPropertiesWatch = watch(
    () => selectNode.value?.properties,
    (newProps, oldProps) => {
      // 跳过初始化和节点切换时的触发
      if (!newProps || !oldProps) return;
      // 跳过 canvas 类型的选中
      if (selectNode.value?.type === "canvas") return;

      debouncedRunStep();
    },
    { deep: true },
  );
}

// 更新面包屑路径（从 litegraph 内部状态读取）
function updateGraphPath() {
  const path = [];
  if (graphcanvas?._graph_stack?.length > 0) {
    // _graph_stack[0] 是根图，从 [1] 开始是 subgraph
    for (let i = 1; i < graphcanvas._graph_stack.length; i++) {
      const subgraphNode = graphcanvas._graph_stack[i]._subgraph_node;
      if (subgraphNode) {
        path.push({
          id: subgraphNode.id,
          title: subgraphNode.title || subgraphNode.getTitle?.() || "Subgraph",
        });
      }
    }
    // 当前图的 _subgraph_node
    const currentSubgraphNode = graphcanvas.graph?._subgraph_node;
    if (currentSubgraphNode) {
      path.push({
        id: currentSubgraphNode.id,
        title:
          currentSubgraphNode.title ||
          currentSubgraphNode.getTitle?.() ||
          "Subgraph",
      });
    }
  }
  graphPath.value = path;
}

export let graphJsCode = computed(() => {
  return graph?.extra?.jsCode || "";
});

// 添加更新graphJsCode的函数
export function updateGraphJsCode(newCode) {
  if (graph && graph.extra) {
    graph.extra.jsCode = newCode;
  }
}
export function createIns(canvasRef) {
  graph = new LGraph();
  graphcanvas = new LGraphCanvas(canvasRef.value, graph);
  graphcanvas.show_info = false;
  window._graph = graph;
  window._graphcanvas = graphcanvas; // 保存全局引用

  // 初始化属性变化监听（当节点属性变化时自动触发 runStep）
  setupPropertiesWatch();

  // 不启动自动循环，改为手动调用 runStep()
  // graph.start() 会以 ~60fps 循环执行 onAfterStep，导致大量不必要的计算
  // 只在需要时通过 runStep() 手动触发更新
  graphcanvas.resize();

  // 设置Tab菜单回调
  graphcanvas.onTabMenu = function (e) {
    // 使用LiteGraph的坐标转换方法，考虑画布的缩放和偏移
    // graph_mouse是相对于画布的坐标，需要转换为屏幕坐标
    const canvasPos = graphcanvas.convertOffsetToCanvas([
      graphcanvas.graph_mouse[0],
      graphcanvas.graph_mouse[1],
    ]);

    // 获取canvas元素的边界信息
    const canvasRect = canvasRef.value.getBoundingClientRect();

    // 计算最终屏幕位置
    tabMenuPosition.value = {
      x: canvasRect.left + canvasPos[0],
      y: canvasRect.top + canvasPos[1],
    };
    // 切换菜单显示状态
    showTabMenu.value = !showTabMenu.value;
  };

  // 设置隐藏Tab菜单回调
  graphcanvas.onHideTabMenu = function () {
    showTabMenu.value = false;
  };

  // 设置画布点击回调
  graphcanvas.onCanvasClicked = function (e) {
    // 使用 defineAsyncComponent 包装异步导入，并用 markRaw 避免 Vue 响应式警告
    const CanvasPanel = markRaw(
      defineAsyncComponent(() => import("../propertyPanel/CanvasPanel.vue")),
    );
    // 设置 selectNode 为画布标识对象
    selectNode.value = {
      type: "canvas",
      id: "canvas",
      title: "画布设置",
      graph: graphcanvas?.graph || graph,
      uiPanel: CanvasPanel,
    };
    selectNodeCounter.value++;
  };

  graph.onAfterStep = function () {
    // 策略层内部已经处理了 outputCode 的写入
    // 只需调用 afterStep，无需再手动存储到 graph.extra
    codeStrategy.afterStep();
  };

  // 设置节点选中回调（在此处设置确保使用同一模块的 ref 引用）
  graphcanvas.onNodeSelected = function (node) {
    console.log(node);
    if (node?.uiPanel) markRaw(node.uiPanel);
    selectNode.value = node;
    selectNodeCounter.value++;
  };

  graphcanvas.onNodeDeselected = function (node) {
    selectNode.value = null;
  };

  graphcanvas.onShowNodePanel = (node) => false;

  // 包装 openSubgraph 和 closeSubgraph 以更新面包屑
  const originalOpenSubgraph = graphcanvas.openSubgraph.bind(graphcanvas);
  const originalCloseSubgraph = graphcanvas.closeSubgraph.bind(graphcanvas);

  graphcanvas.openSubgraph = function (subgraph) {
    originalOpenSubgraph(subgraph);
    updateGraphPath();
  };

  graphcanvas.closeSubgraph = function () {
    originalCloseSubgraph();
    updateGraphPath();
    // 关闭子图后强制刷新画布，确保父图节点正确显示
    graphcanvas.setDirty(true, true);
  };

  return { graph, graphcanvas };
}

export function initProj(data) {
  const _project = useProjectStore();

  // 设置加载标志位，防止在加载时触发孤儿节点清理
  _project.setLoadingEditorData(true);

  // 重置面包屑路径
  graphPath.value = [];

  // 每次加载项目时重新注册 tree 节点，确保文件树数据已更新
  registerTreeNode();

  const editorData = _project.getEditorData("nodeEditorData");
  selectNode.value = null;

  if (data || toRaw(editorData)) {
    configure(data || toRaw(editorData));
  } else {
    // 即使没有数据也要清空 graph
    graph?.clear();
  }

  // 延迟清除加载标志位，确保 Vue 的响应式更新完成
  setTimeout(() => {
    _project.setLoadingEditorData(false);

    // 调试模式清除钩子:重开项目时把所有节点 __debugMode reset 为 'off',
    // 让上次 session 落盘的带调试代码自动还原(随后 runStep 会重新生成)
    if (graph?._nodes?.length) {
      for (const node of graph._nodes) {
        if (!node?.properties) continue;
        if (node.properties.__debugMode && node.properties.__debugMode !== 'off') {
          node.properties.__debugMode = 'off';
        }
      }
    }
    // 全局 UI 白名单兜底:不存在时默认全 true(让三种模式 toggle 都可见)
    if (graph) {
      if (!graph.extra) graph.extra = {};
      if (!graph.extra.__debugModesVisible) {
        graph.extra.__debugModesVisible = { trace: true, breakpoint: true, log: true };
      }
      // 同步到响应式 ref 供组件使用
      debugModesVisible.value = { ...graph.extra.__debugModesVisible };
    }

    // 调用 runStep() 触发 onAfterStep，更新 graph.extra（vNodeCode, jsCode, importStr）
    if (graph && graph._nodes?.length > 0) {
      markAllDirty();
      runStep();
    }
  }, 100);
}
export const onResize = () => {
  graphcanvas?.resize();
};

export function configure(x) {
  // 🔥 确保 graph 已初始化
  if (!graph) {
    return;
  }

  // 🔥 临时保存并禁用结构变化回调，防止加载时触发 runStep
  const savedOnNodeAdded = graph.onNodeAdded;
  const savedOnNodeRemoved = graph.onNodeRemoved;
  const savedOnNodeConnectionChange = graph.onNodeConnectionChange;

  graph.onNodeAdded = null;
  graph.onNodeRemoved = null;
  graph.onNodeConnectionChange = null;

  graph.clear();
  if (JSON.stringify(x) != "{}" && x.nodes.length > 0) {
    // 🔥 检查并报告缺失的节点类型
    const missingTypes = x.nodes
      .filter((n) => !LiteGraph.registered_node_types[n.type])
      .map((n) => n.type);

    if (missingTypes.length > 0) {
      const uniq = [...new Set(missingTypes)];
      console.warn(
        `[LiteGraph.configure] 老项目数据含已废弃/未注册的节点类型,将被静默丢弃: ${uniq.join(", ")}。如来源是 WhereExists,请用 TableNode outputMode='builder' + 下游 where in 替代`,
      );
    }

    graph.configure(x);
  }

  // 🔥 恢复结构变化回调
  graph.onNodeAdded = savedOnNodeAdded;
  graph.onNodeRemoved = savedOnNodeRemoved;
  graph.onNodeConnectionChange = savedOnNodeConnectionChange;
}

import * as allNodeList from "../node/index.js";
let rawNodeCache = false;
const registerRawNode = () => {
  for (let _nodeList in allNodeList) {
    const nodelist = allNodeList[_nodeList];
    for (let nodeGroup in nodelist) {
      const node = nodelist[nodeGroup].default;
      Object.entries(node).forEach(([_key, value]) => {
        LiteGraph.registerNodeType(value.treePath + "/" + value.id, value);
      });
    }
  }
  rawNodeCache = true;
};

import {
  createDynamicClass,
  uiNodeMeta,
} from "src/components/editor/nodeEditor/node/nodeMetea.js";
export const registerTreeNode = () => {
  const _nodelist = treeDataForSearch();
  const registeredCount = Object.keys(_nodelist).length;

  if (registeredCount === 0) {
    return;
  }

  for (let node in _nodelist) {
    const nodeData = _nodelist[node];
    // 构建兼容 createDynamicClass 的数据结构
    const ins = createDynamicClass(
      {
        name: nodeData.fileName,
        tag: null,
        treePath: nodeData.treePath,
        fileType: nodeData.fileType,
        // nodeRawData 相关字段（使用默认空结构）
        props: {},
        slots: { default: { desc: "默认插槽", desc_cn: "默认插槽" } },
        events: {},
        methods: {},
        computedProps: {},
      },
      uiNodeMeta,
    );
    LiteGraph.registerNodeType("tree/" + node, ins);
  }
};

export function initRegister() {
  // 注册原始节点，并缓存
  if (!rawNodeCache) registerRawNode();

  // 注册tree节点

  registerTreeNode();

  // 注册 AI 编辑器导出节点(从 directory.aiExports 索引恢复)
  registerAiExportedNodes(useProjectStore().getAiExports());
}

export function resetCanvas() {
  graphcanvas.ds.reset();
  graphcanvas.setDirty(true, true);
}

export function addNodes(nodeList, randomPos = true, position = null, skipSelect = false, opts = {}) {
  function getRandomInt(min, max) {
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  // 批量添加节点
  const nodesToAdd = Array.isArray(nodeList) ? nodeList : [nodeList];
  const addedNodes = [];

  const mergeNodeProperties = (target, source) => {
    if (!target || !source) return;

    Object.entries(source).forEach(([key, value]) => {
      if (
        value &&
        typeof value === "object" &&
        !Array.isArray(value) &&
        target[key] &&
        typeof target[key] === "object" &&
        !Array.isArray(target[key])
      ) {
        Object.entries(value).forEach(([childKey, childValue]) => {
          target[key][childKey] = childValue;
        });
      } else {
        target[key] = value;
      }
    });
  };

  // 使用 requestAnimationFrame 批量处理节点添加
  requestAnimationFrame(() => {
    nodesToAdd.forEach((node) => {
      const node_watch = LiteGraph.createNode(node.type);
      if (!node_watch) {
        console.warn(`[addNodes] 节点类型 "${node.type}" 未注册，跳过创建`);
        return;
      }
      node_watch.id = node.id || uuid();
      if (node.properties && node_watch.properties) {
        mergeNodeProperties(node_watch.properties, node.properties);
      }
      if (node.showPassInSlots !== undefined) {
        node_watch.showPassInSlots = node.showPassInSlots !== false;
      }
      if (node.showPassOutSlots !== undefined) {
        node_watch.showPassOutSlots = node.showPassOutSlots !== false;
      }
      node_watch.applyPassSlotVisibility?.();

      // 默认隐藏:经 dragEditor 添加的 UI 节点在 nodeEditor 中默认不显示,
      // 需用户在元素工具栏点"可视"才出现(flags 随 serialize 自动持久化)
      if (opts.hidden) {
        node_watch.flags = node_watch.flags || {};
        node_watch.flags.hidden = true;
      }

      // 设置节点位置
      if (position) {
        // 获取canvas的边界信息
        const canvasRect = graphcanvas.canvas.getBoundingClientRect();
        // 转换为相对于canvas的坐标
        const canvasX = position.x - canvasRect.left;
        const canvasY = position.y - canvasRect.top;
        // 转换为图形坐标
        const canvasPos = graphcanvas.convertCanvasToOffset([canvasX, canvasY]);
        node_watch.pos = [canvasPos[0], canvasPos[1]];
      } else if (randomPos) {
        node_watch.pos = [getRandomInt(200, 300), getRandomInt(200, 300)];
      }

      const addedNode = graphcanvas.graph.add(node_watch);
      if (addedNode) {
        addedNodes.push(addedNode);
      }
    });

    // 如果只添加一个节点且未禁止选中，选中它
    if (!skipSelect && addedNodes.length === 1) {
      const nodeToSelect = addedNodes[0];

      // 选中节点（更新 LiteGraph 内部状态）
      graphcanvas.selectNode(nodeToSelect);

      // 手动触发 Vue 响应式状态更新
      requestAnimationFrame(() => {
        selectNode.value = nodeToSelect;
        if (nodeToSelect?.properties) {
          import("../../dragEditor/preview/previewUtils.js").then((module) => {
            module.selectNodeById(nodeToSelect.id);
          });
        }
      });
    }

    // 更新画布
    graphcanvas.setDirty(true, true);

    // 触发节点结构变化，更新 vNodeCode 和 jsCode
    onNodeStructureChange();
  });

  return null;
}
export function copyNodeEditorNode(idObj) {
  Object.entries(idObj).forEach(([key, value]) => {
    const oldNode = graph.getNodeById(key);

    const newNode = oldNode.clone();
    newNode.id = value;
    newNode.pos = [newNode.pos[0] + 15, newNode.pos[1] + 15];
    oldNode.graph.add(newNode);
  });
}
// 清空画布
export function clearGraph() {
  graph.clear();
}
export function start(x) {
  graph.stop();

  graph.start(x);
}
export function runStep() {
  if (!graph) {
    // graph 未初始化时静默返回，这是正常的时序情况
    return;
  }
  graph.runOnce();

  // 同步更新 store 中的 nodeEditorData
  const _project = useProjectStore();
  _project.updateEditorData("nodeEditorData", graph.serialize());
}

// 节点结构变化时调用（添加/删除/连接变化）
export function onNodeStructureChange() {
  markAllDirty();
  runStep();
  // 仅在结构变化时触发树刷新
  nodeChangeCounter.value++;
}

// 标记所有节点为 dirty，用于结构变化或项目初始化
export function markAllDirty() {
  if (!graph) return;
  for (const node of graph._nodes || []) {
    node._dirty = true;
  }
}
export function stop() {
  graph.stop();
  // 清理属性变化监听器
  stopPropertiesWatch?.();
}

// 根据节点ID删除节点
export function removeNodesByIds(nodeIds) {
  if (!graph) return;

  const idsToRemove = Array.isArray(nodeIds) ? nodeIds : [nodeIds];

  requestAnimationFrame(() => {
    idsToRemove.forEach((nodeId) => {
      if (nodeId) {
        const node = graph.getNodeById(nodeId);
        if (node) {
          graph.remove(node);
        }
      }
    });
    graph.setDirtyCanvas(true);
  });
}

export function removeNodes(nodes) {
  const nodesToRemove = Array.isArray(nodes) ? nodes : [nodes];

  requestAnimationFrame(() => {
    nodesToRemove.forEach((node) => {
      if (node) {
        graph.remove(node);
      }
    });
    graph.setDirtyCanvas(true);
  });
}
export function getNodeConf(id) {
  return new LiteGraph.registered_node_types[id]();
}
export function centerOnNode(id, bringFront = false) {
  const node = graph?.getNodeById(id);

  if (node) {
    requestAnimationFrame(() => {
      // 置顶:定位时把节点移到最上层,避免被重叠节点遮挡
      if (bringFront) graphcanvas.bringToFront(node);
      graphcanvas.centerOnNode(node);
      graphcanvas.selectNode(node);
      // 更新 selectNode 并递增计数器强制触发 watcher
      selectNode.value = node;
      selectNodeCounter.value++;
    });
  }
}

// 查询节点在 nodeEditor 中是否隐藏
export function isNodeHidden(id) {
  return !!graph?.getNodeById(id)?.flags?.hidden;
}

// 持久化当前 graph 到 nodeEditorData(flags 等随 serialize 一并保存)
export function saveNodeEditorData() {
  if (!graph) return;
  useProjectStore().updateEditorData("nodeEditorData", graph.serialize());
}

// 切换节点在 nodeEditor 中的显示/隐藏,返回切换后的隐藏状态
export function toggleNodeHidden(id) {
  const node = graph?.getNodeById(id);
  if (!node) return false;
  node.flags = node.flags || {};
  node.flags.hidden = !node.flags.hidden;
  graphcanvas.setDirty(true, true);
  // 持久化:flags 随 serialize 进入 nodeEditorData
  saveNodeEditorData();
  return node.flags.hidden;
}
export function getAllNodes() {
  return LiteGraph.registered_node_types;
}

// 导出精简节点目录(type/title/treePath),供 AI 生成图数据时只选用已注册的合法类型。
// 默认剔除内部基建(graph/*)与独立编辑器(meta2d/*)节点。
// 提取一个节点类的输入/输出契约(实例化读 slots;失败则空)
function extractNodeIO(type) {
  try {
    const node = LiteGraph.createNode(type);
    if (!node) return { inputs: [], outputs: [] };
    const slot = (s) => ({ name: s?.name || "", type: typeof s?.type === "string" ? s.type : "" });
    return {
      inputs: Array.isArray(node.inputs) ? node.inputs.map(slot) : [],
      outputs: Array.isArray(node.outputs) ? node.outputs.map(slot) : [],
    };
  } catch {
    return { inputs: [], outputs: [] };
  }
}

const _nodeCatalogCache = new Map();

// 导出精简节点知识(type/title/desc/treePath/category + 输入输出契约),供 AI 生成 graph 数据时
// 只选用已注册的合法类型。默认剔除内部基建(graph/*)与独立编辑器(meta2d/*)节点。
// 实例化取 IO 有成本,按(注册表规模 + excludePrefixes)缓存(节点类型基本静态;新增 tree/AI 节点会改变规模)。
export function getNodeCatalog({ excludePrefixes = ["graph", "meta2d"] } = {}) {
  // 确保原始/tree 节点已注册(用户可能尚未打开过图编辑器就触发 AI Graph)
  initRegister();
  const types = LiteGraph.registered_node_types || {};
  const keys = Object.keys(types);
  const cacheKey = keys.length + "|" + excludePrefixes.join(",");
  if (_nodeCatalogCache.has(cacheKey)) return _nodeCatalogCache.get(cacheKey);

  const result = [];
  for (const type of keys) {
    const cls = types[type];
    // treePath 优先类静态字段,回退为注册 key 去掉末段(id)
    const treePath = cls?.treePath || type.split("/").slice(0, -1).join("/");
    const hit = excludePrefixes.some(
      (p) => treePath === p || treePath.startsWith(p + "/") || type.startsWith(p + "/"),
    );
    if (hit) continue;
    const { inputs, outputs } = extractNodeIO(type);
    result.push({
      type,
      title: cls?.title || cls?.name || type,
      desc: cls?.desc || "",
      treePath,
      category: cls?.categories || categoryOfTreePath(treePath),
      inputs,
      outputs,
    });
  }

  _nodeCatalogCache.set(cacheKey, result);
  return result;
}

export function getGraphInstance() {
  return graph;
}

// 面包屑导航：跳转到指定层级
// index = -1 表示跳转到根图
export function navigateToGraphLevel(index) {
  if (!graphcanvas) return;

  if (index === -1) {
    // 跳转到根图：关闭所有子图
    while (graphPath.value.length > 0) {
      graphcanvas.closeSubgraph();
    }
  } else if (index < graphPath.value.length - 1) {
    // 跳转到中间层级：关闭从当前到目标层级之间的所有子图
    const levelsToClose = graphPath.value.length - 1 - index;
    for (let i = 0; i < levelsToClose; i++) {
      graphcanvas.closeSubgraph();
    }
  }
  // 如果 index 等于当前层级，不需要做任何操作
}

const objectToNestedArray = (obj) => {
  const nestedArray = [];

  for (const key in obj) {
    if (obj.hasOwnProperty(key)) {
      const node = obj[key];
      // 跳过没有 treePath 的节点
      if (!node?.treePath) continue;

      let current = nestedArray;
      const pathParts = node.treePath.split("/");

      // 遍历路径部分
      for (let i = 0; i < pathParts.length; i++) {
        const part = pathParts[i];
        let found = current.find((_node) => _node.name === part);

        if (!found) {
          found = {
            name: part,
            selectable: false,
            children: [],
            id: uuid(),
          };
          current.push(found);
        }

        // 如果是最后一个路径节点,添加实际节点作为其子节点
        if (i === pathParts.length - 1) {
          found.children.push({
            name: node.title,
            id: key,
            selectable: true,
          });
        }

        current = found.children;
      }
    }
  }

  return nestedArray;
};
// 在注册表中按 tag 查 { key, cls }(容纳树解析用;tag 为 createDynamicClass 暴露的静态属性)
const findRegisteredByTag = (data, tag) => {
  for (const key in data) {
    if (data[key]?.tag === tag) return { key, cls: data[key] };
  }
  return null;
};

// 父→子 容纳关系:父的 allowChildren(正向,软) ∪ parentMustBe 含该父的节点(反推)
const getChildTags = (parentTag, data) => {
  const tags = new Set();
  const parent = findRegisteredByTag(data, parentTag);
  (parent?.cls?.allowChildren || []).forEach((t) => tags.add(t));
  for (const key in data) {
    const cls = data[key];
    if (cls?.tag && (cls.parentMustBe || []).includes(parentTag)) tags.add(cls.tag);
  }
  return [...tags];
};

// 递归构建"父级子组件"推荐子树(限深 3 防爆、seen 防环);每个节点都是可添加组件(selectable)
const buildRecommendedSubtree = (parentTag, data, seen = new Set(), depth = 0) => {
  if (depth > 3 || seen.has(parentTag)) return [];
  seen.add(parentTag);
  const nodes = [];
  for (const childTag of getChildTags(parentTag, data)) {
    const entry = findRegisteredByTag(data, childTag);
    if (!entry) continue;
    nodes.push({
      name: entry.cls.title || childTag,
      id: entry.key,
      selectable: true,
      children: buildRecommendedSubtree(childTag, data, new Set(seen), depth + 1),
    });
  }
  return nodes;
};

/**
 * 获取用于搜索组件的节点数据(按场景 scope 过滤 + 父级从属推荐)
 * @param {object|null} scope - { categories?, includeTreePaths?, excludeTreePaths? };null=全部
 * @param {string|null} parentTag - 父节点 tag,用于 parentMustBe 依赖过滤 + 置顶从属推荐
 * @returns {Array} - 嵌套的节点数组
 */
export const graphNodesForSearchData = (scope = null, parentTag = null) => {
  const all = getAllNodes();

  // 按场景 scope(category 主轴 + treePath 细分)与 parentMustBe 依赖双重过滤;scope=null 兜底全部
  const data = Object.fromEntries(
    Object.entries(all).filter(
      ([, node]) => matchNodeScope(node, scope) && matchParent(node, parentTag),
    ),
  );

  const categoryTree = objectToNestedArray(data);

  // 父级下:置顶"从属子组件"推荐树(allowChildren ∪ parentMustBe 反推),其后接分类树兜底全量搜索
  if (parentTag) {
    const recommended = buildRecommendedSubtree(parentTag, all);
    if (recommended.length > 0) {
      return [
        {
          name: `${parentTag} 子组件`,
          id: `__rec_${parentTag}`,
          selectable: false,
          __recommended: true,
          icon: "account_tree",
          children: recommended,
        },
        ...categoryTree,
      ];
    }
  }

  return categoryTree;
};
