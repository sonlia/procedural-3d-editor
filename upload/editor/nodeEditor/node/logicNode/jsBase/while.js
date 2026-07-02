import { Subgraph } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

// ================= While Node =================
export class defineWhile extends Subgraph {
  constructor() {
    super();

    // 初始化 properties（单一数据源）
    this.properties = {
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
      passIn: [], // 传入参数（数据流入节点）
      passOut: [], // 传出参数（数据流出节点）
      remark: "",
    };

    this.uiPanel = defineAsyncComponent(() => import("./whilePanel.vue"));
  }

  onExecute() {
    super.onExecute();
    const props = this.properties;
    if (!props) {
      this.jsCode = "// While properties not configured";
      return;
    }

    // passIn/passOut 只传递变量名，不生成声明语句
    // 变量应该在外部已定义，通过 GraphInput/GraphOutput 在子图内部访问

    // Build the condition expression
    let conditionExpr = "true"; // Default to true if no conditions
    if (Array.isArray(props.conditions) && props.conditions.length > 0) {
      conditionExpr = props.conditions
        .map((cond, index) => {
          const getValue = (value, isSlot) => {
            if (isSlot) {
              return value || "undefined";
            }
            // Basic literal detection
            if (!isNaN(parseFloat(value)) && isFinite(value)) {
              return value; // It's a number
            }
            if (value === "true" || value === "false") {
              return value; // It's a boolean
            }
            if (value === "null" || value === "undefined") {
              return value;
            }
            return `"${value}"`; // Assume it's a string
          };

          const lhs = getValue(cond.lhs, cond.lhsIsSlot);
          const rhs = getValue(cond.rhs, cond.rhsIsSlot);
          const op = cond.op || "===";

          let statement = `(${lhs} ${op} ${rhs})`;

          if (index < props.conditions.length - 1) {
            statement += ` ${cond.connector || "&&"} `;
          }

          return statement;
        })
        .join("");
    }

    // Build loop body with subgraph placeholder
    const remark = props.remark ? `/* ${props.remark} */\n` : "";
    const loopBodyCode = `${remark}__SUBGRAPH_${this.id}__`;
    const loopStatement = `while (${conditionExpr}) {\n${loopBodyCode}\n}`;

    this.jsCode = loopStatement;

    // Handle data passthrough for dynamic outputs
    if (Array.isArray(props.passOut)) {
      props.passOut.forEach((p) => {
        const outSlot = this.findOutputSlot(p.name);
        if (outSlot !== -1) {
          this.setOutputData(outSlot, p.name);
        }
      });
    }
  }

  static get title() {
    return "WhileLoop";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "d5a2c1b3-a9c8-4e1f-a0e2-f3b4c5d6e7f8";
  }
  static get treePath() {
    return "JavaScript";
  }
}
