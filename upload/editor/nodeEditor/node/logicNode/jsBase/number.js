import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

// ================= Number Operation Node =================
export class defineNumber extends nodeMeta {
  constructor() {
    super();

    // 初始化 properties - 单一数据源
    this.properties = {
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `num_${uid().slice(0, 8)}` },
      operationType: "instance", // 'instance' or 'static'
      // Instance mode
      constructorParam: { id: uid(), label: "value", isSlot: false, value: "" },
      methods: [],
      // Static mode
      staticOperation: "isInteger",
      staticParams: [],
      remark: "",
    };

    // 输出槽类型为 string（传递变量名）
    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./numberPanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};
    if (!props) {
      this.jsCode = "// Properties not found";
      return;
    }

    // --- Helper to get param values ---
    const getParamValue = (param) => {
      if (!param) return "undefined";
      if (!param.isSlot) return param.value || "undefined";
      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return "undefined";
      const slotIndex = this.inputs.indexOf(slot);
      return this.isInputConnected(slotIndex)
        ? this.getInputData(slotIndex)
        : "undefined";
    };

    let finalExpression = "";

    // --- Generate expression based on mode ---
    if (props.operationType === "instance") {
      const constructorParamValue = getParamValue(props.constructorParam);
      let expression = `new Number(${constructorParamValue})`;

      if (Array.isArray(props.methods)) {
        props.methods.forEach((method) => {
          if (!method.methodName) return;
          const args = method.params.map(getParamValue).join(", ");
          expression = `${expression}.${method.methodName}(${args})`;
        });
      }
      finalExpression = expression;
    } else {
      // Static mode
      const operation = props.staticOperation || "isInteger";
      const staticMethodInfo = this.getStaticMethodMap()[operation];
      if (staticMethodInfo && staticMethodInfo.params.length > 0) {
        const args = (props.staticParams || []).map(getParamValue).join(", ");
        finalExpression = `Number.${operation}(${args})`;
      } else {
        // It's a property like MAX_VALUE
        finalExpression = `Number.${operation}`;
      }
    }

    // Since all Number operations have a return value, we always generate a declaration.
    // 处理变量名三元组
    let declVar = "num";
    let declPrefix = "";
    if (props.outputVar?.isSlot) {
      // slot 模式：外部传入完整声明，不加 declareType
      declVar = getParamValue(props.outputVar) || "num";
    } else {
      // 静态模式：拼接 export + declareType
      declVar = props.outputVar?.value || "num";
      const exportPrefix = props.exported ? "export " : "";
      declPrefix = `${exportPrefix}${props.declareType || "const"} `;
    }
    this.jsCode = `${declPrefix}${declVar} = ${finalExpression};`;

    const outSlot = this.findOutputSlot("outValue");
    if (outSlot !== -1) {
      this.setOutputData(outSlot, declVar);
    }
  }

  getStaticMethodMap() {
    return {
      MAX_VALUE: { params: [], hasReturnValue: true },
      MIN_VALUE: { params: [], hasReturnValue: true },
      isFinite: { params: ["value"], hasReturnValue: true },
      isInteger: { params: ["value"], hasReturnValue: true },
      isNaN: { params: ["value"], hasReturnValue: true },
      isSafeInteger: { params: ["value"], hasReturnValue: true },
      parseFloat: { params: ["string"], hasReturnValue: true },
      parseInt: { params: ["string", "radix"], hasReturnValue: true },
    };
  }

  static get title() {
    return "Number";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "f5a6b7c8-d9e0-4a1b-b2c3-d4e5f6a7b8c9";
  } // New unique ID
  static get treePath() {
    return "JavaScript";
  }
}
