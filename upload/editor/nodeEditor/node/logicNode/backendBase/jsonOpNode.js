import { nodeMeta } from "../../nodeMetea.js";
import { defineAsyncComponent } from "vue";

/**
 * JsonOpNode — JSON 字段操作节点
 *
 * 必须在 dbSubgraph 容器内运行。继承 nodeMeta(单语句节点,无子图)。
 *
 * 双模式:
 *  - expression(默认):产 knex.jsonXxx(...) 表达式,塞到下游 tableNode SELECT 字段 / UPDATE 值 slot
 *  - predicate:产 knex.raw('...', [...]) WHERE 谓词表达式,塞到下游 tableNode where 项 operator='raw' 的 value slot
 *
 * expression mode op:
 *  - extract       → knex.jsonExtract(col, path)
 *  - set           → knex.jsonSet(col, path, value)
 *  - insert        → knex.jsonInsert(col, path, value)(仅 path 不存在时插)
 *  - remove        → knex.jsonRemove(col, path)
 *  - value         → knex.jsonValue(col, path)(标量值,vs jsonExtract 返回 JSON)
 *  - path          → knex.raw 兜底(PG: jsonb_path_query)
 *  - arrayLength   → knex.jsonArrayLength(col)
 *  - arrayInsert   → knex.jsonArrayInsert(col, path, value)
 *
 * predicate mode op(本节点产 raw 谓词):
 *  - whereJsonObject     → ??::jsonb = ?::jsonb (整体相等)
 *  - whereJsonPath       → jsonb_path_exists(??::jsonb, ?) (PG 路径存在)
 *  - whereJsonSupersetOf → ??::jsonb @> ?::jsonb
 *  - whereJsonSubsetOf   → ??::jsonb <@ ?::jsonb
 *  - jsonContains        → ??::jsonb @> ?::jsonb (PG)
 *
 * isSlot=true 时取上游 wire 变量名(在 dbSubgraph 内会是 label name);否则取静态字符串字面。
 */
export class JsonOpNode extends nodeMeta {
  constructor() {
    super();

    this.inputs.length = 0;
    this.outputs.length = 0;

    this.categories = "backend";
    this.bgcolor = "#4a1a2a";
    this.color = "#7a2d4a";

    this.properties = {
      // expression: 表达式片段供 SELECT/UPDATE 字段 slot 使用
      // predicate:  WHERE 谓词表达式供 tableNode where operator='raw' 的 value slot 使用
      mode: "expression",
      // expression op: extract | set | insert | remove | value | path | arrayLength | arrayInsert
      // predicate  op: whereJsonObject | whereJsonPath | whereJsonSupersetOf | whereJsonSubsetOf | jsonContains
      op: "extract",
      column: "",
      columnIsSlot: false,
      columnSlotId: "col_slot",
      path: "$.",
      pathIsSlot: false,
      pathSlotId: "path_slot",
      value: "",
      valueIsSlot: false,
      valueSlotId: "value_slot",
    };

    this.addOutput("expression", "string");

    this.uiPanel = defineAsyncComponent(() => import("./jsonOpNodePanel.vue"));
  }

  _getShortId() {
    return String(this.id).slice(0, 8);
  }

  // 取 isSlot 模式下的 wire 上游变量名,失败回退到静态值
  _readSlotOrStatic(isSlot, slotId, staticVal) {
    if (isSlot) {
      const idx = this.inputs?.findIndex(
        (s) => s?.id === slotId || s?.name === slotId,
      );
      if (idx != null && idx >= 0 && this.isInputConnected(idx)) {
        const v = this.getInputData(idx);
        if (v != null && v !== "") return { kind: "var", value: String(v) };
      }
    }
    return { kind: "literal", value: staticVal || "" };
  }

  // SQL 字符串字面量包裹:转义单引号
  _strLiteral(s) {
    return `'${String(s).replace(/\\/g, "\\\\").replace(/'/g, "\\'")}'`;
  }

  // 把 {kind, value} 转成 SQL 中的参数片段
  // - var: 变量名直拼(不加引号);- literal 列名/路径: 字符串字面;- literal 值: 智能识别数字/布尔/字符串
  _toSqlArg(spec, hint) {
    if (spec.kind === "var") return spec.value;
    // hint='ident' (column/path 用字符串字面),hint='value' (智能识别字面)
    if (hint === "ident") return this._strLiteral(spec.value);
    // value hint:让用户写的 'dark' 不被双重 quote;若是 number/bool/null/已 quote 字符串就直传
    const v = spec.value.trim();
    if (v === "" || v === "null") return "null";
    if (v === "true" || v === "false") return v;
    if (/^-?\d+(\.\d+)?$/.test(v)) return v;
    // 已经是 '...' / "..." 包裹的字符串就直传
    if (/^['"`].*['"`]$/.test(v)) return v;
    // 否则当字符串字面
    return this._strLiteral(v);
  }

  _buildExpression() {
    const mode = this.properties.mode || "expression";
    const op = this.properties.op || "extract";

    const col = this._readSlotOrStatic(
      this.properties.columnIsSlot,
      this.properties.columnSlotId,
      this.properties.column,
    );
    const path = this._readSlotOrStatic(
      this.properties.pathIsSlot,
      this.properties.pathSlotId,
      this.properties.path,
    );
    const val = this._readSlotOrStatic(
      this.properties.valueIsSlot,
      this.properties.valueSlotId,
      this.properties.value,
    );

    if (!col.value) return `/* JsonOp: 未配置 column */ null`;

    const colArg = this._toSqlArg(col, "ident");
    const pathArg = this._toSqlArg(path, "ident");
    const valArg = this._toSqlArg(val, "value");

    if (mode === "predicate") {
      // predicate 模式:knex.whereJsonXxx 是 builder 方法不是表达式,只能 raw 兜底
      const colLit = col.kind === "var" ? col.value : this._strLiteral(col.value);
      const valLit = val.kind === "var" ? val.value : this._jsonValueArg(val.value);
      const pathLit = path.kind === "var" ? path.value : this._strLiteral(path.value);

      switch (op) {
        case "whereJsonObject":
          return `knex.raw('??::jsonb = ?::jsonb', [${colLit}, JSON.stringify(${valLit})])`;
        case "whereJsonPath":
          // PG jsonb_path_exists(col, jsonpath_string)
          return `knex.raw('jsonb_path_exists(??::jsonb, ?)', [${colLit}, ${pathLit}])`;
        case "whereJsonSupersetOf":
          return `knex.raw('??::jsonb @> ?::jsonb', [${colLit}, JSON.stringify(${valLit})])`;
        case "whereJsonSubsetOf":
          return `knex.raw('??::jsonb <@ ?::jsonb', [${colLit}, JSON.stringify(${valLit})])`;
        case "jsonContains":
          return `knex.raw('??::jsonb @> ?::jsonb', [${colLit}, JSON.stringify(${valLit})])`;
        default:
          return `/* JsonOp: predicate 未知 op=${op} */ knex.raw('1=1')`;
      }
    }

    // expression 模式:走 knex.jsonXxx 表达式族
    switch (op) {
      case "extract":
        return `knex.jsonExtract(${colArg}, ${pathArg})`;
      case "set":
        return `knex.jsonSet(${colArg}, ${pathArg}, ${valArg})`;
      case "insert":
        return `knex.jsonInsert(${colArg}, ${pathArg}, ${valArg})`;
      case "remove":
        return `knex.jsonRemove(${colArg}, ${pathArg})`;
      case "value":
        // knex.jsonValue 返回标量,vs jsonExtract 返回 JSON
        return `knex.jsonValue(${colArg}, ${pathArg})`;
      case "path":
        // knex 未暴露 .jsonPath 表达式;走 PG jsonb_path_query 兜底
        return `knex.raw('jsonb_path_query(??::jsonb, ?)', [${colArg.replace(/^'/, '').replace(/'$/, '')}, ${pathArg}])`;
      case "arrayLength":
        return `knex.jsonArrayLength(${colArg})`;
      case "arrayInsert":
        return `knex.jsonArrayInsert(${colArg}, ${pathArg}, ${valArg})`;
      default:
        return `/* JsonOp: 未知 op=${op} */ null`;
    }
  }

  // predicate 模式下 value 静态字面的对象/数组兜底:用户在 Panel 输入 JSON 字面
  // 我们直接传字符串,运行时 JSON.stringify 包裹(对象/数组形态);非对象走直传
  _jsonValueArg(rawValue) {
    const v = (rawValue || "").trim();
    if (!v) return `''`;
    // 已经是 quoted/array/object literal,直接传字面让 runtime JSON.stringify 处理
    if (/^[\{\[]/.test(v) || /^['"`]/.test(v)) return v;
    return this._strLiteral(v);
  }

  onExecute() {
    const expression = this._buildExpression();
    this.bgJsCode = "";
    this.setOutputData(this.findOutputSlot("expression"), expression);
  }

  // 同步 isSlot input slot —— 由 panel 在 isSlot 切换 / mode / op 变更后调用
  // 显示规则:
  //  - column 永远可显(所有 op 都用)
  //  - path 显示规则:
  //      expression: extract/set/insert/remove/value/path/arrayInsert(arrayLength 不要)
  //      predicate:  whereJsonPath(其它 predicate 不用 path)
  //  - value 显示规则:
  //      expression: set/insert/arrayInsert
  //      predicate:  whereJsonObject/whereJsonSupersetOf/whereJsonSubsetOf/jsonContains(whereJsonPath 不用)
  syncSlots() {
    const wanted = new Set();
    const props = this.properties;
    const mode = props.mode || "expression";
    const op = props.op || "extract";

    const pathExprOps = new Set([
      "extract", "set", "insert", "remove", "value", "path", "arrayInsert",
    ]);
    const valueExprOps = new Set(["set", "insert", "arrayInsert"]);
    const pathPredOps = new Set(["whereJsonPath"]);
    const valuePredOps = new Set([
      "whereJsonObject", "whereJsonSupersetOf", "whereJsonSubsetOf", "jsonContains",
    ]);

    const pathRelevant = mode === "expression" ? pathExprOps.has(op) : pathPredOps.has(op);
    const valueRelevant = mode === "expression" ? valueExprOps.has(op) : valuePredOps.has(op);

    if (props.columnIsSlot) wanted.add(props.columnSlotId);
    if (props.pathIsSlot && pathRelevant) wanted.add(props.pathSlotId);
    if (props.valueIsSlot && valueRelevant) wanted.add(props.valueSlotId);

    // 移除非 wanted
    for (let i = (this.inputs?.length || 0) - 1; i >= 0; i--) {
      const s = this.inputs[i];
      if (!s) continue;
      if (s.type === "orderSlot") continue;
      if (!wanted.has(s.id) && !wanted.has(s.name)) {
        this.removeInput(i);
      }
    }
    // 补齐
    const have = new Set(
      (this.inputs || [])
        .filter((s) => s?.name)
        .flatMap((s) => [s.id, s.name].filter(Boolean)),
    );
    if (props.columnIsSlot && !have.has(props.columnSlotId)) {
      this.addInput(props.columnSlotId, "string", { id: props.columnSlotId });
    }
    if (props.pathIsSlot && pathRelevant && !have.has(props.pathSlotId)) {
      this.addInput(props.pathSlotId, "string", { id: props.pathSlotId });
    }
    if (props.valueIsSlot && valueRelevant && !have.has(props.valueSlotId)) {
      this.addInput(props.valueSlotId, "string", { id: props.valueSlotId });
    }

    this.setSize(this.computeSize());
    this.setDirtyCanvas(true, true);
  }

  onConfigure(o) {
    super.onConfigure?.(o);
    this.syncSlots();
  }

  static get title() {
    return "JsonOp";
  }
  static get name() {
    return this.title;
  }
  static get id() {
    return "json-op-node-001";
  }
  static get treePath() {
    return "Backend/Database";
  }
}
