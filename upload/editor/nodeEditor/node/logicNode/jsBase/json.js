import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";
import { isFunctionParam } from "../utils.js";

// ================= JSON Operation Node =================
export class defineJson extends nodeMeta {
  constructor() {
    super();

    // 初始化 properties（符合三元组规范）
    const declareSlotId = uid();
    const mainInputSlotId = uid();
    this.properties = {
      exported: false,
      declareType: "const",
      declareIsSlot: false,
      declareSlotId,
      outputVar: `json_${uid().slice(0, 8)}`, // 唯一变量名
      operationType: "stringify",
      mainInputIsSlot: false,
      mainInputValue: "",
      mainInputSlotId,
      params: {
        stringify: [
          { id: uid(), label: "replacer(key, value)", isSlot: false, value: "" },
          { id: uid(), label: "space", isSlot: false, value: "" },
        ],
        parse: [
          { id: uid(), label: "reviver(key, value)", isSlot: false, value: "" },
        ],
      },
      remark: "",
    };

    this.addOutput("outValue", "string"); // 输出变量名
    this.uiPanel = defineAsyncComponent(() => import("./jsonPanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};
    if (!props) {
      this.jsCode = "// Properties not found";
      return;
    }

    const operationType = props.operationType || "stringify";
    const params = props.params || { stringify: [], parse: [] };
    const stringifyParams = params.stringify || [];
    const parseParams = params.parse || [];

    // 获取主输入值
    let mainInput;
    if (props.mainInputIsSlot) {
      const slot = this.inputs.find((i) => i.id === props.mainInputSlotId);
      if (slot && this.isInputConnected(this.inputs.indexOf(slot))) {
        mainInput = this.getInputData(this.inputs.indexOf(slot));
      } else {
        mainInput = null; // 未连接时标记为 null
      }
    } else {
      mainInput = props.mainInputValue || null;
    }

    // 如果主输入为空，生成提示代码
    if (!mainInput) {
      this.jsCode = "// JSON: 请配置输入值";
      return;
    }

    let expression = "";

    // 获取参数值，返回 null 表示未配置
    // 函数参数检查是否连接了 FunctionBlock（参考 uiNodeMeta 事件处理）
    const getParamValue = (param) => {
      if (!param) return null;

      const isFunc = isFunctionParam(param.label);

      if (!param.isSlot) {
        // 非 slot 模式，直接返回填写的值
        return param.value || null;
      }

      // slot 模式 - 从输入 slot 获取
      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;

      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;

      if (isFunc) {
        // 函数参数：检查是否连接了 FunctionBlock
        const link = this.inputs[slotIndex].link;
        if (link && this.graph) {
          const linkInfo = this.graph.links[link];
          if (linkInfo) {
            const sourceNode = this.graph._nodes_by_id[linkInfo.origin_id];
            if (
              sourceNode &&
              (sourceNode.type === "FunctionBlock" ||
                sourceNode.constructor.name === "FunctionBlock")
            ) {
              // 返回 FunctionBlock 的占位符
              return `__FUNC_${sourceNode.id}__`;
            }
          }
        }
        return null;
      } else {
        // 普通参数：直接获取输入数据
        return this.getInputData(slotIndex);
      }
    };

    if (operationType === "stringify") {
      // JSON.stringify(value[, replacer[, space]])
      const replacer = stringifyParams.find((p) =>
        p.label.startsWith("replacer"),
      );
      const space = stringifyParams.find((p) => p.label === "space");

      const replacerVal = getParamValue(replacer);
      const spaceVal = getParamValue(space);

      // 智能参数拼接
      let args = mainInput;
      if (replacerVal !== null || spaceVal !== null) {
        // 有可选参数时，replacer 用 null 占位（如果未配置）
        args += `, ${replacerVal !== null ? replacerVal : "null"}`;
        if (spaceVal !== null) {
          args += `, ${spaceVal}`;
        }
      }
      expression = `JSON.stringify(${args})`;
    } else {
      // JSON.parse(text[, reviver])
      const reviver = parseParams.find((p) => p.label.startsWith("reviver"));
      const reviverVal = getParamValue(reviver);

      let args = mainInput;
      if (reviverVal !== null) {
        args += `, ${reviverVal}`;
      }
      expression = `JSON.parse(${args})`;
    }

    // 生成最终代码
    let declVar;
    if (props.declareIsSlot) {
      // 从 slot 获取变量名
      const slot = this.inputs.find((i) => i.id === props.declareSlotId);
      if (slot && this.isInputConnected(this.inputs.indexOf(slot))) {
        declVar = this.getInputData(this.inputs.indexOf(slot));
      } else {
        declVar = null;
      }
    } else {
      declVar = props.outputVar || "jsonData";
    }

    if (!declVar) {
      this.jsCode = "// JSON: 请配置变量名";
      return;
    }

    // ⚠️ 关键：VarName slot 模式下不加 export 和 declareType
    if (props.declareIsSlot) {
      // 外部传入的是纯变量名，用于赋值操作
      this.jsCode = `${declVar} = ${expression};`;
    } else {
      // 静态模式：拼接完整声明
      const exportStr = props.exported ? "export " : "";
      const declType = props.declareType || "const";
      this.jsCode = `${exportStr}${declType} ${declVar} = ${expression};`;
    }

    const outSlot = this.findOutputSlot("outValue");
    if (outSlot !== -1) {
      this.setOutputData(outSlot, declVar);
    }
  }

  getMethodParamMap() {
    return {
      stringify: { hasReturnValue: true },
      parse: { hasReturnValue: true },
    };
  }

  static get title() {
    return "JSON";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "c2d3e4f5-a6b7-4c8d-9a0b-1e2d3c4b5a6f";
  } // New unique ID
  static get treePath() {
    return "JavaScript";
  }
}
