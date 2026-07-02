import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

// ================= RegExp Operation Node =================
export class defineRegExp extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `regex_${uid().slice(0, 8)}` },

      // 正则定义
      pattern: { id: uid(), isSlot: false, value: "" },
      flags: {
        g: false, // global
        i: false, // ignoreCase
        m: false, // multiline
        s: false, // dotAll
        u: false, // unicode
        y: false, // sticky
      },

      // 方法链
      methods: [],

      remark: "",
    };

    // 输出槽 - 统一使用 outValue
    this.addOutput("outValue", "string"); // 变量名输出

    this.uiPanel = defineAsyncComponent(() => import("./regExpPanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};

    // Helper: 获取参数值（支持 slot 模式）
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

    // Helper: 获取变量名（支持三元组结构）
    const getVarName = (outputVar) => {
      if (typeof outputVar === "string") return outputVar || "regex";
      if (outputVar?.isSlot) {
        const slot = this.inputs.find((s) => s.id === outputVar.id);
        if (slot && this.isInputConnected(this.inputs.indexOf(slot))) {
          return this.getInputData(this.inputs.indexOf(slot));
        }
        return null;
      }
      return outputVar?.value || "regex";
    };

    // 1. 获取 pattern
    const patternValue = getParamValue(props.pattern);
    if (!patternValue && !props.pattern?.value) {
      this.jsCode = "// RegExp: 请配置正则表达式模式";
      return;
    }

    // 2. 构建 flags 字符串
    const flagKeys = ["g", "i", "m", "s", "u", "y"];
    const flagsStr = flagKeys.filter((k) => props.flags?.[k]).join("");

    // 3. 生成正则表达式
    let regExpExpr;
    if (props.pattern?.isSlot) {
      // 动态 pattern，使用 new RegExp()
      const patternExpr = patternValue || '""';
      regExpExpr = flagsStr
        ? `new RegExp(${patternExpr}, '${flagsStr}')`
        : `new RegExp(${patternExpr})`;
    } else {
      // 静态 pattern，使用字面量
      const patternStr = props.pattern?.value || "";
      regExpExpr = `/${patternStr}/${flagsStr}`;
    }

    // 4. 应用方法链
    let finalExpr = regExpExpr;
    let lastMethodHasReturn = true;
    const methodParamMap = this.getMethodParamMap();

    if (Array.isArray(props.methods) && props.methods.length > 0) {
      props.methods.forEach((method, idx) => {
        if (!method.methodName) return;

        // 构建参数
        const args = (method.params || [])
          .map((p) => {
            const val = getParamValue(p);
            return val !== null ? val : "undefined";
          })
          .join(", ");

        finalExpr = `${finalExpr}.${method.methodName}(${args})`;

        if (idx === props.methods.length - 1) {
          const info = methodParamMap[method.methodName];
          lastMethodHasReturn = info?.hasReturnValue ?? true;
        }
      });
    }

    // 5. 生成最终代码
    const declVar = getVarName(props.outputVar);
    if (declVar === null) {
      this.jsCode = "// RegExp: 变量名 slot 未连接";
      return;
    }

    const outValueSlot = this.findOutputSlot("outValue");

    if (lastMethodHasReturn) {
      // ⚠️ 关键：VarName slot 模式不加 export 和 declareType
      if (props.outputVar?.isSlot) {
        // slot 模式：外部传入变量名，用于赋值操作
        this.jsCode = `${declVar} = ${finalExpr};`;
      } else {
        // 静态模式：拼接完整声明
        const exportStr = props.exported ? "export " : "";
        const declType = props.declareType || "const";
        this.jsCode = `${exportStr}${declType} ${declVar} = ${finalExpr};`;
      }

      // 设置输出
      if (outValueSlot !== -1) {
        this.setOutputData(outValueSlot, declVar);
      }
    } else {
      this.jsCode = `${finalExpr};`;
      if (outValueSlot !== -1) this.setOutputData(outValueSlot, undefined);
    }
  }

  getMethodParamMap() {
    return {
      test: { params: ["str"], hasReturnValue: true },
      exec: { params: ["str"], hasReturnValue: true },
    };
  }

  static get title() {
    return "RegExp";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "a7b8c9d0-e1f2-4a3b-c4d5-e6f7a8b9c0d1";
  }
  static get treePath() {
    return "JavaScript";
  }
}
