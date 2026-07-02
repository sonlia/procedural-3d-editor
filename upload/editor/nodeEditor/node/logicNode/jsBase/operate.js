import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineOperate extends nodeMeta {
  constructor() {
    super();

    // 初始化 properties
    // 变量名默认值遵循规则：`${prefix}_${uid().slice(0, 8)}`
    this.properties = {
      exported: false,
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: `result_${uid().slice(0, 8)}` },
      initial: null, // 初始值配置
      operations: [], // 操作项列表：[{ id, operator, isSlot, value, prefixOperator }]
    };

    this.uiPanel = defineAsyncComponent(() => import("./operatePanel.vue"));
  }

  onExecute() {
    this.jsCode = "";

    const { initial, operations } = this.properties || {};

    // 没有初始值，无法生成表达式
    if (!initial) return;

    // 构建初始值表达式
    let initialValue = "";
    const initialSlotIdx = this.inputs?.findIndex((s) => s.id === initial.id);
    if (initial.isSlot && initialSlotIdx !== -1 && this.isInputConnected(initialSlotIdx)) {
      initialValue = this.getInputData(initialSlotIdx);
    } else {
      initialValue = initial.value || "";
    }

    // 添加前缀运算符
    if (initial.prefixOperator && initial.prefixOperator.trim()) {
      initialValue = `${initial.prefixOperator}${initialValue}`;
    }

    // 构建完整表达式
    let finalExpr = initialValue;

    // 遍历操作项，构建链式表达式
    if (Array.isArray(operations)) {
      operations.forEach((op) => {
        // 获取操作数值
        let operandValue = "";
        const opSlotIdx = this.inputs?.findIndex((s) => s.id === op.id);
        if (op.isSlot && opSlotIdx !== -1 && this.isInputConnected(opSlotIdx)) {
          operandValue = this.getInputData(opSlotIdx);
        } else {
          operandValue = op.value || "";
        }

        // 添加前缀运算符
        if (op.prefixOperator && op.prefixOperator.trim()) {
          operandValue = `${op.prefixOperator}${operandValue}`;
        }

        // 拼接运算符和操作数
        if (operandValue) {
          finalExpr = `${finalExpr} ${op.operator} ${operandValue}`;
        }
      });
    }

    // 获取输出变量名（支持 slot）
    const outputVar = this.properties.outputVar || {};
    const varNameSlotIdx = this.inputs?.findIndex((s) => s.id === outputVar.id);
    let varName = "";
    let isSlotMode = false;

    if (
      outputVar.isSlot &&
      varNameSlotIdx !== -1 &&
      this.isInputConnected(varNameSlotIdx)
    ) {
      varName = this.getInputData(varNameSlotIdx);
      isSlotMode = true;
    } else {
      varName = outputVar.value || "";
    }

    // 生成 jsCode
    // ⚠️ 关键：slot 模式不加 export 和 declareType（设计原则 11）
    if (varName) {
      if (isSlotMode) {
        // slot 模式：外部传入纯变量名，只生成赋值语句
        this.jsCode = `${varName} = ${finalExpr};`;
      } else {
        // 静态模式：拼接 export + declareType
        const exportStr = this.properties.exported ? "export " : "";
        const declareType = this.properties.declareType || "";
        if (declareType) {
          this.jsCode = `${exportStr}${declareType} ${varName} = ${finalExpr};`;
        } else {
          // 无声明类型时，也不加 export（export 只能用于声明）
          this.jsCode = `${varName} = ${finalExpr};`;
        }
      }
    } else {
      // 纯表达式（无变量名）
      this.jsCode = finalExpr;
    }

    // 输出到 outValue：有变量名则输出变量名，否则输出表达式
    const outIdx = this.findOutputSlot("outValue");
    if (outIdx !== -1) {
      this.setOutputData(outIdx, varName);
    }
  }

  static get title() {
    return "operate";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "a91cf4d2-481b-4eeb-8275-9c4f13a30b41";
  }

  static get treePath() {
    return "JavaScript";
  }
}
