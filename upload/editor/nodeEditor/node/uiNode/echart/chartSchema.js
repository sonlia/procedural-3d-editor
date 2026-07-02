// 图表类型 → encode 通道 + 坐标轴。数据驱动:新增类型只加一项。
export const CHART_SCHEMA = {
  line: {
    label: "折线",
    cartesian: true,
    channels: [
      { key: "x", label: "X(类目)" },
      { key: "y", label: "Y(值)" },
    ],
    toggles: [{ key: "smooth", label: "平滑" }],
  },
  bar: {
    label: "柱状",
    cartesian: true,
    channels: [
      { key: "x", label: "X(类目)" },
      { key: "y", label: "Y(值)" },
    ],
    toggles: [{ key: "stack", label: "堆叠", as: "stack" }],
  },
  scatter: {
    label: "散点",
    cartesian: true,
    channels: [
      { key: "x", label: "X(值)" },
      { key: "y", label: "Y(值)" },
    ],
    toggles: [],
  },
  effectScatter: {
    label: "涟漪散点",
    cartesian: true,
    channels: [
      { key: "x", label: "X(值)" },
      { key: "y", label: "Y(值)" },
    ],
    toggles: [],
  },
  pie: {
    label: "饼图",
    cartesian: false,
    channels: [
      { key: "itemName", label: "类目字段" },
      { key: "value", label: "值字段" },
    ],
    toggles: [],
  },
  funnel: {
    label: "漏斗",
    cartesian: false,
    channels: [
      { key: "itemName", label: "类目字段" },
      { key: "value", label: "值字段" },
    ],
    toggles: [],
  },
};

export const CHART_TYPES = Object.keys(CHART_SCHEMA);

export function schemaOf(type) {
  return CHART_SCHEMA[type] || CHART_SCHEMA.line;
}
