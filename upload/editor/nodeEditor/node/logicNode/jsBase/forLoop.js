import { Subgraph } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

// ================= ForLoop Node =================
export class defineForLoop extends Subgraph {
  constructor() {
    super();

    const loopVarSlotId = uid();

    this.properties = {
      loopType: "for...of",
      iterableIsSlot: false,
      iterableValue: "",
      iterableSlotId: uid(),
      keyVar: "item",
      initVar: "i",
      initValue: "0",
      initValueIsSlot: false,
      initValueSlotId: uid(),
      conditionOperator: "<",
      conditionValue: "5",
      conditionValueIsSlot: false,
      conditionValueSlotId: uid(),
      increment: "i++",
      passIn: [], // 传入参数（数据流入节点）
      passOut: [], // 传出参数（数据流出节点）
      loopVarSlotId: loopVarSlotId, // 循环变量槽的 id
      remark: "",
    };

    // 循环变量输入槽 - 只在子图内部显示（作为 GraphInput 可用）
    // for...of/for...in 时显示 keyVar，classic for 时显示 initVar
    // 类型为 string，isPassIn 不设置（GraphInput 会输出变量名）
    const loopVarSlotIndex = this.addInput("item", "string", {
      id: loopVarSlotId,
      hideOnNode: true, // 外部节点不显示
      hideOnSubgraphPanel: false, // 子图面板中显示（作为 GraphInput）
      isLoopVariable: true, // 标记为循环变量
    });
    // 手动确保属性被正确设置
    if (this.inputs[loopVarSlotIndex]) {
      this.inputs[loopVarSlotIndex].id = loopVarSlotId;
      this.inputs[loopVarSlotIndex].hideOnNode = true;
      this.inputs[loopVarSlotIndex].hideOnSubgraphPanel = false;
      this.inputs[loopVarSlotIndex].isLoopVariable = true;
    }

    this.uiPanel = defineAsyncComponent(() => import("./forLoopPanel.vue"));
  }

  onExecute() {
    super.onExecute();
    const props = this.properties;
    if (!props) {
      this.jsCode = "// ForLoop properties not configured";
      return;
    }

    const loopType = props.loopType || "for...of";

    // 获取循环变量名（槽名称已在面板中同步）
    const loopVarSlot = this.inputs.find((i) => i.id === props.loopVarSlotId);
    const loopVarName =
      loopVarSlot?.name ||
      (loopType === "for" ? props.initVar : props.keyVar) ||
      "item";

    // passIn/passOut 只传递变量名，不生成声明语句
    // 变量应该在外部已定义，通过 GraphInput/GraphOutput 在子图内部访问

    // Build loop body with subgraph placeholder
    const remark = props.remark ? `/* ${props.remark} */\n` : "";
    const loopBodyCode = `${remark}__SUBGRAPH_${this.id}__`;

    let loopStatement;

    if (loopType === "for...of" || loopType === "for...in") {
      // for...of / for...in 循环
      const iterableIsSlot = props.iterableIsSlot;
      const iterableSlotId = props.iterableSlotId;
      const iterableValue = props.iterableValue;

      let iterableExpr = "[]";
      if (iterableIsSlot) {
        const inputSlot = this.inputs.find((i) => i.id === iterableSlotId);
        if (
          inputSlot &&
          this.isInputConnected(this.inputs.indexOf(inputSlot))
        ) {
          iterableExpr = this.getInputData(this.inputs.indexOf(inputSlot));
        }
      } else {
        iterableExpr = iterableValue || "[]";
      }

      const keyword = loopType === "for...of" ? "of" : "in";
      loopStatement = `for (let ${loopVarName} ${keyword} ${iterableExpr}) {\n${loopBodyCode}\n}`;
    } else {
      // classic for loop
      let initValueExpr;
      if (props.initValueIsSlot) {
        const inputSlot = this.inputs.find(
          (i) => i.id === props.initValueSlotId,
        );
        initValueExpr =
          inputSlot && this.isInputConnected(this.inputs.indexOf(inputSlot))
            ? this.getInputData(this.inputs.indexOf(inputSlot))
            : "0";
      } else {
        initValueExpr = props.initValue || "0";
      }

      const conditionOperator = props.conditionOperator || "<";
      let conditionValueExpr;
      if (props.conditionValueIsSlot) {
        const inputSlot = this.inputs.find(
          (i) => i.id === props.conditionValueSlotId,
        );
        conditionValueExpr =
          inputSlot && this.isInputConnected(this.inputs.indexOf(inputSlot))
            ? this.getInputData(this.inputs.indexOf(inputSlot))
            : "0";
      } else {
        conditionValueExpr = props.conditionValue || "0";
      }
      const conditionExpr = `${loopVarName} ${conditionOperator} ${conditionValueExpr}`;

      const increment = props.increment || "i++";

      loopStatement = `for (let ${loopVarName} = ${initValueExpr}; ${conditionExpr}; ${increment}) {\n${loopBodyCode}\n}`;
    }

    this.jsCode = loopStatement;

    // passOut 的数据由子图内部的 GraphOutput 节点通过 parentNode.setOutputData() 设置
    // 这里不需要再次设置，否则会覆盖 GraphOutput 设置的正确数据
  }

  static get title() {
    return "ForLoop";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "c4d5e6f7-a8b9-4da0-b1c2-d3e4f5a6b7c8";
  }
  static get treePath() {
    return "JavaScript";
  }
}
