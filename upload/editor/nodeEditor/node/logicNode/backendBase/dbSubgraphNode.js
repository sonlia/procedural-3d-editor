import { Subgraph } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { buildBackendRoute } from "./routeCodegen.js";
import { buildFetchFunction } from "./fetchCodegen.js";

/**
 * Database Subgraph(数据库容器节点)
 *
 * 后端代码生成容器,子图内 jsCode 最终通过 HTTP 在后端执行.传递的不是运行时值而是
 * label name(如 in0):后端 `const { in0 } = request.body` 解构得值;前端 splitter
 * 据 outName 创建 ref 接收 fetch 结果.
 *
 * 输入端重写 getInputData 返回 input.name → 子图内 GraphInput 拉到变量名 → SQL
 * 节点生成 `where('x', in0)` 而非 `where('x', 5)`.
 *   _getRawInputData 是 wire 真值逃生口,本类自用收集 _passInWireValues(splitter 构 fetch body).
 *
 * 输出端 onExecute 末尾把每个非 orderSlot output setOutputData 为 slot.name → 外部
 * 下游读到变量名,前端 splitter 据此 `const ${name} = ref(null)` + 解构.
 *
 * 不调 super.onExecute(Subgraph.onExecute):它的 setInputData 不被 GraphInput 消费
 * (后者直接读父节点),且其输出读取会被本类末尾覆盖,直接 subgraph.runStep 更干净.
 *
 * 支持事务模式,开启后所有子节点操作包裹在 knex.transaction 中.
 */
export class DatabaseSubgraph extends Subgraph {
  constructor() {
    super();

    this.categories = "backend";
    this.bgcolor = "#4a1a2a";
    this.color = "#7a2d4a";

    this.properties = {
      dbConnectionId: "",
      transaction: false,
      passIn: [],
      passOut: [],
      remark: "",
    };
    this.uiPanel = defineAsyncComponent(() => import("./dbSubgraphPanel.vue"));
  }

  // DbSubgraph 的 data slot 始终以 label name (变量名字符串) 传入子图,
  // 供子图内代码字面引用(SQL 节点生成 where('x', in0) 这种).
  // 子图内 GraphInput 通过 slot.valueMode 分发,这里只负责"挂标志".
  onSubgraphNewInput(name, type, options) {
    super.onSubgraphNewInput(name, type, {
      ...(options || {}),
      valueMode: "label",
    });
  }

  // 反序列化兼容:旧项目的 DbSubgraph 序列化里 input 槽不带 valueMode,
  // 加载后退化为 'value' 模式会破坏 SQL 代码生成.这里补一遍标记.
  onConfigure(o) {
    super.onConfigure?.(o);
    if (Array.isArray(this.inputs)) {
      for (const input of this.inputs) {
        if (input?.name && input.type !== "orderSlot" && !input.valueMode) {
          input.valueMode = "label";
        }
      }
    }
  }

  _getPassInParams() {
    const configured = this.properties?.passIn || [];
    if (configured.length > 0) return configured;
    return (this.inputs || [])
      .filter((input) => input?.name && input.type !== "orderSlot")
      .map((input, index) => ({
        id: input.id || `input_${index}`,
        name: input.name,
      }));
  }

  _getShortId() {
    return String(this.id).slice(0, 8);
  }

  _getRoutePath() {
    return `/api/auto/db_${this._getShortId()}`;
  }

  _getPassOutParams() {
    const configured = this.properties?.passOut || [];
    if (configured.length > 0) return configured;
    return (this.outputs || [])
      .filter((out) => out?.name && out.type !== "orderSlot")
      .map((out, index) => ({
        id: out.id || `output_${index}`,
        name: out.name,
      }));
  }

  onExecute() {
    // 收集 wire 真值给 splitter 构 fetch body:{ label: wireValue }
    this._passInWireValues = {};
    for (const p of this._getPassInParams()) {
      const slotIndex = (this.inputs || []).findIndex(
        (input) => input.name === p.name,
      );
      if (slotIndex !== -1) {
        // input slot 标 valueMode:'label' 后,this.getInputData 也按配置返回 label。
        // DbSubgraph 自身构 fetch body 要 wire 真值,直读 link 绕过 prototype 分发。
        const linkId = this.inputs[slotIndex]?.link;
        const val = linkId != null ? this.graph?.links?.[linkId]?.data : undefined;
        if (val != null) {
          this._passInWireValues[p.name] = val;
        }
      }
    }

    // 跑子图 codegen.GraphInput 通过本类重写的 getInputData 拉到 label name,
    // 内部 SQL 节点生成的 jsCode 因此引用变量名而非运行时值.
    // 不调 super.onExecute:其 setInputData 不被 GraphInput 消费(后者直接读父节点),
    // 输出读取也会被本方法末尾覆盖,徒增"set 内部值再覆盖"的中间态.
    this.subgraph.runStep();

    // 收集 GraphOutput 的 wire 上游变量名:把"内部计算结果 → 父节点 passOut 名"的赋值落地到后端代码,
    // 否则 buildBackendRoute 末尾 `return { out0 }` 会引用未定义变量。
    // (subgraphCollector.collectSubgraphCode 跳过 graph/output,所以必须在这里独立采集)
    const passOutAssigns = [];
    const subNodes = this.subgraph._nodes_in_order || this.subgraph._nodes || [];
    for (const sn of subNodes) {
      if (sn.type !== "graph/output") continue;
      const slotId = sn.properties?.slotId;
      if (!slotId) continue;
      const parentSlotIdx = this.outputs.findIndex((s) => s.id === slotId);
      if (parentSlotIdx === -1) continue;
      const parentSlot = this.outputs[parentSlotIdx];
      if (parentSlot?.type === "orderSlot") continue;
      const wireSource = sn.getInputData?.(0);
      if (parentSlot?.name && wireSource && wireSource !== parentSlot.name) {
        passOutAssigns.push(`${parentSlot.name} = ${wireSource};`);
      }
    }

    const passInParams = this._getPassInParams();
    const passOutParams = this._getPassOutParams();
    const shortId = this._getShortId();
    const routePath = this._getRoutePath();

    // ===== 后端路由 =====
    const innerPlaceholder = `__SUBGRAPH_${this.id}__`;
    // 把 passOut 赋值行附在 placeholder 之后(同处 try block 内层,与子图内 const 变量同作用域)
    const innerWithAssigns = passOutAssigns.length > 0
      ? `${innerPlaceholder}\n  ${passOutAssigns.join("\n  ")}`
      : innerPlaceholder;

    // 路由 body:try/catch + SSE 失败通知;事务模式额外用 knex.transaction 包裹。
    // helper errorHandling='rethrow' 不再加外层 try/catch,body 自己控制错误链路
    // (notifyClient + e._notified=true + throw)。
    const tryBlock = this.properties.transaction
      ? `await knex.transaction(async (trx) => {\n  try {\n    ${innerWithAssigns}\n  } catch (e) {\n    notifyClient('error', '数据库事务失败: ' + e.message); e._notified = true; throw e\n  }\n})`
      : `try {\n  ${innerWithAssigns}\n} catch (e) {\n  notifyClient('error', '数据库操作失败: ' + e.message); e._notified = true; throw e\n}`;

    // 在 try 外、destructure 后声明 passOut 变量,使其对 return { ... } 可见
    const passOutDeclare = passOutParams.length > 0
      ? `let ${passOutParams.map((p) => p.name).join(", ")}\n  `
      : "";

    const { code: bgCode, imports: bgImports } = buildBackendRoute({
      method: "POST",
      path: routePath,
      paramNames: passInParams.map((p) => p.name),
      paramSource: "body",
      returnNames: passOutParams.map((p) => p.name),
      body: passOutDeclare + tryBlock,
      errorHandling: "rethrow",
      successNotify: null,
      remark: this.properties.remark || "",
      prefixSse: true,
      includeKnexImport: !!this.properties.transaction,
    });
    this.bgJsCode = bgCode;
    this.bgImportStr = bgImports.join("\n");

    // ===== 前端 fetch wrapper(bare 模式)=====
    // funcName=null:bare 块,由外层 vueComponent/splitter 嵌入 setup async 上下文,
    // 不包成 const fn。loadingRef 标志 fetch 状态;passOut 各字段对应 ref 名。
    const passInEntries = passInParams.map((p) => {
      const wireValue = this._passInWireValues?.[p.name];
      const valueStr =
        wireValue !== undefined && wireValue !== null && wireValue !== ""
          ? wireValue
          : "undefined";
      return `${p.name}: ${valueStr}`;
    });
    const bodyJsonExpr = passInParams.length > 0
      ? `JSON.stringify({ ${passInEntries.join(", ")} })`
      : null;

    const { jsCode, jsRefLines, importStr } = buildFetchFunction({
      funcName: null,
      method: "POST",
      routePath,
      bodyJsonExpr,
      responseRefs: passOutParams.map((p) => ({
        refName: p.name,
        jsonKey: p.name,
      })),
      loadingRef: `__db_${shortId}_loading`,
      fetchMode: "robust",
      errorHandling: "notify",
      errorFallbackMessage: "请求失败",
    });
    this.jsCode = jsCode;
    this.jsRefLines = jsRefLines;
    this.importStr = importStr;

    // 输出端写 label name(对称于 input 端):前端 splitter 据此创建 ref + 解构 fetch 结果.
    // 直接用循环索引 setOutputData,无需 findOutputSlot 间接查找(避免重名/状态歧义).
    // 遍历所有 output 而非 properties.passOut,因为用户可能直接拖 GraphOutput,
    // 此时 passOut 未配置但 output slot 已通过 onSubgraphNewOutput 同步生成.
    // 输出加 `.value`:前端 jsRefLines 把 passOut 名声明为 ref,下游(Assign / UI props /
    // 另一个 DatabaseSubgraph 的 passIn)拿到字符串后直接拼到代码里,必须带 `.value`
    // 才能取值;否则下游会拿到 ref 对象本身(对应 vue/base.js 的 getOutputValue 模式).
    this.outputs?.forEach((out, idx) => {
      if (!out?.name) return;
      if (out.type === "orderSlot") return;
      this.setOutputData(idx, `${out.name}.value`);
    });

    this.setDirtyCanvas(true, true);
  }

  static get title() {
    return "Database";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "db-subgraph-node-001";
  }

  static get treePath() {
    return "Backend/Database";
  }
}
