<script setup>
import { computed, watchEffect, ref } from "vue";
import ResourcePanel from "../../dragEditor/components/permissionManager/panels/ResourcePanel.vue";
import compBehaviorSection from './compBehaviorSection.vue';
import { useEditorTabs } from '../../dragEditor/composables/useEditorTabs.js';
import { useComponentPermissionSync } from "../../dragEditor/components/permissionManager/composables/useComponentPermissionSync.js";

const nodeData = defineModel();
const { addTab, removeTab } = useEditorTabs();
const permissionSync = useComponentPermissionSync();

// 权限配置对话框
const showPermissionDialog = ref(false);

// 确保权限配置结构存在
const ensurePermissionConfig = () => {
  if (!nodeData.value?.properties) return;

  // 确保 enhance 结构存在
  if (!nodeData.value.properties.enhance) {
    nodeData.value.properties.enhance = {};
  }

  const enhance = nodeData.value.properties.enhance;

  if (!enhance.permissionConfig) {
    // 生成唯一的组件权限ID（基于组件ID和时间戳，作为归属键，不随改名变）
    const componentPermissionId = `comp-perm-${nodeData.value.id}-${Date.now()}`;

    enhance.permissionConfig = {
      id: componentPermissionId, // 归属键 componentPermissionId
      componentId: nodeData.value.id,
      componentName: nodeData.value.properties?.label || nodeData.value.title || '未命名组件',
      ownedRows: [], // 组件拥有的资源行摘要（权威以 store 查询为准，此处仅作展示/状态缓存）
      lastUpdated: null
    };
  } else if (!Array.isArray(enhance.permissionConfig.ownedRows)) {
    // 旧数据迁移：单 resourceId → ownedRows 多行
    const cfg = enhance.permissionConfig;
    cfg.ownedRows = cfg.resourceId
      ? [{ resourceId: cfg.resourceId, type: 'component', name: cfg.componentName, identifier: cfg.resourceIdentifier }]
      : [];
    delete cfg.resourceId;
    delete cfg.resourceIdentifier;
  }
};

// 当前组件的权限配置信息
const componentPermissionInfo = computed(() => {
  if (!nodeData.value?.properties?.enhance) {
    return null;
  }

  return nodeData.value.properties.enhance.permissionConfig || null;
});

// 创建默认配置项（{ value, isSlot } 结构） - 仅用于条件渲染
const createPropConfig = (defaultValue = "") => ({
  value: defaultValue,
  isSlot: false,
});

// 确保数据结构存在
function ensureEnhanceStructure() {
  if (!nodeData.value.properties) {
    nodeData.value.properties = {};
  }
  if (!nodeData.value.properties.wrappers) {
    nodeData.value.properties.wrappers = {
      // v-if 和 v-show（互斥）
      vIf: {
        enabled: false,
        condition: createPropConfig(""),
      },
      vShow: {
        enabled: false,
        condition: createPropConfig(""),
      },

      // Teleport
      teleport: {
        enabled: false,
        to: '"body"',
        disabled: false,
        defer: false,
      },

      // KeepAlive
      keepAlive: {
        enabled: false,
        include: "",
        exclude: "",
        max: null,
      },

      // Suspense
      suspense: {
        enabled: false,
        timeout: undefined,
        suspensible: false,
        // 插槽配置
        slots: {
          default: "",
          fallback: "",
        },
        // 事件配置
        events: {
          onResolve: { value: "", isSlot: false },
          onPending: { value: "", isSlot: false },
          onFallback: { value: "", isSlot: false },
        },
      },

      // Transition（与 TransitionGroup 互斥）
      transition: {
        enabled: false,
        name: '"fade"',
        mode: "",
        appear: false,
        css: true,
        type: '"transition"',
        duration: "",
        // 自定义类名
        enterFromClass: "",
        enterActiveClass: "",
        enterToClass: "",
        leaveFromClass: "",
        leaveActiveClass: "",
        leaveToClass: "",
        appearClass: "",
        appearActiveClass: "",
        appearToClass: "",
        // 事件钩子
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

      // TransitionGroup（与 Transition 互斥）
      transitionGroup: {
        enabled: false,
        name: '"list"',
        tag: '"div"',
        appear: false,
        css: true,
        type: '"transition"',
        duration: "",
        moveClass: "",
        // 自定义类名
        enterFromClass: "",
        enterActiveClass: "",
        enterToClass: "",
        leaveFromClass: "",
        leaveActiveClass: "",
        leaveToClass: "",
        appearClass: "",
        appearActiveClass: "",
        appearToClass: "",
        // 事件钩子（同 Transition）
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

      // Component（动态组件）
      component: {
        enabled: false,
        is: "",
      },
    };
  }

  // 数据迁移：将旧格式的事件字符串转换为新格式的对象
  const wrappers = nodeData.value.properties.wrappers;

  // 迁移 suspense 事件
  if (wrappers.suspense?.events) {
    Object.keys(wrappers.suspense.events).forEach((eventKey) => {
      const eventValue = wrappers.suspense.events[eventKey];
      // 如果是字符串，转换为对象格式
      if (typeof eventValue === "string") {
        wrappers.suspense.events[eventKey] = {
          value: eventValue,
          isSlot: false,
        };
      }
    });
  }

  // 迁移 transition 事件
  if (wrappers.transition?.events) {
    Object.keys(wrappers.transition.events).forEach((eventKey) => {
      const eventValue = wrappers.transition.events[eventKey];
      // 如果是字符串，转换为对象格式
      if (typeof eventValue === "string") {
        wrappers.transition.events[eventKey] = {
          value: eventValue,
          isSlot: false,
        };
      }
    });
  }

  // 迁移 transitionGroup 事件
  if (wrappers.transitionGroup?.events) {
    Object.keys(wrappers.transitionGroup.events).forEach((eventKey) => {
      const eventValue = wrappers.transitionGroup.events[eventKey];
      // 如果是字符串，转换为对象格式
      if (typeof eventValue === "string") {
        wrappers.transitionGroup.events[eventKey] = {
          value: eventValue,
          isSlot: false,
        };
      }
    });
  }
}

watchEffect(() => {
  if (nodeData.value) {
    ensureEnhanceStructure();
  }
});

// ========== 条件渲染部分 ==========
// 更新条件渲染的 isSlot 状态并管理对应的 slot
const updateConditionalRenderSlot = (type, isSlot) => {
  if (!nodeData.value) return;

  // 更新 isSlot 状态
  nodeData.value.properties.wrappers[type].condition.isSlot = isSlot;

  // 管理对应的 slot input
  const slotName = `V#${type}`;
  const slotIndex =
    nodeData.value.inputs?.findIndex((slot) => slot.name === slotName) ?? -1;

  if (isSlot && slotIndex === -1) {
    // 启用 slot：添加输入 slot（条件渲染使用 string 类型，常规 shape）
    nodeData.value.addInput(slotName, "string");
  } else if (!isSlot && slotIndex !== -1) {
    // 禁用 slot：删除输入 slot
    nodeData.value.removeInput(slotIndex);
  }

  // 触发节点更新
  if (
    nodeData.value.onExecute &&
    typeof nodeData.value.onExecute === "function"
  ) {
    nodeData.value.onExecute();
  }
};

// 切换 v-if（与 v-show 互斥）
const toggleVIf = () => {
  ensureEnhanceStructure();
  const wrappers = nodeData.value.properties.wrappers;

  if (wrappers.vIf.enabled) {
    wrappers.vIf.enabled = false;
    removeTab(nodeData.value.id + '-vIf');
  } else {
    wrappers.vIf.enabled = true;
    wrappers.vShow.enabled = false;
    removeTab(nodeData.value.id + '-vShow');
    addTab({
      type: 'hidden',
      nodeId: nodeData.value.id + '-vIf',
      label: `隐藏:${nodeData.value.properties?.label || nodeData.value.title || 'v-if'}`,
    });
  }
};

// 切换 v-show（与 v-if 互斥）
const toggleVShow = () => {
  ensureEnhanceStructure();
  const wrappers = nodeData.value.properties.wrappers;

  if (wrappers.vShow.enabled) {
    wrappers.vShow.enabled = false;
    removeTab(nodeData.value.id + '-vShow');
  } else {
    wrappers.vShow.enabled = true;
    wrappers.vIf.enabled = false;
    removeTab(nodeData.value.id + '-vIf');
    addTab({
      type: 'hidden',
      nodeId: nodeData.value.id + '-vShow',
      label: `隐藏:${nodeData.value.properties?.label || nodeData.value.title || 'v-show'}`,
    });
  }
};

// ========== 包装组件部分 ==========
// 包装组件定义（按嵌套顺序：从外到内）
const wrappersDef = [
  {
    key: "teleport",
    name: "Teleport",
    description: "将内容传送到 DOM 其他位置",
    props: [
      {
        key: "to",
        label: "目标容器 (to)",
        type: "text",
        placeholder: '"body" / #modal / .container',
        hint: "CSS 选择器或 DOM 元素",
      },
      {
        key: "disabled",
        label: "禁用传送 (disabled)",
        type: "checkbox",
        hint: "禁用时内容保留在原位置",
      },
      {
        key: "defer",
        label: "延迟传送 (defer)",
        type: "checkbox",
        hint: "Vue 3.5+ 延迟到组件挂载后再传送",
      },
    ],
  },
  {
    key: "keepAlive",
    name: "KeepAlive",

    description: "缓存组件实例，避免重复渲染",
    props: [
      {
        key: "include",
        label: "包含组件 (include)",
        type: "text",
        placeholder: '"ComponentA,ComponentB"',
        hint: "组件名称，逗号分隔",
      },
      {
        key: "exclude",
        label: "排除组件 (exclude)",
        type: "text",
        placeholder: '"ComponentC"',
        hint: "不缓存的组件名称",
      },
      {
        key: "max",
        label: "最大缓存数 (max)",
        type: "number",
        placeholder: "10",
        hint: "最多缓存多少个组件实例",
      },
    ],
  },
  {
    key: "suspense",
    name: "Suspense",
    description: "处理异步组件的加载状态",
    props: [
      {
        key: "timeout",
        label: "超时时间 (timeout)",
        type: "number",
        placeholder: "留空则等待所有异步内容",
        hint: "超时时间（毫秒）。默认 undefined，会等待所有异步组件加载完成",
      },
      {
        key: "suspensible",
        label: "可被父级捕获 (suspensible)",
        type: "checkbox",
        hint: "Vue 3.4+ 是否可被父 Suspense 捕获。默认 false",
      },
    ],
    slots: [
      {
        key: "fallback",
        label: "加载插槽 (fallback)",
        hint: "加载中显示的内容",
      },
    ],
    events: [
      {
        key: "onResolve",
        label: "@resolve",
        hint: "异步内容加载完成时触发",
      },
      {
        key: "onPending",
        label: "@pending",
        hint: "开始等待异步内容时触发",
      },
      {
        key: "onFallback",
        label: "@fallback",
        hint: "显示 fallback 内容时触发",
      },
    ],
  },
  {
    key: "transition",
    name: "Transition",
    description: "单个元素/组件的过渡动画",
    exclusive: "transitionGroup",
    props: [
      {
        key: "name",
        label: "过渡类名 (name)",
        type: "text",
        placeholder: '"fade" / "slide"',
        hint: "CSS 类名前缀",
      },
      {
        key: "mode",
        label: "切换模式 (mode)",
        type: "select",
        options: [
          { label: "默认", value: "" },
          { label: "out-in", value: '"out-in"' },
          { label: "in-out", value: '"in-out"' },
        ],
        hint: "过渡切换模式。默认无 mode",
      },
      {
        key: "appear",
        label: "初始渲染过渡 (appear)",
        type: "checkbox",
        hint: "首次渲染时也应用过渡",
      },
      {
        key: "css",
        label: "启用 CSS (css)",
        type: "checkbox",
        hint: "是否使用 CSS 过渡（默认 true）",
      },
      {
        key: "type",
        label: "过渡类型 (type)",
        type: "select",
        options: [
          { label: "transition", value: '"transition"' },
          { label: "animation", value: '"animation"' },
        ],
        hint: "指定过渡类型。默认 transition",
      },
      {
        key: "duration",
        label: "持续时间 (duration)",
        type: "text",
        placeholder: "留空则自动检测，或 300 或 {enter: 300, leave: 200}",
        hint: "显式指定持续时间（毫秒）。默认等待根元素的第一个 transitionend 或 animationend 事件",
      },
      {
        key: "enterFromClass",
        label: "enter-from-class",
        type: "textarea",
        placeholder: '"custom-enter-from"',
        hint: "进入开始状态类名",
      },
      {
        key: "enterActiveClass",
        label: "enter-active-class",
        type: "textarea",
        placeholder: '"custom-enter-active"',
        hint: "进入过程类名",
      },
      {
        key: "enterToClass",
        label: "enter-to-class",
        type: "textarea",
        placeholder: '"custom-enter-to"',
        hint: "进入结束状态类名",
      },
      {
        key: "leaveFromClass",
        label: "leave-from-class",
        type: "textarea",
        placeholder: '"custom-leave-from"',
        hint: "离开开始状态类名",
      },
      {
        key: "leaveActiveClass",
        label: "leave-active-class",
        type: "textarea",
        placeholder: '"custom-leave-active"',
        hint: "离开过程类名",
      },
      {
        key: "leaveToClass",
        label: "leave-to-class",
        type: "textarea",
        placeholder: '"custom-leave-to"',
        hint: "离开结束状态类名",
      },
      {
        key: "appearClass",
        label: "appear-class",
        type: "textarea",
        placeholder: '"custom-appear"',
        hint: "首次渲染开始状态类名",
      },
      {
        key: "appearActiveClass",
        label: "appear-active-class",
        type: "textarea",
        placeholder: '"custom-appear-active"',
        hint: "首次渲染过程类名",
      },
      {
        key: "appearToClass",
        label: "appear-to-class",
        type: "textarea",
        placeholder: '"custom-appear-to"',
        hint: "首次渲染结束状态类名",
      },
    ],
    events: [
      {
        key: "onBeforeEnter",
        label: "@before-enter",
        hint: "进入前钩子",
      },
      {
        key: "onEnter",
        label: "@enter",
        hint: "进入时钩子",
      },
      {
        key: "onAfterEnter",
        label: "@after-enter",
        hint: "进入后钩子",
      },
      {
        key: "onEnterCancelled",
        label: "@enter-cancelled",
        hint: "进入被取消钩子",
      },
      {
        key: "onBeforeLeave",
        label: "@before-leave",
        hint: "离开前钩子",
      },
      {
        key: "onLeave",
        label: "@leave",
        hint: "离开时钩子",
      },
      {
        key: "onAfterLeave",
        label: "@after-leave",
        hint: "离开后钩子",
      },
      {
        key: "onLeaveCancelled",
        label: "@leave-cancelled",
        hint: "离开被取消钩子",
      },
      {
        key: "onBeforeAppear",
        label: "@before-appear",
        hint: "首次渲染前钩子",
      },
      {
        key: "onAppear",
        label: "@appear",
        hint: "首次渲染时钩子",
      },
      {
        key: "onAfterAppear",
        label: "@after-appear",
        hint: "首次渲染后钩子",
      },
      {
        key: "onAppearCancelled",
        label: "@appear-cancelled",
        hint: "首次渲染被取消钩子",
      },
    ],
  },
  {
    key: "transitionGroup",
    name: "TransitionGroup",
    description: "列表元素的过渡动画",
    exclusive: "transition",
    props: [
      {
        key: "name",
        label: "过渡类名 (name)",
        type: "text",
        placeholder: '"list"',
        hint: "CSS 类名前缀",
      },
      {
        key: "tag",
        label: "容器标签 (tag)",
        type: "text",
        placeholder: '"div" / "ul"',
        hint: "渲染的容器元素标签",
      },
      {
        key: "appear",
        label: "初始渲染过渡 (appear)",
        type: "checkbox",
        hint: "首次渲染时也应用过渡",
      },
      {
        key: "moveClass",
        label: "移动过渡类名 (moveClass)",
        type: "text",
        placeholder: '"list-move"',
        hint: "元素移动时的过渡类名",
      },
      {
        key: "css",
        label: "启用 CSS (css)",
        type: "checkbox",
        hint: "是否使用 CSS 过渡（默认 true）",
      },
      {
        key: "type",
        label: "过渡类型 (type)",
        type: "select",
        options: [
          { label: "transition", value: '"transition"' },
          { label: "animation", value: '"animation"' },
        ],
        hint: "指定过渡类型。默认 transition",
      },
      {
        key: "duration",
        label: "持续时间 (duration)",
        type: "text",
        placeholder: "留空则自动检测，或 300 或 {enter: 300, leave: 200}",
        hint: "显式指定持续时间（毫秒）。默认等待根元素的第一个 transitionend 或 animationend 事件",
      },
      {
        key: "enterFromClass",
        label: "enter-from-class",
        type: "textarea",
        placeholder: '"custom-enter-from"',
        hint: "进入开始状态类名",
      },
      {
        key: "enterActiveClass",
        label: "enter-active-class",
        type: "textarea",
        placeholder: '"custom-enter-active"',
        hint: "进入过程类名",
      },
      {
        key: "enterToClass",
        label: "enter-to-class",
        type: "textarea",
        placeholder: '"custom-enter-to"',
        hint: "进入结束状态类名",
      },
      {
        key: "leaveFromClass",
        label: "leave-from-class",
        type: "textarea",
        placeholder: '"custom-leave-from"',
        hint: "离开开始状态类名",
      },
      {
        key: "leaveActiveClass",
        label: "leave-active-class",
        type: "textarea",
        placeholder: '"custom-leave-active"',
        hint: "离开过程类名",
      },
      {
        key: "leaveToClass",
        label: "leave-to-class",
        type: "textarea",
        placeholder: '"custom-leave-to"',
        hint: "离开结束状态类名",
      },
      {
        key: "appearClass",
        label: "appear-class",
        type: "textarea",
        placeholder: '"custom-appear"',
        hint: "首次渲染开始状态类名",
      },
      {
        key: "appearActiveClass",
        label: "appear-active-class",
        type: "textarea",
        placeholder: '"custom-appear-active"',
        hint: "首次渲染过程类名",
      },
      {
        key: "appearToClass",
        label: "appear-to-class",
        type: "textarea",
        placeholder: '"custom-appear-to"',
        hint: "首次渲染结束状态类名",
      },
    ],
    events: [
      {
        key: "onBeforeEnter",
        label: "@before-enter",
        hint: "进入前钩子",
      },
      {
        key: "onEnter",
        label: "@enter",
        hint: "进入时钩子",
      },
      {
        key: "onAfterEnter",
        label: "@after-enter",
        hint: "进入后钩子",
      },
      {
        key: "onEnterCancelled",
        label: "@enter-cancelled",
        hint: "进入被取消钩子",
      },
      {
        key: "onBeforeLeave",
        label: "@before-leave",
        hint: "离开前钩子",
      },
      {
        key: "onLeave",
        label: "@leave",
        hint: "离开时钩子",
      },
      {
        key: "onAfterLeave",
        label: "@after-leave",
        hint: "离开后钩子",
      },
      {
        key: "onLeaveCancelled",
        label: "@leave-cancelled",
        hint: "离开被取消钩子",
      },
      {
        key: "onBeforeAppear",
        label: "@before-appear",
        hint: "首次渲染前钩子",
      },
      {
        key: "onAppear",
        label: "@appear",
        hint: "首次渲染时钩子",
      },
      {
        key: "onAfterAppear",
        label: "@after-appear",
        hint: "首次渲染后钩子",
      },
      {
        key: "onAppearCancelled",
        label: "@appear-cancelled",
        hint: "首次渲染被取消钩子",
      },
    ],
  },
];

// 切换包装组件启用状态
const toggleWrapper = (key, exclusiveKey) => {
  ensureEnhanceStructure();
  const wrappers = nodeData.value.properties.wrappers;

  // 处理互斥关系
  if (!wrappers[key].enabled && exclusiveKey) {
    if (wrappers[exclusiveKey].enabled) {
      wrappers[exclusiveKey].enabled = false;
      // 清理互斥组件的 slot inputs
      cleanupWrapperSlots(exclusiveKey);
    }
  }

  // 如果要禁用当前组件，先清理其 slot inputs
  if (wrappers[key].enabled) {
    cleanupWrapperSlots(key);
  }

  wrappers[key].enabled = !wrappers[key].enabled;
};

// 清理 wrapper 组件的所有 slot inputs
const cleanupWrapperSlots = (wrapperName) => {
  if (!nodeData.value) return;

  const wrapper = nodeData.value.properties.wrappers?.[wrapperName];
  if (!wrapper || !wrapper.events) return;

  // 遍历所有事件，删除 isSlot 为 true 的对应 slot inputs
  Object.keys(wrapper.events).forEach((eventKey) => {
    const eventConfig = wrapper.events[eventKey];
    if (eventConfig && eventConfig.isSlot) {
      const slotName = `W#${wrapperName}#${eventKey}`;
      const slotIndex =
        nodeData.value.inputs?.findIndex((slot) => slot.name === slotName) ?? -1;

      if (slotIndex !== -1) {
        nodeData.value.removeInput(slotIndex);
      }

      // 重置 isSlot 状态
      eventConfig.isSlot = false;
    }
  });

  // 触发节点更新
  if (
    nodeData.value.onExecute &&
    typeof nodeData.value.onExecute === "function"
  ) {
    nodeData.value.onExecute();
  }
};

// 获取包装组件状态
const getWrapperState = (key) => {
  return computed(() => {
    return nodeData.value.properties.wrappers?.[key] || { enabled: false };
  });
};

// ========== Wrapper 事件 Slot 管理 ==========
// 更新 wrapper 事件的 isSlot 状态并管理对应的 slot
const updateWrapperEventSlot = (wrapperName, eventKey, isSlot) => {
  if (!nodeData.value) return;

  // 更新 isSlot 状态
  nodeData.value.properties.wrappers[wrapperName].events[eventKey].isSlot =
    isSlot;

  // 管理对应的 slot input
  const slotName = `W#${wrapperName}#${eventKey}`;
  const slotIndex =
    nodeData.value.inputs?.findIndex((slot) => slot.name === slotName) ?? -1;

  if (isSlot && slotIndex === -1) {
    // 启用 slot：添加输入 slot
    nodeData.value.addInput(slotName, "function", {
      shape: 5, // 函数形状
      meta: {
        args: [], // wrapper 事件参数，这里简化处理
      },
    });
  } else if (!isSlot && slotIndex !== -1) {
    // 禁用 slot：删除输入 slot
    nodeData.value.removeInput(slotIndex);
  }

  // 触发节点更新
  if (
    nodeData.value.onExecute &&
    typeof nodeData.value.onExecute === "function"
  ) {
    nodeData.value.onExecute();
  }
};

// 打开权限配置对话框
const openPermissionDialog = () => {
  ensurePermissionConfig(); // 确保配置结构存在
  permissionSync.ensureLoaded(); // 确保 store 已从项目加载

  const cfg = nodeData.value?.properties?.enhance?.permissionConfig;
  if (cfg) {
    // 打开时顺带做改名同步 + 回流对账（剔除 manager 里已删除的行）
    const curName = nodeData.value.properties?.label || nodeData.value.title || '未命名组件';
    if (cfg.componentName !== curName) {
      cfg.componentName = curName;
      permissionSync.renameComponent(cfg.id, curName);
    }
    permissionSync.reconcileComponent(cfg);
  }

  showPermissionDialog.value = true;
};

// 处理资源保存回调（ResourcePanel 已 upsert 到 store，这里刷新组件侧摘要）
const handleResourceSaved = () => {
  ensurePermissionConfig();
  const cfg = nodeData.value?.properties?.enhance?.permissionConfig;
  if (!cfg) return;

  permissionSync.reconcileComponent(cfg); // 用 store 现状重建 ownedRows
  cfg.lastUpdated = new Date().toISOString();
};

// ========== 编辑器预览配置 ==========
// 判断是否有编辑器配置
const hasEditorConfig = computed(() => {
  return !!nodeData.value?.nodeRawData?.meta?.editorConfig;
});

// 获取编辑器配置定义
const editorConfigDef = computed(() => {
  return nodeData.value?.nodeRawData?.meta?.editorConfig || {};
});
</script>

<template>
  <!-- 权限配置 -->
  <q-btn label="权限配置" dark dense outline :color="componentPermissionInfo?.ownedRows?.length ? 'positive' : 'grey-7'"
    class="full-width q-ma-md" @click="openPermissionDialog">
    <q-tooltip :delay="800">
      {{ componentPermissionInfo?.ownedRows?.length
        ? `已配置 ${componentPermissionInfo.ownedRows.length} 个权限资源行`
        : '配置组件的权限控制'
      }}
    </q-tooltip>
  </q-btn>

  <!-- 编辑器预览配置 -->
  <template v-if="hasEditorConfig">
    <div class="row items-center full-width q-ma-md">
      <span class="text-body2 text-weight-medium">编辑器预览</span>
    </div>
    <div v-for="(config, key) in editorConfigDef" :key="key" class="prop-item q-px-sm">
      <div class="row items-center no-wrap">
        <q-toggle v-model="nodeData.properties.enhance.editorConfig[key].enabled" dense dark />
        <q-input v-model="nodeData.properties.enhance.editorConfig[key].value" :label="config.desc_cn || key"
          :placeholder="config.default" dense dark borderless class="col q-ml-xs"
          :disable="!nodeData.properties.enhance.editorConfig[key].enabled" />
      </div>
    </div>
  </template>

  <!-- 行为附加区域 -->
  <div class="q-ma-md">
    <compBehaviorSection v-model="nodeData" />
  </div>

  <div class="row items-center full-width q-ma-md">
    <span class="text-body2 text-weight-medium">条件渲染</span>
  </div>
  <div>
    <div class="row q-gutter-xs q-mb-xs">
      <!-- v-if 按钮 -->
      <q-btn label="v-if" dark dense :color="nodeData.properties.wrappers?.vIf?.enabled ? 'primary' : 'grey-7'
        " :outline="!nodeData.properties.wrappers?.vIf?.enabled"
        :unelevated="nodeData.properties.wrappers?.vIf?.enabled" @click="toggleVIf" class="col">
        <q-tooltip :delay="800">
          {{
            nodeData.properties.wrappers?.vIf?.enabled
              ? "取消 v-if"
              : "启用 v-if（与 v-show 互斥）"
          }}
        </q-tooltip>
      </q-btn>

      <!-- v-show 按钮 -->
      <q-btn label="v-show" dark dense :color="nodeData.properties.wrappers?.vShow?.enabled ? 'primary' : 'grey-7'
        " :outline="!nodeData.properties.wrappers?.vShow?.enabled"
        :unelevated="nodeData.properties.wrappers?.vShow?.enabled" @click="toggleVShow" class="col">
        <q-tooltip :delay="800">
          {{
            nodeData.properties.wrappers?.vShow?.enabled
              ? "取消 v-show"
              : "启用 v-show（与 v-if 互斥）"
          }}
        </q-tooltip>
      </q-btn>
    </div>

    <!-- v-if 条件配置 -->
    <div v-if="nodeData.properties.wrappers?.vIf?.enabled">
      <div class="row items-start no-wrap">
        <q-toggle :model-value="nodeData.properties.wrappers.vIf.condition.isSlot"
          @update:model-value="(val) => updateConditionalRenderSlot('vIf', val)" dark dense color="primary"
          class="q-mt-sm" />
        <q-input :disable="nodeData.properties.wrappers.vIf.condition.isSlot"
          v-model="nodeData.properties.wrappers.vIf.condition.value" label="条件表达式" placeholder="如: isVisible, count > 0"
          type="textarea" rows="2" dense dark borderless class="col q-ml-xs">
          <q-tooltip anchor="center left" self="center right" :delay="1000">
            JavaScript 表达式
          </q-tooltip>
        </q-input>
      </div>
    </div>

    <!-- v-show 条件配置 -->
    <div v-if="nodeData.properties.wrappers?.vShow?.enabled">
      <div class="row items-start no-wrap">
        <q-toggle :model-value="nodeData.properties.wrappers.vShow.condition.isSlot" @update:model-value="
          (val) => updateConditionalRenderSlot('vShow', val)
        " dark dense color="primary" class="q-mt-sm" />
        <q-input :disable="nodeData.properties.wrappers.vShow.condition.isSlot"
          v-model="nodeData.properties.wrappers.vShow.condition.value" label="条件表达式" placeholder="如: showContent"
          type="textarea" rows="2" dense dark borderless class="col q-ml-xs">
          <q-tooltip anchor="center left" self="center right" :delay="1000">
            JavaScript 表达式
          </q-tooltip>
        </q-input>
      </div>
    </div>
  </div>

  <!-- ========== 包装组件区域 ========== -->

  <div class="row items-center full-width q-ma-md">
    <span class="text-body2 text-weight-medium">内置组件</span>
  </div>
  <div class="enhance-content">
    <div v-for="wrapperDef in wrappersDef" :key="wrapperDef.key">
      <div class="wrapper-header">
        <div class="row items-center no-wrap">
          <q-toggle :model-value="getWrapperState(wrapperDef.key).value.enabled" @update:model-value="
            toggleWrapper(wrapperDef.key, wrapperDef.exclusive)
            " dense dark class="q-mr-md" />
          <span class="text-caption text-weight-medium">{{
            wrapperDef.name
          }}</span>
          <q-space />
          <span class="text-caption text-grey-6">{{
            wrapperDef.description
          }}</span>
        </div>
      </div>

      <!-- 组件配置 -->
      <div v-if="getWrapperState(wrapperDef.key).value.enabled" class="wrapper-props">
        <!-- 属性配置 -->
        <template v-if="wrapperDef.props">
          <div v-for="propDef in wrapperDef.props" :key="propDef.key" class="prop-item">
            <!-- 文本输入 -->
            <template v-if="propDef.type === 'text'">
              <q-input v-model="nodeData.properties.wrappers[wrapperDef.key][propDef.key]
                " :label="propDef.label" :placeholder="propDef.placeholder" dense dark borderless class="col">
                <q-tooltip v-if="propDef.hint" anchor="center left" self="center right" :delay="1000">
                  {{ propDef.hint }}
                </q-tooltip>
              </q-input>
            </template>

            <!-- 多行文本输入 -->
            <template v-else-if="propDef.type === 'textarea'">
              <q-input v-model="nodeData.properties.wrappers[wrapperDef.key][propDef.key]
                " :label="propDef.label" :placeholder="propDef.placeholder" type="textarea" rows="2" dense dark
                borderless class="col">
                <q-tooltip v-if="propDef.hint" anchor="center left" self="center right" :delay="1000">
                  {{ propDef.hint }}
                </q-tooltip>
              </q-input>
            </template>

            <!-- 数字输入 -->
            <template v-else-if="propDef.type === 'number'">
              <q-input v-model.number="nodeData.properties.wrappers[wrapperDef.key][propDef.key]
                " :label="propDef.label" :placeholder="propDef.placeholder" type="number" dense dark borderless
                class="col">
                <q-tooltip v-if="propDef.hint" anchor="center left" self="center right" :delay="1000">
                  {{ propDef.hint }}
                </q-tooltip>
              </q-input>
            </template>

            <!-- 复选框 -->
            <template v-else-if="propDef.type === 'checkbox'">
              <q-checkbox v-model="nodeData.properties.wrappers[wrapperDef.key][propDef.key]
                " :label="propDef.label" dense dark class="col">
                <q-tooltip v-if="propDef.hint" anchor="center left" self="center right" :delay="1000">
                  {{ propDef.hint }}
                </q-tooltip>
              </q-checkbox>
            </template>

            <!-- 下拉选择 -->
            <template v-else-if="propDef.type === 'select'">
              <q-select v-model="nodeData.properties.wrappers[wrapperDef.key][propDef.key]
                " :label="propDef.label" :options="propDef.options" dense dark borderless emit-value map-options
                class="col">
                <q-tooltip v-if="propDef.hint" anchor="center left" self="center right" :delay="1000">
                  {{ propDef.hint }}
                </q-tooltip>
              </q-select>
            </template>
          </div>
        </template>

        <!-- 插槽配置 -->
        <template v-if="wrapperDef.slots">
          <div class="text-caption text-grey-5 q-mb-xs q-ml-xs q-mt-sm">
            插槽 (Slots)
          </div>
          <div v-for="slotDef in wrapperDef.slots" :key="slotDef.key" class="prop-item">
            <q-input v-model="nodeData.properties.wrappers[wrapperDef.key].slots[slotDef.key]
              " :label="slotDef.label" type="textarea" rows="2" dense dark borderless class="col">
              <q-tooltip v-if="slotDef.hint" anchor="center left" self="center right" :delay="1000">
                {{ slotDef.hint }}
              </q-tooltip>
            </q-input>
          </div>
        </template>

        <!-- 事件配置 -->
        <template v-if="wrapperDef.events">
          <div class="text-caption text-grey-5 q-mb-xs q-ml-xs q-mt-sm">
            事件 (Events)
          </div>
          <div v-for="eventDef in wrapperDef.events" :key="eventDef.key" class="prop-item">
            <div class="row items-start no-wrap">
              <q-toggle :model-value="nodeData.properties.wrappers[wrapperDef.key].events[
                eventDef.key
              ].isSlot
                " @update:model-value="
                  (val) =>
                    updateWrapperEventSlot(wrapperDef.key, eventDef.key, val)
                " dark dense color="primary" class="q-mt-sm" />
              <q-input :disable="nodeData.properties.wrappers[wrapperDef.key].events[
                eventDef.key
              ].isSlot
                " v-model="nodeData.properties.wrappers[wrapperDef.key].events[
                  eventDef.key
                ].value
                  " :label="eventDef.label" placeholder="函数名或表达式" dense dark borderless class="col q-ml-xs">
                <q-tooltip v-if="eventDef.hint" anchor="center left" self="center right" :delay="1000">
                  {{ eventDef.hint }}
                </q-tooltip>
              </q-input>
            </div>
          </div>
        </template>
      </div>
    </div>
  </div>

  <!-- 权限配置对话框 -->
  <q-dialog v-model="showPermissionDialog" persistent dark>
    <q-card dark class="bg-grey-10" style="width: 66vw; height: 66vh; max-width: 90vw;">
      <q-bar dense dark class="bg-grey-9">
        <q-icon name="security" />
        <div class="text-subtitle2 q-ml-sm">资源注册 - {{ nodeData?.properties?.label || nodeData?.title || '组件' }}</div>
        <q-space />
        <q-btn flat dense round icon="close" @click="showPermissionDialog = false">
          <q-tooltip>关闭</q-tooltip>
        </q-btn>
      </q-bar>

      <q-card-section class="q-pa-none" style="height: calc(100% - 40px)">
        <ResourcePanel :component-info="componentPermissionInfo" @resource-saved="handleResourceSaved" />
      </q-card-section>
    </q-card>
  </q-dialog>
</template>

<style scoped>
/* 包装组件头部 */
.wrapper-header {
  padding: 4px 8px;
  min-height: 32px;
}

/* 包装组件属性区域 */
.wrapper-props {
  padding: 2px 8px 4px 8px;
}

/* 属性项 */
.prop-item {
  padding: 4px 0;
  margin-bottom: 2px;
  min-height: 32px;
}

/* 深色主题优化 - 与 compPropertyPanel 保持一致 */
.comp-enhance-panel :deep(.q-input),
.comp-enhance-panel :deep(.q-select) {
  font-size: 0.875em;
}

.comp-enhance-panel :deep(.q-field__label) {
  font-size: 0.8em;
}

/* 输入框样式增强 - 提高可识别性 */
:deep(.q-field--dark .q-field__control) {
  background-color: rgba(255, 255, 255, 0.05);
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.1);
}

:deep(.q-field--dark .q-field__control:hover) {
  background-color: rgba(255, 255, 255, 0.07);
  border-color: rgba(255, 255, 255, 0.15);
}

:deep(.q-field--dark.q-field--focused .q-field__control) {
  background-color: rgba(255, 255, 255, 0.08);
  border-color: var(--q-primary);
}

/* Textarea 特殊样式 */
:deep(.q-field--dark .q-field__control textarea) {
  padding: 4px 8px;
}

/* 按钮统一大小 */
.comp-enhance-panel :deep(.q-btn) {
  min-height: 28px;
  font-size: 0.8em;
}

/* Checkbox 和 Toggle 统一对齐 */
.comp-enhance-panel :deep(.q-checkbox),
.comp-enhance-panel :deep(.q-toggle) {
  margin: 0;
}

/* 移除不必要的间距 */
.comp-enhance-panel :deep(.q-gutter-xs > *) {
  margin-left: 0 !important;
}

.comp-enhance-panel :deep(.q-gutter-xs > * + *) {
  margin-left: 4px !important;
}
</style>
