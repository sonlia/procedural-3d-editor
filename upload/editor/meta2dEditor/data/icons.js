/**
 * icons.js
 * Meta2D 图元列表数据
 * 完全对标 meta2d_vue 参考项目实现
 */

import axios from "axios";

// ==================== 静态资源配置 ====================
// 已知的图标包列表（位于 public/icon/ 目录下）
const STATIC_ICON_PACKAGES = [
  { name: "通用图标", type: "directory" },
  { name: "国家电网", type: "directory" },
  { name: "电气工程", type: "directory" },
];

// 统一 API 获取目录内容（支持静态备用）
function getUserDirApi(type, staticFallback = []) {
  return async () => {
    try {
      const { data } = await axios.get(`/api/packages?type=${type}`);
      const result = Array.isArray(data) ? data : data?.data || [];
      return result.length > 0 ? result : staticFallback;
    } catch {
      return staticFallback;
    }
  };
}

export const userPensUrl = {
  icon: getUserDirApi("icon", STATIC_ICON_PACKAGES),
  svg: getUserDirApi("svg"),
  png: getUserDirApi("png"),
  path2D: getUserDirApi("path2D"),
  canvasDraw: getUserDirApi("canvasDraw"),
};

// ==================== 默认图元列表 ====================
export const defaultIcons = [
  {
    name: "基本形状",
    show: true,
    list: [
      {
        name: "square",
        icon: "l-rect",
        id: 1,
        data: {
          text: "正方形",
          width: 100,
          height: 100,
          tag: "mind",
          name: "square",
          form: [{ key: "text", type: "text", name: "文本" }],
        },
      },
      {
        name: "rectangle",
        icon: "l-rectangle",
        id: 2,
        data: {
          text: "圆角矩形",
          width: 200,
          height: 50,
          tag: "mind",
          borderRadius: 0.1,
          name: "rectangle",
        },
      },
      {
        name: "circle",
        icon: "l-circle",
        id: 3,
        data: {
          text: "圆",
          width: 100,
          height: 100,
          name: "circle",
        },
      },
      {
        name: "triangle",
        icon: "l-triangle",
        id: 4,
        data: {
          text: "三角形",
          width: 100,
          height: 100,
          name: "triangle",
        },
      },
      {
        name: "diamond",
        icon: "l-diamond",
        id: 5,
        data: {
          text: "菱形",
          width: 100,
          height: 100,
          name: "diamond",
        },
      },
      {
        name: "pentagon",
        icon: "l-pentagon",
        id: 6,
        data: {
          text: "五边形",
          width: 100,
          height: 100,
          name: "pentagon",
        },
      },
      {
        name: "hexagon",
        icon: "l-hexagon",
        id: 7,
        data: {
          text: "六边形",
          width: 100,
          height: 100,
          name: "hexagon",
        },
      },
      {
        name: "pentagram",
        icon: "l-pentagram",
        id: 8,
        data: {
          text: "五角星",
          width: 100,
          height: 100,
          name: "pentagram",
        },
      },
      {
        name: "leftArrow",
        icon: "l-arrow-left",
        id: 9,
        data: {
          text: "左箭头",
          width: 120,
          height: 60,
          name: "leftArrow",
        },
      },
      {
        name: "rightArrow",
        icon: "l-arrow-right",
        id: 10,
        data: {
          text: "右箭头",
          width: 120,
          height: 60,
          name: "rightArrow",
        },
      },
      {
        name: "twowayArrow",
        icon: "l-twoway-arrow",
        id: 11,
        data: {
          text: "双向箭头",
          width: 150,
          height: 60,
          name: "twowayArrow",
        },
      },
      {
        name: "line",
        icon: "l-line",
        id: 12,
        data: {
          anchors: [
            { x: 0, y: 0.5, id: "0" },
            { x: 1, y: 0.5, id: "1" },
          ],
          width: 200,
          height: 5,
          name: "rectangle",
          lineWidth: 0,
          background: "#222222",
        },
      },
      {
        name: "cloud",
        icon: "l-cloud",
        id: 13,
        data: {
          text: "云",
          width: 100,
          height: 100,
          name: "cloud",
        },
      },
      {
        name: "message",
        icon: "l-msg",
        id: 14,
        data: {
          textTop: -0.1,
          text: "消息框",
          width: 100,
          height: 100,
          name: "message",
        },
      },
      {
        name: "file",
        icon: "l-file",
        id: 15,
        data: {
          text: "文档",
          width: 80,
          height: 100,
          name: "file",
        },
      },
      {
        name: "text",
        icon: "l-text",
        id: 16,
        data: {
          text: "meta2d",
          width: 160,
          height: 30,
          name: "text",
        },
      },
      {
        name: "image",
        icon: "l-image",
        id: 17,
        data: {
          text: "",
          width: 100,
          height: 100,
          name: "image",
          image: "https://assets.le5lecdn.com/2d/img/logo.png",
          props: [
            {
              title: "图片地址",
              type: "input",
              prop: "image",
              event: "change",
            },
          ],
        },
      },
      {
        name: "cube",
        icon: "l-cube",
        id: 18,
        data: {
          width: 60,
          height: 100,
          name: "cube",
          z: 0.25,
          form: [
            {
              key: "z",
              name: "z",
              type: "number",
              min: 0,
              step: 0.1,
              placeholder: "<= 1 即宽度的比例",
            },
            { key: "backgroundFront", name: "前背景色", type: "color" },
            { key: "backgroundUp", name: "顶背景色", type: "color" },
            { key: "backgroundRight", name: "右背景色", type: "color" },
          ],
        },
      },
      {
        name: "people",
        icon: "l-people",
        id: 19,
        data: {
          width: 70,
          height: 100,
          name: "people",
        },
      },
      {
        name: "video",
        icon: "l-pc",
        id: 20,
        data: {
          width: 200,
          height: 200,
          externElement: true,
          name: "video",
          video:
            "https://video.699pic.com/videos/17/69/11/a_aa3jeKZ0D63g1556176911_10s.mp4",
        },
      },
      {
        name: "iframe",
        icon: "l-02",
        id: 21,
        data: {
          name: "iframe",
          width: 100,
          height: 100,
          externElement: true,
          iframe: "http://le5le.com",
          props: [
            {
              title: "网页地址",
              type: "input",
              prop: "iframe",
              event: "change",
            },
          ],
        },
      },
    ],
  },
  {
    name: "表单",
    show: true,
    list: [
      {
        name: "表格",
        icon: "l-biaoge",
        data: {
          name: "table2",
          width: 0,
          height: 0,
          form: [
            {
              key: "data",
              name: "表格数据",
              type: "code",
              language: "json",
              isNotString: true,
            },
            {
              key: "styles",
              name: "表格样式",
              type: "code",
              language: "json",
              isNotString: true,
            },
          ],
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
                  activeBackground: "#40a9ff",
                  activeColor: "#40a9ff",
                  background: "#1890ff",
                  color: "#1890ff",
                  hoverBackground: "#40a9ff",
                  hoverColor: "#40a9ff",
                  textColor: "#ffffff",
                  hoverTextColor: "#ffffff",
                  activeTextColor: "#ffffff",
                  events: [
                    {
                      action: 5,
                      name: "click",
                      value: 'alert("点击了编辑")',
                    },
                  ],
                },
                {
                  name: "rectangle",
                  width: 80,
                  height: 20,
                  text: "实时数据",
                  fontSize: 0.6,
                  disableAnchor: true,
                  activeBackground: "#40a9ff",
                  activeColor: "#40a9ff",
                  background: "#1890ff",
                  color: "#1890ff",
                  hoverBackground: "#40a9ff",
                  hoverColor: "#40a9ff",
                  textColor: "#ffffff",
                  hoverTextColor: "#ffffff",
                  activeTextColor: "#ffffff",
                  events: [
                    {
                      action: 5,
                      name: "click",
                      value: 'alert("点击了实时数据")',
                    },
                  ],
                },
              ],
            },
          ],
        },
      },
      {
        name: "复选框",
        icon: "l-xuanzeqi",
        data: {
          name: "checkbox",
          width: 100,
          height: 30,
          fontSize: 16,
          disableAnchor: true,
          direction: "vertical",
          checked: true,
          value: "选项一",
          form: [
            { key: "checked", name: "选中", type: "switch" },
            { key: "isForbidden", name: "是否禁用", type: "switch" },
            { key: "value", name: "选项值", type: "text" },
          ],
        },
      },
      {
        name: "单选框",
        icon: "l-danxuankuang",
        data: {
          name: "radio",
          width: 150,
          height: 30,
          disableAnchor: true,
          direction: "horizontal",
          form: [
            {
              key: "options",
              name: "选项",
              type: "code",
              language: "json",
              isNotString: true,
            },
            {
              key: "direction",
              name: "方向",
              type: "select",
              options: [
                { label: "水平", value: "horizontal" },
                { label: "垂直", value: "vertical" },
              ],
            },
            { key: "checked", name: "选择项", type: "text" },
          ],
          options: [
            { text: "选项一", isForbidden: true },
            { text: "选项二" },
            { text: "选项三" },
          ],
          checked: "选项二",
        },
      },
      {
        name: "开关",
        icon: "l-kaiguan",
        data: {
          name: "switch",
          disableAnchor: true,
          height: 30,
          width: 60,
          checked: true,
          offColor: "#BFBFBF",
          onColor: "#1890ff",
          disableOffColor: "#E5E5E5",
          disableOnColor: "#A3D3FF",
          hoverBackground: "#40a9ff",
          form: [{ key: "checked", name: "开关状态", type: "switch" }],
        },
      },
      {
        name: "进度条",
        icon: "l-jindutiao",
        data: {
          anchors: [],
          disableAnchor: true,
          name: "slider",
          x: 400,
          y: 400,
          width: 300,
          height: 20,
          value: 10,
          textWidth: 50,
          barHeight: 4,
          min: 0,
          max: 100,
          color: "#1890ff",
          background: "#D4D6D9",
          textColor: "#222222",
          unit: "%",
          form: [
            { key: "value", name: "当前进度值", type: "number", min: 0, max: 100 },
            { key: "unit", name: "显示单位", type: "text" },
            { key: "textColor", name: "文字颜色", type: "color" },
          ],
        },
      },
      {
        name: "按钮",
        icon: "l-anniu",
        data: {
          name: "rectangle",
          x: 300,
          y: 200,
          width: 80,
          height: 30,
          disableAnchor: true,
          borderRadius: 2,
          target: "mind",
          text: "按钮",
          activeBackground: "#40a9ff",
          activeColor: "#40a9ff",
          background: "#1890ff",
          color: "#1890ff",
          hoverBackground: "#40a9ff",
          hoverColor: "#40a9ff",
          textColor: "#ffffff",
          hoverTextColor: "#ffffff",
          activeTextColor: "#ffffff",
        },
      },
      {
        name: "输入框",
        icon: "l-shurukuang",
        data: {
          x: 100,
          y: 100,
          height: 40,
          width: 200,
          target: "mind",
          disableAnchor: true,
          name: "rectangle",
          borderRadius: 0.05,
          input: true,
          ellipsis: true,
          text: "输入数据",
          textAlign: "left",
          color: "#D9D9D9FF",
          textColor: "#000000FF",
          hoverTextColor: "#000000FF",
          activeTextColor: "#000000FF",
          textLeft: 10,
        },
      },
      {
        name: "选择器",
        icon: "l-xuanzeqi",
        data: {
          x: 100,
          y: 100,
          height: 40,
          width: 200,
          disableAnchor: true,
          name: "rectangle",
          borderRadius: 0.05,
          ellipsis: true,
          text: "选项1",
          textAlign: "left",
          input: true,
          color: "#D9D9D9FF",
          textColor: "#000000FF",
          hoverTextColor: "#000000FF",
          activeTextColor: "#000000FF",
          textLeft: 10,
          dropdownList: [{ text: "选项1" }, { text: "选项2" }, { text: "选项3" }],
          form: [{ key: "text", name: "选择项", type: "text" }],
        },
      },
    ],
  },
  {
    name: "脑图",
    show: true,
    list: [
      {
        name: "主题",
        icon: "l-zhuti",
        data: {
          text: "主题",
          width: 200,
          height: 50,
          name: "mindNode2",
          lineWidth: 3,
          color: "#ff4000",
          textColor: "#000",
          fontSize: 16,
          borderRadius: 0.5,
        },
      },
      {
        name: "mindLine",
        icon: "l-zizhuti",
        data: {
          text: "子主题",
          width: 160,
          height: 40,
          name: "mindLine2",
        },
      },
    ],
  },
  {
    name: "流程图",
    show: true,
    list: [
      {
        name: "开始/结束",
        icon: "l-flow-start",
        id: 21,
        data: {
          text: "开始/结束",
          width: 120,
          target: "mind",
          height: 40,
          borderRadius: 0.5,
          name: "rectangle",
        },
      },
      {
        name: "流程",
        icon: "l-rectangle",
        id: 22,
        data: {
          text: "流程",
          width: 120,
          height: 40,
          name: "rectangle",
        },
      },
      {
        name: "判定",
        icon: "l-diamond",
        id: 23,
        data: {
          text: "判定",
          width: 120,
          height: 60,
          name: "diamond",
        },
      },
      {
        name: "数据",
        icon: "l-flow-data",
        id: 24,
        data: {
          text: "数据",
          width: 120,
          height: 50,
          name: "flowData",
          offsetX: 0.14,
          form: [
            {
              key: "offsetX",
              name: "斜率",
              type: "number",
              min: 0,
              step: 0.1,
              placeholder: "<= 1 即宽度的比例",
            },
          ],
        },
      },
      {
        name: "准备",
        icon: "l-flow-ready",
        id: 25,
        data: {
          text: "准备",
          width: 120,
          height: 50,
          name: "hexagon",
          target: "mind",
        },
      },
      {
        name: "子流程",
        icon: "l-flow-subprocess",
        id: 26,
        data: {
          text: "子流程",
          width: 120,
          height: 50,
          name: "flowSubprocess",
        },
      },
      {
        name: "数据库",
        icon: "l-db",
        id: 27,
        data: {
          text: "数据库",
          width: 80,
          height: 120,
          name: "flowDb",
        },
      },
      {
        name: "文档",
        icon: "l-flow-document",
        id: 28,
        data: {
          text: "文档",
          width: 120,
          height: 100,
          name: "flowDocument",
        },
      },
      {
        name: "内部存储",
        icon: "l-internal-storage",
        id: 29,
        data: {
          text: "内部存储",
          width: 120,
          height: 80,
          name: "flowInternalStorage",
        },
      },
      {
        name: "外部存储",
        icon: "l-extern-storage",
        id: 30,
        data: {
          text: "外部存储",
          width: 120,
          height: 80,
          name: "flowExternStorage",
        },
      },
      {
        name: "队列",
        icon: "l-flow-queue",
        id: 31,
        data: {
          text: "队列",
          width: 100,
          height: 100,
          name: "flowQueue",
        },
      },
      {
        name: "手动输入",
        icon: "l-flow-manually",
        id: 32,
        data: {
          text: "手动输入",
          width: 120,
          height: 80,
          name: "flowManually",
        },
      },
      {
        name: "展示",
        icon: "l-flow-display",
        id: 33,
        data: {
          text: "展示",
          width: 120,
          height: 80,
          name: "flowDisplay",
        },
      },
      {
        name: "并行模式",
        icon: "l-flow-parallel",
        id: 34,
        data: {
          text: "并行模式",
          width: 120,
          height: 50,
          name: "flowParallel",
        },
      },
      {
        name: "注释",
        icon: "l-flow-comment",
        id: 35,
        data: {
          text: "注释",
          width: 100,
          height: 100,
          name: "flowComment",
        },
      },
    ],
  },
  {
    name: "活动图",
    show: true,
    list: [
      {
        name: "开始",
        icon: "l-inital",
        id: 36,
        data: {
          text: "",
          width: 30,
          height: 30,
          name: "circle",
          background: "#555",
          lineWidth: 0,
        },
      },
      {
        name: "结束",
        icon: "l-final",
        id: 37,
        data: {
          width: 30,
          height: 30,
          name: "activityFinal",
        },
      },
      {
        name: "活动",
        icon: "l-action",
        id: 38,
        data: {
          text: "活动",
          width: 120,
          height: 50,
          borderRadius: 0.25,
          name: "rectangle",
        },
      },
      {
        name: "决策/合并",
        icon: "l-diamond",
        id: 39,
        data: {
          text: "决策/合并",
          width: 120,
          height: 50,
          name: "diamond",
        },
      },
      {
        name: "垂直泳道",
        icon: "l-swimlane-v",
        id: 40,
        data: {
          text: "垂直泳道",
          width: 200,
          height: 500,
          name: "swimlaneV",
          textBaseline: "top",
          textTop: 20,
          lineTop: 0.08,
        },
      },
      {
        name: "水平泳道",
        icon: "l-swimlane-h",
        id: 41,
        data: {
          text: "水平泳道",
          width: 500,
          height: 200,
          name: "swimlaneH",
          textWidth: 0.01,
          textLeft: 0.04,
          textAlign: "left",
          lineLeft: 0.08,
        },
      },
      {
        name: "垂直分岔/汇合",
        icon: "l-fork-v",
        id: 42,
        data: {
          text: "垂直分岔/汇合",
          width: 10,
          height: 150,
          name: "forkV",
          fillStyle: "#555",
          strokeStyle: "transparent",
        },
      },
      {
        name: "水平分岔/汇合",
        icon: "l-fork",
        id: 43,
        data: {
          text: "水平分岔/汇合",
          width: 150,
          height: 10,
          name: "forkH",
          fillStyle: "#555",
          strokeStyle: "transparent",
        },
      },
    ],
  },
  {
    name: "时序图和类图",
    show: true,
    list: [
      {
        name: "生命线",
        icon: "l-lifeline",
        id: 44,
        data: {
          text: "生命线",
          width: 150,
          height: 400,
          textHeight: 50,
          name: "lifeline",
        },
      },
      {
        name: "激活",
        icon: "l-focus",
        id: 45,
        data: {
          text: "激活",
          width: 12,
          height: 200,
          name: "sequenceFocus",
        },
      },
      {
        name: "简单类",
        icon: "l-simple-class",
        id: 46,
        data: {
          text: "Topolgoy",
          width: 270,
          height: 200,
          textHeight: 200,
          name: "simpleClass",
          textAlign: "center",
          textBaseline: "top",
          textTop: 10,
          list: [{ text: "- name: string\n+ setName(name: string): void" }],
        },
      },
      {
        name: "类",
        icon: "l-class",
        id: 47,
        data: {
          text: "Topolgoy",
          width: 270,
          height: 200,
          textHeight: 200,
          name: "interfaceClass",
          textAlign: "center",
          textBaseline: "top",
          textTop: 10,
          list: [
            { text: "- name: string" },
            { text: "+ setName(name: string): void" },
          ],
        },
      },
    ],
  },
  {
    name: "Echarts图表",
    show: true,
    list: [
      {
        name: "折线图",
        icon: "l-line-chart",
        data: {
          name: "echarts",
          width: 400,
          height: 300,
          externElement: true,
          form: [
            {
              key: "dataY",
              name: "数据",
              type: "text",
              readonly: true,
              placeholder: "仅绑定变量",
              multiple: true,
              isTime: false,
              isYCategory: false,
            },
            {
              key: "echarts",
              name: "echarts",
              type: "code",
              language: "json",
              isNotString: true,
            },
            {
              key: "echarts",
              key2: "max",
              type: "number",
              name: "最大数量",
              placeholder: "x",
            },
          ],
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
              series: [
                { data: [820, 932, 901, 934, 1290, 1330, 1320], type: "line" },
              ],
            },
            max: 100,
          },
        },
      },
      {
        name: "柱状图",
        icon: "l-bar-chart",
        data: {
          width: 300,
          height: 200,
          disableAnchor: true,
          externElement: true,
          name: "echarts",
          form: [
            {
              key: "dataY",
              name: "数据",
              type: "text",
              readonly: true,
              placeholder: "仅绑定变量",
              multiple: true,
              isTime: false,
              isYCategory: false,
            },
            {
              key: "echarts",
              name: "echarts",
              type: "code",
              language: "json",
              isNotString: true,
            },
            {
              key: "echarts",
              key2: "max",
              type: "number",
              name: "最大数量",
              placeholder: "x",
            },
          ],
          echarts: {
            option: {
              tooltip: {
                trigger: "axis",
                axisPointer: { type: "shadow" },
              },
              grid: { left: "3%", right: "4%", bottom: "3%", containLabel: true },
              xAxis: {
                type: "category",
                data: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
                axisTick: { alignWithLabel: true },
              },
              yAxis: [{ type: "value" }],
              series: [
                {
                  name: "直接访问",
                  type: "bar",
                  barWidth: "60%",
                  data: [10, 52, 200, 334, 390, 330, 220],
                },
              ],
            },
            max: 100,
          },
        },
      },
      {
        name: "饼图",
        icon: "l-pie-chart",
        data: {
          width: 200,
          height: 200,
          disableAnchor: true,
          externElement: true,
          name: "echarts",
          form: [
            {
              key: "dataY",
              name: "数据",
              type: "text",
              readonly: true,
              placeholder: "仅绑定变量",
              multiple: true,
            },
            {
              key: "echarts",
              name: "echarts",
              type: "code",
              language: "json",
              isNotString: true,
            },
            {
              key: "echarts",
              key2: "max",
              type: "number",
              name: "最大数量",
              placeholder: "x",
            },
          ],
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
                    emphasis: {
                      show: true,
                      textStyle: { fontSize: "30", fontWeight: "bold" },
                    },
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
        name: "仪表盘",
        icon: "l-dashboard-chart",
        data: {
          width: 300,
          height: 300,
          disableAnchor: true,
          externElement: true,
          name: "echarts",
          form: [
            {
              key: "dataY",
              name: "数据",
              type: "text",
              readonly: true,
              placeholder: "仅绑定变量",
              multiple: true,
            },
            {
              key: "echarts",
              name: "echarts",
              type: "code",
              language: "json",
              isNotString: true,
            },
            {
              key: "echarts",
              key2: "max",
              type: "number",
              name: "最大数量",
              placeholder: "x",
            },
          ],
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
    ],
  },
];

// ==================== 动态图元加载 ====================

/**
 * 获取所有动态图元（iconfont、SVG、PNG、Path2D、CanvasDraw）
 */
export async function getOtherIcons() {
  let result = [];
  let datas = await Promise.all([
    getUnicodeIcons(), // 字体图标
    getSvgs(), // SVG
    getPngs(), // PNG
    getPath2Ds(), // Path2D
    getCanvasDraw(), // CanvasDraw
  ]);
  result.push(...datas.flat().filter(Boolean));
  return result;
}

/**
 * 获取字体图标列表
 */
async function getUnicodeIcons() {
  let icons = [];
  const iconsUrl = (await userPensUrl?.icon()) ?? [];
  icons = await Promise.all(iconsUrl.map((url) => addIcons(url.name)));
  return icons.filter(Boolean);
}

/**
 * 加载单个字体图标包
 */
async function addIcons(url) {
  try {
    // 动态加载该字体包的 CSS 文件
    loadIconFontCss(url);

    // 加载 JSON 定义
    let data = await fetch("/icon/" + url + "/iconfont.json").then((rsp) =>
      rsp.json()
    );
    let iconGroup = {
      name: data.name,
      loaded: true,
      show: true,
      list: [],
    };
    data.glyphs.forEach((item) =>
      iconGroup.list.push({
        name: item.name,
        icon: data.font_family + " " + data.css_prefix_text + item.font_class,
        type: "icon", // 标记为字体图标类型
        data: {
          width: 100,
          height: 100,
          name: "icon",
          iconFamily: data.font_family,
          icon: String.fromCharCode(item.unicode_decimal),
          iconFont: true,
        },
      })
    );
    return iconGroup;
  } catch {
    return null;
  }
}

/**
 * 动态加载字体图标 CSS
 * @param {string} url - 图标包名称（目录名）
 */
function loadIconFontCss(url) {
  const cssHref = `/icon/${url}/iconfont.css`;
  // 检查是否已加载
  if (document.querySelector(`link[href="${cssHref}"]`)) {
    return;
  }
  // 创建并插入 link 标签
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = cssHref;
  document.head.appendChild(link);
}

/**
 * 获取 SVG 图元列表
 */
async function getSvgs() {
  const folderName = "svg/";
  let svgs = [];
  const svgUrl = (await userPensUrl?.svg()) ?? [];
  for (let i of svgUrl) {
    if (i.type === "directory") {
      try {
        const { data: files } = await axios.get(folderName + i.name + "/");
        svgs.push({
          name: i.name,
          count: files.length,
          list: [],
          folder: true,
          show: true,
          svg: true,
          loaded: false,
        });
      } catch {
        // ignore
      }
    }
  }
  return svgs;
}

/**
 * 获取 PNG 图元列表
 */
async function getPngs() {
  const folderName = "png/";
  let png = [];
  const pngUrl = (await userPensUrl?.png()) ?? [];
  for (let i of pngUrl) {
    if (i.type === "directory") {
      try {
        const { data: files } = await axios.get(folderName + i.name + "/");
        png.push({
          name: i.name,
          count: files.length,
          list: [],
          folder: true,
          show: true,
          png: true,
          loaded: false,
        });
      } catch {
        // ignore
      }
    }
  }
  return png;
}

/**
 * 获取 Path2D 图元列表
 */
async function getPath2Ds() {
  const folderName = "path2D/";
  let path2d = [];
  const path2DUrl = (await userPensUrl?.path2D()) ?? [];
  for (let i of path2DUrl) {
    if (i.type === "directory") {
      try {
        const { data: files } = await axios.get(folderName + i.name + "/");
        let dataList = [];
        for (let j of files) {
          const name = getFileName(j.name);
          dataList.push({
            name,
            icon: "l-" + name,
            data: {
              width: 100,
              height: 100,
              name,
              text: name,
            },
          });
        }
        path2d.push({
          name: i.name,
          count: files.length,
          list: dataList,
          show: true,
        });
      } catch {
        // ignore
      }
    }
  }
  return path2d;
}

/**
 * 获取 CanvasDraw 图元列表
 */
async function getCanvasDraw() {
  const folderName = "canvasDraw/";
  let canvasDraw = [];
  const canvasUrl = (await userPensUrl?.canvasDraw()) ?? [];
  for (let i of canvasUrl) {
    if (i.type === "directory") {
      try {
        const { data: files } = await axios.get(folderName + i.name + "/");
        let dataList = [];
        for (let j of files) {
          const name = getFileName(j.name);
          dataList.push({
            name,
            icon: "l-" + name,
            data: {
              width: 100,
              height: 100,
              name,
              text: name,
            },
          });
        }
        canvasDraw.push({
          name: i.name,
          count: files.length,
          list: dataList,
          show: true,
        });
      } catch {
        // ignore
      }
    }
  }
  return canvasDraw;
}

// ==================== 工具函数 ====================

/**
 * 获取文件名（不含扩展名）
 */
function getFileName(name) {
  const n = name.lastIndexOf(".");
  if (n !== -1) {
    return name.substring(0, n);
  }
  return name;
}

/**
 * SVG 转换为图元数据
 */
export async function svgToPens(f, dName) {
  const name = getFileName(f.name);
  const image = "/svg/" + dName + "/" + f.name;
  try {
    const { parseSvg } = await import("@meta2d/svg");
    return {
      name,
      image,
      data: parseSvg(await fetch(image).then((res) => res.text())),
      component: true,
    };
  } catch {
    return {
      name,
      image,
      data: {
        name: "image",
        width: 100,
        height: 100,
        image,
      },
    };
  }
}

/**
 * PNG 转换为图元数据
 */
export async function pngToPens(f, dName) {
  const name = getFileName(f.name);
  const image = "/png/" + dName + "/" + f.name;
  return {
    name,
    image,
    data: {
      name: "image",
      width: 100,
      height: 100,
      image,
    },
  };
}
