import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineUseRafFn extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // Hook 参数
      fn: { id: uid(), isSlot: true, value: "" },

      // 选项
      immediate: true,
      fpsLimit: { id: uid(), isSlot: false, value: "" },
    };

    // 函数参数 slot
    this.addInput("fn", "function", {
      id: this.properties.fn.id,
      shape: 5,
      meta: { args: ["delta"] },
    });

    this.addOutput("pause", "string");
    this.addOutput("resume", "string");
    this.addOutput("isActive", "string");
    this.uiPanel = defineAsyncComponent(() => import("./animationPanel.vue"));
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

    // 构建选项
    const options = [];
    if (!props.immediate) options.push("immediate: false");
    const fpsLimit = getParamValue(props.fpsLimit);
    if (fpsLimit) options.push(`fpsLimit: ${fpsLimit}`);

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useRafFn } from '@vueuse/core';`;
    const varPrefix = `raf_${uid().slice(0, 8)}`;
    this.jsCode = `const { pause: ${varPrefix}Pause, resume: ${varPrefix}Resume, isActive: ${varPrefix}IsActive } = useRafFn(${fnCode}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("pause"), `${varPrefix}Pause`);
    this.setOutputData(this.findOutputSlot("resume"), `${varPrefix}Resume`);
    this.setOutputData(this.findOutputSlot("isActive"), `${varPrefix}IsActive`);
  }

  static get id() { return "vueuse-useraffn-c6d7e8f9-a0b1-2345-6789-012345678901"; }
  static get title() { return "useRafFn"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Animation"; }
}

export class defineUseTransition extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `transition_${uid().slice(0, 8)}` },

      // Hook 参数
      source: { id: uid(), isSlot: true, value: "" },

      // 选项
      duration: { id: uid(), isSlot: false, value: "1000" },
      transition: "linear",
      delay: { id: uid(), isSlot: false, value: "" },
      disabled: false,
    };

    // source slot
    this.addInput("source", "string", { id: this.properties.source.id });

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./animationPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `transition_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `transition_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 source
    const source = getParamValue(props.source);

    if (!source) {
      this.jsCode = `// useTransition: source is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      return;
    }

    // 构建选项
    const options = [];
    const duration = getParamValue(props.duration);
    const delay = getParamValue(props.delay);
    if (duration && duration !== "1000") options.push(`duration: ${duration}`);
    if (props.transition !== "linear") options.push(`transition: TransitionPresets.${props.transition}`);
    if (delay) options.push(`delay: ${delay}`);
    if (props.disabled) options.push("disabled: true");

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    const needsPresets = props.transition !== "linear";
    this.importStr = needsPresets
      ? `import { useTransition, TransitionPresets } from '@vueuse/core';`
      : `import { useTransition } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}${declVar} = useTransition(${source}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get id() { return "vueuse-usetransition-d7e8f9a0-b1c2-3456-7890-123456789012"; }
  static get title() { return "useTransition"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Animation"; }
}
