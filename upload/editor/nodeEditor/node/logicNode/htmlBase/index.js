import { uiNodeMeta, createDynamicClass } from "../../nodeMetea.js";
import { LayoutNodeMeta } from "../../webNode/layout/LayoutNodeMeta.js";

const htmlElements = [
  {
    id: "b8f3c9d1-5a2e-4f6b-9c7d-1e8a3f5b2c4d",
    tag: '"div"',
    name: "Div",
    treePath: "ui/HTML",
    importStr: undefined,
    parentMustBe: [],
    meta: {
      isLayoutContainer: true,
      layoutType: "flex",
    },
    defaultStyleClass: { flexDirection: "row" },
    slots: {
      default: { scope: {} },
    },
    events: {
      click: { params: { event: "MouseEvent" }, description: "点击事件" },
      dblclick: { params: { event: "MouseEvent" }, description: "双击事件" },
      mouseenter: { params: { event: "MouseEvent" }, description: "鼠标进入" },
      mouseleave: { params: { event: "MouseEvent" }, description: "鼠标离开" },
    },
    props: {
      id: {
        type: "String",
        outType: "inputItem",
        description: "元素 ID",
        category: "基础",
      },
    },
    methods: {},
    computedProps: {},
  },
  {
    id: "c9e4d2f1-6b3a-5c7e-8d9f-2a1b4c5e6f70",
    tag: '"div"',
    name: "HtmlRender",
    treePath: "ui/HTML",
    importStr: undefined,
    parentMustBe: [],
    slots: {},
    events: {
      click: { params: { event: "MouseEvent" }, description: "点击事件" },
      dblclick: { params: { event: "MouseEvent" }, description: "双击事件" },
      mouseenter: { params: { event: "MouseEvent" }, description: "鼠标进入" },
      mouseleave: { params: { event: "MouseEvent" }, description: "鼠标离开" },
    },
    props: {
      id: {
        type: "String",
        outType: "inputItem",
        description: "元素 ID",
        category: "基础",
      },
      innerHTML: {
        type: "String",
        outType: "htmlEditorItem",
        description: "HTML 内容",
        category: "内容",
        literalString: true,
      },
    },
    methods: {},
    computedProps: {},
  },
  {
    id: "e1f2a3b4-5c6d-4e8f-9012-3a4b5c6d7e8f",
    tag: '"div"',
    name: "Layout",
    treePath: "ui/HTML",
    importStr: undefined,
    parentMustBe: [],
    meta: {
      isLayoutContainer: true,
      isLayoutNode: true,
      layoutType: "flex",
    },
    defaultStyleClass: {},
    slots: {},
    events: {
      click: { params: { event: "MouseEvent" }, description: "点击事件" },
    },
    props: {
      id: {
        type: "String",
        outType: "inputItem",
        description: "元素 ID",
        category: "基础",
      },
      minSize: {
        type: "Array",
        outType: "inputItem",
        description: "叶子最小尺寸 [w,h]px",
        category: "布局",
        default: [40, 40],
      },
    },
    methods: {},
    computedProps: {},
  },
];

export const nodeList = {};
htmlElements.forEach((config) => {
  const BaseClass = config.meta?.isLayoutNode ? LayoutNodeMeta : uiNodeMeta;
  nodeList[config.name] = createDynamicClass(config, BaseClass);
});
