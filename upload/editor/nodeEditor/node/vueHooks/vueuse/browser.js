import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineUseClipboard extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `clipboard_${uid().slice(0, 8)}` },

      // 选项
      source: { id: uid(), isSlot: false, value: "" },
      copiedDuring: { id: uid(), isSlot: false, value: "1500" },
      legacy: false,
      read: false,
    };

    this.addOutput("outValue", "string");
    this.addOutput("text", "string");
    this.addOutput("copied", "string");
    this.addOutput("copy", "string");
    this.addOutput("isSupported", "string");
    this.uiPanel = defineAsyncComponent(() => import("./browserPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `clipboard_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `clipboard_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 构建选项
    const options = [];
    const source = getParamValue(props.source);
    const copiedDuring = getParamValue(props.copiedDuring);
    if (source) options.push(`source: ${source}`);
    if (copiedDuring && copiedDuring !== "1500") options.push(`copiedDuring: ${copiedDuring}`);
    if (props.legacy) options.push("legacy: true");
    if (props.read) options.push("read: true");

    const optionsStr = options.length > 0 ? `{ ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useClipboard } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ text: ${declVar}Text, copied: ${declVar}Copied, copy: ${declVar}Copy, isSupported: ${declVar}IsSupported } = useClipboard(${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("text"), `${declVar}Text`);
    this.setOutputData(this.findOutputSlot("copied"), `${declVar}Copied`);
    this.setOutputData(this.findOutputSlot("copy"), `${declVar}Copy`);
    this.setOutputData(this.findOutputSlot("isSupported"), `${declVar}IsSupported`);
  }

  static get id() { return "vueuse-useclipboard-e2f3a4b5-c6d7-8901-2345-ef6789012345"; }
  static get title() { return "useClipboard"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Browser"; }
}

export class defineUseEventListener extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // Hook 参数
      target: { id: uid(), isSlot: true, value: "" },
      event: { id: uid(), isSlot: false, value: "" },
      listener: { id: uid(), isSlot: true, value: "" },

      // 选项
      capture: false,
      passive: true,
      once: false,
    };

    // target slot
    this.addInput("target", "string", { id: this.properties.target.id });

    // listener 函数 slot
    this.addInput("listener", "function", {
      id: this.properties.listener.id,
      shape: 5,
      meta: { args: ["event"] },
    });

    this.addOutput("cleanup", "string");
    this.uiPanel = defineAsyncComponent(() => import("./browserPanel.vue"));
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
    const target = getParamValue(props.target) || "window";

    // 获取 event
    const event = getParamValue(props.event);

    // 获取 listener 函数
    let listenerCode = "() => {}";
    const listenerSlot = this.inputs.find((s) => s.id === props.listener.id);
    if (listenerSlot) {
      const listenerSlotIndex = this.inputs.indexOf(listenerSlot);
      if (this.isInputConnected(listenerSlotIndex) && this.inputs[listenerSlotIndex].link && this.graph) {
        const linkInfo = this.graph.links[this.inputs[listenerSlotIndex].link];
        if (linkInfo) {
          const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
          if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
            listenerCode = `__FUNC_${sourceNode.id}__`;
          }
        }
      }
    }

    if (!event) {
      this.jsCode = `// useEventListener: event is required`;
      this.setOutputData(this.findOutputSlot("cleanup"), "undefined");
      return;
    }

    // 构建选项
    const options = [];
    if (props.capture) options.push("capture: true");
    if (!props.passive) options.push("passive: false");
    if (props.once) options.push("once: true");

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useEventListener } from '@vueuse/core';`;
    const cleanupVar = `cleanup_${uid().slice(0, 8)}`;
    this.jsCode = `const ${cleanupVar} = useEventListener(${target}, ${event}, ${listenerCode}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("cleanup"), cleanupVar);
  }

  static get id() { return "vueuse-useeventlistener-f3a4b5c6-d7e8-9012-3456-f78901234567"; }
  static get title() { return "useEventListener"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Browser"; }
}

export class defineUseWebSocket extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `ws_${uid().slice(0, 8)}` },

      // Hook 参数
      url: { id: uid(), isSlot: false, value: "" },

      // 选项
      immediate: true,
      autoReconnect: false,
      heartbeat: false,
      protocols: { id: uid(), isSlot: false, value: "" },

      // 回调
      onConnected: { id: uid(), isSlot: true, value: "" },
      onDisconnected: { id: uid(), isSlot: true, value: "" },
      onError: { id: uid(), isSlot: true, value: "" },
      onMessage: { id: uid(), isSlot: true, value: "" },
    };

    this.addOutput("outValue", "string");
    this.addOutput("data", "string");
    this.addOutput("status", "string");
    this.addOutput("send", "string");
    this.addOutput("open", "string");
    this.addOutput("close", "string");
    this.addOutput("ws", "string");
    this.uiPanel = defineAsyncComponent(() => import("./browserPanel.vue"));
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

    // 获取函数连接
    const getFunctionCode = (param) => {
      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex) || !this.inputs[slotIndex].link || !this.graph) return null;

      const linkInfo = this.graph.links[this.inputs[slotIndex].link];
      if (!linkInfo) return null;

      const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
      if (sourceNode && (sourceNode.type === "FunctionBlock" || sourceNode.constructor.name === "FunctionBlock")) {
        return `__FUNC_${sourceNode.id}__`;
      }
      return null;
    };

    // 处理变量名三元组
    let declVar, declPrefix = "";
    if (props.outputVar?.isSlot) {
      declVar = getParamValue(props.outputVar) || `ws_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `ws_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 url
    const url = getParamValue(props.url);

    if (!url) {
      this.jsCode = `// useWebSocket: url is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      return;
    }

    // 构建选项
    const options = [];
    if (!props.immediate) options.push("immediate: false");
    if (props.autoReconnect) options.push("autoReconnect: true");
    if (props.heartbeat) options.push("heartbeat: true");
    const protocols = getParamValue(props.protocols);
    if (protocols) options.push(`protocols: ${protocols}`);

    // 回调函数
    const onConnected = getFunctionCode(props.onConnected);
    const onDisconnected = getFunctionCode(props.onDisconnected);
    const onError = getFunctionCode(props.onError);
    const onMessage = getFunctionCode(props.onMessage);

    if (onConnected) options.push(`onConnected: ${onConnected}`);
    if (onDisconnected) options.push(`onDisconnected: ${onDisconnected}`);
    if (onError) options.push(`onError: ${onError}`);
    if (onMessage) options.push(`onMessage: ${onMessage}`);

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";

    // 生成代码
    this.importStr = `import { useWebSocket } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ data: ${declVar}Data, status: ${declVar}Status, send: ${declVar}Send, open: ${declVar}Open, close: ${declVar}Close, ws: ${declVar}Ws } = useWebSocket(${url}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("data"), `${declVar}Data`);
    this.setOutputData(this.findOutputSlot("status"), `${declVar}Status`);
    this.setOutputData(this.findOutputSlot("send"), `${declVar}Send`);
    this.setOutputData(this.findOutputSlot("open"), `${declVar}Open`);
    this.setOutputData(this.findOutputSlot("close"), `${declVar}Close`);
    this.setOutputData(this.findOutputSlot("ws"), `${declVar}Ws`);
  }

  static get id() { return "vueuse-usewebsocket-a4b5c6d7-e8f9-0123-4567-890123456789"; }
  static get title() { return "useWebSocket"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Browser"; }
}

export class defineUseBroadcastChannel extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `channel_${uid().slice(0, 8)}` },

      // Hook 参数
      name: { id: uid(), isSlot: false, value: "" },
    };

    this.addOutput("outValue", "string");
    this.addOutput("data", "string");
    this.addOutput("post", "string");
    this.addOutput("close", "string");
    this.addOutput("error", "string");
    this.addOutput("isClosed", "string");
    this.addOutput("isSupported", "string");
    this.uiPanel = defineAsyncComponent(() => import("./browserPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `channel_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `channel_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取 name
    const name = getParamValue(props.name);

    if (!name) {
      this.jsCode = `// useBroadcastChannel: name is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      return;
    }

    // 生成代码
    this.importStr = `import { useBroadcastChannel } from '@vueuse/core';`;
    this.jsCode = `${declPrefix}{ data: ${declVar}Data, post: ${declVar}Post, close: ${declVar}Close, error: ${declVar}Error, isClosed: ${declVar}IsClosed, isSupported: ${declVar}IsSupported } = useBroadcastChannel({ name: ${name} });`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("data"), `${declVar}Data`);
    this.setOutputData(this.findOutputSlot("post"), `${declVar}Post`);
    this.setOutputData(this.findOutputSlot("close"), `${declVar}Close`);
    this.setOutputData(this.findOutputSlot("error"), `${declVar}Error`);
    this.setOutputData(this.findOutputSlot("isClosed"), `${declVar}IsClosed`);
    this.setOutputData(this.findOutputSlot("isSupported"), `${declVar}IsSupported`);
  }

  static get id() { return "vueuse-usebroadcastchannel-b5c6d7e8-f9a0-1234-5678-901234567890"; }
  static get title() { return "useBroadcastChannel"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueUse/Browser"; }
}
