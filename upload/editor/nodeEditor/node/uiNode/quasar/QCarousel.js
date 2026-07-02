import { defineAsyncComponent, markRaw } from "vue";
import { uiNodeMeta } from "../../nodeMetea.js";
import { getComponentType } from "./_praseNodeProp.js";

// ============================================================================
// QCarousel 合并节点
//
// 把 Quasar 的 QCarousel / QCarouselSlide / QCarouselControl 合并成一个节点。
// 范式与 QBreadcrumbs 一致:用 h() 在一个 temp 函数组件里自己遍历生成子组件,
// createNode(QCarousel_<id>, id, {}, {})。
//
// 两个"可重复列表",均支持 手动(manual) / 数据接入(data):
//   - slides:default 槽里的 QCarouselSlide;默认留空
//   - control.buttons:control 槽内 QCarouselControl 里的 QBtn;默认 1 个
// data 模式各自把 item/index 暴露为输出槽(loopRole),下游/FunctionBlock 经图引用循环变量。
// 幻灯片内容(default 槽)不在面板配置:S#el:<id>:default 常驻为连接点,
// 用户在画布把含 UI 节点的 FunctionBlock(用 item/index)连上即可。
// ============================================================================

export const CAROUSEL_RAW_DATA = {
  // 复用旧 QCarousel.json 的稳定 id,老项目里的 QCarousel 节点类型不丢
  id: "D4FB8277-78B1-BF43-4359-50C4D1248D55",
  treePath: "ui/quasar",
  name: "QCarousel",
  importStr: "import { QCarousel, QCarouselSlide, QCarouselControl, QBtn } from \"quasar\"",
  tag: "QCarousel",
  parentMustBe: [],
  type: "component",
  meta: {
    docsUrl: "https://v2.quasar.dev/vue-components/carousel",
  },
  props: {
    "model-value": {
      type: "Any",
      desc: "当前显示面板的名称(与某张幻灯片的 name 对应);配合 v-model 使用",
      examples: ['v-model="panelName"'],
      category: "model",
      desc_cn: "当前显示幻灯片的名称(v-model)",
    },
    fullscreen: { type: "Boolean", desc: "Fullscreen mode", category: "behavior", desc_cn: "全屏模式" },
    animated: { type: "Boolean", desc: "Enable transitions between panel", category: "behavior", desc_cn: "启用面板切换过渡动画" },
    infinite: { type: "Boolean", desc: "Makes component appear as infinite", category: "behavior", desc_cn: "无限循环切换" },
    swipeable: { type: "Boolean", desc: "Enable swipe events", category: "behavior", desc_cn: "启用滑动事件" },
    vertical: { type: "Boolean", desc: "Vertical axis transitions/swipe", category: "behavior", desc_cn: "垂直方向切换/滑动" },
    "transition-prev": { type: "String", desc: "Embedded transition (needs 'animated')", examples: ["fade", "slide-down"], category: "transition", desc_cn: "上一页过渡效果" },
    "transition-next": { type: "String", desc: "Embedded transition (needs 'animated')", examples: ["fade", "slide-down"], category: "transition", desc_cn: "下一页过渡效果" },
    "transition-duration": { type: ["String", "Number"], desc: "Transition duration (ms)", default: 300, category: "transition", desc_cn: "过渡时长(毫秒)" },
    dark: { type: ["Boolean", "null"], default: null, desc: "Dark background", category: "style", desc_cn: "深色背景" },
    height: { type: "String", desc: "Height in CSS units", examples: ["16px", "2rem"], category: "style", desc_cn: "轮播高度(CSS 单位)" },
    padding: { type: "Boolean", desc: "Default padding to each slide", category: "content", desc_cn: "幻灯片默认内边距" },
    "control-color": { type: "String", tsType: "NamedColor", desc: "Color for button controls", examples: ["primary", "teal"], category: "style", desc_cn: "控件颜色(箭头/导航)" },
    "control-text-color": { type: "String", tsType: "NamedColor", desc: "Text color for button controls", examples: ["primary", "teal"], category: "style", desc_cn: "控件文本颜色" },
    "control-type": { type: "String", desc: "Type of button for controls", values: ["regular", "flat", "outline", "push", "unelevated"], category: "style", desc_cn: "控件按钮样式类型" },
    autoplay: { type: ["Number", "Boolean"], desc: "Auto jump to next slide (ms)", default: false, examples: [':autoplay="2500"', true, false], category: "behavior", desc_cn: "自动播放(true=5000ms / 数字=间隔 / false=关闭)" },
    arrows: { type: "Boolean", desc: "Show navigation arrow buttons", category: "content", desc_cn: "显示导航箭头" },
    "prev-icon": { type: "String", desc: "Icon for previous button", examples: ["chevron_left"], category: "content", desc_cn: "上一页图标" },
    "next-icon": { type: "String", desc: "Icon for next button", examples: ["chevron_right"], category: "content", desc_cn: "下一页图标" },
    navigation: { type: "Boolean", desc: "Show navigation dots", category: "content", desc_cn: "显示导航点" },
    "navigation-position": { type: "String", desc: "Side to stick navigation to", default: "bottom/right", values: ["top", "right", "bottom", "left"], category: "content", desc_cn: "导航位置" },
    "navigation-icon": { type: "String", desc: "Icon for navigation dots", examples: ["lens"], category: "content", desc_cn: "导航点图标" },
    "navigation-active-icon": { type: "String", desc: "Icon for active navigation dot", examples: ["lens"], category: "content", desc_cn: "当前导航点图标" },
    thumbnails: { type: "Boolean", desc: "Show thumbnails", category: "content", desc_cn: "显示缩略图" },
  },
  slots: {},
  events: {
    "update:model-value": {
      desc: "Emitted when the component changes the model",
      params: { value: { type: ["String", "Number"], desc: "New current panel name", desc_cn: "新的面板名称" } },
      desc_cn: "当前面板变化时触发(v-model)",
    },
    fullscreen: {
      desc: "Emitted when fullscreen state changes",
      params: { value: { type: "Boolean", desc: "Fullscreen state", desc_cn: "全屏状态" } },
      desc_cn: "全屏状态切换时触发",
    },
    "before-transition": {
      desc: "Emitted before transitioning",
      params: { newVal: { type: ["String", "Number"], desc: "to", desc_cn: "目标面板" }, oldVal: { type: ["String", "Number"], desc: "from", desc_cn: "来源面板" } },
      desc_cn: "切换到新面板之前触发",
    },
    transition: {
      desc: "Emitted after transitioned",
      params: { newVal: { type: ["String", "Number"], desc: "to", desc_cn: "目标面板" }, oldVal: { type: ["String", "Number"], desc: "from", desc_cn: "来源面板" } },
      desc_cn: "切换到新面板之后触发",
    },
  },
};

// QCarouselSlide:每张幻灯片(数据,非注册节点)。内容走图连接(S#el:<id>:default 常驻)
export const CAROUSEL_SLIDE_RAW_DATA = {
  tag: "QCarouselSlide",
  props: {
    name: { type: "Any", desc: "Slide name(必填,与 model-value 对应)", required: true, examples: ["slide-1"], category: "model", outType: "inputItem", desc_cn: "幻灯片名称(必填)" },
    "img-src": { type: "String", desc: "Slide background image URL", examples: ["img/bg.png"], category: "model", outType: "inputItem", desc_cn: "幻灯片背景图 URL" },
    disable: { type: "Boolean", desc: "Disabled mode", category: "state", outType: "toggleItem", desc_cn: "禁用" },
  },
};

// QCarouselControl:控制器(数据,非注册节点)。内容是一组 QBtn(见 control.buttons)
export const CAROUSEL_CONTROL_RAW_DATA = {
  tag: "QCarouselControl",
  props: {
    position: { type: "String", desc: "Side/corner to stick to", default: "bottom-right", values: ["top-right", "top-left", "bottom-right", "bottom-left", "top", "right", "bottom", "left"], category: "position", outType: "dropDownSelect", desc_cn: "停靠位置" },
    offset: { type: "Array", desc: "[x, y] 像素偏移", default: "[18, 18]", examples: ["[8, 8]"], category: "position", outType: "inputItem", desc_cn: "水平/垂直偏移(像素)" },
  },
};

// QBtn(控制器内的按钮,常用子集)
export const CONTROL_BTN_RAW_DATA = {
  tag: "QBtn",
  props: {
    label: { type: "String", desc: "Button label", category: "content", outType: "inputItem", desc_cn: "按钮文本" },
    icon: { type: "String", desc: "Icon name", examples: ["chevron_left", "fullscreen"], category: "content", outType: "iconItem", desc_cn: "图标" },
    color: { type: "String", tsType: "NamedColor", desc: "Button color", examples: ["primary", "white"], category: "style", outType: "colorItem", desc_cn: "颜色" },
    round: { type: "Boolean", desc: "Round shape", category: "style", outType: "toggleItem", desc_cn: "圆形" },
    flat: { type: "Boolean", desc: "Flat design", category: "style", outType: "toggleItem", desc_cn: "扁平" },
    dense: { type: "Boolean", desc: "Dense mode", category: "style", outType: "toggleItem", desc_cn: "紧凑" },
    size: { type: "String", desc: "Button size", examples: ["sm", "md"], category: "style", outType: "inputItem", desc_cn: "尺寸" },
  },
  events: {
    click: { params: { evt: { type: "Event", desc: "JS event", desc_cn: "事件对象" } }, desc_cn: "点击" },
  },
};

// 根级 props 补 outType(本节点不走 index.js 的 glob 加载)
Object.keys(CAROUSEL_RAW_DATA.props).forEach((name) => {
  const p = CAROUSEL_RAW_DATA.props[name];
  if (!p.outType) p.outType = getComponentType(p, name);
});

// ============================================================================
// 工具函数
// ============================================================================

function createPropState() {
  return { data: "", disable: false, isSlot: false, value: "" };
}

function safeKey(name) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name) ? name : JSON.stringify(name);
}

function safeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_$]/g, "_");
}

function uniqueId(prefix) {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function propsObject(entries) {
  return entries.length > 0 ? `{ ${entries.join(", ")} }` : "{}";
}

function functionSlotId(node, inputName) {
  const idx = node.findInputSlot(inputName);
  if (idx === -1 || !node.inputs[idx].link || !node.graph) return null;
  const linkInfo = node.graph.links[node.inputs[idx].link];
  if (!linkInfo) return null;
  const sourceNode = node.graph._nodes_by_id[linkInfo.origin_id];
  if (
    sourceNode &&
    (sourceNode.type === "FunctionBlock" ||
      sourceNode.constructor.name === "FunctionBlock")
  ) {
    return sourceNode.id;
  }
  return null;
}

function ensureFunctionInput(node, inputName, args, meta = {}) {
  if (node.findInputSlot(inputName) !== -1) return;
  node.addInput(inputName, "function", { shape: 5, meta: { args }, ...meta });
}

function ensureStringInput(node, inputName, meta = {}) {
  if (node.findInputSlot(inputName) !== -1) return;
  node.addInput(inputName, "string", meta);
}

function removeInputByName(node, inputName) {
  const idx = node.inputs?.findIndex((slot) => slot.name === inputName) ?? -1;
  if (idx !== -1) node.removeInput(idx);
}

// ============================================================================
// 数据工厂
// ============================================================================

function makeItem(rawProps, id, withEvents) {
  const props = {};
  Object.keys(rawProps).forEach((name) => {
    props[name] = createPropState();
  });
  const item = { id, props };
  if (withEvents) item.events = { click: false };
  return item;
}

function createSlideItem(index = 0) {
  const item = makeItem(CAROUSEL_SLIDE_RAW_DATA.props, uniqueId("slide"), false);
  item.props.name.value = JSON.stringify(`slide-${index + 1}`);
  return item;
}

function createBtnItem() {
  return makeItem(CONTROL_BTN_RAW_DATA.props, uniqueId("btn"), true);
}

function createListConfig(rawProps, { templateId, withEvents, items, itemVar, indexVar }) {
  const template = makeItem(rawProps, templateId, withEvents);
  return {
    mode: "manual", // "manual" | "data"
    items: items || [],
    dataSource: { isSlot: false, value: "" },
    itemVar,
    indexVar,
    keyExpression: indexVar,
    sampleData: "", // 设计期 JSON 示例,仅用于字段下拉,不进生成代码
    template,
  };
}

function createSlidesConfig() {
  // 幻灯片默认留空
  return createListConfig(CAROUSEL_SLIDE_RAW_DATA.props, {
    templateId: "slideTpl",
    withEvents: false,
    items: [],
    itemVar: "item",
    indexVar: "index",
  });
}

function createButtonsConfig() {
  // 控制器默认 1 个 QBtn
  return createListConfig(CONTROL_BTN_RAW_DATA.props, {
    templateId: "btnTpl",
    withEvents: true,
    items: [createBtnItem()],
    itemVar: "btnItem",
    indexVar: "btnIndex",
  });
}

function createControl() {
  const props = {};
  Object.keys(CAROUSEL_CONTROL_RAW_DATA.props).forEach((name) => {
    props[name] = createPropState();
  });
  props.position.value = JSON.stringify("bottom-right");
  props.offset.value = "[18, 18]";
  return {
    enabled: true, // 默认带一个 control(内含 1 个 QBtn)
    props,
    buttons: createButtonsConfig(),
  };
}

function createProperties() {
  const props = {};
  Object.keys(CAROUSEL_RAW_DATA.props).forEach((name) => {
    props[name] = { data: "", disable: false, outType: CAROUSEL_RAW_DATA.props[name].outType };
  });

  return {
    props,
    styleClass: {},
    events: {},
    slots: {},
    methods: {},
    computedProps: {},
    style: "",
    wrappers: {},
    enhance: { permissionConfig: null },
    slides: createSlidesConfig(),
    control: createControl(),
  };
}

// 列表规格:把 slides 与 control.buttons 两个可重复列表统一处理
const SLIDE_SPEC = {
  tag: "QCarouselSlide",
  rawProps: CAROUSEL_SLIDE_RAW_DATA.props,
  dataSlotName: "slidesData",
  role: "slide",
  withEvents: false,
  hasContentSlot: true, // 内容走图连接(常驻 S#el:<id>:default)
  nameRequired: true,
};
const BTN_SPEC = {
  tag: "QBtn",
  rawProps: CONTROL_BTN_RAW_DATA.props,
  dataSlotName: "btnData",
  role: "btn",
  withEvents: true,
  hasContentSlot: false,
  nameRequired: false,
};

// ============================================================================
// 节点类
// ============================================================================

export class QCarousel extends uiNodeMeta {
  constructor() {
    super();
    this.tag = CAROUSEL_RAW_DATA.tag;
    this.nodeRawData = CAROUSEL_RAW_DATA;
    this.docs = CAROUSEL_RAW_DATA.meta.docs;
    this.categories = "ui";
    this.importStr = CAROUSEL_RAW_DATA.importStr;
    this.parentMustBe = [];
    this.properties = createProperties();
    this.uiPanel = markRaw(defineAsyncComponent(() => import("./QCarouselPanel.vue")));
  }

  ensureProperties() {
    if (!this.properties) this.properties = createProperties();
    const p = this.properties;

    if (!p.props) p.props = {};
    Object.keys(CAROUSEL_RAW_DATA.props).forEach((name) => {
      if (!p.props[name]) {
        p.props[name] = { data: "", disable: false, outType: CAROUSEL_RAW_DATA.props[name].outType };
      }
    });

    if (!p.slides) p.slides = createSlidesConfig();
    this._ensureListShape(p.slides, SLIDE_SPEC, "slideTpl");

    if (!p.control) p.control = createControl();
    if (!p.control.props) p.control.props = {};
    Object.keys(CAROUSEL_CONTROL_RAW_DATA.props).forEach((name) => {
      if (!p.control.props[name]) p.control.props[name] = createPropState();
    });
    if (!p.control.buttons) p.control.buttons = createButtonsConfig();
    this._ensureListShape(p.control.buttons, BTN_SPEC, "btnTpl");
  }

  _ensureListShape(cfg, spec, templateId) {
    if (cfg.mode !== "data") cfg.mode = "manual";
    if (!Array.isArray(cfg.items)) cfg.items = [];
    if (!cfg.dataSource) cfg.dataSource = { isSlot: false, value: "" };
    if (cfg.itemVar === undefined) cfg.itemVar = spec.role === "btn" ? "btnItem" : "item";
    if (cfg.indexVar === undefined) cfg.indexVar = spec.role === "btn" ? "btnIndex" : "index";
    if (cfg.keyExpression === undefined) cfg.keyExpression = cfg.indexVar;
    if (cfg.sampleData === undefined) cfg.sampleData = "";
    if (!cfg.template) cfg.template = makeItem(spec.rawProps, templateId, spec.withEvents);
    const all = [...cfg.items, cfg.template];
    all.forEach((it) => {
      if (!it.id) it.id = templateId;
      if (!it.props) it.props = {};
      Object.keys(spec.rawProps).forEach((name) => {
        if (!it.props[name]) it.props[name] = createPropState();
      });
      if (spec.withEvents && !it.events) it.events = { click: false };
    });
  }

  // -------- 循环变量输出槽(两个列表各一组,loopRole 前缀区分)--------
  syncLoopOutputs() {
    if (!Array.isArray(this.outputs)) return;
    this._syncListOutputs(this.properties?.slides, "slide");
    this._syncListOutputs(this.properties?.control?.buttons, "btn");
  }

  _syncListOutputs(cfg, rolePrefix) {
    const itemRole = `${rolePrefix}:item`;
    const indexRole = `${rolePrefix}:index`;
    const find = (role) => this.outputs.findIndex((o) => o?.loopRole === role);

    if (cfg?.mode === "data") {
      const iv = cfg.itemVar || "item";
      const xv = cfg.indexVar || "index";
      const ii = find(itemRole);
      if (ii === -1) this.addOutput(iv, "string", { loopRole: itemRole });
      else this.outputs[ii].name = iv;
      const xi = find(indexRole);
      if (xi === -1) this.addOutput(xv, "string", { loopRole: indexRole });
      else this.outputs[xi].name = xv;
    } else {
      for (let i = this.outputs.length - 1; i >= 0; i -= 1) {
        const r = this.outputs[i]?.loopRole;
        if (r === itemRole || r === indexRole) this.removeOutput(i);
      }
    }
  }

  // -------- data 模式 slot 数据源输入槽 --------
  ensureDataSourceSlots() {
    this._ensureDataSlot(this.properties?.slides, SLIDE_SPEC.dataSlotName);
    this._ensureDataSlot(this.properties?.control?.buttons, BTN_SPEC.dataSlotName);
  }

  _ensureDataSlot(cfg, slotName) {
    const useSlot = cfg?.mode === "data" && cfg?.dataSource?.isSlot === true;
    const idx = this.inputs?.findIndex((s) => s.name === slotName) ?? -1;
    if (useSlot && idx === -1) this.addInput(slotName, "string");
    else if (!useSlot && idx !== -1) this.removeInput(idx);
  }

  _dataSourceExpr(cfg, slotName) {
    const ds = cfg?.dataSource || {};
    if (ds.isSlot) {
      const idx = this.findInputSlot(slotName);
      if (idx !== -1) {
        const v = this.getInputData(idx);
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return "[]";
    }
    return ds.value && ds.value.trim() ? ds.value : "[]";
  }

  // -------- 根级 carousel props --------
  buildRootProps() {
    const entries = [];
    const props = this.properties?.props || {};
    Object.keys(CAROUSEL_RAW_DATA.props).forEach((propName) => {
      const pc = props[propName];
      if (!pc || pc.disable) return;
      if (pc.isSlot === true) {
        ensureStringInput(this, propName);
        const v = this.getInputData(this.findInputSlot(propName));
        if (v !== undefined && v !== null && v !== "") entries.push(`${safeKey(propName)}: ${v}`);
        return;
      }
      const v = pc.value !== undefined && pc.value !== "" ? pc.value : pc.data;
      if (v !== undefined && v !== "") entries.push(`${safeKey(propName)}: ${v}`);
    });

    const classSet = new Set();
    Object.values(this.properties?.styleClass || {}).forEach((value) => {
      if (Array.isArray(value)) value.forEach((item) => classSet.add(item));
      else if (value !== null && value !== undefined && value !== "") classSet.add(value);
    });
    const classString = Array.from(classSet).join(" ");
    if (classString.trim()) entries.push(`class: ${JSON.stringify(classString)}`);

    if (typeof this.properties?.style === "string" && this.properties.style.trim()) {
      entries.push(`style: ${JSON.stringify(this.properties.style)}`);
    }
    return propsObject(entries);
  }

  // -------- 通用:单个 item 的 props --------
  _collectItemProps(item, rawProps, entries) {
    Object.keys(rawProps).forEach((propName) => {
      const pc = item.props?.[propName];
      if (!pc || pc.disable) return;
      if (pc.isSlot === true) {
        const inputName = `P#${item.id}#${propName}`;
        ensureStringInput(this, inputName, { itemId: item.id, kind: "prop", propName });
        const v = this.getInputData(this.findInputSlot(inputName));
        if (v !== undefined && v !== null && v !== "") entries.push(`${safeKey(propName)}: ${v}`);
        return;
      }
      const v = pc.value !== undefined && pc.value !== "" ? pc.value : pc.data;
      if (v !== undefined && v !== "") entries.push(`${safeKey(propName)}: ${v}`);
    });
  }

  buildItemProps(item, spec, { withKey, keyExpr } = {}) {
    const entries = [];
    if (withKey) entries.push(`key: ${keyExpr || "index"}`);
    this._collectItemProps(item, spec.rawProps, entries);

    if (spec.nameRequired && !entries.some((e) => e.startsWith("name:"))) {
      entries.push(`name: ${withKey ? keyExpr || "index" : JSON.stringify(item.id)}`);
    }

    if (spec.withEvents && item.events?.click) {
      const inputName = `E#el:${item.id}:click`;
      ensureFunctionInput(this, inputName, ["evt"], { itemId: item.id, kind: "event", eventName: "click" });
      const funcId = functionSlotId(this, inputName);
      if (funcId) entries.push(`onClick: __FUNC_${funcId}__`);
    }
    return propsObject(entries);
  }

  // 幻灯片内容:S#el:<id>:default 常驻为连接点(无面板开关);连了 FunctionBlock 才产内容
  buildItemChildren(item, spec) {
    if (!spec.hasContentSlot) return "null";
    const inputName = `S#el:${item.id}:default`;
    ensureFunctionInput(this, inputName, [], { itemId: item.id, kind: "slot", slotName: "default" });
    const funcId = functionSlotId(this, inputName);
    if (!funcId) return "null";
    return `{ default: __FUNC_${funcId}__ }`;
  }

  // -------- 通用:把一个列表配置渲染成 数组 或 .map 表达式 --------
  buildList(cfg, spec) {
    if (cfg.mode === "data") {
      const itemVar = cfg.itemVar || "item";
      const indexVar = cfg.indexVar || "index";
      const keyExpr = cfg.keyExpression || indexVar;
      const dataExpr = this._dataSourceExpr(cfg, spec.dataSlotName);
      const tpl = cfg.template;
      const itemCode = `h(${spec.tag}, ${this.buildItemProps(tpl, spec, { withKey: true, keyExpr })}, ${this.buildItemChildren(tpl, spec)})`;
      return `(${dataExpr} || []).map((${itemVar}, ${indexVar}) => ${itemCode})`;
    }
    const codes = (cfg.items || []).map(
      (it) => `h(${spec.tag}, ${this.buildItemProps(it, spec)}, ${this.buildItemChildren(it, spec)})`,
    );
    return `[${codes.join(", ")}]`;
  }

  // -------- control --------
  buildControlProps(control) {
    const entries = [];
    const props = control.props || {};
    Object.keys(CAROUSEL_CONTROL_RAW_DATA.props).forEach((propName) => {
      const pc = props[propName];
      if (!pc || pc.disable) return;
      const v = pc.value !== undefined && pc.value !== "" ? pc.value : pc.data;
      if (v !== undefined && v !== "") entries.push(`${safeKey(propName)}: ${v}`);
    });
    return propsObject(entries);
  }

  buildControl() {
    const c = this.properties.control;
    if (!c?.enabled) return null;
    const btns = this.buildList(c.buttons, BTN_SPEC);
    return `h(QCarouselControl, ${this.buildControlProps(c)}, { default: () => ${btns} })`;
  }

  buildComponentSlots() {
    const slidesExpr = this.buildList(this.properties.slides, SLIDE_SPEC);
    const controlCode = this.buildControl();
    const controlPart = controlCode ? `, ${safeKey("control")}: () => [${controlCode}]` : "";
    return `{ default: () => ${slidesExpr}${controlPart} }`;
  }

  _writeLoopOutput(cfg, rolePrefix) {
    if (cfg?.mode !== "data" || !Array.isArray(this.outputs)) return;
    const ii = this.outputs.findIndex((o) => o?.loopRole === `${rolePrefix}:item`);
    const xi = this.outputs.findIndex((o) => o?.loopRole === `${rolePrefix}:index`);
    if (ii !== -1) this.setOutputData(ii, cfg.itemVar || "item");
    if (xi !== -1) this.setOutputData(xi, cfg.indexVar || "index");
  }

  genCode() {
    this.ensureProperties();
    this.syncLoopOutputs();
    this.ensureDataSourceSlots();
    this.setOutputData(this.findOutputSlot("Ref"), this.id);

    // 把循环变量名写到对应输出槽,供下游(含 FunctionBlock passIn)引用
    this._writeLoopOutput(this.properties.slides, "slide");
    this._writeLoopOutput(this.properties.control?.buttons, "btn");

    const componentName = `QCarousel_${safeId(this.id)}`;
    const rootProps = this.buildRootProps();
    const rootPropsWithOuterAttrs =
      rootProps === "{}" ? "{ ..._props }" : `{ ..._props, ...${rootProps} }`;
    const componentSlots = this.buildComponentSlots();

    this.uiSetupCode = `const ${componentName} = (_props = {}, _ctx = {}) => { const slots = _ctx?.slots || {}; return h(QCarousel, ${rootPropsWithOuterAttrs}, ${componentSlots}); }`;
    this.layoutSetupCode = "";
    return `createNode(${componentName}, ${JSON.stringify(this.id)}, {}, {})`;
  }

  onExecute() {
    this.jsCode = this.genCode();
  }

  onConfigure(info) {
    super.onConfigure?.(info);
    this.ensureProperties();
  }

  static get title() {
    return "QCarousel";
  }
  static get name() {
    return "QCarousel";
  }
  static get treePath() {
    return "ui/quasar";
  }
  static get id() {
    return CAROUSEL_RAW_DATA.id;
  }
}

// ============================================================================
// 面板 helper(通用,slides / control.buttons 共用)
// ============================================================================

export function createSlidePanelItem(index = 0) {
  return createSlideItem(index);
}

export function createBtnPanelItem() {
  return createBtnItem();
}

// 删除某 item 相关的所有 input slot(P#/S#el:/E#el: 均带 itemId 元数据)
export function removeItemInputSlots(node, itemId) {
  if (!node?.inputs) return;
  for (let i = node.inputs.length - 1; i >= 0; i -= 1) {
    if (node.inputs[i]?.itemId === itemId) node.removeInput(i);
  }
}

function rerender(node) {
  node?.onExecute?.();
  node?.graph?.setDirtyCanvas?.(true, true);
}

// 切换 item 某 prop 的 isSlot(接入上游变量名)
export function setItemPropSlot(node, item, propName, enabled) {
  if (!item?.props?.[propName]) return;
  item.props[propName].isSlot = enabled;
  const inputName = `P#${item.id}#${propName}`;
  if (enabled) ensureStringInput(node, inputName, { itemId: item.id, kind: "prop", propName });
  else removeInputByName(node, inputName);
  rerender(node);
}

// 切换 item 的 click 事件(FunctionBlock)
export function setItemClickSlot(node, item, enabled) {
  if (!item.events) item.events = {};
  item.events.click = enabled;
  const inputName = `E#el:${item.id}:click`;
  if (enabled) ensureFunctionInput(node, inputName, ["evt"], { itemId: item.id, kind: "event", eventName: "click" });
  else removeInputByName(node, inputName);
  rerender(node);
}

// 切换列表数据源 isSlot(slotName 区分 slides / buttons)
export function setListDataSourceSlot(node, cfg, slotName, isSlot) {
  if (!cfg) return;
  if (!cfg.dataSource) cfg.dataSource = { isSlot: false, value: "" };
  cfg.dataSource.isSlot = isSlot;
  node?.ensureDataSourceSlots?.();
  rerender(node);
}

// itemVar/indexVar 改名或模式切换后,同步 item/index 输出槽
export function syncCarouselLoopOutputs(node) {
  node?.syncLoopOutputs?.();
  rerender(node);
}
