import { Subgraph, uiNodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";
import { isFunctionParam, parseFunctionSignature } from "../utils.js";
import { forEach } from "lodash-es";

// ================= FunctionBlock Node (Subgraph) =================
export class FunctionBlock extends Subgraph {
  constructor() {
    super();

    // 初始化properties，符合单一数据源模式
    const funcName = `myFunction_${uid().slice(0, 8)}`;
    const funcOutId = uid(); // funcOut 的唯一 id

    this.properties = {
      // 基础声明控制
      exported: false,
      enableDeclaration: false, // 默认改为 false

      // 函数特有属性
      async: false,
      functionName: funcName, // 只保留functionName
      params: [], // 函数参数数组
      passIn: [], // 传入参数（数据流入节点）
      passOut: [], // 传出参数（数据流出节点）
      funcOutId: funcOutId, // funcOut slot 的 id

      remark: "",
    };

    this.isAnonymous = false;
    this.showPassInSlots = true;
    this.showPassOutSlots = true;

    // 符合规范的输出插槽类型配置
    // funcOut, funcName, outValue 在子图面板不显示
    this.addOutput("funcOut", "function", {
      shape: 5,
      id: funcOutId,
      isFuncOut: true,
      hideOnSubgraphPanel: true,
    });
    this.addOutput("funcName", "string", {
      hideOnSubgraphPanel: true,
    });
    this.addOutput("outValue", "string", {
      hideOnSubgraphPanel: true,
    });

    // The UI panel will manage the function's properties like name, params, etc.
    this.uiPanel = defineAsyncComponent(
      () => import("./functionBlockPanel.vue"),
    );
  }

  /**
   * 连接验证：当 funcOut 连接到 UI 节点的 slot 后，所有输出槽只能连接到 UI 节点
   * @param {number} outputSlot - 输出槽索引
   * @param {string} _inputType - 目标输入槽类型 (未使用)
   * @param {object} inputSlot - 目标输入槽信息
   * @param {object} inputNode - 目标节点
   * @param {string} _outputType - 输出槽类型 (未使用)
   * @returns {boolean} - true 允许连接，false 阻止连接
   */
  onConnectOutput(outputSlot, _inputType, inputSlot, inputNode, _outputType) {
    const output = this.outputs[outputSlot];

    // 检查当前正在连接的目标输入槽是否是 slot (S# 开头)
    const isConnectingToSlot = inputSlot?.name?.startsWith("S#");

    // 检查 funcOut 是否已经连接到 UI 节点的 slot (S# 开头)
    let hasSlotConnection = false;

    if (this.outputs && this.graph) {
      for (let i = 0; i < this.outputs.length; i++) {
        const out = this.outputs[i];
        if (out.name !== "funcOut" || !out.links?.length) continue;

        // 检查现有连接
        for (const linkId of out.links) {
          const link = this.graph.links?.[linkId];
          if (!link) continue;

          const targetNode = this.graph.getNodeById(link.target_id);
          const targetInput = targetNode?.inputs?.[link.target_slot];

          // 如果已经连接到 S# 开头的 slot (UI 节点的 slot)
          if (targetInput?.name?.startsWith("S#")) {
            hasSlotConnection = true;
            break;
          }
        }

        if (hasSlotConnection) break;
      }
    }

    // 如果 funcOut 正在连接到 slot 或者已经连接到 slot，则所有输出槽只能连接到 UI 节点
    if (isConnectingToSlot || hasSlotConnection) {
      // 检查目标节点是否是真正的 UI 节点（uiNodeMeta 的实例）
      const isUINode = inputNode instanceof uiNodeMeta;

      if (!isUINode) {
        console.warn(
          `⚠️ FunctionBlock 的 funcOut 连接到 UI 节点的 slot 后，所有输出槽（包括 ${output?.name}）只能连接到 UI 节点`,
        );
        return false; // 阻止连接
      }
    }

    return true; // 允许连接
  }

  /**
   * FunctionBlock 的连接变化处理
   * 统一调用基类方法处理所有 function 类型的 slot
   */
  onConnectionsChange(
    inputOrOutput,
    slot,
    isConnected,
    link_info,
    output_slot,
  ) {
    if (!link_info) return;

    const target_node = this.graph.getNodeById(link_info.target_id);
    if (!target_node) return;

    const target_slot_info = target_node.inputs[link_info.target_slot];
    if (!target_slot_info) return;
    const slotArgs = [];
    //目标节点 是ui节点
    if (target_node.categories === "ui") {
      if (target_slot_info.name.startsWith("S#")) {
        const slotScope =
          target_node?.nodeRawData.slots?.[target_slot_info.slotName]?.scope;
        if (slotScope) {
          slotArgs.push(...Object.keys(slotScope));
        } else if (Array.isArray(target_slot_info.meta?.args)) {
          slotArgs.push(...target_slot_info.meta.args);
        }
      }
      if (target_slot_info.name.startsWith("E#")) {
        const eventName = target_slot_info.name.substring(2);
        const eventData = target_node?.nodeRawData.events?.[eventName];
        if (eventData?.params) {
          slotArgs.push(...Object.keys(eventData.params));
        } else if (Array.isArray(target_slot_info.meta?.args)) {
          slotArgs.push(...target_slot_info.meta.args);
        }
      }
    } else {
      if (target_slot_info.type !== "function") return;

      // 优先从 slot 的 meta.args 获取参数（如 JSON 节点的 replacer/reviver）
      if (
        target_slot_info.meta?.args &&
        Array.isArray(target_slot_info.meta.args)
      ) {
        slotArgs.push(...target_slot_info.meta.args);
      } else {
        // 回退：从 methods 属性获取（兼容旧逻辑）
        forEach(target_node?.properties?.methods, (item) => {
          forEach(item.params, (p) => {
            const isFunc = isFunctionParam(p.value);
            if (isFunc) {
              // 正则匹配括号内的内容，并分割参数
              const match = p.value.match(/\(([^)]*)\)/);
              if (match) {
                const params = match[1].split(",").map((param) => param.trim());
                slotArgs.push(...params);
              } else {
                console.log("未匹配到参数");
              }
            } else {
              if (item !== "...") {
                slotArgs.push(item);
              }
            }
          });
        });
      }
    }
    if (isConnected) {
      if (output_slot.name === "funcOut") {
        // funcOut 连接：只隐藏内置 orderOut + funcName（funcOut 是匿名箭头时它们无意义）
        // outValue 与用户添加的 passOut slot 保持显示，避免误隐藏用户配置
        this.toggleOutputSlotsHideOnNode(["orderOut", "funcName"], true);
      } else {
        this.toggleOutputSlotsHideOnNode(["funcOut"], true);
      }

      // 连接时: 添加输入槽

      if (slotArgs.length > 0) {
        slotArgs.forEach((argName, index) => {
          // 简单判断: 只要包含括号就是函数
          const isCallback = isFunctionParam(argName);

          this.addInput(argName, "string", {
            parentid: slot,
            shape: isCallback ? 5 : 3,
            isFunction: isCallback,
            slotType: isCallback ? "function" : "*",
            argIndex: index,
            hideOnNode: true,
            // 参数槽取值策略：
            //  - 普通参数 → 'label'(子图内拿参数名字符串，直接当变量名用)
            //  - isFunction 回调 → 'value'(子图内拿 wire 真值，即上游 funcOut 的 __FUNC_<id>__ 占位符；
            //    Assembler 再替换为完整箭头函数)
            valueMode: isCallback ? "value" : "label",
          });
        });
      }
    } else {
      // disconnect: 仅恢复输出 slot 显示，isAnonymous 由 onExecute 实时计算
      if (output_slot.name === "funcOut") {
        this.toggleOutputSlotsHideOnNode(["funcName", "orderOut"], false);
      } else {
        this.toggleOutputSlotsHideOnNode(["funcOut"], false);
      }

      if (slotArgs.length > 0) {
        const result = this.inputs.filter(
          (item) => !slotArgs.includes(item.name),
        );

        this.inputs = result;
      }
    }

    // 刷新节点显示
    this.setSize(this.computeSize());
    this.setDirtyCanvas(true, true);
  }

  /**
   * 反序列化兼容：老项目的 params slot 不带 valueMode，加载后默认 'value' 模式
   * 与新规则(普通=label, isFunction=value)不一致。这里按 slot 形态补标志:
   *  - orderSlot / funcNameInput / passIn 跳过(走默认 value 已满足)
   *  - type==='function' 或 isFunction===true → 'value'(isFunction 回调)
   *  - 其他 params(string 类型且非 passIn) → 'label'(普通参数)
   */
  onConfigure(o) {
    super.onConfigure?.(o);
    this.showPassInSlots = o?.showPassInSlots !== false;
    this.showPassOutSlots = o?.showPassOutSlots !== false;
    if (Array.isArray(this.inputs)) {
      for (const input of this.inputs) {
        if (!input) continue;
        if (input.valueMode) continue;
        if (input.type === "orderSlot") continue;
        if (input.id === "funcNameInput") continue;
        if (input.isPassIn) continue;
        const isCallback = input.type === "function" || input.isFunction === true;
        input.valueMode = isCallback ? "value" : "label";
      }
    }
    this.applyPassSlotVisibility();
  }

  serialize() {
    const data = super.serialize();
    data.showPassInSlots = this.showPassInSlots !== false;
    data.showPassOutSlots = this.showPassOutSlots !== false;
    return data;
  }

  applyPassSlotVisibility() {
    const props = this.properties || {};
    const passInIds = new Set((props.passIn || []).map((p) => p.id));
    const passOutIds = new Set((props.passOut || []).map((p) => p.id));
    const hidePassIn = this.showPassInSlots === false;
    const hidePassOut = this.showPassOutSlots === false;

    if (Array.isArray(this.inputs)) {
      for (const input of this.inputs) {
        if (!input) continue;
        if (input.isPassIn || passInIds.has(input.id)) {
          input.hideOnNode = hidePassIn;
        }
      }
    }

    if (Array.isArray(this.outputs)) {
      for (const output of this.outputs) {
        if (!output) continue;
        if (passOutIds.has(output.id)) {
          output.hideOnNode = hidePassOut;
        }
      }
    }

    this.setSize?.(this.computeSize?.());
  }

  onExecute() {
    this.applyPassSlotVisibility();
    // 实时计算 isAnonymous：基于 funcOut slot 的当前连接状态判定
    // 不依赖 onConnectionsChange 缓存（反序列化加载后会丢，且其他 slot 触发会错误重置）
    const funcOutIdx = this.findOutputSlot("funcOut");
    this.isAnonymous = funcOutIdx !== -1 && this.isOutputConnected(funcOutIdx);

    // super.onExecute() 会自动将所有 inputs（包括 passIn）的值传递给子图
    // 子图内的 GraphInput 节点通过 this.graph.getInputData(name) 获取这些值
    super.onExecute();

    const props = this.properties || {};
    const { async: isAsync, exported, functionName, enableDeclaration } = props;
    const asyncStr = isAsync ? "async " : "";

    const isAnonymous = this.isAnonymous;

    // 检查 funcNameInput slot 是否有连接
    let funcNameFromSlot = null;
    if (enableDeclaration) {
      const funcNameInputIndex = this.inputs?.findIndex(
        (i) => i.id === "funcNameInput",
      );
      if (
        funcNameInputIndex !== -1 &&
        this.isInputConnected(funcNameInputIndex)
      ) {
        funcNameFromSlot = this.getInputData(funcNameInputIndex);
      }
    }

    // 确定最终的函数名
    const funcName = funcNameFromSlot || functionName;

    // Build the parameter string from the params array (只包含函数参数，不包含 passIn)
    let paramsStr;
    if (isAnonymous) {
      const funcOutIndex = this.findOutputSlot("funcOut");
      const funcOutSlot = this.outputs[funcOutIndex];
      const linkId = funcOutSlot.links?.[0];
      if (linkId && this.graph) {
        const link = this.graph.links[linkId];
        if (link) {
          const targetNode = this.graph.getNodeById(link.target_id);
          const targetSlot = targetNode?.inputs?.[link.target_slot];
          if (targetSlot?.meta?.args && Array.isArray(targetSlot.meta.args)) {
            paramsStr = targetSlot.meta.args.join(", ");
          }
        }
      }
    } else {
      // 只取 params 中的参数名，排除 passIn 相关的 slot
      const passInIds = new Set((props.passIn || []).map((p) => p.id));
      paramsStr = Array.isArray(this.inputs)
        ? this.inputs
            .filter((p) => {
              // 排除 orderIn、funcNameInput 和 passIn 的 slot
              if (p.name === "orderIn" || p.name === "funcNameInput")
                return false;
              if (passInIds.has(p.id)) return false;
              return true;
            })
            .map((p) => p.name)
            .join(", ")
        : "";
    }

    // 使用占位符标记，实际代码由 codeAssembler.js 通过字符串替换填充
    // __SUBGRAPH_xxx__ 会被替换为子图中所有节点的代码
    const remark = this.properties.remark
      ? `/* ${this.properties.remark} */\n`
      : "";
    const bodyPlaceholder = `\n${remark}__SUBGRAPH_${this.id}__\n`;

    // 使用箭头函数格式
    let functionDef = `${asyncStr}(${paramsStr || ""}) => {${bodyPlaceholder}}`;

    // 如果 funcOut 有连接，生成无名箭头函数（不带声明和函数名）
    if (isAnonymous) {
      this.jsCode = functionDef;
    } else if (funcNameFromSlot) {
      // 从 slot 传入函数名时，不加 export 和声明类型，只做赋值
      this.jsCode = `${funcName} = ${functionDef};`;
    } else {
      // 否则生成带声明的命名函数
      const exportStr = exported ? "export " : "";
      this.jsCode = `${exportStr}const ${funcName} = ${functionDef};`;
    }

    // funcOut 输出占位符（用于函数替换）
    const funcOutSlot = this.findOutputSlot("funcOut");
    if (funcOutSlot !== -1) {
      this.setOutputData(funcOutSlot, `__FUNC_${this.id}__`);
    }

    // funcName 输出函数名称
    const funcNameSlot = this.findOutputSlot("funcName");
    if (funcNameSlot !== -1) {
      this.setOutputData(funcNameSlot, funcName);
    }

    // outValue 输出函数调用表达式，如 myFunction(arg0, arg1)
    const outValueSlot = this.findOutputSlot("outValue");
    if (outValueSlot !== -1) {
      const callExpr = `${funcName}(${paramsStr || ""})`;
      this.setOutputData(outValueSlot, callExpr);
    }

    // passOut 的数据由子图内部的 GraphOutput 节点通过 parentNode.setOutputData() 直接设置
    // 这里不需要再次处理，否则会覆盖 GraphOutput 设置的正确数据
  }

  /**
   * 重写基类 _appendDebugInjection:FunctionBlock 的 jsCode 是函数表达式/声明,
   * 不能用基类的"前后追加 statement"策略(会破坏被 inline 到 onClick 等表达式位置的语法)。
   *
   * 策略:体内注入。所有 probe 都放进函数体内,IIFE 包裹原 body 捕获 return 值给 outValue。
   *
   * - input probes:函数体首(参数通过闭包/wire 可见)
   * - funcName probe:函数体首,字符串字面量(funcName 是 codegen 助记符,非数据流)
   * - 原 body 用 IIFE 包裹,return 值赋给 __vs_outValue
   * - passOut probes:IIFE 内,body 之后(subgraph 内局部变量在此可见)
   * - outValue probe:IIFE 外 finally,读 __vs_outValue
   *
   * 兼容 isAnonymous(匿名箭头)和具名(`const x = async ...`)两种形态 ——
   * 用 brace-match 找函数体 `=> {` ... `}` 区间,beforeBody/afterBody 各自原样保留。
   */
  _appendDebugInjection() {
    const mode = this.properties?.__debugMode;
    if (!mode || mode === "off") return;
    if (!this.jsCode || typeof this.jsCode !== "string") return;

    if (mode === "trace" && this.jsCode.includes("__vsProbe(")) return;
    if (
      (mode === "breakpoint" || mode === "log") &&
      this.jsCode.includes("/* __vs_dbg */")
    )
      return;

    const isProbeable = (expr) => {
      if (typeof expr !== "string") return false;
      const trimmed = expr.trim();
      if (!trimmed) return false;
      if (!/^[A-Za-z_$]/.test(trimmed)) return false;
      if (trimmed.includes("-")) return false;
      return true;
    };

    // 收集 input probes:跳过 orderIn / funcNameInput / 未连线 / UUID 等
    const inSlots = [];
    if (Array.isArray(this.inputs)) {
      for (const input of this.inputs) {
        if (!input?.name) continue;
        if (input.type === "orderSlot") continue;
        if (input.name === "funcNameInput") continue;
        const linkId = input.link;
        if (linkId == null) continue;
        const link = this.graph?.links?.[linkId];
        const varExpr = link?.data;
        if (!isProbeable(varExpr)) continue;
        inSlots.push({ slot: input.name, expr: varExpr });
      }
    }

    // 收集 output 信息:
    //  - funcOut:_data 是 __FUNC_<uuid>__ 占位符(含 '-'),isProbeable 已过滤,跳过
    //  - funcName:probe 字符串字面量(properties.functionName)
    //  - outValue:probe IIFE 捕获的 __vs_outValue
    //  - 其余(passOut 等):用 output._data 表达式,放进 IIFE 内 body 之后
    const funcNameValue = this.properties?.functionName || "";
    const passOutSlots = [];
    let hasFuncName = false;
    let hasOutValue = false;
    if (Array.isArray(this.outputs)) {
      for (const output of this.outputs) {
        if (!output?.name) continue;
        if (output.type === "orderSlot") continue;
        if (output.name === "funcOut") continue;
        if (output.name === "funcName") {
          hasFuncName = !!funcNameValue;
          continue;
        }
        if (output.name === "outValue") {
          hasOutValue = true;
          continue;
        }
        const varName = output._data;
        if (!isProbeable(varName)) continue;
        passOutSlots.push({ slot: output.name, expr: varName });
      }
    }

    // 定位函数体 `=> {` ... 配对 `}` 区间
    const bodyOpenMatch = this.jsCode.match(/=>\s*\{/);
    if (!bodyOpenMatch) return;
    const bodyOpenEnd = bodyOpenMatch.index + bodyOpenMatch[0].length;

    let depth = 1;
    let bodyCloseStart = -1;
    for (let i = bodyOpenEnd; i < this.jsCode.length; i++) {
      const ch = this.jsCode[i];
      if (ch === "{") depth++;
      else if (ch === "}") {
        depth--;
        if (depth === 0) {
          bodyCloseStart = i;
          break;
        }
      }
    }
    if (bodyCloseStart === -1) return;

    const beforeBody = this.jsCode.slice(0, bodyOpenEnd);
    const body = this.jsCode.slice(bodyOpenEnd, bodyCloseStart);
    const afterBody = this.jsCode.slice(bodyCloseStart);

    const isAsync = !!this.properties?.async;
    const iifeHead = isAsync ? "async " : "";
    const awaitKw = isAsync ? "await " : "";

    const nodeIdLit = JSON.stringify(this.id);

    if (mode === "breakpoint") {
      // 体内函数首注 debugger;
      this.jsCode =
        beforeBody + "\n  /* __vs_dbg */ debugger;\n" + body + afterBody;
      return;
    }

    const buildProbe = (slot, expr, side) => {
      if (mode === "trace") {
        return `if (typeof __vsProbe === 'function') __vsProbe(${JSON.stringify(`${this.id}:${side}:${slot}`)}, ${expr}, { nodeId: ${nodeIdLit}, slot: ${JSON.stringify(slot)}, side: '${side}' });`;
      }
      // log
      return `console.log(${JSON.stringify(`[node:${this.id}.${side}:${slot}]`)}, ${expr});`;
    };

    const topLines = [];
    if (mode === "log") topLines.push("/* __vs_dbg */");
    for (const s of inSlots) topLines.push(buildProbe(s.slot, s.expr, "in"));
    if (hasFuncName)
      topLines.push(
        buildProbe("funcName", JSON.stringify(funcNameValue), "out"),
      );

    const innerEndLines = [];
    for (const s of passOutSlots)
      innerEndLines.push(buildProbe(s.slot, s.expr, "out"));

    const finallyLines = [];
    if (hasOutValue)
      finallyLines.push(buildProbe("outValue", "__vs_outValue", "out"));

    // 没有任何 probe 时直接返回
    if (
      topLines.length === 0 &&
      innerEndLines.length === 0 &&
      finallyLines.length === 0
    )
      return;

    const indent = (lines, pad) =>
      lines.map((l) => pad + l).join("\n");

    // IIFE 包裹 body:passOut 在内层 body 末(subgraph 局部变量可见),
    // outValue 在外层 finally(__vs_outValue 是闭包变量)
    const newBody =
      "\n" +
      (topLines.length ? indent(topLines, "  ") + "\n" : "") +
      "  let __vs_outValue;\n" +
      "  try {\n" +
      `    __vs_outValue = ${awaitKw}(${iifeHead}() => {${body}${innerEndLines.length ? "\n" + indent(innerEndLines, "      ") + "\n    " : ""}})();\n` +
      "  } finally {\n" +
      (finallyLines.length ? indent(finallyLines, "    ") + "\n" : "") +
      "  }\n" +
      "  return __vs_outValue;\n";

    this.jsCode = beforeBody + newBody + afterBody;
  }

  static get title() {
    return "FunctionBlock";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "e6f8b3a0-1e2d-4c3b-8a9f-4d5c6b7a8c9d";
  } // New unique ID
  static get treePath() {
    return "JavaScript";
  }
}
