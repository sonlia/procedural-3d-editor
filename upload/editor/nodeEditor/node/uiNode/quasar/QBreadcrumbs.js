import { defineAsyncComponent, markRaw } from "vue";
import { uiNodeMeta } from "../../nodeMetea.js";

export const BREADCRUMBS_RAW_DATA = {
  id: "235CF311-6904-9569-9838-B303F87E46E9",
  treePath: "ui/quasar",
  name: "QBreadcrumbs",
  importStr: "import { QBreadcrumbs, QBreadcrumbsEl } from \"quasar\"",
  tag: "QBreadcrumbs",
  parentMustBe: [],
  type: "component",
  meta: {
    docsUrl: "https://v2.quasar.dev/vue-components/breadcrumbs",
  },
  props: {
    separator: {
      type: "String",
      desc: "The string used to separate the breadcrumbs",
      default: "/",
      examples: ["-", "|", ">"],
      category: "content",
      required: false,
      outType: "inputItem",
      desc_cn: "面包屑分隔符",
    },
    "active-color": {
      type: "String",
      tsType: "NamedColor",
      desc: "The color of the active breadcrumb",
      examples: ["primary", "teal", "teal-10"],
      category: "style",
      default: "primary",
      required: false,
      outType: "colorItem",
      desc_cn: "当前面包屑颜色",
    },
    gutter: {
      type: "String",
      desc: "Space between breadcrumb elements",
      default: "sm",
      values: ["none", "xs", "sm", "md", "lg", "xl"],
      category: "content",
      required: false,
      outType: "dropDownSelect",
      desc_cn: "面包屑元素间距",
    },
    "separator-color": {
      type: "String",
      tsType: "NamedColor",
      desc: "The color used to color the separator",
      examples: ["primary", "teal", "teal-10"],
      category: "style",
      outType: "colorItem",
      desc_cn: "分隔符颜色",
    },
    align: {
      type: "String",
      default: "left",
      desc: "Specify how to align the breadcrumbs horizontally",
      values: ["left", "center", "right", "between", "around", "evenly"],
      category: "content",
      required: false,
      outType: "dropDownSelect",
      desc_cn: "水平对齐方式",
    },
  },
  slots: {
    separator: {
      desc: "HTML or component used as separator",
      desc_cn: "自定义分隔符插槽",
      scope: {},
    },
  },
};

export const BREADCRUMBS_EL_RAW_DATA = {
  tag: "QBreadcrumbsEl",
  props: {
    to: {
      type: ["String", "Object"],
      desc: "Equivalent to Vue Router <router-link> 'to' property",
      examples: ["/home/dashboard", "{ name: 'my-route-name' }"],
      category: "navigation",
      outType: "inputItem",
      desc_cn: "Vue Router 跳转目标",
    },
    exact: {
      type: "Boolean",
      desc: "Equivalent to Vue Router <router-link> 'exact' property",
      category: "navigation",
      outType: "toggleItem",
      desc_cn: "精确匹配路由",
    },
    replace: {
      type: "Boolean",
      desc: "Equivalent to Vue Router <router-link> 'replace' property",
      category: "navigation",
      outType: "toggleItem",
      desc_cn: "替换当前路由记录",
    },
    "active-class": {
      type: "String",
      desc: "Equivalent to Vue Router <router-link> 'active-class' property",
      default: "q-router-link--active",
      examples: ["my-active-class"],
      category: "navigation",
      outType: "inputItem",
      desc_cn: "激活状态 class",
    },
    "exact-active-class": {
      type: "String",
      desc: "Equivalent to Vue Router <router-link> 'exact-active-class' property",
      default: "q-router-link--exact-active",
      examples: ["my-exact-active-class"],
      category: "navigation",
      outType: "inputItem",
      desc_cn: "精确激活状态 class",
    },
    label: {
      type: "String",
      desc: "The label text for the breadcrumb",
      examples: ["Home"],
      category: "content",
      outType: "inputItem",
      desc_cn: "面包屑文本",
    },
    icon: {
      type: "String",
      desc: "Icon name following Quasar convention",
      examples: ["home", "ion-home"],
      category: "content",
      outType: "iconItem",
      desc_cn: "图标名称",
    },
    tag: {
      type: "String",
      desc: "HTML tag to use for the breadcrumb",
      default: "span",
      examples: ["a", "div"],
      category: "content",
      outType: "inputItem",
      desc_cn: "HTML 标签",
    },
    disable: {
      type: "Boolean",
      desc: "Put component in disabled mode",
      category: "state",
      outType: "toggleItem",
      desc_cn: "禁用状态",
    },
  },
  slots: {
    default: {
      desc: "Custom content instead of label prop",
      desc_cn: "自定义内容插槽",
      scope: {},
    },
  },
  events: {
    click: {
      desc: "Emitted when the component is clicked",
      params: {
        evt: {
          type: "Event",
          desc: "JS event object",
          desc_cn: "JS 事件对象",
        },
      },
      desc_cn: "点击事件",
    },
  },
};

function createPropState() {
  return {
    data: "",
    disable: false,
    isSlot: false,
    value: "",
  };
}

function createBreadcrumbItem(index = 0) {
  const id = `bc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const props = {};
  Object.keys(BREADCRUMBS_EL_RAW_DATA.props).forEach((propName) => {
    props[propName] = createPropState();
  });
  props.label.value = JSON.stringify(index === 0 ? "Home" : `Breadcrumb ${index + 1}`);
  if (index === 0) props.icon.value = JSON.stringify("home");

  return {
    id,
    props,
    events: { click: false },
    slots: { default: false },
  };
}

// 数据接入模式的单个 QBreadcrumbsEl 模板:复用 item 结构,固定 id 便于生成稳定的 slot 名,
// 清空默认静态值(模板属性由用户绑定字段或自行输入)。
function createTemplateItem() {
  const item = createBreadcrumbItem(0);
  item.id = "tpl";
  Object.keys(item.props).forEach((propName) => {
    item.props[propName].value = "";
  });
  return item;
}

function createProperties() {
  const props = {};
  Object.keys(BREADCRUMBS_RAW_DATA.props).forEach((propName) => {
    const propConfig = BREADCRUMBS_RAW_DATA.props[propName];
    props[propName] = {
      data: "",
      disable: false,
      outType: propConfig.outType,
    };
  });

  return {
    props,
    styleClass: {},
    events: {},
    slots: {
      separator: false,
    },
    methods: {},
    computedProps: {},
    style: "",
    wrappers: {},
    enhance: {
      permissionConfig: null,
    },
    // 手动模式:逐项手写的面包屑
    items: [createBreadcrumbItem(0), createBreadcrumbItem(1)],
    // 数据接入模式
    mode: "manual", // "manual" | "data"
    dataSource: { isSlot: false, value: "" }, // 数据数组来源(变量名)
    itemVar: "item",
    indexVar: "index",
    keyExpression: "index",
    sampleData: "", // 设计期 JSON 示例,仅用于字段下拉,不进生成代码
    template: createTemplateItem(),
  };
}

function safeKey(name) {
  return /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)
    ? name
    : JSON.stringify(name);
}

function propsObject(entries) {
  return entries.length > 0 ? `{ ${entries.join(", ")} }` : "{}";
}

function functionSlotId(node, inputName) {
  const inputSlotIndex = node.findInputSlot(inputName);
  if (inputSlotIndex === -1 || !node.inputs[inputSlotIndex].link || !node.graph) {
    return null;
  }

  const linkInfo = node.graph.links[node.inputs[inputSlotIndex].link];
  if (!linkInfo) return null;

  const sourceNode = node.graph._nodes_by_id[linkInfo.origin_id];
  if (
    sourceNode &&
    (sourceNode.type === "FunctionBlock" ||
      sourceNode.constructor.name === "FunctionBlock")
  ) {
    return sourceNode.id;
  }

  return null;
}

function ensureFunctionInput(node, inputName, args, meta = {}) {
  if (node.findInputSlot(inputName) !== -1) return;
  node.addInput(inputName, "function", {
    shape: 5,
    meta: { args },
    ...meta,
  });
}

function removeInputByName(node, inputName) {
  const idx = node.inputs?.findIndex((slot) => slot.name === inputName) ?? -1;
  if (idx !== -1) node.removeInput(idx);
}

export class QBreadcrumbs extends uiNodeMeta {
  constructor() {
    super();
    this.tag = BREADCRUMBS_RAW_DATA.tag;
    this.nodeRawData = BREADCRUMBS_RAW_DATA;
    this.docs = BREADCRUMBS_RAW_DATA.meta.docs;
    this.categories = "ui";
    this.importStr = BREADCRUMBS_RAW_DATA.importStr;
    this.parentMustBe = [];
    this.properties = createProperties();
    this.uiPanel = markRaw(
      defineAsyncComponent(() => import("./QBreadcrumbsPanel.vue")),
    );
  }

  ensureProperties() {
    if (!this.properties) this.properties = createProperties();
    if (!Array.isArray(this.properties.items)) {
      this.properties.items = [createBreadcrumbItem(0)];
    }
    if (!this.properties.props) this.properties.props = {};
    Object.keys(BREADCRUMBS_RAW_DATA.props).forEach((propName) => {
      if (!this.properties.props[propName]) {
        this.properties.props[propName] = {
          data: "",
          disable: false,
          outType: BREADCRUMBS_RAW_DATA.props[propName].outType,
        };
      }
    });
    if (!this.properties.slots) this.properties.slots = {};
    if (this.properties.slots.default !== undefined) {
      delete this.properties.slots.default;
      removeInputByName(this, "S#default");
    }
    Object.keys(BREADCRUMBS_RAW_DATA.slots).forEach((slotName) => {
      if (this.properties.slots[slotName] === undefined) {
        this.properties.slots[slotName] = false;
      }
    });
    this.properties.items.forEach((item, index) => {
      if (!item.id) item.id = `bc_legacy_${index}`;
      if (!item.props) item.props = {};
      Object.keys(BREADCRUMBS_EL_RAW_DATA.props).forEach((propName) => {
        if (!item.props[propName]) item.props[propName] = createPropState();
      });
      if (!item.events) item.events = { click: false };
      if (!item.slots) item.slots = { default: false };
    });

    // 数据接入模式字段回填(旧节点默认 manual)
    if (!this.properties.mode) this.properties.mode = "manual";
    if (!this.properties.dataSource) {
      this.properties.dataSource = { isSlot: false, value: "" };
    }
    if (this.properties.itemVar === undefined) this.properties.itemVar = "item";
    if (this.properties.indexVar === undefined) {
      this.properties.indexVar = "index";
    }
    if (this.properties.keyExpression === undefined) {
      this.properties.keyExpression = "index";
    }
    if (this.properties.sampleData === undefined) {
      this.properties.sampleData = "";
    }
    if (!this.properties.template) {
      this.properties.template = createTemplateItem();
    }
    const tpl = this.properties.template;
    if (!tpl.id) tpl.id = "tpl";
    if (!tpl.props) tpl.props = {};
    Object.keys(BREADCRUMBS_EL_RAW_DATA.props).forEach((propName) => {
      if (!tpl.props[propName]) tpl.props[propName] = createPropState();
    });
    if (!tpl.events) tpl.events = { click: false };
    if (!tpl.slots) tpl.slots = { default: false };
  }

  // 数据接入模式:item / index 循环变量作为输出槽暴露(值=变量名字符串,UILoop 同款)。
  // 用 loopRole 标记定位,使 itemVar/indexVar 改名后仍能找到对应槽更新 name。
  syncLoopOutputs() {
    const isData = this.properties?.mode === "data";
    if (!Array.isArray(this.outputs)) return;
    const findByRole = (role) =>
      this.outputs.findIndex((o) => o?.loopRole === role);

    if (isData) {
      const itemVar = this.properties?.itemVar || "item";
      const indexVar = this.properties?.indexVar || "index";
      const itemIdx = findByRole("item");
      if (itemIdx === -1) this.addOutput(itemVar, "string", { loopRole: "item" });
      else this.outputs[itemIdx].name = itemVar;
      const indexIdx = findByRole("index");
      if (indexIdx === -1) {
        this.addOutput(indexVar, "string", { loopRole: "index" });
      } else {
        this.outputs[indexIdx].name = indexVar;
      }
    } else {
      for (let i = this.outputs.length - 1; i >= 0; i -= 1) {
        if (this.outputs[i]?.loopRole) this.removeOutput(i);
      }
    }
  }

  // 数据接入模式 + slot 来源时,确保存在名为 data 的 string 输入槽(取上游变量名);否则移除。
  ensureDataSourceSlot() {
    const useSlot =
      this.properties?.mode === "data" &&
      this.properties?.dataSource?.isSlot === true;
    const idx = this.inputs?.findIndex((s) => s.name === "data") ?? -1;
    if (useSlot && idx === -1) {
      this.addInput("data", "string");
    } else if (!useSlot && idx !== -1) {
      this.removeInput(idx);
    }
  }

  buildDataSourceExpr() {
    const ds = this.properties?.dataSource || {};
    if (ds.isSlot) {
      const idx = this.findInputSlot("data");
      if (idx !== -1) {
        const value = this.getInputData(idx);
        if (value !== undefined && value !== null && value !== "") return value;
      }
      return "[]";
    }
    return ds.value && ds.value.trim() ? ds.value : "[]";
  }

  // 模板 QBreadcrumbsEl 的 props:每个属性值已是表达式(下拉选中的 item.字段 或自由输入),
  // 直接拼入;追加 :key;click 事件复用 __FUNC__ 机制。
  buildTemplateElProps(item) {
    const entries = [];
    const props = item.props || {};
    const keyExpr =
      this.properties?.keyExpression || this.properties?.indexVar || "index";
    entries.push(`key: ${keyExpr}`);

    Object.keys(BREADCRUMBS_EL_RAW_DATA.props).forEach((propName) => {
      const propConfig = props[propName];
      if (!propConfig || propConfig.disable) return;

      // slot 模式:接入上游节点的变量名(同手动模式 P#<id>#<prop> 机制)
      if (propConfig.isSlot === true) {
        const inputName = `P#${item.id}#${propName}`;
        if (this.findInputSlot(inputName) === -1) {
          this.addInput(inputName, "string", {
            breadcrumbItemId: item.id,
            breadcrumbKind: "prop",
            propName,
          });
        }
        const slotValue = this.getInputData(this.findInputSlot(inputName));
        if (slotValue !== undefined && slotValue !== null && slotValue !== "") {
          entries.push(`${safeKey(propName)}: ${slotValue}`);
        }
        return;
      }

      const propValue =
        propConfig.value !== undefined && propConfig.value !== ""
          ? propConfig.value
          : propConfig.data;
      if (propValue !== undefined && propValue !== "") {
        entries.push(`${safeKey(propName)}: ${propValue}`);
      }
    });

    if (item.events?.click) {
      const inputName = `E#el:${item.id}:click`;
      ensureFunctionInput(this, inputName, ["evt"], {
        breadcrumbItemId: item.id,
        breadcrumbKind: "event",
        eventName: "click",
      });
      const funcId = functionSlotId(this, inputName);
      if (funcId) entries.push(`onClick: __FUNC_${funcId}__`);
    }

    return propsObject(entries);
  }

  buildDataComponentSlots() {
    const itemVar = this.properties?.itemVar || "item";
    const indexVar = this.properties?.indexVar || "index";
    const dataExpr = this.buildDataSourceExpr();
    const tpl = this.properties.template;
    const elProps = this.buildTemplateElProps(tpl);
    const children = this.buildItemChildren(tpl);
    const itemCode = `h(QBreadcrumbsEl, ${elProps}, ${children})`;
    const mapExpr = `(${dataExpr} || []).map((${itemVar}, ${indexVar}) => ${itemCode})`;

    const separatorSlot =
      this.properties?.slots?.separator === true
        ? ", ...(slots?.separator ? { separator: slots.separator } : {})"
        : "";
    return `{
      default: () => ${mapExpr}${separatorSlot}
    }`;
  }

  buildRootProps() {
    const entries = [];
    const props = this.properties?.props || {};

    Object.keys(BREADCRUMBS_RAW_DATA.props).forEach((propName) => {
      const propConfig = props[propName];
      if (!propConfig || propConfig.disable) return;

      if (propConfig.isSlot === true) {
        if (this.findInputSlot(propName) === -1) {
          this.addInput(propName, "string");
        }
        const slotValue = this.getInputData(this.findInputSlot(propName));
        if (slotValue !== undefined && slotValue !== null && slotValue !== "") {
          entries.push(`${safeKey(propName)}: ${slotValue}`);
        }
        return;
      }

      const propValue =
        propConfig.value !== undefined && propConfig.value !== ""
          ? propConfig.value
          : propConfig.data;
      if (propValue !== undefined && propValue !== "") {
        entries.push(`${safeKey(propName)}: ${propValue}`);
      }
    });

    const classSet = new Set();
    Object.values(this.properties?.styleClass || {}).forEach((value) => {
      if (Array.isArray(value)) value.forEach((item) => classSet.add(item));
      else if (value !== null && value !== undefined && value !== "") {
        classSet.add(value);
      }
    });
    const classString = Array.from(classSet).join(" ");
    if (classString.trim()) entries.push(`class: ${JSON.stringify(classString)}`);

    if (typeof this.properties?.style === "string" && this.properties.style.trim()) {
      entries.push(`style: ${JSON.stringify(this.properties.style)}`);
    }

    return propsObject(entries);
  }

  buildItemProps(item) {
    const entries = [];
    const props = item.props || {};

    Object.keys(BREADCRUMBS_EL_RAW_DATA.props).forEach((propName) => {
      const propConfig = props[propName];
      if (!propConfig || propConfig.disable) return;

      if (propConfig.isSlot === true) {
        const inputName = `P#${item.id}#${propName}`;
        if (this.findInputSlot(inputName) === -1) {
          this.addInput(inputName, "string", {
            breadcrumbItemId: item.id,
            breadcrumbKind: "prop",
            propName,
          });
        }
        const slotValue = this.getInputData(this.findInputSlot(inputName));
        if (slotValue !== undefined && slotValue !== null && slotValue !== "") {
          entries.push(`${safeKey(propName)}: ${slotValue}`);
        }
        return;
      }

      const propValue =
        propConfig.value !== undefined && propConfig.value !== ""
          ? propConfig.value
          : propConfig.data;
      if (propValue !== undefined && propValue !== "") {
        entries.push(`${safeKey(propName)}: ${propValue}`);
      }
    });

    if (item.events?.click) {
      const inputName = `E#el:${item.id}:click`;
      ensureFunctionInput(this, inputName, ["evt"], {
        breadcrumbItemId: item.id,
        breadcrumbKind: "event",
        eventName: "click",
      });
      const funcId = functionSlotId(this, inputName);
      if (funcId) entries.push(`onClick: __FUNC_${funcId}__`);
    }

    return propsObject(entries);
  }

  buildItemChildren(item) {
    if (!item.slots?.default) return "null";

    const inputName = `S#el:${item.id}:default`;
    ensureFunctionInput(this, inputName, [], {
      breadcrumbItemId: item.id,
      breadcrumbKind: "slot",
      slotName: "default",
    });

    const funcId = functionSlotId(this, inputName);
    if (!funcId) return "null";
    return `{ default: __FUNC_${funcId}__ }`;
  }

  buildComponentSlots() {
    if (this.properties?.mode === "data") {
      return this.buildDataComponentSlots();
    }

    const itemCodes = this.properties.items.map((item) => {
      return `h(QBreadcrumbsEl, ${this.buildItemProps(item)}, ${this.buildItemChildren(item)})`;
    });

    const defaultItemsExpr =
      itemCodes.length > 0 ? `[${itemCodes.join(", ")}]` : "[]";
    const separatorSlot =
      this.properties?.slots?.separator === true
        ? ", ...(slots?.separator ? { separator: slots.separator } : {})"
        : "";
    return `{
      default: () => ${defaultItemsExpr}${separatorSlot}
    }`;
  }

  buildNodeChildren() {
    const slotEntries = [];
    const slots = this.properties?.slots || {};

    Object.keys(BREADCRUMBS_RAW_DATA.slots).forEach((slotName) => {
      if (slots[slotName] !== true) return;
      const inputName = `S#${slotName}`;
      ensureFunctionInput(this, inputName, [], {
        slotName,
      });
      const funcId = functionSlotId(this, inputName);
      if (funcId) {
        slotEntries.push(`${safeKey(slotName)}: __FUNC_${funcId}__`);
      } else {
        slotEntries.push(`${safeKey(slotName)}: () => __CHILDREN_${this.id}_${slotName}__`);
      }
    });

    return slotEntries.length > 0 ? `{ ${slotEntries.join(", ")} }` : "[]";
  }

  genCode() {
    this.ensureProperties();
    this.syncLoopOutputs();
    this.ensureDataSourceSlot();
    this.setOutputData(this.findOutputSlot("Ref"), this.id);

    // 数据模式:把循环变量名写到 item / index 输出槽,供下游(含 FunctionBlock passIn)引用
    if (this.properties.mode === "data" && Array.isArray(this.outputs)) {
      const itemIdx = this.outputs.findIndex((o) => o?.loopRole === "item");
      const indexIdx = this.outputs.findIndex((o) => o?.loopRole === "index");
      if (itemIdx !== -1) {
        this.setOutputData(itemIdx, this.properties.itemVar || "item");
      }
      if (indexIdx !== -1) {
        this.setOutputData(indexIdx, this.properties.indexVar || "index");
      }
    }

    const componentName = `QBreadcrumbs_${String(this.id).replace(/[^a-zA-Z0-9_$]/g, "_")}`;
    const rootProps = this.buildRootProps();
    const rootPropsWithOuterAttrs =
      rootProps === "{}" ? "{ ..._props }" : `{ ..._props, ...${rootProps} }`;
    const componentSlots = this.buildComponentSlots();

    this.uiSetupCode = `const ${componentName} = (_props = {}, _ctx = {}) => { const slots = _ctx?.slots || {}; return h(QBreadcrumbs, ${rootPropsWithOuterAttrs}, ${componentSlots}); }`;
    this.layoutSetupCode = "";
    return `createNode(${componentName}, ${JSON.stringify(this.id)}, {}, ${this.buildNodeChildren()})`;
  }

  onExecute() {
    this.jsCode = this.genCode();
  }

  onConfigure(info) {
    super.onConfigure?.(info);
    this.ensureProperties();
  }

  static get title() {
    return "QBreadcrumbs";
  }

  static get name() {
    return "QBreadcrumbs";
  }

  static get treePath() {
    return "ui/quasar";
  }

  static get id() {
    return "235CF311-6904-9569-9838-B303F87E46E9";
  }
}

export function createBreadcrumbPanelItem(index = 0) {
  return createBreadcrumbItem(index);
}

export function removeBreadcrumbInputSlots(node, itemId) {
  if (!node?.inputs) return;
  for (let i = node.inputs.length - 1; i >= 0; i -= 1) {
    if (node.inputs[i]?.breadcrumbItemId === itemId) {
      node.removeInput(i);
    }
  }
}

export function setBreadcrumbPropSlot(node, item, propName, enabled) {
  if (!item?.props?.[propName]) return;
  item.props[propName].isSlot = enabled;
  const inputName = `P#${item.id}#${propName}`;
  if (enabled) {
    if (node.findInputSlot(inputName) === -1) {
      node.addInput(inputName, "string", {
        breadcrumbItemId: item.id,
        breadcrumbKind: "prop",
        propName,
      });
    }
  } else {
    removeInputByName(node, inputName);
  }
  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

export function setBreadcrumbFunctionSlot(node, item, kind, name, enabled) {
  const inputName =
    kind === "event"
      ? `E#el:${item.id}:${name}`
      : `S#el:${item.id}:${name}`;
  const args =
    kind === "event"
      ? Object.keys(BREADCRUMBS_EL_RAW_DATA.events[name]?.params || {})
      : [];

  if (enabled) {
    ensureFunctionInput(node, inputName, args, {
      breadcrumbItemId: item.id,
      breadcrumbKind: kind,
      [`${kind}Name`]: name,
      ...(kind === "slot" ? { slotName: name } : {}),
    });
  } else {
    removeInputByName(node, inputName);
  }
  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

// 数据接入:切换数据源 isSlot(连接上游变量 vs 直接输入变量名)
export function setBreadcrumbDataSourceSlot(node, isSlot) {
  if (!node?.properties) return;
  if (!node.properties.dataSource) {
    node.properties.dataSource = { isSlot: false, value: "" };
  }
  node.properties.dataSource.isSlot = isSlot;
  node.ensureDataSourceSlot?.();
  node.onExecute?.();
  node.graph?.setDirtyCanvas?.(true, true);
}

// 数据接入:itemVar/indexVar 改名或模式切换后,同步 item/index 输出槽
export function syncBreadcrumbLoopOutputs(node) {
  node?.syncLoopOutputs?.();
  node?.onExecute?.();
  node?.graph?.setDirtyCanvas?.(true, true);
}
