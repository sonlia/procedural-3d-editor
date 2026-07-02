import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";
import { useProjectStore } from "src/stores/projectMange.js";
import { parseGraphConnections } from "../../../../dbDragEditor/hooks/useDbJoinManager.js";
import {
  buildOrderByLine,
  buildLockClause,
  buildLimitOffset,
  buildCteChain,
  buildAggregateFilter,
  buildHavingLeafLine,
  buildHaving,
  buildHavingInner,
  buildWhere,
  buildWhereInner,
  buildRelTree,
  buildRelatedJoins,
  collectEnabledFields,
  parseReturningFields,
  buildSelect,
  buildSelectCount,
  buildInsert,
  buildBatchInsert,
  buildUpdate,
  buildBatchUpdate,
  buildUpsert,
  buildDelete,
  buildRelatedInserts,
  buildRelatedUpserts,
  buildRelatedUpdates,
  buildDerivedTable,
} from "./dbCodegen/index.js";

/**
 * Table 节点 - 数据库表操作节点（用于 Database Subgraph 内部）
 * 基于 knex.js 生成链式查询代码
 * 支持 SELECT / INSERT / UPDATE / DELETE 四种 CRUD 操作
 * 通过 isSlot 机制支持动态参数输入
 *
 * 与 DBTableNode 的核心区别：
 * 1. 感知父节点（DatabaseSubgraph）的事务状态，动态切换 knex/trx
 * 2. 新增 table output slot（供子查询使用）
 * 3. 新增 tableNameSlot toggle（用于接收子查询输入）
 * 4. 新增 relatedFields / batchMode 等高级属性
 * 5. 不再在节点层包裹事务，由 DatabaseSubgraph 统一管理
 */
export class TableNode extends nodeMeta {
  constructor() {
    super();

    this.categories = "backend";
    this.bgcolor = "#4a1a2a";
    this.color = "#7a2d4a";

    this.properties = {
      // ── 保留现有（来自 DBTableNode） ──
      dbConnectionId: "", // 来自 dbTree 的数据库连接节点 ID
      transaction: false, // 保留但优先使用父节点的事务状态

      tableId: "",
      crudType: "select", // select | insert | update | delete | upsert

      fields: {}, // { fieldId: { enabled: true } }（enabled = SELECT 列勾选 / INSERT/UPDATE 字段启用）

      where: [], // [{ fieldId, operator, value, isSlot, slotId, negated, valueMode }]
      whereLogic: "and", // and | or

      orderBy: [], // [{ fieldId, direction, nullsPosition }]

      limit: { value: "", isSlot: false, slotId: "limit_slot" },
      offset: { value: "", isSlot: false, slotId: "offset_slot" },

      groupBy: {
        enabled: false,
        fieldIds: [],
        aggregates: [], // (P0-12: 保留作旧数据迁移源,新数据写顶层 aggregates)
      },

      // P0-12: 聚合解耦 GROUP BY,顶层独立配置
      aggregates: [], // [{ func, fieldId, alias, distinct }]

      having: {
        enabled: false,
        // 旧单条件字段保留向后兼容
        fieldId: "",
        operator: ">",
        value: 0,
        isSlot: false,
        slotId: "having_slot",
        // P0-4: 多条件
        conditions: [], // [{ fieldId, operator, value, isSlot, slotId, negated, valueMode }]
        logic: "and", // and | or
      },

      distinct: { enabled: false, onFields: [] }, // onFields: [fieldId,...] 非空走 .distinctOn(PG only)

      // 输出模式:
      //  execute(默认):产 `const var = await knex(...)`,result slot 输出变量名
      //  builder:不 await 不赋值,result/table slot 输出 builder 字符串,供下游 CTE/Union/whereExists 嵌入
      //  本次仅 SELECT 支持 builder;UPDATE/INSERT/DELETE 在 builder 模式自动回退 execute
      outputMode: "execute",

      result: {
        mode: "rows", // rows | count | first | aggregate | pluck
        pluckField: "", // pluck 模式取的列名(字段名字符串,Panel 提供输入)
      },

      // P0-9: 行锁(配合事务,SELECT 模式)
      lockMode: "none", // none | forUpdate | forShare
      // 行锁 modifier(skipLocked / noWait),仅在 lockMode != 'none' 且事务环境生效
      lockModifier: "none", // none | skipLocked | noWait

      // P0-6: UPDATE/DELETE returning
      returningFields: [], // [fieldId, ...]

      // INSERT RETURNING(单选标量):source='main' 表示本表;source=linkId 表示某级联子表
      // fieldId 为 dbTree 字段节点 id;_resolveNodeName 还原为字段名
      returningField: { source: "", fieldId: "" },

      // ── 新增 ──
      tableNameSlot: false, // toggle: true 时表名变为 input slot（子查询）
      relatedFields: {}, // 关联表字段 { linkId: { targetTableId, joinType: "left", viaFieldName, parentLinkId: null, selectedFieldId: null, fields: {} } } 或链式 { chainId: { path: [...], targetFieldId, targetFieldName, targetTableId } }
      batchMode: {
        // 批量操作
        enabled: false,
        failStrategy: "rollback", // rollback | skip | collect
      },
      batchDataSlot: false, // toggle: true 时增加批量数据 input slot
      batchStaticData: "", // batchDataSlot=false 时的静态 JSON 数据
      fieldMapping: {}, // 批量模式下的属性->字段映射
      conflictFields: [], // upsert 冲突字段 fieldId 数组，用于 ON CONFLICT(...)
      // 是否走 ON CONFLICT 路径由 _hasUniqueConstraint 自动判定，不再让用户手工 toggle
      // P0-5: upsert 冲突处理动作
      conflictAction: "merge", // merge | ignore
      notifyOnSuccess: false,  // SSE 通知：成功时也提示（默认关闭，失败始终通知）
      // CTE 串链:cte1..cteN 多 input slot;每个 slot 接 CTENode 输出对象 {alias, builder, recursive}
      // _generateCteChain 在 SELECT 起始拼 .with(alias, builder) / .withRecursive 链
      cteCount: 0,
    };

    // 新的默认 output slots
    this.addOutput("table", "string"); // 当前表查询引用（供子查询使用）
    this.addOutput("result", "string"); // 查询结果变量名（保留原有）

    this.uiPanel = defineAsyncComponent(() => import("./tableNodePanel.vue"));
  }

  // 反序列化兼容:旧存档没有 returningField 字段,补默认值
  onConfigure(o) {
    super.onConfigure?.(o);
    if (!this.properties) return;
    if (!this.properties.returningField || typeof this.properties.returningField !== "object") {
      this.properties.returningField = { source: "", fieldId: "" };
    } else {
      if (typeof this.properties.returningField.source !== "string") {
        this.properties.returningField.source = "";
      }
      if (typeof this.properties.returningField.fieldId !== "string") {
        this.properties.returningField.fieldId = "";
      }
    }
    // result.mode='scalar' 已废弃:归并到 first 模式(语义上都是单条记录),
    // 字段勾选保留;BackendCrudNode 子类会按 enabled 字段动态产出字段 slot。
    if (this.properties.result?.mode === "scalar") {
      this.properties.result.mode = "first";
    }
  }

  // ─── ID->name 解析 ───

  _resolveNodeName(nodeId) {
    const projectStore = useProjectStore();
    const dbTree = projectStore.currentProject?.database?.dbTree || [];
    return dbTree.find((n) => n.id === nodeId)?.name ?? null;
  }

  // 节点短 ID:用于生成代码中的变量名后缀,避免同一 dbSubgraph 内多个 tableNode
  // 引用同一张表时 const 变量名撞名(如 db_NewTable_result 两次声明)
  _getShortId() {
    return String(this.id).slice(0, 8);
  }

  // ─── upsert 自动判定:fieldIds 中是否至少一个具备唯一约束(PK / unique / unique index) ───

  /**
   * 给定表ID + 字段ID集合,判断这些字段是否足以让 PG 触发 ON CONFLICT。
   *
   * 数据位置(都在表 graphNode 的 properties 内):
   *  - properties.field[fieldId].primary  ← 字段是主键
   *  - properties.field[fieldId].unique   ← 字段有 unique 约束
   *  - properties.indexes[]               ← 索引数组,{ id: fieldId, unique: boolean, sort }
   *
   * 任一字段满足"是 PK / 字段级 unique / 被 unique index 引用",即返回 true。
   */
  _hasUniqueConstraint(tableId, fieldIds) {
    if (!tableId || !fieldIds?.length) return false;

    const projectStore = useProjectStore();
    const dbTree = projectStore.currentProject?.database?.dbTree || [];

    // 向上找 dbbase 父节点(可能隔着 folder)
    const tableNode = dbTree.find((n) => n.id === tableId && n.type === "table");
    if (!tableNode) return false;
    let dbId = tableNode.pId;
    while (dbId) {
      const parent = dbTree.find((n) => n.id === dbId);
      if (!parent) return false;
      if (parent.type === "dbbase") break;
      dbId = parent.pId;
    }
    if (!dbId) return false;

    const graphData = projectStore.getDbEditorData(dbId, "graphData");
    const tableGraphNode = graphData?.nodes?.find((n) => n.id === tableId);
    if (!tableGraphNode) return false;

    const fieldProps = tableGraphNode.properties?.field || {};
    const indexes = tableGraphNode.properties?.indexes || [];
    const fieldIdSet = new Set(fieldIds);

    for (const fid of fieldIds) {
      const fc = fieldProps[fid];
      if (fc?.primary || fc?.unique) return true;
    }
    for (const idx of indexes) {
      if (idx.unique && idx.id && fieldIdSet.has(idx.id)) return true;
    }
    return false;
  }

  // ─── 判断使用 knex 还是 trx ───

  /**
   * 如果父节点（DatabaseSubgraph）开启了事务，返回 "trx"
   * 否则返回 "knex"
   */
  _getKnexRef() {
    const parent = this.graph?._subgraph_node;
    if (parent?.properties?.transaction) {
      return "trx";
    }
    return "knex";
  }

  // 把节点 this 端口打包成 plain ctx,作为 dbCodegen/ 纯模块的第二个参数。
  // 字段约定见 codeStrategies/shared/dbCodegen/index.js 顶部注释。
  // ctx 是 plain object,纯库不依赖 LiteGraph / Pinia 类型,只调这些函数。
  //
  // Phase 4:ctx.ref 在自身需要独立事务(父节点无事务 + 级联/批量场景)时直接给 'trx',
  // 让纯库生成 trx 版本代码,外层只需一次 `await knex.transaction(async trx => { ... })`
  // 包裹,不再事后字符串替换 `knex(`→`trx(`(避免误改字符串字面量 / 注释)。
  _buildCodegenCtx() {
    const parentRef = this._getKnexRef();
    const needsOwnTrx = parentRef === "knex" && this._needsOwnTransaction();
    return {
      ref: needsOwnTrx ? "trx" : parentRef,
      resolveNodeName: (id) => this._resolveNodeName(id),
      hasUniqueConstraint: (tableId, ids) => this._hasUniqueConstraint(tableId, ids),
      getSlotValue: (slotId) => this._getSlotValue(slotId),
      findInputSlot: (name) => this.findInputSlot(name),
      isInputConnected: (idx) => this.isInputConnected(idx),
      getInputData: (idx) => this.getInputData(idx),
      // 3.C:JOIN 树 / returning 解析所需的桥
      // _findJoinCondition 依赖 useProjectStore + parseGraphConnections,留在适配层,
      // 纯库只走 ctx.findJoinCondition 屏蔽 Pinia 依赖。
      findJoinCondition: (sourceTableName, targetTableName) =>
        this._findJoinCondition(sourceTableName, targetTableName),
      getShortId: () => this._getShortId(),
      // _collectEnabledFields 优先按 slot.id 命中(避免字段重命名 slot.name 滞后)
      findInputSlotById: (fieldId) => {
        const idx = this.inputs?.findIndex((s) => s.id === fieldId);
        return idx == null ? -1 : idx;
      },
      // 3.D:CRUD 大方法依赖的额外桥
      getBatchInputVar: () => this._getBatchInputVar(),
      // 3.E:Related 纯模块依赖 — slot 模式取上游变量名,static 模式取静态值,未连 null
      getRelNodeValue: (node) => this._getRelNodeValue(node),
    };
  }

  // ─── 判断是否需要独立事务保护 ───

  /**
   * 级联写入(含 DELETE 链路)和批量操作(非 collect 策略)需要事务保护:
   * - 关联级联(INSERT/UPDATE/UPSERT/DELETE 且 relatedFields 非空):多张表多语句需原子
   * - batchMode 非 collect:批量操作失败时需回滚
   */
  _needsOwnTransaction() {
    const { batchMode, crudType, relatedFields } = this.properties;
    const hasRelatedWrites =
      ["insert", "update", "upsert", "delete"].includes(crudType) &&
      Object.keys(relatedFields || {}).length > 0;
    return (
      hasRelatedWrites ||
      (batchMode.enabled && batchMode.failStrategy !== "collect")
    );
  }

  // ─── onExecute：根据 crudType 生成代码 ───

  // P0-12 旧数据迁移:把 groupBy.aggregates 升级到顶层 aggregates(只迁一次)
  _migrateLegacyAggregates() {
    const props = this.properties;
    const legacy = props?.groupBy?.aggregates;
    const top = props?.aggregates;
    if (Array.isArray(legacy) && legacy.length > 0 && (!Array.isArray(top) || top.length === 0)) {
      props.aggregates = legacy.map((a) => ({
        func: a.func,
        fieldId: a.fieldId,
        field: a.field, // 旧 name 形式也保留
        alias: a.alias,
        distinct: !!a.distinct,
      }));
      props.groupBy.aggregates = []; // 清空旧路径,避免重复
    }
  }

  onExecute() {
    // P0-12 迁移先跑
    this._migrateLegacyAggregates();

    // 显式重置每轮结果变量名 — BackendCrudNode 等子类读这个字段拿 result 名,
    // 不再去碰 LiteGraph 私字段 outputs[i]._data 或用 "result" 字面当 sentinel
    this._lastResultVar = null;

    const props = this.properties;
    const ref = this._getKnexRef();

    // 检查是否通过 slot 接收子查询
    let subqueryCode = null;
    if (props.tableNameSlot) {
      const slotIdx = this.findInputSlot("tableName");
      if (slotIdx >= 0 && this.isInputConnected(slotIdx)) {
        subqueryCode = this.getInputData(slotIdx);
      }
    }

    // 通过 ID 解析表名
    const tableName = props.tableId
      ? this._resolveNodeName(props.tableId)
      : null;

    if (!tableName && !subqueryCode) {
      this.bgJsCode = "// Table: 表配置已失效，请重新选择";
      return;
    }

    let code = "";
    const safeName = tableName
      ? tableName.replace(/[^a-zA-Z0-9_]/g, "_")
      : "subquery";
    const shortId = this._getShortId();
    const varName = `db_${safeName}_${shortId}_result`;
    this._isMultiLineCode = false;
    this._insertValVar = null;

    // 一次性 cache ctx,供下面所有 build* 调用复用(避免每次 switch 分支重新构造)
    const ctx = this._buildCodegenCtx();

    // 派生表模式: tableNameSlot=true 且上游 wire 接到了 query builder 字符串。
    // 跳过整个 CRUD switch,生成 await knex.select(...).from((sub).as('sub'))... 形式,
    // 一次 SQL round-trip 完成嵌套查询(SQL 标准的 FROM 派生表语义,非 WHERE IN)。
    // 仅 SELECT,UPDATE/DELETE/INSERT/UPSERT 不入此分支。
    if (subqueryCode && props.tableNameSlot) {
      // 边界:本节点 _needsOwnTransaction 且父节点未事务时,ctx.ref='trx',
      // buildDerivedTable 主框架已是 trx 版;但 subqueryCode 是上游 wire data,
      // 纯库无法重生,如果上游也是父节点未事务场景,它会含 `knex(`,会跨事务调 knex 池。
      // 这里**只对 subqueryCode 这一段** .replace() 改写(不污染纯库产出),
      // 仍避免对完整 finalCode 全量改写带来的注释/字面量误改风险。
      const needsOwnTrx = this._needsOwnTransaction() && ref === "knex";
      const effectiveSubquery = needsOwnTrx
        ? subqueryCode.replace(/\bknex\(/g, "trx(").replace(/\bknex\./g, "trx.")
        : subqueryCode;
      let finalCode = buildDerivedTable(props, effectiveSubquery, varName, ctx);
      if (needsOwnTrx) {
        finalCode = `await knex.transaction(async (trx) => {\n  ${finalCode}\n})`;
      }
      this.bgJsCode = finalCode;
      this.bgImportStr = "import knex from '{{BG_ROOT}}/db/knex.js'";
      this.setOutputData(this.findOutputSlot("result"), varName);
      this._lastResultVar = varName;
      // 派生表模式本节点不再作为另一个派生表 source,table output 设 null
      const _tIdx = this.findOutputSlot("table");
      if (_tIdx >= 0) this.setOutputData(_tIdx, null);
      return;
    }

    let selectMeta = null;

    switch (props.crudType) {
      case "select": {
        const mode = props.result?.mode || "rows";
        if (mode === "count") {
          code = buildSelectCount(props, tableName, ctx);
          selectMeta = { mode: "count", varName };
        } else if (mode === "aggregate") {
          // P0-13: 聚合单行模式
          // 走 buildSelect(已含顶层 aggregates 聚合) + 末尾 .first() 取单行,
          // 返回 `{sum_x: ..., avg_y: ...}` 对象
          let aggregateCode = buildSelect(props, tableName, ctx);
          if (!/\.first\(/.test(aggregateCode)) aggregateCode += `\n  .first()`;
          code = aggregateCode;
          selectMeta = { mode: "aggregate", varName };
        } else if (mode === "first") {
          // first 模式:取单行对象(返回 {} | null),语义上同 aggregate 但不限定聚合
          let firstCode = buildSelect(props, tableName, ctx);
          if (!/\.first\(/.test(firstCode)) firstCode += `\n  .first()`;
          code = firstCode;
          selectMeta = { mode: "first", varName };
        } else if (mode === "pluck") {
          // pluck 模式:取某列的标量数组([v1, v2, ...]);依赖 pluckField 配置
          const pluckField = (props.result?.pluckField || "").trim();
          if (!pluckField) {
            // 没配置 field 退化为 rows
            code = buildSelect(props, tableName, ctx);
          } else {
            // qualify:有 JOIN 时关联表会走别名 t1,pluck 不带前缀会引用歧义
            // 这里只取本表 field,Panel 引导用户填本表字段名;别名需求场景用 rows 自取
            code = buildSelect(props, tableName, ctx) + `\n  .pluck('${pluckField}')`;
            selectMeta = { mode: "pluck", varName };
          }
        } else {
          code = buildSelect(props, tableName, ctx);
        }
        break;
      }
      case "insert":
        if (props.batchMode.enabled) {
          code = buildBatchInsert(props, tableName, ctx);
        } else {
          const r = buildInsert(props, tableName, ctx);
          this._insertValVar = r.valVar ?? null;
          this._isMultiLineCode = !!r.multiLine;
          code = r.code;
        }
        break;
      case "update":
        if (props.batchMode.enabled) {
          code = buildBatchUpdate(props, tableName, ctx);
        } else {
          const r = buildUpdate(props, tableName, ctx);
          this._isMultiLineCode = !!r.multiLine;
          code = r.code;
        }
        break;
      case "upsert": {
        const r = buildUpsert(props, tableName, ctx);
        this._isMultiLineCode = !!r.multiLine;
        code = r.code;
        break;
      }
      case "delete": {
        const r = buildDelete(props, tableName, ctx);
        this._isMultiLineCode = !!r.multiLine;
        code = r.code;
        break;
      }
      default:
        this.bgJsCode = `// Table: 未知操作类型 "${props.crudType}"`;
        return;
    }

    // ── builder 模式分叉:仅 SELECT 启用;result/table slot 输出 builder 字符串
    // 供下游 CTE/Union/whereExists 直接嵌入主查询。其他 CRUD 在 builder 模式
    // 当前退化为 execute(PG `WITH x AS (INSERT/UPDATE/DELETE)` 待后续接入)
    const outputMode = props.outputMode || "execute";
    if (outputMode === "builder" && props.crudType === "select") {
      let builderCode = code;
      if (builderCode.startsWith("await ")) builderCode = builderCode.slice(6);
      // 单行压缩,沿用 table slot 现有规则(防多行嵌入 .from((multi).as('sub')) 排版尴尬)
      builderCode = builderCode.replace(/\n\s+/g, "");
      this.bgJsCode = "";
      this.bgImportStr = "";
      this.setOutputData(this.findOutputSlot("result"), builderCode);
      const _tIdx = this.findOutputSlot("table");
      if (_tIdx >= 0) this.setOutputData(_tIdx, builderCode);
      return;
    }
    if (outputMode === "builder" && props.crudType !== "select") {
      console.warn(
        `[TableNode] outputMode='builder' 当前仅支持 SELECT;crudType='${props.crudType}' 自动回退 execute。`,
      );
    }

    // count 模板用字符串模板捕获 code。派生表场景的 whereIn 拼接已在 onExecute
    // 顶部 early return,这里不需要再处理 subqueryCode。
    if (selectMeta?.mode === "count") {
      this._selectFinalCode = `const ${selectMeta.varName} = Number((${code})?.total ?? 0)`;
    }

    // 代码变量赋值
    // 批量模式下 skip/collect 策略或关联表级联操作生成多行独立代码，不能用 const 包裹
    const isBatchMultiLine =
      props.batchMode.enabled && props.batchMode.failStrategy !== "rollback";
    const isMultiLine = isBatchMultiLine || this._isMultiLineCode;
    let finalCode;
    if (this._selectFinalCode) {
      finalCode = this._selectFinalCode;
      this._selectFinalCode = null;
    } else {
      finalCode = isMultiLine ? code : `const ${varName} = ${code}`;
    }

    // 成功通知：拼到 finalCode 末尾独立一行（失败处理由父 dbSubgraph 统一负责）
    if (props.notifyOnSuccess && tableName) {
      finalCode += `\nnotifyClient('success', '${tableName} ${props.crudType} 成功')`;
    }

    // 判断是否需要独立事务保护
    // ctx.ref 已经在 _buildCodegenCtx 内根据 _needsOwnTransaction 切到 'trx',
    // 这里只外包一次 await knex.transaction(...),不再 .replace() 改写字符串。
    if (this._needsOwnTransaction()) {
      if (ref === "knex") {
        // Subgraph 未开启事务:使用独立 knex.transaction
        finalCode = `await knex.transaction(async (trx) => {\n  ${finalCode}\n})`;
      }
      // ref === "trx"(Subgraph 已开启事务):
      // 级联删除和批量操作的代码已经使用了 trx,在 subgraph 事务中自动成为同一事务的一部分
      // 如果未来需要独立回滚点,可使用 savepoint:
      // finalCode = `await trx.transaction(async (sp) => {\n  ${finalCode}\n})`;
    }

    this.bgJsCode = finalCode;

    // 后端 import 声明:tableNode 总要引用 knex (直调 knex('table') 或经 knex.transaction → trx)
    // {{BG_ROOT}} 占位符由 vueComponent _saveBackendToDisk 按页面深度替换
    // 同 dbSubgraph 等节点的 knex import 会被 mergeImports 去重
    this.bgImportStr = "import knex from '{{BG_ROOT}}/db/knex.js'";

    // 设置 result 输出
    // INSERT 模式的 RETURNING 单选会在 _generateInsert / _generateRelatedInserts 内部
    // 把目标字段提取为标量并暴露到 this._insertValVar;命中时输出该标量变量名而非完整 result。
    // 多行模式下 _generateInsert/_generateUpdate 内部自行声明 `${safeName}_${shortId}_result`
    // (不带 db_ 前缀);_generateBatchInsert/Update 的 skip/collect 用 `results`。
    // 单行模式由外层 const varName = ... 包裹,带 db_ 前缀。
    // setOutputData 必须跟实际声明对齐,否则下游 / route wrapper 会引用未声明变量。
    const insertValVar = this._insertValVar;
    this._insertValVar = null;
    let resultVar;
    if (insertValVar) {
      resultVar = insertValVar;
    } else if (isBatchMultiLine) {
      resultVar = "results";
    } else if (this._isMultiLineCode) {
      resultVar = `${safeName}_${shortId}_result`;
    } else {
      resultVar = varName;
    }
    this.setOutputData(this.findOutputSlot("result"), resultVar);
    this._lastResultVar = resultVar;

    // 设置 table 输出(供下游 tableNameSlot 作为 FROM 派生表的子查询源)
    // 协议: 未 await 的 knex query builder 字符串,包含完整 SELECT 多列 + WHERE + orderBy + limit/offset。
    // 下游会把它包成 `(${subqueryCode}).as('sub')` 放到 .from() 里,形成 SQL 派生表语义,
    // 一条 SQL 完成嵌套查询。子查询列数不限(派生表允许全列)。
    // 仅 SELECT rows 模式生成有效字符串,其他模式(count/first/aggregate/insert/update/delete)
    // 没有"可被 SELECT 嵌套"的查询语义,setOutputData(null),下游派生表分支跳过。
    const tableSlotIdx = this.findOutputSlot("table");
    if (tableSlotIdx >= 0) {
      const isRowsSelect =
        props.crudType === "select" && (props.result?.mode || "rows") === "rows";
      if (isRowsSelect && tableName) {
        let tableOutput = `${ref}('${tableName}')`;
        const enabledFields = Object.entries(props.fields)
          .filter(([_, config]) => config.enabled)
          .map(([fieldId]) => this._resolveNodeName(fieldId))
          .filter(Boolean);
        if (enabledFields.length > 0) {
          tableOutput += `.select([${enabledFields.map((f) => `'${f}'`).join(", ")}])`;
        }
        // 没勾字段时不加 .select,默认 SELECT *
        tableOutput += buildWhere(props, ctx);
        for (const ob of props.orderBy || []) {
          const obField = ob.fieldId ? this._resolveNodeName(ob.fieldId) : ob.field;
          if (obField) {
            tableOutput += `.orderBy('${obField}', '${ob.direction || "asc"}')`;
          }
        }
        tableOutput += buildLimitOffset(props, ctx);
        // 整段压成单行,避免下游 .from((multi-line).as('sub')) 嵌入后排版尴尬
        tableOutput = tableOutput.replace(/\n\s+/g, "");
        this.setOutputData(tableSlotIdx, tableOutput);
      } else {
        this.setOutputData(tableSlotIdx, null);
      }
    }
  }

  // ─── 关联表 JOIN 条件查询(留在适配层:依赖 useProjectStore + parseGraphConnections) ───

  /**
   * 查找两个表之间的 JOIN 条件
   * 从序列化的 graphData 中解析 nodes + links 获取连接关系
   * @param {string} sourceTableName 源表名
   * @param {string} targetTableName 目标表名
   * @returns {{ sourceField: string, targetField: string } | null}
   */
  _findJoinCondition(sourceTableName, targetTableName) {
    const projectStore = useProjectStore();
    const dbTree = projectStore.currentProject?.database?.dbTree || [];

    for (const node of dbTree) {
      if (node.type !== "dbbase") continue;
      const graphData = projectStore.getDbEditorData(node.id, 'graphData');
      const connections = parseGraphConnections(graphData);

      for (const conn of connections) {
        const isForward =
          conn.sourceTableName === sourceTableName &&
          conn.targetTableName === targetTableName;
        const isReverse =
          conn.sourceTableName === targetTableName &&
          conn.targetTableName === sourceTableName;

        if (isForward) {
          return {
            sourceField: conn.sourceFieldName,
            targetField: conn.targetFieldName,
          };
        }
        if (isReverse) {
          return {
            sourceField: conn.targetFieldName,
            targetField: conn.sourceFieldName,
          };
        }
      }
    }
    return null;
  }

  // ─── 批量数据输入变量获取(留在适配层:依赖 LiteGraph slot/wire) ───

  /**
   * 获取批量数据输入的变量名
   * 从 batchInput slot 获取连接的数据
   */
  _getBatchInputVar() {
    if (this.properties.batchDataSlot) {
      const slotIdx = this.findInputSlot("batchInput");
      if (slotIdx >= 0 && this.isInputConnected(slotIdx)) {
        return this.getInputData(slotIdx) || "batchInput";
      }
      return "batchInput";
    }
    // 静态数据模式：直接内联 JSON
    const staticData = this.properties.batchStaticData?.trim();
    if (staticData) {
      return staticData;
    }
    return "[]";
  }

  // 获取 RelNode 的字段值表达式(留在适配层:依赖 LiteGraph slot/wire)
  // - slot 模式: 取 slot 上的上游变量名;未连返回 null(让生成层跳过)
  // - static 模式: 返回静态值字符串
  // - none 模式: 返回 null
  _getRelNodeValue(relNode) {
    if (!relNode) return null;
    if (relNode.valueMode === "slot") {
      const slotIdx = this.findInputSlot(relNode.slotName);
      if (slotIdx < 0 || !this.isInputConnected(slotIdx)) return null;
      const v = this.getInputData(slotIdx);
      return v == null || v === "" ? null : v;
    }
    if (relNode.valueMode === "static") {
      return relNode.staticValue;
    }
    return null;
  }


  // ─── Slot 值获取辅助方法 ───

  _getSlotValue(slotId) {
    const slotIdx = this.inputs?.findIndex(
      (s) => s.id === slotId || s.name === slotId,
    );
    if (slotIdx >= 0 && this.isInputConnected(slotIdx)) {
      return this.getInputData(slotIdx);
    }
    return null;
  }

  // ─── 表名 toggle slot 管理 ───

  /**
   * 同步表名 toggle slot
   * 当 tableNameSlot === true 时添加 tableName input slot
   * 当 tableNameSlot === false 时移除
   */
  updateTableNameSlot() {
    const hasSlot = this.inputs?.some((s) => s.name === "tableName");
    if (this.properties.tableNameSlot && !hasSlot) {
      this.addInput("tableName", "string", { id: "tableName_slot" });
    } else if (!this.properties.tableNameSlot && hasSlot) {
      const idx = this.findInputSlot("tableName");
      if (idx >= 0) this.removeInput(idx);
    }
    this.setSize(this.computeSize());
    this.setDirtyCanvas(true, true);
  }

  // ─── CTE Slot 管理 ───

  /**
   * 同步 cte1..cteN input slot,N = properties.cteCount(0~10)。
   * 每个 slot 接 CTENode 的 cte output(对象 {alias, builder, recursive, materialized})
   * 由 _generateCteChain 在主查询起始处拼成 .with(alias, builder) 链。
   */
  updateCtesSlots() {
    const want = Math.max(0, Math.min(10, this.properties.cteCount || 0));
    const wantedNames = new Set();
    for (let i = 1; i <= want; i++) wantedNames.add(`cte${i}`);

    // 移除多余 cte 系列 slot(从后往前)
    for (let i = (this.inputs?.length || 0) - 1; i >= 0; i--) {
      const s = this.inputs[i];
      if (!s?.name) continue;
      if (/^cte\d+$/.test(s.name) && !wantedNames.has(s.name)) {
        this.removeInput(i);
      }
    }
    // 补齐缺失
    const have = new Set((this.inputs || []).map((s) => s?.name).filter(Boolean));
    for (let i = 1; i <= want; i++) {
      const name = `cte${i}`;
      if (!have.has(name)) {
        this.addInput(name, "object", { id: `slot_cte_${i}` });
      }
    }
    this.setSize(this.computeSize());
    this.setDirtyCanvas(true, true);
  }

  // ─── 批量 Slot 管理 ───

  /**
   * 同步批量数据 input slot
   * 当 batchDataSlot === true 时添加 batchInput input slot
   * 当 batchDataSlot === false 时移除
   */
  updateBatchSlot() {
    const hasBatchSlot = this.inputs?.some((s) => s.name === "batchInput");
    if (this.properties.batchDataSlot && !hasBatchSlot) {
      this.addInput("batchInput", "string", { id: "batch_data_slot" });
    } else if (!this.properties.batchDataSlot && hasBatchSlot) {
      const idx = this.findInputSlot("batchInput");
      if (idx >= 0) this.removeInput(idx);
    }
    this.setSize(this.computeSize());
    this.setDirtyCanvas(true, true);
  }

  // ─── 字段 slot 动态管理 ───

  updateFieldSlots() {
    const props = this.properties;
    const isSlotNames = new Set();

    // 收集 isSlot 创建的 slot 名称
    for (const w of props.where) {
      if (w.isSlot) isSlotNames.add(w.slotId);
    }
    if (props.limit.isSlot) isSlotNames.add(props.limit.slotId);
    if (props.offset.isSlot) isSlotNames.add(props.offset.slotId);
    if (props.having.isSlot) isSlotNames.add(props.having.slotId);

    // tableName slot 由 updateTableNameSlot 管理，这里跳过
    if (props.tableNameSlot) isSlotNames.add("tableName");

    // batchInput slot 由 updateBatchSlot 管理，这里跳过
    if (props.batchDataSlot) isSlotNames.add("batchInput");

    // cte input slots(cte1..cteN)由 updateCtesSlots 管理,这里跳过保护
    for (let i = 1; i <= (props.cteCount || 0); i++) {
      isSlotNames.add(`cte${i}`);
    }

    // 移除非 isSlot 的 input（字段 slot），从后往前移除避免索引问题
    // 通用保护:orderSlot 类型(基类的触发入口)由子类决定语义,这里不动
    for (let i = this.inputs.length - 1; i >= 0; i--) {
      const input = this.inputs[i];
      if (input.type === "orderSlot") continue;
      if (
        !isSlotNames.has(input.name) &&
        !isSlotNames.has(input.id)
      ) {
        this.removeInput(i);
      }
    }

    // 移除非 result 且非 table 的 output（字段 slot)
    // 通用保护:orderSlot 类型(基类的完成信号出口)由子类决定语义,这里不动
    for (let i = this.outputs.length - 1; i >= 0; i--) {
      const output = this.outputs[i];
      if (output.type === "orderSlot") continue;
      if (output.name !== "result" && output.name !== "table") {
        this.removeOutput(i);
      }
    }

    // 根据 crudType 添加字段 slot
    for (const [fieldId, config] of Object.entries(props.fields)) {
      if (!config.enabled) continue;
      const fieldName = this._resolveNodeName(fieldId);
      if (!fieldName) continue;

      if (props.crudType === "insert" || props.crudType === "update" || props.crudType === "upsert") {
        // SELECT 列勾选只用于选 SELECT 字段，不创建 output slot；
        // INSERT/UPDATE/UPSERT 仅 isSlot=true 时创建 input slot
        if (config.isSlot) {
          this.addInput(fieldName, "string", { id: fieldId });
        }
      }
      // SELECT/DELETE 不创建任何 slot
    }

    // 关联字段 slot：SELECT 不创建（关联字段勾选只控制是否加入 SELECT 列），
    // 仅 INSERT/UPDATE/UPSERT 在 isSlot=true 时创建 input slot
    if (props.crudType === "insert" || props.crudType === "update" || props.crudType === "upsert") {
      const mainTableName = props.tableId ? this._resolveNodeName(props.tableId) : "";
      const relNodes = buildRelTree(mainTableName, this.properties, this._buildCodegenCtx());
      for (const node of relNodes) {
        if (node.valueMode === "slot" && node.selectedFieldName) {
          this.addInput(node.slotName, "string", { id: `rel_${node.linkId}` });
        }
      }
    }

    this.setSize(this.computeSize());
    this.setDirtyCanvas(true, true);
  }

  // ─── WHERE / LIMIT isSlot 管理 ───

  updateWhereSlots() {
    for (const w of this.properties.where) {
      const existIdx = this.inputs?.findIndex(
        (s) => s.name === w.slotId || s.id === w.slotId,
      );

      if (w.isSlot && existIdx === -1) {
        this.addInput(w.slotId, "string", { id: w.slotId });
      } else if (!w.isSlot && existIdx >= 0) {
        this.removeInput(existIdx);
      }
    }

    // LIMIT slot
    this._syncIsSlot(this.properties.limit);
    // OFFSET slot
    this._syncIsSlot(this.properties.offset);
    // HAVING slot
    if (this.properties.having.enabled) {
      this._syncIsSlot(this.properties.having);
    }

    this.setSize(this.computeSize());
    this.setDirtyCanvas(true, true);
  }

  _syncIsSlot(config) {
    const existIdx = this.inputs?.findIndex(
      (s) => s.name === config.slotId || s.id === config.slotId,
    );
    if (config.isSlot && existIdx === -1) {
      this.addInput(config.slotId, "string", { id: config.slotId });
    } else if (!config.isSlot && existIdx >= 0) {
      this.removeInput(existIdx);
    }
  }

  // ─── 静态属性 ───

  static get title() {
    return "Table";
  }

  static get name() {
    return this.title;
  }

  static get id() {
    return "table-node-001";
  }

  static get treePath() {
    return "Backend/Database";
  }
}
