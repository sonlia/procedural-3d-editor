import { nodeMeta, uiNodeMeta } from "../nodeMetea.js";
import { LiteGraph } from "litegraph.js";
import { defineAsyncComponent } from "vue";
import { uid } from "quasar";

export class defineVueReactivity extends nodeMeta {
  constructor() {
    super();
    this.properties = {
      reactivityItems: [this.createReactivityItem()],
    };

    this.syncOutputSlots();
    this.uiPanel = defineAsyncComponent(() => import("./reactivityPanel.vue"));
  }

  createReactivityItem() {
    return {
      id: uid(),
      exported: false,
      declareType: "const",
      varName: { id: uid(), isSlot: false, value: `ref_${uid().slice(0, 8)}` },
      reactivityApi: "ref",
      initialValue: { id: uid(), isSlot: false, value: "" },
    };
  }

  getOutputSlotName(index) {
    return `outvalue-${index + 1}`;
  }

  getOutputValue(varName, reactivityApi) {
    return ["ref", "shallowRef"].includes(reactivityApi)
      ? `${varName}.value`
      : varName;
  }

  syncOutputSlots() {
    const reactivityItems = this.properties?.reactivityItems || [];

    reactivityItems.forEach((item, index) => {
      const slotName = this.getOutputSlotName(index);
      let existingIndex = this.outputs?.findIndex((output) => output.id === item.id) ?? -1;

      if (existingIndex === -1 && index === 0) {
        existingIndex = this.findOutputSlot("outValue");
        if (existingIndex !== -1) {
          this.outputs[existingIndex].id = item.id;
        }
      }

      if (existingIndex === -1) {
        this.addOutput(slotName, "string", { id: item.id });
        return;
      }

      const output = this.outputs[existingIndex];
      output.name = slotName;
      output.type = "string";
    });

    if (!this.outputs) return;

    for (let index = this.outputs.length - 1; index >= 0; index -= 1) {
      const output = this.outputs[index];
      const isReactivityOutput = /^outvalue-\d+$/.test(output.name);
      const hasItem = reactivityItems.some((item) => item.id === output.id);

      if (isReactivityOutput && !hasItem) {
        this.removeOutput(index);
      }
    }
  }

  onExecute() {
    const { reactivityItems = [] } = this.properties;

    this.syncOutputSlots();

    if (!reactivityItems.length) {
      this.jsCode = "";
      this.importStr = "";
      return;
    }

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    const codeLines = [];
    const importApis = new Set();
    const outputVars = [];

    // 合法 JS 标识符: 起始 [A-Za-z_$], 后续 [A-Za-z0-9_$]
    // 拒绝 UUID 等含 '-' 的字符串 (会作为左值赋值导致 SFC 编译失败)
    const isValidIdentifier = (name) =>
      typeof name === 'string' && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name);

    for (const item of reactivityItems) {
      // 处理变量名三元组
      let varName = "myVar";
      let declPrefix = "";
      if (item.varName?.isSlot) {
        varName = getParamValue(item.varName) || "myVar";
      } else {
        varName = item.varName?.value || "myVar";
        const exportStr = item.exported ? "export " : "";
        declPrefix = `${exportStr}${item.declareType || "const"} `;
      }

      // 兜底:varName 不是合法 JS 标识符时 fallback 到稳定默认值,避免生成非法代码
      if (!isValidIdentifier(varName)) {
        console.warn(
          `[defineVueReactivity] varName "${varName}" 不是合法 JS 标识符,使用 fallback`,
        );
        varName = `ref_${(item.id || '').replace(/-/g, '').slice(0, 8) || 'fallback'}`;
      }

      // 处理初始值三元组
      const initialValue = getParamValue(item.initialValue) || "undefined";

      const reactivityApi = item.reactivityApi || "ref";
      importApis.add(reactivityApi);

      codeLines.push(`${declPrefix}${varName} = ${reactivityApi}(${initialValue});`);

      outputVars.push({
        id: item.id,
        varName,
        reactivityApi,
      });
    }

    // 合并所有 import
    if (importApis.size > 0) {
      this.importStr = `import { ${Array.from(importApis).join(", ")} } from 'vue';`;
    } else {
      this.importStr = "";
    }

    this.jsCode = codeLines.join("\n");

    outputVars.forEach(({ id, varName, reactivityApi }) => {
      const outputIndex = this.outputs?.findIndex((output) => output.id === id) ?? -1;
      if (outputIndex !== -1) {
        this.setOutputData(outputIndex, this.getOutputValue(varName, reactivityApi));
      }
    });
  }

  static get title() {
    return "Reactivity";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "a91cf4d2-481b-4eeb-8275-9c4f13a30b32";
  }

  static get treePath() {
    return "Vue";
  }
}

export class defineVueUtils extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      apiName: "isRef",
      params: [{ name: "value", value: "", isSlot: false, slotId: uid() }],
      exported: false,
      declareType: "const",
      // 变量名三元组结构
      outputVar: {
        id: uid(),
        isSlot: false,
        value: `result_${uid().slice(0, 8)}`,
      },
    };

    // Add initial slots based on default properties
    this.properties.params.forEach((p) => {
      if (p.isSlot) {
        this.addInput(p.name, "string", { id: p.slotId });
      }
    });

    // 输出 slot 命名为 outValue，类型为 string
    this.addOutput("outValue", "string");

    this.uiPanel = defineAsyncComponent(() => import("./utilsPanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};
    const { apiName, params, declareType, exported } = props;

    if (!apiName || !params) {
      this.jsCode = "";
      return;
    }

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;
      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 处理变量名三元组
    let outputVar = `result_${uid().slice(0, 8)}`;
    let declPrefix = "";
    if (props.outputVar?.isSlot) {
      // slot 模式：外部传入完整声明，不加 export 和 declareType
      outputVar = getParamValue(props.outputVar) || outputVar;
    } else {
      // 静态模式：拼接 export + declareType
      outputVar = props.outputVar?.value || outputVar;
      const exportStr = exported ? "export " : "";
      declPrefix = `${exportStr}${declareType || "const"} `;
    }

    if (!outputVar) {
      this.jsCode = "";
      return;
    }

    this.importStr = ""; // Reset
    if (apiName === "useTemplateRef") {
      this.importStr = `import { useTemplateRef } from '@vueuse/core';`;
    } else if (apiName) {
      this.importStr = `import { ${apiName} } from 'vue';`;
    }

    const args = params
      .map((p) => {
        if (p.isSlot) {
          const slot = this.inputs.find((s) => s.id === p.slotId);
          if (slot && this.isInputConnected(this.inputs.indexOf(slot))) {
            return this.getInputData(this.inputs.indexOf(slot));
          }
          return "undefined";
        }
        return p.value || "undefined";
      })
      .join(", ");

    this.jsCode = `${declPrefix}${outputVar} = ${apiName}(${args});`;

    const outSlot = this.findOutputSlot("outValue");
    if (outSlot !== -1) {
      this.setOutputData(outSlot, outputVar);
    }
  }

  static get title() {
    return "VueUtils";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "b92cf5e3-582c-4fef-9285-9c5f14a41c23";
  }
  static get treePath() {
    return "Vue";
  }
}

export class defineVueComputed extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      exported: false,
      declareType: "const",
      // 变量名三元组
      outputVar: {
        id: uid(),
        isSlot: false,
        value: `comp_${uid().slice(0, 8)}`,
      },
      // 函数参数配置 - get 默认开启 slot
      getFunc: { id: uid(), isSlot: true, label: "get()" },
      setFunc: { id: uid(), isSlot: false, label: "set(newValue)" },
    };

    this.addOutput("outValue", "string");

    // 默认添加 get 的 input slot
    this.addInput("get", "function", {
      id: this.properties.getFunc.id,
      shape: 5,
      meta: { args: [] },
    });

    this.uiPanel = defineAsyncComponent(() => import("./computedPanel.vue"));
  }

  onExecute() {
    const props = this.properties;
    if (!props) return;

    // 获取变量名（三元组处理）
    let declVar = `comp_${uid().slice(0, 8)}`;
    let declPrefix = "";

    if (props.outputVar?.isSlot) {
      // slot 模式：外部传入完整变量名，不加 declareType
      const slot = this.inputs.find((i) => i.id === props.outputVar.id);
      if (slot) {
        const idx = this.inputs.indexOf(slot);
        if (this.isInputConnected(idx)) {
          declVar = this.getInputData(idx);
        }
      }
      // slot 模式不加声明前缀
    } else {
      // 静态模式：拼接 export + declareType
      declVar = props.outputVar?.value || declVar;
      const exportPrefix = props.exported ? "export " : "";
      declPrefix = `${exportPrefix}${props.declareType || "const"} `;
    }

    if (!declVar) {
      this.jsCode = "";
      return;
    }

    this.importStr = `import { computed } from 'vue';`;

    // 获取 get 函数
    let getExpr = "undefined";
    if (props.getFunc?.isSlot) {
      const getInput = this.inputs.find((i) => i.id === props.getFunc.id);
      if (getInput && this.isInputConnected(this.inputs.indexOf(getInput))) {
        getExpr = `__FUNC_${props.getFunc.id}__`;
      }
    }

    // 获取 set 函数
    let setExpr = null;
    if (props.setFunc?.isSlot) {
      const setInput = this.inputs.find((i) => i.id === props.setFunc.id);
      if (setInput && this.isInputConnected(this.inputs.indexOf(setInput))) {
        setExpr = `__FUNC_${props.setFunc.id}__`;
      }
    }

    // 生成代码 - 始终使用对象形式，因为占位符代表函数
    let finalExpression;
    if (setExpr) {
      // Writable computed
      finalExpression = `computed({
  get: ${getExpr},
  set: ${setExpr}
})`;
    } else {
      // Read-only computed - 也用对象形式
      finalExpression = `computed({
  get: ${getExpr}
})`;
    }

    this.jsCode = `${declPrefix}${declVar} = ${finalExpression};`;

    // 输出变量名
    this.setOutputData(this.findOutputSlot("outValue"), declVar);
  }

  static get title() {
    return "Computed";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "d2c3e4f5-a6b7-8c9d-0e1f-2a3b4c5d6e7f";
  }
  static get treePath() {
    return "Vue";
  }
}

export class defineVueWatch extends nodeMeta {
  constructor() {
    super();

    // 生成唯一后缀，用于解构变量命名，避免多个 watch 节点变量冲突
    const varSuffix = uid().slice(0, 8);

    this.properties = {
      // 默认使用 watchEffect 模式
      useWatchEffect: true,
      // watch 模式下的监听源
      // isFunction: true 表示 source 是 getter 函数，如 () => state.count
      sources: [{ id: uid(), value: "", isSlot: true, isFunction: false }],
      // watch 模式下的选项
      options: {
        deep: false,
        immediate: false,
      },
      // 解构变量的唯一后缀
      varSuffix,
    };

    // effect 是函数参数，当前节点消费它，所以用 addInput
    this.addInput("effect", "function", {
      id: uid(),
      shape: 5,
      meta: { args: [] },
    });

    // 输出控制函数
    this.addOutput("stop", "string");
    this.addOutput("pause", "string");
    this.addOutput("resume", "string");

    this.uiPanel = defineAsyncComponent(() => import("./watchPanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};
    const { useWatchEffect, sources, options, varSuffix } = props;

    // 生成带后缀的唯一变量名
    const stopVar = `stop_${varSuffix}`;
    const pauseVar = `pause_${varSuffix}`;
    const resumeVar = `resume_${varSuffix}`;

    // 获取函数 input slot
    const effectSlotIndex = this.findInputSlot("effect");
    const effectSlot = this.inputs[effectSlotIndex];
    const effectId = effectSlot?.id || "effect";

    if (useWatchEffect) {
      // ========== watchEffect 模式 ==========
      this.importStr = `import { watchEffect } from 'vue';`;

      if (effectSlot) {
        effectSlot.meta = { args: [] };
      }

      this.jsCode = `const { stop: ${stopVar}, pause: ${pauseVar}, resume: ${resumeVar} } = watchEffect(__FUNC_${effectId}__);`;
    } else {
      // ========== watch 模式 ==========
      this.importStr = `import { watch } from 'vue';`;

      if (!sources || sources.length === 0) {
        this.jsCode = `// watch: no source provided`;
        this.setOutputData(this.findOutputSlot("stop"), stopVar);
        this.setOutputData(this.findOutputSlot("pause"), pauseVar);
        this.setOutputData(this.findOutputSlot("resume"), resumeVar);
        return;
      }

      // 1. Build watch sources
      const sourceExprs = sources.map((s, index) => {
        if (s.isSlot) {
          const slot = this.inputs.find((i) => i.id === s.id);
          const slotIndex = slot ? this.inputs.indexOf(slot) : -1;
          const isConnected =
            slotIndex !== -1 && this.isInputConnected(slotIndex);

          if (s.isFunction) {
            return `__FUNC_${s.id}__`;
          } else if (isConnected) {
            const inputData = this.getInputData(slotIndex);
            if (slot && slot.name !== inputData && inputData) {
              slot.name = inputData;
              this.graph?.setDirtyCanvas(true);
            }
            return inputData || s.value || "undefined";
          } else {
            return s.value || "undefined";
          }
        }
        return s.value || "undefined";
      });

      const sourceExpr =
        sourceExprs.length > 1 ? `[${sourceExprs.join(", ")}]` : sourceExprs[0];

      // 2. Build callback meta.args
      const getBaseName = (name) => {
        if (typeof name !== "string") return "val";
        if (name.startsWith("__FUNC_")) return "val";
        return name.replace(/ref$/i, "") || "val";
      };

      const sourceNames = sourceExprs.map((expr, i) =>
        sources[i].isFunction ? `val${i}` : getBaseName(expr),
      );

      let metaArgs = [];
      if (sourceNames.length === 1) {
        const baseName = sourceNames[0];
        metaArgs = [baseName, `${baseName}--prev`];
      } else if (sourceNames.length > 1) {
        metaArgs = sourceNames.flatMap((name) => [name, `${name}--prev`]);
      }

      if (effectSlot) {
        effectSlot.meta = { args: metaArgs };

        if (this.graph && effectSlot.link != null) {
          const link_info = this.graph.links[effectSlot.link];
          if (link_info) {
            const originNode = this.graph.getNodeById(link_info.origin_id);
            if (originNode?.updateOutputsFromTarget) {
              originNode.updateOutputsFromTarget();
            }
          }
        }
      }

      // 3. Build options
      const optionsArray = [];
      if (options?.deep) optionsArray.push("deep: true");
      if (options?.immediate) optionsArray.push("immediate: true");
      const optionsExpr =
        optionsArray.length > 0 ? `, { ${optionsArray.join(", ")} }` : "";

      // 4. Generate jsCode
      this.jsCode = `const { stop: ${stopVar}, pause: ${pauseVar}, resume: ${resumeVar} } = watch(${sourceExpr}, __FUNC_${effectId}__${optionsExpr});`;
    }

    // 5. Set outputs (使用带后缀的唯一变量名)
    this.setOutputData(this.findOutputSlot("stop"), stopVar);
    this.setOutputData(this.findOutputSlot("pause"), pauseVar);
    this.setOutputData(this.findOutputSlot("resume"), resumeVar);
  }

  static get title() {
    return "Watch";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "f4a5b6c7-d8e9-f0a1-b2c3-d4e5f6a7b8c9";
  }
  static get treePath() {
    return "Vue";
  }
}

export class defineVueLifecycleHook extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      hookName: "onMounted",
    };

    // callback 是函数参数，当前节点消费它，所以用 addInput
    // 默认 onMounted 的 callback 无参数，args: []
    // 面板切换 hookName 时会动态更新 meta.args
    this.addInput("callback", "function", {
      id: uid(),
      shape: 5,
      meta: { args: [] },
    });

    this.uiPanel = defineAsyncComponent(
      () => import("./lifecycleHookPanel.vue"),
    );
  }

  onExecute() {
    const { hookName } = this.properties;

    if (!hookName) {
      this.jsCode = "// No lifecycle hook selected.";
      return;
    }

    this.importStr = `import { ${hookName} } from 'vue';`;

    const callbackSlotIndex = this.findInputSlot("callback");
    const callbackSlot = this.inputs[callbackSlotIndex];

    if (!this.isInputConnected(callbackSlotIndex)) {
      this.jsCode = `// ${hookName} callback is not connected.`;
      return;
    }

    // 函数类型返回 __FUNC__ 占位符，由代码组装器替换为实际函数
    const funcPlaceholder = `__FUNC_${callbackSlot.id}__`;
    this.jsCode = `${hookName}(${funcPlaceholder});`;
  }

  static get title() {
    return "LifecycleHook";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "5f8c6b9e-0a1b-4f8e-b5d2-1c3d4e5f6a7b";
  }
  static get treePath() {
    return "Vue";
  }
}

export class defineVueH extends nodeMeta {
  constructor() {
    super();
    this.properties = {
      // 声明区配置
      exported: false,
      declareType: "const",
      // 变量名三元组
      varName: {
        id: uid(),
        isSlot: false,
        value: `vnode_${uid().slice(0, 8)}`,
      },
      // h() 参数
      typeValue: '"div"',
      useTypeSlot: false,
      typeSlotId: uid(),
      childrenValue: "",
      useChildrenSlot: false,
      childrenSlotId: uid(),
      usePropsSlot: false,
      propsSlotId: uid(),
      attributesList: [],
      eventsList: [],
      directivesList: [],
    };

    // 输出变量名 slot 必须命名为 outValue
    this.addOutput("outValue", "string");

    this.uiPanel = defineAsyncComponent(() => import("./hPanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};
    const {
      useTypeSlot,
      typeSlotId,
      typeValue,
      useChildrenSlot,
      childrenSlotId,
      childrenValue,
      usePropsSlot,
      propsSlotId,
      attributesList,
      eventsList,
      directivesList,
    } = props;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 处理变量名三元组
    let varName = `vnode_${uid().slice(0, 8)}`;
    let declPrefix = "";
    if (props.varName?.isSlot) {
      // slot 模式：外部传入完整变量名，不加 declareType
      varName = getParamValue(props.varName) || varName;
    } else {
      // 静态模式：拼接 export + declareType
      varName = props.varName?.value || varName;
      const exportStr = props.exported ? "export " : "";
      declPrefix = `${exportStr}${props.declareType || "const"} `;
    }

    if (!varName) {
      this.jsCode = "// VNode variable name is not defined.";
      return;
    }

    // --- Imports ---
    const imports = new Set(["h"]);
    if (
      eventsList?.length > 0 &&
      eventsList.some((e) => e.modifiers?.length > 0)
    ) {
      imports.add("withModifiers");
    }
    const eventLevelDirectivesCount = (eventsList || []).reduce(
      (acc, ev) => acc + (ev.directives || []).length,
      0,
    );
    if ((directivesList?.length || 0) + eventLevelDirectivesCount > 0) {
      imports.add("withDirectives");
    }
    const hasDynamicProps =
      attributesList?.length > 0 || eventsList?.length > 0;
    const propsSlotIndex = this.findInputSlot("props");
    if (usePropsSlot && propsSlotIndex !== -1 && hasDynamicProps) {
      imports.add("mergeProps");
    }
    this.importStr = `import { ${Array.from(imports).join(", ")} } from 'vue';`;

    // --- Type Arg ---
    const typeSlotIndex = this.findInputSlot("type");
    let typeArg;
    if (
      useTypeSlot &&
      typeSlotIndex !== -1 &&
      this.isInputConnected(typeSlotIndex)
    ) {
      typeArg = this.getInputData(typeSlotIndex);
    } else {
      typeArg = typeValue || "undefined"; // 不自动加引号，用户自行输入
    }

    // --- Props Arg ---
    const attrParts = (attributesList || [])
      .map((attr) => {
        if (!attr.key) return "";
        let valueExpr;
        if (attr.isSlot) {
          const idx = this.inputs.findIndex((i) => i.id === attr.slotId);
          valueExpr =
            idx !== -1 && this.isInputConnected(idx)
              ? this.getInputData(idx)
              : attr.value || "undefined";
        } else {
          valueExpr = attr.value || "undefined"; // 用户自行决定是否包含引号
        }
        return `"${attr.key}": ${valueExpr}`;
      })
      .filter(Boolean);

    const eventParts = (eventsList || [])
      .map((event) => {
        if (!event.key) return "";
        const eventName = `on${event.key.charAt(0).toUpperCase() + event.key.slice(1)}`;
        // 事件处理器从 function input slot 获取
        const inputIdx = this.inputs.findIndex((i) => i.id === event.slotId);
        let handler;
        if (inputIdx !== -1 && this.isInputConnected(inputIdx)) {
          // 连接了 FunctionBlock，使用占位符
          handler = `__FUNC_${event.slotId}__`;
        } else {
          // 未连接，生成空函数
          const argNames =
            inputIdx !== -1 && this.inputs[inputIdx]?.meta?.args
              ? this.inputs[inputIdx].meta.args
              : ["e"];
          handler = `(${argNames.join(", ")}) => {}`;
        }
        const finalHandler =
          event.modifiers?.length > 0
            ? `withModifiers(${handler}, ${JSON.stringify(event.modifiers)})`
            : handler;
        return `"${eventName}": ${finalHandler}`;
      })
      .filter(Boolean);

    const dynamicPropsParts = [...attrParts, ...eventParts];
    let propsArg = "{}";
    if (dynamicPropsParts.length > 0) {
      propsArg = `{ ${dynamicPropsParts.join(", ")} }`;
    }

    if (
      usePropsSlot &&
      propsSlotIndex !== -1 &&
      this.isInputConnected(propsSlotIndex)
    ) {
      const mainProps = this.getInputData(propsSlotIndex);
      propsArg = hasDynamicProps
        ? `mergeProps(${mainProps}, ${propsArg})`
        : mainProps;
    }

    // --- Children Arg ---
    const childrenSlotIndex = this.findInputSlot("children");
    const childrenArg =
      useChildrenSlot &&
      childrenSlotIndex !== -1 &&
      this.isInputConnected(childrenSlotIndex)
        ? this.getInputData(childrenSlotIndex)
        : childrenValue || "undefined";

    // --- H Call ---
    let hCall = `h(${typeArg}, ${propsArg}, ${childrenArg})`;

    // --- Directives --- (global + event-level)
    const combinedDirectives = [
      ...(directivesList || []),
      ...(eventsList || []).flatMap((ev) => ev.directives || []),
    ];
    if (combinedDirectives.length > 0) {
      const directivesArray = combinedDirectives
        .map((d) => {
          const dirVar = d.key; // 不再从插槽读取
          if (!dirVar) return null;

          const parts = [dirVar];
          if (d.dirValue) parts.push(d.dirValue);
          if (d.dirArg) parts.push(d.dirArg);
          if (d.dirModifiersStr) {
            const mods = `{ ${d.dirModifiersStr
              .split(",")
              .map((m) => m.trim())
              .filter(Boolean)
              .map((m) => (m.includes(":") ? m : `${m}: true`))
              .join(", ")} }`;
            if (mods.replace(/[{}\s]/g, "") !== "") parts.push(mods);
          }
          return `[${parts.join(", ")}]`;
        })
        .filter(Boolean)
        .join(", ");

      if (directivesArray) {
        hCall = `withDirectives(${hCall}, [${directivesArray}])`;
      }
    }

    this.jsCode = `${declPrefix}${varName} = ${hCall};`;

    // 输出变量名
    const outIndex = this.findOutputSlot("outValue");
    if (outIndex !== -1) {
      this.setOutputData(outIndex, varName);
    }
  }

  static get title() {
    return "VueH (Render Function)";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "b4a5b6c7-d8e9-f0a1-b2c3-d4e5f6a7b8d0";
  }
  static get treePath() {
    return "Vue";
  }
}

export class defineVueAsyncComponent extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 声明区配置
      exported: false,
      declareType: "const",
      // 变量名三元组
      varName: {
        id: uid(),
        isSlot: false,
        value: `asyncComp_${uid().slice(0, 8)}`,
      },

      // Loader 配置
      useLoaderSlot: false,
      loaderSlotId: uid(),
      importPath: "'./Foo.vue'", // 用户应自行输入带引号的字面量并使用相对路径+完整后缀

      // Options 配置
      options: {
        loadingComponent: "",
        loadingComponentIsSlot: false,
        loadingComponentSlotId: uid(),
        errorComponent: "",
        errorComponentIsSlot: false,
        errorComponentSlotId: uid(),
        delay: "200",
        timeout: "3000",
        // suspensible / onError 已移除
      },
    };

    // 输出变量名 slot 必须命名为 outValue
    this.addOutput("outValue", "string");

    this.uiPanel = defineAsyncComponent(
      () => import("./asyncComponentPanel.vue"),
    );
  }

  onExecute() {
    const props = this.properties || {};
    const { useLoaderSlot, loaderSlotId, importPath, options } = props;

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 处理变量名三元组
    let varName = "asyncComp";
    let declPrefix = "";
    if (props.varName?.isSlot) {
      // slot 模式：外部传入完整声明，不加 declareType
      varName = getParamValue(props.varName) || "asyncComp";
    } else {
      // 静态模式：拼接 export + declareType
      varName = props.varName?.value || "asyncComp";
      const exportStr = props.exported ? "export " : "";
      declPrefix = `${exportStr}${props.declareType || "const"} `;
    }

    if (!varName) {
      this.jsCode = "// Async component variable name is not defined.";
      return;
    }

    // 导入（按需）
    this.importStr = `import { defineAsyncComponent } from 'vue';`;

    // 构建 loader 表达式
    let loaderExpr = "";
    if (useLoaderSlot) {
      const lidx = this.inputs.findIndex((s) => s.id === loaderSlotId);
      if (lidx !== -1 && this.isInputConnected(lidx)) {
        loaderExpr = this.getInputData(lidx);
      } else {
        // 回退到 importPath
        loaderExpr = `() => import(${importPath || "undefined"})`;
      }
    } else {
      loaderExpr = `() => import(${importPath || "undefined"})`;
    }

    // 始终使用 options 对象（按官方建议，默认展示并支持 loading/error 配置）
    const parts = [];
    parts.push(`loader: ${loaderExpr}`);
    if (options?.loadingComponent)
      parts.push(`loadingComponent: ${options.loadingComponent}`);
    if (options?.errorComponent)
      parts.push(`errorComponent: ${options.errorComponent}`);
    if (options?.delay) parts.push(`delay: ${options.delay}`);
    if (options?.timeout) parts.push(`timeout: ${options.timeout}`);
    const callArg = `{ ${parts.join(", ")} }`;

    const callExpression = `defineAsyncComponent(${callArg})`;
    this.jsCode = `${declPrefix}${varName} = ${callExpression};`;

    // 设置 outValue 输出
    const outIdx = this.findOutputSlot("outValue");
    if (outIdx !== -1) {
      this.setOutputData(outIdx, varName);
    }
  }

  static get title() {
    return "AsyncComponent";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "c7d8e9f0-a1b2-c3d4-e5f6-a7b8c9d0e1f2";
  }
  static get treePath() {
    return "Vue";
  }
}

export class UILoopNode extends uiNodeMeta {
  constructor() {
    super();

    this.uiPanel = defineAsyncComponent(() => import("./uiLoopPanel.vue"));

    // 生成唯一 ID
    const itemVarSlotId = uid();
    const indexVarSlotId = uid();

    // 添加输出：循环变量（带 id）
    this.addOutput("item", "string", { id: itemVarSlotId });
    this.addOutput("index", "string", { id: indexVarSlotId });

    // 默认属性
    this.properties = {
      itemVar: "item", // 循环项变量名
      indexVar: "index", // 索引变量名
      keyExpression: "index", // :key 表达式
      itemVarSlotId, // 循环项 slot 的 id
      indexVarSlotId, // 索引 slot 的 id
      // items 数据源配置
      itemsValue: "", // 直接输入的值
      itemsIsSlot: false, // 默认使用 slot 连接
    };

    this.setDirtyCanvas(true, true);
  }

  onExecute() {
    const { itemVar, indexVar, keyExpression, itemsIsSlot, itemsValue } =
      this.properties;

    // ========== 输出变量名到 output slots ==========
    // 这些变量名会被连接的 UI 节点通过 getInputData 获取
    const itemSlotIndex = this.findOutputSlot("item");
    const indexSlotIndex = this.findOutputSlot("index");

    const finalItemVar = itemVar || "item";
    const finalIndexVar = indexVar || "index";
    const finalKeyExpr = keyExpression || finalIndexVar;

    if (itemSlotIndex !== -1) {
      this.setOutputData(itemSlotIndex, finalItemVar);
    }
    if (indexSlotIndex !== -1) {
      this.setOutputData(indexSlotIndex, finalIndexVar);
    }

    // 获取 items 数据源（来自 slot 或直接输入）
    let itemsSource = "[]";
    if (itemsIsSlot) {
      const itemsSlotIndex = this.findInputSlot("items");
      if (itemsSlotIndex !== -1 && this.isInputConnected(itemsSlotIndex)) {
        itemsSource = this.getInputData(itemsSlotIndex) || "[]";
      }
    } else {
      itemsSource = itemsValue || "[]";
    }

    // 生成 map 代码，使用占位符标记子节点插入点
    // __LOOP_BODY_{nodeId}__ 会被框架替换为连接的子 UI 节点的 VNode 代码
    this.jsCode = `${itemsSource}.map((${finalItemVar}, ${finalIndexVar}) => {
  const __key__ = ${finalKeyExpr};
  return __LOOP_BODY_${this.id}__;
})`;
  }

  static get id() {
    return "ui-loop-node-id-001";
  }

  /**
   * 静态属性：节点标题
   */
  static get title() {
    return "UiLoop";
  }

  /**
   * 静态属性：节点名称
   */
  static get name() {
    return this.title;
  }

  static get treePath() {
    return "Vue";
  }
}

// --- Vue Router API Definitions ---
export const routerMethodParamMap = {
  push: {
    desc: "导航到新位置，会在 history 栈中添加记录，返回 Promise",
    hasReturnValue: true,
    hasLocation: true,
  },
  replace: {
    desc: "替换当前位置，不会在 history 栈中添加记录，返回 Promise",
    hasReturnValue: true,
    hasLocation: true,
  },
  go: {
    desc: "前进或后退指定步数",
    params: ["delta"],
    hasReturnValue: false,
  },
  back: {
    desc: "后退一步，等同于 go(-1)",
    params: [],
    hasReturnValue: false,
  },
  forward: {
    desc: "前进一步，等同于 go(1)",
    params: [],
    hasReturnValue: false,
  },
};

export const routerPropertyMap = {
  currentRoute: {
    desc: "当前路由信息 (Ref<RouteLocationNormalizedLoaded>)",
    hasReturnValue: true,
  },
  options: {
    desc: "Router 配置选项",
    hasReturnValue: true,
  },
};

export class defineVueRouter extends nodeMeta {
  constructor() {
    super();

    this.properties = {
      // 操作配置
      operation: {
        id: uid(),
        type: "method",
        name: "push",
        // Location 对象配置 (push/replace)
        location: {
          path: { id: uid(), isSlot: false, value: "" },
          name: { id: uid(), isSlot: false, value: "" },
          // params 改为参数列表（从 path 动态参数提取）
          params: [],
          // query 改为键值对列表
          queryItems: [],
          // hash 改为下拉选择
          hash: { id: uid(), isSlot: false, value: "" },
        },
        // go 方法的参数
        deltaParam: { id: uid(), isSlot: false, value: "-1" },
      },
      // 输出变量配置
      exported: false,
      declareType: "const",
      outputVar: {
        id: uid(),
        isSlot: false,
        value: `routeResult_${uid().slice(0, 8)}`,
      },
      // 是否使用 await
      useAwait: false,
    };

    this.uiPanel = defineAsyncComponent(() => import("./routerPanel.vue"));
  }

  onExecute() {
    const props = this.properties || {};
    const { operation, outputVar, declareType, exported, useAwait } = props;

    if (!operation || !operation.name) {
      this.jsCode = "// Vue Router node not configured";
      return;
    }

    // 辅助函数：处理三元组参数
    const getParamValue = (param) => {
      if (!param) return null;
      if (!param.isSlot) return param.value || null;

      const slot = this.inputs.find((s) => s.id === param.id);
      if (!slot) return null;
      const slotIndex = this.inputs.indexOf(slot);
      if (!this.isInputConnected(slotIndex)) return null;
      return this.getInputData(slotIndex);
    };

    // 生成 import
    this.importStr = `import { useRouter } from 'vue-router';`;

    // 获取 router 实例
    const routerExpr = "useRouter()";

    let finalExpression = "";

    if (operation.type === "property") {
      // 属性访问
      finalExpression = `${routerExpr}.${operation.name}`;
    } else if (operation.type === "method") {
      // 方法调用
      let args = "";

      if (operation.name === "push" || operation.name === "replace") {
        // 对象模式：构建对象
        const objParts = [];
        const loc = operation.location || {};

        const pathVal = getParamValue(loc.path);
        const nameVal = getParamValue(loc.name);
        const hashVal = getParamValue(loc.hash);

        if (pathVal) objParts.push(`path: ${pathVal}`);
        if (nameVal) objParts.push(`name: ${nameVal}`);

        // 处理 params（参数列表）
        if (Array.isArray(loc.params) && loc.params.length > 0) {
          const paramParts = loc.params
            .map((p) => {
              const val = getParamValue(p);
              return val ? `${p.key}: ${val}` : null;
            })
            .filter(Boolean);

          if (paramParts.length > 0) {
            objParts.push(`params: { ${paramParts.join(", ")} }`);
          }
        }

        // 处理 query（键值对列表）
        if (Array.isArray(loc.queryItems) && loc.queryItems.length > 0) {
          const queryParts = loc.queryItems
            .map((item) => {
              const keyVal = getParamValue(item.key);
              const valueVal = getParamValue(item.value);
              return keyVal && valueVal ? `${keyVal}: ${valueVal}` : null;
            })
            .filter(Boolean);

          if (queryParts.length > 0) {
            objParts.push(`query: { ${queryParts.join(", ")} }`);
          }
        }

        if (hashVal) objParts.push(`hash: ${hashVal}`);

        args = objParts.length > 0 ? `{ ${objParts.join(", ")} }` : "{}";
      } else if (operation.name === "go") {
        // go 方法需要数字参数
        args = getParamValue(operation.deltaParam) || "-1";
      }
      // back/forward 无参数

      const awaitPrefix =
        useAwait && (operation.name === "push" || operation.name === "replace")
          ? "await "
          : "";
      const argsStr = args ? `(${args})` : "()";
      finalExpression = `${awaitPrefix}${routerExpr}.${operation.name}${argsStr}`;
    }

    // 判断是否有返回值
    const hasReturnValue = this.hasReturnValue(operation);

    if (hasReturnValue) {
      // 有返回值：声明变量
      let declVar = "result";
      let declPrefix = "";

      if (outputVar?.isSlot) {
        // slot 模式：外部传入变量名，不加声明
        declVar = getParamValue(outputVar) || declVar;
      } else {
        // 静态模式：拼接 export + declareType
        declVar = outputVar?.value || declVar;
        const exportStr = exported ? "export " : "";
        declPrefix = `${exportStr}${declareType || "const"} `;
      }

      this.jsCode = `${declPrefix}${declVar} = ${finalExpression};`;

      const outSlotIndex = this.findOutputSlot("outValue");
      if (outSlotIndex !== -1) {
        this.setOutputData(outSlotIndex, declVar);
      }
    } else {
      // 无返回值：直接调用
      this.jsCode = `${finalExpression};`;
      const outSlotIndex = this.findOutputSlot("outValue");
      if (outSlotIndex !== -1) {
        this.setOutputData(outSlotIndex, undefined);
      }
    }
  }

  hasReturnValue(operation) {
    if (operation.type === "property") return true;
    if (operation.type === "method") {
      return routerMethodParamMap[operation.name]?.hasReturnValue ?? false;
    }
    return false;
  }

  static get title() {
    return "VueRouter";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "e8f9a0b1-c2d3-4e5f-6a7b-8c9d0e1f2a3b";
  }
  static get treePath() {
    return "Vue";
  }
}
