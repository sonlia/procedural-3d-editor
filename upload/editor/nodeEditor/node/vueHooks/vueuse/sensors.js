import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineUseMouse extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `mouse_${uid().slice(0, 8)}` },

      // 选项
      type: "page",
      touch: true,
      resetOnTouchEnds: false,
      initialValue: { x: "", y: "" },
    };

    this.addOutput("outValue", "string");
    this.addOutput("x", "string");
    this.addOutput("y", "string");
    this.addOutput("sourceType", "string");
    this.uiPanel = defineAsyncComponent(() => import("./sensorPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `mouse_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `mouse_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 构建选项
    const options = [];
    if (props.type !== "page") options.push(`type: '${props.type}'`);
    if (!props.touch) options.push("touch: false");
    if (props.resetOnTouchEnds) options.push("resetOnTouchEnds: true");
    if (props.initialValue?.x || props.initialValue?.y) {
      const x = props.initialValue.x || "0";
      const y = props.initialValue.y || "0";
      options.push(`initialValue: { x: ${x}, y: ${y} }`);
    }

    const optionsStr = options.length > 0 ? `{ ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useMouse } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ x: ${declVar}X, y: ${declVar}Y, sourceType: ${declVar}SourceType } = useMouse(${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("x"), `${declVar}X`);
    this.setOutputData(this.findOutputSlot("y"), `${declVar}Y`);
    this.setOutputData(this.findOutputSlot("sourceType"), `${declVar}SourceType`);
  }

  static get id() { return "vueuse-usemouse-a8b9c0d1-e2f3-4567-8901-abcdef234567"; }
  static get title() { return "useMouse"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Sensors"; }
}

export class defineUseScroll extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `scroll_${uid().slice(0, 8)}` },

      // Hook 参数
      target: { id: uid(), isSlot: true, value: "" },

      // 选项
      throttle: { id: uid(), isSlot: false, value: "" },
      idle: { id: uid(), isSlot: false, value: "" },
      offset: { left: "", right: "", top: "", bottom: "" },
      behavior: "auto",
    };

    // target slot
    this.addInput("target", "string", { id: this.properties.target.id });

    this.addOutput("outValue", "string");
    this.addOutput("x", "string");
    this.addOutput("y", "string");
    this.addOutput("isScrolling", "string");
    this.addOutput("arrivedState", "string");
    this.addOutput("directions", "string");
    this.uiPanel = defineAsyncComponent(() => import("./sensorPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `scroll_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `scroll_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 target
    const target = getParamValue(props.target) || "window";

    // 构建选项
    const options = [];
    const throttle = getParamValue(props.throttle);
    const idle = getParamValue(props.idle);
    if (throttle) options.push(`throttle: ${throttle}`);
    if (idle) options.push(`idle: ${idle}`);
    if (props.behavior !== "auto") options.push(`behavior: '${props.behavior}'`);

    // offset
    const { left, right, top, bottom } = props.offset || {};
    if (left || right || top || bottom) {
      const offsetParts = [];
      if (left) offsetParts.push(`left: ${left}`);
      if (right) offsetParts.push(`right: ${right}`);
      if (top) offsetParts.push(`top: ${top}`);
      if (bottom) offsetParts.push(`bottom: ${bottom}`);
      options.push(`offset: { ${offsetParts.join(", ")} }`);
    }

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useScroll } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ x: ${declVar}X, y: ${declVar}Y, isScrolling: ${declVar}IsScrolling, arrivedState: ${declVar}ArrivedState, directions: ${declVar}Directions } = useScroll(${target}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("x"), `${declVar}X`);
    this.setOutputData(this.findOutputSlot("y"), `${declVar}Y`);
    this.setOutputData(this.findOutputSlot("isScrolling"), `${declVar}IsScrolling`);
    this.setOutputData(this.findOutputSlot("arrivedState"), `${declVar}ArrivedState`);
    this.setOutputData(this.findOutputSlot("directions"), `${declVar}Directions`);
  }

  static get id() { return "vueuse-usescroll-b9c0d1e2-f3a4-5678-9012-bcdef3456789"; }
  static get title() { return "useScroll"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Sensors"; }
}

export class defineUseGeolocation extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `geo_${uid().slice(0, 8)}` },

      // 选项
      enableHighAccuracy: true,
      maximumAge: { id: uid(), isSlot: false, value: "" },
      timeout: { id: uid(), isSlot: false, value: "" },
      immediate: true,
    };

    this.addOutput("outValue", "string");
    this.addOutput("coords", "string");
    this.addOutput("locatedAt", "string");
    this.addOutput("error", "string");
    this.addOutput("resume", "string");
    this.addOutput("pause", "string");
    this.uiPanel = defineAsyncComponent(() => import("./sensorPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `geo_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `geo_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 构建选项
    const options = [];
    if (!props.enableHighAccuracy) options.push("enableHighAccuracy: false");
    const maximumAge = getParamValue(props.maximumAge);
    const timeout = getParamValue(props.timeout);
    if (maximumAge) options.push(`maximumAge: ${maximumAge}`);
    if (timeout) options.push(`timeout: ${timeout}`);
    if (!props.immediate) options.push("immediate: false");

    const optionsStr = options.length > 0 ? `{ ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useGeolocation } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ coords: ${declVar}Coords, locatedAt: ${declVar}LocatedAt, error: ${declVar}Error, resume: ${declVar}Resume, pause: ${declVar}Pause } = useGeolocation(${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("coords"), `${declVar}Coords`);
    this.setOutputData(this.findOutputSlot("locatedAt"), `${declVar}LocatedAt`);
    this.setOutputData(this.findOutputSlot("error"), `${declVar}Error`);
    this.setOutputData(this.findOutputSlot("resume"), `${declVar}Resume`);
    this.setOutputData(this.findOutputSlot("pause"), `${declVar}Pause`);
  }

  static get id() { return "vueuse-usegeolocation-c0d1e2f3-a4b5-6789-0123-cdef45678901"; }
  static get title() { return "useGeolocation"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Sensors"; }
}

export class defineUseNetwork extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `network_${uid().slice(0, 8)}` },
    };

    this.addOutput("outValue", "string");
    this.addOutput("isOnline", "string");
    this.addOutput("offlineAt", "string");
    this.addOutput("onlineAt", "string");
    this.addOutput("downlink", "string");
    this.addOutput("effectiveType", "string");
    this.addOutput("type", "string");
    this.uiPanel = defineAsyncComponent(() => import("./sensorPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `network_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `network_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 生成代码
    this.importStr = `import { useNetwork } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ isOnline: ${declVar}IsOnline, offlineAt: ${declVar}OfflineAt, onlineAt: ${declVar}OnlineAt, downlink: ${declVar}Downlink, effectiveType: ${declVar}EffectiveType, type: ${declVar}Type } = useNetwork();`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("isOnline"), `${declVar}IsOnline`);
    this.setOutputData(this.findOutputSlot("offlineAt"), `${declVar}OfflineAt`);
    this.setOutputData(this.findOutputSlot("onlineAt"), `${declVar}OnlineAt`);
    this.setOutputData(this.findOutputSlot("downlink"), `${declVar}Downlink`);
    this.setOutputData(this.findOutputSlot("effectiveType"), `${declVar}EffectiveType`);
    this.setOutputData(this.findOutputSlot("type"), `${declVar}Type`);
  }

  static get id() { return "vueuse-usenetwork-d1e2f3a4-b5c6-7890-1234-def567890123"; }
  static get title() { return "useNetwork"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Sensors"; }
}
