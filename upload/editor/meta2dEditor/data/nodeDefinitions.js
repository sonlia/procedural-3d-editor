/**
 * nodeDefinitions.js
 * Meta2D 统一节点编辑器 - 节点类型配置数据
 *
 * 定义图形节点、事件节点、动效节点所需的配置选项
 */

export { META2D_EVENT_ACTIONS } from "../../nodeEditor/node/meta2dNode/meta2dEventNodes.js";

// ==================== 图形节点下拉选项 ====================
// 从 icons.js 的 defaultIcons 扁平化而来，penData 仅保留 addPen() 核心属性
export const shapeTypes = [
  // ---- 基本形状 ----
  {
    label: "正方形",
    value: "square",
    category: "基本形状",
    penData: { name: "square", text: "正方形", width: 100, height: 100, tag: "mind" },
  },
  {
    label: "圆角矩形",
    value: "rectangle",
    category: "基本形状",
    penData: { name: "rectangle", text: "圆角矩形", width: 200, height: 50, tag: "mind", borderRadius: 0.1 },
  },
  {
    label: "圆",
    value: "circle",
    category: "基本形状",
    penData: { name: "circle", text: "圆", width: 100, height: 100 },
  },
  {
    label: "三角形",
    value: "triangle",
    category: "基本形状",
    penData: { name: "triangle", text: "三角形", width: 100, height: 100 },
  },
  {
    label: "菱形",
    value: "diamond",
    category: "基本形状",
    penData: { name: "diamond", text: "菱形", width: 100, height: 100 },
  },
  {
    label: "五边形",
    value: "pentagon",
    category: "基本形状",
    penData: { name: "pentagon", text: "五边形", width: 100, height: 100 },
  },
  {
    label: "六边形",
    value: "hexagon",
    category: "基本形状",
    penData: { name: "hexagon", text: "六边形", width: 100, height: 100 },
  },
  {
    label: "五角星",
    value: "pentagram",
    category: "基本形状",
    penData: { name: "pentagram", text: "五角星", width: 100, height: 100 },
  },
  {
    label: "左箭头",
    value: "leftArrow",
    category: "基本形状",
    penData: { name: "leftArrow", text: "左箭头", width: 120, height: 60 },
  },
  {
    label: "右箭头",
    value: "rightArrow",
    category: "基本形状",
    penData: { name: "rightArrow", text: "右箭头", width: 120, height: 60 },
  },
  {
    label: "双向箭头",
    value: "twowayArrow",
    category: "基本形状",
    penData: { name: "twowayArrow", text: "双向箭头", width: 150, height: 60 },
  },
  {
    label: "线条",
    value: "line",
    category: "基本形状",
    penData: {
      name: "rectangle",
      width: 200,
      height: 5,
      lineWidth: 0,
      background: "#222222",
      anchors: [
        { x: 0, y: 0.5, id: "0" },
        { x: 1, y: 0.5, id: "1" },
      ],
    },
  },
  {
    label: "云",
    value: "cloud",
    category: "基本形状",
    penData: { name: "cloud", text: "云", width: 100, height: 100 },
  },
  {
    label: "消息框",
    value: "message",
    category: "基本形状",
    penData: { name: "message", text: "消息框", width: 100, height: 100, textTop: -0.1 },
  },
  {
    label: "文档",
    value: "file",
    category: "基本形状",
    penData: { name: "file", text: "文档", width: 80, height: 100 },
  },
  {
    label: "文本",
    value: "text",
    category: "基本形状",
    penData: { name: "text", text: "meta2d", width: 160, height: 30 },
  },
  {
    label: "图片",
    value: "image",
    category: "基本形状",
    penData: { name: "image", text: "", width: 100, height: 100, image: "https://assets.le5lecdn.com/2d/img/logo.png" },
  },
  {
    label: "立方体",
    value: "cube",
    category: "基本形状",
    penData: { name: "cube", width: 60, height: 100, z: 0.25 },
  },
  {
    label: "人物",
    value: "people",
    category: "基本形状",
    penData: { name: "people", width: 70, height: 100 },
  },
  {
    label: "视频",
    value: "video",
    category: "基本形状",
    penData: {
      name: "video",
      width: 200,
      height: 200,
      externElement: true,
      video: "https://video.699pic.com/videos/17/69/11/a_aa3jeKZ0D63g1556176911_10s.mp4",
    },
  },
  {
    label: "网页",
    value: "iframe",
    category: "基本形状",
    penData: { name: "iframe", width: 100, height: 100, externElement: true, iframe: "http://le5le.com" },
  },

  // ---- 表单 ----
  {
    label: "表格",
    value: "table2",
    category: "表单",
    penData: {
      name: "table2",
      width: 0,
      height: 0,
      disableAnchor: true,
      colWidth: 150,
      rowHeight: 40,
      data: [
        ["设备 ID", "设备名称", "数据协议", "状态", "操作"],
        ["1", "200", "MQTT", "正在运行", {}],
        ["2", "湿度传感器", "MQTT", "正在运行", {}],
        ["3", "物联网设备", "MQTT", "正在运行", {}],
        ["4", "物联网设备/智能家居/智慧城市", "MQTT", "正在运行", {}],
      ],
      styles: [
        {
          row: 1,
          col: 1,
          color: "#ff0000",
          background: "#ffff00",
          wheres: [{ comparison: "<=", value: "123" }],
        },
        { row: 0, height: 60 },
        {
          col: 4,
          width: 200,
          pens: [
            {
              name: "rectangle",
              width: 50,
              height: 20,
              text: "编辑",
              fontSize: 0.6,
              disableAnchor: true,
              background: "#1890ff",
              color: "#1890ff",
              textColor: "#ffffff",
              events: [{ action: 5, name: "click", value: 'alert("点击了编辑")' }],
            },
            {
              name: "rectangle",
              width: 80,
              height: 20,
              text: "实时数据",
              fontSize: 0.6,
              disableAnchor: true,
              background: "#1890ff",
              color: "#1890ff",
              textColor: "#ffffff",
              events: [{ action: 5, name: "click", value: 'alert("点击了实时数据")' }],
            },
          ],
        },
      ],
    },
  },
  {
    label: "复选框",
    value: "checkbox",
    category: "表单",
    penData: {
      name: "checkbox",
      width: 100,
      height: 30,
      fontSize: 16,
      disableAnchor: true,
      direction: "vertical",
      checked: true,
      value: "选项一",
    },
  },
  {
    label: "单选框",
    value: "radio",
    category: "表单",
    penData: {
      name: "radio",
      width: 150,
      height: 30,
      disableAnchor: true,
      direction: "horizontal",
      options: [
        { text: "选项一", isForbidden: true },
        { text: "选项二" },
        { text: "选项三" },
      ],
      checked: "选项二",
    },
  },
  {
    label: "开关",
    value: "switch",
    category: "表单",
    penData: {
      name: "switch",
      disableAnchor: true,
      height: 30,
      width: 60,
      checked: true,
      offColor: "#BFBFBF",
      onColor: "#1890ff",
      disableOffColor: "#E5E5E5",
      disableOnColor: "#A3D3FF",
    },
  },
  {
    label: "进度条",
    value: "slider",
    category: "表单",
    penData: {
      name: "slider",
      width: 300,
      height: 20,
      disableAnchor: true,
      value: 10,
      textWidth: 50,
      barHeight: 4,
      min: 0,
      max: 100,
      color: "#1890ff",
      background: "#D4D6D9",
      textColor: "#222222",
      unit: "%",
    },
  },
  {
    label: "按钮",
    value: "button",
    category: "表单",
    penData: {
      name: "rectangle",
      width: 80,
      height: 30,
      disableAnchor: true,
      borderRadius: 2,
      target: "mind",
      text: "按钮",
      background: "#1890ff",
      color: "#1890ff",
      textColor: "#ffffff",
    },
  },
  {
    label: "输入框",
    value: "input",
    category: "表单",
    penData: {
      name: "rectangle",
      height: 40,
      width: 200,
      target: "mind",
      disableAnchor: true,
      borderRadius: 0.05,
      input: true,
      ellipsis: true,
      text: "输入数据",
      textAlign: "left",
      color: "#D9D9D9FF",
      textColor: "#000000FF",
      textLeft: 10,
    },
  },
  {
    label: "选择器",
    value: "selector",
    category: "表单",
    penData: {
      name: "rectangle",
      height: 40,
      width: 200,
      disableAnchor: true,
      borderRadius: 0.05,
      ellipsis: true,
      text: "选项1",
      textAlign: "left",
      input: true,
      color: "#D9D9D9FF",
      textColor: "#000000FF",
      textLeft: 10,
      dropdownList: [{ text: "选项1" }, { text: "选项2" }, { text: "选项3" }],
    },
  },

  // ---- 脑图 ----
  {
    label: "主题",
    value: "mindNode2",
    category: "脑图",
    penData: {
      name: "mindNode2",
      text: "主题",
      width: 200,
      height: 50,
      lineWidth: 3,
      color: "#ff4000",
      textColor: "#000",
      fontSize: 16,
      borderRadius: 0.5,
    },
  },
  {
    label: "子主题",
    value: "mindLine2",
    category: "脑图",
    penData: { name: "mindLine2", text: "子主题", width: 160, height: 40 },
  },

  // ---- 流程图 ----
  {
    label: "开始/结束",
    value: "flowStart",
    category: "流程图",
    penData: { name: "rectangle", text: "开始/结束", width: 120, height: 40, borderRadius: 0.5, target: "mind" },
  },
  {
    label: "流程",
    value: "flowProcess",
    category: "流程图",
    penData: { name: "rectangle", text: "流程", width: 120, height: 40 },
  },
  {
    label: "判定",
    value: "flowDecision",
    category: "流程图",
    penData: { name: "diamond", text: "判定", width: 120, height: 60 },
  },
  {
    label: "数据",
    value: "flowData",
    category: "流程图",
    penData: { name: "flowData", text: "数据", width: 120, height: 50, offsetX: 0.14 },
  },
  {
    label: "准备",
    value: "flowReady",
    category: "流程图",
    penData: { name: "hexagon", text: "准备", width: 120, height: 50, target: "mind" },
  },
  {
    label: "子流程",
    value: "flowSubprocess",
    category: "流程图",
    penData: { name: "flowSubprocess", text: "子流程", width: 120, height: 50 },
  },
  {
    label: "数据库",
    value: "flowDb",
    category: "流程图",
    penData: { name: "flowDb", text: "数据库", width: 80, height: 120 },
  },
  {
    label: "文档",
    value: "flowDocument",
    category: "流程图",
    penData: { name: "flowDocument", text: "文档", width: 120, height: 100 },
  },
  {
    label: "内部存储",
    value: "flowInternalStorage",
    category: "流程图",
    penData: { name: "flowInternalStorage", text: "内部存储", width: 120, height: 80 },
  },
  {
    label: "外部存储",
    value: "flowExternStorage",
    category: "流程图",
    penData: { name: "flowExternStorage", text: "外部存储", width: 120, height: 80 },
  },
  {
    label: "队列",
    value: "flowQueue",
    category: "流程图",
    penData: { name: "flowQueue", text: "队列", width: 100, height: 100 },
  },
  {
    label: "手动输入",
    value: "flowManually",
    category: "流程图",
    penData: { name: "flowManually", text: "手动输入", width: 120, height: 80 },
  },
  {
    label: "展示",
    value: "flowDisplay",
    category: "流程图",
    penData: { name: "flowDisplay", text: "展示", width: 120, height: 80 },
  },
  {
    label: "并行模式",
    value: "flowParallel",
    category: "流程图",
    penData: { name: "flowParallel", text: "并行模式", width: 120, height: 50 },
  },
  {
    label: "注释",
    value: "flowComment",
    category: "流程图",
    penData: { name: "flowComment", text: "注释", width: 100, height: 100 },
  },

  // ---- 活动图 ----
  {
    label: "开始",
    value: "activityStart",
    category: "活动图",
    penData: { name: "circle", text: "", width: 30, height: 30, background: "#555", lineWidth: 0 },
  },
  {
    label: "结束",
    value: "activityFinal",
    category: "活动图",
    penData: { name: "activityFinal", width: 30, height: 30 },
  },
  {
    label: "活动",
    value: "activity",
    category: "活动图",
    penData: { name: "rectangle", text: "活动", width: 120, height: 50, borderRadius: 0.25 },
  },
  {
    label: "决策/合并",
    value: "activityDecision",
    category: "活动图",
    penData: { name: "diamond", text: "决策/合并", width: 120, height: 50 },
  },
  {
    label: "垂直泳道",
    value: "swimlaneV",
    category: "活动图",
    penData: {
      name: "swimlaneV",
      text: "垂直泳道",
      width: 200,
      height: 500,
      textBaseline: "top",
      textTop: 20,
      lineTop: 0.08,
    },
  },
  {
    label: "水平泳道",
    value: "swimlaneH",
    category: "活动图",
    penData: {
      name: "swimlaneH",
      text: "水平泳道",
      width: 500,
      height: 200,
      textWidth: 0.01,
      textLeft: 0.04,
      textAlign: "left",
      lineLeft: 0.08,
    },
  },
  {
    label: "垂直分岔/汇合",
    value: "forkV",
    category: "活动图",
    penData: { name: "forkV", text: "垂直分岔/汇合", width: 10, height: 150, fillStyle: "#555", strokeStyle: "transparent" },
  },
  {
    label: "水平分岔/汇合",
    value: "forkH",
    category: "活动图",
    penData: { name: "forkH", text: "水平分岔/汇合", width: 150, height: 10, fillStyle: "#555", strokeStyle: "transparent" },
  },

  // ---- 时序图和类图 ----
  {
    label: "生命线",
    value: "lifeline",
    category: "时序图和类图",
    penData: { name: "lifeline", text: "生命线", width: 150, height: 400, textHeight: 50 },
  },
  {
    label: "激活",
    value: "sequenceFocus",
    category: "时序图和类图",
    penData: { name: "sequenceFocus", text: "激活", width: 12, height: 200 },
  },
  {
    label: "简单类",
    value: "simpleClass",
    category: "时序图和类图",
    penData: {
      name: "simpleClass",
      text: "Topolgoy",
      width: 270,
      height: 200,
      textHeight: 200,
      textAlign: "center",
      textBaseline: "top",
      textTop: 10,
      list: [{ text: "- name: string\n+ setName(name: string): void" }],
    },
  },
  {
    label: "类",
    value: "interfaceClass",
    category: "时序图和类图",
    penData: {
      name: "interfaceClass",
      text: "Topolgoy",
      width: 270,
      height: 200,
      textHeight: 200,
      textAlign: "center",
      textBaseline: "top",
      textTop: 10,
      list: [
        { text: "- name: string" },
        { text: "+ setName(name: string): void" },
      ],
    },
  },

  // ---- Echarts 图表 ----
  {
    label: "折线图",
    value: "echartsLine",
    category: "Echarts图表",
    penData: {
      name: "echarts",
      width: 400,
      height: 300,
      externElement: true,
      disableAnchor: true,
      echarts: {
        option: {
          grid: { top: 10, bottom: 50, left: 40, right: 5 },
          dataZoom: [{ height: 16, bottom: 10 }],
          xAxis: {
            type: "category",
            data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            axisLabel: { fontSize: 12 },
          },
          yAxis: { type: "value", axisLabel: { fontSize: 12 } },
          series: [{ data: [820, 932, 901, 934, 1290, 1330, 1320], type: "line" }],
        },
        max: 100,
      },
    },
  },
  {
    label: "柱状图",
    value: "echartsBar",
    category: "Echarts图表",
    penData: {
      name: "echarts",
      width: 300,
      height: 200,
      externElement: true,
      disableAnchor: true,
      echarts: {
        option: {
          tooltip: { trigger: "axis", axisPointer: { type: "shadow" } },
          grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
          xAxis: {
            type: "category",
            data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            axisTick: { alignWithLabel: true },
          },
          yAxis: [{ type: "value" }],
          series: [{ name: "直接访问", type: "bar", barWidth: "60%", data: [10, 52, 200, 334, 390, 330, 220] }],
        },
        max: 100,
      },
    },
  },
  {
    label: "饼图",
    value: "echartsPie",
    category: "Echarts图表",
    penData: {
      name: "echarts",
      width: 200,
      height: 200,
      externElement: true,
      disableAnchor: true,
      echarts: {
        option: {
          tooltip: { trigger: "item", formatter: "{a} <br/>{b}: {c} ({d}%)" },
          legend: {},
          series: [
            {
              name: "访问来源",
              type: "pie",
              radius: ["50%", "70%"],
              avoidLabelOverlap: false,
              label: {
                normal: { show: false, position: "center" },
                emphasis: { show: true, textStyle: { fontSize: "30", fontWeight: "bold" } },
              },
              labelLine: { normal: { show: false } },
              data: [
                { value: 335, name: "直接访问" },
                { value: 310, name: "邮件营销" },
                { value: 234, name: "联盟广告" },
                { value: 135, name: "视频广告" },
                { value: 1548, name: "搜索引擎" },
              ],
            },
          ],
        },
      },
    },
  },
  {
    label: "仪表盘",
    value: "echartsGauge",
    category: "Echarts图表",
    penData: {
      name: "echarts",
      width: 300,
      height: 300,
      externElement: true,
      disableAnchor: true,
      echarts: {
        option: {
          tooltip: { formatter: "{a} <br/>{b} : {c}%" },
          series: [
            {
              name: "业务指标",
              type: "gauge",
              detail: { formatter: "{value}%" },
              data: [{ value: 50, name: "完成率" }],
            },
          ],
        },
      },
    },
  },
];

// ==================== 事件触发类型 ====================
export const triggerTypes = [
  { label: "单击", value: "click" },
  { label: "双击", value: "dblclick" },
  { label: "鼠标进入", value: "enter" },
  { label: "鼠标离开", value: "leave" },
  { label: "选中", value: "active" },
  { label: "取消选中", value: "inactive" },
  { label: "值改变", value: "valueChange" },
];

// ==================== 事件行为类型 ====================
export const behaviorTypes = [
  { label: "打开链接", value: "link", paramsSchema: ["url", "target"] },
  { label: "改变属性", value: "setValue", paramsSchema: ["targetId", "propsJson"] },
  { label: "执行动画", value: "startAnimate", paramsSchema: ["animateId"] },
  { label: "暂停动画", value: "pauseAnimate", paramsSchema: ["animateId"] },
  { label: "停止动画", value: "stopAnimate", paramsSchema: ["animateId"] },
  { label: "播放视频", value: "startVideo", paramsSchema: ["videoId"] },
  { label: "暂停视频", value: "pauseVideo", paramsSchema: ["videoId"] },
  { label: "停止视频", value: "stopVideo", paramsSchema: ["videoId"] },
  { label: "执行 JS", value: "javascript", paramsSchema: ["code"] },
  { label: "执行全局 JS", value: "globalFn", paramsSchema: ["fnName"] },
  { label: "发送消息", value: "emit", paramsSchema: ["message", "data"] },
];

// ==================== 动效类型 ====================
export const animateTypeOptions = [
  { label: "跳动", value: "bounce", frames: "bounce" },
  { label: "旋转", value: "rotate", frames: "rotate" },
  { label: "闪烁", value: "flash", frames: "flash" },
  { label: "提示", value: "tip", frames: "tip" },
  { label: "水平移动", value: "moveX", frames: "moveX" },
  { label: "垂直移动", value: "moveY", frames: "moveY" },
  { label: "渐隐", value: "fadeOut", frames: "fadeOut" },
  { label: "渐显", value: "fadeIn", frames: "fadeIn" },
  { label: "自定义", value: "custom", frames: "custom" },
];

// ==================== 预设帧数据 ====================
export const presetFrames = {
  bounce: [{ duration: 300, y: 10 }],
  rotate: [{ duration: 1000, rotate: 360 }],
  flash: [{ duration: 300, globalAlpha: 0 }, { duration: 300, globalAlpha: 1 }],
  tip: [{ duration: 300, scale: 1.3 }],
  moveX: [{ duration: 500, x: 50 }],
  moveY: [{ duration: 500, y: 50 }],
  fadeOut: [{ duration: 500, globalAlpha: 0 }],
  fadeIn: [{ duration: 500, globalAlpha: 1 }],
  custom: [{ duration: 500 }],
};
