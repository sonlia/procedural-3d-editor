import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";
import { isFunctionParam } from "../utils.js";

// ================= Array Operation Node =================
export class defineArray extends nodeMeta {
  constructor() {
    super();

    this.addOutput("outValue", "string");
    // 懒加载 UI 面板
    this.uiPanel = defineAsyncComponent(() => import("./arrayPanel.vue"));
  }

  onExecute() {
    const props = this.properties;
    if (!props) return;
    // 获取源数组表达式
    let finalExpression;
    const sourceParam = props.sourceParam;

    if (sourceParam?.isSlot) {
      const inputSlot = this.inputs.find((i) => i.id === sourceParam.id);
      finalExpression = inputSlot
        ? this.getInputData(this.inputs.indexOf(inputSlot))
        : "[]";
    } else {
      finalExpression = sourceParam?.value || "[]";
    }

    let lastMethodHasReturnValue = true;

    // 处理方法/属性/索引链
    if (Array.isArray(props.methods)) {
      const instanceMethodMap = this.getMethodParamMap();
      const staticMethodMap = this.getStaticMethodMap();

      props.methods.forEach((method, methodIdx) => {
        if (!method.methodName) return;

        // === 索引访问处理 ===
        if (method.methodName === "[index]") {
          const accessChain = method.accessChain || [];
          const accessExpr = accessChain
            .map((item) => {
              let indexExpr;
              if (item.isSlot) {
                const inputSlot = this.inputs.find((i) => i.id === item.slotId);
                indexExpr =
                  inputSlot &&
                  this.isInputConnected(this.inputs.indexOf(inputSlot))
                    ? this.getInputData(this.inputs.indexOf(inputSlot))
                    : "0";
              } else {
                indexExpr = item.value || "0";
              }
              return `[${indexExpr}]`;
            })
            .join("");
          finalExpression = `${finalExpression}${accessExpr}`;
          lastMethodHasReturnValue = true;
        }
        // === 静态方法处理 ===
        else if (staticMethodMap[method.methodName]) {
          const args = method.params
            .map((p) => {
              if (p.isSlot) {
                const inputSlot = this.inputs.find((i) => i.id === p.id);
                return inputSlot
                  ? this.getInputData(this.inputs.indexOf(inputSlot))
                  : "undefined";
              }
              return p.value || "undefined";
            })
            .join(", ");

          finalExpression = `Array.${method.methodName}(${args})`;
          const methodInfo = staticMethodMap[method.methodName];
          lastMethodHasReturnValue = methodInfo
            ? methodInfo.hasReturnValue
            : true;
        }
        // === length 属性处理 ===
        else if (method.methodName === "length") {
          finalExpression = `${finalExpression}.length`;
          lastMethodHasReturnValue = true;
        }
        // === 实例方法处理 ===
        else {
          const args = method.params
            .map((p) => {
              if (isFunctionParam(p.label)) {
                if (p.isSlot) {
                  const inputSlot = this.inputs.find((i) => i.id === p.id);
                  if (
                    inputSlot &&
                    this.isInputConnected(this.inputs.indexOf(inputSlot))
                  ) {
                    return this.getInputData(this.inputs.indexOf(inputSlot));
                  }
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

          finalExpression = `${finalExpression}.${method.methodName}(${args})`;

          if (methodIdx === props.methods.length - 1) {
            const methodInfo = instanceMethodMap[method.methodName];
            lastMethodHasReturnValue = methodInfo
              ? methodInfo.hasReturnValue
              : true;
          }
        }
      });
    }

    // 生成代码
    if (lastMethodHasReturnValue) {
      // 处理变量名：如果 enableDeclaration 为 true，从 slot 获取变量名
      let declVar;
      let isSlotMode = false;

      if (props.enableDeclaration) {
        const varNameSlot = this.inputs.find(
          (i) => i.id === props.varNameSlotId,
        );
        if (
          varNameSlot &&
          this.isInputConnected(this.inputs.indexOf(varNameSlot))
        ) {
          declVar = this.getInputData(this.inputs.indexOf(varNameSlot));
          isSlotMode = true; // slot 模式：外部传入变量名
        } else {
          declVar = props.outputVar || "myArray";
        }
      } else {
        declVar = props.outputVar || "myArray";
      }

      // ⚠️ slot 模式不加 export 和 declareType（外部传入的是纯变量名，用于赋值操作）
      if (isSlotMode) {
        this.jsCode = `${declVar} = ${finalExpression};`;
      } else {
        const exportStr = props.exported ? "export " : "";
        const declType = props.declareType || "let";
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

  getMethodParamMap() {
    // In a real scenario, this might be imported or defined statically
    return {
      push: { hasReturnValue: true },
      pop: { hasReturnValue: true },
      shift: { hasReturnValue: true },
      unshift: { hasReturnValue: true },
      splice: { hasReturnValue: true },
      sort: { hasReturnValue: true },
      reverse: { hasReturnValue: true },
      fill: { hasReturnValue: true },
      copyWithin: { hasReturnValue: true },
      slice: { hasReturnValue: true },
      concat: { hasReturnValue: true },
      map: { hasReturnValue: true },
      filter: { hasReturnValue: true },
      reduce: { hasReturnValue: true },
      flatMap: { hasReturnValue: true },
      indexOf: { hasReturnValue: true },
      lastIndexOf: { hasReturnValue: true },
      includes: { hasReturnValue: true },
      find: { hasReturnValue: true },
      findIndex: { hasReturnValue: true },
      forEach: { hasReturnValue: false },
      every: { hasReturnValue: true },
      some: { hasReturnValue: true },
      join: { hasReturnValue: true },
      toString: { hasReturnValue: true },
      length: { hasReturnValue: true },
    };
  }

  getStaticMethodMap() {
    return {
      from: { hasReturnValue: true },
      of: { hasReturnValue: true },
      isArray: { hasReturnValue: true },
    };
  }

  static get title() {
    return "Array";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "a3b4c5d6-e7f8-4a1b-9c2d-3e4f5a6b7c8d";
  } // 全局唯一 ID
  static get treePath() {
    return "JavaScript";
  }
}
