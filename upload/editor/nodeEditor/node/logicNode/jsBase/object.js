import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

// ================= Object Operation Node =================
export class defineObject extends nodeMeta {
  constructor() {
    super();
    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./objectPanel.vue"));
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

    // --- 获取变量名（支持三元组结构和 slot 模式）---
    const getVarName = () => {
      const outputVar = props.outputVar;
      // 兼容旧格式（字符串）
      if (typeof outputVar === "string") {
        return outputVar || "myObject";
      }
      // 新格式（三元组）
      if (outputVar?.isSlot) {
        const slot = this.inputs.find((s) => s.id === outputVar.id);
        if (slot && this.isInputConnected(this.inputs.indexOf(slot))) {
          return this.getInputData(this.inputs.indexOf(slot));
        }
        return null; // slot 开启但未连接
      }
      return outputVar?.value || "myObject";
    };

    let finalExpression = "";

    // --- Generate expression based on mode ---
    if (props.operationType === "instance") {
      // 使用 sourceParam 作为对象字面量/源对象
      const sourceValue = getParamValue(props.sourceParam);
      let instanceExpr = sourceValue || "{}";

      if (Array.isArray(props.methods) && props.methods.length > 0) {
        props.methods.forEach((method) => {
          if (!method.methodName) return;
          const args = method.params.map(getParamValue).join(", ");
          instanceExpr = `${instanceExpr}.${method.methodName}(${args})`;
        });
      }
      finalExpression = instanceExpr;
    } else {
      // 'static'
      const operation = props.staticOperation || "keys";
      const params = props.staticParams || [];
      const args = params.map(getParamValue).join(", ");
      finalExpression = `Object.${operation}(${args})`;
    }

    const map =
      props.operationType === "instance"
        ? this.getInstanceMethodMap()
        : this.getStaticMethodMap();
    const lastOpName =
      props.operationType === "instance"
        ? props.methods?.[props.methods.length - 1]?.methodName
        : props.staticOperation;

    let hasReturnValue = true; // Default true
    if (lastOpName && map[lastOpName]) {
      hasReturnValue = map[lastOpName].hasReturnValue;
    } else if (
      props.operationType === "instance" &&
      (!props.methods || props.methods.length === 0)
    ) {
      // 对象字面量本身有返回值
      hasReturnValue = true;
    }

    if (hasReturnValue) {
      const declVar = getVarName();
      if (declVar === null) {
        // VarName slot 开启但未连接
        this.jsCode = "";
        return;
      }

      // ⚠️ 关键：slot 模式不加 export 和 declareType
      if (props.outputVar?.isSlot) {
        // 外部传入的是纯变量名，用于赋值操作
        this.jsCode = `${declVar} = ${finalExpression};`;
      } else {
        // 静态模式：拼接完整声明
        const exportStr = props.exported ? "export " : "";
        const declType = props.declareType || "const";
        this.jsCode = `${exportStr}${declType} ${declVar} = ${finalExpression};`;
      }

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

  getInstanceMethodMap() {
    return {
      hasOwnProperty: { hasReturnValue: true },
      toString: { hasReturnValue: true },
    };
  }

  getStaticMethodMap() {
    return {
      assign: { hasReturnValue: true },
      keys: { hasReturnValue: true },
      values: { hasReturnValue: true },
      entries: { hasReturnValue: true },
      fromEntries: { hasReturnValue: true },
      freeze: { hasReturnValue: true },
    };
  }

  static get title() {
    return "Object";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f";
  } // New unique ID
  static get treePath() {
    return "JavaScript";
  }
}
