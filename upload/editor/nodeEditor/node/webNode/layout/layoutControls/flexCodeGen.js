/**
 * Layout / Flex / Grid VNode 代码生成纯函数
 *
 * 从 nodeMetea.js 的 uiNodeMeta.genCode() 里抽出:
 * - A 段(老 meta.layoutType='grid' 数据迁移)→ migrateLegacyGridLayout
 * - B 段(任意 UI 节点带 gridConfig 时的 grid 容器 CSS + 元数据)→ applyGridContainerStyleToProps
 * - C 段(isLayoutNode 节点的 flex tree / grid cells 嵌套 VNode 渲染)→ generateLayoutNodeVnode
 *
 * 调用契约:
 * - 输入是节点 properties / nodeRawData / propsEntries 等数据
 * - 副作用要么是"就地修改传入的数据"(A/B 段),要么"返回字符串"(C 段)
 * - 不直接访问节点实例,不读 this — 保持纯函数,便于测试
 */

import { sizeToFlex } from "./flexTreeOps.js";

/**
 * leaf.styleClass 里允许的 Quasar class 键名集合
 * 值即 class 名(如 "justify-center"、"col-grow"),非布尔
 */
export const FLEX_LEAF_CLASS_KEYS = [
  // Flex Container 自身配置(对子)
  "flexDirection",
  "flexWrap",
  "justifyContent",
  "alignItems",
  "alignContent",
  "gutter",
  // Flex Item 配置(对父)
  "selfAlign",
  "order",
  // 容器尺寸 Quasar 预设
  "sizeWidth",
  "sizeHeight",
  // 溢出
  "scrollAll",
  "scrollX",
  "scrollY",
  "hideScrollbar",
];

/** 拼 leaf 的 class 字符串 */
export function collectFlexLeafClasses(styleClass) {
  if (!styleClass) return "";
  const out = [];
  for (const k of FLEX_LEAF_CLASS_KEYS) {
    const v = styleClass[k];
    if (v) out.push(v);
  }
  return out.join(" ");
}

/**
 * 把 leaf 顶层的尺寸字段(width / height / min* / max*)转 inline CSS 对象。
 *   - 数字:补 'px'
 *   - 纯数字字符串(如 '200'):补 'px'
 *   - 其他字符串(如 '100%', '40vh'):原样
 *   - undefined / null / '':跳过
 */
export function buildLeafInlineSize(node) {
  const out = {};
  for (const key of ["width", "height", "minWidth", "minHeight", "maxWidth", "maxHeight"]) {
    const v = node[key];
    if (v == null || v === "") continue;
    if (typeof v === "number") {
      out[key] = `${v}px`;
    } else {
      const s = String(v).trim();
      out[key] = /^\d+(\.\d+)?$/.test(s) ? `${s}px` : s;
    }
  }
  return out;
}

/**
 * Grid 容器必需的动态 CSS 对象 — 仅 grid 工作机制相关的字段
 * (display/grid-template-columns/grid-auto-rows/gap),不含 sizeMode 派生的 width/height。
 * 调用方按自己语义追加 sizeMode 处理:
 *   - generateLayoutNodeVnode (Layout 节点):root 尺寸由 compStylePanel 给,仅处理 sizeMode='fixed'
 *   - applyGridContainerStyleToProps (非 Layout 节点):保留原 sizeMode='fill' 写 100% 的行为
 */
export function buildGridContainerCssBase(gridConfig) {
  const gc = gridConfig || {};
  const colNum = gc.colNum ?? 12;
  const rowHeight = gc.rowHeight ?? 30;
  let margin = gc.margin || [10, 10];
  if (typeof margin === "string") {
    try {
      margin = JSON.parse(margin);
    } catch {
      margin = [10, 10];
    }
  }
  return {
    display: "grid",
    gridTemplateColumns: `repeat(${colNum}, 1fr)`,
    gridAutoRows: `${rowHeight}px`,
    gap: `${margin[1] || 10}px ${margin[0] || 10}px`,
  };
}

/**
 * 老 GridLayout 节点数据迁移 — 就地修改 properties。
 * 若 properties.gridConfig 已存在,不动;否则当 nodeRawData.meta.layoutType === 'grid'
 * 时,从 properties.props.colNum/rowHeight/margin 读默认值,写 gridConfig + 空 gridLayout。
 */
export function migrateLegacyGridLayout(properties, nodeRawData) {
  if (!properties) return;
  if (properties.gridConfig) return;
  if (nodeRawData?.meta?.layoutType !== "grid") return;

  const getPropVal = (name, def) => {
    const p = properties.props?.[name];
    const v = p?.value || p?.data;
    return v !== undefined && v !== "" && v !== null ? v : def;
  };
  let margin = [10, 10];
  try {
    margin = JSON.parse(getPropVal("margin", "[10, 10]"));
  } catch {}
  properties.gridConfig = {
    colNum: Number(getPropVal("colNum", 12)) || 12,
    rowHeight: Number(getPropVal("rowHeight", 30)) || 30,
    margin,
  };
  if (!properties.gridLayout) properties.gridLayout = [];
}

/**
 * 任意 UI 节点带 gridConfig 时,生成 grid 容器 CSS + __gridLayout / __gridConfig 元数据。
 * 就地修改 propsEntries 数组(push 条目;若已有 style: 条目则合并)。
 *
 * 该路径服务于:用户在 ContainerSection 面板把任意 UI 节点切到"网格布局"模式时,
 * 节点 properties 出现 gridConfig,本函数负责把它编译为 CSS + assembler 元数据。
 *
 * 注意:Layout 节点(isLayoutNode)在 grid 模式下走 generateLayoutNodeVnode 自己的路径,
 * 不通过本函数生成 style — 但 __gridLayout/__gridConfig 元数据仍由本函数提供(被 layout 路径过滤后保留)。
 */
export function applyGridContainerStyleToProps(propsEntries, copyP) {
  if (!copyP?.gridConfig) return;

  const gridLayoutData = copyP.gridLayout || [];
  const gc = copyP.gridConfig;
  const baseObj = buildGridContainerCssBase(gc);
  let gridStyle = Object.entries(baseObj)
    .map(([k, v]) => `${k.replace(/([A-Z])/g, "-$1").toLowerCase()}: ${v}`)
    .join("; ");
  if (gc.sizeMode === "fill") {
    gridStyle += "; width: 100%; height: 100%";
  } else if (gc.sizeMode === "fixed") {
    if (gc.fixedWidth != null) gridStyle += `; width: ${Number(gc.fixedWidth)}px`;
    if (gc.fixedHeight != null) gridStyle += `; height: ${Number(gc.fixedHeight)}px`;
  }

  let margin = gc.margin || [10, 10];
  if (typeof margin === "string") {
    try {
      margin = JSON.parse(margin);
    } catch {
      margin = [10, 10];
    }
  }

  if (copyP.style && typeof copyP.style === "string" && copyP.style.trim()) {
    const idx = propsEntries.findIndex((e) => e.startsWith("style:"));
    if (idx !== -1) propsEntries.splice(idx, 1);
    propsEntries.push(`style: "${gridStyle}; ${copyP.style}"`);
  } else {
    propsEntries.push(`style: "${gridStyle}"`);
  }

  propsEntries.push(`__gridLayout: ${JSON.stringify(gridLayoutData)}`);
  propsEntries.push(
    `__gridConfig: ${JSON.stringify({
      colNum: gc.colNum ?? 12,
      rowHeight: gc.rowHeight ?? 30,
      margin,
    })}`,
  );
}

function renderGridCells(gridLayout, layoutId) {
  const items = (gridLayout || []).map((cell) => {
    const cellStyle = {
      gridColumn: `${cell.x + 1} / span ${cell.w}`,
      gridRow: `${cell.y + 1} / span ${cell.h}`,
      display: "flex",
    };
    return `createLayoutPart("cell", ${JSON.stringify(layoutId)}, ${JSON.stringify(cell.i)}, ${JSON.stringify(cellStyle)}, __CHILDREN_${layoutId}_${cell.i}__)`;
  });
  return `[${items.join(", ")}]`;
}

function renderFlexChild(node, layoutId) {
  if (node.type === "leaf") {
    const leafStyle = {
      flex: sizeToFlex(node.size),
      display: "flex",
      minWidth: 0,
      minHeight: 0,
      ...buildLeafInlineSize(node),
    };
    const userClasses = collectFlexLeafClasses(node.styleClass);
    const allClasses = userClasses ? `vs-layout-leaf ${userClasses}` : "vs-layout-leaf";
    return `createLayoutPart("leaf", ${JSON.stringify(layoutId)}, ${JSON.stringify(node.id)}, ${JSON.stringify(leafStyle)}, __CHILDREN_${layoutId}_${node.id}__, ${JSON.stringify(allClasses)})`;
  }
  const splitStyle = {
    flex: sizeToFlex(node.size),
    display: "flex",
    flexDirection: node.direction || "row",
  };
  const children = (node.children || []).map((c) => renderFlexChild(c, layoutId)).join(", ");
  return `createLayoutPart("split", ${JSON.stringify(layoutId)}, "", ${JSON.stringify(splitStyle)}, [${children}], "vs-layout-split")`;
}

/**
 * 生成 Layout 节点的代码 — 拆成两段产物,便于阅读与维护:
 *
 *   setupCode(LayoutNodeMeta._buildLayoutVnode 挂到 this.layoutSetupCode,
 *     vueComponent._assemble 推到 logicLines → setup 顶层 const):
 *     const layoutNode_<shortId> = () => h(<tag>, <innerProps>, [<内部 h 嵌套,
 *       leaf/cell 位置塞 __CHILDREN_<id>_<slotName>__ 占位符>]);
 *     其中 innerProps:flex 模式为 null;grid 模式为 { style: <grid 容器必需动态参数> }
 *
 *   vnodeExpr(作为节点 jsCode 主体,进 uiCodeMap 由 assembler 嵌入 vNodeCode):
 *     createNode(layoutNode_<shortId>, "<id>", { __layoutNode: "flex|grid", class, style, ...其他 props }, [])
 *
 * 链路:
 * - assembler 检测 __layoutNode 后,把 __CHILDREN__ 占位符同步替换到 setupCode 与
 *   vnodeExpr;__layoutNode 放在 createNode 的 props 让 createEditorNode 识别并跳过 dropzone 包裹
 * - leaf div 自身的 slot+nodeid 由 renderFlexChild 直接挂,让 iframe 端
 *   findInteractiveElement 把 leaf 识别为可拖入 slot 出口
 * - root 容器的 class/style 由 compStylePanel 写入 properties.styleClass / properties.style,
 *   基类 genCode 拼到 propsEntries(class:/style:),本函数透传到 outerPropsEntries,经
 *   createNode → Vue attribute fallthrough 合并到 root vnode。grid 模式 root vnode 内部
 *   仍带 grid 必需的动态 style 对象,与外层 user style 字符串自动合并(Vue 把对象/字符串两种
 *   style 形态合并成数组)
 *
 * 不处理外层 wrappers(v-if / Transition / KeepAlive / Teleport / vIf),
 * 由调用方(基类 genCode 的 wrappers 段)统一加。
 *
 * @param {object} options
 * @param {object} options.copyP — node.properties
 * @param {string} options.nodeId
 * @param {string} options.tag — 已带引号的 tag 字符串(如 '"div"')
 * @param {string[]} options.propsEntries — 基类收集的 props 条目数组(class / style / 等)
 * @returns {{ setupCode: string, vnodeExpr: string }}
 */
export function generateLayoutNodeVnode({ copyP, nodeId, tag, propsEntries }) {
  const layoutMode = copyP.layoutMode || "flex";

  let innerCode;
  // rootStyleObj 仅 grid 模式需要(grid 容器必需的动态参数);flex 模式 root
  // 样式完全由 compStylePanel 提供的 class/style 经 Vue attribute fallthrough 透传
  let rootStyleObj = null;

  if (layoutMode === "grid") {
    const gc = copyP.gridConfig || { colNum: 12, rowHeight: 30, margin: [10, 10] };
    rootStyleObj = buildGridContainerCssBase(gc);
    if (gc.sizeMode === "fixed") {
      if (gc.fixedWidth != null) rootStyleObj.width = `${Number(gc.fixedWidth)}px`;
      if (gc.fixedHeight != null) rootStyleObj.height = `${Number(gc.fixedHeight)}px`;
    }
    innerCode = renderGridCells(copyP.gridLayout || [], nodeId);
  } else {
    const flexTree = copyP.flexTree || {
      type: "leaf",
      id: "__placeholder__",
      size: { mode: "auto" },
    };
    if (flexTree.type === "split") {
      const children = (flexTree.children || [])
        .map((c) => renderFlexChild(c, nodeId))
        .join(", ");
      innerCode = `[${children}]`;
    } else {
      innerCode = `[${renderFlexChild(flexTree, nodeId)}]`;
    }
  }

  // 保留 propsEntries 全部条目(包括 style:),让 compStylePanel 注入的 class/style
  // 透过 createNode → Vue attribute fallthrough 合并到 root 元素
  const outerPropsEntries = [...(propsEntries || [])];
  outerPropsEntries.push(`__layoutNode: "${layoutMode}"`);
  const outerPropsStr = `{ ${outerPropsEntries.join(", ")} }`;

  const varName = `layoutNode_${nodeId.replace(/-/g, "").slice(0, 8)}`;
  const innerProps = rootStyleObj ? `{ style: ${JSON.stringify(rootStyleObj)} }` : "null";
  const setupCode = `const ${varName} = () => h(${tag}, ${innerProps}, ${innerCode});`;
  const vnodeExpr = `createNode(${varName}, "${nodeId}", ${outerPropsStr}, [])`;

  return { setupCode, vnodeExpr };
}
