import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";
import { isFunctionParam } from "../utils.js";

// ================= Set Operation Node =================
export class defineSet extends nodeMeta {
  constructor() {
    super();
    this.addOutput("outValue", "string"); // Set variable name output
    this.uiPanel = defineAsyncComponent(() => import("./setPanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};
    if (!props) {
      this.jsCode = "// Properties not found";
      return;
    }

    // --- Helper to get param values ---
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      // 函数类型和普通类型都在 inputs 中
      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);

      if (!this.isInputConnected(slotIndex)) {
        return null;
      }

      const isFunc = isFunctionParam(param.label);
      if (isFunc) {
        // 函数类型：生成占位符
        return `__FUNC_${param.id}__`;
      } else {
        return this.getInputData(slotIndex);
      }
    };

    // 1. Constructor expression
    const constructorArg = getParamValue(props.constructorParam);
    let finalExpression = constructorArg ? `new Set(${constructorArg})` : `new Set()`;

    let lastMethodHasReturnValue = true;

    if (Array.isArray(props.methods)) {
      const methodParamMap = this.getMethodParamMap();
      props.methods.forEach((method, methodIdx) => {
        if (!method.methodName) return;

        if (method.methodName === "size") {
          finalExpression = `${finalExpression}.size`;
        } else {
          const args = method.params.map(getParamValue).filter(v => v !== null).join(", ");
          finalExpression = `${finalExpression}.${method.methodName}(${args})`;
        }

        if (methodIdx === props.methods.length - 1) {
          const methodInfo = methodParamMap[method.methodName];
          lastMethodHasReturnValue = methodInfo
            ? methodInfo.hasReturnValue
            : true;
        }
      });
    }

    if (lastMethodHasReturnValue) {
      // 处理 outputVar 三元组结构
      let declVar = "mySet";
      let declPrefix = "";
      const outputVarParam = props.outputVar;

      if (outputVarParam?.isSlot) {
        // 从 slot 获取变量名（外部传入纯变量名，用于赋值）
        const slot = this.inputs.find((s) => s.id === outputVarParam.id);
        if (slot) {
          const slotIndex = this.inputs.indexOf(slot);
          if (this.isInputConnected(slotIndex)) {
            declVar = this.getInputData(slotIndex) || "mySet";
          }
        }
        // slot 模式下不加 export 和 declareType
      } else {
        // 静态模式：拼接 export + declareType
        declVar = outputVarParam?.value || "mySet";
        const exportPrefix = props.exported ? "export " : "";
        declPrefix = `${exportPrefix}${props.declareType || "const"} `;
      }

      this.jsCode = `${declPrefix}${declVar} = ${finalExpression};`;
      const outSlot = this.findOutputSlot("outValue");
      if (outSlot !== -1) {
        this.setOutputData(outSlot, declVar);
      }
    } else {
      this.jsCode = `${finalExpression};`;
      const outSlot = this.findOutputSlot("outValue");
      if (outSlot !== -1) {
        this.setOutputData(outSlot, undefined);
      }
    }
  }

  getMethodParamMap() {
    return {
      add: { hasReturnValue: true },
      has: { hasReturnValue: true },
      delete: { hasReturnValue: true },
      clear: { hasReturnValue: false },
      forEach: { hasReturnValue: false },
      values: { hasReturnValue: true },
      keys: { hasReturnValue: true },
      entries: { hasReturnValue: true },
      size: { hasReturnValue: true },
    };
  }

  static get title() {
    return "Set";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e";
  } // New unique ID
  static get treePath() {
    return "JavaScript";
  }
}
