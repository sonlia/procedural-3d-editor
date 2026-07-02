/**
 * useMeta2dEditor.js
 * Meta2D 编辑器核心逻辑
 */
import { ref, shallowRef, computed, watch, nextTick, toRaw } from "vue";
import {
  useProjectStore,
  useProjectMangerStore,
} from "src/stores/projectMange.js";
import { uid } from "quasar";
import meta2dComponent from "src/components/editor/codeStrategies/meta2dComponent/index.js";

// ==================== 响应式状态导出 ====================
/** @type {import('vue').ShallowRef<any>} meta2d 实例 */
export const meta2dInstance = shallowRef(null);

/** @type {import('vue').ShallowRef<any[]>} 当前选中的图元列表 */
export const activePens = shallowRef([]);

/** @type {import('vue').Ref<any | null>} 当前选中的单个图元 */
export const activePen = computed(() => activePens.value?.[0] || null);

/** @type {import('vue').Ref<boolean>} 编辑器是否已初始化 */
export const isInitialized = ref(false);

/** @type {import('vue').Ref<boolean>} 是否正在同步中（防止循环触发） */
export const isSyncing = ref(false);

/** @type {import('vue').Ref<boolean>} meta2d 是否加载失败 */
export const loadError = ref(null);

// ==================== Store ====================
const _project = useProjectStore();
const _projectManger = useProjectMangerStore();

// ==================== 内部变量 ====================
let lastInitKey = null;
let Meta2dClass = null;
let _diagramPensRegistered = false; // 扩展图元(echarts/时序图/类图/流程图/活动图)是否已注册
let _isDirty = false; // 拖动/缩放/旋转脏标记

/**
 * 注册扩展图元绘制函数(全局,只需一次)
 *
 * @meta2d/core 构造时只内置 commonPens(基本形状/脑图/表单/线条),
 * echarts、时序图(lifeline/sequenceFocus)、类图(simpleClass/interfaceClass)、
 * 流程图(flowData/flowDb/...)、活动图(swimlane/fork/activityFinal)
 * 来自独立的 @meta2d/* 扩展包,必须手动注册到 globalStore 才能正确绘制,
 * 否则 meta2d 找不到对应 name 的绘制函数,退化成默认矩形/空白。
 *
 * 绘制函数分两类(由其签名决定注册入口):
 * - Path2D 风格 `(pen, ctx)`:simpleClass/sequenceFocus/flowPens/swimlane/fork → register()
 * - ctx 风格 `(ctx, pen)`:lifeline/activityFinal → registerCanvasDraw()
 * echarts 图元由 chart-diagram 的 register(echarts) 注入实例到 globalThis 并注册。
 */
async function registerDiagramPens() {
  if (_diagramPensRegistered) return;

  const core = await import("@meta2d/core");
  const [chart, sequence, classDiagram, flow, activity, echartsMod] =
    await Promise.all([
      import("@meta2d/chart-diagram"),
      import("@meta2d/sequence-diagram"),
      import("@meta2d/class-diagram"),
      import("@meta2d/flow-diagram"),
      import("@meta2d/activity-diagram"),
      import("echarts"),
    ]);

  // 类图:simpleClass / interfaceClass(Path2D 绘制)
  core.register(classDiagram.classPens());
  // 时序图:sequenceFocus(Path2D) + lifeline(ctx 绘制)
  core.register(sequence.sequencePens());
  core.registerCanvasDraw(sequence.sequencePensbyCtx());
  // 流程图:flowData/flowDb/... (Path2D) + 专属锚点
  core.register(flow.flowPens());
  core.registerAnchors(flow.flowAnchors());
  // 活动图:swimlane/fork(Path2D) + activityFinal(ctx 绘制)
  core.register(activity.activityDiagram());
  core.registerCanvasDraw(activity.activityDiagramByCtx());
  // Echarts 图表:注册 echarts 图元并注入 echarts 实例到 globalThis.echarts
  chart.register(echartsMod);

  _diagramPensRegistered = true;
}

// ==================== 初始化函数 ====================

/**
 * 创建 Meta2D 实例
 * @param {HTMLElement} container - 画布容器元素
 * @returns {Promise<{ meta2d: any }>}
 */
export async function createMeta2dInstance(container) {
  if (!container) {
    console.error("[meta2dEditor] 容器元素不存在");
    return { meta2d: null };
  }

  // 如果已存在实例，先销毁
  if (meta2dInstance.value) {
    destroyMeta2dInstance();
  }

  // 动态导入 meta2d（处理未安装的情况）
  if (!Meta2dClass) {
    try {
      const module = await import("@meta2d/core");
      Meta2dClass = module.Meta2d;
    } catch (error) {
      console.error(
        "[meta2dEditor] @meta2d/core 未安装，请运行: npm install @meta2d/core",
      );
      loadError.value = "请先安装 @meta2d/core: npm install @meta2d/core";
      return { meta2d: null };
    }
  }

  // 注册扩展图元(echarts/时序图/类图),否则这些图元无法正确绘制
  await registerDiagramPens();

  // 创建新实例
  const meta2d = new Meta2dClass(container, {
    // 配置项
    color: "#1890ff",
    activeColor: "#40a9ff",
    hoverColor: "#69c0ff",
    anchorColor: "#1890ff",
    anchorRadius: 4,
    anchorBackground: "#fff",
    dockColor: "#1890ff",
    dragColor: "#1890ff",
    animateColor: "#1890ff",
    textColor: "#ffffff",
    fontFamily:
      '"Hiragino Sans GB", "Microsoft YaHei", "Helvetica Neue", Helvetica, Arial',
    fontSize: 12,
    lineHeight: 1.5,
    textAlign: "center",
    textBaseline: "middle",
    rotateCursor: "rotate.cur",
    hoverCursor: "pointer",
    disableInput: false,
    disableRotate: false,
    disableAnchor: false,
    autoAnchor: true,
    disableEmptyLine: true,
    disableRepeatLine: true,
    disableScale: false,
    disableTranslate: false,
    minScale: 0.1,
    maxScale: 10,
    keydown: true,
    background: "#1e1e1e", // 暗色背景
    grid: true,
    gridColor: "#333333",
    gridSize: 20,
    rule: false,
    autoExpand: true,
    padding: 100, // 边缘留白，触发扩展的阈值
  });

  meta2dInstance.value = meta2d;
  isInitialized.value = true;
  loadError.value = null;

  // 绑定事件
  setupMeta2dEvents(meta2d);
  setupDragEndSave(container);

  console.log("[meta2dEditor] Meta2D 实例创建成功");

  return { meta2d };
}

/**
 * 销毁 Meta2D 实例
 */
export function destroyMeta2dInstance() {
  if (meta2dInstance.value) {
    meta2dInstance.value.destroy();
    meta2dInstance.value = null;
    isInitialized.value = false;
    activePens.value = [];
    console.log("[meta2dEditor] Meta2D 实例已销毁");
  }
}

/**
 * 绑定 Meta2D 事件
 * @param {any} meta2d
 */
function setupMeta2dEvents(meta2d) {
  // 监听图元选中事件
  meta2d.on("active", (pens) => {
    if (isSyncing.value) return;
    activePens.value = pens || [];
  });

  // 监听图元取消选中事件
  meta2d.on("inactive", () => {
    if (isSyncing.value) return;
    activePens.value = [];
  });

  // 属性变化 → 保存
  meta2d.on("valueUpdate", () => debouncedSaveData());

  // 添加/删除 → 保存
  meta2d.on("add", () => debouncedSaveData());
  meta2d.on("delete", () => debouncedSaveData());

  // 拖动/缩放/旋转 → 只标记脏，不保存（由 pointerup 触发保存）
  meta2d.on("translatePens", () => {
    _isDirty = true;
  });
  meta2d.on("resizePens", () => {
    _isDirty = true;
  });
  meta2d.on("rotatePens", () => {
    _isDirty = true;
  });
}

/**
 * 绑定拖动结束保存事件
 * @param {HTMLElement} container - 画布容器元素
 */
function setupDragEndSave(container) {
  container.addEventListener("pointerup", () => {
    if (_isDirty) {
      _isDirty = false;
      debouncedSaveData();
    }
  });
}

// ==================== 数据加载/保存 ====================

/**
 * 加载项目数据到 Meta2D
 */
export function loadMeta2dData() {
  if (!meta2dInstance.value) {
    console.warn("[meta2dEditor] Meta2D 实例不存在，无法加载数据");
    return;
  }

  const meta2dData = _project.getEditorData("meta2dData");
  const hasData = meta2dData && Object.keys(meta2dData).length > 0;
  console.log(
    "[m2d-dbg] loadMeta2dData: hasData=", hasData,
    "pens=", Array.isArray(meta2dData?.pens) ? meta2dData.pens.length : "n/a",
    "select=", _project.getCurrentSelect(),
  );

  // 用于导出的干净副本(open() 会向传入对象注入 Canvas 等不可序列化引用,
  // 故导出代码必须基于独立的纯净数据,否则 generateSFC 内 JSON.stringify 会抛循环引用)
  const exportData = hasData
    ? JSON.parse(JSON.stringify(toRaw(meta2dData)))
    : { pens: [] };

  if (hasData) {
    console.log("[meta2dEditor] 加载 meta2dData:", meta2dData);
    // 再单独深拷贝一份给 open,隔离其对原始数据的修改
    meta2dInstance.value.open(JSON.parse(JSON.stringify(toRaw(meta2dData))));
  } else {
    console.log("[meta2dEditor] 无已保存数据，使用空画布");
    meta2dInstance.value.open({ pens: [] });
  }

  // 回填导出代码：保证产物 .vue 始终是合法 SFC（即便用户尚未编辑），
  // 避免占位空文件触发 vite「At least one <template> or <script>」报错
  syncMeta2dOutputCode(exportData);

  // 先按当前容器尺寸校正画布后再 fitView。
  // 首次加载（如整页重载）容器尺寸可能晚于实例创建就绪，不校正会导致
  // 画布 backing store 尺寸错位、滚轮缩放不跟随图元，须切节点重挂载才恢复。
  nextTick(() => {
    meta2dInstance.value?.resize();
    meta2dInstance.value?.fitView();
  });
}

/**
 * 安全克隆数据，移除无法序列化的对象（如 Canvas、DOM 引用等）
 * @param {any} obj 要克隆的对象
 * @param {WeakSet} seen 已访问的对象集合，用于检测循环引用
 * @returns {any} 克隆后的对象
 */
export function safeClone(obj, seen = new WeakSet()) {
  // 处理基本类型
  if (obj === null || typeof obj !== "object") {
    return obj;
  }

  // 检测循环引用
  if (seen.has(obj)) {
    return undefined;
  }

  // 过滤掉 DOM 节点、Canvas 等不可序列化对象
  if (
    obj instanceof HTMLElement ||
    obj instanceof HTMLCanvasElement ||
    (typeof CanvasRenderingContext2D !== "undefined" && obj instanceof CanvasRenderingContext2D) ||
    (typeof OffscreenCanvas !== "undefined" && obj instanceof OffscreenCanvas) ||
    (obj.constructor && /Canvas|Context|Element|Node/.test(obj.constructor.name))
  ) {
    return undefined;
  }

  seen.add(obj);

  // 处理数组
  if (Array.isArray(obj)) {
    return obj.map((item) => safeClone(item, seen)).filter((item) => item !== undefined);
  }

  // 处理普通对象
  const cloned = {};
  for (const key of Object.keys(obj)) {
    // 跳过以下划线开头的私有属性（通常是内部引用）
    // 但保留 _eventGraphData 等需要持久化的属性
    if (key.startsWith("_") && !["_eventGraphData"].includes(key)) {
      continue;
    }

    const value = obj[key];

    // 跳过函数
    if (typeof value === "function") {
      continue;
    }

    const clonedValue = safeClone(value, seen);
    if (clonedValue !== undefined) {
      cloned[key] = clonedValue;
    }
  }

  return cloned;
}

/**
 * 生成并回填 outputCode(自包含 SFC)到当前节点。
 * 后端 codeExportService 是「哑写入器」——只把 editors[nodeId].outputCode 落盘,
 * 自身不生成 SFC;故 meta2d 必须在前端产出 outputCode,后端按 templateType=meta2d→.vue 写出。
 * 仅在内容变化时写,避免每次打开都触发多余 sync。
 * @param {object} data meta2d 画布数据
 */
function syncMeta2dOutputCode(data) {
  const code = meta2dComponent.generateSFC({ meta2dData: data });
  if (code !== _project.getEditorData("outputCode")) {
    _project.updateEditorData("outputCode", code);
  }
}

/**
 * 保存 Meta2D 数据到项目
 */
export function saveMeta2dData() {
  if (!meta2dInstance.value || !isInitialized.value) return;

  const rawData = meta2dInstance.value.data();
  // 使用安全克隆来移除循环引用和不可序列化的对象
  const data = safeClone(toRaw(rawData));
  _project.updateEditorData("meta2dData", data);
  // 同步导出代码,供后端写入产物 pages/*.vue
  syncMeta2dOutputCode(data);
}

// 防抖保存
let saveTimeout = null;
export function debouncedSaveData() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    saveMeta2dData();
  }, 300);
}

/**
 * 安全初始化项目数据
 */
export function safeInitMeta2d() {
  console.log(
    "[m2d-dbg] safeInitMeta2d 调用: instanceInit=", isInitialized.value,
    "storeInit=", _projectManger.isInitialized,
    "pid=", _projectManger.currentProjectId,
    "scope=", _project.activeEditorScope,
    "select=", _project.getCurrentSelect(),
    "lastKey=", lastInitKey,
  );
  if (!isInitialized.value) {
    console.log("[meta2dEditor] Meta2D 未初始化，跳过加载数据");
    return;
  }

  if (!_projectManger.isInitialized) {
    console.log("[meta2dEditor] 后端数据未加载完成，跳过初始化");
    return;
  }

  const currentSelect = _project.getCurrentSelect();
  const currentKey = `${_projectManger.currentProjectId}-${currentSelect}`;

  if (currentKey === lastInitKey) {
    console.log("[meta2dEditor] 状态未变化，跳过重复初始化");
    return;
  }

  lastInitKey = currentKey;
  console.log("[meta2dEditor] 执行初始化:", currentKey);
  loadMeta2dData();
}

/**
 * 重置初始化标记（用于强制重新加载）
 */
export function resetInitKey() {
  lastInitKey = null;
}

// ==================== 图元操作 ====================

/**
 * 添加图元到画布
 * @param {string} type - 图元类型
 * @param {object} options - 图元属性
 */
export function addPen(type, options = {}) {
  if (!meta2dInstance.value) return null;

  const defaultPen = getDefaultPen(type, options);
  meta2dInstance.value.addPen(defaultPen);
  meta2dInstance.value.render();

  return defaultPen;
}

/**
 * 获取默认图元配置
 * @param {string} type - 图元类型
 * @param {object} options - 自定义属性
 */
function getDefaultPen(type, options = {}) {
  const baseConfig = {
    id: uid(),
    type: 1, // 0 = line, 1 = pen
    name: type,
    x: options.x ?? 100,
    y: options.y ?? 100,
    width: options.width ?? 100,
    height: options.height ?? 100,
    lineWidth: 1,
    color: "#1890ff",
    background: "#ffffff",
    ...options,
  };

  // 根据类型设置特定属性
  switch (type) {
    case "rectangle":
      return {
        ...baseConfig,
        name: "rectangle",
      };
    case "circle":
      return {
        ...baseConfig,
        name: "circle",
        width: options.width ?? 80,
        height: options.height ?? 80,
      };
    case "triangle":
      return {
        ...baseConfig,
        name: "triangle",
      };
    case "diamond":
      return {
        ...baseConfig,
        name: "diamond",
      };
    case "pentagon":
      return {
        ...baseConfig,
        name: "pentagon",
      };
    case "hexagon":
      return {
        ...baseConfig,
        name: "hexagon",
      };
    case "pentagram":
      return {
        ...baseConfig,
        name: "pentagram",
      };
    case "leftArrow":
      return {
        ...baseConfig,
        name: "leftArrow",
      };
    case "rightArrow":
      return {
        ...baseConfig,
        name: "rightArrow",
      };
    case "twowayArrow":
      return {
        ...baseConfig,
        name: "twowayArrow",
      };
    case "text":
      return {
        ...baseConfig,
        name: "text",
        text: "文本",
        fontSize: 14,
        color: "#ffffff",
        background: "transparent",
        width: options.width ?? 80,
        height: options.height ?? 30,
      };
    case "line":
      return {
        ...baseConfig,
        type: 0, // line 类型
        name: "line",
        anchors: [
          { x: 0, y: 0.5 },
          { x: 1, y: 0.5 },
        ],
      };
    case "image":
      return {
        ...baseConfig,
        name: "image",
        image: options.image ?? "",
      };
    default:
      return baseConfig;
  }
}

/**
 * 删除选中的图元
 */
export function deleteActivePens() {
  if (!meta2dInstance.value || activePens.value.length === 0) return;

  meta2dInstance.value.delete(activePens.value);
  activePens.value = [];
}

/**
 * 通过 ID 选中图元
 * @param {string} penId - 图元 ID
 */
export function selectPenById(penId) {
  if (!meta2dInstance.value) return;

  const pen = meta2dInstance.value.findOne(penId);
  if (pen) {
    isSyncing.value = true;
    meta2dInstance.value.active([pen]);
    meta2dInstance.value.render();
    activePens.value = [pen];
    nextTick(() => {
      isSyncing.value = false;
    });
  }
}

/**
 * 居中显示画布
 */
export function fitView() {
  meta2dInstance.value?.fitView();
}

/**
 * 缩放到指定比例
 * @param {number} scale - 缩放比例
 */
export function scaleTo(scale) {
  meta2dInstance.value?.scaleTo(scale);
}

/**
 * 调整画布大小
 */
export function resize() {
  meta2dInstance.value?.resize();
}

// ==================== 工具函数 ====================

/**
 * 获取所有图元
 */
export function getAllPens() {
  return meta2dInstance.value?.data()?.pens || [];
}

/**
 * 通过 ID 获取图元
 * @param {string} id - 图元 ID
 */
export function getPenById(id) {
  return meta2dInstance.value?.findOne(id);
}

/**
 * 更新图元属性
 * @param {string} penId - 图元 ID
 * @param {object} props - 要更新的属性
 */
export function updatePenProps(penId, props) {
  if (!meta2dInstance.value) return;

  const pen = meta2dInstance.value.findOne(penId);
  if (pen) {
    Object.assign(pen, props);
    meta2dInstance.value.render();
    debouncedSaveData();
  }
}
