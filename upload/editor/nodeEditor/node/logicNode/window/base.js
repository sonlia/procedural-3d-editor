import { nodeMeta, Subgraph } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { isFunctionParam } from "../utils.js";

// --- Window API Definitions (with return value info) ---
const noReturnValue = { hasReturnValue: false };
const hasReturnValue = { hasReturnValue: true };

export const propertyMap = {
  closed: { desc: "返回窗口是否已被关闭。", ...hasReturnValue },
  console: { desc: "返回窗口的 Console 对象。", ...hasReturnValue },
  document: { desc: "返回窗口的 Document 对象。", ...hasReturnValue },
  frameElement: { desc: "返回运行在窗口中的框架。", ...hasReturnValue },
  frames: { desc: "返回窗口中运行的所有窗口对象。", ...hasReturnValue },
  history: { desc: "返回窗口的 History 对象。", ...hasReturnValue },
  innerHeight: { desc: "返回窗口的文档显示区的高度。", ...hasReturnValue },
  innerWidth: { desc: "返回窗口的文档显示区的宽度。", ...hasReturnValue },
  length: { desc: "返回当前窗口中 <iframe> 元素的数量。", ...hasReturnValue },
  localStorage: { desc: "允许在 Web 浏览器中保存键/值对。", ...hasReturnValue },
  location: { desc: "返回窗口的 Location 对象。", ...hasReturnValue },
  name: { desc: "设置或返回窗口的名称。", ...hasReturnValue },
  navigator: { desc: "返回窗口的 Navigator 对象。", ...hasReturnValue },
  opener: { desc: "返回对创建窗口的窗口的引用。", ...hasReturnValue },
  outerHeight: { desc: "返回浏览器窗口的高度。", ...hasReturnValue },
  outerWidth: { desc: "返回浏览器窗口的宽度。", ...hasReturnValue },
  pageXOffset: {
    desc: "返回当前文档从窗口左上角（水平）滚动的像素。",
    ...hasReturnValue,
  },
  pageYOffset: {
    desc: "返回当前文档从窗口左上角（垂直）滚动的像素。",
    ...hasReturnValue,
  },
  parent: { desc: "返回当前窗口的父窗口。", ...hasReturnValue },
  screen: { desc: "返回窗口的 Screen 对象。", ...hasReturnValue },
  screenLeft: { desc: "返回窗口相对于屏幕的水平坐标。", ...hasReturnValue },
  screenTop: { desc: "返回窗口相对于屏幕的垂直坐标。", ...hasReturnValue },
  screenX: { desc: "返回窗口相对于屏幕的水平坐标。", ...hasReturnValue },
  screenY: { desc: "返回窗口相对于屏幕的垂直坐标。", ...hasReturnValue },
  sessionStorage: {
    desc: "允许在 Web 浏览器中保存键/值对。",
    ...hasReturnValue,
  },
  scrollX: { desc: "pageXOffset 的别名。", ...hasReturnValue },
  scrollY: { desc: "pageYOffset 的别名。", ...hasReturnValue },
  self: { desc: "返回当前窗口。", ...hasReturnValue },
  top: { desc: "返回最顶层的浏览器窗口。", ...hasReturnValue },
};
export const methodParamMap = {
  alert: {
    params: ["message"],
    desc: "显示带有消息和确定按钮的警报框。",
    ...noReturnValue,
  },
  atob: {
    params: ["encodedString"],
    desc: "解码 base-64 编码的字符串。",
    ...hasReturnValue,
  },
  blur: { params: [], desc: "从当前窗口移除焦点。", ...noReturnValue },
  btoa: {
    params: ["stringToEncode"],
    desc: "以 base-64 编码字符串。",
    ...hasReturnValue,
  },
  clearInterval: {
    params: ["intervalID"],
    desc: "清除使用 setInterval() 设置的计时器。",
    ...noReturnValue,
  },
  clearTimeout: {
    params: ["timeoutID"],
    desc: "清除使用 setTimeout() 设置的计时器。",
    ...noReturnValue,
  },
  close: { params: [], desc: "关闭当前窗口。", ...noReturnValue },
  confirm: {
    params: ["message"],
    desc: "显示对话框，其中包含消息以及确定和取消按钮。",
    ...hasReturnValue,
  },
  focus: { params: [], desc: "将焦点设置到当前窗口。", ...noReturnValue },
  getComputedStyle: {
    params: ["element", "pseudoElt"],
    desc: "获取元素的所有最终计算的CSS属性。",
    ...hasReturnValue,
  },
  getSelection: {
    params: [],
    desc: "返回 Selection 对象。",
    ...hasReturnValue,
  },
  matchMedia: {
    params: ["mediaQueryString"],
    desc: "返回 MediaQueryList 对象。",
    ...hasReturnValue,
  },
  moveBy: {
    params: ["x", "y"],
    desc: "相对于其当前位置移动窗口。",
    ...noReturnValue,
  },
  moveTo: {
    params: ["x", "y"],
    desc: "将窗口移动到指定位置。",
    ...noReturnValue,
  },
  open: {
    params: ["URL", "name", "specs", "replace"],
    desc: "打开新的浏览器窗口。",
    ...hasReturnValue,
  },
  print: { params: [], desc: "打印当前窗口的内容。", ...noReturnValue },
  prompt: {
    params: ["text", "defaultText"],
    desc: "用对话框请求输入一条简单的字符串。",
    ...hasReturnValue,
  },
  requestAnimationFrame: {
    params: ["callback()"],
    desc: "请求浏览器在下一次重绘之前调用函数。",
    ...hasReturnValue,
  },
  resizeBy: {
    params: ["x", "y"],
    desc: "按指定像素调整窗口大小。",
    ...noReturnValue,
  },
  resizeTo: {
    params: ["width", "height"],
    desc: "将窗口大小调整为指定的宽度和高度。",
    ...noReturnValue,
  },
  scrollBy: {
    params: ["x", "y"],
    desc: "按指定的像素数滚动文档。",
    ...noReturnValue,
  },
  scrollTo: {
    params: ["x", "y"],
    desc: "将文档滚动到指定坐标。",
    ...noReturnValue,
  },
  setInterval: {
    params: ["handler()", "milliseconds"],
    desc: "周期性执行指定的代码。",
    ...hasReturnValue,
  },
  setTimeout: {
    params: ["handler()", "timeout"],
    desc: "在经过指定的时间之后执行代码。",
    ...hasReturnValue,
  },
  stop: { params: [], desc: "停止加载窗口。", ...noReturnValue },
};

// --- History API Definitions ---
export const historyPropertyMap = {
  length: { desc: "返回浏览器历史列表中的 URL 数量。", ...hasReturnValue },
  state: { desc: "返回 history 堆栈顶部表示的状态。", ...hasReturnValue },
};
export const historyMethodParamMap = {
  back: {
    params: [],
    desc: "加载 history 列表中的前一个 URL。",
    ...noReturnValue,
  },
  forward: {
    params: [],
    desc: "加载 history 列表中的下一个 URL。",
    ...noReturnValue,
  },
  go: {
    params: ["delta"],
    desc: "从 history 列表加载指定的页面。",
    ...noReturnValue,
  },
  pushState: {
    params: ["state", "title", "url"],
    desc: "在 history 堆栈中添加一个新条目。",
    ...noReturnValue,
  },
  replaceState: {
    params: ["state", "title", "url"],
    desc: "修改 history 堆栈中当前的条目。",
    ...noReturnValue,
  },
};

export class defineWindow extends nodeMeta {
  constructor() {
    super();
    this.uiPanel = defineAsyncComponent(() => import("./windowPanel.vue"));
  }

  onExecute() {
    const props = this.properties;
    if (!props || !props.operation || !props.operation.name) {
      this.jsCode = "// Window node not configured";
      return;
    }

    const op = props.operation;
    let finalExpression = "window";

    if (op.type === "property") {
      finalExpression += `.${op.name}`;
    } else if (op.type === "method") {
      const args = (op.params || [])
        .map((p) => {
          if (isFunctionParam(p.label)) {
            const outputSlotIndex = this.outputs.findIndex(
              (o) => o.id === p.id,
            );
            if (p.isSlot && this.isOutputConnected(outputSlotIndex)) {
              const outputSlot = this.outputs[outputSlotIndex];
              const subgraphArgs = outputSlot.meta?.args?.join(", ") || "";
              // The graph's `executeSubgraph` method will handle the actual execution.
              // We just need to provide a function wrapper.
              return `(${subgraphArgs}) => { ${this.graph.executeSubgraph(this, outputSlotIndex)} }`;
            }
            return "() => {}"; // Default empty function if not connected
          }

          if (p.isSlot) {
            const inputSlotIndex = this.inputs.findIndex((i) => i.id === p.id);
            return this.getInputData(inputSlotIndex, true) ?? "undefined"; // Get variable name
          }

          if (
            typeof p.value === "string" &&
            isNaN(p.value) &&
            !["true", "false", "null", "undefined"].includes(p.value)
          ) {
            return `"${p.value}"`;
          }
          return p.value || "undefined";
        })
        .join(", ");

      finalExpression = `${finalExpression}.${op.name}(${args})`;
    }

    let hasReturnValue = false;
    if (op.type === "method") {
      hasReturnValue = methodParamMap[op.name]?.hasReturnValue;
    } else if (op.type === "property") {
      hasReturnValue = propertyMap[op.name]?.hasReturnValue;
    }

    // Variable declaration only if there's a return value
    if (hasReturnValue) {
      // Handle outputVar as triplet { id, isSlot, value }
      let declVar;
      if (props.outputVar?.isSlot) {
        const slotIndex = this.inputs.findIndex(
          (i) => i.id === props.outputVar.id,
        );
        if (slotIndex !== -1) {
          declVar = this.getInputData(slotIndex, true);
        }
      }
      declVar =
        declVar || props.outputVar?.value || props.outputVar || "result";

      const declType = props.outputVar?.isSlot
        ? ""
        : props.declareType || "const";
      const exportPrefix = props.exported ? "export " : "";

      if (declType) {
        this.jsCode = `${exportPrefix}${declType} ${declVar} = ${finalExpression};`;
      } else {
        // When using slot, variable is already declared elsewhere
        this.jsCode = `${declVar} = ${finalExpression};`;
      }

      const outSlotIndex = this.findOutputSlot("outValue");
      if (outSlotIndex !== -1) {
        this.setOutputData(outSlotIndex, declVar);
      }
    } else {
      this.jsCode = `${finalExpression};`;
      const outSlotIndex = this.findOutputSlot("outValue");
      if (outSlotIndex !== -1) {
        this.setOutputData(outSlotIndex, undefined);
      }
    }
  }

  static get title() {
    return "Window";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d-window";
  } // Unique ID
  static get treePath() {
    return "JavaScript/window";
  }
}

export class defineHistory extends nodeMeta {
  constructor() {
    super();
    this.uiPanel = defineAsyncComponent(() => import("./historyPanel.vue"));
  }

  onExecute() {
    const props = this.properties;
    if (!props || !props.operation || !props.operation.name) {
      this.jsCode = "// History node not configured";
      return;
    }

    const op = props.operation;
    let finalExpression = "window.history";

    if (op.type === "property") {
      finalExpression += `.${op.name}`;
    } else if (op.type === "method") {
      const args = (op.params || [])
        .map((p) => {
          if (p.isSlot) {
            const inputSlotIndex = this.inputs.findIndex((i) => i.id === p.id);
            return this.getInputData(inputSlotIndex, true) ?? "undefined";
          }
          if (
            typeof p.value === "string" &&
            isNaN(p.value) &&
            !["true", "false", "null", "undefined"].includes(p.value)
          ) {
            return `"${p.value}"`;
          }
          return p.value || "undefined";
        })
        .join(", ");

      finalExpression = `${finalExpression}.${op.name}(${args})`;
    }

    let hasReturnValue = false;
    if (op.type === "method") {
      hasReturnValue = historyMethodParamMap[op.name]?.hasReturnValue;
    } else if (op.type === "property") {
      hasReturnValue = historyPropertyMap[op.name]?.hasReturnValue;
    }

    if (hasReturnValue) {
      // Handle outputVar as triplet { id, isSlot, value }
      let declVar;
      if (props.outputVar?.isSlot) {
        const slotIndex = this.inputs.findIndex(
          (i) => i.id === props.outputVar.id,
        );
        if (slotIndex !== -1) {
          declVar = this.getInputData(slotIndex, true);
        }
      }
      declVar =
        declVar || props.outputVar?.value || props.outputVar || "result";

      const declType = props.outputVar?.isSlot
        ? ""
        : props.declareType || "const";
      const exportPrefix = props.exported ? "export " : "";

      if (declType) {
        this.jsCode = `${exportPrefix}${declType} ${declVar} = ${finalExpression};`;
      } else {
        // When using slot, variable is already declared elsewhere
        this.jsCode = `${declVar} = ${finalExpression};`;
      }

      const outSlotIndex = this.findOutputSlot("outValue");
      if (outSlotIndex !== -1) {
        this.setOutputData(outSlotIndex, declVar);
      }
    } else {
      this.jsCode = `${finalExpression};`;
      const outSlotIndex = this.findOutputSlot("outValue");
      if (outSlotIndex !== -1) {
        this.setOutputData(outSlotIndex, undefined);
      }
    }
  }

  static get title() {
    return "History";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d-history";
  }
  static get treePath() {
    return "JavaScript/window";
  }
}
