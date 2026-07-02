import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineOnClickOutside extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // Hook 参数
      target: { id: uid(), isSlot: true, value: "" },
      handler: { id: uid(), isSlot: true, value: "" },

      // 选项
      ignore: { id: uid(), isSlot: false, value: "" },
      capture: false,
      detectIframe: false,
    };

    // target slot
    this.addInput("target", "string", { id: this.properties.target.id });

    // handler 函数 slot
    this.addInput("handler", "function", {
      id: this.properties.handler.id,
      shape: 5,
      meta: { args: ["event"] },
    });

    this.addOutput("stop", "string");
    this.uiPanel = defineAsyncComponent(() => import("./domPanel.vue"));
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

    // 获取 target
    const target = getParamValue(props.target);

    // 获取 handler 函数
    let handlerCode = "() => {}";
    const handlerSlot = this.inputs.find((s) => s.id === props.handler.id);
    if (handlerSlot) {
      const handlerSlotIndex = this.inputs.indexOf(handlerSlot);
      if (this.isInputConnected(handlerSlotIndex) && this.inputs[handlerSlotIndex].link && this.graph) {
        const linkInfo = this.graph.links[this.inputs[handlerSlotIndex].link];
        if (linkInfo) {
          const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
          if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
            handlerCode = `__FUNC_${sourceNode.id}__`;
          }
        }
      }
    }

    if (!target) {
      this.jsCode = `// onClickOutside: target is required`;
      this.setOutputData(this.findOutputSlot("stop"), "undefined");
      return;
    }

    // 构建选项
    const options = [];
    const ignore = getParamValue(props.ignore);
    if (ignore) options.push(`ignore: ${ignore}`);
    if (props.capture) options.push("capture: true");
    if (props.detectIframe) options.push("detectIframe: true");

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { onClickOutside } from '@vueuse/core';`;
    const stopVar = `stop_${uid().slice(0, 8)}`;
    this.jsCode = `const ${stopVar} = onClickOutside(${target}, ${handlerCode}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("stop"), stopVar);
  }

  static get id() { return "vueuse-onclickoutside-a7b8c9d0-e1f2-3456-7890-abcdef123456"; }
  static get title() { return "onClickOutside"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/DOM"; }
}

export class defineUseElementSize extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `size_${uid().slice(0, 8)}` },

      // Hook 参数
      target: { id: uid(), isSlot: true, value: "" },

      // 选项
      initialWidth: { id: uid(), isSlot: false, value: "" },
      initialHeight: { id: uid(), isSlot: false, value: "" },
      box: "content-box",
    };

    // target slot
    this.addInput("target", "string", { id: this.properties.target.id });

    this.addOutput("outValue", "string");
    this.addOutput("width", "string");
    this.addOutput("height", "string");
    this.uiPanel = defineAsyncComponent(() => import("./domPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `size_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `size_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 target
    const target = getParamValue(props.target);

    if (!target) {
      this.jsCode = `// useElementSize: target is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      this.setOutputData(this.findOutputSlot("width"), "undefined");
      this.setOutputData(this.findOutputSlot("height"), "undefined");
      return;
    }

    // 构建选项
    const options = [];
    const initialWidth = getParamValue(props.initialWidth);
    const initialHeight = getParamValue(props.initialHeight);
    if (initialWidth) options.push(`initialWidth: ${initialWidth}`);
    if (initialHeight) options.push(`initialHeight: ${initialHeight}`);
    if (props.box !== "content-box") options.push(`box: '${props.box}'`);

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useElementSize } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ width: ${declVar}Width, height: ${declVar}Height } = useElementSize(${target}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("width"), `${declVar}Width`);
    this.setOutputData(this.findOutputSlot("height"), `${declVar}Height`);
  }

  static get id() { return "vueuse-useelementsize-b8c9d0e1-f2a3-4567-8901-bcdef2345678"; }
  static get title() { return "useElementSize"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/DOM"; }
}

export class defineUseDraggable extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `drag_${uid().slice(0, 8)}` },

      // Hook 参数
      target: { id: uid(), isSlot: true, value: "" },

      // 选项
      exact: false,
      preventDefault: false,
      stopPropagation: false,
      pointerTypes: "mouse,touch,pen",
      initialX: { id: uid(), isSlot: false, value: "" },
      initialY: { id: uid(), isSlot: false, value: "" },
      handle: { id: uid(), isSlot: false, value: "" },
      axis: "both",
    };

    // target slot
    this.addInput("target", "string", { id: this.properties.target.id });

    this.addOutput("outValue", "string");
    this.addOutput("x", "string");
    this.addOutput("y", "string");
    this.addOutput("isDragging", "string");
    this.uiPanel = defineAsyncComponent(() => import("./domPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `drag_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `drag_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 target
    const target = getParamValue(props.target);

    if (!target) {
      this.jsCode = `// useDraggable: target is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      this.setOutputData(this.findOutputSlot("x"), "undefined");
      this.setOutputData(this.findOutputSlot("y"), "undefined");
      this.setOutputData(this.findOutputSlot("isDragging"), "undefined");
      return;
    }

    // 构建选项
    const options = [];
    if (props.exact) options.push("exact: true");
    if (props.preventDefault) options.push("preventDefault: true");
    if (props.stopPropagation) options.push("stopPropagation: true");
    if (props.pointerTypes !== "mouse,touch,pen") {
      const types = props.pointerTypes.split(",").map(t => `'${t.trim()}'`).join(", ");
      options.push(`pointerTypes: [${types}]`);
    }
    const initialX = getParamValue(props.initialX);
    const initialY = getParamValue(props.initialY);
    if (initialX) options.push(`initialValue: { x: ${initialX}, y: ${initialY || 0} }`);
    const handle = getParamValue(props.handle);
    if (handle) options.push(`handle: ${handle}`);
    if (props.axis !== "both") options.push(`axis: '${props.axis}'`);

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useDraggable } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ x: ${declVar}X, y: ${declVar}Y, isDragging: ${declVar}Dragging, style: ${declVar}Style } = useDraggable(${target}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("x"), `${declVar}X`);
    this.setOutputData(this.findOutputSlot("y"), `${declVar}Y`);
    this.setOutputData(this.findOutputSlot("isDragging"), `${declVar}Dragging`);
  }

  static get id() { return "vueuse-usedraggable-c9d0e1f2-a3b4-5678-9012-cdef34567890"; }
  static get title() { return "useDraggable"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/DOM"; }
}
