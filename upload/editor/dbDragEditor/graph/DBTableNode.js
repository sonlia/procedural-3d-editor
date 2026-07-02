import { LGraphNode } from "litegraph.js";

export class DBTableNode extends LGraphNode {
  constructor() {
    super();

    this.properties = {
      type: "table",
      alias: "", // 表别名，用于 JOIN 生成
      partitioned: false, // 分区表标记，仅影响标题图标(随 graph 序列化持久化)
    };

    // 添加默认字段的输入和输出槽（系统字段，不可编辑）
    this.addInput("id", "string", { disabled: true, system: true });
    this.addOutput("id", "string", { system: true });
    this.addInput("created_at", "string", { disabled: true, system: true });
    this.addOutput("created_at", "string", { system: true });
    this.addInput("updated_at", "string", { disabled: true, system: true });
    this.addOutput("updated_at", "string", { system: true });
  }

  /**
   * 重绘标题左侧的小图标盒，区分分区表与常规表(canvas 无法用 Material 图标，用几何图形表达)。
   * 常规表 = 灰色网格;分区表 = 琥珀色三层横条(直观表达"被切分")，与左侧树的 partitioned_table 同色系。
   * @param {CanvasRenderingContext2D} ctx
   * @param {number} titleHeight 标题栏高度
   */
  onDrawTitleBox(ctx, titleHeight) {
    const s = titleHeight * 0.6; // 图标边长
    const x = titleHeight * 0.5 - s * 0.5; // 标题栏内左侧留白
    const y = -titleHeight * 0.5 - s * 0.5; // 标题栏在节点原点上方，y 为负

    if (this.properties.partitioned) {
      ctx.fillStyle = "#FFB300"; // amber
      const barH = s / 4;
      ctx.fillRect(x, y, s, barH);
      ctx.fillRect(x, y + barH * 1.5, s, barH);
      ctx.fillRect(x, y + barH * 3, s, barH);
    } else {
      ctx.strokeStyle = "#BDBDBD"; // grey
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, s, s);
      ctx.beginPath();
      ctx.moveTo(x, y + s / 2);
      ctx.lineTo(x + s, y + s / 2);
      ctx.moveTo(x + s / 2, y);
      ctx.lineTo(x + s / 2, y + s);
      ctx.stroke();
    }
  }

  /**
   * @param {number} slotIndex slot 索引
   * @param {boolean} isInput 是否为输入 slot（默认 true）
   * @returns {Object|null} { slotId, name } 或 null
   */
  getFieldInfo(slotIndex, isInput = true) {
    const slots = isInput ? this.inputs : this.outputs;
    const slot = slots?.[slotIndex];
    return slot ? { slotId: slot.id, name: slot.name } : null;
  }
}
