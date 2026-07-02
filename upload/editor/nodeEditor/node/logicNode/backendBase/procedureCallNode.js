import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { parseProcedureSignature } from "../../../../dbDragEditor/graph/procedureSignature.js";

/**
 * 存储过程调用节点 —— 后端数据库节点(用于 Database Subgraph 内部)。
 *
 * 存储过程是后端直接 CALL 的,这里把它建模成「有输入有输出」的后端节点:
 * - 输入 slot 来自过程的 IN/INOUT 参数(可切静态值 / slot)
 * - 输出 slot 固定一个 result(CALL 的结果),procedure 无 return type
 *
 * 代码产物只贡献 bgJsCode 原子语句(不自包 try/catch),由父 DatabaseSubgraph 统一兜底。
 * 签名(参数列表)不在持久树里,由面板选中过程后调 /api/db/procedures 取回写入
 * properties.arguments 缓存,本节点据此重建 slot —— 反序列化时也用缓存重建。
 */
export class ProcedureCallNode extends nodeMeta {
  constructor() {
    super();

    this.categories = "backend";
    this.bgcolor = "#1a3a4a";
    this.color = "#2d6a7a";

    this.properties = {
      dbConnectionId: "", // 父 DatabaseSubgraph 的数据库连接 ID(只读镜像)
      procedureName: "", // 存储过程名(来自 database.dbTree type==='procedure')
      arguments: "", // 缓存的 identity args 签名,如 "a integer, b text"
      params: [], // [{ name, type, isSlot, value }] —— 由签名重建,保留 isSlot/value
    };

    this.addOutput("result", "string"); // CALL 结果变量名

    this.uiPanel = defineAsyncComponent(() => import("./procedureCallNodePanel.vue"));
  }

  // 反序列化:补默认字段 + 按缓存签名重建 slot(持久树不含签名)
  onConfigure(o) {
    super.onConfigure?.(o);
    if (!this.properties) return;
    if (!Array.isArray(this.properties.params)) this.properties.params = [];
    if (typeof this.properties.arguments !== "string") this.properties.arguments = "";
    this._syncParamSlots();
  }

  _getShortId() {
    return String(this.id).slice(0, 8);
  }

  // 父 DatabaseSubgraph 的事务状态决定 knex / trx
  _getKnexRef() {
    return this.graph?._subgraph_node?.properties?.transaction ? "trx" : "knex";
  }

  // ─── 签名 → 参数 / slot 同步 ───

  /**
   * 用新签名写入 properties.arguments,重建 params(按名保留 isSlot/value),并刷新 slot。
   * @param {string} argsStr identity arguments
   */
  setArguments(argsStr) {
    this.properties.arguments = argsStr || "";
    this._rebuildParamsFromSignature();
    this._syncParamSlots();
    this.onExecute();
    this.setDirtyCanvas?.(true, true);
  }

  _rebuildParamsFromSignature() {
    const prev = new Map(
      (this.properties.params || []).map((p) => [p.name, p]),
    );
    const { inputs } = parseProcedureSignature(this.properties.arguments || "", "");
    this.properties.params = inputs.map((arg) => {
      const old = prev.get(arg.name);
      return {
        name: arg.name,
        type: arg.type,
        isSlot: old?.isSlot ?? false,
        value: old?.value ?? "",
      };
    });
  }

  // 仅 isSlot=true 的参数创建 input slot;移除其余(保留 orderSlot)
  _syncParamSlots() {
    const slotParamNames = new Set(
      (this.properties.params || []).filter((p) => p.isSlot).map((p) => p.name),
    );

    for (let i = (this.inputs?.length || 0) - 1; i >= 0; i--) {
      const input = this.inputs[i];
      if (input.type === "orderSlot") continue;
      if (!slotParamNames.has(input.name)) this.removeInput(i);
    }

    for (const p of this.properties.params || []) {
      if (!p.isSlot) continue;
      const exist = this.inputs?.findIndex((s) => s.name === p.name) ?? -1;
      if (exist < 0) this.addInput(p.name, "string", { id: `param_${p.name}` });
    }

    this.setSize?.(this.computeSize());
    this.setDirtyCanvas?.(true, true);
  }

  // 静态值 → JS 字面量表达式(供 knex.raw 绑定数组)
  _toJsLiteral(v) {
    const s = String(v ?? "").trim();
    if (s === "") return "null";
    if (/^-?\d+(\.\d+)?$/.test(s)) return s;
    if (s === "true" || s === "false") return s;
    return JSON.stringify(s);
  }

  // ─── onExecute:生成 CALL 语句 ───

  onExecute() {
    this._lastResultVar = null;
    const props = this.properties;
    const ref = this._getKnexRef();

    if (!props.procedureName) {
      this.bgJsCode = "// 存储过程:未选择存储过程";
      this.bgImportStr = "";
      return;
    }

    // 收集参数绑定:isSlot → 上游变量名;否则静态字面量
    const bindings = (props.params || []).map((p) => {
      if (p.isSlot) {
        const idx = this.findInputSlot(p.name);
        const v = idx >= 0 ? this.getInputData(idx) : null;
        return v || "null";
      }
      return this._toJsLiteral(p.value);
    });

    const placeholders = bindings.map(() => "?").join(", ");
    const safeName = props.procedureName.replace(/[^a-zA-Z0-9_]/g, "_");
    const resultVar = `db_proc_${safeName}_${this._getShortId()}_result`;

    this.bgJsCode = `const ${resultVar} = await ${ref}.raw('CALL "${props.procedureName}"(${placeholders})', [${bindings.join(", ")}]);`;
    this.bgImportStr = "import knex from '{{BG_ROOT}}/db/knex.js'";

    this.setOutputData(this.findOutputSlot("result"), resultVar);
    this._lastResultVar = resultVar;
  }

  static get title() {
    return "存储过程";
  }
  static get id() {
    return "procedure-call-001";
  }
  static get treePath() {
    return "Backend/Database";
  }
}
