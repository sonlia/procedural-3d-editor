import { Subgraph } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";

/**
 * 后端功能函数节点（后端容器节点）
 * 用于定义后端 API 路由或可复用的后端函数
 * 参考 FunctionBlock 实现
 */
export class BackendFunction extends Subgraph {
  constructor() {
    super();

    // 后端节点标识
    this.categories = "backend";

    this.properties = {
      // 数据流
      passIn: [], // 传入参数（数据流入节点）
      passOut: [], // 传出参数（数据流出节点）
      remark: "",
    };

    // 设置节点颜色
    this.bgcolor = "#1a1a4a";
    this.color = "#2d2d7a";

    this.uiPanel = defineAsyncComponent(
      () => import("./backendFunctionPanel.vue")
    );
  }

  /**
   * Subgraph 机制添加 GraphInput → 父节点 addInput 时注入 valueMode:'label'
   * 函数包装为 `export async function fn(in0)`,函数体内只认识 in0 (slot.name),
   * 所以子图内 GraphInput 必须拿 slot.name(label)
   */
  onSubgraphNewInput(name, type, options) {
    super.onSubgraphNewInput(name, type, {
      ...(options || {}),
      valueMode: "label",
    });
  }

  /**
   * Subgraph 机制添加 GraphOutput → 父节点 addOutput 时注入 valueMode:'label'
   * 与 panel "添加传出"路径对齐。节点自身不调 setOutputData,wrapper 自动把
   * link.data 覆盖为 slot.name → 下游拿到后端 return 字段名(裸 destructure 名)
   */
  onSubgraphNewOutput(name, type, options) {
    super.onSubgraphNewOutput(name, type, {
      ...(options || {}),
      valueMode: "label",
    });
  }

  /**
   * 反序列化兼容:老数据 input/output slot 不带 valueMode,加载后默认 'value'
   * 给所有 data slot 补 'label'(orderSlot 跳过)
   */
  onConfigure(o) {
    super.onConfigure?.(o);
    for (const arr of [this.inputs, this.outputs]) {
      if (!Array.isArray(arr)) continue;
      for (const slot of arr) {
        if (!slot?.name) continue;
        if (slot.valueMode) continue;
        if (slot.type === "orderSlot") continue;
        slot.valueMode = "label";
      }
    }
  }

  onExecute() {
    // super.onExecute() 会自动将所有 inputs（包括 passIn）的值传递给子图
    super.onExecute();

    // 使用占位符标记，实际代码由 codeAssembler 通过字符串替换填充
    const remark = this.properties.remark ? `/* ${this.properties.remark} */\n` : "";
    const bodyPlaceholder = `${remark}__SUBGRAPH_${this.id}__`;

    // 后端服务函数代码（vueComponent 后续包装为 export async function）
    this.bgJsCode = bodyPlaceholder;
  }

  static get title() {
    return "BackendFunction";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "backend-function-001";
  }

  static get treePath() {
    return "Backend";
  }
}
