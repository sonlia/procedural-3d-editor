/**
 * useMeta2dConfig.js
 * Meta2D 编辑器配置数据
 */
import { ref } from "vue";
import { meta2dInstance } from "./useMeta2dEditor.js";

// ==================== 锁定状态 ====================
/** 0=编辑, 1=预览, 2=锁定 */
export const lockStatus = ref(0);

export const lockLabels = { 0: "编辑", 1: "预览", 2: "锁定" };
export const lockIcons = { 0: "edit", 1: "visibility", 2: "lock" };

// ==================== 导航栏菜单配置 ====================
export const fileMenuItems = [
  { label: "打开", icon: "folder_open", action: "open" },
  { label: "导入 JSON", icon: "upload_file", action: "importJson" },
  { separator: true },
  { label: "下载 JSON", icon: "download", action: "downloadJson" },
  { label: "导出 PNG", icon: "image", action: "exportPng" },
  { label: "导出 SVG", icon: "code", action: "exportSvg" },
];

export const arrowTypes = [
  { label: "无", value: "" },
  { label: "实心三角", value: "triangleSolid" },
  { label: "空心三角", value: "triangle" },
  { label: "菱形", value: "diamond" },
  { label: "圆形", value: "circle" },
  { label: "线段", value: "line" },
  { label: "箭头", value: "lineUp" },
  { label: "线段+箭头", value: "lineDown" },
];

export const lineTypes = [
  { label: "曲线", value: "curve" },
  { label: "线段", value: "line" },
  { label: "折线", value: "polyline" },
  { label: "脑图", value: "mind" },
];

// ==================== 线条样式选项 ====================
export const lineJoinOptions = [
  { label: "默认", value: "miter" },
  { label: "圆形", value: "round" },
  { label: "斜角", value: "bevel" },
];

export const lineCapOptions = [
  { label: "默认", value: "butt" },
  { label: "圆形", value: "round" },
  { label: "方形", value: "square" },
];

export const whiteSpaceOptions = [
  { label: "默认", value: "nowrap" },
  { label: "不换行", value: "nowrap" },
  { label: "回车换行", value: "pre-line" },
  { label: "自动换行", value: "break-all" },
];

// ==================== 事件类型 ====================
export const eventTypes = [
  { label: "单击", value: "click" },
  { label: "双击", value: "dblclick" },
  { label: "鼠标进入", value: "enter" },
  { label: "鼠标离开", value: "leave" },
  { label: "选中", value: "active" },
  { label: "取消选中", value: "inactive" },
  { label: "值改变", value: "valueChange" },
];

// ==================== 事件行为 ====================
export const eventBehaviors = [
  { label: "打开链接", value: "link" },
  { label: "改变属性", value: "setValue" },
  { label: "执行动画", value: "startAnimate" },
  { label: "暂停动画", value: "pauseAnimate" },
  { label: "停止动画", value: "stopAnimate" },
  { label: "播放视频", value: "startVideo" },
  { label: "暂停视频", value: "pauseVideo" },
  { label: "停止视频", value: "stopVideo" },
  { label: "执行 JS", value: "javascript" },
  { label: "执行全局 JS", value: "globalFn" },
  { label: "发送消息", value: "emit" },
];

// ==================== 链接打开方式 ====================
export const linkTargetOptions = [
  { label: "新窗口打开", value: "_blank" },
  { label: "当前页面", value: "self" },
];

// ==================== 动画类型 ====================
export const animateTypes = [
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

// ==================== 外观属性默认值 ====================
export const appearanceDefaults = {
  x: 0,
  y: 0,
  width: 100,
  height: 100,
  borderRadius: 0,
  rotate: 0,
  paddingTop: 0,
  paddingBottom: 0,
  paddingLeft: 0,
  paddingRight: 0,
  progress: 0,
  verticalProgress: false,
  flipX: false,
  flipY: false,
  showChild: 0,
  // 样式
  dash: 0,
  lineJoin: "miter",
  lineCap: "square",
  color: "#1890ff",
  hoverColor: "",
  activeColor: "",
  lineWidth: 1,
  background: "#2d2d2d",
  hoverBackground: "",
  activeBackground: "",
  globalAlpha: 1,
  anchorColor: "",
  anchorRadius: 4,
  shadowColor: "",
  shadowBlur: 0,
  shadowOffsetX: 0,
  shadowOffsetY: 0,
  textHasShadow: false,
  // 文字
  fontFamily: "",
  fontSize: 12,
  textColor: "#ffffff",
  hoverTextColor: "",
  activeTextColor: "",
  textBackground: "",
  textAlign: "center",
  textBaseline: "middle",
  lineHeight: 1.5,
  whiteSpace: "pre-line",
  textWidth: 0,
  textLeft: 0,
  textTop: 0,
  ellipsis: false,
  hiddenText: false,
  text: "",
  // 禁止
  disableInput: false,
  disableRotate: false,
  disableSize: false,
  disableAnchor: false,
};

// ==================== 图纸属性默认值 ====================
export const mapDefaults = {
  fileName: "",
  color: "#eeeeee",
  penBackground: "",
  background: "#1e1e1e",
  backGroundImage: "",
  grid: true,
  gridColor: "#333333",
  gridSize: 20,
  gridRotate: 90,
  rule: false,
  ruleColor: "#888888",
};

// ==================== 全局配置默认值 ====================
export const globalDefaults = {
  // 画笔颜色
  color: "#1890ff",
  activeColor: "#40a9ff",
  hoverColor: "#69c0ff",
  hoverBackground: "",
  // 锚点
  anchorColor: "",
  anchorRadius: 4,
  anchorBackground: "",
  // 辅助线
  dockColor: "",
  dragColor: "",
  animateColor: "",
  // 文字
  textColor: "#ffffff",
  fontFamily: '"Microsoft YaHei", "Helvetica Neue", Arial',
  fontSize: 12,
  lineHeight: 1.5,
  textAlign: "center",
  textBaseline: "middle",
  // 鼠标样式
  rotateCursor: "",
  hoverCursor: "pointer",
  // 禁止
  disableInput: false,
  disableRotate: false,
  disableAnchor: false,
  disableEmptyLine: false,
  disableRepeatLine: false,
  disableScale: false,
  disableDockLine: false,
  disableTranslate: false,
  // 画布设置
  minScale: 0.1,
  maxScale: 10,
  // 其他
  autoAnchor: true,
  interval: 30,
  animateInterval: 30,
  textRotate: false,
  textFlip: false,
  // 连线
  fromArrow: "",
  toArrow: "",
  drawingLineName: "curve",
};

// ==================== 分发函数 ====================
export function dispatchFunc(action, value) {
  const m2d = meta2dInstance.value;
  if (!m2d) return;

  switch (action) {
    // 文件操作
    case "open":
      openFile(m2d);
      break;
    case "importJson":
      importJson(m2d);
      break;
    case "downloadJson":
      downloadJson(m2d);
      break;
    case "exportPng":
      m2d.downloadPng();
      break;
    case "exportSvg":
      m2d.downloadSvg();
      break;

    // 绘图工具
    case "drawLine":
      m2d.drawLine(value || "curve");
      m2d.finishPencil?.();
      break;
    case "drawPencil":
      m2d.drawingPencil();
      break;
    case "finishDraw":
      m2d.finishDrawLine?.();
      m2d.finishPencil?.();
      m2d.drawLine();
      break;

    // 保存/恢复：已移除手动保存按钮，改为编辑操作即时自动保存（见 useMeta2dEditor 的事件绑定与各面板）

    // 编辑操作
    case "undo":
      m2d.undo();
      break;
    case "redo":
      m2d.redo();
      break;

    // 视图操作
    case "fitView":
      m2d.fitView();
      break;
    case "scale":
      m2d.scale(value);
      break;
    case "scaleTo":
      m2d.scaleTo(value);
      break;

    // 锁定
    case "lock":
      cycleLock(m2d);
      break;

    // 设置
    case "toggleGrid":
      m2d.store.data.grid = !m2d.store.data.grid;
      m2d.render();
      break;
    case "toggleRule":
      m2d.store.data.rule = !m2d.store.data.rule;
      m2d.render();
      break;
    case "toggleMagnifier":
      if (m2d.canvas.magnifierScreen) {
        m2d.hideMagnifier();
      } else {
        m2d.showMagnifier();
      }
      break;
    case "toggleMiniMap":
      if (m2d.map?.isShow) {
        m2d.hideMap();
      } else {
        m2d.showMap();
      }
      break;

    // 箭头
    case "setFromArrow":
      m2d.store.data.fromArrow = value;
      break;
    case "setToArrow":
      m2d.store.data.toArrow = value;
      break;

    // 连线类型
    case "setLineName":
      m2d.store.options.drawingLineName = value;
      break;
  }
}

// ==================== 内部辅助函数 ====================

function cycleLock(m2d) {
  lockStatus.value = (lockStatus.value + 1) % 3;
  m2d.store.data.locked = lockStatus.value;
  m2d.render();
}

function openFile(m2d) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = JSON.parse(event.target.result);
      m2d.open(data);
    };
    reader.readAsText(file);
  };
  input.click();
}

function importJson(m2d) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const data = JSON.parse(event.target.result);
      if (data.pens) {
        data.pens.forEach((pen) => m2d.addPen(pen));
        m2d.render();
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

function downloadJson(m2d) {
  const data = m2d.data();
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "meta2d.json";
  a.click();
  URL.revokeObjectURL(url);
}
