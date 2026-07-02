import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

// ================= Date Operation Node =================
export class defineDate extends nodeMeta {
  constructor() {
    super();
    this.addOutput("outValue", "string"); // Date is an object
    this.uiPanel = defineAsyncComponent(() => import("./datePanel.vue"));
  }

  onExecute() {
    const props = this.properties;
    if (!props) {
      this.jsCode = "// Properties not found";
      return;
    }

    const getParamValue = (param) => {
      if (param.isSlot) {
        const inputSlot = this.inputs.find((i) => i.id === param.id);
        return inputSlot
          ? this.getInputData(this.inputs.indexOf(inputSlot))
          : "undefined";
      }
      return param.value || "undefined";
    };

    let constructorArgs = "";
    if (
      props.constructorType !== "now" &&
      Array.isArray(props.constructorParams)
    ) {
      constructorArgs = props.constructorParams.map(getParamValue).join(", ");
    }
    let finalExpression = `new Date(${constructorArgs})`;

    let lastMethodHasReturnValue = true; // Constructor always returns a value

    if (Array.isArray(props.methods)) {
      const methodParamMap = this.getMethodParamMap();
      props.methods.forEach((method, methodIdx) => {
        if (!method.methodName) return;
        const args = method.params.map(getParamValue).join(", ");
        finalExpression = `${finalExpression}.${method.methodName}(${args})`;

        if (methodIdx === props.methods.length - 1) {
          const methodInfo = methodParamMap[method.methodName];
          lastMethodHasReturnValue = methodInfo
            ? methodInfo.hasReturnValue
            : true;
        }
      });
    }

    if (lastMethodHasReturnValue) {
      const declType = props.declareType || "const";

      // 处理 outputVar 三元组
      let declVar = "myDate";
      let declPrefix = "";

      if (props.outputVar?.isSlot) {
        // slot 模式：从 input 获取变量名，不加 declareType
        const inputSlot = this.inputs.find((i) => i.id === props.outputVar.id);
        if (inputSlot) {
          const slotIdx = this.inputs.indexOf(inputSlot);
          declVar = this.isInputConnected(slotIdx)
            ? this.getInputData(slotIdx)
            : "myDate";
        }
      } else {
        // 静态模式：使用 value，拼接 declareType
        declVar = props.outputVar?.value || props.outputVar || "myDate";
        const exportPrefix = props.exported ? "export " : "";
        declPrefix = `${exportPrefix}${declType} `;
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
      getDate: { hasReturnValue: true },
      getDay: { hasReturnValue: true },
      getFullYear: { hasReturnValue: true },
      getHours: { hasReturnValue: true },
      getMilliseconds: { hasReturnValue: true },
      getMinutes: { hasReturnValue: true },
      getMonth: { hasReturnValue: true },
      getSeconds: { hasReturnValue: true },
      getTime: { hasReturnValue: true },
      setDate: { hasReturnValue: false },
      setFullYear: { hasReturnValue: false },
      setHours: { hasReturnValue: false },
      setMilliseconds: { hasReturnValue: false },
      setMinutes: { hasReturnValue: false },
      setMonth: { hasReturnValue: false },
      setSeconds: { hasReturnValue: false },
      setTime: { hasReturnValue: false },
      toDateString: { hasReturnValue: true },
      toISOString: { hasReturnValue: true },
      toJSON: { hasReturnValue: true },
      toLocaleDateString: { hasReturnValue: true },
      toLocaleString: { hasReturnValue: true },
      toLocaleTimeString: { hasReturnValue: true },
      toString: { hasReturnValue: true },
      toUTCString: { hasReturnValue: true },
    };
  }

  static get title() {
    return "Date";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "b1c2d3e4-f5a6-4b7c-8a9f-0e1d2c3b4a5e";
  } // New unique ID
  static get treePath() {
    return "JavaScript";
  }
}
