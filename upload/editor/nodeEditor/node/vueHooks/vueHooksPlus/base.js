import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineUseUndo extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `undoState_${uid().slice(0, 8)}` },

      // Hook 参数
      initialValue: { id: uid(), isSlot: false, value: "" },
    };

    this.addOutput("outValue", "string");
    this.addOutput("state", "string");
    this.addOutput("setState", "string");
    this.addOutput("resetState", "string");
    this.addOutput("undo", "string");
    this.addOutput("redo", "string");
    this.addOutput("canUndo", "string");
    this.addOutput("canRedo", "string");
    this.uiPanel = defineAsyncComponent(() => import("./undoPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `undoState_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `undoState_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取初始值
    const initialValue = getParamValue(props.initialValue) || "undefined";

    // 生成代码
    this.importStr = `import { useUndo } from 'vue-hooks-plus';`;
    this.jsCode = `${declPrefix}{ state: ${declVar}State, setState: ${declVar}SetState, resetState: ${declVar}ResetState, undo: ${declVar}Undo, redo: ${declVar}Redo, canUndo: ${declVar}CanUndo, canRedo: ${declVar}CanRedo } = useUndo(${initialValue});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("state"), `${declVar}State`);
    this.setOutputData(this.findOutputSlot("setState"), `${declVar}SetState`);
    this.setOutputData(this.findOutputSlot("resetState"), `${declVar}ResetState`);
    this.setOutputData(this.findOutputSlot("undo"), `${declVar}Undo`);
    this.setOutputData(this.findOutputSlot("redo"), `${declVar}Redo`);
    this.setOutputData(this.findOutputSlot("canUndo"), `${declVar}CanUndo`);
    this.setOutputData(this.findOutputSlot("canRedo"), `${declVar}CanRedo`);
  }

  static get id() { return "vuehooksplus-useundo-a1b2c3d4-e5f6-7890-1234-567890abcdef"; }
  static get title() { return "useUndo"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueHooksPlus"; }
}

export class defineUseWatermark extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // Hook 参数
      content: { id: uid(), isSlot: false, value: "Watermark" },
      container: { id: uid(), isSlot: true, value: "" },

      // 选项
      fontSize: { id: uid(), isSlot: false, value: "16" },
      fontColor: { id: uid(), isSlot: false, value: "rgba(0, 0, 0, 0.15)" },
      rotate: { id: uid(), isSlot: false, value: "-22" },
      zIndex: { id: uid(), isSlot: false, value: "9999" },
      gap: { id: uid(), isSlot: false, value: "100" },
    };

    // container slot
    this.addInput("container", "string", { id: this.properties.container.id });

    this.addOutput("setWatermark", "string");
    this.addOutput("clear", "string");
    this.uiPanel = defineAsyncComponent(() => import("./watermarkPanel.vue"));
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

    // 获取参数
    const content = getParamValue(props.content) || "Watermark";
    const container = getParamValue(props.container);

    // 构建选项
    const options = [];
    options.push(`content: '${content}'`);
    if (container) options.push(`container: ${container}`);

    const fontSize = getParamValue(props.fontSize);
    if (fontSize && fontSize !== "16") options.push(`fontSize: ${fontSize}`);

    const fontColor = getParamValue(props.fontColor);
    if (fontColor && fontColor !== "rgba(0, 0, 0, 0.15)") options.push(`fontColor: '${fontColor}'`);

    const rotate = getParamValue(props.rotate);
    if (rotate && rotate !== "-22") options.push(`rotate: ${rotate}`);

    const zIndex = getParamValue(props.zIndex);
    if (zIndex && zIndex !== "9999") options.push(`zIndex: ${zIndex}`);

    const gap = getParamValue(props.gap);
    if (gap && gap !== "100") options.push(`gap: [${gap}, ${gap}]`);

    const varPrefix = `watermark_${uid().slice(0, 8)}`;

    // 生成代码
    this.importStr = `import { useWatermark } from 'vue-hooks-plus';`;
    this.jsCode = `const { setWatermark: ${varPrefix}SetWatermark, clear: ${varPrefix}Clear } = useWatermark({ ${options.join(", ")} });`;

    this.setOutputData(this.findOutputSlot("setWatermark"), `${varPrefix}SetWatermark`);
    this.setOutputData(this.findOutputSlot("clear"), `${varPrefix}Clear`);
  }

  static get id() { return "vuehooksplus-usewatermark-b2c3d4e5-f6a7-8901-2345-678901bcdef0"; }
  static get title() { return "useWatermark"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueHooksPlus"; }
}

export class defineUseDownload extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // Hook 参数
      url: { id: uid(), isSlot: false, value: "" },
      filename: { id: uid(), isSlot: false, value: "" },

      // 选项
      target: { id: uid(), isSlot: false, value: "_blank" },
    };

    this.addOutput("download", "string");
    this.addOutput("isLoading", "string");
    this.uiPanel = defineAsyncComponent(() => import("./downloadPanel.vue"));
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

    // 获取参数
    const url = getParamValue(props.url);
    const filename = getParamValue(props.filename);
    const target = getParamValue(props.target) || "_blank";

    // 构建选项
    const options = [];
    if (url) options.push(`url: '${url}'`);
    if (filename) options.push(`filename: '${filename}'`);
    if (target !== "_blank") options.push(`target: '${target}'`);

    const varPrefix = `download_${uid().slice(0, 8)}`;
    const optionsStr = options.length > 0 ? `{ ${options.join(", ")} }` : "{}";

    // 生成代码
    this.importStr = `import { useDownload } from 'vue-hooks-plus';`;
    this.jsCode = `const { download: ${varPrefix}Download, isLoading: ${varPrefix}IsLoading } = useDownload(${optionsStr});`;

    this.setOutputData(this.findOutputSlot("download"), `${varPrefix}Download`);
    this.setOutputData(this.findOutputSlot("isLoading"), `${varPrefix}IsLoading`);
  }

  static get id() { return "vuehooksplus-usedownload-c3d4e5f6-a7b8-9012-3456-789012cdef01"; }
  static get title() { return "useDownload"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueHooksPlus"; }
}
