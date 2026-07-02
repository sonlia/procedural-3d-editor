import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineUseAsyncState extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `asyncState_${uid().slice(0, 8)}` },

      // Hook 参数
      promise: { id: uid(), isSlot: true, value: "" },
      initialState: { id: uid(), isSlot: false, value: "" },

      // 选项
      immediate: true,
      delay: { id: uid(), isSlot: false, value: "" },
      resetOnExecute: true,
      shallow: false,
      throwError: false,
    };

    // promise 函数 slot
    this.addInput("promise", "function", {
      id: this.properties.promise.id,
      shape: 5,
      meta: { args: [] },
    });

    this.addOutput("outValue", "string");
    this.addOutput("state", "string");
    this.addOutput("isReady", "string");
    this.addOutput("isLoading", "string");
    this.addOutput("error", "string");
    this.addOutput("execute", "string");
    this.uiPanel = defineAsyncComponent(() => import("./utilsPanel.vue"));
  }

  onExecute() {
    const props = this.properties;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 处理变量名三元组
    let declVar, declPrefix = "";
    if (props.outputVar?.isSlot) {
      declVar = getParamValue(props.outputVar) || `asyncState_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `asyncState_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 promise 函数
    let promiseCode = "() => Promise.resolve(null)";
    const promiseSlot = this.inputs.find((s) => s.id === props.promise.id);
    if (promiseSlot) {
      const promiseSlotIndex = this.inputs.indexOf(promiseSlot);
      if (this.isInputConnected(promiseSlotIndex) && this.inputs[promiseSlotIndex].link && this.graph) {
        const linkInfo = this.graph.links[this.inputs[promiseSlotIndex].link];
        if (linkInfo) {
          const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
          if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
            promiseCode = `__FUNC_${sourceNode.id}__`;
          }
        }
      }
    }

    // 获取初始状态
    const initialState = getParamValue(props.initialState) || "null";

    // 构建选项
    const options = [];
    if (!props.immediate) options.push("immediate: false");
    const delay = getParamValue(props.delay);
    if (delay) options.push(`delay: ${delay}`);
    if (!props.resetOnExecute) options.push("resetOnExecute: false");
    if (props.shallow) options.push("shallow: true");
    if (props.throwError) options.push("throwError: true");

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useAsyncState } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ state: ${declVar}State, isReady: ${declVar}IsReady, isLoading: ${declVar}IsLoading, error: ${declVar}Error, execute: ${declVar}Execute } = useAsyncState(${promiseCode}, ${initialState}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("state"), `${declVar}State`);
    this.setOutputData(this.findOutputSlot("isReady"), `${declVar}IsReady`);
    this.setOutputData(this.findOutputSlot("isLoading"), `${declVar}IsLoading`);
    this.setOutputData(this.findOutputSlot("error"), `${declVar}Error`);
    this.setOutputData(this.findOutputSlot("execute"), `${declVar}Execute`);
  }

  static get id() { return "vueuse-useasyncstate-e8f9a0b1-c2d3-4567-8901-234567890123"; }
  static get title() { return "useAsyncState"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Utilities"; }
}

export class defineUseClamp extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `clamped_${uid().slice(0, 8)}` },

      // Hook 参数
      value: { id: uid(), isSlot: true, value: "" },
      min: { id: uid(), isSlot: false, value: "0" },
      max: { id: uid(), isSlot: false, value: "100" },
    };

    // value slot
    this.addInput("value", "string", { id: this.properties.value.id });

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./utilsPanel.vue"));
  }

  onExecute() {
    const props = this.properties;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 处理变量名三元组
    let declVar, declPrefix = "";
    if (props.outputVar?.isSlot) {
      declVar = getParamValue(props.outputVar) || `clamped_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `clamped_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取参数
    const value = getParamValue(props.value);
    const min = getParamValue(props.min) || "0";
    const max = getParamValue(props.max) || "100";

    if (!value) {
      this.jsCode = `// useClamp: value is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      return;
    }

    // 生成代码
    this.importStr = `import { useClamp } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}${declVar} = useClamp(${value}, ${min}, ${max});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get id() { return "vueuse-useclamp-f9a0b1c2-d3e4-5678-9012-345678901234"; }
  static get title() { return "useClamp"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Utilities"; }
}

export class defineCreateSharedComposable extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `shared_${uid().slice(0, 8)}` },

      // Hook 参数
      composable: { id: uid(), isSlot: true, value: "" },
    };

    // composable 函数 slot
    this.addInput("composable", "function", {
      id: this.properties.composable.id,
      shape: 5,
      meta: { args: [] },
    });

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./utilsPanel.vue"));
  }

  onExecute() {
    const props = this.properties;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 处理变量名三元组
    let declVar, declPrefix = "";
    if (props.outputVar?.isSlot) {
      declVar = getParamValue(props.outputVar) || `shared_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `shared_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 composable 函数
    let composableCode = "() => ({})";
    const composableSlot = this.inputs.find((s) => s.id === props.composable.id);
    if (composableSlot) {
      const composableSlotIndex = this.inputs.indexOf(composableSlot);
      if (this.isInputConnected(composableSlotIndex) && this.inputs[composableSlotIndex].link && this.graph) {
        const linkInfo = this.graph.links[this.inputs[composableSlotIndex].link];
        if (linkInfo) {
          const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
          if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
            composableCode = `__FUNC_${sourceNode.id}__`;
          }
        }
      }
    }

    // 生成代码
    this.importStr = `import { createSharedComposable } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}${declVar} = createSharedComposable(${composableCode});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get id() { return "vueuse-createsharedcomposable-a0b1c2d3-e4f5-6789-0123-456789012345"; }
  static get title() { return "createSharedComposable"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Utilities"; }
}
