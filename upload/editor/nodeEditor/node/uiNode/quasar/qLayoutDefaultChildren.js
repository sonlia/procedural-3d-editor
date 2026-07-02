const TYPE_PREFIX = "ui/quasar";

export const Q_LAYOUT_COMPONENT_TYPES = {
  layout: `${TYPE_PREFIX}/33571611-99B4-6CD2-8F7C-D4553E6BBC20`,
  header: `${TYPE_PREFIX}/E6D11474-AB1B-5873-48C1-F4F67EE08173`,
  drawer: `${TYPE_PREFIX}/8C63F95B-D25F-BE78-8B48-8F10C0F5470D`,
  leftDrawer: `${TYPE_PREFIX}/8C63F95B-D25F-BE78-8B48-8F10C0F5470D`,
  rightDrawer: `${TYPE_PREFIX}/8C63F95B-D25F-BE78-8B48-8F10C0F5470D`,
  pageContainer: `${TYPE_PREFIX}/quasar-page-container-f1e2d3c4-b5a6-7890-cdef-1234567890ab`,
  routerView: `ui/VueRouter/vue-router-view-a1b2c3d4-e5f6-7890-abcd-ef1234567890`,
  footer: `${TYPE_PREFIX}/764F77AD-CACC-854F-A1A2-55E902B2DA7D`,
};

const DEFAULT_VIEW = "lHh Lpr lFf";

function createProp(value, outType = "inputItem") {
  return {
    data: "",
    disable: false,
    isSlot: false,
    outType,
    value,
  };
}

function clonePlain(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function createQLayoutProperties() {
  return {
    props: {
      view: createProp(JSON.stringify(DEFAULT_VIEW)),
    },
    enhance: {
      useRealLayoutChildren: true,
    },
  };
}

function createQHeaderProperties() {
  return {
    props: {
      "model-value": createProp(true, "switch"),
      elevated: createProp(true, "switch"),
    },
    enhance: {
      isLayoutPart: true,
    },
  };
}

function createQDrawerProperties(side) {
  return {
    props: {
      "model-value": createProp(true, "switch"),
      side: createProp(JSON.stringify(side), "select"),
      "show-if-above": createProp(true, "switch"),
      bordered: createProp(true, "switch"),
    },
    enhance: {
      isLayoutPart: true,
      editorBehavior: {
        mode: "forceRender",
        propsOverride: { "model-value": true, overlay: false },
      },
    },
  };
}

function createLayoutPartProperties() {
  return {
    enhance: {
      isLayoutPart: true,
    },
  };
}

function createRouterViewProperties() {
  return {
    props: {},
    enhance: {
      isLayoutPart: true,
    },
  };
}

function createQFooterProperties() {
  return {
    props: {
      "model-value": createProp(true, "switch"),
      elevated: createProp(true, "switch"),
    },
    enhance: {
      isLayoutPart: true,
    },
  };
}

function createDefaultQLayoutNode(nodeType, createId) {
  const layoutId = createId();
  const headerId = createId();
  const leftDrawerId = createId();
  const rightDrawerId = createId();
  const pageContainerId = createId();
  const routerViewId = createId();
  const footerId = createId();

  const nodeById = {
    [layoutId]: {
      id: layoutId,
      type: nodeType,
      tag: "QLayout",
      properties: createQLayoutProperties(),
      children: {
        default: [
          {
            id: headerId,
            type: Q_LAYOUT_COMPONENT_TYPES.header,
            tag: "QHeader",
            properties: createQHeaderProperties(),
            children: { default: [] },
          },
          {
            id: leftDrawerId,
            type: Q_LAYOUT_COMPONENT_TYPES.drawer,
            tag: "QDrawer",
            properties: createQDrawerProperties("left"),
            children: { default: [] },
          },
          {
            id: rightDrawerId,
            type: Q_LAYOUT_COMPONENT_TYPES.drawer,
            tag: "QDrawer",
            properties: createQDrawerProperties("right"),
            children: { default: [] },
          },
          {
            id: pageContainerId,
            type: Q_LAYOUT_COMPONENT_TYPES.pageContainer,
            tag: "QPageContainer",
            properties: createLayoutPartProperties(),
            children: {
              default: [
                {
                  id: routerViewId,
                  type: Q_LAYOUT_COMPONENT_TYPES.routerView,
                  tag: "RouterView",
                  properties: createRouterViewProperties(),
                  children: {},
                },
              ],
            },
          },
          {
            id: footerId,
            type: Q_LAYOUT_COMPONENT_TYPES.footer,
            tag: "QFooter",
            properties: createQFooterProperties(),
            children: { default: [] },
          },
        ],
      },
    },
  };

  return nodeById[layoutId];
}

export function createDefaultQLayoutEditorData(nodeType, createId) {
  const layoutNode = createDefaultQLayoutNode(nodeType, createId);
  const flatNodes = flattenDragEditorNode(layoutNode);
  const graphNodes = flatNodes.map((node, index) => {
    const graphNode = {
      id: node.id,
      type: node.type,
      pos: [220 + (index % 3) * 240, 120 + Math.floor(index / 3) * 150],
      size: { 0: 180, 1: 70 },
      // 默认在 nodeEditor 中隐藏,与 dragEditor 拖入 UI 节点(addNodes {hidden:true})对齐;
      // 隐藏仅画布层,代码生成走全量 graph._nodes,不影响产物。用户可经眼睛按钮显示。
      flags: { hidden: true },
      order: index,
      mode: 3,
      properties: clonePlain(node.properties || {}),
    };

    if (node.tag) graphNode.tag = node.tag;
    return graphNode;
  });

  return {
    dragEditor: [layoutNode],
    nodeEditorData: {
      last_node_id: flatNodes.length,
      last_link_id: 0,
      nodes: graphNodes,
      links: [],
      groups: [],
      config: {},
      extra: {},
      version: 0.4,
    },
  };
}

export function flattenDragEditorNode(node) {
  const nodes = [];

  const visit = (item) => {
    if (!item) return;
    nodes.push(item);

    const children = item.children;
    if (Array.isArray(children)) {
      children.forEach(visit);
    } else if (children && typeof children === "object") {
      Object.values(children).forEach((slotNodes) => {
        if (Array.isArray(slotNodes)) slotNodes.forEach(visit);
      });
    }
  };

  visit(node);
  return nodes;
}
