import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineFunctionCall extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      expression: {
        id: uid(),
        isSlot: false,
        value: "",
      },
    };

    this.uiPanel = defineAsyncComponent(
      () => import("./functionCallPanel.vue"),
    );
  }

  onExecute() {
    const { expression } = this.properties;

    // 获取表达式
    let finalExpression;
    if (expression?.isSlot) {
      // slot 模式:从连接获取表达式
      const slot = this.inputs.find((s) => s.id === expression.id);
      if (slot) {
        const slotIndex = this.inputs.indexOf(slot);
        if (this.isInputConnected(slotIndex)) {
          finalExpression = this.getInputData(slotIndex);
        } else {
          finalExpression = "";
        }
      } else {
        finalExpression = "";
      }
    } else {
      // 静态模式:直接使用配置的值
      finalExpression = expression?.value || "";
    }

    // 生成代码
    this.jsCode = finalExpression ? `${finalExpression};` : "";
  }

  static get title() {
    return "FunctionCall";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "f8c9d3e2-4b1a-4c8f-9e2d-3a5b7c8d9e0f";
  }

  static get treePath() {
    return "JavaScript";
  }
}
