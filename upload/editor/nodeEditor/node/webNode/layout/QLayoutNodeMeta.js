import { uiNodeMeta } from "../../nodeMetea.js";

const QUASAR_IMPORT_SOURCE = "quasar";
const createQuasarImport = (names) =>
  `import { ${names} } from ${JSON.stringify(QUASAR_IMPORT_SOURCE)}`;

export const Q_LAYOUT_NODE_RAW_DATA = {
  id: "33571611-99B4-6CD2-8F7C-D4553E6BBC20",
  treePath: "ui/quasar",
  name: "QLayout",
  importStr: createQuasarImport("QLayout"),
  tag: "QLayout",
  parentMustBe: [],
  type: "component",
  meta: {
    docsUrl: "https://v2.quasar.dev/layout/layout",
    editorBehavior: {
      mode: "forceRender",
      fullHeight: true,
    },
    isQLayoutBuilder: true,
  },
  props: {
    view: {
      type: "String",
      outType: "inputItem",
      desc: "Defines how layout components are placed on screen.",
      default: "lHh Lpr lFf",
      category: "content",
    },
  },
  slots: {
    default: {
      desc: "Default QLayout content; use QHeader, QDrawer, QPageContainer, and QFooter children",
    },
  },
  events: {},
};

const DEFAULT_LAYOUT_BUILDER = {
  header: {
    enabled: true,
    slot: true,
    input: "",
    reveal: false,
    separator: "elevated",
  },
  footer: {
    enabled: true,
    slot: true,
    input: "",
    reveal: false,
    separator: "elevated",
  },
  leftDrawer: {
    enabled: true,
    slot: true,
    input: "",
    overlay: false,
    showIfAbove: true,
    behavior: "default",
    separator: "bordered",
  },
  rightDrawer: {
    enabled: true,
    slot: true,
    input: "",
    overlay: false,
    showIfAbove: true,
    behavior: "default",
    separator: "bordered",
  },
  navigationTabs: { enabled: true, slot: true, input: "" },
};

const CONTROL_INPUTS = {
  header: "showHeader",
  footer: "showFooter",
  leftDrawer: "showLeftDrawer",
  rightDrawer: "showRightDrawer",
  navigationTabs: "showNavigationTabs",
};

function cloneDefaultLayoutBuilder() {
  return JSON.parse(JSON.stringify(DEFAULT_LAYOUT_BUILDER));
}

function ensureLayoutBuilderPart(builder, key) {
  const defaults = DEFAULT_LAYOUT_BUILDER[key];
  const current = builder[key] || {};
  builder[key] = current;

  Object.entries(defaults).forEach(([field, defaultValue]) => {
    if (current[field] === undefined) {
      current[field] = defaultValue;
    }
  });
  delete current.visible;
}

function createBaseUiProperties() {
  return {
    props: {},
    styleClass: {},
    events: {},
    slots: {},
    methods: {},
    computedProps: {},
    style: "",
    wrappers: {
      vIf: { enabled: false, condition: { value: "", isSlot: false } },
      vShow: { enabled: false, condition: { value: "", isSlot: false } },
      teleport: { enabled: false, to: '"body"', disabled: false, defer: false },
      keepAlive: { enabled: false, include: "", exclude: "", max: null },
      suspense: {
        enabled: false,
        timeout: undefined,
        suspensible: false,
        slots: { default: "", fallback: "" },
        events: { onResolve: "", onPending: "", onFallback: "" },
      },
      transition: {
        enabled: false,
        name: '"fade"',
        mode: "",
        appear: false,
        css: true,
        type: '"transition"',
        duration: "",
        enterFromClass: "",
        enterActiveClass: "",
        enterToClass: "",
        leaveFromClass: "",
        leaveActiveClass: "",
        leaveToClass: "",
        appearClass: "",
        appearActiveClass: "",
        appearToClass: "",
        events: {
          onBeforeEnter: { value: "", isSlot: false },
          onEnter: { value: "", isSlot: false },
          onAfterEnter: { value: "", isSlot: false },
          onEnterCancelled: { value: "", isSlot: false },
          onBeforeLeave: { value: "", isSlot: false },
          onLeave: { value: "", isSlot: false },
          onAfterLeave: { value: "", isSlot: false },
          onLeaveCancelled: { value: "", isSlot: false },
          onBeforeAppear: { value: "", isSlot: false },
          onAppear: { value: "", isSlot: false },
          onAfterAppear: { value: "", isSlot: false },
          onAppearCancelled: { value: "", isSlot: false },
        },
      },
      transitionGroup: { enabled: false },
      component: { enabled: false, is: "" },
    },
    enhance: {
      permissionConfig: null,
      layoutBuilder: cloneDefaultLayoutBuilder(),
    },
  };
}

export function createQLayoutProperties() {
  const properties = createBaseUiProperties();

  properties.props.view = {
    value: JSON.stringify(Q_LAYOUT_NODE_RAW_DATA.props.view.default),
    data: "",
    disable: false,
    isSlot: false,
    outType: "inputItem",
  };

  Object.keys(Q_LAYOUT_NODE_RAW_DATA.slots).forEach((slotName) => {
    properties.slots[slotName] = false;
  });

  return properties;
}

function normalizeLayoutBuilder(properties) {
  if (!properties.enhance) properties.enhance = {};
  if (properties.props) {
    const allowedProps = new Set(Object.keys(Q_LAYOUT_NODE_RAW_DATA.props));
    Object.keys(properties.props).forEach((propName) => {
      if (!allowedProps.has(propName)) {
        delete properties.props[propName];
      }
    });
  }

  if (!properties.enhance.layoutBuilder) {
    properties.enhance.layoutBuilder = cloneDefaultLayoutBuilder();
  }

  ["header", "footer", "leftDrawer", "rightDrawer", "navigationTabs"].forEach(
    (key) => {
      ensureLayoutBuilderPart(properties.enhance.layoutBuilder, key);
    },
  );

  if (!properties.enhance.layoutBuilder.header.enabled) {
    properties.enhance.layoutBuilder.navigationTabs.enabled = false;
  }

  return properties.enhance.layoutBuilder;
}

function propEntry(name, value) {
  return `${JSON.stringify(name)}: ${value}`;
}

function literalString(value) {
  return JSON.stringify(value);
}

function addSeparatorProps(entries, separator) {
  if (separator === "elevated") entries.push("elevated: true");
  if (separator === "bordered") entries.push("bordered: true");
}

function propsObject(entries) {
  return entries.length ? `{ ${entries.join(", ")} }` : "{}";
}

function createDropTarget(nodeId, slotName, style = {}, childrenCode = null) {
  const className =
    slotName === "page" ? "vs-layout-leaf col" : "vs-layout-leaf";
  const children = childrenCode || `__CHILDREN_${nodeId}_${slotName}__`;
  return `createLayoutPart("leaf", ${literalString(nodeId)}, ${literalString(slotName)}, ${JSON.stringify(style)}, ${children}, ${literalString(className)})`;
}

export class QLayoutNodeMeta extends uiNodeMeta {
  onExecute() {
    super.onExecute();
  }

  onConfigure(info) {
    super.onConfigure?.(info);
  }

  syncLayoutControlInputs() {
    Object.values(CONTROL_INPUTS).forEach((name) => {
      const idx = this.findInputSlot(name);
      if (idx !== -1) {
        this.removeInput(idx);
      }
    });
  }

  syncLayoutSlots() {
    if (!this.properties.slots) this.properties.slots = {};

    const slotStates = {};

    Object.entries(slotStates).forEach(([slotName, enabled]) => {
      this.properties.slots[slotName] = enabled;
      const inputName = `S#${slotName}`;
      const slotIndex = this.findInputSlot(inputName);

      if (enabled && slotIndex === -1) {
        this.addInput(inputName, "function", {
          shape: 5,
          meta: { args: [] },
          slotName,
        });
      } else if (!enabled && slotIndex !== -1) {
        this.removeInput(slotIndex);
      }
    });
  }

  getControlExpr(config) {
    const value = config.slot ? String(config.input || "").trim() : "";
    if (value) return value;
    return "true";
  }

  getSlotFunctionBlockId(slotName) {
    const inputSlotIndex = this.findInputSlot(`S#${slotName}`);
    if (
      inputSlotIndex === -1 ||
      !this.inputs?.[inputSlotIndex]?.link ||
      !this.graph
    )
      return null;

    const linkInfo = this.graph.links[this.inputs[inputSlotIndex].link];
    if (!linkInfo) return null;

    const sourceNode =
      this.graph._nodes_by_id?.[linkInfo.origin_id] ||
      this.graph.getNodeById?.(linkInfo.origin_id);
    if (
      sourceNode &&
      (sourceNode.type === "FunctionBlock" ||
        sourceNode.constructor.name === "FunctionBlock")
    ) {
      return sourceNode.id;
    }

    return null;
  }

  getSlotChildrenCode(slotName) {
    const functionBlockId = this.getSlotFunctionBlockId(slotName);
    if (!functionBlockId) return null;
    return `[].concat((__FUNC_${functionBlockId}__)?.() || [])`;
  }

  buildHeader(nodeId, config, tabsConfig) {
    if (!config.enabled) return null;

    const props = [propEntry("model-value", this.getControlExpr(config))];
    if (config.reveal) props.push("reveal: true");
    addSeparatorProps(props, config.separator);

    const children = [
      createDropTarget(
        nodeId,
        "header",
        { minHeight: "48px", display: "flex" },
        config.slot ? this.getSlotChildrenCode("header") : "[]",
      ),
    ];
    const tabs = this.buildNavigationTabs(nodeId, tabsConfig);
    if (tabs) children.push(tabs);

    return `h(QHeader, ${propsObject(props)}, { default: () => [${children.join(", ")}] })`;
  }

  buildFooter(nodeId, config) {
    if (!config.enabled) return null;

    const props = [propEntry("model-value", this.getControlExpr(config))];
    if (config.reveal) props.push("reveal: true");
    addSeparatorProps(props, config.separator);

    return `h(QFooter, ${propsObject(props)}, { default: () => [${createDropTarget(nodeId, "footer", { minHeight: "48px", display: "flex" }, config.slot ? this.getSlotChildrenCode("footer") : "[]")}] })`;
  }

  buildDrawer(nodeId, slotName, side, config) {
    if (!config.enabled) return null;

    const props = [
      propEntry("model-value", this.getControlExpr(config)),
      `side: ${literalString(side)}`,
    ];
    if (config.overlay) props.push("overlay: true");
    if (config.showIfAbove)
      props.push(`${JSON.stringify("show-if-above")}: true`);
    if (config.behavior && config.behavior !== "default")
      props.push(`behavior: ${literalString(config.behavior)}`);
    addSeparatorProps(props, config.separator);

    return `h(QDrawer, ${propsObject(props)}, { default: () => [${createDropTarget(nodeId, slotName, { minHeight: "120px", display: "flex" }, config.slot ? this.getSlotChildrenCode(slotName) : "[]")}] })`;
  }

  buildNavigationTabs(nodeId, config) {
    if (!config?.enabled) return null;

    const visibleExpr = this.getControlExpr(config);
    const childrenCode = config.slot
      ? this.getSlotChildrenCode("navigationTabs")
      : "[]";
    const tabs = `h(QTabs, {}, { default: () => [${createDropTarget(nodeId, "navigationTabs", { minHeight: "36px", display: "flex" }, childrenCode)}] })`;
    return `${visibleExpr} ? ${tabs} : null`;
  }

  buildPageContainer(nodeId) {
    const pageChild = createDropTarget(
      nodeId,
      "page",
      { minHeight: "120px", display: "flex", flexDirection: "column" },
      this.getSlotChildrenCode("page"),
    );
    return `h(QPageContainer, {}, { default: () => [h(QPage, {}, { default: () => [${pageChild}] })] })`;
  }

  _buildLayoutVnode(propsEntries, nodeId, tag, copyP) {
    if (copyP?.enhance?.useRealLayoutChildren) return null;

    const builder = normalizeLayoutBuilder(copyP);
    const defaultSlotChildren =
      this.getSlotChildrenCode("default") || `__CHILDREN_${nodeId}_default__`;
    const children = [
      this.buildHeader(nodeId, builder.header, builder.navigationTabs),
      this.buildDrawer(nodeId, "leftDrawer", "left", builder.leftDrawer),
      this.buildDrawer(nodeId, "rightDrawer", "right", builder.rightDrawer),
      this.buildPageContainer(nodeId),
      this.buildFooter(nodeId, builder.footer),
      `...${defaultSlotChildren}`,
    ].filter(Boolean);

    const propsStr = propsObject(propsEntries || []);
    return `createNode(${tag}, ${literalString(nodeId)}, ${propsStr}, { default: () => [${children.join(", ")}] })`;
  }
}
