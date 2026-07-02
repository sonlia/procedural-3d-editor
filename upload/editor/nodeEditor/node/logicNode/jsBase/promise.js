import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";
import { isFunctionParam } from "../utils.js";

// ================= Promise Operation Node =================
export class definePromise extends nodeMeta {
  constructor() {
    super();
    // The output is a Promise object, but its resolved value can be anything.
    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./promisePanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};
    if (!props) {
      this.jsCode = "// Properties not found";
      return;
    }

    // --- Helper to get param values (handles normal, functional, slotted, and literal values) ---
    // 注意：所有参数（包括函数）都添加到 inputs（参考 compEventsPanel）
    const getParamValue = (param, prefix = "") => {
      if (!param) return "undefined";

      const isFunc = isFunctionParam(param.label);
      if (param.isSlot) {
        const slot = this.inputs.find((s) => s.id === param.id);
        if (!slot) return "undefined";

        const slotIndex = this.inputs.indexOf(slot);
        if (!this.isInputConnected(slotIndex)) return "undefined";

        if (isFunc) {
          const subgraphArgs = slot.meta?.args?.join(", ") || "";
          return `__FUNC_${slot.link}__`;
        } else {
          return this.getInputData(slotIndex);
        }
      }
      return isFunc ? "undefined" : param.value || "undefined";
    };

    // --- Helper to get variable name (supports isSlot mode) ---
    const getVarName = () => {
      const outputVar = props.outputVar;
      if (!outputVar) return "myPromise";

      if (outputVar.isSlot) {
        const slot = this.inputs.find((s) => s.id === outputVar.id);
        if (!slot) return "myPromise";
        const slotIndex = this.inputs.indexOf(slot);
        if (!this.isInputConnected(slotIndex)) return "myPromise";
        return this.getInputData(slotIndex);
      }
      return outputVar.value || "myPromise";
    };

    // 1. Build the base Promise creation expression
    let baseExpression;
    const creationType = props.creationType || "new";
    const creationParams = props.creationParams || [];

    if (creationType === "new") {
      const executor = getParamValue(creationParams[0], "C-");
      baseExpression = `new Promise(${executor})`;
    } else {
      const arg = getParamValue(creationParams[0], "C-");
      baseExpression = `Promise.${creationType}(${arg || ""})`;
    }

    // 2. Chain the handlers (.then, .catch, .finally)
    let finalExpression = baseExpression;
    if (Array.isArray(props.handlers)) {
      props.handlers.forEach((handler, idx) => {
        if (!handler.type) return;
        const handlerArgs = handler.params
          .map((p) => getParamValue(p, `H${idx + 1}-`))
          .join(", ");
        finalExpression += `.${handler.type}(${handlerArgs})`;
      });
    }

    // 3. Final code generation
    const declVar = getVarName();

    // ⚠️ 关键：slot 模式下不加 export 和 declareType
    if (props.outputVar?.isSlot) {
      // 外部传入的是纯变量名，用于赋值操作
      this.jsCode = `${declVar} = ${finalExpression};`;
    } else {
      // 静态模式：拼接完整声明
      const exportStr = props.exported ? "export " : "";
      const declType = props.declareType || "const";
      this.jsCode = `${exportStr}${declType} ${declVar} = ${finalExpression};`;
    }

    // 4. Set output value
    const outSlot = this.findOutputSlot("outValue");
    if (outSlot !== -1) {
      this.setOutputData(outSlot, declVar);
    }
  }

  static get title() {
    return "Promise";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d";
  } // New unique ID
  static get treePath() {
    return "JavaScript";
  }
}
