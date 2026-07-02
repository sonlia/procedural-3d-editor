import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineUseRoute extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `route_${uid().slice(0, 8)}` },
    };

    this.addOutput("outValue", "string");
    this.addOutput("path", "string");
    this.addOutput("fullPath", "string");
    this.addOutput("query", "string");
    this.addOutput("params", "string");
    this.addOutput("name", "string");
    this.addOutput("meta", "string");
    this.uiPanel = defineAsyncComponent(() => import("./routePanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `route_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `route_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 生成代码
    this.importStr = `import { useRoute } from 'vue-router';`;
    this.jsCode = `${declPrefix}${declVar} = useRoute();`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
    this.setOutputData(this.findOutputSlot("path"), `${declVar}.path`);
    this.setOutputData(this.findOutputSlot("fullPath"), `${declVar}.fullPath`);
    this.setOutputData(this.findOutputSlot("query"), `${declVar}.query`);
    this.setOutputData(this.findOutputSlot("params"), `${declVar}.params`);
    this.setOutputData(this.findOutputSlot("name"), `${declVar}.name`);
    this.setOutputData(this.findOutputSlot("meta"), `${declVar}.meta`);
  }

  static get id() { return "vuerouter-useroute-d0e1f2a3-b4c5-6789-0123-def456789012"; }
  static get title() { return "useRoute"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueRouter"; }
}

export class defineUseRouter extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `router_${uid().slice(0, 8)}` },
    };

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./routePanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `router_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `router_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 生成代码
    this.importStr = `import { useRouter } from 'vue-router';`;
    this.jsCode = `${declPrefix}${declVar} = useRouter();`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get id() { return "vuerouter-userouter-e1f2a3b4-c5d6-7890-1234-ef5678901234"; }
  static get title() { return "useRouter"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueRouter"; }
}

export class defineUseRouteQuery extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `query_${uid().slice(0, 8)}` },

      // Hook 参数
      name: { id: uid(), isSlot: false, value: "" },
      defaultValue: { id: uid(), isSlot: false, value: "" },

      // 选项
      mode: "replace",
      route: { id: uid(), isSlot: false, value: "" },
      router: { id: uid(), isSlot: false, value: "" },
    };

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./routeQueryPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `query_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `query_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取参数
    const name = getParamValue(props.name);
    const defaultValue = getParamValue(props.defaultValue);

    if (!name) {
      this.jsCode = `// useRouteQuery: name is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      return;
    }

    // 构建选项
    const options = [];
    if (props.mode !== "replace") options.push(`mode: '${props.mode}'`);
    const route = getParamValue(props.route);
    const router = getParamValue(props.router);
    if (route) options.push(`route: ${route}`);
    if (router) options.push(`router: ${router}`);

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";
    const defaultValueStr = defaultValue ? `, ${defaultValue}` : "";

    // 生成代码
    this.importStr = `import { useRouteQuery } from '@vueuse/router';`;
    this.jsCode = `${declPrefix}${declVar} = useRouteQuery(${name}${defaultValueStr}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get id() { return "vuerouter-useroutequery-f2a3b4c5-d6e7-8901-2345-f67890123456"; }
  static get title() { return "useRouteQuery"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueRouter"; }
}

export class defineUseRouteParams extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区（三元组模式）
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `param_${uid().slice(0, 8)}` },

      // Hook 参数
      name: { id: uid(), isSlot: false, value: "" },
      defaultValue: { id: uid(), isSlot: false, value: "" },

      // 选项
      mode: "replace",
      route: { id: uid(), isSlot: false, value: "" },
      router: { id: uid(), isSlot: false, value: "" },
    };

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./routeParamsPanel.vue"));
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
      declVar = getParamValue(props.outputVar) || `param_${uid().slice(0, 8)}`;
    } else {
      declVar = props.outputVar?.value || `param_${uid().slice(0, 8)}`;
      declPrefix = `${props.exported ? "export " : ""}${props.declareType} `;
    }

    // 获取参数
    const name = getParamValue(props.name);
    const defaultValue = getParamValue(props.defaultValue);

    if (!name) {
      this.jsCode = `// useRouteParams: name is required`;
      this.setOutputData(this.findOutputSlot("outValue"), "undefined");
      return;
    }

    // 构建选项
    const options = [];
    if (props.mode !== "replace") options.push(`mode: '${props.mode}'`);
    const route = getParamValue(props.route);
    const router = getParamValue(props.router);
    if (route) options.push(`route: ${route}`);
    if (router) options.push(`router: ${router}`);

    const optionsStr = options.length > 0 ? `, { ${options.join(", ")} }` : "";
    const defaultValueStr = defaultValue ? `, ${defaultValue}` : "";

    // 生成代码
    this.importStr = `import { useRouteParams } from '@vueuse/router';`;
    this.jsCode = `${declPrefix}${declVar} = useRouteParams(${name}${defaultValueStr}${optionsStr});`;

    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get id() { return "vuerouter-userouteparams-a3b4c5d6-e7f8-9012-3456-789012345678"; }
  static get title() { return "useRouteParams"; }
  static get name() { return this.title; }
  static get treePath() { return "Hooks/VueRouter"; }
}
