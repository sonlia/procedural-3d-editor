import { defineAsyncComponent } from "vue";
import { TableNode } from "./tableNode.js";
import { buildBackendRoute, wrapInKnexTransaction } from "./routeCodegen.js";
import { buildFetchFunction, safeFuncNameFromPath } from "./fetchCodegen.js";

/**
 * Standalone backend CRUD route node.
 *
 * It reuses TableNode's knex query generator for CRUD, related writes,
 * where/order/limit/offset/group/aggregates, but does not require a
 * DatabaseSubgraph.
 */
export class BackendCrudNode extends TableNode {
  constructor() {
    super();

    this.categories = "backend";
    this.bgcolor = "#263a4a";
    this.color = "#3b6680";

    this.properties = {
      ...this.properties,
      standaloneRoute: true,
      routePath: "",
      autoRoute: true,
      execMode: "manual",
    };

    // 继承自 TableNode 的 outputs: [orderOut(基类), table, result]
    // standalone 路由节点不暴露派生表语义(table 是 DbSubgraph 子图内子查询用)
    const tableIdx = this.findOutputSlot("table");
    if (tableIdx >= 0) this.removeOutput(tableIdx);

    this.uiPanel = defineAsyncComponent(
      () => import("./backendCrudNodePanel.vue"),
    );
  }

  onConfigure(o) {
    super.onConfigure?.(o);
    if (!this.properties) return;
    this.properties.standaloneRoute = true;
    this.properties.routePath ||= "";
    this.properties.autoRoute = this.properties.autoRoute !== false;
    this.properties.execMode ||= "manual";
    const legacyModes = ["scalar", "aggregate", "pluck"];
    if (legacyModes.includes(this.properties.result?.mode)) {
      this.properties.result.mode = "rows";
    }
    // outputMode='builder' 是 DbSubgraph 子图内的 CTE/Union/whereExists 嵌入语义,
    // standalone 路由节点没有"被嵌入"的上下文,反序列化阶段一次性纠正即可,
    // onExecute 不再每帧改写 properties(避免违反 codegen 只读原则)。
    if (this.properties.outputMode === "builder") {
      this.properties.outputMode = "execute";
    }
    // Returning 支持主表 + 关联表字段(`${source}::${fieldId}`)。source='main' 或 relatedFields 的 linkId。
    //  - 纯 fieldId 数组(老 UPSERT/UPDATE/DELETE) → ["main::fieldId", ...]
    //  - returningField 对象 → 按其 source 迁入(main 或 linkId 都保留)
    //  - 关联表 returning 当前仅 INSERT 真生效(_parseReturningFields/_generateRelatedInserts),
    //    UPDATE/UPSERT/DELETE 的 _parseReturningFields 只读 mainFieldNames,linkId 条目静默忽略
    const oldArr = Array.isArray(this.properties.returningFields)
      ? this.properties.returningFields
      : [];
    const migratedArr = oldArr.map((entry) =>
      typeof entry === "string" && entry.includes("::")
        ? entry
        : `main::${entry}`,
    );
    const retField = this.properties.returningField;
    if (retField?.source && retField.fieldId) {
      const key = `${retField.source}::${retField.fieldId}`;
      if (!migratedArr.includes(key)) migratedArr.push(key);
    }
    this.properties.returningFields = migratedArr;
    if (retField) this.properties.returningField = { source: "", fieldId: "" };

    // 旧 slotId 用 `where_${uid()}` / `aggfw_${uid()}` 拼 UUID(含连字符),在
    // BackendCrudNode 的 destructure(`const { in0: where_xxx-yyy } = request.body`)
    // 和 SQL 引用(`.where(...,where_xxx-yyy)`)上下文里是 SyntaxError。清洗成纯 hex,
    // 同步更新已存 input slot 的 name/id,反序列化加载即修复历史数据。
    for (const w of this.properties.where || []) {
      if (typeof w?.slotId === "string" && w.slotId.includes("-")) {
        const newId = w.slotId.replace(/-/g, "");
        const slot = (this.inputs || []).find(
          (s) => s.name === w.slotId || s.id === w.slotId,
        );
        if (slot) {
          slot.name = newId;
          slot.id = newId;
        }
        w.slotId = newId;
      }
    }
    // aggregates 顶层 + 旧 groupBy.aggregates 路径都迁(_migrateLegacyAggregates 在 onExecute
    // 入口才把后者升级到顶层,此时还在 onConfigure,旧路径数据原地存活)
    for (const aggSource of [
      this.properties.aggregates,
      this.properties.groupBy?.aggregates,
    ]) {
      for (const agg of aggSource || []) {
        for (const fw of agg.filterWhere || []) {
          if (typeof fw?.slotId === "string" && fw.slotId.includes("-")) {
            fw.slotId = fw.slotId.replace(/-/g, "");
          }
        }
      }
    }
    this._syncFieldOutputSlots();
  }

  // result slot 始终保留(SELECT first 拿单对象 / INSERT 拿单对象 / UPDATE 等拿数组)。
  // 字段 slot:SELECT first 按 fields.enabled,其他 CRUD 按 returningFields。
  // 主表条目 slot 名 = 字段名;关联条目(仅 INSERT 真生效)slot 名 = `${alias}_${fieldName}`,
  // 与后端 _generateRelatedInserts 的 relReturnEntries 响应键对齐。
  // _buildFrontendCode 末尾按 crudType 派单数(INSERT/SELECT-first)/数组首行(UPDATE/UPSERT/DELETE)
  // 写入解构表达式。字段 slot 识别走 reserved 名单排除,跨反序列化生效。
  _syncFieldOutputSlots() {
    const props = this.properties || {};
    const crudType = props.crudType || "select";
    const isFirst =
      crudType === "select" && (props.result?.mode || "rows") === "first";
    const reserved = new Set(["result", "table", "orderOut", "orderIn"]);

    const desired = new Set();
    if (isFirst) {
      for (const [fieldId, cfg] of Object.entries(props.fields || {})) {
        if (!cfg?.enabled) continue;
        const name = this._resolveNodeName(fieldId);
        if (name && !reserved.has(name)) desired.add(name);
      }
    } else {
      const allowRelated = crudType === "insert";
      for (const entry of props.returningFields || []) {
        if (typeof entry !== "string" || !entry.includes("::")) continue;
        const sepIdx = entry.indexOf("::");
        const source = entry.slice(0, sepIdx);
        const fieldId = entry.slice(sepIdx + 2);
        const fieldName = this._resolveNodeName(fieldId);
        if (!fieldName) continue;
        if (source === "main") {
          if (!reserved.has(fieldName)) desired.add(fieldName);
        } else if (allowRelated) {
          const cfg = props.relatedFields?.[source];
          if (!cfg) continue;
          const aliasRaw = (
            cfg.alias ||
            this._resolveNodeName(cfg.targetTableId) ||
            "rel"
          ).trim();
          const alias = aliasRaw.replace(/[^a-zA-Z0-9_]/g, "_") || "rel";
          const slotName = `${alias}_${fieldName}`;
          if (!reserved.has(slotName)) desired.add(slotName);
        }
      }
    }

    if (this.findOutputSlot("result") < 0) {
      this.addOutput("result", "string");
    }

    const existing = new Set();
    for (let i = (this.outputs?.length || 0) - 1; i >= 0; i--) {
      const slot = this.outputs[i];
      if (!slot?.name || reserved.has(slot.name)) continue;
      if (desired.has(slot.name)) existing.add(slot.name);
      else this.removeOutput(i);
    }
    for (const name of desired) {
      if (existing.has(name)) continue;
      this.addOutput(name, "string");
    }
  }

  _getKnexRef() {
    return "knex";
  }

  _needsOwnTransaction() {
    if (this._deferTransactionToRoute) return false;
    const { batchMode, crudType, relatedFields } = this.properties || {};
    // 级联写入(含 DELETE 链路)触发事务的条件:至少一个 RelNode 同时具备 targetTableId 和
    // viaFieldName(viaFieldName 是降级 joinCondition 的来源,缺失就算配了 entry
    // 也不会真正产出级联代码,无需包事务,避免"包了 transaction 但没生成级联"的虚假状态)
    const hasRelatedWrites =
      ["insert", "update", "upsert", "delete"].includes(crudType) &&
      Object.values(relatedFields || {}).some(
        (cfg) => cfg?.targetTableId && cfg?.viaFieldName,
      );
    return (
      hasRelatedWrites ||
      !!(batchMode?.enabled && batchMode.failStrategy !== "collect")
    );
  }

  _getRoutePath() {
    if (!this.properties.autoRoute && this.properties.routePath) {
      return this.properties.routePath;
    }
    return `/api/auto/crud_${this._getShortId()}`;
  }

  _getFuncName() {
    return safeFuncNameFromPath(
      this._getRoutePath(),
      `apiCrud_${this._getShortId()}`,
    );
  }

  _isRouteParamSlot(input) {
    if (!input?.name || input.type === "orderSlot") return false;
    if (input.name === "tableName") return false;
    if (/^cte\d+$/.test(input.name)) return false;
    return true;
  }

  _prepareRouteInputSlots() {
    for (const input of this.inputs || []) {
      if (this._isRouteParamSlot(input)) {
        input.valueMode = "label";
      }
    }
  }

  _getRouteParamMapping() {
    // 常规节点的 routeParam slot.name 来自数据库字段名 / where 等 slotId,
    // 直接当通讯属性名会把 DB 字段名暴露到 HTTP 接口。改用顺序 in0/in1/... 作为
    // 前后端通讯属性名,后端解构时 alias 回 slotName 给 SQL 代码使用。
    // 返回 [{slotName, wireName}],按 slot 顺序。
    return (this.inputs || [])
      .map((input, idx) => ({ input, idx }))
      .filter(
        ({ input, idx }) =>
          this._isRouteParamSlot(input) && this.isInputConnected(idx),
      )
      .map(({ input }, i) => ({
        slotName: input.name,
        wireName: `in${i}`,
      }));
  }

  _getRouteParamNames() {
    return this._getRouteParamMapping().map((m) => m.wireName);
  }

  _getRouteParamDestructure() {
    // buildRouteWrapper 直接把数组元素拼到 `const { ... } = request.body` 里,
    // 用 ES6 rename 语法 `in0: slotName` 让 SQL 代码继续引用 slotName。
    return this._getRouteParamMapping().map((m) =>
      m.wireName === m.slotName ? m.wireName : `${m.wireName}: ${m.slotName}`,
    );
  }

  _getInputRuntimeValueBySlotName(slotName) {
    const slotIdx = this.findInputSlot(slotName);
    if (slotIdx < 0) return "undefined";
    // route param slot 标 valueMode:'label',this.getInputData 返回 label。
    // fetch body 字段值要前端 wire 真值,直读 link。
    const linkId = this.inputs[slotIdx]?.link;
    const value =
      linkId != null ? this.graph?.links?.[linkId]?.data : undefined;
    return value !== undefined && value !== null && value !== ""
      ? value
      : "undefined";
  }

  _buildFrontendCode(mapping) {
    const funcName = this._getFuncName();
    const routePath = this._getRoutePath();
    const responseName = "data";
    const resultRef = `${funcName}_${responseName}`;
    // 函数签名带形参(wireName),body 用 shorthand({ in0, in1 }) 引形参,
    // 调用方传 wire 真值。函数定义不依赖外部 ref 名,可被多次调用、传不同参数。
    const wireNames = mapping.map((m) => m.wireName);
    const bodyJsonExpr =
      wireNames.length > 0
        ? `JSON.stringify({ ${wireNames.join(", ")} })`
        : `JSON.stringify({})`;
    // 调用参数:所有触发点都把 wire 真值传给 funcName。
    // mapping 同时记录 slotName(查 wire 真值)和 wireName(形参占位),按 mapping 顺序传实参。
    const callArgs = mapping
      .map((m) => this._getInputRuntimeValueBySlotName(m.slotName))
      .join(", ");

    // 触发逻辑(由 fetchCodegen 内的 exec 实现):
    // - auto + 有依赖:watch + immediate(deps 变化与挂载都触发)
    // - auto + 无依赖:onMounted(挂载跑一次)
    // - manual + 有依赖:watch(deps 变化触发) + 直接调用语句(orderSlot 位置触发)
    // - manual + 无依赖:仅直接调用语句
    // 三处都用 async 回调 + await,让下游 orderSlot 同步语句能在 fetch 完成、ref 写入后再执行。
    // FunctionBlock 子图含后端节点时 vueComponent 强制把 wrapper 设为 async,
    // 顶层 graph 的 watch/onMounted 回调本身就是 async,await 在所有位置都合法。
    const { jsCode, jsRefLines, importStr } = buildFetchFunction({
      funcName,
      method: "POST",
      routePath,
      params: wireNames,
      bodyJsonExpr,
      responseRefs: [{ refName: resultRef, jsonKey: responseName }],
      fetchMode: "robust",
      errorHandling: "notify",
      errorFallbackMessage: "Request failed",
      exec: {
        mode: this.properties.execMode === "auto" ? "auto" : "manual",
        watchDeps: this._collectWatchDeps(),
        immediateOnAuto: true,
        // manual 模式始终追加可排序的调用语句:
        // orderIn 已连 → CodeAssembler 按 order chain 排到对应位置;
        // orderIn 未连 → 默认顺序输出
        appendManualCall: true,
        callArgs,
      },
    });
    this.jsCode = jsCode;
    this.jsRefLines = jsRefLines;
    this.importStr = importStr;

    // 各 CRUD 的字段解构 slot:
    //  - SELECT first:字段 slot = `${resultRef}.value?.${name}`(单行对象)
    //  - INSERT:result slot 保留(整对象),字段 slot 同上
    //  - UPDATE/UPSERT/DELETE:result slot 保留(数组),字段 slot = `${resultRef}.value?.[0]?.${name}`(取首行)
    // 无数据时上游 ?. 防御 NPE。
    this._syncFieldOutputSlots();

    const reserved = new Set(["result", "table", "orderOut", "orderIn"]);
    const crudType = this.properties?.crudType || "select";
    const isArrayReturning = ["update", "upsert", "delete"].includes(crudType);
    const valuePrefix = isArrayReturning
      ? `${resultRef}.value?.[0]`
      : `${resultRef}.value`;

    const resultIdx = this.findOutputSlot("result");
    if (resultIdx >= 0) this.setOutputData(resultIdx, `${resultRef}.value`);
    for (let i = 0; i < (this.outputs?.length || 0); i++) {
      const slot = this.outputs[i];
      if (!slot?.name || reserved.has(slot.name)) continue;
      const accessor = /^[a-zA-Z_$][\w$]*$/.test(slot.name)
        ? `?.${slot.name}`
        : `?.[${JSON.stringify(slot.name)}]`;
      this.setOutputData(i, `${valuePrefix}${accessor}`);
    }
  }

  _collectWatchDeps() {
    const deps = new Set();
    for (let i = 0; i < (this.inputs?.length || 0); i++) {
      const input = this.inputs[i];
      if (!input?.name) continue;
      if (!this.isInputConnected(i)) continue;
      // 收集前端 watch 依赖要 wire 上游变量名,标 label 的 slot 不能用 getInputData(会返回 slot.name)
      const linkId = input.link;
      const value =
        linkId != null ? this.graph?.links?.[linkId]?.data : undefined;
      if (value && value !== "undefined") deps.add(value);
    }
    return [...deps];
  }

  onExecute() {
    this._prepareRouteInputSlots();
    const needsRouteTransaction = this._needsOwnTransaction();

    this._deferTransactionToRoute = true;
    try {
      super.onExecute();
    } finally {
      this._deferTransactionToRoute = false;
    }

    const tableBody = this.bgJsCode?.trim() || "";
    const mapping = this._getRouteParamMapping();
    const destructureNames = this._getRouteParamDestructure();
    const routePath = this._getRoutePath();
    const responseName = "data";
    // 通过显式 _lastResultVar 字段(由父类 onExecute 设置)拿结果变量名,
    // 不再读 LiteGraph 私字段 outputs[i]._data,也不再用 "result" 字面当哨兵。
    // 父类 onExecute 顶部已 reset _lastResultVar = null;tableId 解析失败等
    // 早 return 路径不写,这里读到 null/'' 就走 throw 路由。
    const tableResult = this._lastResultVar || "";

    const routeCommon = {
      method: "POST",
      path: routePath,
      paramNames: destructureNames,
      paramSource: "body",
      returnNames: [responseName],
      errorHandling: "reply500",
      remark: this.properties.remark || "",
      prefixSse: true,
      includeKnexImport: true,
    };

    // 早 return 守卫:tableBody 缺失 / _lastResultVar 未被父类写入(tableId 失效等)
    // 时,产 throw 路由壳告知前端表配置缺失;frontend 仍照常生成函数 + 触发(请求会 500)。
    if (!tableBody || !tableResult) {
      const { code, imports } = buildBackendRoute({
        ...routeCommon,
        body: `throw new Error('Table configuration is missing')`,
      });
      this.bgJsCode = code;
      this.bgImportStr = imports.join("\n");
      this._buildFrontendCode(mapping);
      return;
    }

    // 成功通知由 TableNode.onExecute 在 tableBody 末尾拼一行 notifyClient(措辞含
    // table/crudType,比路由级 "POST /xxx succeeded" 信息量大);路由层不再额外拼,
    // 避免对同一次请求成功触发两条通知。
    const routeBody = needsRouteTransaction
      ? wrapInKnexTransaction(tableBody, {
          responseVarName: responseName,
          resultExpr: tableResult,
        })
      : `${tableBody}\n  const ${responseName} = ${tableResult}`;

    const { code, imports } = buildBackendRoute({
      ...routeCommon,
      body: routeBody,
    });
    this.bgJsCode = code;
    this.bgImportStr = imports.join("\n");

    this._buildFrontendCode(mapping);
  }

  static get title() {
    return "Backend CRUD";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "backend-crud-node-001";
  }

  static get treePath() {
    return "Backend";
  }
}
