import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

// ================= Map Operation Node =================
export class defineMap extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      exported: false,
      declareType: "const",
      outputVar: {
        id: uid(),
        isSlot: false,
        value: `map_${uid().slice(0, 8)}`,
      },
      constructorParam: {
        id: uid(),
        label: "iterable",
        isSlot: false,
        value: "",
      },
      methods: [],
      remark: "",
    };

    // out slot 由面板 watch 根据方法链动态管理，不在构造函数中添加
    this.uiPanel = defineAsyncComponent(() => import("./mapPanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};
    if (!props) {
      this.jsCode = "// Properties not found";
      return;
    }

    // --- Helper to get param values (null = 未配置) ---
    const getParamValue = (param) => {
      if (!param) return null;

      // 非 slot 模式：空值返回 null 表示未配置
      if (!param.isSlot) {
        return param.value || null;
      }

      // 函数参数也是输入 slot（当前节点消费该函数）
      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;

      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) {
        return null;
      }

      // 检查连接的源节点，获取函数引用
      return this.getInputData(slotIndex);
    };

    // 1. Constructor expression - 遵循最小输出原则
    const constructorArg = getParamValue(props.constructorParam);
    let finalExpression = constructorArg
      ? `new Map(${constructorArg})`
      : `new Map()`;

    let lastMethodHasReturnValue = true;

    if (Array.isArray(props.methods)) {
      const methodParamMap = this.getMethodParamMap();
      props.methods.forEach((method, methodIdx) => {
        if (!method.methodName) return;

        if (method.methodName === "size") {
          finalExpression = `${finalExpression}.size`;
        } else {
          // 过滤尾部 null 参数
          const paramValues = method.params.map(getParamValue);
          while (
            paramValues.length > 0 &&
            paramValues[paramValues.length - 1] === null
          ) {
            paramValues.pop();
          }
          // 剩余 null 替换为 undefined（必需参数未配置）
          const args = paramValues
            .map((v) => (v === null ? "undefined" : v))
            .join(", ");
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

    // 生成最终代码
    // 处理变量名三元组
    let declVar = props.outputVar?.value || "myMap";
    let declPrefix = "";

    if (props.outputVar?.isSlot) {
      // slot 模式：从输入获取变量名，不加 export/declareType
      const varSlot = this.inputs.find((s) => s.id === props.outputVar.id);
      if (varSlot) {
        const slotIndex = this.inputs.indexOf(varSlot);
        if (this.isInputConnected(slotIndex)) {
          declVar = this.getInputData(slotIndex) || declVar;
        }
      }
    } else {
      // 静态模式：拼接 export + declareType
      const exportStr = props.exported ? "export " : "";
      declPrefix = `${exportStr}${props.declareType || "const"} `;
    }

    if (lastMethodHasReturnValue) {
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
      set: { hasReturnValue: true },
      get: { hasReturnValue: true },
      has: { hasReturnValue: true },
      delete: { hasReturnValue: true },
      clear: { hasReturnValue: false },
      forEach: { hasReturnValue: false },
      keys: { hasReturnValue: true },
      values: { hasReturnValue: true },
      entries: { hasReturnValue: true },
      size: { hasReturnValue: true },
    };
  }

  static get title() {
    return "Map";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "d3e4f5a6-b7c8-4d9e-a0b1-c2d3e4f5a6b7";
  } // New unique ID
  static get treePath() {
    return "JavaScript";
  }
}
