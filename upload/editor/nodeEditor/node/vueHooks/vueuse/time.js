import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineUseDebounceFn extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `debounced_${uid().slice(0, 8)}` },

      // Hook 参数
      fn: { id: uid(), isSlot: true, value: "" },
      ms: { id: uid(), isSlot: false, value: "200" },

      // 选项
      maxWait: { id: uid(), isSlot: false, value: "" },
      rejectOnCancel: false,
    };

    // 函数参数 slot
    this.addInput("fn", "function", {
      id: this.properties.fn.id,
      shape: 5,
      meta: { args: [] },
    });

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./timePanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `debounced_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `debounced_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取函数参数（检查是否连接了 FunctionBlock）
    let fnCode = "() => {}";
    const fnSlot = this.inputs.find((s) => s.id === props.fn.id);
    if (fnSlot) {
      const fnSlotIndex = this.inputs.indexOf(fnSlot);
      if (this.isInputConnected(fnSlotIndex) && this.inputs[fnSlotIndex].link && this.graph) {
        const linkInfo = this.graph.links[this.inputs[fnSlotIndex].link];
        if (linkInfo) {
          const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
          if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
            fnCode = `__FUNC_${sourceNode.id}__`;
          }
        }
      }
    }

    const ms = getParamValue(props.ms) || "200";
    const maxWait = getParamValue(props.maxWait);

    // 构建选项
    const options = [];
    if (maxWait) options.push(`maxWait: ${maxWait}`);
    if (props.rejectOnCancel) options.push("rejectOnCancel: true");

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useDebounceFn } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}${declVar} = useDebounceFn(${fnCode}, ${ms}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get id() { return "vueuse-usedebouncefn-c3d4e5f6-a7b8-9012-cdef-345678901234"; }
  static get title() { return "useDebounceFn"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Time"; }
}

export class defineUseThrottleFn extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `throttled_${uid().slice(0, 8)}` },

      // Hook 参数
      fn: { id: uid(), isSlot: true, value: "" },
      ms: { id: uid(), isSlot: false, value: "200" },

      // 选项
      trailing: true,
      leading: true,
      rejectOnCancel: false,
    };

    // 函数参数 slot
    this.addInput("fn", "function", {
      id: this.properties.fn.id,
      shape: 5,
      meta: { args: [] },
    });

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./timePanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `throttled_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `throttled_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取函数参数
    let fnCode = "() => {}";
    const fnSlot = this.inputs.find((s) => s.id === props.fn.id);
    if (fnSlot) {
      const fnSlotIndex = this.inputs.indexOf(fnSlot);
      if (this.isInputConnected(fnSlotIndex) && this.inputs[fnSlotIndex].link && this.graph) {
        const linkInfo = this.graph.links[this.inputs[fnSlotIndex].link];
        if (linkInfo) {
          const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
          if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
            fnCode = `__FUNC_${sourceNode.id}__`;
          }
        }
      }
    }

    const ms = getParamValue(props.ms) || "200";

    // 构建选项
    const options = [];
    if (!props.trailing) options.push("trailing: false");
    if (!props.leading) options.push("leading: false");
    if (props.rejectOnCancel) options.push("rejectOnCancel: true");

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useThrottleFn } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}${declVar} = useThrottleFn(${fnCode}, ${ms}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get id() { return "vueuse-usethrottlefn-d4e5f6a7-b8c9-0123-def0-456789012345"; }
  static get title() { return "useThrottleFn"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Time"; }
}

export class defineUseTimeoutFn extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `timeout_${uid().slice(0, 8)}` },

      // Hook 参数
      fn: { id: uid(), isSlot: true, value: "" },
      ms: { id: uid(), isSlot: false, value: "1000" },

      // 选项
      immediate: true,
    };

    // 函数参数 slot
    this.addInput("fn", "function", {
      id: this.properties.fn.id,
      shape: 5,
      meta: { args: [] },
    });

    this.addOutput("outValue", "string");
    this.addOutput("isPending", "string");
    this.uiPanel = defineAsyncComponent(() => import("./timePanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `timeout_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `timeout_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取函数参数
    let fnCode = "() => {}";
    const fnSlot = this.inputs.find((s) => s.id === props.fn.id);
    if (fnSlot) {
      const fnSlotIndex = this.inputs.indexOf(fnSlot);
      if (this.isInputConnected(fnSlotIndex) && this.inputs[fnSlotIndex].link && this.graph) {
        const linkInfo = this.graph.links[this.inputs[fnSlotIndex].link];
        if (linkInfo) {
          const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
          if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
            fnCode = `__FUNC_${sourceNode.id}__`;
          }
        }
      }
    }

    const ms = getParamValue(props.ms) || "1000";

    // 构建选项
    const options = [];
    if (!props.immediate) options.push("immediate: false");

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useTimeoutFn } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ isPending: ${declVar}Pending, start: ${declVar}Start, stop: ${declVar}Stop } = useTimeoutFn(${fnCode}, ${ms}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("isPending"), `${declVar}Pending`);
  }

  static get id() { return "vueuse-usetimeoutfn-e5f6a7b8-c9d0-1234-ef01-567890123456"; }
  static get title() { return "useTimeoutFn"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Time"; }
}

export class defineUseIntervalFn extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `interval_${uid().slice(0, 8)}` },

      // Hook 参数
      fn: { id: uid(), isSlot: true, value: "" },
      ms: { id: uid(), isSlot: false, value: "1000" },

      // 选项
      immediate: true,
      immediateCallback: false,
    };

    // 函数参数 slot
    this.addInput("fn", "function", {
      id: this.properties.fn.id,
      shape: 5,
      meta: { args: [] },
    });

    this.addOutput("outValue", "string");
    this.addOutput("isActive", "string");
    this.uiPanel = defineAsyncComponent(() => import("./timePanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `interval_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `interval_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取函数参数
    let fnCode = "() => {}";
    const fnSlot = this.inputs.find((s) => s.id === props.fn.id);
    if (fnSlot) {
      const fnSlotIndex = this.inputs.indexOf(fnSlot);
      if (this.isInputConnected(fnSlotIndex) && this.inputs[fnSlotIndex].link && this.graph) {
        const linkInfo = this.graph.links[this.inputs[fnSlotIndex].link];
        if (linkInfo) {
          const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
          if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
            fnCode = `__FUNC_${sourceNode.id}__`;
          }
        }
      }
    }

    const ms = getParamValue(props.ms) || "1000";

    // 构建选项
    const options = [];
    if (!props.immediate) options.push("immediate: false");
    if (props.immediateCallback) options.push("immediateCallback: true");

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useIntervalFn } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ isActive: ${declVar}Active, pause: ${declVar}Pause, resume: ${declVar}Resume } = useIntervalFn(${fnCode}, ${ms}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("isActive"), `${declVar}Active`);
  }

  static get id() { return "vueuse-useintervalfn-f6a7b8c9-d0e1-2345-f012-678901234567"; }
  static get title() { return "useIntervalFn"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Time"; }
}
