/**
 * Vue Router UI 组件节点注册中心
 * 负责加载 RouterView、RouterLink 等组件的 JSON 配置
 */
import { uiNodeMeta, createDynamicClass } from "../../nodeMetea.js";

/**
 * 加载 Vue Router 组件的 JSON 配置
 */
const courseModules = import.meta.glob("./*.json", {
  import: "default",
  eager: true,
});

// 处理后的组件文档列表
export const compDocList = [];

// 遍历加载的 JSON 配置，进行属性类型映射和初始化
for (let i in courseModules) {
  let componentConfig = courseModules[i];

  // 为每个属性配置设置编辑器类型和初始值
  for (let propName in componentConfig.props) {
    let prop = componentConfig.props[propName];

    // 简单类型映射
    if (prop.type === "Boolean") {
      prop.outType = "boolean";
    } else if (prop.type === "String") {
      prop.outType = "string";
    } else if (prop.type === "Object" || Array.isArray(prop.type)) {
      prop.outType = "expression";
    } else {
      prop.outType = "string";
    }

    // 初始化运行时数据
    if (prop.data === undefined) {
      prop.data = null;
    }
    if (prop.disable === undefined) {
      prop.disable = null;
    }
  }

  // 初始化样式类配置
  componentConfig.styleClass = {
    options_headings: null,
    assistantTool: null,
    optionWeights: null,
    optionShaddows: null,
    visibility: null,
    position: null,
    flexParent: null,
    flexWrapStyles: null,
    flexContentAlign: null,
    flexItemAlignX: null,
    flexItemAlignY: null,
    flexItemSize: null,
    flexItemAlign: null,
    flexItemOder: null,
    borderStyles: null,
    directionStyles: null,
    sizeStyles: null,
    scrollStyles: null,
    mouseStyles: null,
    textColor: null,
    bgColor: null,
  };
  compDocList.push(componentConfig);
}

/**
 * 节点类映射表
 */
export const nodeList = {};
compDocList.forEach((componentConfig) => {
  nodeList[componentConfig.name] = createDynamicClass(
    componentConfig,
    uiNodeMeta,
  );
});
