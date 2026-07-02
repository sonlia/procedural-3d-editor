import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

// ================= If Node =================
export class defineIf extends nodeMeta {
  constructor() {
    super();

    // 初始化 properties（单一数据源）
    this.properties = {
      // 主条件（结构化条件数组）
      conditions: [
        {
          id: uid(),
          lhs: "",
          lhsIsSlot: false,
          op: "===",
          rhs: "",
          rhsIsSlot: false,
          connector: "&&",
        },
      ],

      // elseif 分支数组
      elseifBranches: [],

      // else 分支配置
      hasElse: false,

      remark: "",
    };

    // 声明输出槽
    this.addOutput("outValue", "string");

    // 指定属性面板
    this.uiPanel = defineAsyncComponent(() => import("./ifPanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};

    // 从 slot 获取值的辅助函数
    const getSlotValue = (slotName) => {
      const slot = this.inputs.find((s) => s.name === slotName);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 构建条件表达式
    const buildConditionExpr = (conditions, prefix = "If_") => {
      if (!Array.isArray(conditions) || conditions.length === 0) {
        return "true";
      }

      return conditions
        .map((cond, index) => {
          const getValue = (value, isSlot, side) => {
            if (isSlot) {
              // 从 slot 获取值（与 Panel 中命名一致）
              const slotName = `${prefix}${index}_${side}`;
              const slotValue = getSlotValue(slotName);
              return slotValue || "undefined";
            }
            // 基本字面量检测
            if (!isNaN(parseFloat(value)) && isFinite(value)) {
              return value; // 数字
            }
            if (value === "true" || value === "false") {
              return value; // 布尔值
            }
            if (value === "null" || value === "undefined") {
              return value;
            }
            // 如果包含变量名特征（字母开头），直接返回
            if (/^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(value)) {
              return value; // 变量名
            }
            return `"${value}"`; // 字符串
          };

          const lhs = getValue(cond.lhs, cond.lhsIsSlot, "l");
          const rhs = getValue(cond.rhs, cond.rhsIsSlot, "r");
          const op = cond.op || "===";

          let statement = `(${lhs} ${op} ${rhs})`;

          if (index < conditions.length - 1) {
            statement += ` ${cond.connector || "&&"} `;
          }

          return statement;
        })
        .join("");
    };

    // 获取主条件
    const mainCondition = buildConditionExpr(props.conditions);

    // 生成代码
    let jsCode = "";
    const remark = props.remark ? `/* ${props.remark} */\n` : "";
    jsCode += remark;

    // if 分支
    jsCode += `if (${mainCondition}) {\n  // if body\n}`;

    // elseif 分支
    if (Array.isArray(props.elseifBranches)) {
      props.elseifBranches.forEach((branch, branchIndex) => {
        const elseifCondition = buildConditionExpr(branch.conditions, `eif_${branchIndex + 1}_`);
        jsCode += ` else if (${elseifCondition}) {\n  // else if ${branchIndex} body\n}`;
      });
    }

    // else 分支
    if (props.hasElse) {
      jsCode += ` else {\n  // else body\n}`;
    }

    this.jsCode = jsCode;

    // 输出变量名
    this.setOutputData(this.findOutputSlot("outValue"), "ifStatement");
  }

  // 静态属性
  static get id() {
    return "1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d";
  }
  static get title() {
    return "If";
  }
  static get name() {
    return this.title;
  }
  static get treePath() {
    return "JavaScript";
  }
}
