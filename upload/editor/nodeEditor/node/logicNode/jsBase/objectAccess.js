import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

// ================= Object Access Node =================
export class defineObjectAccess extends nodeMeta {
  constructor() {
    super();
    // 输出：outValue
    this.addOutput("outValue", "string");

    this.properties = {
      operationType: "get", // 'get' or 'set'
      sourceIsSlot: false,
      sourceValue: "myObject",
      sourceSlotId: uid(),
      accessChain: [{ id: uid(), isSlot: false, value: "key", slotId: uid() }],
      // For 'get'
      declareType: "const",
      outputVar: { id: uid(), isSlot: false, value: "value" },
      defaultValueIsSlot: false,
      defaultValue: "undefined",
      defaultValueSlotId: uid(),
      // For 'set'
      setValueIsSlot: false,
      setValue: "undefined",
      setValueSlotId: uid(),
    };

    this.jsCode = "";
    this.importStr = "";

    this.uiPanel = defineAsyncComponent(
      () => import("./objectAccessPanel.vue"),
    );
  }

  onExecute() {
    const props = this.properties || {};
    const opType = props.operationType || "get";

    this.importStr = `import { ${opType} } from 'lodash-es';`;

    // Helper: 获取 slot 值（分散字段模式：isSlot, slotId, value）
    // 当 slot 开启但未连接时，使用 staticValue 作为后备
    const getSlotValue = (isSlot, slotId, staticValue, defaultVal) => {
      if (isSlot) {
        const slot = this.inputs?.find((s) => s.id === slotId);
        if (slot) {
          const slotIndex = this.inputs.indexOf(slot);
          if (this.isInputConnected(slotIndex)) {
            return this.getInputData(slotIndex);
          }
        }
        // slot 开启但未连接，使用 staticValue 作为后备
      }
      return staticValue !== undefined && staticValue !== ""
        ? staticValue
        : defaultVal;
    };

    // 获取 source（始终有值：slot 连接值 或 sourceValue）
    const sourceExpr = getSlotValue(
      props.sourceIsSlot,
      props.sourceSlotId,
      props.sourceValue,
      "obj",
    );

    const outValueSlot = this.findOutputSlot("outValue");

    // 构建访问路径（lodash 格式）
    const pathParts = [];
    (props.accessChain || []).forEach((item) => {
      if (!item) return;
      if (item.isSlot) {
        const memberSlot = this.inputs?.find((s) => s.id === item.slotId);
        if (
          memberSlot &&
          this.isInputConnected(this.inputs.indexOf(memberSlot))
        ) {
          const slotValue = this.getInputData(this.inputs.indexOf(memberSlot));
          if (slotValue) {
            pathParts.push(slotValue);
          }
        } else if (item.value) {
          // slot 未连接时用静态值
          pathParts.push(item.value);
        }
      } else {
        const val = item.value || "";
        if (val) {
          pathParts.push(val);
        }
      }
    });
    // lodash get/set 使用点分路径
    const pathExpr = pathParts.length > 0 ? pathParts.join(".") : "";

    if (opType === "get") {
      // 获取默认值
      const defaultVal = getSlotValue(
        props.defaultValueIsSlot,
        props.defaultValueSlotId,
        props.defaultValue,
        "undefined",
      );

      // 生成访问表达式
      let accessExpression;
      if (pathExpr) {
        if (defaultVal && defaultVal !== "undefined") {
          accessExpression = `get(${sourceExpr}, '${pathExpr}', ${defaultVal})`;
        } else {
          accessExpression = `get(${sourceExpr}, '${pathExpr}')`;
        }
      } else {
        // 路径为空时，直接访问 source
        accessExpression = sourceExpr;
      }

      // 获取输出变量名
      // source toggle 开启时：从 slot 获取变量名
      // source toggle 关闭时：使用 outputVar.value 或默认 "value"
      let outputVarName;
      if (props.sourceIsSlot) {
        // 从 source slot 获取变量名
        const sourceSlot = this.inputs?.find((s) => s.id === props.sourceSlotId);
        if (sourceSlot) {
          const slotIndex = this.inputs.indexOf(sourceSlot);
          if (this.isInputConnected(slotIndex)) {
            outputVarName = this.getInputData(slotIndex);
          }
        }
        outputVarName = outputVarName || props.outputVar?.value || "value";
        // 使用 let 因为变量名来自外部
        this.jsCode = `let ${outputVarName} = ${accessExpression};`;
      } else {
        outputVarName = props.outputVar?.value || "value";
        const declType = props.declareType || "const";
        this.jsCode = `${declType} ${outputVarName} = ${accessExpression};`;
      }

      // Get 模式：outValue 输出声明的变量名
      if (outValueSlot !== -1) {
        this.setOutputData(outValueSlot, outputVarName);
      }
    } else {
      // opType === 'set'
      const valueToSetExpr = getSlotValue(
        props.setValueIsSlot,
        props.setValueSlotId,
        props.setValue,
        "undefined",
      );

      if (pathExpr) {
        this.jsCode = `set(${sourceExpr}, '${pathExpr}', ${valueToSetExpr});`;
      } else {
        this.jsCode = `// 请配置访问路径`;
      }

      // set 模式：outValue 输出 source（支持链式操作）
      if (outValueSlot !== -1) {
        this.setOutputData(outValueSlot, sourceExpr);
      }
    }
  }

  static get title() {
    return "Object Access(Lodash)";
  }
  static get name() {
    return "Object Access(Lodash)";
  }
  static get id() {
    return "c6d7e8f9-a0b1-4c2d-be3f-4a5b6c7d8e9f";
  }
  static get treePath() {
    return "JavaScript";
  }
}
