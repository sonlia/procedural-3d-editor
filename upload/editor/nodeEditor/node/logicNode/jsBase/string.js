import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";
import { isFunctionParam, parseFunctionSignature } from "../utils.js";

// ================= String Operation Node =================
export class defineString extends nodeMeta {
  constructor() {
    super();
    this.uiPanel = defineAsyncComponent(() => import("./stringPanel.vue"));

    // 初始化 properties（三元组结构）
    this.properties = {
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `str_${uid().slice(0, 8)}` },
      source: { id: uid(), isSlot: false, value: "" },
      methods: [],
      remark: "",
    };

    // 输出变量名 slot
    this.addOutput("outValue", "string");
  }

  onExecute() {
    this.jsCode = "";
    const props = this.properties;
    if (!props) return;

    let finalExpression;
    // 使用三元组结构读取 source
    if (props.source?.isSlot) {
      const inputSlot = this.inputs.find((i) => i.id === props.source.id);
      finalExpression = inputSlot
        ? this.getInputData(this.inputs.indexOf(inputSlot))
        : '""';
    } else {
      finalExpression = props.source?.value || '""';
    }

    let lastMethodHasReturnValue = true;
    if (
      finalExpression === '""' &&
      (!props.methods || props.methods.length === 0)
    ) {
      lastMethodHasReturnValue = false;
    }

    if (Array.isArray(props.methods)) {
      const methodParamMap = this.getMethodParamMap();
      props.methods.forEach((method, methodIdx) => {
        if (!method.methodName) return;

        const args = method.params
          .map((p) => {
            if (isFunctionParam(p.label)) {
              // 函数参数现在是 input slot
              const signature = parseFunctionSignature(p.label);
              const slotName = `${methodIdx + 1}-${signature.name}`;
              const inputSlot = this.inputs.find(
                (i) => i.name === slotName && i.id === p.id,
              );

              if (
                p.isSlot &&
                inputSlot &&
                this.isInputConnected(this.inputs.indexOf(inputSlot))
              ) {
                // 从连接的 FunctionBlock 获取函数占位符
                return this.getInputData(this.inputs.indexOf(inputSlot)) || "undefined";
              }
              return "undefined";
            }

            if (p.isSlot) {
              const inputSlot = this.inputs.find((i) => i.id === p.id);
              return inputSlot
                ? this.getInputData(this.inputs.indexOf(inputSlot))
                : "undefined";
            }
            return p.value || "undefined";
          })
          .join(", ");

        if (method.methodName === "length") {
          finalExpression = `${finalExpression}.length`;
        } else if (method.methodName === "${}") {
          finalExpression = `\`\${${finalExpression}}\``;
        } else {
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
      // 使用三元组结构读取 outputVar
      let declVar;
      if (props.outputVar?.isSlot) {
        const inputSlot = this.inputs.find((i) => i.id === props.outputVar.id);
        declVar = inputSlot
          ? this.getInputData(this.inputs.indexOf(inputSlot))
          : "myString";
        // ⚠️ slot 模式：不加 export 和 declareType，只生成赋值
        this.jsCode = `${declVar} = ${finalExpression};`;
      } else {
        declVar = props.outputVar?.value || "myString";
        // 静态模式：拼接完整声明
        const exportStr = props.exported ? "export " : "";
        const declType = props.declareType || "const";
        this.jsCode = `${exportStr}${declType} ${declVar} = ${finalExpression};`;
      }

      // 输出变量名供下游节点使用
      this.setOutputData(this.findOutputSlot("outValue"), declVar);
    } else {
      this.jsCode = `${finalExpression};`;
      // 无返回值时输出 null
      this.setOutputData(this.findOutputSlot("outValue"), null);
    }
  }

  getMethodParamMap() {
    return {
      at: { hasReturnValue: true },
      charAt: { hasReturnValue: true },
      charCodeAt: { hasReturnValue: true },
      codePointAt: { hasReturnValue: true },
      concat: { hasReturnValue: true },
      endsWith: { hasReturnValue: true },
      includes: { hasReturnValue: true },
      indexOf: { hasReturnValue: true },
      lastIndexOf: { hasReturnValue: true },
      localeCompare: { hasReturnValue: true },
      match: { hasReturnValue: true },
      padEnd: { hasReturnValue: true },
      padStart: { hasReturnValue: true },
      repeat: { hasReturnValue: true },
      replace: { hasReturnValue: true },
      replaceAll: { hasReturnValue: true },
      search: { hasReturnValue: true },
      slice: { hasReturnValue: true },
      split: { hasReturnValue: true },
      startsWith: { hasReturnValue: true },
      substr: { hasReturnValue: true },
      substring: { hasReturnValue: true },
      toLocaleLowerCase: { hasReturnValue: true },
      toLocaleUpperCase: { hasReturnValue: true },
      toLowerCase: { hasReturnValue: true },
      toUpperCase: { hasReturnValue: true },
      toString: { hasReturnValue: true },
      trim: { hasReturnValue: true },
      trimEnd: { hasReturnValue: true },
      trimStart: { hasReturnValue: true },
      valueOf: { hasReturnValue: true },
      length: { hasReturnValue: true },
      "${}": { hasReturnValue: true },
    };
  }

  static get title() {
    return "String";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "5e8d8b4a-4b7c-4a4e-8b1a-9c7f2d4e5f6a";
  }
  static get treePath() {
    return "JavaScript";
  }
}
