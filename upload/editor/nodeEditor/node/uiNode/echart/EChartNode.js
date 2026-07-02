import { defineAsyncComponent, markRaw } from "vue";
import { uiNodeMeta } from "../../nodeMetea.js";
import { schemaOf } from "./chartSchema.js";

const ECHART_RAW_DATA = {
  id: "B2F1C9A4-3E77-4D21-9C8E-6A0F12345678", // 稳定 UUID
  treePath: "ui/echart",
  name: "EChart",
  tag: "EChart",
  // 直接依赖第三方 echarts(预览 import map + 项目均可解析);封装组件在 uiSetupCode 内联定义,
  // 不依赖项目本地组件文件(那样预览 import map 解析不到)
  importStr:
    'import * as echarts from "echarts";\nimport { defineComponent, ref, onMounted, onBeforeUnmount, watch } from "vue"',
  parentMustBe: [],
  type: "component",
  props: {},
  events: {},
  slots: {},
  meta: { docsUrl: "https://echarts.apache.org/zh/option.html" },
};

function safeId(id) {
  return String(id).replace(/[^a-zA-Z0-9_$]/g, "_");
}

function createProperties() {
  return {
    // 通用 UI 字段(被 DefaultNodePanel 的 style/wrappers/enhance 复用)
    props: {},
    styleClass: {},
    events: {},
    slots: {},
    methods: {},
    computedProps: {},
    style: "",
    wrappers: {},
    enhance: { permissionConfig: null },
    // ECharts 专属
    echart: {
      mode: "visual", // "visual" | "advanced"
      // 默认给一份演示数据,新增节点即可直接出图;接上游时(isSlot)忽略此值
      rawData: {
        isSlot: false,
        value: '[{ "产品": "A", "销量": 120 }, { "产品": "B", "销量": 200 }, { "产品": "C", "销量": 150 }, { "产品": "D", "销量": 80 }]',
      },
      // 与默认数据同形,供 encode 字段下拉;仅设计期,不进产物
      sampleData: '[{ "产品": "A", "销量": 120 }, { "产品": "B", "销量": 200 }, { "产品": "C", "销量": 150 }, { "产品": "D", "销量": 80 }]',
      chart: {
        type: "line",
        axis: { x: { type: "category" }, y: { type: "value" } },
        // 默认 series 带 encode,配合默认数据直接可见
        series: [{ ...createSeries("line"), encode: { x: "产品", y: "销量" } }],
        options: { title: "", legend: true, tooltip: true, tooltipTrigger: "axis" },
      },
      advancedCode: "(rawData) => ({\n  dataset: { source: rawData },\n  xAxis: { type: 'category' },\n  yAxis: { type: 'value' },\n  series: [{ type: 'line' }]\n})",
      height: "400px",
    },
  };
}

export function createSeries(type = "line") {
  return { type, name: "", encode: {}, smooth: false, stack: false, color: "" };
}

export class EChart extends uiNodeMeta {
  constructor() {
    super();
    this.tag = ECHART_RAW_DATA.tag;
    this.nodeRawData = ECHART_RAW_DATA;
    this.categories = "ui";
    this.importStr = ECHART_RAW_DATA.importStr;
    this.parentMustBe = [];
    this.properties = createProperties();
    // rawData 输入槽不常驻:仅当「接上游」(isSlot)开启时才添加,见 _ensureRawDataSlot
    this.uiPanel = markRaw(defineAsyncComponent(() => import("./EChartPanel.vue")));
  }

  ensureProperties() {
    if (!this.properties) this.properties = createProperties();
    if (!this.properties.echart) this.properties.echart = createProperties().echart;
    const e = this.properties.echart;
    if (!e.chart) e.chart = createProperties().echart.chart;
    if (!Array.isArray(e.chart.series)) e.chart.series = [createSeries(e.chart.type)];
    if (!e.rawData) e.rawData = { isSlot: false, value: "" };
    // 按 isSlot 同步 rawData 输入槽的增删
    this._ensureRawDataSlot();
  }

  // rawData 输入槽:isSlot=true 时存在、=false 时移除
  _ensureRawDataSlot() {
    const useSlot = this.properties?.echart?.rawData?.isSlot === true;
    const idx = this.findInputSlot("rawData");
    if (useSlot && idx === -1) this.addInput("rawData", "string");
    else if (!useSlot && idx !== -1) this.removeInput(idx);
  }

  // rawData 变量名:isSlot → 上游变量名;否则静态值(默认 [])
  rawDataExpr() {
    const rd = this.properties.echart.rawData || {};
    if (rd.isSlot) {
      const idx = this.findInputSlot("rawData");
      if (idx !== -1) {
        const v = this.getInputData(idx);
        if (v !== undefined && v !== null && v !== "") return v;
      }
      return "[]";
    }
    return rd.value && String(rd.value).trim() ? rd.value : "[]";
  }

  // 把单个 series 配置拼成 option 里的 series 项
  _buildSeriesEntry(s) {
    const schema = schemaOf(s.type);
    const parts = [`type: ${JSON.stringify(s.type)}`];
    if (s.name) parts.push(`name: ${JSON.stringify(s.name)}`);

    // encode:只收 schema 声明的通道且用户已选字段
    const encodeParts = [];
    schema.channels.forEach((ch) => {
      const field = s.encode?.[ch.key];
      if (field) encodeParts.push(`${ch.key}: ${JSON.stringify(field)}`);
    });
    if (encodeParts.length) parts.push(`encode: { ${encodeParts.join(", ")} }`);

    // 类型相关开关
    schema.toggles.forEach((t) => {
      if (!s[t.key]) return;
      if (t.as === "stack") parts.push(`stack: "total"`);
      else parts.push(`${t.key}: true`);
    });
    if (s.color) parts.push(`color: ${JSON.stringify(s.color)}`);
    return `{ ${parts.join(", ")} }`;
  }

  buildVisualOption(rawDataVar) {
    const c = this.properties.echart.chart;
    const schema = schemaOf(c.type);
    const parts = [`dataset: { source: ${rawDataVar} }`];

    // 通用选项
    const o = c.options || {};
    if (o.title) parts.push(`title: { text: ${JSON.stringify(o.title)} }`);
    if (o.legend) parts.push(`legend: {}`);
    if (o.tooltip) parts.push(`tooltip: { trigger: ${JSON.stringify(o.tooltipTrigger || "item")} }`);

    // 直角坐标系才出 xAxis/yAxis
    if (schema.cartesian) {
      const ax = c.axis || {};
      parts.push(`xAxis: { type: ${JSON.stringify(ax.x?.type || "category")} }`);
      parts.push(`yAxis: { type: ${JSON.stringify(ax.y?.type || "value")} }`);
    }

    // series
    const series = (c.series || []).map((s) => this._buildSeriesEntry(s));
    parts.push(`series: [${series.join(", ")}]`);

    return `{ ${parts.join(", ")} }`;
  }

  buildOptionExpr() {
    const e = this.properties.echart;
    const rawDataVar = this.rawDataExpr();
    if (e.mode === "advanced") {
      const fn = (e.advancedCode || "(rawData)=>({})").trim();
      return `(${fn})(${rawDataVar})`;
    }
    return this.buildVisualOption(rawDataVar);
  }

  genCode() {
    this.ensureProperties();
    this.setOutputData(this.findOutputSlot("Ref"), this.id);

    const sid = safeId(this.id);
    const implName = `EChartImpl_${sid}`;
    const componentName = `EChart_${sid}`;
    const optionExpr = this.buildOptionExpr();
    const heightStr = JSON.stringify(this.properties.echart.height || "400px");

    // 内联定义 echarts 封装组件(不 import 项目本地文件,使设计器预览也能解析)
    this.uiSetupCode =
      `const ${implName} = defineComponent({ ` +
      `props: { option: { type: Object, default: () => ({}) }, height: { type: String, default: "400px" } }, ` +
      `setup(__p) { ` +
      `const __el = ref(null); let __chart = null, __ro = null; ` +
      `const __render = () => { if (__chart) __chart.setOption(__p.option || {}, true); }; ` +
      `onMounted(() => { __chart = echarts.init(__el.value); __render(); __ro = new ResizeObserver(() => { if (__chart) __chart.resize(); }); __ro.observe(__el.value); }); ` +
      `watch(() => __p.option, __render, { deep: true }); ` +
      `onBeforeUnmount(() => { if (__ro) __ro.disconnect(); if (__chart) __chart.dispose(); }); ` +
      `return () => h("div", { ref: __el, style: { width: "100%", height: __p.height } }); ` +
      `} }); ` +
      `const ${componentName} = (_props = {}) => h(${implName}, { option: ${optionExpr}, height: ${heightStr}, ..._props });`;
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

  static get title() { return "EChart"; }
  static get name() { return "EChart"; }
  static get treePath() { return "ui/echart"; }
  static get id() { return ECHART_RAW_DATA.id; }
}

function rerender(node) {
  node?.onExecute?.();
  node?.graph?.setDirtyCanvas?.(true, true);
}

// 切换 rawData 是否接上游变量(isSlot)
export function setRawDataSlot(node, enabled) {
  const e = node.properties.echart;
  if (!e.rawData) e.rawData = { isSlot: false, value: "" };
  e.rawData.isSlot = enabled;
  // 开启时添加 rawData 输入槽,关闭时移除
  node._ensureRawDataSlot();
  rerender(node);
}

// 增删 series
export function addSeries(node) {
  const c = node.properties.echart.chart;
  c.series.push(createSeries(c.type));
  rerender(node);
}
export function removeSeries(node, index) {
  const c = node.properties.echart.chart;
  c.series.splice(index, 1);
  if (c.series.length === 0) c.series.push(createSeries(c.type));
  rerender(node);
}

// 切换图表类型时,清掉与新 schema 不兼容的 encode 字段
export function setChartType(node, type) {
  const c = node.properties.echart.chart;
  c.type = type;
  c.series.forEach((s) => { s.type = type; s.encode = {}; });
  rerender(node);
}

// 解析 sampleData JSON,返回字段名数组(供 encode 下拉);失败返回 []
export function sampleFields(sampleData) {
  if (!sampleData || !String(sampleData).trim()) return [];
  try {
    const data = JSON.parse(sampleData);
    const first = Array.isArray(data) ? data[0] : data;
    return first && typeof first === "object" ? Object.keys(first) : [];
  } catch {
    return [];
  }
}

// 把当前可视化 option 序列化进 advancedCode,并切到 advanced(单向逃生口)
export function exportToAdvanced(node) {
  const e = node.properties.echart;
  const optionExpr = node.buildVisualOption("rawData");
  e.advancedCode = `(rawData) => (${optionExpr})`;
  e.mode = "advanced";
  rerender(node);
}
