import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineAssign extends nodeMeta {
  constructor() {
    super();

    // 初始化一个赋值项数组
    this.properties = {
      assignments: [this.createAssignmentItem()],
    };

    this.addOutput("outValue", "string");
    this.uiPanel = defineAsyncComponent(() => import("./assignPanel.vue"));
  }

  // 创建单个赋值项的默认数据
  createAssignmentItem() {
    const nameSlotId = uid();
    const valueSlotId = uid();
    return {
      id: uid(),
      nameSlotId,
      valueSlotId,
      exported: false,
      declareType: "let",
      varName: `var_${uid().slice(0, 8)}`,
      isNameSlot: false,
      isValueSlot: false,
      slotValue: "",
    };
  }

  onExecute() {
    const { assignments = [] } = this.properties;

    if (!assignments.length) {
      this.jsCode = "";
      return;
    }

    const codeLines = [];
    const outputVars = [];

    // 遍历所有赋值项
    for (const assignment of assignments) {
      const {
        exported,
        declareType,
        varName,
        isNameSlot,
        isValueSlot,
        slotValue,
        nameSlotId,
        valueSlotId,
      } = assignment;

      // 获取变量名
      let finalVarName;
      if (isNameSlot) {
        const inputIndex = this.inputs.findIndex(
          (slot) => slot.id === nameSlotId,
        );
        if (inputIndex !== -1 && this.isInputConnected(inputIndex)) {
          finalVarName = this.getInputData(inputIndex);
        } else {
          finalVarName = "";
        }
      } else {
        finalVarName = varName;
      }

      if (!finalVarName) {
        continue;
      }

      // 获取值
      let value;
      if (isValueSlot) {
        const inputIndex = this.inputs.findIndex(
          (slot) => slot.id === valueSlotId,
        );
        if (inputIndex !== -1 && this.isInputConnected(inputIndex)) {
          value = this.getInputData(inputIndex);
        } else {
          value = "undefined";
        }
      } else {
        value = slotValue || "undefined";
      }

      // isNameSlot 时外部传入完整变量名，不加 declareType
      if (isNameSlot) {
        codeLines.push(`${finalVarName} = ${value};`);
      } else {
        const exportStr = exported ? "export " : "";
        codeLines.push(`${exportStr}${declareType} ${finalVarName} = ${value};`);
      }

      outputVars.push(finalVarName);
    }

    this.jsCode = codeLines.join("\n");

    // 输出第一个变量名（保持向后兼容）
    const outputIndex = this.outputs.findIndex(
      (slot) => slot.name === "outValue",
    );
    if (outputIndex !== -1 && outputVars.length > 0) {
      this.setOutputData(outputIndex, outputVars[0]);
    }
  }

  static get title() {
    return "Assign";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "a91cf4d2-481b-4eeb-8275-9c4f13a30b31";
  }

  static get treePath() {
    return "JavaScript";
  }
}
