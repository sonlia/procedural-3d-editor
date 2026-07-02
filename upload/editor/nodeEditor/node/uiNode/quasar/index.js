/**
 * Quasar UI组件节点注册中心
 * 负责加载所有Quasar组件的JSON配置，并创建对应的节点类
 */
import { getComponentType } from "./_praseNodeProp.js";
import { uiNodeMeta, createDynamicClass } from "../../nodeMetea.js";
import { QBreadcrumbs, BREADCRUMBS_RAW_DATA } from "./QBreadcrumbs.js";
import { QCarousel, CAROUSEL_RAW_DATA } from "./QCarousel.js";

const courseModules = import.meta.glob(["./Q*.json", "!./QLayout.json"], {
  import: "default",
  eager: true,
});

export const compDocList = [];

for (let i in courseModules) {
  let componentConfig = courseModules[i];

  for (let propName in componentConfig.props) {
    let prop = componentConfig.props[propName];
    prop.outType = getComponentType(prop, propName);

    if (prop.data === undefined) {
      prop.data = null;
    }
    if (prop.disable === undefined) {
      prop.disable = null;
    }
  }

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

export const nodeList = {};
compDocList.forEach((componentConfig) => {
  nodeList[componentConfig.name] = createDynamicClass(
    componentConfig,
    uiNodeMeta,
  );
});

compDocList.push(BREADCRUMBS_RAW_DATA);
nodeList.QBreadcrumbs = QBreadcrumbs;

compDocList.push(CAROUSEL_RAW_DATA);
nodeList.QCarousel = QCarousel;

// tag → 注册类型键(treePath/id) 映射
// LiteGraph 注册键是 `treePath/id`(见 useLitegraphEditor.js registerNodeType),
// 但部分场景(如行为附加)只持有裸 tag(QMenu/QDialog…),需借此解析出注册键再去 getNodeConf/addToComponentSlot
export const uiTypeByTag = {};
compDocList.forEach((c) => {
  if (c?.tag && c?.treePath && c?.id) uiTypeByTag[c.tag] = `${c.treePath}/${c.id}`;
});
