import { ref, h, reactive, watch } from "vue";

import * as _quasar from "quasar";

const _src = [
  // "QAjaxBar",
  "QAvatar",
  "QBadge",
  "QBanner",
  "QBar",
  "QBreadcrumbs",
  "QBtn",
  "QBtnDropdown",
  "QBtnGroup",
  "QBtnToggle",
  "QCard",
  "QCarousel",
  "QChat",
  "QCheckbox",
  "QChip",
  "QCircularProgress",
  "QColor",
  "QDate",
  "QDialog",
  "QDrawer",
  "QEditor",
  "QExpansionItem",
  "QFab",
  "QField",
  "QFile",
  "QFooter",
  "QForm",
  "QHeader",
  "QIcon",
  "QImg",
  "QInfiniteScroll",
  "QInnerLoading",
  "QInput",
  "QIntersection",
  "QItem",
  "QKnob",
  "QLayout",
  "QMarkupTable",
  "QMenu",
  "QNoSsr",
  "QOptionGroup",
  "QPage",
  "QPageScroller",
  "QPageSticky",
  "QPagination",
  "QParallax",
  "QPopupEdit",
  "QPopupProxy",
  "QLinearProgress",
  "QPullToRefresh",
  "QRadio",
  "QRange",
  "QRating",
  "QResizeObserver",
  "QResponsive",
  "QScrollArea",
  "QScrollObserver",
  "QSelect",
  "QSeparator",
  "QSkeleton",
  "QSlideItem",
  "QSlideTransition",
  "QSlider",
  "QSpace",
  "QSpinner",
  "QSplitter",
  "QStepper",
  "QTabPanels",
  "QTable",
  "QTabs",
  "QTime",
  "QTimeline",
  "QToggle",
  "QToolbar",
  "QTooltip",
  "QTree",
  "QUploader",
  "QVideo",
  "QVirtualScroll",
];

// compDocList 已移至 index.js 进行加载和管理

const rawData = [
  "String",
  "Boolean",
  "String,Number",
  "Boolean,null",
  "String,Object",
  "Boolean,Object",
  "Number,String",
  "Number",
  "String,Array,Object",
  "Array",
  "Any",
  "String,Array,RegExp",
  "Number,Boolean",
  "Any,Array",
  "String,null,undefined",
  "Object",
  "String,Array,Object,null,undefined",
  "Array,Function",
  "String,Function",
  "Boolean,String",
  "Function",
  "File,FileList,Array,null,undefined",
  "Element,String",
  "String,Number,FileList,null,undefined",
  "Element,null",
  "Array,Number",
  "Boolean,String,Element",
  "String,null",
  "Boolean,Object,null",
  "Boolean,Number",
  "Boolean,Array,Object,Function",
  "Object,null,undefined",
  "String,Array",
  "Number,String,null",
  "Function,String",
  "Number,null,undefined",
  "Number,String,null,undefined",
  "Boolean,Function",
];

let rawType = [
  "type",
  "desc",
  "examples",
  "category",
  "tsType",
  "values",
  "default",
  "required",
  "addedIn",
  "syncable",
  "definition",
  "sync",
  "params",
  "returns",
  "transformAssetUrls",
  "link",
  "passthrough",
];

/**
 * 根据Quasar组件属性配置智能选择编辑组件类型
 * @param {Object} propConfig - 属性配置对象
 * @param {string} propName - 属性名称
 * @returns {string} 组件类型名称
 */
export function getComponentType(propConfig, propName = "") {
  if (!propConfig) return "inputItem";

  // 如果配置中已显式指定 outType，直接使用
  if (propConfig.outType) return propConfig.outType;

  const desc = (propConfig.desc || "").toLowerCase();
  const lowerPropName = propName.toLowerCase();
  const propType = propConfig.type;

  // 1. Boolean类型 -> toggleItem
  if (
    propType === "Boolean" ||
    (Array.isArray(propType) && propType.includes("Boolean"))
  ) {
    return "toggleItem";
  }

  // 2. 有预定义值（values数组）-> dropDownSelect
  if (
    propConfig.values &&
    Array.isArray(propConfig.values) &&
    propConfig.values.length > 0
  ) {
    return "dropDownSelect";
  }

  // 3. String类型 + 特殊属性判断 -> 专用组件
  if (propType === "String") {
    // 颜色相关：propName 或 desc 包含 color
    if (lowerPropName.includes("color") || desc.includes("color") || desc.includes("palette")) {
      return "colorItem";
    }

    // 图标相关：propName 或 desc 包含 icon
    if (
      lowerPropName.includes("icon") ||
      lowerPropName === "icon" ||
      desc.includes("icon")
    ) {
      return "iconItem";
    }

    // 尺寸相关：propName 或 desc 包含 size
    if (lowerPropName.includes("size") || desc.includes("size")) {
      return "sizeItem";
    }
  }

  // 4. 多种类型（联合类型）统一使用 inputItem
  // 包括：数组类型 或 字符串包含逗号（如 "String,Number"）
  if (
    Array.isArray(propType) ||
    (typeof propType === "string" && propType.includes(","))
  ) {
    return "inputItem";
  }

  // 5. 其他单一类型（Number、Array、Object等）-> inputItem
  return "inputItem";
}
