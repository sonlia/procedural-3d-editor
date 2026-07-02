import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

// ================= Math Operation Node =================
export class defineMath extends nodeMeta {
  constructor() {
    super();

    // 初始化 properties - 符合单一数据源模式
    this.properties = {
      exported: false,
      declareType: "const",
      outputVar: `math_${uid().slice(0, 8)}`,
      outputVarIsSlot: false,
      outputVarSlotId: uid(),
      operation: "abs",
      params: [{ id: uid(), label: "x", isSlot: false, value: "" }],
      remark: "",
    };

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./mathPanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};
    const operation = props.operation || "abs";
    const params = props.params || [];

    // 获取参数值（null = 未配置）
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;

      const slotIndex = this.inputs.indexOf(slot);
      return this.isInputConnected(slotIndex)
        ? this.getInputData(slotIndex)
        : null;
    };

    let expression;
    const isProperty = ["E", "PI"].includes(operation);

    if (isProperty) {
      expression = `Math.${operation}`;
    } else {
      // 过滤尾部 null 参数，剩余 null 替换为 undefined
      const paramValues = params.map(getParamValue);
      while (
        paramValues.length > 0 &&
        paramValues[paramValues.length - 1] === null
      ) {
        paramValues.pop();
      }
      const args = paramValues
        .map((v) => (v === null ? "undefined" : v))
        .join(", ");
      expression = `Math.${operation}(${args})`;
    }

    // 处理 outputVar 的 slot 模式
    let declVar;
    let isVarNameFromSlot = false;
    if (props.outputVarIsSlot) {
      const slot = this.inputs.find((s) => s.id === props.outputVarSlotId);
      if (slot) {
        const slotIndex = this.inputs.indexOf(slot);
        if (this.isInputConnected(slotIndex)) {
          declVar = this.getInputData(slotIndex);
          isVarNameFromSlot = true;
        }
      }
    }
    declVar = declVar || props.outputVar || `math_${uid().slice(0, 8)}`;

    // ⚠️ 关键：slot 模式下不加 export 和 declareType
    if (isVarNameFromSlot) {
      this.jsCode = `${declVar} = ${expression};`;
    } else {
      const exportStr = props.exported ? "export " : "";
      const declType = props.declareType || "const";
      this.jsCode = `${exportStr}${declType} ${declVar} = ${expression};`;
    }

    // 输出变量名字符串
    const outSlot = this.findOutputSlot("outValue");
    if (outSlot !== -1) {
      this.setOutputData(outSlot, declVar);
    }
  }

  onConnectionsChange() {
    this.onExecute();
    this.graph?.setDirtyCanvas?.(true, true);
  }

  // Math 操作映射（用于 getMethodMap 兼容）
  getMethodMap() {
    return {
      E: { params: [], hasReturnValue: true },
      PI: { params: [], hasReturnValue: true },
      abs: { params: ["x"], hasReturnValue: true },
      acos: { params: ["x"], hasReturnValue: true },
      asin: { params: ["x"], hasReturnValue: true },
      atan: { params: ["x"], hasReturnValue: true },
      atan2: { params: ["y", "x"], hasReturnValue: true },
      ceil: { params: ["x"], hasReturnValue: true },
      cos: { params: ["x"], hasReturnValue: true },
      exp: { params: ["x"], hasReturnValue: true },
      floor: { params: ["x"], hasReturnValue: true },
      log: { params: ["x"], hasReturnValue: true },
      max: { params: ["n1"], variadic: true, hasReturnValue: true },
      min: { params: ["n1"], variadic: true, hasReturnValue: true },
      pow: { params: ["base", "exponent"], hasReturnValue: true },
      random: { params: [], hasReturnValue: true },
      round: { params: ["x"], hasReturnValue: true },
      sin: { params: ["x"], hasReturnValue: true },
      sqrt: { params: ["x"], hasReturnValue: true },
      tan: { params: ["x"], hasReturnValue: true },
    };
  }

  static get title() {
    return "Math";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "e4f5a6b7-c8d9-4e0a-b1c2-d3e4f5a6b7c8";
  }
  static get treePath() {
    return "JavaScript";
  }
}
