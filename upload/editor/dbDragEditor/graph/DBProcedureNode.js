import { LGraphNode } from "litegraph.js";
import { parseProcedureSignature } from "./procedureSignature.js";

/**
 * 存储过程/函数画布节点 —— 独立节点,与表同级。
 * slot 是签名的只读镜像(输入=IN/INOUT 参数,输出=返回类型),不接入 JOIN。
 */
export class DBProcedureNode extends LGraphNode {
  constructor() {
    super();
    this.properties = {
      type: "function", // 'function' | 'procedure';非 'table',JOIN 逻辑会忽略它
      name: "",
      arguments: "", // 缓存 identity args,供删除时构造重载 DROP 签名
    };
  }

  /**
   * 用后端权威签名重建输入/输出 slot。
   * @param {string} argsStr     pg_get_function_identity_arguments
   * @param {string} returnsStr  pg_get_function_result(return_type)
   */
  setSignature(argsStr, returnsStr) {
    if (this.inputs) while (this.inputs.length) this.removeInput(0);
    if (this.outputs) while (this.outputs.length) this.removeOutput(0);

    const { inputs, output } = parseProcedureSignature(argsStr, returnsStr);
    for (const p of inputs) {
      this.addInput(p.name, "string", { dbType: p.type });
    }
    if (output) {
      this.addOutput(output.type, "string", {});
    }
    this.properties.arguments = argsStr || "";
    this.setDirtyCanvas?.(true, true);
  }
}
