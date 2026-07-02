import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";

/**
 * 弹窗控制节点
 * 用于控制 QDialog 的显示/隐藏
 * 接收 QDialog 的 Ref（nodeId），生成 show/hide 控制代码
 *
 * 当前限制：生成的代码通过 DOM 查找组件实例，仅在预览模式（含 nodeid 属性）下有效。
 * Production 模式需通过 reactive state 绑定 model-value（后续优化）。
 */
export class defineDialogControl extends nodeMeta {
  constructor() {
    super();
    this.uiPanel = defineAsyncComponent(() => import("./dialogPanel.vue"));
    this.color = "#523";
    this.bgcolor = "#634";

    // 输入端口：接收 QDialog 的 Ref 输出（nodeId）
    this.addInput("dialogRef", "string", {
      shape: 5,
      label: "弹窗引用"
    });

    // 属性
    this.properties = {
      action: "show",       // show | hide | toggle
      dialogNodeId: ""      // 面板中选择的 QDialog 节点 ID（备选方式）
    };
  }

  onExecute() {
    const props = this.properties || {};
    const action = props.action || "show";

    // 获取 dialogRef：优先端口连接，回退到面板选择
    const dialogRefSlot = this.inputs.findIndex(s => s.name === "dialogRef");
    let dialogNodeId = null;
    if (dialogRefSlot !== -1 && this.isInputConnected(dialogRefSlot)) {
      dialogNodeId = this.getInputData(dialogRefSlot);
    }
    if (!dialogNodeId) {
      dialogNodeId = props.dialogNodeId || null;
    }

    if (!dialogNodeId) {
      this.jsCode = "// 弹窗控制：未连接 QDialog 引用";
      return;
    }

    const method = action === "toggle" ? "toggle" : action === "hide" ? "hide" : "show";
    const comment = { show: "显示", hide: "隐藏", toggle: "切换" }[method];

    this.jsCode = [
      `// 弹窗控制：${comment}`,
      `document.querySelector('[nodeid="${dialogNodeId}"]')?.__vueParentComponent?.exposed?.${method}?.();`
    ].join('\n');
  }

  static get title() { return "DialogControl"; }
  static get name() { return this.title; }
  static get id() { return "f1a2b3c4-d5e6-4f7a-8b9c-0d1a10c01e01"; }
  static get treePath() { return "ui/弹窗"; }
}
